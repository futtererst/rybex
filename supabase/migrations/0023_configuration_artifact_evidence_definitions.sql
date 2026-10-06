-- Configuration Foundation 0023 - Artifact and evidence definitions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Defines configurable evidence/artifact registries without creating runtime evidence records.

create table if not exists config_artifact_type_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  artifact_type_key text not null,
  label text not null,
  phase_definition_id uuid,
  owner_role_key text,
  approver_role_key text,
  system_of_record text,
  template_link text,
  completion_rule_json jsonb not null default '{}'::jsonb,
  retention_rule_json jsonb not null default '{}'::jsonb,
  applicability_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_artifact_type_definitions_configuration_version_id_artifact_type_key_key unique (configuration_version_id, artifact_type_key),
  constraint config_artifact_type_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_artifact_type_definitions_phase_same_configuration_fkey
    foreign key (phase_definition_id, configuration_version_id) references config_phase_definitions(id, configuration_version_id) on delete restrict,
  constraint config_artifact_type_definitions_owner_role_same_configuration_fkey
    foreign key (configuration_version_id, owner_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_artifact_type_definitions_approver_role_same_configuration_fkey
    foreign key (configuration_version_id, approver_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_artifact_type_definitions_key_format_check check (artifact_type_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_artifact_type_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_artifact_type_definitions_completion_object_check check (jsonb_typeof(completion_rule_json) = 'object'),
  constraint config_artifact_type_definitions_retention_object_check check (jsonb_typeof(retention_rule_json) = 'object'),
  constraint config_artifact_type_definitions_applicability_object_check check (jsonb_typeof(applicability_json) = 'object')
);

create table if not exists config_evidence_type_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  evidence_type_key text not null,
  label text not null,
  artifact_type_definition_id uuid,
  claim_tie_rule_json jsonb not null default '{}'::jsonb,
  completion_rule_json jsonb not null default '{}'::jsonb,
  validation_rule_json jsonb not null default '{}'::jsonb,
  owner_role_key text,
  approver_role_key text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_evidence_type_definitions_configuration_version_id_evidence_type_key_key unique (configuration_version_id, evidence_type_key),
  constraint config_evidence_type_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_evidence_type_definitions_artifact_same_configuration_fkey
    foreign key (artifact_type_definition_id, configuration_version_id) references config_artifact_type_definitions(id, configuration_version_id) on delete restrict,
  constraint config_evidence_type_definitions_owner_role_same_configuration_fkey
    foreign key (configuration_version_id, owner_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_evidence_type_definitions_approver_role_same_configuration_fkey
    foreign key (configuration_version_id, approver_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_evidence_type_definitions_key_format_check check (evidence_type_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_evidence_type_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_evidence_type_definitions_claim_tie_object_check check (jsonb_typeof(claim_tie_rule_json) = 'object'),
  constraint config_evidence_type_definitions_completion_object_check check (jsonb_typeof(completion_rule_json) = 'object'),
  constraint config_evidence_type_definitions_validation_object_check check (jsonb_typeof(validation_rule_json) = 'object')
);

alter table config_gate_evidence_requirements
  drop constraint if exists config_gate_evidence_requirements_evidence_type_id_fkey;

alter table config_gate_evidence_requirements
  add constraint config_gate_evidence_requirements_evidence_type_id_fkey
  foreign key (evidence_type_id, configuration_version_id) references config_evidence_type_definitions(id, configuration_version_id) on delete restrict;

create index if not exists config_artifact_type_definitions_configuration_version_id_idx on config_artifact_type_definitions(configuration_version_id);
create index if not exists config_evidence_type_definitions_configuration_version_id_idx on config_evidence_type_definitions(configuration_version_id);
create index if not exists config_evidence_type_definitions_artifact_type_definition_id_idx on config_evidence_type_definitions(artifact_type_definition_id);

alter table config_artifact_type_definitions enable row level security;
alter table config_evidence_type_definitions enable row level security;

drop policy if exists config_artifact_type_definitions_select on config_artifact_type_definitions;
create policy config_artifact_type_definitions_select on config_artifact_type_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_artifact_type_definitions_insert on config_artifact_type_definitions;
create policy config_artifact_type_definitions_insert on config_artifact_type_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_artifact_type_definitions_update on config_artifact_type_definitions;
create policy config_artifact_type_definitions_update on config_artifact_type_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_artifact_type_definitions_no_delete on config_artifact_type_definitions;
create policy config_artifact_type_definitions_no_delete on config_artifact_type_definitions for delete to authenticated using (false);

drop policy if exists config_evidence_type_definitions_select on config_evidence_type_definitions;
create policy config_evidence_type_definitions_select on config_evidence_type_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_evidence_type_definitions_insert on config_evidence_type_definitions;
create policy config_evidence_type_definitions_insert on config_evidence_type_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_evidence_type_definitions_update on config_evidence_type_definitions;
create policy config_evidence_type_definitions_update on config_evidence_type_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_evidence_type_definitions_no_delete on config_evidence_type_definitions;
create policy config_evidence_type_definitions_no_delete on config_evidence_type_definitions for delete to authenticated using (false);

comment on table config_evidence_type_definitions is
  'Configurable evidence type registry. Evidence requirements stay claim-tied rather than generic attachment-only behavior.';
