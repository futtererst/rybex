-- Configuration Foundation 0022 - Role, permission, and decision-right definitions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Defines configurable authority models without granting runtime decision execution.

create table if not exists config_role_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  role_key text not null,
  label text not null,
  role_family text not null default 'configured',
  description text,
  alias_keys text[] not null default '{}'::text[],
  eligibility_rule_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_role_definitions_configuration_version_id_role_key_key unique (configuration_version_id, role_key),
  constraint config_role_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_role_definitions_role_key_format_check check (role_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_role_definitions_role_family_check check (role_family in ('configured','system','auditor','administrator')),
  constraint config_role_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_role_definitions_eligibility_object_check check (jsonb_typeof(eligibility_rule_json) = 'object')
);

alter table config_workstreams
  drop constraint if exists config_workstreams_owner_role_same_configuration_fkey;

alter table config_workstreams
  add constraint config_workstreams_owner_role_same_configuration_fkey
  foreign key (configuration_version_id, owner_role_key)
  references config_role_definitions(configuration_version_id, role_key) on delete restrict;

alter table config_service_lanes
  drop constraint if exists config_service_lanes_owner_role_same_configuration_fkey;

alter table config_service_lanes
  add constraint config_service_lanes_owner_role_same_configuration_fkey
  foreign key (configuration_version_id, owner_role_key)
  references config_role_definitions(configuration_version_id, role_key) on delete restrict;

create table if not exists config_permission_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  permission_key text not null,
  label text not null,
  permission_scope text not null,
  description text,
  default_grant_rule_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_permission_definitions_configuration_version_id_permission_key_key unique (configuration_version_id, permission_key),
  constraint config_permission_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_permission_definitions_permission_key_format_check check (permission_key ~ '^[a-z0-9][a-z0-9_.:-]*$'),
  constraint config_permission_definitions_permission_scope_check check (permission_scope in ('tenant','organization','operating_entity','workstream','gate','artifact','decision','audit')),
  constraint config_permission_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_permission_definitions_grant_rule_object_check check (jsonb_typeof(default_grant_rule_json) = 'object')
);

create table if not exists config_decision_right_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  decision_right_key text not null,
  label text not null,
  role_definition_id uuid,
  permission_definition_id uuid,
  gate_definition_id uuid,
  outcome_key text,
  record_scope_json jsonb not null default '{}'::jsonb,
  approval_rule_json jsonb not null default '{}'::jsonb,
  admin_override_allowed boolean not null default false,
  auditor_read_only boolean not null default false,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_decision_right_definitions_configuration_version_id_decision_right_key_key unique (configuration_version_id, decision_right_key),
  constraint config_decision_right_definitions_role_same_configuration_fkey
    foreign key (role_definition_id, configuration_version_id) references config_role_definitions(id, configuration_version_id) on delete restrict,
  constraint config_decision_right_definitions_permission_same_configuration_fkey
    foreign key (permission_definition_id, configuration_version_id) references config_permission_definitions(id, configuration_version_id) on delete restrict,
  constraint config_decision_right_definitions_gate_same_configuration_fkey
    foreign key (gate_definition_id, configuration_version_id) references config_gate_definitions(id, configuration_version_id) on delete restrict,
  constraint config_decision_right_definitions_outcome_requires_gate_check check (
    outcome_key is null or gate_definition_id is not null
  ),
  constraint config_decision_right_definitions_outcome_same_gate_fkey
    foreign key (gate_definition_id, outcome_key) references config_gate_decision_outcomes(gate_id, outcome_key) on delete restrict,
  constraint config_decision_right_definitions_key_format_check check (decision_right_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_decision_right_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_decision_right_definitions_record_scope_object_check check (jsonb_typeof(record_scope_json) = 'object'),
  constraint config_decision_right_definitions_approval_rule_object_check check (jsonb_typeof(approval_rule_json) = 'object'),
  constraint config_decision_right_definitions_auditor_no_override_check check (not (auditor_read_only and admin_override_allowed))
);

create index if not exists config_role_definitions_configuration_version_id_idx on config_role_definitions(configuration_version_id);
create index if not exists config_permission_definitions_configuration_version_id_idx on config_permission_definitions(configuration_version_id);
create index if not exists config_decision_right_definitions_configuration_version_id_idx on config_decision_right_definitions(configuration_version_id);
create index if not exists config_decision_right_definitions_gate_definition_id_idx on config_decision_right_definitions(gate_definition_id);

alter table config_role_definitions enable row level security;
alter table config_permission_definitions enable row level security;
alter table config_decision_right_definitions enable row level security;

drop policy if exists config_role_definitions_select on config_role_definitions;
create policy config_role_definitions_select on config_role_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_role_definitions_insert on config_role_definitions;
create policy config_role_definitions_insert on config_role_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_role_definitions_update on config_role_definitions;
create policy config_role_definitions_update on config_role_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_role_definitions_no_delete on config_role_definitions;
create policy config_role_definitions_no_delete on config_role_definitions for delete to authenticated using (false);

drop policy if exists config_permission_definitions_select on config_permission_definitions;
create policy config_permission_definitions_select on config_permission_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_permission_definitions_insert on config_permission_definitions;
create policy config_permission_definitions_insert on config_permission_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_permission_definitions_update on config_permission_definitions;
create policy config_permission_definitions_update on config_permission_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_permission_definitions_no_delete on config_permission_definitions;
create policy config_permission_definitions_no_delete on config_permission_definitions for delete to authenticated using (false);

drop policy if exists config_decision_right_definitions_select on config_decision_right_definitions;
create policy config_decision_right_definitions_select on config_decision_right_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_decision_right_definitions_insert on config_decision_right_definitions;
create policy config_decision_right_definitions_insert on config_decision_right_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_decision_right_definitions_update on config_decision_right_definitions;
create policy config_decision_right_definitions_update on config_decision_right_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_decision_right_definitions_no_delete on config_decision_right_definitions;
create policy config_decision_right_definitions_no_delete on config_decision_right_definitions for delete to authenticated using (false);

comment on table config_decision_right_definitions is
  'Configurable decision-right definitions. Admin eligibility remains record-scoped and does not imply automatic gate authority.';
