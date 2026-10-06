-- UNAPPLIED synthetic trial candidate. Depends on Discover capture, identity link,
-- duplicate-review authority and distinct-review candidates. No production rollout.
begin;

create table public.d5o_trial_duplicate_lifecycle_policies (
  id uuid primary key,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  policy_version integer not null check (policy_version > 0),
  closed_state text not null check (closed_state = 'duplicate_closed'),
  rule_json jsonb not null check (jsonb_typeof(rule_json) = 'object'),
  rule_digest text not null check (rule_digest ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('trial_active','retired')),
  unique (configuration_version_id,policy_version)
);
create unique index d5o_trial_one_active_duplicate_lifecycle
  on public.d5o_trial_duplicate_lifecycle_policies(configuration_version_id)
  where status='trial_active';
alter table public.d5o_trial_duplicate_lifecycle_policies enable row level security;
revoke all on public.d5o_trial_duplicate_lifecycle_policies from public,anon,authenticated,service_role;

create table public.d5o_trial_same_work_closures (
  duplicate_work_id uuid primary key,
  retained_work_id uuid not null,
  workspace_id uuid not null,
  configuration_version_id uuid not null,
  policy_id uuid not null references public.d5o_trial_duplicate_lifecycle_policies(id) on delete restrict,
  policy_digest text not null check (policy_digest ~ '^[0-9a-f]{64}$'),
  candidate_work_ids uuid[] not null,
  reason text not null check (length(btrim(reason)) between 20 and 1000),
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  permission_digest text not null check (permission_digest ~ '^[0-9a-f]{64}$'),
  duplicate_before_version integer not null,
  duplicate_after_version integer not null,
  retained_version integer not null,
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id),
  closed_at timestamptz not null default now(),
  check (duplicate_work_id <> retained_work_id),
  foreign key (duplicate_work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key (retained_work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key (permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_same_work_closures enable row level security;
revoke all on public.d5o_trial_same_work_closures from public,anon,authenticated,service_role;

-- Generic M1 commands always update the root. Deny every post-closure update,
-- including a cached command's non-replay path; historical reads still work.
create function rybex_internal.d5o_trial_closed_root_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.lifecycle_state='duplicate_closed' then raise exception 'duplicate_closed'; end if;
  if new.lifecycle_state='duplicate_closed' and
    (new.record_version<>old.record_version+1 or new.work_type_key<>'discover-opportunity'
      or not exists (select 1 from public.d5o_trial_duplicate_lifecycle_policies p
        where p.configuration_version_id=new.configuration_version_id
          and p.closed_state='duplicate_closed' and p.status='trial_active')) then
    raise exception 'invalid_duplicate_closure';
  end if;
  return new;
end $$;
create trigger d5o_trial_closed_root_guard before update on public.d5o_work_records
for each row execute function rybex_internal.d5o_trial_closed_root_guard();

-- The generic relation path can mutate only the other root. Also forbid
-- attaching new relations to a closed duplicate from an active Work record.
create function rybex_internal.d5o_trial_closed_relation_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_work_records w
      where w.id in (new.work_id,new.related_work_id) and w.lifecycle_state='duplicate_closed') then
    raise exception 'duplicate_closed';
  end if;
  return new;
end $$;
create trigger d5o_trial_closed_relation_guard before insert or update on public.d5o_work_relations
for each row execute function rybex_internal.d5o_trial_closed_relation_guard();

create or replace function rybex_internal.d5o_trial_duplicate_candidate_ids(
  p_workspace_id uuid,p_tenant_id uuid,p_work_id uuid,p_account_id uuid,p_customer text,p_title text)
returns uuid[] language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(array_agg(w.id order by w.id),'{}'::uuid[])
  from public.d5o_work_records w join public.d5o_discover_capture_drafts d
    on d.work_id=w.id and d.workspace_id=w.workspace_id
  where w.workspace_id=p_workspace_id and w.configuration_tenant_id=p_tenant_id
    and w.work_type_key='discover-opportunity' and w.lifecycle_state<>'duplicate_closed'
    and w.id<>p_work_id and (d.account_id=p_account_id
      or (nullif(btrim(p_customer),'') is not null
        and lower(btrim(d.customer_context))=lower(btrim(p_customer)))
      or lower(btrim(w.title))=lower(btrim(p_title)));
$$;

create function public.d5o_review_discover_same_work_v1(
  p_workspace_id uuid,p_duplicate_work_id uuid,p_retained_work_id uuid,
  p_expected_duplicate_version integer,p_expected_retained_version integer,
  p_command_id text,p_candidate_work_ids uuid[],p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  duplicate_row public.d5o_work_records%rowtype;
  retained_row public.d5o_work_records%rowtype;
  draft public.d5o_discover_capture_drafts%rowtype;
  authority jsonb; cfg jsonb; policy public.d5o_trial_duplicate_lifecycle_policies%rowtype;
  candidate_ids uuid[]; legacy_hold boolean; cached public.command_idempotency%rowtype;
  request_hash text; before_row jsonb; events jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_duplicate_work_id is null or p_retained_work_id is null
    or p_duplicate_work_id=p_retained_work_id
    or p_expected_duplicate_version is null or p_expected_retained_version is null
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_candidate_work_ids is null or length(btrim(coalesce(p_reason,''))) not between 20 and 1000 then
    raise exception 'invalid_command'; end if;
  select * into duplicate_row from public.d5o_work_records
    where id=p_duplicate_work_id and workspace_id=p_workspace_id for update;
  if duplicate_row.id is null or duplicate_row.work_type_key<>'discover-opportunity'
    or exists(select 1 from public.d5o_work_sources s where s.work_id=duplicate_row.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,duplicate_row.configuration_version_id,
    duplicate_row.work_type_key,duplicate_row.gate_key);
  if duplicate_row.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or duplicate_row.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then
    raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_duplicate_authority(p_workspace_id,
    duplicate_row.configuration_version_id);
  if duplicate_row.owner_profile_id=(authority->>'actorProfileId')::uuid
    or duplicate_row.created_by=auth.uid() then raise exception 'separation_of_duties'; end if;
  select * into policy from public.d5o_trial_duplicate_lifecycle_policies
    where configuration_version_id=duplicate_row.configuration_version_id and status='trial_active'
      and closed_state='duplicate_closed' for share;
  if policy.id is null or policy.rule_digest<>rybex_internal.d5o_m1_digest(policy.rule_json)
    or policy.rule_json<>jsonb_build_object('disposition','same_work','activeState','intake_draft',
      'closedState','duplicate_closed','historicalRead',true,'allowMutation',false) then
    raise exception 'lifecycle_policy_unavailable'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('discover.same_work.v1',
    auth.uid(),p_workspace_id,p_duplicate_work_id,p_retained_work_id,
    p_expected_duplicate_version,p_expected_retained_version,p_candidate_work_ids,p_reason));
  select * into cached from public.command_idempotency where workspace_id=p_workspace_id
    and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>duplicate_row.id or cached.command_type<>'d5o.discover.same_work.v1'
      then raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into retained_row from public.d5o_work_records
    where id=p_retained_work_id and workspace_id=p_workspace_id for update;
  select * into draft from public.d5o_discover_capture_drafts
    where work_id=duplicate_row.id and workspace_id=p_workspace_id
      and configuration_version_id=duplicate_row.configuration_version_id for update;
  if retained_row.id is null or draft.work_id is null
    or retained_row.owner_profile_id=(authority->>'actorProfileId')::uuid
    or retained_row.created_by=auth.uid()
    or retained_row.configuration_tenant_id<>duplicate_row.configuration_tenant_id
    or retained_row.configuration_version_id<>duplicate_row.configuration_version_id
    or retained_row.configuration_digest<>duplicate_row.configuration_digest
    or retained_row.work_type_key<>duplicate_row.work_type_key
    or retained_row.gate_key<>duplicate_row.gate_key
    or duplicate_row.lifecycle_state<>'intake_draft'
    or retained_row.lifecycle_state<>'intake_draft'
    or exists(select 1 from public.d5o_trial_same_work_closures c
      where c.duplicate_work_id in (duplicate_row.id,retained_row.id))
    or exists(select 1 from public.d5o_trial_same_work_closures c
      where c.retained_work_id=duplicate_row.id)
    or exists(select 1 from public.d5o_trial_duplicate_reviews rv
      where rv.work_id=duplicate_row.id)
    or exists(select 1 from public.d5o_work_sources s where s.work_id=retained_row.id)
    or draft.account_id is null or draft.site_id is null
    or not exists(select 1 from public.d5o_trial_accounts a
      join public.d5o_trial_sites s on s.id=draft.site_id and s.account_id=a.id
        and s.workspace_id=a.workspace_id and s.configuration_tenant_id=a.configuration_tenant_id
        and s.organization_id=a.organization_id
      where a.id=draft.account_id and a.workspace_id=p_workspace_id
        and a.configuration_tenant_id=duplicate_row.configuration_tenant_id
        and a.organization_id=(authority->>'organizationId')::uuid
        and a.status='trial_active' and s.status='trial_active'
        and a.fixture_manifest_digest is not null
        and s.fixture_manifest_digest=a.fixture_manifest_digest)
    or not exists(select 1 from public.d5o_discover_capture_drafts d
      where d.work_id=retained_row.id and d.workspace_id=p_workspace_id
        and d.account_id=draft.account_id and d.site_id=draft.site_id)
    or exists(select 1 from public.d5o_proof_packages p
      where p.work_id in (duplicate_row.id,retained_row.id))
    or exists(select 1 from public.d5o_work_decisions x
      where x.work_id in (duplicate_row.id,retained_row.id))
    or exists(select 1 from public.d5o_work_commitments x
      where x.work_id=duplicate_row.id)
    or exists(select 1 from public.d5o_work_relations x
      where x.work_id=duplicate_row.id or x.related_work_id=duplicate_row.id)
    or exists(select 1 from public.d5o_work_facts x where x.work_id=duplicate_row.id)
    or exists(select 1 from public.d5o_work_outcomes x where x.work_id=duplicate_row.id)
    then raise exception 'review_not_eligible'; end if;
  if duplicate_row.record_version<>p_expected_duplicate_version
    or retained_row.record_version<>p_expected_retained_version then
    raise exception 'concurrency_conflict'; end if;
  candidate_ids:=rybex_internal.d5o_trial_duplicate_candidate_ids(p_workspace_id,
    duplicate_row.configuration_tenant_id,duplicate_row.id,draft.account_id,
    draft.customer_context,duplicate_row.title);
  if coalesce(array_length(candidate_ids,1),0)>20 then raise exception 'too_many_candidates'; end if;
  if candidate_ids is distinct from p_candidate_work_ids
    or not (p_retained_work_id=any(candidate_ids)) then raise exception 'candidate_set_changed'; end if;
  lock table public.opportunities in share mode;
  select exists(select 1 from public.opportunities o where o.workspace_id=p_workspace_id
    and o.organization_id=(authority->>'organizationId')::uuid
    and (lower(btrim(o.gc_client))=lower(btrim(draft.customer_context))
      or lower(btrim(o.name))=lower(btrim(duplicate_row.title)))) into legacy_hold;
  if legacy_hold then raise exception 'legacy_match_requires_source_review'; end if;
  before_row:=to_jsonb(duplicate_row);
  update public.d5o_work_records set lifecycle_state='duplicate_closed',
    record_version=record_version+1 where id=duplicate_row.id returning * into duplicate_row;
  events:=rybex_internal.d5o_m1_emit(duplicate_row.id,p_command_id,
    'discover.duplicate_closed',auth.uid(),before_row,to_jsonb(duplicate_row),
    jsonb_build_object('retainedWorkId',retained_row.id,'retainedVersion',retained_row.record_version,
      'candidateWorkIds',candidate_ids,'reason',btrim(p_reason),
      'policyId',policy.id,'policyDigest',policy.rule_digest,
      'resolutionPermissionDigest',authority->>'permissionDigest'));
  insert into public.d5o_trial_same_work_closures(duplicate_work_id,retained_work_id,
    workspace_id,configuration_version_id,policy_id,policy_digest,candidate_work_ids,
    reason,reviewer_user_id,reviewer_profile_id,permission_id,permission_digest,
    duplicate_before_version,duplicate_after_version,retained_version,audit_event_id,domain_event_id)
  values(duplicate_row.id,retained_row.id,p_workspace_id,duplicate_row.configuration_version_id,
    policy.id,policy.rule_digest,candidate_ids,btrim(p_reason),auth.uid(),
    (authority->>'actorProfileId')::uuid,(authority->>'permissionId')::uuid,
    authority->>'permissionDigest',p_expected_duplicate_version,duplicate_row.record_version,
    retained_row.record_version,(events->>'audit')::uuid,(events->>'event')::uuid);
  result:=jsonb_build_object('success',true,'disposition','same_work',
    'workId',duplicate_row.id,'retainedWorkId',retained_row.id,
    'recordVersion',duplicate_row.record_version,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.same_work.v1','d5o_work_record',
    duplicate_row.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_review_discover_same_work_v1(
  uuid,uuid,uuid,integer,integer,text,uuid[],text) from public,anon,authenticated,service_role;
commit;
