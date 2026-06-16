-- RybexOS Persistence Phase 2
-- D1 Pipeline + D2 Project Setup schema scaffold only.
--
-- Runtime remains seed-backed by default. Do not enable database mode until a
-- future repository pilot is configured and verified.
--
-- RLS is intentionally not enabled in this migration. Auth, workspace claims,
-- membership policies, and policy tests must be added before RLS is activated.

-- Phase 1 already created opportunities, projects, go_no_go_scores, and
-- go_no_go_score_dimensions. This migration only extends missing score columns
-- and adds D1/D2 supporting tables.

alter table go_no_go_scores
  add column if not exists decision text,
  add column if not exists decision_date date;

alter table go_no_go_score_dimensions
  add column if not exists weight numeric(6,2);

comment on column go_no_go_score_dimensions.dimension_key is
  'Approved go/no-go score dimension such as strategic_fit, execution_fit, commercial_fit, or risk_exposure.';

create table if not exists opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  document_type text not null,
  title text not null,
  status text not null default 'received',
  received_date date,
  attachment_id uuid references attachments(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists opportunity_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  reviewer_role text not null,
  reviewer_name text,
  reviewer_id uuid references user_profiles(id) on delete set null,
  review_status text not null default 'pending',
  recommendation text,
  reviewed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contract_baselines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  contract_status text not null default 'not_started',
  contract_value numeric(14,2) not null default 0,
  original_estimate_value numeric(14,2),
  retainage_percent numeric(5,2),
  payment_terms text,
  notice_requirements_summary text,
  change_order_terms text,
  schedule_penalty_exposure text,
  insurance_requirements text,
  bonding_requirements text,
  certified_payroll_required boolean not null default false,
  review_notes text,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scope_matrix_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  item_type text not null,
  title text not null,
  description text,
  owner text,
  owner_id uuid references user_profiles(id) on delete set null,
  status text not null default 'open',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budget_baselines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft',
  original_estimate_value numeric(14,2),
  approved_budget_value numeric(14,2),
  contingency_value numeric(14,2),
  margin_target_percent numeric(5,2),
  approved_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budget_baseline_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  budget_baseline_id uuid not null references budget_baselines(id) on delete cascade,
  cost_code text,
  category text not null,
  description text not null,
  amount numeric(14,2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists schedule_baselines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft',
  planned_start_date date,
  planned_finish_date date,
  approved_at timestamptz,
  constraints_summary text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists schedule_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  schedule_baseline_id uuid not null references schedule_baselines(id) on delete cascade,
  milestone_name text not null,
  milestone_type text,
  planned_date date,
  owner text,
  owner_id uuid references user_profiles(id) on delete set null,
  status text not null default 'planned',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists flow_down_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  obligation_type text not null,
  title text not null,
  description text,
  source_reference text,
  owner text,
  owner_id uuid references user_profiles(id) on delete set null,
  due_date date,
  status text not null default 'open',
  risk_level text not null default 'moderate',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notice_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  notice_type text not null,
  trigger_event text not null,
  deadline_days integer,
  delivery_method text,
  responsible_role text,
  risk_if_missed text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_setup_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  artifact_type text not null,
  title text not null,
  status text not null default 'missing',
  required_for_d2_gate boolean not null default true,
  owner text,
  owner_id uuid references user_profiles(id) on delete set null,
  due_date date,
  attachment_id uuid references attachments(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunity_documents_org_workspace_idx on opportunity_documents(organization_id, workspace_id);
create index if not exists opportunity_documents_opportunity_idx on opportunity_documents(opportunity_id);
create index if not exists opportunity_documents_type_status_idx on opportunity_documents(document_type, status);
create index if not exists opportunity_documents_received_date_idx on opportunity_documents(received_date);

create index if not exists opportunity_reviews_org_workspace_idx on opportunity_reviews(organization_id, workspace_id);
create index if not exists opportunity_reviews_opportunity_idx on opportunity_reviews(opportunity_id);
create index if not exists opportunity_reviews_role_status_idx on opportunity_reviews(reviewer_role, review_status);
create index if not exists opportunity_reviews_reviewed_at_idx on opportunity_reviews(reviewed_at);

create index if not exists go_no_go_scores_decision_idx on go_no_go_scores(decision);
create index if not exists go_no_go_scores_decision_date_idx on go_no_go_scores(decision_date);

create index if not exists contract_baselines_project_status_idx on contract_baselines(project_id, contract_status);
create index if not exists contract_baselines_org_workspace_idx on contract_baselines(organization_id, workspace_id);

create index if not exists scope_matrix_items_project_type_idx on scope_matrix_items(project_id, item_type);
create index if not exists scope_matrix_items_status_idx on scope_matrix_items(status);

create index if not exists budget_baselines_project_status_idx on budget_baselines(project_id, status);
create index if not exists budget_baseline_items_baseline_idx on budget_baseline_items(budget_baseline_id);
create index if not exists budget_baseline_items_project_category_idx on budget_baseline_items(project_id, category);

create index if not exists schedule_baselines_project_status_idx on schedule_baselines(project_id, status);
create index if not exists schedule_baselines_start_finish_idx on schedule_baselines(planned_start_date, planned_finish_date);
create index if not exists schedule_milestones_baseline_idx on schedule_milestones(schedule_baseline_id);
create index if not exists schedule_milestones_project_date_idx on schedule_milestones(project_id, planned_date);

create index if not exists flow_down_obligations_project_status_idx on flow_down_obligations(project_id, status);
create index if not exists flow_down_obligations_due_date_idx on flow_down_obligations(due_date);
create index if not exists flow_down_obligations_type_idx on flow_down_obligations(obligation_type);

create index if not exists notice_requirements_project_type_idx on notice_requirements(project_id, notice_type);

create index if not exists project_setup_artifacts_project_status_idx on project_setup_artifacts(project_id, status);
create index if not exists project_setup_artifacts_type_idx on project_setup_artifacts(artifact_type);
create index if not exists project_setup_artifacts_due_date_idx on project_setup_artifacts(due_date);

create trigger set_opportunity_documents_updated_at before update on opportunity_documents for each row execute function set_updated_at();
create trigger set_opportunity_reviews_updated_at before update on opportunity_reviews for each row execute function set_updated_at();
create trigger set_contract_baselines_updated_at before update on contract_baselines for each row execute function set_updated_at();
create trigger set_scope_matrix_items_updated_at before update on scope_matrix_items for each row execute function set_updated_at();
create trigger set_budget_baselines_updated_at before update on budget_baselines for each row execute function set_updated_at();
create trigger set_budget_baseline_items_updated_at before update on budget_baseline_items for each row execute function set_updated_at();
create trigger set_schedule_baselines_updated_at before update on schedule_baselines for each row execute function set_updated_at();
create trigger set_schedule_milestones_updated_at before update on schedule_milestones for each row execute function set_updated_at();
create trigger set_flow_down_obligations_updated_at before update on flow_down_obligations for each row execute function set_updated_at();
create trigger set_notice_requirements_updated_at before update on notice_requirements for each row execute function set_updated_at();
create trigger set_project_setup_artifacts_updated_at before update on project_setup_artifacts for each row execute function set_updated_at();

-- Future RLS notes:
-- - All tables in this migration are organization/workspace scoped.
-- - D1 records should be readable by users with view_pipeline permission inside the workspace.
-- - D2 records should be readable by users with view_projects permission and project access.
-- - Finance-sensitive contract/budget fields should receive additional policies before production use.
-- - Attachment references must inherit access from the linked opportunity/project artifact.
-- - Writes, approvals, and status changes must create audit_events and status_history rows in a later phase.
