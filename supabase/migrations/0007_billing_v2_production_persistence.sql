-- Foundation 0C - Billing V2 Production Persistence
--
-- Scope:
-- - Billing V2 domain-specific persistence for the current cash-recovery reference slice.
-- - Billing command RPCs with authenticated actor, workspace, project, role, idempotency,
--   optimistic concurrency, audit/domain events, and evidence linkage.
-- - Does not migrate Field Issue/RFI/Change, Closeout, payments, or accounting.

create table if not exists billing_backup_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  stable_package_key text not null,
  pay_application_key text not null,
  pay_application_label text not null,
  backup_item_key text not null,
  commercial_exposure_key text not null,
  title text not null,
  blocker_reason text not null,
  owner_label text not null default 'Billing Lead',
  reviewer_role text not null default 'Commercial Review',
  status text not null default 'blocked',
  blocked_amount numeric(14, 2) not null,
  currency text not null default 'USD',
  backup_summary text,
  related_source_record text,
  related_source_record_type text,
  amount_affected numeric(14, 2),
  review_note text,
  resolution_note text,
  current_review_task_id uuid,
  blocker_resolution_id uuid,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  started_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, stable_package_key),
  constraint billing_backup_packages_status_check check (
    status in (
      'blocked',
      'backup_package_in_progress',
      'evidence_required',
      'package_ready_for_review',
      'commercial_review_pending',
      'commercial_review_approved',
      'commercial_review_changes_requested',
      'commercial_review_rejected',
      'billing_blocker_cleared',
      'reopened'
    )
  ),
  constraint billing_backup_packages_amount_check check (blocked_amount >= 0 and (amount_affected is null or amount_affected >= 0))
);

create table if not exists billing_backup_requirements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  package_id uuid not null references billing_backup_packages(id) on delete cascade,
  stable_requirement_key text not null,
  label text not null,
  description text not null,
  required boolean not null default true,
  waiver_allowed boolean not null default false,
  status text not null default 'missing',
  reference_text text,
  reference_type text,
  linked_record_id text,
  evidence_object_id uuid references evidence_objects(id) on delete set null,
  waiver_reason text,
  version integer not null default 1,
  completed_by uuid references auth.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, stable_requirement_key),
  constraint billing_backup_requirements_status_check check (
    status in ('missing', 'referenced', 'attached', 'verified', 'waived', 'not_required')
  )
);

create table if not exists billing_commercial_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  package_id uuid not null references billing_backup_packages(id) on delete cascade,
  assigned_role text not null,
  status text not null default 'pending',
  due_date date,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  version integer not null default 1,
  constraint billing_commercial_reviews_status_check check (
    status in ('pending', 'approved', 'changes_requested', 'rejected', 'cancelled')
  )
);

create table if not exists billing_review_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  package_id uuid not null references billing_backup_packages(id) on delete cascade,
  review_id uuid references billing_commercial_reviews(id) on delete set null,
  decision text not null,
  decision_note text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  constraint billing_review_decisions_decision_check check (
    decision in ('approved', 'changes_requested', 'rejected')
  )
);

create table if not exists billing_blocker_clearances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  package_id uuid not null references billing_backup_packages(id) on delete cascade,
  resolution_note text not null,
  cleared_by uuid not null references auth.users(id) on delete restrict,
  cleared_at timestamptz not null default now(),
  unique (package_id)
);

create trigger set_billing_backup_packages_updated_at
before update on billing_backup_packages
for each row execute function set_updated_at();

create trigger set_billing_backup_requirements_updated_at
before update on billing_backup_requirements
for each row execute function set_updated_at();

create index if not exists billing_backup_packages_workspace_status_idx on billing_backup_packages(workspace_id, status);
create index if not exists billing_backup_packages_project_idx on billing_backup_packages(workspace_id, project_id);
create index if not exists billing_backup_requirements_package_idx on billing_backup_requirements(package_id);
create index if not exists billing_commercial_reviews_package_idx on billing_commercial_reviews(package_id, submitted_at desc);
create index if not exists billing_review_decisions_package_idx on billing_review_decisions(package_id, decided_at desc);
create index if not exists billing_blocker_clearances_package_idx on billing_blocker_clearances(package_id);

grant select on billing_backup_packages, billing_backup_requirements, billing_commercial_reviews, billing_review_decisions, billing_blocker_clearances to authenticated, service_role;
grant insert, update, delete on billing_backup_packages, billing_backup_requirements, billing_commercial_reviews, billing_review_decisions, billing_blocker_clearances to service_role;

alter table billing_backup_packages enable row level security;
alter table billing_backup_requirements enable row level security;
alter table billing_commercial_reviews enable row level security;
alter table billing_review_decisions enable row level security;
alter table billing_blocker_clearances enable row level security;

drop policy if exists billing_backup_packages_select_authorized on billing_backup_packages;
create policy billing_backup_packages_select_authorized
  on billing_backup_packages
  for select
  to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists billing_backup_requirements_select_authorized on billing_backup_requirements;
create policy billing_backup_requirements_select_authorized
  on billing_backup_requirements
  for select
  to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists billing_commercial_reviews_select_authorized on billing_commercial_reviews;
create policy billing_commercial_reviews_select_authorized
  on billing_commercial_reviews
  for select
  to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists billing_review_decisions_select_authorized on billing_review_decisions;
create policy billing_review_decisions_select_authorized
  on billing_review_decisions
  for select
  to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists billing_blocker_clearances_select_authorized on billing_blocker_clearances;
create policy billing_blocker_clearances_select_authorized
  on billing_blocker_clearances
  for select
  to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists billing_backup_packages_no_direct_mutation on billing_backup_packages;
create policy billing_backup_packages_no_direct_mutation on billing_backup_packages for all to authenticated using (false) with check (false);
drop policy if exists billing_backup_requirements_no_direct_mutation on billing_backup_requirements;
create policy billing_backup_requirements_no_direct_mutation on billing_backup_requirements for all to authenticated using (false) with check (false);
drop policy if exists billing_commercial_reviews_no_direct_mutation on billing_commercial_reviews;
create policy billing_commercial_reviews_no_direct_mutation on billing_commercial_reviews for all to authenticated using (false) with check (false);
drop policy if exists billing_review_decisions_no_direct_mutation on billing_review_decisions;
create policy billing_review_decisions_no_direct_mutation on billing_review_decisions for all to authenticated using (false) with check (false);
drop policy if exists billing_blocker_clearances_no_direct_mutation on billing_blocker_clearances;
create policy billing_blocker_clearances_no_direct_mutation on billing_blocker_clearances for all to authenticated using (false) with check (false);

create or replace function rybex_internal.billing_v2_active_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  workspace_id uuid;
begin
  if actor is null then
    return null;
  end if;

  select up.active_workspace_id
  into workspace_id
  from user_profiles up
  where up.user_id = actor
    and up.status = 'active'
  limit 1;

  if workspace_id is null then
    select wm.workspace_id
    into workspace_id
    from workspace_memberships wm
    where wm.user_id = actor
      and wm.status = 'active'
    limit 1;
  end if;

  return workspace_id;
end;
$$;

create or replace function rybex_internal.billing_v2_readiness(package_uuid uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with reqs as (
    select *
    from billing_backup_requirements
    where package_id = package_uuid
  ),
  counts as (
    select
      count(*) filter (where required) as required_count,
      count(*) filter (where required and status in ('referenced','attached','verified','waived','not_required')) as complete_count,
      count(*) filter (where required and status not in ('referenced','attached','verified','waived','not_required')) as missing_count
    from reqs
  )
  select jsonb_build_object(
    'requiredCount', coalesce(required_count, 0),
    'completeCount', coalesce(complete_count, 0),
    'missingCount', coalesce(missing_count, 0),
    'readyForReview', coalesce(missing_count, 0) = 0,
    'missingItems', coalesce((
      select jsonb_agg(label order by stable_requirement_key)
      from reqs
      where required and status not in ('referenced','attached','verified','waived','not_required')
    ), '[]'::jsonb),
    'completedItems', coalesce((
      select jsonb_agg(label order by stable_requirement_key)
      from reqs
      where required and status in ('referenced','attached','verified','waived','not_required')
    ), '[]'::jsonb)
  )
  from counts;
$$;

create or replace function rybex_internal.billing_v2_package_payload(package_uuid uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  pkg billing_backup_packages%rowtype;
  requirements jsonb;
  review billing_commercial_reviews%rowtype;
  decision billing_review_decisions%rowtype;
  clearance billing_blocker_clearances%rowtype;
  readiness jsonb;
  cash_at_risk numeric;
  result jsonb;
begin
  select * into pkg from billing_backup_packages where id = package_uuid;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', stable_requirement_key,
    'label', label,
    'description', description,
    'required', required,
    'waiverAllowed', waiver_allowed,
    'status', status,
    'referenceText', reference_text,
    'referenceType', reference_type,
    'linkedRecordId', linked_record_id,
    'storagePointer', evidence_object_id::text,
    'waiverReason', waiver_reason
  ) order by stable_requirement_key), '[]'::jsonb)
  into requirements
  from billing_backup_requirements
  where package_id = pkg.id;

  select * into review
  from billing_commercial_reviews
  where package_id = pkg.id
  order by submitted_at desc
  limit 1;

  select * into decision
  from billing_review_decisions
  where package_id = pkg.id
  order by decided_at desc
  limit 1;

  select * into clearance
  from billing_blocker_clearances
  where package_id = pkg.id
  limit 1;

  readiness := rybex_internal.billing_v2_readiness(pkg.id);
  cash_at_risk := case when pkg.status = 'billing_blocker_cleared' then 0 else pkg.blocked_amount end;

  result := jsonb_build_object(
    'success', true,
    'ok', true,
    'message', 'Billing V2 database state loaded.',
    'events', '[]'::jsonb,
    'package', jsonb_build_object(
      'id', pkg.stable_package_key,
      'projectId', pkg.project_id::text,
      'projectName', 'Lake Norman Underground Conduit Package',
      'workPackageId', 'wp-lake-underground-conduit',
      'payApplicationId', pkg.pay_application_key,
      'payApplicationLabel', pkg.pay_application_label,
      'title', pkg.title,
      'blockerReason', pkg.blocker_reason,
      'owner', pkg.owner_label,
      'reviewerRole', pkg.reviewer_role,
      'state', pkg.status,
      'blockedAmount', pkg.blocked_amount,
      'currency', pkg.currency,
      'backupSummary', pkg.backup_summary,
      'relatedSourceRecord', case when pkg.related_source_record is null then null else jsonb_build_object(
        'sourceRecordId', pkg.commercial_exposure_key,
        'sourceRecordLabel', pkg.related_source_record,
        'sourceRecordType', coalesce(pkg.related_source_record_type, 'billing backup / stored material support')
      ) end,
      'amountAffected', case when pkg.amount_affected is null then null else jsonb_build_object(
        'amount', pkg.amount_affected,
        'currency', pkg.currency
      ) end,
      'reviewNote', pkg.review_note,
      'resolutionNote', pkg.resolution_note,
      'evidenceRequirements', requirements,
      'reviewTask', case when review.id is null then null else jsonb_build_object(
        'id', review.id::text,
        'assignedRole', review.assigned_role,
        'status', review.status,
        'dueDate', review.due_date::text,
        'submittedAt', review.submitted_at
      ) end,
      'reviewDecision', case when decision.id is null then null else jsonb_build_object(
        'id', decision.id::text,
        'reviewTaskId', decision.review_id::text,
        'decision', decision.decision,
        'decisionNote', decision.decision_note,
        'reviewerId', decision.reviewer_id::text,
        'decidedAt', decision.decided_at
      ) end,
      'blockerResolution', case when clearance.id is null then null else jsonb_build_object(
        'id', clearance.id::text,
        'resolutionNote', clearance.resolution_note,
        'clearedBy', clearance.cleared_by::text,
        'clearedAt', clearance.cleared_at,
        'outcome', 'Missing backup blocker cleared; pay application can continue through commercial review.'
      ) end,
      'outcomeRecord', case when clearance.id is null then null else jsonb_build_object(
        'id', 'billing-v2-outcome-' || pkg.stable_package_key,
        'outcome', 'PA-001 backup approved and unblocked for commercial review.',
        'recordedAt', clearance.cleared_at
      ) end,
      'historicalRecord', jsonb_build_object('stateTransitions', '[]'::jsonb),
      'events', '[]'::jsonb,
      'history', '[]'::jsonb,
      'localDemoOnly', false,
      'databaseBacked', true,
      'storageMode', 'database',
      'createdAt', pkg.created_at,
      'updatedAt', pkg.updated_at,
      'version', pkg.version
    ),
    'readiness', readiness,
    'impact', jsonb_build_object(
      'openBlockerCount', case when pkg.status = 'billing_blocker_cleared' then 0 else 1 end,
      'resolvedBlockerCount', case when pkg.status = 'billing_blocker_cleared' then 1 else 0 end,
      'cashAtRisk', cash_at_risk,
      'billingReadinessScore', case when (readiness->>'requiredCount')::integer = 0 then 100 else round(((readiness->>'completeCount')::numeric / greatest((readiness->>'requiredCount')::numeric, 1)) * 100) end,
      'packageState', pkg.status,
      'samePrimaryBlockerResolved', pkg.status = 'billing_blocker_cleared'
    ),
    'storageLabel', 'Database-backed',
    'resultingVersion', pkg.version
  );

  return result;
end;
$$;

create or replace function rybex_internal.billing_v2_apply_command(
  p_action text,
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_payload jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  resolved_workspace_id uuid;
  role text;
  pkg billing_backup_packages%rowtype;
  before_values jsonb;
  after_payload jsonb;
  existing command_idempotency%rowtype;
  claim record;
  request_hash text;
  next_status text;
  next_version integer;
  audit_id uuid;
  event_id uuid;
  review_id uuid;
  clearance_id uuid;
  requirement billing_backup_requirements%rowtype;
  evidence evidence_objects%rowtype;
  correlation text := coalesce(nullif(p_correlation_id, ''), gen_random_uuid()::text);
  missing_count integer;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  resolved_workspace_id := rybex_internal.billing_v2_active_workspace();
  if resolved_workspace_id is null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;

  role := public.current_workspace_role(resolved_workspace_id);
  if role is null then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select *
  into pkg
  from billing_backup_packages
  where billing_backup_packages.workspace_id = resolved_workspace_id
    and stable_package_key = coalesce(nullif(p_stable_package_key, ''), 'billing-v2-package-bb-lake-001')
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.can_access_project(pkg.project_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_action in ('start','save_details','attach_evidence','validate_readiness','submit_review')
     and role not in ('admin','operations_leader','project_manager','billing_commercial_lead') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_action in ('record_decision','clear_blocker')
     and role not in ('admin','operations_leader','billing_commercial_lead') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  request_hash := encode(extensions.digest(
    convert_to(resolved_workspace_id::text || '|' || pkg.id::text || '|' || p_action || '|' || coalesce(p_expected_version::text, '') || '|' || coalesce(p_payload::text, '{}'), 'UTF8'),
    'sha256'
  ), 'hex');

  select *
  into existing
  from command_idempotency ci
  where ci.workspace_id = resolved_workspace_id
    and ci.command_id = p_command_id;

  if found then
    if existing.request_hash <> request_hash then
      return jsonb_build_object('success', false, 'error', 'idempotency_mismatch');
    end if;

    if existing.result_status = 'completed' then
      return existing.result_payload || jsonb_build_object('success', true, 'replayed', true);
    end if;

    return jsonb_build_object('success', false, 'error', 'command_in_progress');
  end if;

  if pkg.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', pkg.version);
  end if;

  select *
  into claim
  from rybex_internal.claim_or_replay_command(
    resolved_workspace_id,
    p_command_id,
    'billing_v2.' || p_action || '.v1',
    'billing_backup_package',
    pkg.id,
    request_hash,
    actor,
    correlation
  );

  if claim.action = 'replay' then
    return claim.existing_result || jsonb_build_object('success', true, 'replayed', true);
  end if;

  if claim.action <> 'claimed' then
    return jsonb_build_object('success', false, 'error', claim.existing_result->>'error');
  end if;

  before_values := jsonb_build_object('status', pkg.status, 'version', pkg.version);
  next_status := pkg.status;

  if p_action = 'start' then
    if pkg.status in ('blocked', 'reopened') then
      next_status := 'backup_package_in_progress';
      update billing_backup_packages
      set status = next_status,
          started_at = coalesce(started_at, now()),
          updated_by = actor,
          version = version + 1
      where id = pkg.id
      returning * into pkg;
    else
      next_status := pkg.status;
      update billing_backup_packages set updated_by = actor, version = version + 1 where id = pkg.id returning * into pkg;
    end if;
  elsif p_action = 'save_details' then
    if pkg.status not in ('backup_package_in_progress','evidence_required','commercial_review_changes_requested','reopened') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    next_status := 'evidence_required';
    update billing_backup_packages
    set backup_summary = nullif(trim(p_payload->>'backupSummary'), ''),
        related_source_record = nullif(trim(p_payload->>'relatedSourceRecord'), ''),
        related_source_record_type = 'billing backup / stored material support',
        amount_affected = (p_payload->>'amountAffected')::numeric,
        status = next_status,
        updated_by = actor,
        version = version + 1
    where id = pkg.id
    returning * into pkg;
  elsif p_action = 'attach_evidence' then
    select *
    into requirement
    from billing_backup_requirements
    where package_id = pkg.id
      and stable_requirement_key = p_payload->>'requirementKey'
    for update;

    if not found then
      return jsonb_build_object('success', false, 'error', 'requirement_not_found');
    end if;

    if nullif(p_payload->>'evidenceId', '') is not null then
      select *
      into evidence
      from evidence_objects
      where id = (p_payload->>'evidenceId')::uuid
        and workspace_id = pkg.workspace_id
        and project_id = pkg.project_id
        and upload_status = 'uploaded';

      if not found then
        return jsonb_build_object('success', false, 'error', 'evidence_required');
      end if;

      insert into evidence_links (
        workspace_id,
        project_id,
        evidence_object_id,
        entity_type,
        entity_id,
        relationship_type,
        created_by
      )
      values (
        pkg.workspace_id,
        pkg.project_id,
        evidence.id,
        'billing_backup_requirement',
        requirement.id,
        'billing_backup_evidence',
        actor
      )
      on conflict (workspace_id, evidence_object_id, entity_type, entity_id, relationship_type)
      do nothing;
    end if;

    update billing_backup_requirements
    set status = case
          when nullif(p_payload->>'waiverReason', '') is not null then 'waived'
          when nullif(p_payload->>'evidenceId', '') is not null then 'attached'
          else 'referenced'
        end,
        reference_text = nullif(trim(p_payload->>'referenceText'), ''),
        reference_type = nullif(trim(p_payload->>'referenceType'), ''),
        evidence_object_id = case when nullif(p_payload->>'evidenceId', '') is null then evidence_object_id else (p_payload->>'evidenceId')::uuid end,
        waiver_reason = nullif(trim(p_payload->>'waiverReason'), ''),
        completed_by = actor,
        completed_at = now(),
        version = version + 1
    where id = requirement.id;

    select count(*) filter (where required and status not in ('referenced','attached','verified','waived','not_required'))
    into missing_count
    from billing_backup_requirements
    where package_id = pkg.id;

    next_status := case when missing_count = 0 then 'package_ready_for_review' else 'evidence_required' end;
    update billing_backup_packages
    set status = next_status,
        updated_by = actor,
        version = version + 1
    where id = pkg.id
    returning * into pkg;
  elsif p_action = 'validate_readiness' then
    select count(*) filter (where required and status not in ('referenced','attached','verified','waived','not_required'))
    into missing_count
    from billing_backup_requirements
    where package_id = pkg.id;
    next_status := case when missing_count = 0 then 'package_ready_for_review' else 'evidence_required' end;
    update billing_backup_packages
    set status = next_status,
        updated_by = actor,
        version = version + 1
    where id = pkg.id
    returning * into pkg;
  elsif p_action = 'submit_review' then
    if pkg.status <> 'package_ready_for_review' then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    insert into billing_commercial_reviews (
      workspace_id,
      project_id,
      package_id,
      assigned_role,
      due_date,
      submitted_by
    )
    values (
      pkg.workspace_id,
      pkg.project_id,
      pkg.id,
      coalesce(nullif(p_payload->>'assignedRole', ''), 'Commercial Review'),
      nullif(p_payload->>'dueDate', '')::date,
      actor
    )
    returning id into review_id;
    next_status := 'commercial_review_pending';
    update billing_backup_packages
    set status = next_status,
        current_review_task_id = review_id,
        updated_by = actor,
        version = version + 1
    where id = pkg.id
    returning * into pkg;
  elsif p_action = 'record_decision' then
    if pkg.status <> 'commercial_review_pending' or pkg.current_review_task_id is null then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if (p_payload->>'decision') not in ('approved','changes_requested','rejected') then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    insert into billing_review_decisions (
      workspace_id,
      project_id,
      package_id,
      review_id,
      decision,
      decision_note,
      reviewer_id
    )
    values (
      pkg.workspace_id,
      pkg.project_id,
      pkg.id,
      pkg.current_review_task_id,
      p_payload->>'decision',
      coalesce(nullif(trim(p_payload->>'decisionNote'), ''), 'Decision recorded.'),
      actor
    );
    update billing_commercial_reviews
    set status = p_payload->>'decision',
        version = version + 1
    where id = pkg.current_review_task_id;
    next_status := case p_payload->>'decision'
      when 'approved' then 'commercial_review_approved'
      when 'changes_requested' then 'commercial_review_changes_requested'
      else 'commercial_review_rejected'
    end;
    update billing_backup_packages
    set status = next_status,
        updated_by = actor,
        version = version + 1
    where id = pkg.id
    returning * into pkg;
  elsif p_action = 'clear_blocker' then
    if pkg.status <> 'commercial_review_approved' then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if nullif(trim(p_payload->>'resolutionNote'), '') is null then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    insert into billing_blocker_clearances (
      workspace_id,
      project_id,
      package_id,
      resolution_note,
      cleared_by
    )
    values (
      pkg.workspace_id,
      pkg.project_id,
      pkg.id,
      trim(p_payload->>'resolutionNote'),
      actor
    )
    on conflict (package_id) do update
    set resolution_note = excluded.resolution_note,
        cleared_by = excluded.cleared_by,
        cleared_at = now()
    returning id into clearance_id;
    next_status := 'billing_blocker_cleared';
    update billing_backup_packages
    set status = next_status,
        blocker_resolution_id = clearance_id,
        resolution_note = trim(p_payload->>'resolutionNote'),
        cleared_at = now(),
        updated_by = actor,
        version = version + 1
    where id = pkg.id
    returning * into pkg;
  else
    return jsonb_build_object('success', false, 'error', 'unsupported_action');
  end if;

  next_version := pkg.version;
  after_payload := rybex_internal.billing_v2_package_payload(pkg.id)
    || jsonb_build_object(
      'message', 'Billing V2 database command completed.',
      'events', jsonb_build_array(jsonb_build_object('type', 'billing_v2_' || p_action, 'toState', pkg.status)),
      'replayed', false,
      'resultingVersion', next_version,
      'correlationId', correlation
    );

  audit_id := rybex_internal.append_audit_event(
    pkg.workspace_id,
    pkg.project_id,
    'billing_backup_package',
    pkg.id,
    p_command_id,
    'billing_v2.' || p_action,
    before_values->>'status',
    pkg.status,
    actor,
    correlation,
    before_values,
    jsonb_build_object('status', pkg.status, 'version', pkg.version),
    jsonb_build_object('foundationIncrement', '0C', 'billingPackageKey', pkg.stable_package_key)
  );

  event_id := rybex_internal.append_domain_event(
    pkg.workspace_id,
    pkg.project_id,
    'billing_backup_package',
    pkg.id,
    pkg.version,
    'billing_v2.' || p_action,
    1,
    p_command_id,
    correlation,
    actor,
    jsonb_build_object('status', pkg.status, 'packageKey', pkg.stable_package_key)
  );

  after_payload := after_payload || jsonb_build_object('auditEventId', audit_id, 'domainEventId', event_id);
  perform rybex_internal.complete_command(pkg.workspace_id, p_command_id, after_payload);
  return after_payload;
end;
$$;

create or replace function public.billing_v2_get_package_v1(p_stable_package_key text default 'billing-v2-package-bb-lake-001')
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  resolved_workspace_id uuid;
  pkg_id uuid;
begin
  resolved_workspace_id := rybex_internal.billing_v2_active_workspace();
  if resolved_workspace_id is null and actor is not null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;

  if resolved_workspace_id is null then
    select id into resolved_workspace_id from workspaces where slug = 'workspace-a' or name = 'Workspace A' order by created_at limit 1;
  end if;

  select id into pkg_id
  from billing_backup_packages
  where billing_backup_packages.workspace_id = resolved_workspace_id
    and stable_package_key = coalesce(nullif(p_stable_package_key, ''), 'billing-v2-package-bb-lake-001');

  if pkg_id is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if actor is not null and not public.can_access_project((select project_id from billing_backup_packages where id = pkg_id)) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  return rybex_internal.billing_v2_package_payload(pkg_id);
end;
$$;

create or replace function public.billing_v2_seed_fixture_v1(p_reset boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  fixture_workspace_id uuid := '10000000-0000-4000-8000-000000000001'::uuid;
  fixture_project_id uuid := '30000000-0000-4000-8000-000000000001'::uuid;
  actor uuid;
  pkg_id uuid;
begin
  if not exists (select 1 from workspaces where id = fixture_workspace_id) then
    return jsonb_build_object('success', false, 'error', 'missing_workspace_fixture');
  end if;
  if not exists (select 1 from projects where id = fixture_project_id) then
    return jsonb_build_object('success', false, 'error', 'missing_project_fixture');
  end if;

  select user_id into actor from user_profiles where email = 'billing-a@foundation0a.local' limit 1;
  if actor is null then
    select user_id into actor from user_profiles where email = 'admin-a@foundation0a.local' limit 1;
  end if;

  if p_reset then
    delete from billing_backup_packages
    where billing_backup_packages.workspace_id = fixture_workspace_id
      and stable_package_key = 'billing-v2-package-bb-lake-001';
  end if;

  insert into billing_backup_packages (
    workspace_id,
    project_id,
    stable_package_key,
    pay_application_key,
    pay_application_label,
    backup_item_key,
    commercial_exposure_key,
    title,
    blocker_reason,
    owner_label,
    reviewer_role,
    status,
    blocked_amount,
    currency,
    created_by,
    updated_by
  )
  values (
    fixture_workspace_id,
    fixture_project_id,
    'billing-v2-package-bb-lake-001',
    'pay-lake-001',
    'PA-001',
    'bb-lake-001',
    'cexp-008',
    'Vault and handhole product approval backup package',
    'PA-001 is blocked because required vault and handhole product backup is missing or incomplete.',
    'Billing Lead',
    'Commercial Review',
    'blocked',
    38500,
    'USD',
    actor,
    actor
  )
  on conflict (workspace_id, stable_package_key) do update
  set status = 'blocked',
      backup_summary = null,
      related_source_record = null,
      related_source_record_type = null,
      amount_affected = null,
      review_note = null,
      resolution_note = null,
      current_review_task_id = null,
      blocker_resolution_id = null,
      version = 1,
      started_at = null,
      cleared_at = null,
      updated_by = actor,
      updated_at = now()
  returning id into pkg_id;

  delete from billing_backup_requirements where package_id = pkg_id;
  delete from billing_commercial_reviews where package_id = pkg_id;
  delete from billing_review_decisions where package_id = pkg_id;
  delete from billing_blocker_clearances where package_id = pkg_id;

  insert into billing_backup_requirements (
    workspace_id,
    project_id,
    package_id,
    stable_requirement_key,
    label,
    description,
    required,
    waiver_allowed,
    status
  )
  values
    (fixture_workspace_id, fixture_project_id, pkg_id, 'daily-report-reference', 'Daily report reference', 'Reference the daily report that supports the stored material or installed work.', true, false, 'missing'),
    (fixture_workspace_id, fixture_project_id, pkg_id, 'photo-log-reference', 'Photo log reference', 'Attach or reference the field photo log supporting the pay application backup.', true, false, 'missing'),
    (fixture_workspace_id, fixture_project_id, pkg_id, 'product-approval-backup', 'Product approval backup', 'Provide the vault and handhole product approval backup.', true, false, 'missing'),
    (fixture_workspace_id, fixture_project_id, pkg_id, 'signed-tm-ticket', 'Signed T&M ticket', 'Provide the signed ticket for the affected work.', true, false, 'missing'),
    (fixture_workspace_id, fixture_project_id, pkg_id, 'supervisor-confirmation', 'Supervisor confirmation', 'Confirm the package is complete for commercial review.', true, false, 'missing'),
    (fixture_workspace_id, fixture_project_id, pkg_id, 'related-change-event', 'Related change event', 'Reference related commercial exposure when applicable.', false, true, 'not_required');

  return rybex_internal.billing_v2_package_payload(pkg_id);
end;
$$;

create or replace function public.billing_v2_start_package_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command('start', p_stable_package_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.billing_v2_save_package_details_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_backup_summary text,
  p_related_source_record text,
  p_amount_affected numeric,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command(
    'save_details',
    p_stable_package_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('backupSummary', p_backup_summary, 'relatedSourceRecord', p_related_source_record, 'amountAffected', p_amount_affected),
    p_correlation_id
  )
$$;

create or replace function public.billing_v2_attach_evidence_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_requirement_key text,
  p_evidence_id uuid default null,
  p_reference_text text default null,
  p_reference_type text default 'document_reference',
  p_waiver_reason text default null,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command(
    'attach_evidence',
    p_stable_package_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('requirementKey', p_requirement_key, 'evidenceId', p_evidence_id, 'referenceText', p_reference_text, 'referenceType', p_reference_type, 'waiverReason', p_waiver_reason),
    p_correlation_id
  )
$$;

create or replace function public.billing_v2_validate_readiness_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command('validate_readiness', p_stable_package_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.billing_v2_submit_review_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_assigned_role text,
  p_due_date text default null,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command(
    'submit_review',
    p_stable_package_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('assignedRole', p_assigned_role, 'dueDate', p_due_date),
    p_correlation_id
  )
$$;

create or replace function public.billing_v2_record_decision_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_decision text,
  p_decision_note text,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command(
    'record_decision',
    p_stable_package_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('decision', p_decision, 'decisionNote', p_decision_note),
    p_correlation_id
  )
$$;

create or replace function public.billing_v2_clear_blocker_v1(
  p_stable_package_key text,
  p_command_id text,
  p_expected_version integer,
  p_resolution_note text,
  p_correlation_id text default null
)
returns jsonb
language sql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
  select rybex_internal.billing_v2_apply_command(
    'clear_blocker',
    p_stable_package_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('resolutionNote', p_resolution_note),
    p_correlation_id
  )
$$;

grant execute on function public.billing_v2_get_package_v1(text) to authenticated, service_role;
grant execute on function public.billing_v2_start_package_v1(text, text, integer, text) to authenticated;
grant execute on function public.billing_v2_save_package_details_v1(text, text, integer, text, text, numeric, text) to authenticated;
grant execute on function public.billing_v2_attach_evidence_v1(text, text, integer, text, uuid, text, text, text, text) to authenticated;
grant execute on function public.billing_v2_validate_readiness_v1(text, text, integer, text) to authenticated;
grant execute on function public.billing_v2_submit_review_v1(text, text, integer, text, text, text) to authenticated;
grant execute on function public.billing_v2_record_decision_v1(text, text, integer, text, text, text) to authenticated;
grant execute on function public.billing_v2_clear_blocker_v1(text, text, integer, text, text) to authenticated;
grant execute on function public.billing_v2_seed_fixture_v1(boolean) to service_role;

revoke all on function rybex_internal.billing_v2_active_workspace() from public;
revoke all on function rybex_internal.billing_v2_readiness(uuid) from public;
revoke all on function rybex_internal.billing_v2_package_payload(uuid) from public;
revoke all on function rybex_internal.billing_v2_apply_command(text, text, text, integer, jsonb, text) from public;
