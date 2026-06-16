-- RybexOS Persistence Phase 3
-- Workflow transaction persistence scaffold only.
--
-- Runtime remains seed-backed and local-transaction-backed by default. This
-- migration defines durable storage for Signal -> Decision -> Action ->
-- Evidence -> Gate Movement, but it does not enable database runtime writes.
--
-- RLS is intentionally not enabled in this migration. Auth, workspace claims,
-- membership policies, and policy tests must be added before RLS is activated.

create table if not exists workflow_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  workflow_type text not null,
  d5o_phase text not null,
  source_module text not null,
  source_record_type text not null,
  source_record_id text not null,
  entity_name text not null,
  title text not null,
  description text,
  current_status text not null,
  resolution_state text not null,
  severity text not null,
  owner_name text,
  owner_role text,
  due_date timestamptz,
  business_impact text,
  consequence_if_missed text,
  target_module text,
  target_href text,
  next_gate_or_status text,
  value_at_risk numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  workflow_instance_id uuid not null references workflow_instances(id) on delete cascade,
  signal_type text not null,
  summary text not null,
  severity text not null,
  source_module text not null,
  source_record_type text not null,
  source_record_id text not null,
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists workflow_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  workflow_instance_id uuid not null references workflow_instances(id) on delete cascade,
  transaction_type text not null,
  transaction_label text not null,
  actor_name text,
  actor_role text,
  actor_user_id uuid references user_profiles(id) on delete set null,
  decision text,
  decision_reason text,
  action_taken text not null,
  evidence_summary text,
  resulting_status text,
  resulting_resolution_state text,
  resulting_gate_movement text,
  success_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists workflow_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  workflow_instance_id uuid not null references workflow_instances(id) on delete cascade,
  requirement_type text not null,
  title text not null,
  description text,
  status text not null,
  source_module text,
  source_record_type text,
  source_record_id text,
  attachment_id uuid references attachments(id) on delete set null,
  required_for_gate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_source_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  workflow_instance_id uuid not null references workflow_instances(id) on delete cascade,
  source_module text not null,
  source_record_type text not null,
  source_record_id text not null,
  link_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists workflow_instances_org_workspace_idx on workflow_instances(organization_id, workspace_id);
create index if not exists workflow_instances_project_id_idx on workflow_instances(project_id);
create index if not exists workflow_instances_workflow_type_idx on workflow_instances(workflow_type);
create index if not exists workflow_instances_d5o_phase_idx on workflow_instances(d5o_phase);
create index if not exists workflow_instances_resolution_state_idx on workflow_instances(resolution_state);
create index if not exists workflow_instances_severity_idx on workflow_instances(severity);
create index if not exists workflow_instances_due_date_idx on workflow_instances(due_date);

create index if not exists workflow_signals_workflow_instance_idx on workflow_signals(workflow_instance_id);

create index if not exists workflow_transactions_workflow_instance_idx on workflow_transactions(workflow_instance_id);
create index if not exists workflow_transactions_type_idx on workflow_transactions(transaction_type);
create index if not exists workflow_transactions_created_at_idx on workflow_transactions(created_at);

create index if not exists workflow_evidence_requirements_workflow_instance_idx on workflow_evidence_requirements(workflow_instance_id);

create index if not exists workflow_source_links_workflow_instance_idx on workflow_source_links(workflow_instance_id);
create index if not exists workflow_source_links_source_idx on workflow_source_links(source_module, source_record_type, source_record_id);

create trigger set_workflow_instances_updated_at before update on workflow_instances for each row execute function set_updated_at();
create trigger set_workflow_evidence_requirements_updated_at before update on workflow_evidence_requirements for each row execute function set_updated_at();

comment on table workflow_instances is
  'Durable workflow envelope for RybexOS operating actions. Mirrors OperatingWorkflow without replacing source module records.';

comment on table workflow_transactions is
  'Durable transaction history for workflow movement. Future write implementations should also create audit_events and status_history rows.';

comment on table workflow_evidence_requirements is
  'Evidence checklist needed to complete a workflow transaction or gate/status movement.';

comment on table workflow_source_links is
  'Controlled source links from workflow instances to canonical source records. Use explicit domain join tables for high-value canonical relationships when available.';

-- Future RLS notes:
-- - workflow_instances, workflow_signals, workflow_transactions,
--   workflow_evidence_requirements, and workflow_source_links are
--   organization/workspace scoped.
-- - Project-linked workflows should require project access plus module
--   permission for the target workflow type.
-- - workflow_transactions should be append-only for non-admin users once
--   production writes are enabled.
-- - Audit and status-history visibility should follow the workflow instance and
--   related source record visibility.
-- - Attachment access must inherit from workflow_evidence_requirements and the
--   linked source entity.
-- - Do not enable RLS until authentication, memberships, claims, and policy
--   tests exist.
