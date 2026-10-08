-- UNAPPLIED synthetic-only distinctness review. Requires Discover capture,
-- identity-link and triage-preflight candidates plus an explicit trial grant.
-- No same_work retirement, triage submission or production policy is included.
begin;

create table public.d5o_trial_duplicate_reviews (
  work_id uuid primary key,
  workspace_id uuid not null,
  configuration_version_id uuid not null,
  disposition text not null check (disposition='distinct'),
  compared_work_ids uuid[] not null default '{}',
  reason text not null check (length(btrim(reason)) between 20 and 1000),
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  permission_digest text not null check (permission_digest ~ '^[0-9a-f]{64}$'),
  reviewed_work_version integer not null check (reviewed_work_version>=2),
  reviewed_at timestamptz not null default now(),
  foreign key (work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key (permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_duplicate_reviews enable row level security;
revoke all on public.d5o_trial_duplicate_reviews from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_duplicate_authority(p_workspace_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; m public.workspace_memberships%rowtype; p public.user_profiles%rowtype;
  w public.workspaces%rowtype; t public.config_tenants%rowtype;
  permission public.config_permission_definitions%rowtype;
  verification public.d5o_trial_employee_verifications%rowtype; rule jsonb;
begin
  lock table public.config_permission_definitions,public.d5o_trial_employee_verifications in share mode;
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into m from public.workspace_memberships where id=(actor->>'membership')::uuid
    and workspace_id=p_workspace_id and user_id=auth.uid() and status='active' for share;
  select * into p from public.user_profiles where id=(actor->>'profile')::uuid
    and user_id=auth.uid() and auth_user_id=auth.uid() and status='active' for share;
  select * into w from public.workspaces where id=p_workspace_id and status='active' for share;
  if m.id is null or p.id is null or w.id is null or w.organization_id is null
    or m.organization_id is distinct from w.organization_id
    or p.organization_id is distinct from w.organization_id
    or m.user_profile_id is distinct from p.id or m.role='read_only_auditor' then
    raise exception 'forbidden'; end if;
  select * into t from public.config_tenants where workspace_id=p_workspace_id and status<>'archived' for share;
  if t.id is null or t.organization_id is distinct from w.organization_id
    or (select count(*) from public.config_tenants where workspace_id=p_workspace_id and status<>'archived')<>1
    or public.config_configuration_version_tenant_id(p_version_id) is distinct from t.id then
    raise exception 'ambiguous_tenant_mapping'; end if;
  select * into verification from public.d5o_trial_employee_verifications
    where user_id=auth.uid() and organization_id=w.organization_id
      and status='verified' and (expires_at is null or expires_at>now()) for share;
  if verification.id is null then raise exception 'employee_verification_required'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_version_id and permission_key='discover.resolve_duplicate'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'duplicate_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or jsonb_array_length(rule->'workspaceRoles')=0
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? m.role) then
    raise exception 'duplicate_permission_denied'; end if;
  return jsonb_build_object('actorUserId',auth.uid(),'actorProfileId',p.id,
    'organizationId',w.organization_id,'tenantId',t.id,'permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_duplicate_authority(uuid,uuid)
  from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_duplicate_candidate_ids(
  p_workspace_id uuid,p_tenant_id uuid,p_work_id uuid,p_account_id uuid,p_customer text,p_title text)
returns uuid[] language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(array_agg(w.id order by w.id),'{}'::uuid[])
  from public.d5o_work_records w join public.d5o_discover_capture_drafts d
    on d.work_id=w.id and d.workspace_id=w.workspace_id
  where w.workspace_id=p_workspace_id and w.configuration_tenant_id=p_tenant_id
    and w.work_type_key='discover-opportunity' and w.id<>p_work_id
    and (d.account_id=p_account_id
      or (nullif(btrim(p_customer),'') is not null
        and lower(btrim(d.customer_context))=lower(btrim(p_customer)))
      or lower(btrim(w.title))=lower(btrim(p_title)));
$$;
revoke all on function rybex_internal.d5o_trial_duplicate_candidate_ids(uuid,uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;

create function public.d5o_list_discover_duplicate_review_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; version_id uuid;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select active_configuration_version_id into version_id from public.config_tenants
    where workspace_id=p_workspace_id and status='active';
  authority:=rybex_internal.d5o_trial_duplicate_authority(p_workspace_id,version_id);
  return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
      'workId',r.id,'title',r.title,'customerContext',r.customer_context,
      'siteContext',r.site_context,'recordVersion',r.record_version,
      'reviewedVersion',r.reviewed_work_version) order by r.updated_at desc,r.id desc)
    from (select w.id,w.title,w.record_version,d.customer_context,d.site_context,
      d.updated_at,rv.reviewed_work_version
      from public.d5o_work_records w join public.d5o_discover_capture_drafts d on d.work_id=w.id
      left join public.d5o_trial_duplicate_reviews rv on rv.work_id=w.id
      where w.workspace_id=p_workspace_id and w.configuration_tenant_id=(authority->>'tenantId')::uuid
        and w.work_type_key='discover-opportunity' and w.lifecycle_state='intake_draft'
        and d.account_id is not null and d.site_id is not null
      order by d.updated_at desc,w.id desc limit 50) r),'[]'::jsonb));
end $$;

create function public.d5o_discover_duplicate_review_context_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  authority jsonb; cfg jsonb; w public.d5o_work_records%rowtype;
  d public.d5o_discover_capture_drafts%rowtype; candidate_ids uuid[]; legacy_hold boolean;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' or w.lifecycle_state<>'intake_draft'
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_trial_duplicate_authority(p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts where work_id=w.id
    and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or d.account_id is null or d.site_id is null then raise exception 'forbidden'; end if;
  candidate_ids:=rybex_internal.d5o_trial_duplicate_candidate_ids(
    p_workspace_id,w.configuration_tenant_id,w.id,d.account_id,d.customer_context,w.title);
  lock table public.opportunities in share mode;
  select exists(select 1 from public.opportunities o where o.workspace_id=p_workspace_id
    and o.organization_id=(authority->>'organizationId')::uuid
    and (lower(btrim(o.gc_client))=lower(btrim(d.customer_context))
      or lower(btrim(o.name))=lower(btrim(w.title)))) into legacy_hold;
  return jsonb_build_object('workId',w.id,'title',w.title,'recordVersion',w.record_version,
    'customerContext',d.customer_context,'siteContext',d.site_context,
    'accountId',d.account_id,'siteId',d.site_id,
    'candidateIds',to_jsonb(candidate_ids),'legacyHold',legacy_hold,
    'tooManyCandidates',coalesce(array_length(candidate_ids,1),0)>20,
    'reviewedVersion',(select rv.reviewed_work_version from public.d5o_trial_duplicate_reviews rv where rv.work_id=w.id),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object('workId',c.id,'title',c.title,
      'customerContext',cd.customer_context,'siteContext',cd.site_context)
      order by c.id) from public.d5o_work_records c
      join public.d5o_discover_capture_drafts cd on cd.work_id=c.id
      where c.id=any(candidate_ids)),'[]'::jsonb));
end $$;

create function public.d5o_review_discover_distinct_v1(
  p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_command_id text,
  p_compared_work_ids uuid[],p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  authority jsonb; cfg jsonb; cached public.command_idempotency%rowtype;
  w public.d5o_work_records%rowtype; d public.d5o_discover_capture_drafts%rowtype;
  candidate_ids uuid[]; legacy_hold boolean; request_hash text;
  old_version integer; events jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  perform rybex_internal.d5o_m1_actor(p_workspace_id);
  if p_expected_version is null or p_expected_version<1
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_compared_work_ids is null or length(btrim(coalesce(p_reason,''))) not between 20 and 1000 then
    raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity'
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_trial_duplicate_authority(p_workspace_id,w.configuration_version_id);
  if w.owner_profile_id=(authority->>'actorProfileId')::uuid or w.created_by=auth.uid() then
    raise exception 'separation_of_duties'; end if;
  select * into d from public.d5o_discover_capture_drafts where work_id=w.id
    and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for update;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then
    raise exception 'pinned_configuration_changed'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('discover.distinct.v1',
    auth.uid(),p_workspace_id,p_work_id,p_expected_version,p_compared_work_ids,p_reason));
  select * into cached from public.command_idempotency where workspace_id=p_workspace_id
    and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.distinct.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_version then raise exception 'concurrency_conflict'; end if;
  if w.lifecycle_state<>'intake_draft' or d.account_id is null or d.site_id is null
    or not exists(select 1 from public.d5o_trial_accounts a join public.d5o_trial_sites s
      on s.id=d.site_id and s.account_id=a.id and s.workspace_id=a.workspace_id
        and s.configuration_tenant_id=a.configuration_tenant_id and s.organization_id=a.organization_id
      where a.id=d.account_id and a.workspace_id=p_workspace_id
        and a.configuration_tenant_id=w.configuration_tenant_id
        and a.organization_id=(authority->>'organizationId')::uuid
        and a.status='trial_active' and s.status='trial_active'
        and a.fixture_manifest_digest is not null
        and s.fixture_manifest_digest=a.fixture_manifest_digest)
    or exists(select 1 from public.d5o_proof_packages p where p.work_id=w.id and p.status<>'draft')
    or exists(select 1 from public.d5o_work_decisions x where x.work_id=w.id) then
    raise exception 'review_not_eligible'; end if;
  candidate_ids:=rybex_internal.d5o_trial_duplicate_candidate_ids(
    p_workspace_id,w.configuration_tenant_id,w.id,d.account_id,d.customer_context,w.title);
  if coalesce(array_length(candidate_ids,1),0)>20 then raise exception 'too_many_candidates'; end if;
  lock table public.opportunities in share mode;
  select exists(select 1 from public.opportunities o where o.workspace_id=p_workspace_id
    and o.organization_id=(authority->>'organizationId')::uuid
    and (lower(btrim(o.gc_client))=lower(btrim(d.customer_context))
      or lower(btrim(o.name))=lower(btrim(w.title)))) into legacy_hold;
  if legacy_hold then raise exception 'legacy_match_requires_source_review'; end if;
  if p_compared_work_ids is distinct from candidate_ids then raise exception 'candidate_set_changed'; end if;
  old_version:=w.record_version;
  update public.d5o_work_records set record_version=record_version+1
    where id=w.id and workspace_id=p_workspace_id returning * into w;
  insert into public.d5o_trial_duplicate_reviews(work_id,workspace_id,configuration_version_id,
    disposition,compared_work_ids,reason,reviewer_user_id,reviewer_profile_id,
    permission_id,permission_digest,reviewed_work_version)
  values(w.id,p_workspace_id,w.configuration_version_id,'distinct',candidate_ids,btrim(p_reason),
    auth.uid(),(authority->>'actorProfileId')::uuid,(authority->>'permissionId')::uuid,
    authority->>'permissionDigest',w.record_version)
  on conflict(work_id) do update set compared_work_ids=excluded.compared_work_ids,
    reason=excluded.reason,reviewer_user_id=excluded.reviewer_user_id,
    reviewer_profile_id=excluded.reviewer_profile_id,permission_id=excluded.permission_id,
    permission_digest=excluded.permission_digest,reviewed_work_version=excluded.reviewed_work_version,
    reviewed_at=now();
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.duplicate_distinct_reviewed',
    auth.uid(),jsonb_build_object('record_version',old_version),
    jsonb_build_object('record_version',w.record_version,'disposition','distinct'),
    jsonb_build_object('configurationDigest',w.configuration_digest,
      'resolutionPermissionDigest',authority->>'permissionDigest',
      'comparedWorkIds',candidate_ids,'reason',btrim(p_reason)));
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'disposition','distinct','events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.distinct.v1','d5o_work_record',w.id,
    request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;

revoke all on function public.d5o_list_discover_duplicate_review_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.d5o_discover_duplicate_review_context_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.d5o_review_discover_distinct_v1(uuid,uuid,integer,text,uuid[],text)
  from public,anon,authenticated,service_role;
commit;
