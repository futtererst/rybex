-- Synthetic-only author-owned CRM collection view. Applied only to the owned
-- scratch database. This does not grant tenant-wide opportunity visibility.
begin;

create or replace function public.d5o_list_my_discover_drafts_v2(
  p_workspace_id uuid,p_configuration_version_id uuid,p_gate_key text,
  p_query text default '',p_state text default 'all',p_sort text default 'newest',
  p_before_updated_at timestamptz default null,p_before_work_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; authority jsonb; cfg jsonb; search_text text;
  items jsonb; more_rows boolean; next_updated_at timestamptz; next_work_id uuid;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  if p_configuration_version_id is null or coalesce(p_gate_key,'')=''
    or (p_before_updated_at is null)<>(p_before_work_id is null)
    or length(coalesce(p_query,''))>120
    or p_state is null or p_state not in ('all','intake_draft','pending_owner_acceptance','triage_assigned','duplicate_closed')
    or p_sort is null or p_sort not in ('newest','oldest') then raise exception 'invalid_command'; end if;
  search_text:=lower(btrim(coalesce(p_query,'')));
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,p_configuration_version_id,'discover-opportunity',p_gate_key);
  if cfg->>'versionId' is distinct from p_configuration_version_id::text
    or cfg->'workType'->'lifecycle_json'->>'initialState' is distinct from 'intake_draft'
    or not exists(select 1 from public.config_gate_definitions g
      join public.config_phase_definitions ph on ph.id=g.phase_id
        and ph.configuration_version_id=g.configuration_version_id
      where g.configuration_version_id=p_configuration_version_id
        and g.gate_key=p_gate_key and ph.phase_key='discover'
        and g.status='active' and ph.status='active') then
    raise exception 'configuration_mismatch'; end if;
  authority:=rybex_internal.d5o_discover_capture_trial_authority(
    p_workspace_id,p_configuration_version_id);
  with eligible as (
    select w.id,w.record_version,w.title,w.lifecycle_state,
      d.customer_context,d.site_context,d.source_kind,d.need_summary,
      d.value_band,d.currency,d.response_due_on,d.triage_owner_profile_id,
      d.next_action,d.updated_at
    from public.d5o_work_records w
      join public.d5o_discover_capture_drafts d on d.work_id=w.id
        and d.workspace_id=w.workspace_id
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
      and (p_state='all' or w.lifecycle_state=p_state)
      and (search_text='' or strpos(lower(w.title),search_text)>0
        or strpos(lower(coalesce(d.customer_context,'')),search_text)>0
        or strpos(lower(coalesce(d.site_context,'')),search_text)>0)
      and (p_before_updated_at is null
        or (p_sort='newest' and (d.updated_at,w.id)<(p_before_updated_at,p_before_work_id))
        or (p_sort='oldest' and (d.updated_at,w.id)>(p_before_updated_at,p_before_work_id)))
    order by
      case when p_sort='newest' then d.updated_at end desc,
      case when p_sort='newest' then w.id end desc,
      case when p_sort='oldest' then d.updated_at end asc,
      case when p_sort='oldest' then w.id end asc
    limit 51
  ), page as (
    select * from eligible order by
      case when p_sort='newest' then updated_at end desc,
      case when p_sort='newest' then id end desc,
      case when p_sort='oldest' then updated_at end asc,
      case when p_sort='oldest' then id end asc
    limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'workId',id,'recordVersion',record_version,'title',title,
    'lifecycleState',lifecycle_state,'customerContext',customer_context,
    'siteContext',site_context,'source',source_kind,'needSummary',need_summary,
    'valueBand',value_band,'currency',currency,'responseDueOn',response_due_on,
    'triageOwnerProfileId',triage_owner_profile_id,'nextAction',next_action,
    'updatedAt',updated_at) order by
      case when p_sort='newest' then updated_at end desc,
      case when p_sort='newest' then id end desc,
      case when p_sort='oldest' then updated_at end asc,
      case when p_sort='oldest' then id end asc),'[]'::jsonb),
    (select count(*)>50 from eligible)
    into items,more_rows from page;
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
revoke all on function public.d5o_list_my_discover_drafts_v2(
  uuid,uuid,text,text,text,text,timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_list_my_discover_drafts_v2(
  uuid,uuid,text,text,text,text,timestamptz,uuid) to authenticated;
commit;
