-- Unapplied T1 candidate. A draft is attached to the canonical Work ID.
-- Customer/site text is provisional context, never a scoped identity or approval.
begin;

create table public.d5o_discover_drafts (
  work_id uuid primary key,
  workspace_id uuid not null,
  customer_context text,
  site_context text,
  need_summary text,
  source_description text,
  due_on date,
  known_risk text,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key (work_id, workspace_id)
    references public.d5o_work_records(id, workspace_id),
  check (customer_context is null or length(customer_context) <= 240),
  check (site_context is null or length(site_context) <= 240),
  check (need_summary is null or length(need_summary) <= 4000),
  check (source_description is null or length(source_description) <= 1000),
  check (known_risk is null or length(known_risk) <= 2000)
);
create index d5o_discover_drafts_workspace_idx
  on public.d5o_discover_drafts(workspace_id, work_id);
alter table public.d5o_discover_drafts enable row level security;
revoke all on public.d5o_discover_drafts from public, anon, authenticated;
grant all on public.d5o_discover_drafts to service_role;

create function public.d5o_save_discover_draft_v1(
  p_workspace_id uuid, p_work_id uuid, p_expected_version integer,
  p_command_id text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb;
  w d5o_work_records%rowtype;
  cfg jsonb;
  cached command_idempotency%rowtype;
  request_hash text;
  old_version integer;
  new_draft jsonb;
  events jsonb;
  result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor := rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'forbidden'; end if;
  if actor->>'workspace_role'='read_only_auditor'
     or w.owner_profile_id<>(actor->>'profile')::uuid then
    raise exception 'wrong_authority';
  end if;
  if w.work_type_key<>'discover-opportunity'
     or exists(select 1 from d5o_work_sources where work_id=w.id)
     or length(coalesce(p_command_id,'')) not between 8 and 200
     or jsonb_typeof(p_payload) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in
       ('customerContext','siteContext','needSummary','sourceDescription','dueOn','knownRisk'))
     or exists(select 1 from jsonb_each(p_payload) x
       where x.key<>'dueOn' and jsonb_typeof(x.value) not in ('string','null'))
     or (p_payload ? 'dueOn' and jsonb_typeof(p_payload->'dueOn') not in ('string','null'))
     or length(coalesce(p_payload->>'customerContext',''))>240
     or length(coalesce(p_payload->>'siteContext',''))>240
     or length(coalesce(p_payload->>'needSummary',''))>4000
     or length(coalesce(p_payload->>'sourceDescription',''))>1000
     or length(coalesce(p_payload->>'knownRisk',''))>2000 then
    raise exception 'invalid_command';
  end if;
  cfg := rybex_internal.d5o_m1_configuration(
    p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if cfg->>'tenantId' is distinct from w.configuration_tenant_id::text
     or rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then
    raise exception 'pinned_configuration_changed';
  end if;
  request_hash := rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.save.v1',auth.uid(),p_workspace_id,p_work_id,p_expected_version,p_payload));
  select * into cached from command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash then
      raise exception 'idempotency_mismatch';
    end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if p_expected_version is null or w.record_version<>p_expected_version then
    raise exception 'concurrency_conflict';
  end if;
  if w.lifecycle_state is distinct from cfg->'workType'->'lifecycle_json'->>'initialState'
     or exists(select 1 from d5o_proof_packages where work_id=w.id and status<>'draft')
     or exists(select 1 from d5o_work_decisions where work_id=w.id) then
    raise exception 'draft_not_editable';
  end if;
  old_version := w.record_version;
  insert into d5o_discover_drafts (
    work_id,workspace_id,customer_context,site_context,need_summary,
    source_description,due_on,known_risk,updated_by)
  values (
    w.id,p_workspace_id,nullif(trim(p_payload->>'customerContext'),''),
    nullif(trim(p_payload->>'siteContext'),''),
    nullif(trim(p_payload->>'needSummary'),''),
    nullif(trim(p_payload->>'sourceDescription'),''),
    nullif(p_payload->>'dueOn','')::date,
    nullif(trim(p_payload->>'knownRisk'),''),auth.uid())
  on conflict (work_id) do update set
    customer_context=excluded.customer_context,site_context=excluded.site_context,
    need_summary=excluded.need_summary,source_description=excluded.source_description,
    due_on=excluded.due_on,known_risk=excluded.known_risk,
    updated_by=excluded.updated_by,updated_at=now()
  where d5o_discover_drafts.workspace_id=excluded.workspace_id
  returning to_jsonb(d5o_discover_drafts) into new_draft;
  if new_draft is null then raise exception 'cross_workspace'; end if;
  update d5o_work_records set record_version=record_version+1
    where id=w.id returning * into w;
  events := rybex_internal.d5o_m1_emit(
    w.id,p_command_id,'discover.draft_saved',auth.uid(),
    jsonb_build_object('lifecycle_state',w.lifecycle_state,'record_version',old_version),
    jsonb_build_object('lifecycle_state',w.lifecycle_state,'record_version',w.record_version),
    jsonb_build_object('configurationDigest',w.configuration_digest,
      'draftMutation',true));
  result := jsonb_build_object('success',true,'workId',w.id,
    'recordVersion',w.record_version,'draft',new_draft,'events',events);
  insert into command_idempotency(
    workspace_id,command_id,command_type,entity_type,entity_id,
    request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.save.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;

create function public.d5o_load_discover_draft_v1(
  p_workspace_id uuid,p_work_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; w d5o_work_records%rowtype; cfg jsonb; d jsonb;
begin
  actor := rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id;
  if not found or w.work_type_key<>'discover-opportunity'
     or exists(select 1 from d5o_work_sources where work_id=w.id)
     or actor->>'workspace_role'='read_only_auditor'
     or w.owner_profile_id<>(actor->>'profile')::uuid then
    raise exception 'forbidden';
  end if;
  cfg := rybex_internal.d5o_m1_configuration(
    p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if cfg->>'tenantId' is distinct from w.configuration_tenant_id::text
     or rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then
    raise exception 'pinned_configuration_changed';
  end if;
  select to_jsonb(x) into d from d5o_discover_drafts x
    where x.work_id=w.id and x.workspace_id=p_workspace_id;
  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'draft',d,'editable',w.lifecycle_state=cfg->'workType'->'lifecycle_json'->>'initialState'
    and not exists(select 1 from d5o_proof_packages where work_id=w.id and status<>'draft')
    and not exists(select 1 from d5o_work_decisions where work_id=w.id));
end $$;

revoke all on function public.d5o_save_discover_draft_v1(uuid,uuid,integer,text,jsonb),
  public.d5o_load_discover_draft_v1(uuid,uuid) from public,anon,service_role;
grant execute on function public.d5o_save_discover_draft_v1(uuid,uuid,integer,text,jsonb),
  public.d5o_load_discover_draft_v1(uuid,uuid) to authenticated;
commit;
