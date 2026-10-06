-- Foundation 0E - Closeout Production Persistence
--
-- Scope:
-- - Domain-specific persistence for the current Closeout Final Billing Release reference slice.
-- - Authenticated command RPCs with idempotency, optimistic concurrency, audit/domain events,
--   managed evidence linkage, RLS, and semantically safe final-billing/retainage projection.
-- - Does not implement payment recording, external closeout portals, or Foundation 0F cutover.

create table if not exists closeout_release_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  stable_case_key text not null,
  closeout_package_key text not null,
  closeout_package_number text not null,
  linked_pay_application_key text not null,
  linked_retainage_item_key text not null,
  linked_commercial_exposure_key text not null,
  requirement_summary text not null,
  owner_label text not null,
  finance_owner_label text not null,
  due_date date not null,
  retainage_exposure_amount numeric(14, 2) not null,
  status text not null default 'unresolved',
  assessment_summary text,
  acceptance_status text,
  punch_status text,
  test_evidence_status text,
  as_built_redline_status text,
  closeout_document_status text,
  final_billing_release_status text,
  resolution_note text,
  current_review_id uuid,
  blocker_clearance_id uuid,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  assessed_by uuid references auth.users(id) on delete restrict,
  resolved_by uuid references auth.users(id) on delete restrict,
  assessed_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, stable_case_key),
  constraint closeout_release_cases_status_check check (
    status in ('unresolved','in_progress','assessed','evidence_added','ready_for_review','review_pending','approved','rejected','resolved')
  ),
  constraint closeout_release_cases_amount_check check (retainage_exposure_amount >= 0),
  constraint closeout_release_cases_evidence_status_check check (
    (acceptance_status is null or acceptance_status in ('missing','in_progress','accepted')) and
    (punch_status is null or punch_status in ('missing','in_progress','accepted')) and
    (test_evidence_status is null or test_evidence_status in ('missing','in_progress','accepted')) and
    (as_built_redline_status is null or as_built_redline_status in ('missing','in_progress','accepted')) and
    (closeout_document_status is null or closeout_document_status in ('missing','in_progress','accepted')) and
    (final_billing_release_status is null or final_billing_release_status in ('blocked','ready','released'))
  )
);

create table if not exists closeout_requirements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  case_id uuid not null references closeout_release_cases(id) on delete cascade,
  stable_requirement_key text not null,
  label text not null,
  description text not null,
  required boolean not null default true,
  status text not null default 'missing',
  version integer not null default 1,
  completed_by uuid references auth.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, stable_requirement_key),
  constraint closeout_requirements_status_check check (status in ('missing','attached','accepted'))
);

create table if not exists closeout_evidence_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  case_id uuid not null references closeout_release_cases(id) on delete cascade,
  requirement_id uuid not null references closeout_requirements(id) on delete cascade,
  requirement_key text not null,
  reference_type text,
  reference_text text,
  evidence_object_id uuid references evidence_objects(id) on delete set null,
  attached_by uuid references auth.users(id) on delete restrict,
  attached_at timestamptz not null default now(),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, requirement_key, evidence_object_id),
  constraint closeout_evidence_reference_type_check check (
    reference_type is null or reference_type in ('acceptance_record','punch_photo','test_record','as_built','lien_waiver','billing_reference')
  )
);

create table if not exists closeout_readiness_validations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  case_id uuid not null references closeout_release_cases(id) on delete cascade,
  result_status text not null,
  missing_items jsonb not null default '[]'::jsonb,
  validated_by uuid not null references auth.users(id) on delete restrict,
  validated_at timestamptz not null default now(),
  constraint closeout_readiness_result_check check (result_status in ('ready','not_ready'))
);

create table if not exists closeout_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  case_id uuid not null references closeout_release_cases(id) on delete cascade,
  assigned_role text not null,
  status text not null default 'pending',
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint closeout_reviews_status_check check (status in ('pending','approved','rejected','cancelled'))
);

create table if not exists closeout_review_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  case_id uuid not null references closeout_release_cases(id) on delete cascade,
  review_id uuid references closeout_reviews(id) on delete set null,
  decision text not null,
  decision_note text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  constraint closeout_review_decisions_decision_check check (decision in ('approved','rejected'))
);

create table if not exists closeout_blocker_clearances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  case_id uuid not null references closeout_release_cases(id) on delete cascade,
  decision_id uuid references closeout_review_decisions(id) on delete set null,
  resolution_note text not null,
  cleared_by uuid not null references auth.users(id) on delete restrict,
  cleared_at timestamptz not null default now(),
  unique (case_id)
);

create table if not exists final_billing_retainage_projections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  closeout_case_id uuid not null references closeout_release_cases(id) on delete cascade,
  linked_pay_application_key text not null,
  linked_retainage_item_key text not null,
  linked_commercial_exposure_key text not null,
  retainage_exposure_amount numeric(14, 2) not null,
  closeout_status text not null default 'blocked',
  final_billing_status text not null default 'blocked',
  retainage_status text not null default 'blocked',
  payment_status text not null default 'not_recorded',
  commercial_state text not null default 'closeout_restriction_open',
  message text not null,
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (closeout_case_id),
  constraint final_billing_projection_status_check check (
    closeout_status in ('blocked','release_approved') and
    final_billing_status in ('blocked','ready_for_processing') and
    retainage_status in ('blocked','release_approved') and
    payment_status in ('not_recorded','recorded') and
    commercial_state in ('closeout_restriction_open','closeout_restriction_cleared')
  )
);

create trigger set_closeout_release_cases_updated_at before update on closeout_release_cases for each row execute function set_updated_at();
create trigger set_closeout_requirements_updated_at before update on closeout_requirements for each row execute function set_updated_at();
create trigger set_closeout_evidence_references_updated_at before update on closeout_evidence_references for each row execute function set_updated_at();
create trigger set_closeout_reviews_updated_at before update on closeout_reviews for each row execute function set_updated_at();
create trigger set_final_billing_retainage_projections_updated_at before update on final_billing_retainage_projections for each row execute function set_updated_at();

create index if not exists closeout_release_cases_workspace_status_idx on closeout_release_cases(workspace_id, status);
create index if not exists closeout_release_cases_project_status_idx on closeout_release_cases(workspace_id, project_id, status);
create index if not exists closeout_requirements_case_idx on closeout_requirements(case_id);
create index if not exists closeout_evidence_case_idx on closeout_evidence_references(case_id);
create index if not exists closeout_reviews_case_idx on closeout_reviews(case_id, submitted_at desc);
create index if not exists closeout_review_decisions_case_idx on closeout_review_decisions(case_id, decided_at desc);
create index if not exists final_billing_projection_case_idx on final_billing_retainage_projections(closeout_case_id);

grant select on closeout_release_cases, closeout_requirements, closeout_evidence_references, closeout_readiness_validations, closeout_reviews, closeout_review_decisions, closeout_blocker_clearances, final_billing_retainage_projections to authenticated, service_role;
grant insert, update, delete on closeout_release_cases, closeout_requirements, closeout_evidence_references, closeout_readiness_validations, closeout_reviews, closeout_review_decisions, closeout_blocker_clearances, final_billing_retainage_projections to service_role;

alter table closeout_release_cases enable row level security;
alter table closeout_requirements enable row level security;
alter table closeout_evidence_references enable row level security;
alter table closeout_readiness_validations enable row level security;
alter table closeout_reviews enable row level security;
alter table closeout_review_decisions enable row level security;
alter table closeout_blocker_clearances enable row level security;
alter table final_billing_retainage_projections enable row level security;

drop policy if exists closeout_release_cases_select_authorized on closeout_release_cases;
create policy closeout_release_cases_select_authorized on closeout_release_cases for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists closeout_requirements_select_authorized on closeout_requirements;
create policy closeout_requirements_select_authorized on closeout_requirements for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists closeout_evidence_select_authorized on closeout_evidence_references;
create policy closeout_evidence_select_authorized on closeout_evidence_references for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists closeout_readiness_select_authorized on closeout_readiness_validations;
create policy closeout_readiness_select_authorized on closeout_readiness_validations for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists closeout_reviews_select_authorized on closeout_reviews;
create policy closeout_reviews_select_authorized on closeout_reviews for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists closeout_decisions_select_authorized on closeout_review_decisions;
create policy closeout_decisions_select_authorized on closeout_review_decisions for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists closeout_clearances_select_authorized on closeout_blocker_clearances;
create policy closeout_clearances_select_authorized on closeout_blocker_clearances for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists final_billing_projection_select_authorized on final_billing_retainage_projections;
create policy final_billing_projection_select_authorized on final_billing_retainage_projections for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists closeout_release_cases_no_direct_mutation on closeout_release_cases;
create policy closeout_release_cases_no_direct_mutation on closeout_release_cases for all to authenticated using (false) with check (false);
drop policy if exists closeout_requirements_no_direct_mutation on closeout_requirements;
create policy closeout_requirements_no_direct_mutation on closeout_requirements for all to authenticated using (false) with check (false);
drop policy if exists closeout_evidence_no_direct_mutation on closeout_evidence_references;
create policy closeout_evidence_no_direct_mutation on closeout_evidence_references for all to authenticated using (false) with check (false);
drop policy if exists closeout_readiness_no_direct_mutation on closeout_readiness_validations;
create policy closeout_readiness_no_direct_mutation on closeout_readiness_validations for all to authenticated using (false) with check (false);
drop policy if exists closeout_reviews_no_direct_mutation on closeout_reviews;
create policy closeout_reviews_no_direct_mutation on closeout_reviews for all to authenticated using (false) with check (false);
drop policy if exists closeout_decisions_no_direct_mutation on closeout_review_decisions;
create policy closeout_decisions_no_direct_mutation on closeout_review_decisions for all to authenticated using (false) with check (false);
drop policy if exists closeout_clearances_no_direct_mutation on closeout_blocker_clearances;
create policy closeout_clearances_no_direct_mutation on closeout_blocker_clearances for all to authenticated using (false) with check (false);
drop policy if exists final_billing_projection_no_direct_mutation on final_billing_retainage_projections;
create policy final_billing_projection_no_direct_mutation on final_billing_retainage_projections for all to authenticated using (false) with check (false);

create or replace function rybex_internal.closeout_active_workspace()
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

  select up.active_workspace_id into workspace_id
  from user_profiles up
  where up.user_id = actor
    and up.status = 'active'
  limit 1;

  if workspace_id is null then
    select wm.workspace_id into workspace_id
    from workspace_memberships wm
    where wm.user_id = actor
      and wm.status = 'active'
    limit 1;
  end if;

  return workspace_id;
end;
$$;

create or replace function rybex_internal.closeout_readiness(case_uuid uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  c closeout_release_cases%rowtype;
  has_assessment boolean;
  required_count integer;
  complete_count integer;
  approved boolean;
  missing text[];
begin
  select * into c from closeout_release_cases where id = case_uuid;
  if not found then
    return jsonb_build_object('assessmentComplete', false, 'evidenceComplete', false, 'readyForReview', false, 'approvedForRelease', false, 'resolutionReady', false, 'missing', array['Closeout case']);
  end if;

  has_assessment := c.assessment_summary is not null;
  select count(*), count(*) filter (where status in ('attached','accepted'))
  into required_count, complete_count
  from closeout_requirements
  where case_id = c.id
    and required;

  approved := exists(select 1 from closeout_reviews where case_id = c.id and status = 'approved');
  missing := array_remove(array[
    case when not has_assessment then 'Closeout requirement assessment' end,
    case when required_count = 0 or complete_count < required_count then 'Required closeout evidence' end,
    case when c.status = 'rejected' then 'Approved closeout release review' end
  ], null);

  return jsonb_build_object(
    'assessmentComplete', has_assessment,
    'evidenceComplete', required_count > 0 and complete_count = required_count,
    'readyForReview', has_assessment and required_count > 0 and complete_count = required_count and c.status <> 'rejected',
    'approvedForRelease', approved,
    'resolutionReady', has_assessment and required_count > 0 and complete_count = required_count and approved and c.status <> 'resolved',
    'missing', coalesce(to_jsonb(missing), '[]'::jsonb)
  );
end;
$$;

create or replace function rybex_internal.closeout_payload(case_uuid uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  c closeout_release_cases%rowtype;
  projection final_billing_retainage_projections%rowtype;
  review closeout_reviews%rowtype;
  decision closeout_review_decisions%rowtype;
  clearance closeout_blocker_clearances%rowtype;
  requirements jsonb;
  references_json jsonb;
  history jsonb;
  readiness jsonb;
begin
  select * into c from closeout_release_cases where id = case_uuid;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  select * into projection from final_billing_retainage_projections where closeout_case_id = c.id limit 1;
  select * into review from closeout_reviews where case_id = c.id order by submitted_at desc limit 1;
  select * into decision from closeout_review_decisions where case_id = c.id order by decided_at desc limit 1;
  select * into clearance from closeout_blocker_clearances where case_id = c.id limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', stable_requirement_key,
    'label', label,
    'description', description,
    'required', required,
    'status', case when status in ('attached','accepted') then 'attached' else 'missing' end
  ) order by stable_requirement_key), '[]'::jsonb)
  into requirements
  from closeout_requirements
  where case_id = c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id::text,
    'requirementId', requirement_key,
    'referenceText', coalesce(reference_text, evidence_object_id::text),
    'referenceType', coalesce(reference_type, 'billing_reference'),
    'actorId', attached_by::text,
    'createdAt', attached_at
  ) order by attached_at), '[]'::jsonb)
  into references_json
  from closeout_evidence_references
  where case_id = c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id::text,
    'type', replace(event_type, 'closeout.', ''),
    'actorId', actor_user_id::text,
    'message', coalesce(payload->>'message', event_type),
    'createdAt', occurred_at
  ) order by occurred_at), '[]'::jsonb)
  into history
  from domain_events
  where aggregate_type = 'closeout_release_case'
    and aggregate_id = c.id;

  readiness := rybex_internal.closeout_readiness(c.id);

  return jsonb_build_object(
    'success', true,
    'ok', true,
    'message', 'Closeout database state loaded.',
    'events', '[]'::jsonb,
    'blocker', jsonb_build_object(
      'id', c.stable_case_key,
      'projectId', c.project_id::text,
      'projectName', 'Regional Broadband Restoration Package',
      'closeoutPackageId', c.closeout_package_key,
      'closeoutPackageNumber', c.closeout_package_number,
      'linkedPayApplicationId', c.linked_pay_application_key,
      'linkedRetainageItemId', c.linked_retainage_item_key,
      'linkedCommercialExposureId', c.linked_commercial_exposure_key,
      'requirementSummary', c.requirement_summary,
      'owner', c.owner_label,
      'financeOwner', c.finance_owner_label,
      'dueDate', c.due_date::text,
      'retainageExposureAmount', c.retainage_exposure_amount,
      'state', c.status,
      'assessment', case when c.assessment_summary is null then null else jsonb_build_object(
        'acceptanceStatus', c.acceptance_status,
        'punchStatus', c.punch_status,
        'testEvidenceStatus', c.test_evidence_status,
        'asBuiltRedlineStatus', c.as_built_redline_status,
        'closeoutDocumentStatus', c.closeout_document_status,
        'finalBillingReleaseStatus', c.final_billing_release_status,
        'assessmentSummary', c.assessment_summary,
        'assessedBy', c.assessed_by::text,
        'assessedAt', c.assessed_at
      ) end,
      'evidenceRequirements', requirements,
      'evidenceReferences', references_json,
      'review', case when review.id is null then null else jsonb_build_object(
        'id', review.id::text,
        'status', review.status,
        'assignedRole', review.assigned_role,
        'submittedBy', review.submitted_by::text,
        'submittedAt', review.submitted_at,
        'decidedBy', decision.reviewer_id::text,
        'decidedAt', decision.decided_at,
        'decisionNote', decision.decision_note
      ) end,
      'resolutionNote', c.resolution_note,
      'billingProjection', jsonb_build_object(
        'payApplicationId', projection.linked_pay_application_key,
        'lienWaiverIds', jsonb_build_array('lw-blue-001','lw-blue-002'),
        'commercialExposureId', projection.linked_commercial_exposure_key,
        'retainageExposureAmount', projection.retainage_exposure_amount,
        'status', case when projection.closeout_status = 'release_approved' then 'approved_for_processing' else 'blocked' end,
        'message', projection.message,
        'finalBillingStatus', projection.final_billing_status,
        'retainageStatus', projection.retainage_status,
        'paymentStatus', projection.payment_status,
        'commercialState', projection.commercial_state
      ),
      'outcomeRecord', case when clearance.id is null then null else jsonb_build_object(
        'id', 'closeout-outcome-' || c.stable_case_key,
        'outcome', 'Closeout final billing release approved; final billing and retainage blocker cleared.',
        'resolvedBy', clearance.cleared_by::text,
        'resolvedAt', clearance.cleared_at,
        'resolutionNote', clearance.resolution_note,
        'billingProjection', jsonb_build_object(
          'payApplicationId', projection.linked_pay_application_key,
          'lienWaiverIds', jsonb_build_array('lw-blue-001','lw-blue-002'),
          'commercialExposureId', projection.linked_commercial_exposure_key,
          'retainageExposureAmount', projection.retainage_exposure_amount,
          'status', 'approved_for_processing',
          'message', projection.message
        )
      ) end,
      'history', history,
      'createdAt', c.created_at,
      'updatedAt', c.updated_at,
      'databaseBacked', true,
      'storageMode', 'database',
      'version', c.version
    ),
    'readiness', readiness,
    'impact', jsonb_build_object(
      'openBlockerCount', case when c.status = 'resolved' then 0 else 1 end,
      'resolvedBlockerCount', case when c.status = 'resolved' then 1 else 0 end,
      'retainageAtRisk', case when c.status = 'resolved' then 0 else c.retainage_exposure_amount end,
      'samePrimaryBlockerResolved', c.status = 'resolved',
      'billingProjectionStatus', case when projection.closeout_status = 'release_approved' then 'approved_for_processing' else 'blocked' end
    ),
    'storageLabel', 'Database-backed',
    'resultingVersion', c.version
  );
end;
$$;

create or replace function rybex_internal.closeout_apply_command(
  p_action text,
  p_stable_case_key text,
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
  c closeout_release_cases%rowtype;
  requirement closeout_requirements%rowtype;
  evidence evidence_objects%rowtype;
  review_id uuid;
  decision_id uuid;
  clearance_id uuid;
  before_values jsonb;
  after_payload jsonb;
  existing command_idempotency%rowtype;
  request_hash text;
  correlation text := coalesce(nullif(p_correlation_id, ''), gen_random_uuid()::text);
  readiness jsonb;
  audit_id uuid;
  event_id uuid;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  resolved_workspace_id := rybex_internal.closeout_active_workspace();
  if resolved_workspace_id is null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;

  role := public.current_workspace_role(resolved_workspace_id);
  if role is null then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select * into c
  from closeout_release_cases
  where workspace_id = resolved_workspace_id
    and stable_case_key = coalesce(nullif(p_stable_case_key, ''), 'closeout-final-billing-lake-001')
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.can_access_project(c.project_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_action in ('start','save_assessment','attach_evidence','validate_readiness','submit_review')
     and role not in ('admin','operations_leader','project_manager','closeout_lead') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_action in ('record_decision','clear_blocker')
     and role not in ('admin','operations_leader','closeout_lead') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  request_hash := encode(extensions.digest(
    convert_to(resolved_workspace_id::text || '|' || c.id::text || '|' || p_action || '|' || coalesce(p_expected_version::text, '') || '|' || coalesce(p_payload::text, '{}'), 'UTF8'),
    'sha256'
  ), 'hex');

  select * into existing
  from command_idempotency
  where workspace_id = resolved_workspace_id
    and command_id = p_command_id
  limit 1;

  if found then
    if existing.request_hash <> request_hash then
      return jsonb_build_object('success', false, 'error', 'idempotency_conflict');
    end if;
    if existing.result_status = 'completed' then
      return coalesce(existing.result_payload, '{}'::jsonb) || jsonb_build_object('replayed', true);
    end if;
    return jsonb_build_object('success', false, 'error', 'command_in_progress');
  end if;

  if p_expected_version is not null and c.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', c.version);
  end if;

  insert into command_idempotency (
    workspace_id,
    command_id,
    command_type,
    entity_type,
    entity_id,
    request_hash,
    result_status,
    actor_user_id,
    correlation_id
  )
  values (
    resolved_workspace_id,
    p_command_id,
    'closeout.' || p_action,
    'closeout_release_case',
    c.id,
    request_hash,
    'in_progress',
    actor,
    correlation
  );

  before_values := jsonb_build_object('status', c.status, 'version', c.version);

  if p_action = 'start' then
    if c.status = 'resolved' then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if c.status <> 'unresolved' then
      update closeout_release_cases set updated_by = actor, version = version + 1 where id = c.id returning * into c;
    else
      update closeout_release_cases
      set status = 'in_progress', started_at = now(), updated_by = actor, version = version + 1
      where id = c.id returning * into c;
    end if;

  elsif p_action = 'save_assessment' then
    if c.status in ('unresolved','resolved') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if nullif(trim(p_payload->>'assessmentSummary'), '') is null then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    update closeout_release_cases
    set status = 'assessed',
        acceptance_status = p_payload->>'acceptanceStatus',
        punch_status = p_payload->>'punchStatus',
        test_evidence_status = p_payload->>'testEvidenceStatus',
        as_built_redline_status = p_payload->>'asBuiltRedlineStatus',
        closeout_document_status = p_payload->>'closeoutDocumentStatus',
        final_billing_release_status = p_payload->>'finalBillingReleaseStatus',
        assessment_summary = trim(p_payload->>'assessmentSummary'),
        assessed_by = actor,
        assessed_at = now(),
        updated_by = actor,
        version = version + 1
    where id = c.id returning * into c;

  elsif p_action = 'attach_evidence' then
    if c.status in ('unresolved','resolved') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if c.assessment_summary is null then
      return jsonb_build_object('success', false, 'error', 'assessment_required');
    end if;
    select * into requirement
    from closeout_requirements
    where case_id = c.id
      and stable_requirement_key = p_payload->>'requirementKey'
    for update;
    if not found then
      return jsonb_build_object('success', false, 'error', 'requirement_not_found');
    end if;
    select * into evidence
    from evidence_objects
    where id = (p_payload->>'evidenceId')::uuid
      and workspace_id = c.workspace_id
      and project_id = c.project_id
      and upload_status = 'uploaded'
      and scan_status not in ('quarantined','failed');
    if not found then
      return jsonb_build_object('success', false, 'error', 'evidence_required');
    end if;
    insert into evidence_links (
      workspace_id, project_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
    )
    values (
      c.workspace_id, c.project_id, evidence.id, 'closeout_requirement', requirement.id, 'closeout_evidence', actor
    )
    on conflict (workspace_id, evidence_object_id, entity_type, entity_id, relationship_type) do nothing;

    insert into closeout_evidence_references (
      workspace_id, project_id, case_id, requirement_id, requirement_key, reference_type, reference_text, evidence_object_id, attached_by
    )
    values (
      c.workspace_id, c.project_id, c.id, requirement.id, requirement.stable_requirement_key,
      coalesce(nullif(p_payload->>'referenceType', ''), 'billing_reference'),
      coalesce(nullif(trim(p_payload->>'referenceText'), ''), evidence.original_filename),
      evidence.id,
      actor
    )
    on conflict (case_id, requirement_key, evidence_object_id) do update
    set reference_text = excluded.reference_text,
        reference_type = excluded.reference_type,
        attached_by = excluded.attached_by,
        attached_at = now(),
        version = closeout_evidence_references.version + 1;

    update closeout_requirements
    set status = 'attached',
        completed_by = actor,
        completed_at = now(),
        version = version + 1
    where id = requirement.id;

    update closeout_release_cases
    set status = 'evidence_added', updated_by = actor, version = version + 1
    where id = c.id returning * into c;

  elsif p_action = 'validate_readiness' then
    if c.status in ('unresolved','resolved') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    readiness := rybex_internal.closeout_readiness(c.id);
    if coalesce((readiness->>'readyForReview')::boolean, false) = false then
      insert into closeout_readiness_validations (
        workspace_id, project_id, case_id, result_status, missing_items, validated_by
      ) values (
        c.workspace_id, c.project_id, c.id, 'not_ready', readiness->'missing', actor
      );
      return jsonb_build_object('success', false, 'error', 'not_ready', 'readiness', readiness);
    end if;
    insert into closeout_readiness_validations (
      workspace_id, project_id, case_id, result_status, missing_items, validated_by
    ) values (
      c.workspace_id, c.project_id, c.id, 'ready', '[]'::jsonb, actor
    );
    update closeout_release_cases
    set status = 'ready_for_review', updated_by = actor, version = version + 1
    where id = c.id returning * into c;

  elsif p_action = 'submit_review' then
    if c.status <> 'ready_for_review' then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    insert into closeout_reviews (
      workspace_id, project_id, case_id, assigned_role, submitted_by
    ) values (
      c.workspace_id, c.project_id, c.id, coalesce(nullif(p_payload->>'assignedRole', ''), 'Closeout Finance Review'), actor
    ) returning id into review_id;
    update closeout_release_cases
    set status = 'review_pending', current_review_id = review_id, updated_by = actor, version = version + 1
    where id = c.id returning * into c;

  elsif p_action = 'record_decision' then
    if c.status <> 'review_pending' or c.current_review_id is null then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if (p_payload->>'decision') not in ('approved','rejected') or nullif(trim(p_payload->>'decisionNote'), '') is null then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    insert into closeout_review_decisions (
      workspace_id, project_id, case_id, review_id, decision, decision_note, reviewer_id
    ) values (
      c.workspace_id, c.project_id, c.id, c.current_review_id, p_payload->>'decision', trim(p_payload->>'decisionNote'), actor
    ) returning id into decision_id;
    update closeout_reviews
    set status = p_payload->>'decision', version = version + 1
    where id = c.current_review_id;
    update closeout_release_cases
    set status = case when p_payload->>'decision' = 'approved' then 'approved' else 'rejected' end,
        updated_by = actor,
        version = version + 1
    where id = c.id returning * into c;

  elsif p_action = 'clear_blocker' then
    readiness := rybex_internal.closeout_readiness(c.id);
    if c.status <> 'approved' or coalesce((readiness->>'approvedForRelease')::boolean, false) = false then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if nullif(trim(p_payload->>'resolutionNote'), '') is null then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    select id into decision_id from closeout_review_decisions where case_id = c.id and decision = 'approved' order by decided_at desc limit 1;
    insert into closeout_blocker_clearances (
      workspace_id, project_id, case_id, decision_id, resolution_note, cleared_by
    ) values (
      c.workspace_id, c.project_id, c.id, decision_id, trim(p_payload->>'resolutionNote'), actor
    )
    on conflict (case_id) do update
    set decision_id = excluded.decision_id,
        resolution_note = excluded.resolution_note,
        cleared_by = excluded.cleared_by,
        cleared_at = now()
    returning id into clearance_id;

    update final_billing_retainage_projections
    set closeout_status = 'release_approved',
        final_billing_status = 'ready_for_processing',
        retainage_status = 'release_approved',
        payment_status = 'not_recorded',
        commercial_state = 'closeout_restriction_cleared',
        message = 'Closeout-linked final billing and retainage are unblocked for processing. Payment has not yet been recorded.',
        updated_by = actor,
        version = version + 1
    where closeout_case_id = c.id;

    if not found then
      return jsonb_build_object('success', false, 'error', 'projection_update_failed');
    end if;

    update closeout_release_cases
    set status = 'resolved',
        blocker_clearance_id = clearance_id,
        resolution_note = trim(p_payload->>'resolutionNote'),
        resolved_by = actor,
        resolved_at = now(),
        updated_by = actor,
        version = version + 1
    where id = c.id returning * into c;
  else
    return jsonb_build_object('success', false, 'error', 'unsupported_action');
  end if;

  after_payload := rybex_internal.closeout_payload(c.id)
    || jsonb_build_object(
      'message', 'Closeout database command completed.',
      'events', jsonb_build_array(jsonb_build_object('type', 'closeout_' || p_action, 'toState', c.status)),
      'replayed', false,
      'resultingVersion', c.version,
      'correlationId', correlation
    );

  audit_id := rybex_internal.append_audit_event(
    c.workspace_id,
    c.project_id,
    'closeout_release_case',
    c.id,
    p_command_id,
    'closeout.' || p_action,
    before_values->>'status',
    c.status,
    actor,
    correlation,
    before_values,
    jsonb_build_object('status', c.status, 'version', c.version),
    jsonb_build_object('foundationIncrement', '0E', 'caseKey', c.stable_case_key)
  );

  event_id := rybex_internal.append_domain_event(
    c.workspace_id,
    c.project_id,
    'closeout_release_case',
    c.id,
    c.version,
    'closeout.' || p_action,
    1,
    p_command_id,
    correlation,
    actor,
    jsonb_build_object(
      'status', c.status,
      'caseKey', c.stable_case_key,
      'message', 'Closeout ' || replace(p_action, '_', ' ') || ' completed.'
    )
  );

  after_payload := after_payload || jsonb_build_object('auditEventId', audit_id, 'domainEventId', event_id);
  perform rybex_internal.complete_command(c.workspace_id, p_command_id, after_payload);
  return after_payload;
end;
$$;

create or replace function public.closeout_get_state_v1(p_stable_case_key text default 'closeout-final-billing-lake-001')
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  resolved_workspace_id uuid;
  case_uuid uuid;
begin
  resolved_workspace_id := rybex_internal.closeout_active_workspace();
  if resolved_workspace_id is null and actor is not null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;
  if resolved_workspace_id is null then
    select id into resolved_workspace_id from workspaces where slug = 'workspace-a' or name = 'Workspace A' order by created_at limit 1;
  end if;

  select id into case_uuid
  from closeout_release_cases
  where workspace_id = resolved_workspace_id
    and stable_case_key = coalesce(nullif(p_stable_case_key, ''), 'closeout-final-billing-lake-001');

  if case_uuid is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if actor is not null and not public.can_access_project((select project_id from closeout_release_cases where id = case_uuid)) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  return rybex_internal.closeout_payload(case_uuid);
end;
$$;

create or replace function public.closeout_seed_fixture_v1(p_reset boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  fixture_workspace_id uuid := '10000000-0000-4000-8000-000000000001'::uuid;
  fixture_project_id uuid := '30000000-0000-4000-8000-000000000001'::uuid;
  actor uuid;
  case_uuid uuid;
begin
  if not exists (select 1 from workspaces where id = fixture_workspace_id) then
    return jsonb_build_object('success', false, 'error', 'missing_workspace_fixture');
  end if;
  if not exists (select 1 from projects where id = fixture_project_id) then
    return jsonb_build_object('success', false, 'error', 'missing_project_fixture');
  end if;
  select user_id into actor from user_profiles where email = 'closeout-a@foundation0a.local' limit 1;
  if actor is null then
    select user_id into actor from user_profiles where email = 'admin-a@foundation0a.local' limit 1;
  end if;

  if p_reset then
    delete from closeout_release_cases
    where workspace_id = fixture_workspace_id
      and stable_case_key = 'closeout-final-billing-lake-001';
  end if;

  insert into closeout_release_cases (
    workspace_id, project_id, stable_case_key, closeout_package_key, closeout_package_number,
    linked_pay_application_key, linked_retainage_item_key, linked_commercial_exposure_key,
    requirement_summary, owner_label, finance_owner_label, due_date, retainage_exposure_amount,
    status, version, created_by, updated_by
  )
  values (
    fixture_workspace_id, fixture_project_id, 'closeout-final-billing-lake-001',
    'cop-bluegrass-001', 'D5-BLUE-001', 'pay-bluegrass-final', 'lw-blue-002', 'cexp-007',
    'Final billing and retainage release are blocked by final waiver and restoration acceptance evidence.',
    'Marcus Lee', 'Tessa Grant', '2026-06-20', 58000, 'unresolved', 1, actor, actor
  )
  on conflict (workspace_id, stable_case_key) do update
  set status = 'unresolved',
      assessment_summary = null,
      acceptance_status = null,
      punch_status = null,
      test_evidence_status = null,
      as_built_redline_status = null,
      closeout_document_status = null,
      final_billing_release_status = null,
      resolution_note = null,
      current_review_id = null,
      blocker_clearance_id = null,
      version = 1,
      assessed_by = null,
      resolved_by = null,
      assessed_at = null,
      started_at = null,
      resolved_at = null,
      updated_by = actor,
      updated_at = now()
  returning id into case_uuid;

  delete from closeout_requirements where closeout_requirements.case_id = case_uuid;
  delete from closeout_readiness_validations where closeout_readiness_validations.case_id = case_uuid;
  delete from closeout_reviews where closeout_reviews.case_id = case_uuid;
  delete from closeout_review_decisions where closeout_review_decisions.case_id = case_uuid;
  delete from closeout_blocker_clearances where closeout_blocker_clearances.case_id = case_uuid;
  delete from final_billing_retainage_projections where final_billing_retainage_projections.closeout_case_id = case_uuid;

  insert into closeout_requirements (
    workspace_id, project_id, case_id, stable_requirement_key, label, description, required, status
  )
  values
    (fixture_workspace_id, fixture_project_id, case_uuid, 'restoration-acceptance-photos', 'Restoration acceptance photos', 'Accepted restoration evidence needed to close municipal exception.', true, 'missing'),
    (fixture_workspace_id, fixture_project_id, case_uuid, 'final-unconditional-waiver', 'Final unconditional waiver', 'Final unconditional lien waiver required for retainage release.', true, 'missing'),
    (fixture_workspace_id, fixture_project_id, case_uuid, 'retainage-release-request', 'Retainage release request', 'Finance release request tied to the final pay application.', true, 'missing');

  insert into final_billing_retainage_projections (
    workspace_id, project_id, closeout_case_id, linked_pay_application_key,
    linked_retainage_item_key, linked_commercial_exposure_key, retainage_exposure_amount,
    closeout_status, final_billing_status, retainage_status, payment_status,
    commercial_state, message, updated_by
  )
  values (
    fixture_workspace_id, fixture_project_id, case_uuid, 'pay-bluegrass-final',
    'lw-blue-002', 'cexp-007', 58000, 'blocked', 'blocked', 'blocked',
    'not_recorded', 'closeout_restriction_open',
    'Retainage release remains blocked by closeout evidence.', actor
  )
  on conflict (closeout_case_id) do update
  set closeout_status = 'blocked',
      final_billing_status = 'blocked',
      retainage_status = 'blocked',
      payment_status = 'not_recorded',
      commercial_state = 'closeout_restriction_open',
      message = 'Retainage release remains blocked by closeout evidence.',
      version = 1,
      updated_by = actor,
      updated_at = now();

  return rybex_internal.closeout_payload(case_uuid);
end;
$$;

create or replace function public.closeout_start_release_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command('start', p_stable_case_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.closeout_save_assessment_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_acceptance_status text,
  p_punch_status text,
  p_test_evidence_status text,
  p_as_built_redline_status text,
  p_closeout_document_status text,
  p_final_billing_release_status text,
  p_assessment_summary text,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command(
    'save_assessment',
    p_stable_case_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object(
      'acceptanceStatus', p_acceptance_status,
      'punchStatus', p_punch_status,
      'testEvidenceStatus', p_test_evidence_status,
      'asBuiltRedlineStatus', p_as_built_redline_status,
      'closeoutDocumentStatus', p_closeout_document_status,
      'finalBillingReleaseStatus', p_final_billing_release_status,
      'assessmentSummary', p_assessment_summary
    ),
    p_correlation_id
  )
$$;

create or replace function public.closeout_attach_evidence_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_requirement_key text,
  p_evidence_id uuid,
  p_reference_text text default null,
  p_reference_type text default 'billing_reference',
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command(
    'attach_evidence',
    p_stable_case_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('requirementKey', p_requirement_key, 'evidenceId', p_evidence_id, 'referenceText', p_reference_text, 'referenceType', p_reference_type),
    p_correlation_id
  )
$$;

create or replace function public.closeout_validate_readiness_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command('validate_readiness', p_stable_case_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.closeout_submit_review_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_assigned_role text,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command(
    'submit_review',
    p_stable_case_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('assignedRole', p_assigned_role),
    p_correlation_id
  )
$$;

create or replace function public.closeout_record_decision_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_decision text,
  p_decision_note text,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command(
    'record_decision',
    p_stable_case_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('decision', p_decision, 'decisionNote', p_decision_note),
    p_correlation_id
  )
$$;

create or replace function public.closeout_clear_blocker_v1(
  p_stable_case_key text,
  p_command_id text,
  p_expected_version integer,
  p_resolution_note text,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.closeout_apply_command(
    'clear_blocker',
    p_stable_case_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('resolutionNote', p_resolution_note),
    p_correlation_id
  )
$$;

grant execute on function public.closeout_get_state_v1(text) to authenticated, service_role;
grant execute on function public.closeout_seed_fixture_v1(boolean) to service_role;
grant execute on function public.closeout_start_release_v1(text, text, integer, text) to authenticated;
grant execute on function public.closeout_save_assessment_v1(text, text, integer, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.closeout_attach_evidence_v1(text, text, integer, text, uuid, text, text, text) to authenticated;
grant execute on function public.closeout_validate_readiness_v1(text, text, integer, text) to authenticated;
grant execute on function public.closeout_submit_review_v1(text, text, integer, text, text) to authenticated;
grant execute on function public.closeout_record_decision_v1(text, text, integer, text, text, text) to authenticated;
grant execute on function public.closeout_clear_blocker_v1(text, text, integer, text, text) to authenticated;

revoke all on function rybex_internal.closeout_active_workspace() from public;
revoke all on function rybex_internal.closeout_readiness(uuid) from public;
revoke all on function rybex_internal.closeout_payload(uuid) from public;
revoke all on function rybex_internal.closeout_apply_command(text, text, text, integer, jsonb, text) from public;
