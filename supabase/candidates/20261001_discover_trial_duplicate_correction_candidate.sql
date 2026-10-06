-- Unpromoted synthetic-only candidate, applied to the owned scratch database.
-- Requires the Discover duplicate, registry,
-- same-work lifecycle, triage transfer and M1 audit foundations. Never place in
-- normal migrations or apply to production under the bounded trial instruction.
begin;

create table public.d5o_trial_duplicate_correction_grants (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  permission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null check (status in ('active','revoked')),
  granted_at timestamptz not null default now(),
  primary key (workspace_id,configuration_version_id,user_id),
  foreign key (permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_duplicate_correction_grants enable row level security;
revoke all on public.d5o_trial_duplicate_correction_grants from public,anon,authenticated,service_role;

create table public.d5o_trial_duplicate_corrections (
  duplicate_work_id uuid primary key,
  retained_work_id uuid not null,
  workspace_id uuid not null,
  configuration_version_id uuid not null,
  prior_reviewed_version integer not null,
  prior_reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  prior_reason_digest text not null check (prior_reason_digest ~ '^[0-9a-f]{64}$'),
  candidate_work_ids uuid[] not null,
  reason text not null check (length(btrim(reason)) between 20 and 1000),
  corrector_user_id uuid not null references auth.users(id) on delete restrict,
  corrector_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  permission_id uuid not null,
  permission_digest text not null check (permission_digest ~ '^[0-9a-f]{64}$'),
  duplicate_before_version integer not null,
  duplicate_after_version integer not null,
  retained_version integer not null,
  audit_event_id uuid not null references public.audit_events(id) on delete restrict,
  domain_event_id uuid not null references public.domain_events(id) on delete restrict,
  corrected_at timestamptz not null default now(),
  check (duplicate_work_id<>retained_work_id),
  check (corrector_user_id<>prior_reviewer_user_id),
  foreign key (duplicate_work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key (retained_work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key (permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_duplicate_corrections enable row level security;
revoke all on public.d5o_trial_duplicate_corrections from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_duplicate_correction_authority(p_workspace_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; m public.workspace_memberships%rowtype; p public.user_profiles%rowtype;
  w public.workspaces%rowtype; t public.config_tenants%rowtype;
  permission public.config_permission_definitions%rowtype;
  verification public.d5o_trial_employee_verifications%rowtype;
  grant_row public.d5o_trial_duplicate_correction_grants%rowtype; rule jsonb;
begin
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
    where configuration_version_id=p_version_id and permission_key='discover.correct_duplicate'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'correction_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? m.role) then
    raise exception 'correction_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_duplicate_correction_grants
    where workspace_id=p_workspace_id and configuration_version_id=p_version_id
      and permission_id=permission.id and user_id=auth.uid() and profile_id=p.id
      and status='active' for share;
  if grant_row.user_id is null then raise exception 'correction_permission_denied'; end if;
  return jsonb_build_object('actorUserId',auth.uid(),'actorProfileId',p.id,
    'organizationId',w.organization_id,'tenantId',t.id,'permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_duplicate_correction_authority(uuid,uuid)
  from public,anon,authenticated,service_role;

create function public.d5o_discover_duplicate_correction_context_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  authority jsonb; cfg jsonb; w public.d5o_work_records%rowtype;
  d public.d5o_discover_capture_drafts%rowtype;
  prior public.d5o_trial_duplicate_reviews%rowtype; candidate_ids uuid[];
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' or w.lifecycle_state<>'intake_draft'
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_trial_duplicate_correction_authority(p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or w.created_by=auth.uid() or w.owner_profile_id=(authority->>'actorProfileId')::uuid then
    raise exception 'forbidden'; end if;
  select * into prior from public.d5o_trial_duplicate_reviews where work_id=w.id for share;
  if prior.work_id is null or prior.reviewer_user_id=auth.uid() then raise exception 'separation_of_duties'; end if;
  select * into d from public.d5o_discover_capture_drafts where work_id=w.id
    and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null or d.account_id is null or d.site_id is null then raise exception 'forbidden'; end if;
  candidate_ids:=rybex_internal.d5o_trial_duplicate_candidate_ids(
    p_workspace_id,w.configuration_tenant_id,w.id,d.account_id,d.customer_context,w.title);
  return jsonb_build_object('workId',w.id,'title',w.title,'recordVersion',w.record_version,
    'customerContext',d.customer_context,'siteContext',d.site_context,
    'needSummary',d.need_summary,'accountId',d.account_id,'siteId',d.site_id,
    'priorReviewedVersion',prior.reviewed_work_version,'priorReason',prior.reason,
    'returnedSubmissionCount',(select count(*) from public.d5o_trial_triage_submissions s
      join public.d5o_trial_triage_responses r on r.submission_id=s.id and r.disposition='returned'
      where s.work_id=w.id),
    'candidateIds',to_jsonb(candidate_ids),
    'tooManyCandidates',coalesce(array_length(candidate_ids,1),0)>20,
    'candidates',coalesce((select jsonb_agg(jsonb_build_object(
      'workId',c.id,'recordVersion',c.record_version,'title',c.title,
      'customerContext',cd.customer_context,'siteContext',cd.site_context,
      'needSummary',cd.need_summary,'accountId',cd.account_id,'siteId',cd.site_id,
      'lifecycleState',c.lifecycle_state,'eligibleRetained',
        c.lifecycle_state='intake_draft' and cd.account_id=d.account_id and cd.site_id=d.site_id)
      order by c.id) from public.d5o_work_records c
      join public.d5o_discover_capture_drafts cd on cd.work_id=c.id
      where c.id=any(candidate_ids)),'[]'::jsonb));
end $$;
revoke all on function public.d5o_discover_duplicate_correction_context_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_discover_duplicate_correction_context_v1(uuid,uuid) to authenticated;

commit;
