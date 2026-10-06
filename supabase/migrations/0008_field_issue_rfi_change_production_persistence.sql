-- Foundation 0D - Field Issue / RFI / Change Production Persistence
--
-- Scope:
-- - Domain-specific persistence for the current Field Issue Escalation reference slice.
-- - Downstream RFI and Change Event records created from that escalation.
-- - Authenticated command RPCs with idempotency, optimistic concurrency, audit/domain events,
--   managed evidence linkage, RLS, and source-path truth.
-- - Does not create a complete RFI management suite, Change Order system, or Closeout persistence.

create table if not exists field_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  stable_issue_key text not null,
  daily_report_key text not null,
  work_package_key text not null,
  work_package_name text not null,
  location text not null,
  summary text not null,
  issue_type text not null default 'utility_conflict',
  severity text not null default 'critical',
  schedule_impact boolean not null default true,
  schedule_impact_days integer not null default 2,
  estimated_cost_exposure numeric(14, 2) not null default 0,
  owner_label text not null default 'Field Supervisor',
  reported_by_label text not null default 'Field Supervisor',
  status text not null default 'unresolved',
  selected_escalation_path text,
  resolution_note text,
  version integer not null default 1,
  reported_by uuid references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  resolved_by uuid references auth.users(id) on delete restrict,
  reported_at timestamptz not null default now(),
  started_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, stable_issue_key),
  constraint field_issues_status_check check (
    status in ('unresolved','in_progress','assessed','evidence_added','path_selected','downstream_created','resolved')
  ),
  constraint field_issues_path_check check (
    selected_escalation_path is null or selected_escalation_path in ('rfi','change_event')
  ),
  constraint field_issues_issue_type_check check (
    issue_type in ('utility_conflict','access_constraint','safety_constraint','quality_constraint')
  ),
  constraint field_issues_severity_check check (severity in ('medium','high','critical')),
  constraint field_issues_exposure_check check (estimated_cost_exposure >= 0 and schedule_impact_days >= 0)
);

create table if not exists field_issue_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  field_issue_id uuid not null references field_issues(id) on delete cascade,
  issue_type text not null,
  impact_summary text not null,
  schedule_impact boolean not null default true,
  schedule_days integer not null default 0,
  cost_exposure numeric(14, 2) not null default 0,
  safety_impact boolean not null default false,
  quality_impact boolean not null default false,
  recommended_path text,
  version integer not null default 1,
  assessed_by uuid not null references auth.users(id) on delete restrict,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (field_issue_id),
  constraint field_issue_assessments_issue_type_check check (
    issue_type in ('utility_conflict','access_constraint','safety_constraint','quality_constraint')
  ),
  constraint field_issue_assessments_path_check check (
    recommended_path is null or recommended_path in ('rfi','change_event')
  ),
  constraint field_issue_assessments_exposure_check check (cost_exposure >= 0 and schedule_days >= 0)
);

create table if not exists field_issue_evidence_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  field_issue_id uuid not null references field_issues(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  description text not null,
  status text not null default 'missing',
  reference_type text,
  reference_text text,
  evidence_object_id uuid references evidence_objects(id) on delete set null,
  attached_by uuid references auth.users(id) on delete restrict,
  attached_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (field_issue_id, requirement_key),
  constraint field_issue_evidence_references_status_check check (status in ('missing','attached'))
);

create table if not exists rfis (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  stable_rfi_key text not null,
  rfi_number text not null,
  source_field_issue_id uuid not null references field_issues(id) on delete restrict,
  title text not null,
  question text not null,
  project_location text not null,
  status text not null default 'submitted',
  response_status text not null default 'pending',
  priority text not null default 'critical',
  discipline text not null default 'underground',
  current_owner_label text not null default 'Project Manager',
  required_decision text not null,
  next_action text not null,
  due_date date,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, stable_rfi_key),
  unique (workspace_id, rfi_number),
  constraint rfis_status_check check (status in ('draft','submitted','answered','closed','void','overdue')),
  constraint rfis_response_status_check check (response_status in ('pending','answered','not_required'))
);

create table if not exists change_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  stable_change_key text not null,
  change_number text not null,
  source_field_issue_id uuid not null references field_issues(id) on delete restrict,
  linked_rfi_id uuid references rfis(id) on delete set null,
  source_path text not null,
  title text not null,
  description text not null,
  project_location text not null,
  estimated_cost_exposure numeric(14, 2) not null default 0,
  schedule_impact_days integer not null default 0,
  notice_status text not null default 'submitted',
  backup_status text not null default 'partial',
  commercial_status text not null default 'notice_submitted',
  current_owner_label text not null default 'Commercial Lead',
  required_action text not null,
  notice_deadline date,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  notice_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, stable_change_key),
  unique (workspace_id, change_number),
  constraint change_events_source_path_check check (source_path in ('direct_change','linked_rfi')),
  constraint change_events_status_check check (commercial_status in ('notice_submitted','backup_needed','pricing_in_progress','under_review','approved','rejected','closed')),
  constraint change_events_notice_check check (notice_status in ('not_started','submitted','not_required')),
  constraint change_events_backup_check check (backup_status in ('missing','partial','complete')),
  constraint change_events_exposure_check check (estimated_cost_exposure >= 0 and schedule_impact_days >= 0),
  constraint change_events_link_consistency_check check (
    (source_path = 'direct_change' and linked_rfi_id is null)
    or (source_path = 'linked_rfi' and linked_rfi_id is not null)
  )
);

create table if not exists field_issue_resolutions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  field_issue_id uuid not null references field_issues(id) on delete cascade,
  resolution_note text not null,
  resolved_by uuid not null references auth.users(id) on delete restrict,
  resolved_at timestamptz not null default now(),
  unique (field_issue_id)
);

create trigger set_field_issues_updated_at
before update on field_issues
for each row execute function set_updated_at();

create trigger set_field_issue_assessments_updated_at
before update on field_issue_assessments
for each row execute function set_updated_at();

create trigger set_field_issue_evidence_references_updated_at
before update on field_issue_evidence_references
for each row execute function set_updated_at();

create trigger set_rfis_updated_at
before update on rfis
for each row execute function set_updated_at();

create trigger set_change_events_updated_at
before update on change_events
for each row execute function set_updated_at();

create index if not exists field_issues_workspace_status_idx on field_issues(workspace_id, status);
create index if not exists field_issues_project_status_idx on field_issues(workspace_id, project_id, status);
create index if not exists field_issues_stable_key_idx on field_issues(workspace_id, stable_issue_key);
create index if not exists field_issue_assessments_issue_idx on field_issue_assessments(field_issue_id);
create index if not exists field_issue_evidence_issue_idx on field_issue_evidence_references(field_issue_id);
create index if not exists rfis_source_field_issue_idx on rfis(source_field_issue_id);
create index if not exists rfis_workspace_status_idx on rfis(workspace_id, status);
create index if not exists change_events_source_field_issue_idx on change_events(source_field_issue_id);
create index if not exists change_events_linked_rfi_idx on change_events(linked_rfi_id);
create index if not exists change_events_workspace_status_idx on change_events(workspace_id, commercial_status);

grant select on field_issues, field_issue_assessments, field_issue_evidence_references, rfis, change_events, field_issue_resolutions to authenticated, service_role;
grant insert, update, delete on field_issues, field_issue_assessments, field_issue_evidence_references, rfis, change_events, field_issue_resolutions to service_role;

alter table field_issues enable row level security;
alter table field_issue_assessments enable row level security;
alter table field_issue_evidence_references enable row level security;
alter table rfis enable row level security;
alter table change_events enable row level security;
alter table field_issue_resolutions enable row level security;

drop policy if exists field_issues_select_authorized on field_issues;
create policy field_issues_select_authorized on field_issues for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists field_issue_assessments_select_authorized on field_issue_assessments;
create policy field_issue_assessments_select_authorized on field_issue_assessments for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists field_issue_evidence_select_authorized on field_issue_evidence_references;
create policy field_issue_evidence_select_authorized on field_issue_evidence_references for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists rfis_select_authorized on rfis;
create policy rfis_select_authorized on rfis for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists change_events_select_authorized on change_events;
create policy change_events_select_authorized on change_events for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));
drop policy if exists field_issue_resolutions_select_authorized on field_issue_resolutions;
create policy field_issue_resolutions_select_authorized on field_issue_resolutions for select to authenticated
  using (public.is_active_workspace_member(workspace_id) and public.can_access_project(project_id));

drop policy if exists field_issues_no_direct_mutation on field_issues;
create policy field_issues_no_direct_mutation on field_issues for all to authenticated using (false) with check (false);
drop policy if exists field_issue_assessments_no_direct_mutation on field_issue_assessments;
create policy field_issue_assessments_no_direct_mutation on field_issue_assessments for all to authenticated using (false) with check (false);
drop policy if exists field_issue_evidence_no_direct_mutation on field_issue_evidence_references;
create policy field_issue_evidence_no_direct_mutation on field_issue_evidence_references for all to authenticated using (false) with check (false);
drop policy if exists rfis_no_direct_mutation on rfis;
create policy rfis_no_direct_mutation on rfis for all to authenticated using (false) with check (false);
drop policy if exists change_events_no_direct_mutation on change_events;
create policy change_events_no_direct_mutation on change_events for all to authenticated using (false) with check (false);
drop policy if exists field_issue_resolutions_no_direct_mutation on field_issue_resolutions;
create policy field_issue_resolutions_no_direct_mutation on field_issue_resolutions for all to authenticated using (false) with check (false);

create or replace function rybex_internal.field_issue_active_workspace()
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

create or replace function rybex_internal.field_issue_readiness(issue_uuid uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  issue field_issues%rowtype;
  has_assessment boolean;
  evidence_count integer;
  downstream_count integer;
  missing text[];
begin
  select * into issue from field_issues where id = issue_uuid;
  if not found then
    return jsonb_build_object('assessmentComplete', false, 'evidenceComplete', false, 'escalationPathSelected', false, 'downstreamRecordCreated', false, 'resolutionReady', false, 'missing', array['Field issue']);
  end if;

  select exists(select 1 from field_issue_assessments where field_issue_id = issue.id) into has_assessment;
  select count(*) into evidence_count from field_issue_evidence_references where field_issue_id = issue.id and status = 'attached';
  downstream_count := case
    when issue.selected_escalation_path = 'rfi' then (select count(*) from rfis where source_field_issue_id = issue.id)
    when issue.selected_escalation_path = 'change_event' then (select count(*) from change_events where source_field_issue_id = issue.id)
    else 0
  end;

  missing := array_remove(array[
    case when not has_assessment then 'Impact assessment' end,
    case when evidence_count = 0 then 'Evidence reference' end,
    case when issue.selected_escalation_path is null then 'Escalation path' end,
    case when downstream_count = 0 then 'Downstream RFI or change event' end
  ], null);

  return jsonb_build_object(
    'assessmentComplete', has_assessment,
    'evidenceComplete', evidence_count > 0,
    'escalationPathSelected', issue.selected_escalation_path is not null,
    'downstreamRecordCreated', downstream_count > 0,
    'resolutionReady', array_length(missing, 1) is null and issue.status <> 'resolved',
    'missing', coalesce(to_jsonb(missing), '[]'::jsonb)
  );
end;
$$;

create or replace function rybex_internal.field_issue_payload(issue_uuid uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  issue field_issues%rowtype;
  project_name text;
  assessment field_issue_assessments%rowtype;
  resolution field_issue_resolutions%rowtype;
  evidence_requirements jsonb;
  evidence_references jsonb;
  downstream_records jsonb;
  history jsonb;
  readiness jsonb;
begin
  select * into issue from field_issues where id = issue_uuid;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  select name into project_name from projects where id = issue.project_id;
  select * into assessment from field_issue_assessments where field_issue_id = issue.id limit 1;
  select * into resolution from field_issue_resolutions where field_issue_id = issue.id limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', requirement_key,
    'label', label,
    'description', description,
    'status', status
  ) order by requirement_key), '[]'::jsonb)
  into evidence_requirements
  from field_issue_evidence_references
  where field_issue_id = issue.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id::text,
    'requirementId', requirement_key,
    'referenceType', coalesce(reference_type, 'field_note'),
    'referenceText', coalesce(reference_text, evidence_object_id::text),
    'actorId', attached_by::text,
    'createdAt', attached_at
  ) order by attached_at), '[]'::jsonb)
  into evidence_references
  from field_issue_evidence_references
  where field_issue_id = issue.id
    and status = 'attached';

  select coalesce(jsonb_agg(item order by item->>'recordNumber'), '[]'::jsonb)
  into downstream_records
  from (
    select jsonb_build_object(
      'id', stable_rfi_key,
      'recordType', 'rfi',
      'recordNumber', rfi_number,
      'title', title,
      'route', '/rfis-submittals',
      'createdBy', created_by::text,
      'createdAt', created_at
    ) as item
    from rfis
    where source_field_issue_id = issue.id
    union all
    select jsonb_build_object(
      'id', stable_change_key,
      'recordType', 'change_event',
      'recordNumber', change_number,
      'title', title,
      'route', '/changes',
      'createdBy', created_by::text,
      'createdAt', created_at
    ) as item
    from change_events
    where source_field_issue_id = issue.id
  ) records;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id::text,
    'type', replace(event_type, 'field_issue.', ''),
    'actorId', actor_user_id::text,
    'message', coalesce(payload->>'message', event_type),
    'createdAt', occurred_at
  ) order by occurred_at), '[]'::jsonb)
  into history
  from domain_events
  where aggregate_type = 'field_issue'
    and aggregate_id = issue.id;

  readiness := rybex_internal.field_issue_readiness(issue.id);

  return jsonb_build_object(
    'success', true,
    'ok', true,
    'message', 'Field Issue database state loaded.',
    'events', '[]'::jsonb,
    'issue', jsonb_build_object(
      'id', issue.stable_issue_key,
      'projectId', issue.project_id::text,
      'projectName', coalesce(project_name, 'Lake Norman Underground Conduit Package'),
      'dailyReportId', issue.daily_report_key,
      'workPackageId', issue.work_package_key,
      'workPackageName', issue.work_package_name,
      'location', issue.location,
      'summary', issue.summary,
      'issueType', issue.issue_type,
      'reportedBy', issue.reported_by_label,
      'reportedDate', issue.reported_at::date::text,
      'owner', issue.owner_label,
      'severity', issue.severity,
      'scheduleImpact', issue.schedule_impact,
      'costExposure', issue.estimated_cost_exposure,
      'evidenceRequirements', evidence_requirements,
      'evidenceReferences', evidence_references,
      'state', issue.status,
      'selectedEscalationPath', issue.selected_escalation_path,
      'linkedDownstreamRecordIds', coalesce((select jsonb_agg(value) from (
        select stable_rfi_key as value from rfis where source_field_issue_id = issue.id
        union all
        select stable_change_key as value from change_events where source_field_issue_id = issue.id
      ) x), '[]'::jsonb),
      'downstreamRecords', downstream_records,
      'assessment', case when assessment.id is null then null else jsonb_build_object(
        'issueType', assessment.issue_type,
        'impactSummary', assessment.impact_summary,
        'scheduleImpact', assessment.schedule_impact,
        'scheduleDays', assessment.schedule_days,
        'costExposure', assessment.cost_exposure,
        'safetyImpact', assessment.safety_impact,
        'qualityImpact', assessment.quality_impact,
        'assessedBy', assessment.assessed_by::text,
        'assessedAt', assessment.assessed_at
      ) end,
      'resolutionNote', issue.resolution_note,
      'outcomeRecord', case when resolution.id is null then null else jsonb_build_object(
        'id', 'field-issue-outcome-' || issue.stable_issue_key,
        'outcome', 'Field issue escalated into downstream commercial/governance action and original blocker cleared.',
        'resolvedBy', resolution.resolved_by::text,
        'resolvedAt', resolution.resolved_at,
        'resolutionNote', resolution.resolution_note,
        'downstreamRecordIds', coalesce((select jsonb_agg(value) from (
          select stable_rfi_key as value from rfis where source_field_issue_id = issue.id
          union all
          select stable_change_key as value from change_events where source_field_issue_id = issue.id
        ) x), '[]'::jsonb)
      ) end,
      'history', history,
      'createdAt', issue.created_at,
      'updatedAt', issue.updated_at,
      'version', issue.version,
      'databaseBacked', true,
      'storageMode', 'database'
    ),
    'readiness', readiness,
    'impact', jsonb_build_object(
      'openIssueCount', case when issue.status = 'resolved' then 0 else 1 end,
      'resolvedIssueCount', case when issue.status = 'resolved' then 1 else 0 end,
      'costExposure', case when issue.status = 'resolved' then 0 else issue.estimated_cost_exposure end,
      'issueState', issue.status,
      'samePrimaryBlockerResolved', issue.status = 'resolved'
    ),
    'storageLabel', 'Database-backed',
    'resultingVersion', issue.version
  );
end;
$$;

create or replace function rybex_internal.field_issue_apply_command(
  p_action text,
  p_stable_issue_key text,
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
  issue field_issues%rowtype;
  before_values jsonb;
  after_payload jsonb;
  existing command_idempotency%rowtype;
  claim record;
  request_hash text;
  correlation text := coalesce(nullif(p_correlation_id, ''), gen_random_uuid()::text);
  audit_id uuid;
  event_id uuid;
  evidence evidence_objects%rowtype;
  requirement field_issue_evidence_references%rowtype;
  readiness jsonb;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  resolved_workspace_id := rybex_internal.field_issue_active_workspace();
  if resolved_workspace_id is null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;

  role := public.current_workspace_role(resolved_workspace_id);
  if role is null then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select * into issue
  from field_issues
  where workspace_id = resolved_workspace_id
    and stable_issue_key = coalesce(nullif(p_stable_issue_key, ''), 'field-issue-lake-001')
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.can_access_project(issue.project_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_action = 'start' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  elsif p_action = 'save_assessment' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  elsif p_action = 'attach_evidence' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  elsif p_action = 'select_path' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  elsif p_action = 'create_rfi' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  elsif p_action = 'create_change_event' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  elsif p_action = 'resolve' and role not in ('admin','operations_leader','project_manager','field_supervisor') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  request_hash := encode(extensions.digest(
    convert_to(resolved_workspace_id::text || '|' || issue.id::text || '|' || p_action || '|' || coalesce(p_expected_version::text, '') || '|' || coalesce(p_payload::text, '{}'), 'UTF8'),
    'sha256'
  ), 'hex');

  select * into existing
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

  if issue.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', issue.version);
  end if;

  select * into claim
  from rybex_internal.claim_or_replay_command(
    resolved_workspace_id,
    p_command_id,
    'field_issue.' || p_action || '.v1',
    'field_issue',
    issue.id,
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

  before_values := jsonb_build_object('status', issue.status, 'version', issue.version, 'selectedEscalationPath', issue.selected_escalation_path);

  if p_action = 'start' then
    if issue.status = 'resolved' then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    update field_issues
    set status = case when status = 'unresolved' then 'in_progress' else status end,
        started_at = coalesce(started_at, now()),
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;

  elsif p_action = 'save_assessment' then
    if issue.status in ('unresolved','resolved') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if nullif(trim(p_payload->>'impactSummary'), '') is null then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    if (p_payload->>'scheduleDays')::integer < 0 or (p_payload->>'costExposure')::numeric < 0 then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;

    insert into field_issue_assessments (
      workspace_id, project_id, field_issue_id, issue_type, impact_summary, schedule_impact,
      schedule_days, cost_exposure, safety_impact, quality_impact, assessed_by
    )
    values (
      issue.workspace_id, issue.project_id, issue.id, p_payload->>'issueType', trim(p_payload->>'impactSummary'),
      coalesce((p_payload->>'scheduleImpact')::boolean, true), (p_payload->>'scheduleDays')::integer,
      (p_payload->>'costExposure')::numeric, coalesce((p_payload->>'safetyImpact')::boolean, false),
      coalesce((p_payload->>'qualityImpact')::boolean, false), actor
    )
    on conflict (field_issue_id) do update
    set issue_type = excluded.issue_type,
        impact_summary = excluded.impact_summary,
        schedule_impact = excluded.schedule_impact,
        schedule_days = excluded.schedule_days,
        cost_exposure = excluded.cost_exposure,
        safety_impact = excluded.safety_impact,
        quality_impact = excluded.quality_impact,
        assessed_by = excluded.assessed_by,
        assessed_at = now(),
        version = field_issue_assessments.version + 1;

    update field_issues
    set status = 'assessed',
        issue_type = p_payload->>'issueType',
        schedule_impact = coalesce((p_payload->>'scheduleImpact')::boolean, true),
        schedule_impact_days = (p_payload->>'scheduleDays')::integer,
        estimated_cost_exposure = (p_payload->>'costExposure')::numeric,
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;

  elsif p_action = 'attach_evidence' then
    if issue.status in ('unresolved','resolved') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if not exists (select 1 from field_issue_assessments where field_issue_id = issue.id) then
      return jsonb_build_object('success', false, 'error', 'assessment_required');
    end if;
    select * into requirement
    from field_issue_evidence_references
    where field_issue_id = issue.id
      and requirement_key = p_payload->>'requirementKey'
    for update;
    if not found then
      return jsonb_build_object('success', false, 'error', 'requirement_not_found');
    end if;
    select * into evidence
    from evidence_objects
    where id = (p_payload->>'evidenceId')::uuid
      and workspace_id = issue.workspace_id
      and project_id = issue.project_id
      and upload_status = 'uploaded'
      and scan_status not in ('quarantined','failed');
    if not found then
      return jsonb_build_object('success', false, 'error', 'evidence_required');
    end if;
    insert into evidence_links (
      workspace_id, project_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
    )
    values (
      issue.workspace_id, issue.project_id, evidence.id, 'field_issue', issue.id, 'field_issue_evidence', actor
    )
    on conflict (workspace_id, evidence_object_id, entity_type, entity_id, relationship_type) do nothing;

    update field_issue_evidence_references
    set status = 'attached',
        reference_type = coalesce(nullif(p_payload->>'referenceType', ''), 'field_note'),
        reference_text = coalesce(nullif(trim(p_payload->>'referenceText'), ''), evidence.original_filename),
        evidence_object_id = evidence.id,
        attached_by = actor,
        attached_at = now(),
        version = version + 1
    where id = requirement.id;

    update field_issues
    set status = 'evidence_added',
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;

  elsif p_action = 'select_path' then
    if issue.status in ('unresolved','resolved') then
      return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;
    if (p_payload->>'path') not in ('rfi','change_event') then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    if not exists (select 1 from field_issue_assessments where field_issue_id = issue.id) then
      return jsonb_build_object('success', false, 'error', 'assessment_required');
    end if;
    if not exists (select 1 from field_issue_evidence_references where field_issue_id = issue.id and status = 'attached') then
      return jsonb_build_object('success', false, 'error', 'evidence_required');
    end if;
    update field_issues
    set selected_escalation_path = p_payload->>'path',
        status = 'path_selected',
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;

  elsif p_action = 'create_rfi' then
    if issue.selected_escalation_path <> 'rfi' then
      return jsonb_build_object('success', false, 'error', 'invalid_path');
    end if;
    if not exists (select 1 from rfis where source_field_issue_id = issue.id) then
      insert into rfis (
        workspace_id, project_id, stable_rfi_key, rfi_number, source_field_issue_id, title,
        question, project_location, status, response_status, required_decision, next_action,
        due_date, created_by, updated_by, submitted_at
      )
      values (
        issue.workspace_id, issue.project_id, 'rfi-field-issue-lake-001', 'RFI-FI-001', issue.id,
        'Field issue escalation: Lake Norman bore path locates',
        'Confirm whether Rybex should proceed, standby, or reroute around the unresolved utility locate and traffic-control condition.',
        issue.location, 'submitted', 'pending',
        'Provide written direction and confirm compensability for standby or reroute impacts.',
        'Track RFI response from downstream record.',
        '2026-06-12', actor, actor, now()
      );
    end if;
    update field_issues
    set status = 'downstream_created',
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;

  elsif p_action = 'create_change_event' then
    if issue.selected_escalation_path <> 'change_event' then
      return jsonb_build_object('success', false, 'error', 'invalid_path');
    end if;
    if not exists (select 1 from change_events where source_field_issue_id = issue.id) then
      insert into change_events (
        workspace_id, project_id, stable_change_key, change_number, source_field_issue_id,
        linked_rfi_id, source_path, title, description, project_location,
        estimated_cost_exposure, schedule_impact_days, notice_status, backup_status,
        commercial_status, required_action, notice_deadline, created_by, updated_by,
        notice_submitted_at
      )
      values (
        issue.workspace_id, issue.project_id, 'chg-field-issue-lake-001', 'CE-FI-001', issue.id,
        null, 'direct_change', 'Field issue escalation: bore crew standby exposure',
        coalesce((select impact_summary from field_issue_assessments where field_issue_id = issue.id), issue.summary),
        issue.location, issue.estimated_cost_exposure, issue.schedule_impact_days,
        'submitted', 'partial', 'notice_submitted',
        'Price standby exposure after GC direction is received.', '2026-06-12',
        actor, actor, now()
      );
    end if;
    update field_issues
    set status = 'downstream_created',
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;

  elsif p_action = 'resolve' then
    readiness := rybex_internal.field_issue_readiness(issue.id);
    if coalesce((readiness->>'resolutionReady')::boolean, false) = false then
      return jsonb_build_object('success', false, 'error', 'not_ready', 'readiness', readiness);
    end if;
    if nullif(trim(p_payload->>'resolutionNote'), '') is null then
      return jsonb_build_object('success', false, 'error', 'validation_failed');
    end if;
    insert into field_issue_resolutions (
      workspace_id, project_id, field_issue_id, resolution_note, resolved_by
    )
    values (
      issue.workspace_id, issue.project_id, issue.id, trim(p_payload->>'resolutionNote'), actor
    )
    on conflict (field_issue_id) do update
    set resolution_note = excluded.resolution_note,
        resolved_by = excluded.resolved_by,
        resolved_at = now();

    update field_issues
    set status = 'resolved',
        resolution_note = trim(p_payload->>'resolutionNote'),
        resolved_by = actor,
        resolved_at = now(),
        updated_by = actor,
        version = version + 1
    where id = issue.id
    returning * into issue;
  else
    return jsonb_build_object('success', false, 'error', 'unsupported_action');
  end if;

  after_payload := rybex_internal.field_issue_payload(issue.id)
    || jsonb_build_object(
      'message', 'Field Issue database command completed.',
      'events', jsonb_build_array(jsonb_build_object('type', 'field_issue_' || p_action, 'toState', issue.status)),
      'replayed', false,
      'resultingVersion', issue.version,
      'correlationId', correlation
    );

  audit_id := rybex_internal.append_audit_event(
    issue.workspace_id,
    issue.project_id,
    'field_issue',
    issue.id,
    p_command_id,
    'field_issue.' || p_action,
    before_values->>'status',
    issue.status,
    actor,
    correlation,
    before_values,
    jsonb_build_object('status', issue.status, 'version', issue.version, 'selectedEscalationPath', issue.selected_escalation_path),
    jsonb_build_object('foundationIncrement', '0D', 'issueKey', issue.stable_issue_key)
  );

  event_id := rybex_internal.append_domain_event(
    issue.workspace_id,
    issue.project_id,
    'field_issue',
    issue.id,
    issue.version,
    'field_issue.' || p_action,
    1,
    p_command_id,
    correlation,
    actor,
    jsonb_build_object(
      'status', issue.status,
      'issueKey', issue.stable_issue_key,
      'message', 'Field issue ' || replace(p_action, '_', ' ') || ' completed.'
    )
  );

  after_payload := after_payload || jsonb_build_object('auditEventId', audit_id, 'domainEventId', event_id);
  perform rybex_internal.complete_command(issue.workspace_id, p_command_id, after_payload);
  return after_payload;
end;
$$;

create or replace function public.field_issue_get_state_v1(p_stable_issue_key text default 'field-issue-lake-001')
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  resolved_workspace_id uuid;
  issue_id uuid;
begin
  resolved_workspace_id := rybex_internal.field_issue_active_workspace();
  if resolved_workspace_id is null and actor is not null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;
  if resolved_workspace_id is null then
    select id into resolved_workspace_id from workspaces where slug = 'workspace-a' or name = 'Workspace A' order by created_at limit 1;
  end if;

  select id into issue_id
  from field_issues
  where workspace_id = resolved_workspace_id
    and stable_issue_key = coalesce(nullif(p_stable_issue_key, ''), 'field-issue-lake-001');

  if issue_id is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if actor is not null and not public.can_access_project((select project_id from field_issues where id = issue_id)) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  return rybex_internal.field_issue_payload(issue_id);
end;
$$;

create or replace function public.field_issue_seed_fixture_v1(p_reset boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  fixture_workspace_id uuid := '10000000-0000-4000-8000-000000000001'::uuid;
  fixture_project_id uuid := '30000000-0000-4000-8000-000000000001'::uuid;
  actor uuid;
  issue_id uuid;
begin
  if not exists (select 1 from workspaces where id = fixture_workspace_id) then
    return jsonb_build_object('success', false, 'error', 'missing_workspace_fixture');
  end if;
  if not exists (select 1 from projects where id = fixture_project_id) then
    return jsonb_build_object('success', false, 'error', 'missing_project_fixture');
  end if;
  select user_id into actor from user_profiles where email = 'field-a@foundation0a.local' limit 1;
  if actor is null then
    select user_id into actor from user_profiles where email = 'admin-a@foundation0a.local' limit 1;
  end if;

  if p_reset then
    delete from change_events
    where source_field_issue_id in (
      select id from field_issues
      where workspace_id = fixture_workspace_id
        and stable_issue_key = 'field-issue-lake-001'
    );
    delete from rfis
    where source_field_issue_id in (
      select id from field_issues
      where workspace_id = fixture_workspace_id
        and stable_issue_key = 'field-issue-lake-001'
    );
    delete from field_issues
    where workspace_id = fixture_workspace_id
      and stable_issue_key = 'field-issue-lake-001';
  end if;

  insert into field_issues (
    workspace_id, project_id, stable_issue_key, daily_report_key, work_package_key,
    work_package_name, location, summary, issue_type, severity, schedule_impact,
    schedule_impact_days, estimated_cost_exposure, owner_label, reported_by_label,
    status, version, reported_by, created_by, updated_by, reported_at
  )
  values (
    fixture_workspace_id, fixture_project_id, 'field-issue-lake-001', 'dr-lake-bore-0610',
    'wp-lake-bore-crew', 'Hospital Access Road Bore Package',
    'Hospital access road and conduit crossing',
    'Utility locates and traffic control release are not confirmed for the hospital access road bore path.',
    'utility_conflict', 'critical', true, 2, 18500, 'Jon Reeves', 'Jon Reeves',
    'unresolved', 1, actor, actor, actor, '2026-06-10T08:00:00.000Z'
  )
  on conflict (workspace_id, stable_issue_key) do update
  set status = 'unresolved',
      selected_escalation_path = null,
      resolution_note = null,
      version = 1,
      started_at = null,
      resolved_at = null,
      resolved_by = null,
      updated_by = actor,
      updated_at = now()
  returning id into issue_id;

  delete from field_issue_assessments where field_issue_id = issue_id;
  delete from field_issue_evidence_references where field_issue_id = issue_id;
  delete from rfis where source_field_issue_id = issue_id;
  delete from change_events where source_field_issue_id = issue_id;
  delete from field_issue_resolutions where field_issue_id = issue_id;

  insert into field_issue_evidence_references (
    workspace_id, project_id, field_issue_id, requirement_key, label, description, status
  )
  values
    (fixture_workspace_id, fixture_project_id, issue_id, 'field-daily-report-reference', 'Daily report or field note', 'Reference the field record proving the held-work condition.', 'missing'),
    (fixture_workspace_id, fixture_project_id, issue_id, 'field-location-evidence', 'Location/evidence reference', 'Reference photos, locate ticket notes, or traffic-control comments.', 'missing');

  return rybex_internal.field_issue_payload(issue_id);
end;
$$;

create or replace function public.field_issue_start_escalation_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command('start', p_stable_issue_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.field_issue_save_assessment_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_issue_type text,
  p_impact_summary text,
  p_schedule_impact boolean,
  p_schedule_days integer,
  p_cost_exposure numeric,
  p_safety_impact boolean,
  p_quality_impact boolean,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command(
    'save_assessment',
    p_stable_issue_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object(
      'issueType', p_issue_type,
      'impactSummary', p_impact_summary,
      'scheduleImpact', p_schedule_impact,
      'scheduleDays', p_schedule_days,
      'costExposure', p_cost_exposure,
      'safetyImpact', p_safety_impact,
      'qualityImpact', p_quality_impact
    ),
    p_correlation_id
  )
$$;

create or replace function public.field_issue_attach_evidence_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_requirement_key text,
  p_evidence_id uuid,
  p_reference_text text default null,
  p_reference_type text default 'field_note',
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command(
    'attach_evidence',
    p_stable_issue_key,
    p_command_id,
    p_expected_version,
    jsonb_build_object('requirementKey', p_requirement_key, 'evidenceId', p_evidence_id, 'referenceText', p_reference_text, 'referenceType', p_reference_type),
    p_correlation_id
  )
$$;

create or replace function public.field_issue_select_path_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_path text,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command('select_path', p_stable_issue_key, p_command_id, p_expected_version, jsonb_build_object('path', p_path), p_correlation_id)
$$;

create or replace function public.field_issue_create_rfi_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command('create_rfi', p_stable_issue_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.field_issue_create_change_event_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command('create_change_event', p_stable_issue_key, p_command_id, p_expected_version, '{}'::jsonb, p_correlation_id)
$$;

create or replace function public.field_issue_resolve_escalation_v1(
  p_stable_issue_key text,
  p_command_id text,
  p_expected_version integer,
  p_resolution_note text,
  p_correlation_id text default null
)
returns jsonb language sql security definer set search_path = public, rybex_internal, pg_temp as $$
  select rybex_internal.field_issue_apply_command('resolve', p_stable_issue_key, p_command_id, p_expected_version, jsonb_build_object('resolutionNote', p_resolution_note), p_correlation_id)
$$;

grant execute on function public.field_issue_get_state_v1(text) to authenticated, service_role;
grant execute on function public.field_issue_seed_fixture_v1(boolean) to service_role;
grant execute on function public.field_issue_start_escalation_v1(text, text, integer, text) to authenticated;
grant execute on function public.field_issue_save_assessment_v1(text, text, integer, text, text, boolean, integer, numeric, boolean, boolean, text) to authenticated;
grant execute on function public.field_issue_attach_evidence_v1(text, text, integer, text, uuid, text, text, text) to authenticated;
grant execute on function public.field_issue_select_path_v1(text, text, integer, text, text) to authenticated;
grant execute on function public.field_issue_create_rfi_v1(text, text, integer, text) to authenticated;
grant execute on function public.field_issue_create_change_event_v1(text, text, integer, text) to authenticated;
grant execute on function public.field_issue_resolve_escalation_v1(text, text, integer, text, text) to authenticated;

revoke all on function rybex_internal.field_issue_active_workspace() from public;
revoke all on function rybex_internal.field_issue_readiness(uuid) from public;
revoke all on function rybex_internal.field_issue_payload(uuid) from public;
revoke all on function rybex_internal.field_issue_apply_command(text, text, text, integer, jsonb, text) from public;
