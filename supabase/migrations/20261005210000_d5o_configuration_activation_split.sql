-- Forward correction: publish a complete candidate without changing the tenant
-- default. Explicit activation is a second administrator command. A distinct
-- tenant-configuration branch keeps published effective intervals nonoverlapping.

create or replace function rybex_internal.d5o_configuration_manifest_check(p_manifest jsonb)
returns void language plpgsql stable set search_path=public,pg_temp as $$
declare p jsonb; k text;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_manifest) x where x not in ('synthetic','sourceSha256','d5oSourceVersionId','d5oPresentation'))
  then raise exception 'invalid_configuration_manifest'; end if;
  if p_manifest ? 'd5oSourceVersionId' then
    if jsonb_typeof(p_manifest->'d5oSourceVersionId') is distinct from 'string'
      or not exists(select 1 from config_configuration_versions where id=(p_manifest->>'d5oSourceVersionId')::uuid)
    then raise exception 'invalid_configuration_source'; end if;
  end if;
  if p_manifest ? 'd5oPresentation' then
    p := p_manifest->'d5oPresentation';
    if jsonb_typeof(p) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(p) x where x not in ('schemaVersion','phaseLabels','changeReason'))
      or p->>'schemaVersion'<>'1'
      or jsonb_typeof(p->'phaseLabels') is distinct from 'object'
      or length(coalesce(p->>'changeReason',''))<8
    then raise exception 'invalid_presentation_manifest'; end if;
    for k in select jsonb_object_keys(p->'phaseLabels') loop
      if k not in ('discover','define','develop','design','deploy','operate')
        or jsonb_typeof(p->'phaseLabels'->k) is distinct from 'string'
        or length(trim(p->'phaseLabels'->>k)) not between 2 and 80
      then raise exception 'invalid_phase_label'; end if;
    end loop;
  end if;
end $$;

create or replace function public.d5o_configuration_create_draft_v1(p_workspace uuid,p_expected_active uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; source config_configuration_versions%rowtype; source_config config_tenant_configurations%rowtype;
  branch config_tenant_configurations%rowtype; draft config_configuration_versions%rowtype;
  old_id uuid; mapping jsonb := '{}'::jsonb; row_data jsonb; table_name text;
  tables text[] := array['config_phase_definitions','config_gate_definitions','config_work_item_type_definitions',
   'config_role_definitions','config_evidence_type_definitions','config_gate_evidence_requirements',
   'config_gate_decision_outcomes','config_decision_right_definitions','config_exception_rules',
   'config_exception_approval_role_links'];
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  if (ctx->>'active')::uuid is distinct from p_expected_active then raise exception 'stale_configuration_default'; end if;
  select * into source from config_configuration_versions where id=p_expected_active and status='published' for share;
  if not found then raise exception 'configuration_unavailable'; end if;
  select * into source_config from config_tenant_configurations where id=source.tenant_configuration_id and tenant_id=(ctx->>'tenant')::uuid;
  if not found then raise exception 'invalid_configuration_lineage'; end if;
  perform rybex_internal.d5o_configuration_graph_check(source.id);
  perform rybex_internal.d5o_configuration_manifest_check(source.config_manifest_json);
  insert into config_tenant_configurations(tenant_id,activation_id,config_key,name,mode,status,metadata_json,created_by)
  values(source_config.tenant_id,source_config.activation_id,'d5o_candidate_'||replace(gen_random_uuid()::text,'-',''),
   source_config.name||' candidate',source_config.mode,'draft',
   jsonb_build_object('sourceVersionId',source.id,'sourceConfigurationId',source_config.id),auth.uid()) returning * into branch;
  insert into config_configuration_versions(tenant_configuration_id,version,status,source_template_pack_version_id,
   config_manifest_json,diff_json,created_by)
  values(branch.id,1,'draft',source.source_template_pack_version_id,
   source.config_manifest_json||jsonb_build_object('d5oSourceVersionId',source.id),
   jsonb_build_object('changed_objects','[]'::jsonb),auth.uid()) returning * into draft;
  mapping := jsonb_build_object(source.id::text,draft.id::text);
  foreach table_name in array tables loop
    for row_data in execute format('select to_jsonb(x) from public.%I x where configuration_version_id=$1 order by id',table_name) using source.id loop
      mapping := mapping || jsonb_build_object(row_data->>'id',gen_random_uuid()::text);
    end loop;
  end loop;
  foreach table_name in array tables loop
    for row_data in execute format('select to_jsonb(x) from public.%I x where configuration_version_id=$1 order by id',table_name) using source.id loop
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',table_name,table_name)
        using rybex_internal.d5o_configuration_remap(row_data,mapping);
    end loop;
  end loop;
  perform rybex_internal.d5o_configuration_graph_check(draft.id);
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,after_json,reason)
  values((ctx->>'tenant')::uuid,branch.id,draft.id,'created','d5o.configuration.v1',auth.uid(),'admin',
   jsonb_build_object('sourceVersionId',source.id,'draftVersionId',draft.id),'Complete graph copied into candidate branch');
  return jsonb_build_object('draftVersionId',draft.id,'version',draft.version,'sourceVersionId',source.id);
end $$;

create or replace function public.d5o_configuration_save_draft_v1(p_workspace uuid,p_draft uuid,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; v config_configuration_versions%rowtype;
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  perform rybex_internal.d5o_configuration_manifest_check(p_manifest);
  select cv.* into v from config_configuration_versions cv
    join config_tenant_configurations tc on tc.id=cv.tenant_configuration_id
    where cv.id=p_draft and tc.tenant_id=(ctx->>'tenant')::uuid and cv.status='draft' and tc.status='draft'
    for update of cv;
  if not found then raise exception 'draft_unavailable'; end if;
  if p_manifest->>'d5oSourceVersionId' is distinct from v.config_manifest_json->>'d5oSourceVersionId'
    or (p_manifest-'d5oPresentation') is distinct from (v.config_manifest_json-'d5oPresentation')
  then raise exception 'immutable_configuration_source'; end if;
  update config_configuration_versions set config_manifest_json=p_manifest,updated_at=now(),updated_by=auth.uid() where id=v.id;
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,before_json,after_json,reason)
  values((ctx->>'tenant')::uuid,v.tenant_configuration_id,v.id,'updated','d5o.configuration.v1',auth.uid(),'admin',
   jsonb_build_object('manifest',v.config_manifest_json),jsonb_build_object('manifest',p_manifest),'Draft presentation updated');
  return jsonb_build_object('draftVersionId',v.id,'version',v.version,'status','draft');
end $$;

create or replace function public.d5o_configuration_publish_v1(p_workspace uuid,p_draft uuid,p_expected_active uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; v config_configuration_versions%rowtype; work_type record; c jsonb;
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  if (ctx->>'active')::uuid is distinct from p_expected_active then raise exception 'stale_configuration_default'; end if;
  select cv.* into v from config_configuration_versions cv
    join config_tenant_configurations tc on tc.id=cv.tenant_configuration_id
    where cv.id=p_draft and cv.status='draft' and tc.status='draft' and tc.tenant_id=(ctx->>'tenant')::uuid
      and cv.config_manifest_json->>'d5oSourceVersionId'=p_expected_active::text
      and tc.metadata_json->>'sourceVersionId'=p_expected_active::text
    for update of cv;
  if not found then raise exception 'draft_unavailable'; end if;
  perform rybex_internal.d5o_configuration_manifest_check(v.config_manifest_json);
  perform rybex_internal.d5o_configuration_graph_check(v.id);
  update config_tenant_configurations set status='published',active_version_id=v.id,updated_at=now(),updated_by=auth.uid()
    where id=v.tenant_configuration_id;
  update config_configuration_versions set status='published',effective_from=now(),effective_to=null,
    published_at=now(),published_by=auth.uid(),updated_at=now(),updated_by=auth.uid() where id=v.id;
  for work_type in select work_item_type_key,lifecycle_json->>'gateKey' gate_key
    from config_work_item_type_definitions where configuration_version_id=v.id and status='active' loop
    c := rybex_internal.d5o_m1_configuration(p_workspace,v.id,work_type.work_item_type_key,work_type.gate_key);
    if (c->>'versionId')::uuid is distinct from v.id then raise exception 'configuration_validation_mismatch'; end if;
  end loop;
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,before_json,after_json,reason)
  values((ctx->>'tenant')::uuid,v.tenant_configuration_id,v.id,'published','d5o.configuration.v1',auth.uid(),'admin',
   jsonb_build_object('activeVersionId',p_expected_active),jsonb_build_object('publishedCandidateId',v.id),
   v.config_manifest_json->'d5oPresentation'->>'changeReason');
  return jsonb_build_object('publishedVersionId',v.id,'activeVersionId',p_expected_active,'version',v.version);
end $$;

create or replace function public.d5o_configuration_activate_v1(p_workspace uuid,p_candidate uuid,p_expected_active uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; old_version config_configuration_versions%rowtype; candidate config_configuration_versions%rowtype;
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  if (ctx->>'active')::uuid is distinct from p_expected_active then raise exception 'stale_configuration_default'; end if;
  select * into old_version from config_configuration_versions where id=p_expected_active and status='published' for update;
  if not found then raise exception 'configuration_unavailable'; end if;
  select cv.* into candidate from config_configuration_versions cv
    join config_tenant_configurations tc on tc.id=cv.tenant_configuration_id
    where cv.id=p_candidate and cv.status='published' and tc.status='published'
      and tc.tenant_id=(ctx->>'tenant')::uuid
      and cv.config_manifest_json->>'d5oSourceVersionId'=p_expected_active::text
      and tc.metadata_json->>'sourceVersionId'=p_expected_active::text
      and cv.effective_from<=now() and (cv.effective_to is null or cv.effective_to>now())
    for update of cv;
  if not found then raise exception 'published_candidate_unavailable'; end if;
  perform rybex_internal.d5o_configuration_graph_check(candidate.id);
  update config_configuration_versions set status='superseded',effective_to=now() where id=old_version.id;
  update config_tenant_configurations set status='superseded',updated_at=now(),updated_by=auth.uid()
    where id=old_version.tenant_configuration_id;
  update config_tenant_configurations set status='active',updated_at=now(),updated_by=auth.uid()
    where id=candidate.tenant_configuration_id;
  update config_tenants set active_configuration_version_id=candidate.id,updated_at=now(),updated_by=auth.uid()
    where id=(ctx->>'tenant')::uuid;
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,before_json,after_json,reason)
  values((ctx->>'tenant')::uuid,candidate.tenant_configuration_id,candidate.id,'activated','d5o.configuration.v1',auth.uid(),'admin',
   jsonb_build_object('activeVersionId',old_version.id),jsonb_build_object('activeVersionId',candidate.id),
   candidate.config_manifest_json->'d5oPresentation'->>'changeReason');
  return jsonb_build_object('activeVersionId',candidate.id,'supersededVersionId',old_version.id);
end $$;

revoke all on function public.d5o_configuration_activate_v1(uuid,uuid,uuid) from public;
grant execute on function public.d5o_configuration_activate_v1(uuid,uuid,uuid) to authenticated;
