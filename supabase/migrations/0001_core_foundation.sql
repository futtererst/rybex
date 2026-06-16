-- RybexOS Persistence Foundation Phase 1
-- Core tables only. Runtime remains seed-backed unless a future phase explicitly
-- enables database repositories behind RYBEXOS_DATA_SOURCE=database.
--
-- RLS is intentionally not enabled in this migration. Auth and policy tests must
-- be added before RLS is activated.

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  workspace_id uuid references workspaces(id) on delete set null,
  auth_user_id uuid unique,
  email text,
  display_name text not null,
  title text,
  default_role text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table organizations
  add constraint organizations_created_by_fkey foreign key (created_by) references user_profiles(id) on delete set null,
  add constraint organizations_updated_by_fkey foreign key (updated_by) references user_profiles(id) on delete set null;

alter table workspaces
  add constraint workspaces_created_by_fkey foreign key (created_by) references user_profiles(id) on delete set null,
  add constraint workspaces_updated_by_fkey foreign key (updated_by) references user_profiles(id) on delete set null;

alter table user_profiles
  add constraint user_profiles_created_by_fkey foreign key (created_by) references user_profiles(id) on delete set null,
  add constraint user_profiles_updated_by_fkey foreign key (updated_by) references user_profiles(id) on delete set null;

create table if not exists workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_profile_id uuid not null references user_profiles(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_profile_id)
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  gc_client text not null,
  owner_or_prime text,
  project_location text,
  project_type text,
  status text not null default 'new_intake',
  d5o_phase text not null default 'discover',
  estimated_value numeric(14,2),
  bid_due_date date,
  received_date date,
  pursuit_owner_id uuid references user_profiles(id) on delete set null,
  estimator_id uuid references user_profiles(id) on delete set null,
  probability integer,
  risk_level text,
  decision text,
  decision_date date,
  next_action text,
  scope_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_opportunity_id uuid references opportunities(id) on delete set null,
  project_number text,
  name text not null,
  gc_client text not null,
  owner_or_prime text,
  location text,
  project_type text,
  d5o_phase text not null default 'define',
  health_status text not null default 'on_track',
  contract_status text default 'not_started',
  contract_value numeric(14,2) default 0,
  next_milestone text,
  next_action text,
  project_manager_id uuid references user_profiles(id) on delete set null,
  superintendent_id uuid references user_profiles(id) on delete set null,
  operations_lead_id uuid references user_profiles(id) on delete set null,
  finance_owner_id uuid references user_profiles(id) on delete set null,
  safety_owner_id uuid references user_profiles(id) on delete set null,
  quality_owner_id uuid references user_profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists d5o_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  phase_id text not null,
  gate_name text not null,
  status text not null default 'pending',
  readiness_percent integer not null default 0,
  owner_id uuid references user_profiles(id) on delete set null,
  approver_id uuid references user_profiles(id) on delete set null,
  approved_at timestamptz,
  next_action text,
  readiness_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, phase_id)
);

create table if not exists gate_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  gate_id uuid not null references d5o_gates(id) on delete cascade,
  name text not null,
  artifact_type text,
  status text not null default 'missing',
  owner_id uuid references user_profiles(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  waived_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  title text not null,
  category text,
  severity text not null default 'medium',
  status text not null default 'open',
  owner_id uuid references user_profiles(id) on delete set null,
  mitigation text,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  severity text not null default 'medium',
  owner_id uuid references user_profiles(id) on delete set null,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  title text not null,
  decision_type text,
  status text not null default 'pending',
  owner_id uuid references user_profiles(id) on delete set null,
  due_date date,
  decided_at timestamptz,
  outcome text,
  required_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists go_no_go_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  total_score integer not null,
  recommendation text not null,
  risk_level text not null,
  strengths jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  required_mitigations jsonb not null default '[]'::jsonb,
  required_approvals jsonb not null default '[]'::jsonb,
  score_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists go_no_go_score_dimensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  score_id uuid not null references go_no_go_scores(id) on delete cascade,
  dimension_key text not null,
  label text not null,
  score integer not null,
  rationale text,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (score_id, dimension_key)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_role text,
  actor_name text,
  actor_user_id uuid references user_profiles(id) on delete set null,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  severity text default 'info',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references user_profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text,
  related_audit_event_id uuid references audit_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  storage_provider text not null default 'private_object_storage',
  bucket text,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  version integer not null default 1,
  checksum text,
  status text not null default 'active',
  is_private boolean not null default true,
  virus_scan_status text not null default 'not_scanned',
  retention_policy text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entity_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  attachment_id uuid not null references attachments(id) on delete cascade,
  relationship_type text not null default 'evidence',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, attachment_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  summary text not null,
  actor_user_id uuid references user_profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_organization_id_idx on workspaces(organization_id);
create index if not exists user_profiles_organization_id_idx on user_profiles(organization_id);
create index if not exists workspace_memberships_workspace_id_idx on workspace_memberships(workspace_id);
create index if not exists workspace_memberships_user_profile_id_idx on workspace_memberships(user_profile_id);
create index if not exists opportunities_org_workspace_status_idx on opportunities(organization_id, workspace_id, status);
create index if not exists opportunities_bid_due_date_idx on opportunities(bid_due_date);
create index if not exists projects_org_workspace_phase_idx on projects(organization_id, workspace_id, d5o_phase);
create index if not exists projects_health_status_idx on projects(health_status);
create index if not exists d5o_gates_project_phase_idx on d5o_gates(project_id, phase_id);
create index if not exists gate_artifacts_gate_status_idx on gate_artifacts(gate_id, status);
create index if not exists project_risks_project_status_idx on project_risks(project_id, status);
create index if not exists project_issues_project_status_idx on project_issues(project_id, status);
create index if not exists project_decisions_project_due_idx on project_decisions(project_id, due_date);
create index if not exists go_no_go_scores_opportunity_id_idx on go_no_go_scores(opportunity_id);
create index if not exists go_no_go_score_dimensions_score_id_idx on go_no_go_score_dimensions(score_id);
create index if not exists audit_events_entity_idx on audit_events(entity_type, entity_id);
create index if not exists audit_events_project_created_idx on audit_events(project_id, created_at);
create index if not exists status_history_entity_idx on status_history(entity_type, entity_id);
create index if not exists status_history_project_changed_idx on status_history(project_id, changed_at);
create index if not exists attachments_project_id_idx on attachments(project_id);
create index if not exists entity_attachments_entity_idx on entity_attachments(entity_type, entity_id);
create index if not exists entity_attachments_attachment_id_idx on entity_attachments(attachment_id);
create index if not exists comments_entity_idx on comments(entity_type, entity_id);
create index if not exists activity_events_entity_idx on activity_events(entity_type, entity_id);
create index if not exists activity_events_project_created_idx on activity_events(project_id, created_at);

create trigger set_organizations_updated_at before update on organizations for each row execute function set_updated_at();
create trigger set_workspaces_updated_at before update on workspaces for each row execute function set_updated_at();
create trigger set_user_profiles_updated_at before update on user_profiles for each row execute function set_updated_at();
create trigger set_workspace_memberships_updated_at before update on workspace_memberships for each row execute function set_updated_at();
create trigger set_opportunities_updated_at before update on opportunities for each row execute function set_updated_at();
create trigger set_projects_updated_at before update on projects for each row execute function set_updated_at();
create trigger set_d5o_gates_updated_at before update on d5o_gates for each row execute function set_updated_at();
create trigger set_gate_artifacts_updated_at before update on gate_artifacts for each row execute function set_updated_at();
create trigger set_project_risks_updated_at before update on project_risks for each row execute function set_updated_at();
create trigger set_project_issues_updated_at before update on project_issues for each row execute function set_updated_at();
create trigger set_project_decisions_updated_at before update on project_decisions for each row execute function set_updated_at();
create trigger set_go_no_go_scores_updated_at before update on go_no_go_scores for each row execute function set_updated_at();
create trigger set_go_no_go_score_dimensions_updated_at before update on go_no_go_score_dimensions for each row execute function set_updated_at();
create trigger set_attachments_updated_at before update on attachments for each row execute function set_updated_at();
create trigger set_entity_attachments_updated_at before update on entity_attachments for each row execute function set_updated_at();
create trigger set_comments_updated_at before update on comments for each row execute function set_updated_at();

-- Future RLS notes:
-- - organizations, workspaces, user_profiles, workspace_memberships require organization/workspace membership policies.
-- - opportunities, projects, d5o_gates, gate_artifacts, risks, issues, and decisions require organization/workspace/project policies.
-- - audit_events and status_history should be readable only by admin and authorized project leadership.
-- - attachments and entity_attachments must inherit access from the linked entity and private storage path.
-- - comments and activity_events should be scoped by organization/workspace/project and linked entity access.
-- - Do not enable RLS until authentication, membership claims, and policy tests are implemented.
