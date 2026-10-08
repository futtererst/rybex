-- UNAPPLIED synthetic-only author collection candidate. Depends on authority,
-- storage and create candidates. No cross-owner or legacy opportunity read.
-- Keep outside the migration chain until isolated tenant/identity proof passes.
begin;

create function public.d5o_list_my_discover_drafts_v1(
  p_workspace_id uuid, p_configuration_version_id uuid, p_gate_key text,
  p_query text default '', p_before_updated_at timestamptz default null,
  p_before_work_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb;
  authority jsonb;
  cfg jsonb;
  search_text text;
  items jsonb;
  more_rows boolean;
  next_updated_at timestamptz;
  next_work_id uuid;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  if p_configuration_version_id is null or coalesce(p_gate_key,'')=''
     or (p_before_updated_at is null)<>(p_before_work_id is null)
     or length(coalesce(p_query,''))>120 then
    raise exception 'invalid_command';
  end if;
  search_text:=lower(btrim(coalesce(p_query,'')));
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,p_configuration_version_id,'discover-opportunity',p_gate_key);
  if cfg->>'versionId' is distinct from p_configuration_version_id::text
     or cfg->'workType'->'lifecycle_json'->>'initialState' is distinct from 'intake_draft'
     or not exists(select 1 from public.config_gate_definitions g
       join public.config_phase_definitions ph
         on ph.id=g.phase_id and ph.configuration_version_id=g.configuration_version_id
       where g.configuration_version_id=p_configuration_version_id
         and g.gate_key=p_gate_key and ph.phase_key='discover'
         and g.status='active' and ph.status='active') then
    raise exception 'configuration_mismatch';
  end if;
  authority:=rybex_internal.d5o_discover_capture_trial_authority(
    p_workspace_id,p_configuration_version_id);
  -- Only roots created for this one workspace, tenant, configuration and author
  -- enter the query. The pin protects private draft fields on each row.
  with eligible as (
    select w.id,w.record_version,w.title,w.lifecycle_state,
      d.customer_context,d.site_context,d.source_kind,d.need_summary,
      d.value_band,d.currency,d.response_due_on,d.triage_owner_profile_id,
      d.next_action,d.updated_at
    from public.d5o_work_records w
      join public.d5o_discover_capture_drafts d
        on d.work_id=w.id and d.workspace_id=w.workspace_id
          and d.configuration_version_id=w.configuration_version_id
    where w.workspace_id=p_workspace_id
      and w.configuration_tenant_id=(cfg->>'tenantId')::uuid
      and w.configuration_version_id=p_configuration_version_id
      and w.configuration_digest=rybex_internal.d5o_m1_digest(cfg)
      and w.work_type_key='discover-opportunity' and w.gate_key=p_gate_key
      and w.owner_profile_id=(actor->>'profile')::uuid
      and not exists(select 1 from public.d5o_work_sources s where s.work_id=w.id)
      and d.capture_permission_digest=authority->>'permissionDigest'
      and d.employee_verification_id=(authority->>'employeeVerificationId')::uuid
      and (p_before_updated_at is null
        or (d.updated_at,w.id)<(p_before_updated_at,p_before_work_id))
      and (search_text=''
        or strpos(lower(w.title),search_text)>0
        or strpos(lower(coalesce(d.customer_context,'')),search_text)>0
        or strpos(lower(coalesce(d.site_context,'')),search_text)>0)
    order by d.updated_at desc,w.id desc limit 51
  ), page as (
    select * from eligible order by updated_at desc,id desc limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'workId',id,'recordVersion',record_version,'title',title,
      'lifecycleState',lifecycle_state,'customerContext',customer_context,
      'siteContext',site_context,'source',source_kind,
      'needSummary',need_summary,'valueBand',value_band,'currency',currency,
      'responseDueOn',response_due_on,'triageOwnerProfileId',triage_owner_profile_id,
      'nextAction',next_action,'updatedAt',updated_at)
      order by updated_at desc,id desc),'[]'::jsonb)
    into items from page;
  -- Repeat the same bounded query for cursor metadata. No total count is
  -- returned, so a capture-only role learns nothing about other records.
  with eligible as (
    select w.id,d.updated_at from public.d5o_work_records w
      join public.d5o_discover_capture_drafts d
        on d.work_id=w.id and d.workspace_id=w.workspace_id
          and d.configuration_version_id=w.configuration_version_id
    where w.workspace_id=p_workspace_id
      and w.configuration_tenant_id=(cfg->>'tenantId')::uuid
      and w.configuration_version_id=p_configuration_version_id
      and w.configuration_digest=rybex_internal.d5o_m1_digest(cfg)
      and w.work_type_key='discover-opportunity' and w.gate_key=p_gate_key
      and w.owner_profile_id=(actor->>'profile')::uuid
      and not exists(select 1 from public.d5o_work_sources s where s.work_id=w.id)
      and d.capture_permission_digest=authority->>'permissionDigest'
      and d.employee_verification_id=(authority->>'employeeVerificationId')::uuid
      and (p_before_updated_at is null
        or (d.updated_at,w.id)<(p_before_updated_at,p_before_work_id))
      and (search_text=''
        or strpos(lower(w.title),search_text)>0
        or strpos(lower(coalesce(d.customer_context,'')),search_text)>0
        or strpos(lower(coalesce(d.site_context,'')),search_text)>0)
    order by d.updated_at desc,w.id desc limit 51
  )
  select count(*)>50 into more_rows from eligible;
  if more_rows then
    select (entry->>'updatedAt')::timestamptz,(entry->>'workId')::uuid
      into next_updated_at,next_work_id
    from jsonb_array_elements(items) with ordinality as e(entry,ordinality)
    where ordinality=50;
  end if;
  return jsonb_build_object('items',items,'hasMore',more_rows,
    'nextCursor',case when more_rows then jsonb_build_object(
      'updatedAt',next_updated_at,'workId',next_work_id) else null end);
end $$;

revoke all on function public.d5o_list_my_discover_drafts_v1(
  uuid,uuid,text,text,timestamptz,uuid)
  from public, anon, authenticated, service_role;
commit;
