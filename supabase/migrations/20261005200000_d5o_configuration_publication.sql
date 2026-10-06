-- D5O prototype: administrator-owned, complete M1 configuration version publication.
-- The copy deliberately fails if a source uses version-scoped tables outside this
-- verified graph. It must never publish a partial configuration.

create or replace function rybex_internal.d5o_configuration_admin(p_workspace uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a jsonb; t config_tenants%rowtype; n integer;
begin
  a := rybex_internal.d5o_m1_actor(p_workspace);
  if a->>'workspace_role' <> 'admin' then raise exception 'configuration_admin_required'; end if;
  select count(*) into n from config_tenants where workspace_id=p_workspace and status<>'archived';
  if n=0 then raise exception 'no_tenant_mapping'; end if;
  if n<>1 then raise exception 'ambiguous_tenant_mapping'; end if;
  select * into t from config_tenants where workspace_id=p_workspace and status='active' for update;
  if not found or t.active_configuration_version_id is null then raise exception 'configuration_unavailable'; end if;
  return jsonb_build_object('actor',auth.uid(),'tenant',t.id,'active',t.active_configuration_version_id);
end $$;

create or replace function rybex_internal.d5o_configuration_graph_check(p_version uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer; approved text[] := array[
 'config_phase_definitions','config_gate_definitions','config_work_item_type_definitions',
 'config_role_definitions','config_evidence_type_definitions','config_gate_evidence_requirements',
 'config_gate_decision_outcomes','config_decision_right_definitions','config_exception_rules',
 'config_exception_approval_role_links'];
begin
  for r in select c.relname from pg_class c join pg_namespace s on s.oid=c.relnamespace
    where s.nspname='public' and c.relkind='r' and c.relname like 'config_%'
      and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='configuration_version_id' and not a.attisdropped)
      and c.relname<>'config_configuration_audit_events'
      and not(c.relname=any(approved))
  loop
    execute format('select count(*) from public.%I where configuration_version_id=$1',r.relname) into n using p_version;
    if n>0 then raise exception 'unsupported_configuration_graph: %',r.relname; end if;
  end loop;
  if not exists(select 1 from config_work_item_type_definitions where configuration_version_id=p_version and status='active')
    or not exists(select 1 from config_gate_definitions where configuration_version_id=p_version and status='active')
    or not exists(select 1 from config_role_definitions where configuration_version_id=p_version and status='active')
    or not exists(select 1 from config_gate_decision_outcomes where configuration_version_id=p_version and status='active')
    or not exists(select 1 from config_decision_right_definitions where configuration_version_id=p_version and status='active')
  then raise exception 'incomplete_configuration_graph'; end if;
end $$;

create or replace function rybex_internal.d5o_configuration_manifest_check(p_manifest jsonb)
returns void language plpgsql immutable set search_path=pg_catalog as $$
declare p jsonb; k text;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_manifest) x where x not in ('synthetic','sourceSha256','d5oPresentation'))
  then raise exception 'invalid_configuration_manifest'; end if;
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

-- Direct authenticated writes to version rows are revoked below. The checked
-- SECURITY DEFINER commands are the only authenticated mutation path.

create or replace function public.d5o_configuration_create_draft_v1(p_workspace uuid,p_expected_active uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; source config_configuration_versions%rowtype; draft config_configuration_versions%rowtype;
  old_id uuid; new_id uuid; mapping jsonb := '{}'::jsonb; row_data jsonb; remapped jsonb;
  table_name text; tables text[] := array[
   'config_phase_definitions','config_gate_definitions','config_work_item_type_definitions',
   'config_role_definitions','config_evidence_type_definitions','config_gate_evidence_requirements',
   'config_gate_decision_outcomes','config_decision_right_definitions','config_exception_rules',
   'config_exception_approval_role_links'];
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  if (ctx->>'active')::uuid is distinct from p_expected_active then raise exception 'stale_configuration_default'; end if;
  select * into source from config_configuration_versions where id=p_expected_active and status='published' for share;
  if not found then raise exception 'configuration_unavailable'; end if;
  perform rybex_internal.d5o_configuration_graph_check(source.id);
  perform rybex_internal.d5o_configuration_manifest_check(source.config_manifest_json);
  insert into config_configuration_versions(tenant_configuration_id,version,status,base_configuration_version_id,
   source_version_id,source_template_pack_version_id,config_manifest_json,diff_json,created_by)
  values(source.tenant_configuration_id,
   (select coalesce(max(version),0)+1 from config_configuration_versions where tenant_configuration_id=source.tenant_configuration_id),
   'draft',source.id,source.id,source.source_template_pack_version_id,source.config_manifest_json,
   jsonb_build_object('changed_objects','[]'::jsonb),auth.uid()) returning * into draft;
  mapping := jsonb_build_object(source.id::text,draft.id::text);
  foreach table_name in array tables loop
    for row_data in execute format('select to_jsonb(x) from public.%I x where configuration_version_id=$1 order by id',table_name) using source.id loop
      old_id := (row_data->>'id')::uuid; new_id := gen_random_uuid();
      mapping := mapping || jsonb_build_object(old_id::text,new_id::text);
    end loop;
  end loop;
  foreach table_name in array tables loop
    for row_data in execute format('select to_jsonb(x) from public.%I x where configuration_version_id=$1 order by id',table_name) using source.id loop
      remapped := row_data;
      -- Replace only UUID-valued columns and exact UUID strings in nested JSON.
      -- All generated IDs exist in the mapping before inserts begin.
      select rybex_internal.d5o_configuration_remap(row_data,mapping) into remapped;
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',table_name,table_name) using remapped;
    end loop;
  end loop;
  perform rybex_internal.d5o_configuration_graph_check(draft.id);
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,after_json,reason)
  values((ctx->>'tenant')::uuid,draft.tenant_configuration_id,draft.id,'created','d5o.configuration.v1',auth.uid(),'admin',
   jsonb_build_object('sourceVersionId',source.id,'draftVersionId',draft.id),'Complete graph copied into draft');
  return jsonb_build_object('draftVersionId',draft.id,'version',draft.version,'sourceVersionId',source.id);
end $$;

create or replace function rybex_internal.d5o_configuration_remap(p_value jsonb,p_map jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare k text; v jsonb; result jsonb;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      result := '{}'::jsonb;
      for k,v in select key,value from jsonb_each(p_value) loop
        result := result || jsonb_build_object(k,rybex_internal.d5o_configuration_remap(v,p_map));
      end loop;
      return result;
    when 'array' then
      select coalesce(jsonb_agg(rybex_internal.d5o_configuration_remap(value,p_map) order by ordinality),'[]'::jsonb)
        into result from jsonb_array_elements(p_value) with ordinality;
      return result;
    when 'string' then
      return to_jsonb(coalesce(p_map->>(p_value#>>'{}'),p_value#>>'{}'));
    else return p_value;
  end case;
end $$;

create or replace function public.d5o_configuration_save_draft_v1(p_workspace uuid,p_draft uuid,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; v config_configuration_versions%rowtype;
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  perform rybex_internal.d5o_configuration_manifest_check(p_manifest);
  select cv.* into v from config_configuration_versions cv
    join config_tenant_configurations tc on tc.id=cv.tenant_configuration_id
    where cv.id=p_draft and tc.tenant_id=(ctx->>'tenant')::uuid and cv.status='draft' for update of cv;
  if not found then raise exception 'draft_unavailable'; end if;
  update config_configuration_versions set config_manifest_json=p_manifest,updated_at=now(),updated_by=auth.uid()
    where id=v.id;
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,before_json,after_json,reason)
   values((ctx->>'tenant')::uuid,v.tenant_configuration_id,v.id,'updated','d5o.configuration.v1',auth.uid(),'admin',
    jsonb_build_object('manifest',v.config_manifest_json),jsonb_build_object('manifest',p_manifest),'Draft presentation updated');
  return jsonb_build_object('draftVersionId',v.id,'version',v.version,'status','draft');
end $$;

create or replace function public.d5o_configuration_publish_v1(p_workspace uuid,p_draft uuid,p_expected_active uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; old_version config_configuration_versions%rowtype; v config_configuration_versions%rowtype;
  work_type record; c jsonb; k text; expected text[]; actual text[];
begin
  ctx := rybex_internal.d5o_configuration_admin(p_workspace);
  if (ctx->>'active')::uuid is distinct from p_expected_active then raise exception 'stale_configuration_default'; end if;
  select * into old_version from config_configuration_versions where id=p_expected_active and status='published' for update;
  select cv.* into v from config_configuration_versions cv
    join config_tenant_configurations tc on tc.id=cv.tenant_configuration_id
    where cv.id=p_draft and cv.status='draft' and cv.base_configuration_version_id=old_version.id
      and tc.tenant_id=(ctx->>'tenant')::uuid and cv.tenant_configuration_id=old_version.tenant_configuration_id
    for update of cv;
  if not found then raise exception 'draft_unavailable'; end if;
  perform rybex_internal.d5o_configuration_manifest_check(v.config_manifest_json);
  perform rybex_internal.d5o_configuration_graph_check(v.id);
  -- The M1 engine must be able to load and validate every active Work Type in the new version.
  -- Temporarily make it resolvable in this transaction, then validate before commit.
  update config_configuration_versions set status='superseded',effective_to=now() where id=old_version.id;
  update config_configuration_versions set status='published',effective_from=now(),effective_to=null,
    published_at=now(),published_by=auth.uid(),updated_at=now(),updated_by=auth.uid() where id=v.id;
  for work_type in select work_item_type_key,lifecycle_json->>'gateKey' gate_key
    from config_work_item_type_definitions where configuration_version_id=v.id and status='active' loop
    c := rybex_internal.d5o_m1_configuration(p_workspace,v.id,work_type.work_item_type_key,work_type.gate_key);
    if (c->>'versionId')::uuid is distinct from v.id then raise exception 'configuration_validation_mismatch'; end if;
  end loop;
  update config_tenant_configurations set active_version_id=v.id,updated_at=now(),updated_by=auth.uid()
    where id=v.tenant_configuration_id;
  update config_tenants set active_configuration_version_id=v.id,updated_at=now(),updated_by=auth.uid()
    where id=(ctx->>'tenant')::uuid;
  insert into config_configuration_audit_events(tenant_id,tenant_configuration_id,configuration_version_id,
   event_type,event_source,actor_id,actor_role_key,before_json,after_json,reason)
  values((ctx->>'tenant')::uuid,v.tenant_configuration_id,v.id,'published','d5o.configuration.v1',auth.uid(),'admin',
   jsonb_build_object('activeVersionId',old_version.id),jsonb_build_object('activeVersionId',v.id),
   v.config_manifest_json->'d5oPresentation'->>'changeReason');
  return jsonb_build_object('publishedVersionId',v.id,'supersededVersionId',old_version.id,'version',v.version);
end $$;

revoke all on function public.d5o_configuration_create_draft_v1(uuid,uuid) from public;
revoke all on function public.d5o_configuration_save_draft_v1(uuid,uuid,jsonb) from public;
revoke all on function public.d5o_configuration_publish_v1(uuid,uuid,uuid) from public;
grant execute on function public.d5o_configuration_create_draft_v1(uuid,uuid) to authenticated;
grant execute on function public.d5o_configuration_save_draft_v1(uuid,uuid,jsonb) to authenticated;
grant execute on function public.d5o_configuration_publish_v1(uuid,uuid,uuid) to authenticated;
revoke insert,update,delete on config_configuration_versions from authenticated;
