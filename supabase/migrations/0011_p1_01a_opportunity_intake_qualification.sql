-- P1-01A - Opportunity Intake and Qualification
-- Implements intake, ownership, qualification, and submit-for-decision only.
-- Does not implement go/no-go decision, pursuit outcome, award, project conversion, or work package creation.

alter table workspace_memberships drop constraint if exists workspace_memberships_role_check;
alter table workspace_memberships add constraint workspace_memberships_role_check
  check (role in (
    'executive',
    'operations_leader',
    'business_development_lead',
    'project_manager',
    'billing_commercial_lead',
    'field_supervisor',
    'closeout_lead',
    'admin',
    'read_only_auditor'
  ));

alter table opportunities
  add column if not exists stable_opportunity_key text,
  add column if not exists customer_gc text,
  add column if not exists opportunity_location text,
  add column if not exists anticipated_start date,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists lifecycle_status text not null default 'draft',
  add column if not exists intake_complete boolean not null default false,
  add column if not exists qualification_complete boolean not null default false,
  add column if not exists decision_readiness_status text not null default 'not_ready',
  add column if not exists version integer not null default 1,
  add column if not exists duplicate_fingerprint text,
  add column if not exists duplicate_confirmed boolean not null default false,
  add column if not exists submitted_for_decision_at timestamptz,
  add column if not exists submitted_for_decision_by uuid references auth.users(id) on delete set null;

update opportunities
set stable_opportunity_key = coalesce(stable_opportunity_key, 'opp-' || substr(id::text, 1, 8)),
    customer_gc = coalesce(customer_gc, gc_client),
    opportunity_location = coalesce(opportunity_location, project_location),
    lifecycle_status = case
      when lifecycle_status in ('draft','qualifying','decision_required') then lifecycle_status
      when status in ('awaiting_go_no_go','approved_to_bid','estimating','submitted','won') then 'decision_required'
      when status in ('new_intake','under_review') then 'qualifying'
      else 'draft'
    end,
    intake_complete = coalesce(intake_complete, false),
    qualification_complete = coalesce(qualification_complete, false),
    decision_readiness_status = coalesce(decision_readiness_status, 'not_ready')
where stable_opportunity_key is null
   or customer_gc is null
   or opportunity_location is null;

alter table opportunities alter column stable_opportunity_key set not null;
alter table opportunities add constraint opportunities_stable_key_unique unique (workspace_id, stable_opportunity_key);
alter table opportunities drop constraint if exists opportunities_p1_01a_lifecycle_status_check;
alter table opportunities add constraint opportunities_p1_01a_lifecycle_status_check
  check (lifecycle_status in ('draft','qualifying','decision_required'));
alter table opportunities drop constraint if exists opportunities_p1_01a_decision_readiness_status_check;
alter table opportunities add constraint opportunities_p1_01a_decision_readiness_status_check
  check (decision_readiness_status in ('not_ready','ready_for_decision'));
alter table opportunities drop constraint if exists opportunities_p1_01a_version_check;
alter table opportunities add constraint opportunities_p1_01a_version_check check (version > 0);

create table if not exists opportunity_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_type text not null,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_assignments_type_check check (assignment_type in ('owner','contributor','estimator')),
  constraint opportunity_assignments_status_check check (status in ('active','suspended','archived'))
);

create unique index if not exists opportunity_assignments_one_active_owner
  on opportunity_assignments(opportunity_id)
  where assignment_type = 'owner' and status = 'active';

create unique index if not exists opportunity_assignments_active_user_type
  on opportunity_assignments(opportunity_id, user_id, assignment_type)
  where status = 'active';

create index if not exists opportunity_assignments_workspace_user_idx on opportunity_assignments(workspace_id, user_id, status);
create index if not exists opportunity_assignments_opportunity_idx on opportunity_assignments(workspace_id, opportunity_id, status);

create table if not exists opportunity_qualifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  status text not null default 'in_progress',
  strategic_fit text not null default 'unknown',
  customer_relationship text not null default 'unknown',
  geography_fit text not null default 'unknown',
  project_type_fit text not null default 'unknown',
  scope_clarity text not null default 'unknown',
  design_maturity text not null default 'unknown',
  commercial_terms_risk text not null default 'unknown',
  schedule_feasibility text not null default 'unknown',
  crew_capacity_fit text not null default 'unknown',
  material_lead_time_risk text not null default 'unknown',
  permits_access_risk text not null default 'unknown',
  safety_quality_complexity text not null default 'unknown',
  subcontractor_dependency text not null default 'unknown',
  cash_flow_risk text not null default 'unknown',
  margin_confidence text not null default 'unknown',
  contractual_risk text not null default 'unknown',
  risk_summary text not null default '',
  assumptions text not null default '',
  recommendation text not null default 'hold_for_clarification',
  completeness_result text not null default 'incomplete',
  version integer not null default 1,
  prepared_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint opportunity_qualifications_status_check check (status in ('in_progress','complete')),
  constraint opportunity_qualifications_recommendation_check check (recommendation in ('pursue','pursue_with_mitigations','hold_for_clarification','decline','no_bid')),
  constraint opportunity_qualifications_completeness_check check (completeness_result in ('incomplete','complete')),
  constraint opportunity_qualifications_version_check check (version > 0),
  unique (opportunity_id)
);

create index if not exists opportunities_p1_queue_idx on opportunities(workspace_id, lifecycle_status, bid_due_date);
create index if not exists opportunities_p1_owner_queue_idx on opportunities(workspace_id, owner_user_id, lifecycle_status);
create index if not exists opportunities_p1_duplicate_idx on opportunities(workspace_id, duplicate_fingerprint);
create index if not exists opportunity_qualifications_opportunity_idx on opportunity_qualifications(workspace_id, opportunity_id);

create trigger set_opportunity_assignments_updated_at
before update on opportunity_assignments
for each row execute function set_updated_at();

create trigger set_opportunity_qualifications_updated_at
before update on opportunity_qualifications
for each row execute function set_updated_at();

create or replace function public.p1_01a_current_workspace_id()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  profile_workspace uuid;
  membership_workspace uuid;
begin
  if actor is null then
    return null;
  end if;

  select active_workspace_id
  into profile_workspace
  from user_profiles
  where user_id = actor
    and coalesce(status, 'active') = 'active';

  if profile_workspace is not null and public.is_active_workspace_member(profile_workspace) then
    return profile_workspace;
  end if;

  select wm.workspace_id
  into membership_workspace
  from workspace_memberships wm
  where wm.user_id = actor
    and wm.status = 'active'
  limit 1;

  return membership_workspace;
end;
$$;

create or replace function public.p1_01a_can_access_opportunity(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunities o
    where o.id = opportunity_uuid
      and public.is_active_workspace_member(o.workspace_id)
      and (
        public.has_workspace_role(o.workspace_id, array['business_development_lead','executive','operations_leader','admin','read_only_auditor'])
        or exists (
          select 1
          from opportunity_assignments oa
          where oa.opportunity_id = o.id
            and oa.workspace_id = o.workspace_id
            and oa.user_id = auth.uid()
            and oa.status = 'active'
        )
      )
  );
$$;

create or replace function public.p1_01a_can_mutate_opportunity(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunities o
    where o.id = opportunity_uuid
      and public.is_active_workspace_member(o.workspace_id)
      and o.lifecycle_status <> 'decision_required'
      and (
        public.has_workspace_role(o.workspace_id, array['business_development_lead','operations_leader','admin'])
        or exists (
          select 1
          from opportunity_assignments oa
          where oa.opportunity_id = o.id
            and oa.workspace_id = o.workspace_id
            and oa.user_id = auth.uid()
            and oa.status = 'active'
            and oa.assignment_type in ('owner','contributor','estimator')
        )
      )
  );
$$;

create or replace function public.p1_01a_can_manage_opportunity_assignments(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunities o
    where o.id = opportunity_uuid
      and public.is_active_workspace_member(o.workspace_id)
      and (
        public.has_workspace_role(o.workspace_id, array['business_development_lead','operations_leader','admin'])
        or exists (
          select 1
          from opportunity_assignments oa
          where oa.opportunity_id = o.id
            and oa.workspace_id = o.workspace_id
            and oa.user_id = auth.uid()
            and oa.status = 'active'
            and oa.assignment_type = 'owner'
        )
      )
  );
$$;

create or replace function public.p1_01a_duplicate_fingerprint(p_customer_gc text, p_name text, p_location text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(coalesce(p_customer_gc, '') || '|' || coalesce(p_name, '') || '|' || coalesce(p_location, ''), '[^a-zA-Z0-9|]+', '', 'g'));
$$;

create or replace function public.p1_01a_qualification_complete(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(p_payload->>'strategicFit', '') <> ''
     and coalesce(p_payload->>'customerRelationship', '') <> ''
     and coalesce(p_payload->>'geographyFit', '') <> ''
     and coalesce(p_payload->>'projectTypeFit', '') <> ''
     and coalesce(p_payload->>'scopeClarity', '') <> ''
     and coalesce(p_payload->>'designMaturity', '') <> ''
     and coalesce(p_payload->>'commercialTermsRisk', '') <> ''
     and coalesce(p_payload->>'scheduleFeasibility', '') <> ''
     and coalesce(p_payload->>'crewCapacityFit', '') <> ''
     and coalesce(p_payload->>'materialLeadTimeRisk', '') <> ''
     and coalesce(p_payload->>'permitsAccessRisk', '') <> ''
     and coalesce(p_payload->>'safetyQualityComplexity', '') <> ''
     and coalesce(p_payload->>'subcontractorDependency', '') <> ''
     and coalesce(p_payload->>'cashFlowRisk', '') <> ''
     and coalesce(p_payload->>'marginConfidence', '') <> ''
     and coalesce(p_payload->>'contractualRisk', '') <> ''
     and length(trim(coalesce(p_payload->>'riskSummary', ''))) >= 12;
$$;

alter table opportunities enable row level security;
alter table opportunity_assignments enable row level security;
alter table opportunity_qualifications enable row level security;

grant select on opportunities, opportunity_assignments, opportunity_qualifications to authenticated, service_role;
grant insert, update, delete on opportunities, opportunity_assignments, opportunity_qualifications to service_role;

drop policy if exists opportunities_p1_select_authorized on opportunities;
create policy opportunities_p1_select_authorized
  on opportunities
  for select
  to authenticated
  using (public.p1_01a_can_access_opportunity(id));

drop policy if exists opportunities_p1_no_direct_insert on opportunities;
create policy opportunities_p1_no_direct_insert
  on opportunities
  for insert
  to authenticated
  with check (false);

drop policy if exists opportunities_p1_no_direct_update on opportunities;
create policy opportunities_p1_no_direct_update
  on opportunities
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists opportunity_assignments_p1_select_authorized on opportunity_assignments;
create policy opportunity_assignments_p1_select_authorized
  on opportunity_assignments
  for select
  to authenticated
  using (public.p1_01a_can_access_opportunity(opportunity_id));

drop policy if exists opportunity_assignments_p1_no_direct_insert on opportunity_assignments;
create policy opportunity_assignments_p1_no_direct_insert
  on opportunity_assignments
  for insert
  to authenticated
  with check (false);

drop policy if exists opportunity_assignments_p1_no_direct_update on opportunity_assignments;
create policy opportunity_assignments_p1_no_direct_update
  on opportunity_assignments
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists opportunity_qualifications_p1_select_authorized on opportunity_qualifications;
create policy opportunity_qualifications_p1_select_authorized
  on opportunity_qualifications
  for select
  to authenticated
  using (public.p1_01a_can_access_opportunity(opportunity_id));

drop policy if exists opportunity_qualifications_p1_no_direct_insert on opportunity_qualifications;
create policy opportunity_qualifications_p1_no_direct_insert
  on opportunity_qualifications
  for insert
  to authenticated
  with check (false);

drop policy if exists opportunity_qualifications_p1_no_direct_update on opportunity_qualifications;
create policy opportunity_qualifications_p1_no_direct_update
  on opportunity_qualifications
  for update
  to authenticated
  using (false)
  with check (false);

create or replace function public.p1_01a_get_opportunity_v1(p_opportunity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  qualification jsonb;
  assignments jsonb;
begin
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select coalesce(to_jsonb(q), '{}'::jsonb)
  into qualification
  from opportunity_qualifications q
  where q.opportunity_id = opp.id;

  select coalesce(jsonb_agg(to_jsonb(oa) order by oa.created_at), '[]'::jsonb)
  into assignments
  from opportunity_assignments oa
  where oa.opportunity_id = opp.id
    and oa.status = 'active';

  return jsonb_build_object(
    'success', true,
    'opportunity', to_jsonb(opp),
    'qualification', coalesce(qualification, '{}'::jsonb),
    'assignments', coalesce(assignments, '[]'::jsonb)
  );
end;
$$;

create or replace function public.p1_01a_list_opportunity_actions_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  items jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(o) order by
    case o.lifecycle_status when 'decision_required' then 1 when 'qualifying' then 2 else 3 end,
    o.bid_due_date nulls last,
    o.created_at
  ), '[]'::jsonb)
  into items
  from opportunities o
  where o.lifecycle_status in ('draft','qualifying','decision_required')
    and public.p1_01a_can_access_opportunity(o.id);

  return jsonb_build_object('success', true, 'items', coalesce(items, '[]'::jsonb));
end;
$$;

create or replace function public.create_opportunity_v1(
  p_payload jsonb,
  p_command_id text,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  workspace_uuid uuid := public.p1_01a_current_workspace_id();
  org_uuid uuid;
  actor_role text;
  profile_uuid uuid;
  opp_id uuid := gen_random_uuid();
  stable_key text;
  fp text;
  duplicate_count integer;
  owner_uuid uuid;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  if workspace_uuid is null then return jsonb_build_object('success', false, 'error', 'workspace_required'); end if;
  actor_role := public.current_workspace_role(workspace_uuid);
  if actor_role not in ('business_development_lead','operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select organization_id into org_uuid from workspaces where id = workspace_uuid;
  select id into profile_uuid from user_profiles where user_id = actor limit 1;
  owner_uuid := coalesce(nullif(p_payload->>'ownerUserId', '')::uuid, actor);

  if coalesce(p_payload->>'name', '') = '' or coalesce(p_payload->>'customerGc', '') = '' or coalesce(p_payload->>'projectType', '') = '' or coalesce(p_payload->>'location', '') = '' or coalesce(p_payload->>'scopeSummary', '') = '' then
    return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Opportunity name, customer/GC, project type, location, and scope summary are required.');
  end if;

  fp := public.p1_01a_duplicate_fingerprint(p_payload->>'customerGc', p_payload->>'name', p_payload->>'location');
  select count(*) into duplicate_count
  from opportunities
  where workspace_id = workspace_uuid
    and duplicate_fingerprint = fp;

  if duplicate_count > 0 and coalesce((p_payload->>'duplicateConfirmed')::boolean, false) = false then
    return jsonb_build_object('success', false, 'error', 'duplicate_warning_requires_confirmation', 'duplicateCount', duplicate_count);
  end if;

  stable_key := coalesce(nullif(p_payload->>'stableOpportunityKey', ''), 'opp-' || replace(substr(opp_id::text, 1, 8), '-', ''));
  request_hash := md5(p_payload::text);

  select * into claim
  from rybex_internal.claim_or_replay_command(workspace_uuid, p_command_id, 'opportunity.create.v1', 'opportunity', opp_id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  insert into opportunities (
    id, organization_id, workspace_id, stable_opportunity_key, name, gc_client, customer_gc,
    project_type, project_location, opportunity_location, scope_summary, estimated_value,
    anticipated_start, bid_due_date, owner_user_id, lifecycle_status, status,
    intake_complete, qualification_complete, decision_readiness_status, duplicate_fingerprint,
    duplicate_confirmed, created_by, updated_by
  )
  values (
    opp_id, org_uuid, workspace_uuid, stable_key, trim(p_payload->>'name'), trim(p_payload->>'customerGc'), trim(p_payload->>'customerGc'),
    trim(p_payload->>'projectType'), trim(p_payload->>'location'), trim(p_payload->>'location'), trim(p_payload->>'scopeSummary'),
    nullif(p_payload->>'estimatedValue', '')::numeric,
    nullif(p_payload->>'anticipatedStart', '')::date,
    nullif(p_payload->>'bidDueDate', '')::date,
    owner_uuid, 'qualifying', 'under_review',
    true, false, 'not_ready', fp, coalesce((p_payload->>'duplicateConfirmed')::boolean, false),
    profile_uuid, profile_uuid
  );

  insert into opportunity_assignments (workspace_id, opportunity_id, user_id, assignment_type, created_by)
  values (workspace_uuid, opp_id, owner_uuid, 'owner', actor);

  if duplicate_count > 0 then
    perform rybex_internal.append_audit_event(workspace_uuid, null, 'opportunity', opp_id, p_command_id, 'opportunity.duplicate_confirmed', null, 'qualifying', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('duplicateCount', duplicate_count), '{}'::jsonb);
  end if;

  perform rybex_internal.append_audit_event(workspace_uuid, null, 'opportunity', opp_id, p_command_id, 'opportunity.created', null, 'qualifying', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, p_payload, '{}'::jsonb);
  perform rybex_internal.append_domain_event(workspace_uuid, null, 'opportunity', opp_id, 1, 'opportunity.created', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, p_payload);

  result := public.p1_01a_get_opportunity_v1(opp_id);
  perform rybex_internal.complete_command(workspace_uuid, p_command_id, result);
  return result;
end;
$$;

create or replace function public.update_opportunity_v1(
  p_opportunity_id uuid,
  p_payload jsonb,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opp opportunities%rowtype;
  next_version integer;
  fp text;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;

  if coalesce(p_payload->>'name', opp.name, '') = ''
     or coalesce(p_payload->>'customerGc', opp.customer_gc, opp.gc_client, '') = ''
     or coalesce(p_payload->>'projectType', opp.project_type, '') = ''
     or coalesce(p_payload->>'location', opp.opportunity_location, opp.project_location, '') = ''
     or coalesce(p_payload->>'scopeSummary', opp.scope_summary, '') = '' then
    return jsonb_build_object('success', false, 'error', 'validation_failed');
  end if;

  request_hash := md5(p_payload::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.update.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  fp := public.p1_01a_duplicate_fingerprint(
    coalesce(nullif(p_payload->>'customerGc', ''), opp.customer_gc, opp.gc_client),
    coalesce(nullif(p_payload->>'name', ''), opp.name),
    coalesce(nullif(p_payload->>'location', ''), opp.opportunity_location, opp.project_location)
  );
  next_version := opp.version + 1;

  update opportunities
  set name = coalesce(nullif(trim(p_payload->>'name'), ''), name),
      customer_gc = coalesce(nullif(trim(p_payload->>'customerGc'), ''), customer_gc),
      gc_client = coalesce(nullif(trim(p_payload->>'customerGc'), ''), gc_client),
      project_type = coalesce(nullif(trim(p_payload->>'projectType'), ''), project_type),
      opportunity_location = coalesce(nullif(trim(p_payload->>'location'), ''), opportunity_location),
      project_location = coalesce(nullif(trim(p_payload->>'location'), ''), project_location),
      scope_summary = coalesce(nullif(trim(p_payload->>'scopeSummary'), ''), scope_summary),
      estimated_value = coalesce(nullif(p_payload->>'estimatedValue', '')::numeric, estimated_value),
      anticipated_start = coalesce(nullif(p_payload->>'anticipatedStart', '')::date, anticipated_start),
      bid_due_date = coalesce(nullif(p_payload->>'bidDueDate', '')::date, bid_due_date),
      duplicate_fingerprint = fp,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.updated', opp.lifecycle_status, opp.lifecycle_status, actor, coalesce(p_correlation_id, p_command_id), to_jsonb(opp), p_payload, '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.updated', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, p_payload);
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

create or replace function public.manage_opportunity_assignment_v1(
  p_opportunity_id uuid,
  p_user_id uuid,
  p_assignment_type text,
  p_status text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opp opportunities%rowtype;
  request_hash text;
  claim record;
  next_version integer;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_manage_opportunity_assignments(p_opportunity_id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;
  if p_assignment_type not in ('owner','contributor','estimator') or p_status not in ('active','suspended','archived') then return jsonb_build_object('success', false, 'error', 'validation_failed'); end if;

  request_hash := md5(coalesce(p_user_id::text, '') || p_assignment_type || p_status || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.assignment.manage.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  if p_assignment_type = 'owner' and p_status = 'active' then
    update opportunity_assignments set status = 'archived' where opportunity_id = opp.id and assignment_type = 'owner' and status = 'active';
    update opportunities set owner_user_id = p_user_id where id = opp.id;
  end if;

  insert into opportunity_assignments (workspace_id, opportunity_id, user_id, assignment_type, status, created_by)
  values (opp.workspace_id, opp.id, p_user_id, p_assignment_type, p_status, actor)
  on conflict (opportunity_id, user_id, assignment_type) where status = 'active'
  do update set status = excluded.status, updated_at = now();

  next_version := opp.version + 1;
  update opportunities set version = next_version, updated_at = now() where id = opp.id;
  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.assignment_managed', opp.lifecycle_status, opp.lifecycle_status, actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('userId', p_user_id, 'assignmentType', p_assignment_type, 'status', p_status), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.assignment_managed', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('userId', p_user_id, 'assignmentType', p_assignment_type, 'status', p_status));
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

create or replace function public.save_opportunity_qualification_v1(
  p_opportunity_id uuid,
  p_payload jsonb,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opp opportunities%rowtype;
  complete boolean;
  next_version integer;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;

  complete := public.p1_01a_qualification_complete(p_payload);
  request_hash := md5(p_payload::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.qualification.save.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;

  insert into opportunity_qualifications (
    workspace_id, opportunity_id, status, strategic_fit, customer_relationship, geography_fit,
    project_type_fit, scope_clarity, design_maturity, commercial_terms_risk, schedule_feasibility,
    crew_capacity_fit, material_lead_time_risk, permits_access_risk, safety_quality_complexity,
    subcontractor_dependency, cash_flow_risk, margin_confidence, contractual_risk, risk_summary,
    assumptions, recommendation, completeness_result, prepared_by, completed_at
  )
  values (
    opp.workspace_id, opp.id, case when complete then 'complete' else 'in_progress' end,
    coalesce(nullif(p_payload->>'strategicFit',''), 'unknown'),
    coalesce(nullif(p_payload->>'customerRelationship',''), 'unknown'),
    coalesce(nullif(p_payload->>'geographyFit',''), 'unknown'),
    coalesce(nullif(p_payload->>'projectTypeFit',''), 'unknown'),
    coalesce(nullif(p_payload->>'scopeClarity',''), 'unknown'),
    coalesce(nullif(p_payload->>'designMaturity',''), 'unknown'),
    coalesce(nullif(p_payload->>'commercialTermsRisk',''), 'unknown'),
    coalesce(nullif(p_payload->>'scheduleFeasibility',''), 'unknown'),
    coalesce(nullif(p_payload->>'crewCapacityFit',''), 'unknown'),
    coalesce(nullif(p_payload->>'materialLeadTimeRisk',''), 'unknown'),
    coalesce(nullif(p_payload->>'permitsAccessRisk',''), 'unknown'),
    coalesce(nullif(p_payload->>'safetyQualityComplexity',''), 'unknown'),
    coalesce(nullif(p_payload->>'subcontractorDependency',''), 'unknown'),
    coalesce(nullif(p_payload->>'cashFlowRisk',''), 'unknown'),
    coalesce(nullif(p_payload->>'marginConfidence',''), 'unknown'),
    coalesce(nullif(p_payload->>'contractualRisk',''), 'unknown'),
    coalesce(p_payload->>'riskSummary', ''),
    coalesce(p_payload->>'assumptions', ''),
    coalesce(nullif(p_payload->>'recommendation',''), 'hold_for_clarification'),
    case when complete then 'complete' else 'incomplete' end,
    actor,
    case when complete then now() else null end
  )
  on conflict (opportunity_id)
  do update set
    status = excluded.status,
    strategic_fit = excluded.strategic_fit,
    customer_relationship = excluded.customer_relationship,
    geography_fit = excluded.geography_fit,
    project_type_fit = excluded.project_type_fit,
    scope_clarity = excluded.scope_clarity,
    design_maturity = excluded.design_maturity,
    commercial_terms_risk = excluded.commercial_terms_risk,
    schedule_feasibility = excluded.schedule_feasibility,
    crew_capacity_fit = excluded.crew_capacity_fit,
    material_lead_time_risk = excluded.material_lead_time_risk,
    permits_access_risk = excluded.permits_access_risk,
    safety_quality_complexity = excluded.safety_quality_complexity,
    subcontractor_dependency = excluded.subcontractor_dependency,
    cash_flow_risk = excluded.cash_flow_risk,
    margin_confidence = excluded.margin_confidence,
    contractual_risk = excluded.contractual_risk,
    risk_summary = excluded.risk_summary,
    assumptions = excluded.assumptions,
    recommendation = excluded.recommendation,
    completeness_result = excluded.completeness_result,
    prepared_by = excluded.prepared_by,
    completed_at = excluded.completed_at,
    version = opportunity_qualifications.version + 1,
    updated_at = now();

  next_version := opp.version + 1;
  update opportunities
  set lifecycle_status = case when complete then 'qualifying' else lifecycle_status end,
      status = case when complete then 'under_review' else status end,
      qualification_complete = complete,
      decision_readiness_status = case when complete then 'ready_for_decision' else 'not_ready' end,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.qualification_saved', opp.lifecycle_status, case when complete then 'qualifying' else opp.lifecycle_status end, actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, p_payload || jsonb_build_object('complete', complete), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.qualification_saved', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, p_payload || jsonb_build_object('complete', complete));
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

create or replace function public.submit_opportunity_for_decision_v1(
  p_opportunity_id uuid,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opp opportunities%rowtype;
  qual opportunity_qualifications%rowtype;
  next_version integer;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) and not public.has_workspace_role(opp.workspace_id, array['business_development_lead','operations_leader','admin']) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;
  if opp.owner_user_id is null or not opp.intake_complete then return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Complete intake and owner before submitting.'); end if;
  select * into qual from opportunity_qualifications where opportunity_id = opp.id;
  if not found or qual.completeness_result <> 'complete' then return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Complete qualification before submitting.'); end if;

  request_hash := md5(opp.id::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.submit_for_decision.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  next_version := opp.version + 1;
  update opportunities
  set lifecycle_status = 'decision_required',
      status = 'awaiting_go_no_go',
      decision_readiness_status = 'ready_for_decision',
      submitted_for_decision_at = now(),
      submitted_for_decision_by = actor,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.submitted_for_decision', opp.lifecycle_status, 'decision_required', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('qualificationId', qual.id), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.submitted_for_decision', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('qualificationId', qual.id));
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.p1_01a_current_workspace_id() to authenticated, service_role;
grant execute on function public.p1_01a_can_access_opportunity(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_can_mutate_opportunity(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_can_manage_opportunity_assignments(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_duplicate_fingerprint(text, text, text) to authenticated, service_role;
grant execute on function public.p1_01a_get_opportunity_v1(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_list_opportunity_actions_v1() to authenticated, service_role;
grant execute on function public.create_opportunity_v1(jsonb, text, text) to authenticated;
grant execute on function public.update_opportunity_v1(uuid, jsonb, text, integer, text) to authenticated;
grant execute on function public.manage_opportunity_assignment_v1(uuid, uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.save_opportunity_qualification_v1(uuid, jsonb, text, integer, text) to authenticated;
grant execute on function public.submit_opportunity_for_decision_v1(uuid, text, integer, text) to authenticated;
