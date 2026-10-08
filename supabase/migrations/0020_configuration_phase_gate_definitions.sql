-- Configuration Foundation 0020 - Phase and gate definitions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Configures lifecycle phases, gates, questions, evidence requirements, and outcomes.

create table if not exists config_phase_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  phase_key text not null,
  label text not null,
  sort_order integer not null default 0,
  status text not null default 'draft',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_phase_definitions_configuration_version_id_phase_key_key unique (configuration_version_id, phase_key),
  constraint config_phase_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_phase_definitions_phase_key_format_check check (phase_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_phase_definitions_sort_order_check check (sort_order >= 0),
  constraint config_phase_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_phase_definitions_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create table if not exists config_gate_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  phase_id uuid not null,
  gate_key text not null,
  label text not null,
  purpose text not null,
  sort_order integer not null default 0,
  status text not null default 'draft',
  entry_rule_json jsonb not null default '{}'::jsonb,
  exit_rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_gate_definitions_configuration_version_id_gate_key_key unique (configuration_version_id, gate_key),
  constraint config_gate_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_gate_definitions_phase_same_configuration_fkey
    foreign key (phase_id, configuration_version_id) references config_phase_definitions(id, configuration_version_id) on delete restrict,
  constraint config_gate_definitions_gate_key_format_check check (gate_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_gate_definitions_sort_order_check check (sort_order >= 0),
  constraint config_gate_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_gate_definitions_entry_rule_object_check check (jsonb_typeof(entry_rule_json) = 'object'),
  constraint config_gate_definitions_exit_rule_object_check check (jsonb_typeof(exit_rule_json) = 'object')
);

create table if not exists config_gate_questions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  gate_id uuid not null,
  question_key text not null,
  prompt text not null,
  sort_order integer not null default 0,
  required boolean not null default false,
  validation_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_gate_questions_gate_id_question_key_key unique (gate_id, question_key),
  constraint config_gate_questions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_gate_questions_gate_same_configuration_fkey
    foreign key (gate_id, configuration_version_id) references config_gate_definitions(id, configuration_version_id) on delete restrict,
  constraint config_gate_questions_question_key_format_check check (question_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_gate_questions_sort_order_check check (sort_order >= 0),
  constraint config_gate_questions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_gate_questions_validation_object_check check (jsonb_typeof(validation_json) = 'object')
);

create table if not exists config_gate_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  gate_id uuid not null,
  evidence_type_id uuid not null,
  requirement_level text not null default 'required',
  blocking_rule_json jsonb not null default '{"blocks_gate":true,"condition":"missing"}'::jsonb,
  applies_to_class_key text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_gate_evidence_requirements_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_gate_evidence_requirements_gate_same_configuration_fkey
    foreign key (gate_id, configuration_version_id) references config_gate_definitions(id, configuration_version_id) on delete restrict,
  constraint config_gate_evidence_requirements_level_check check (requirement_level in ('required','optional','conditional','blocking')),
  constraint config_gate_evidence_requirements_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_gate_evidence_requirements_blocking_rule_object_check check (jsonb_typeof(blocking_rule_json) = 'object')
);

create index if not exists config_gate_evidence_requirements_gate_id_idx
  on config_gate_evidence_requirements(gate_id);

create index if not exists config_gate_evidence_requirements_evidence_type_id_idx
  on config_gate_evidence_requirements(evidence_type_id);

create table if not exists config_gate_decision_outcomes (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  gate_id uuid not null,
  outcome_key text not null,
  label text not null,
  outcome_type text not null,
  target_gate_key text,
  requires_confirmation boolean not null default false,
  consequence_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_gate_decision_outcomes_gate_id_outcome_key_key unique (gate_id, outcome_key),
  constraint config_gate_decision_outcomes_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_gate_decision_outcomes_gate_same_configuration_fkey
    foreign key (gate_id, configuration_version_id) references config_gate_definitions(id, configuration_version_id) on delete restrict,
  constraint config_gate_decision_outcomes_target_gate_same_configuration_fkey
    foreign key (configuration_version_id, target_gate_key) references config_gate_definitions(configuration_version_id, gate_key) on delete restrict,
  constraint config_gate_decision_outcomes_outcome_key_format_check check (outcome_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_gate_decision_outcomes_outcome_type_check check (outcome_type in ('approve','hold','stop','recycle','handoff','terminal','exception')),
  constraint config_gate_decision_outcomes_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_gate_decision_outcomes_consequence_object_check check (jsonb_typeof(consequence_json) = 'object')
);

create index if not exists config_phase_definitions_configuration_version_id_idx on config_phase_definitions(configuration_version_id);
create index if not exists config_gate_definitions_configuration_version_id_idx on config_gate_definitions(configuration_version_id);
create index if not exists config_gate_definitions_phase_id_idx on config_gate_definitions(phase_id);
create index if not exists config_gate_questions_configuration_version_id_idx on config_gate_questions(configuration_version_id);
create index if not exists config_gate_questions_gate_id_idx on config_gate_questions(gate_id);
create index if not exists config_gate_decision_outcomes_configuration_version_id_idx on config_gate_decision_outcomes(configuration_version_id);
create index if not exists config_gate_decision_outcomes_gate_id_idx on config_gate_decision_outcomes(gate_id);

alter table config_phase_definitions enable row level security;
alter table config_gate_definitions enable row level security;
alter table config_gate_questions enable row level security;
alter table config_gate_evidence_requirements enable row level security;
alter table config_gate_decision_outcomes enable row level security;

drop policy if exists config_phase_definitions_select on config_phase_definitions;
create policy config_phase_definitions_select on config_phase_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_phase_definitions_insert on config_phase_definitions;
create policy config_phase_definitions_insert on config_phase_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_phase_definitions_update on config_phase_definitions;
create policy config_phase_definitions_update on config_phase_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_phase_definitions_no_delete on config_phase_definitions;
create policy config_phase_definitions_no_delete on config_phase_definitions for delete to authenticated using (false);

drop policy if exists config_gate_definitions_select on config_gate_definitions;
create policy config_gate_definitions_select on config_gate_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_gate_definitions_insert on config_gate_definitions;
create policy config_gate_definitions_insert on config_gate_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_gate_definitions_update on config_gate_definitions;
create policy config_gate_definitions_update on config_gate_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_gate_definitions_no_delete on config_gate_definitions;
create policy config_gate_definitions_no_delete on config_gate_definitions for delete to authenticated using (false);

drop policy if exists config_gate_questions_select on config_gate_questions;
create policy config_gate_questions_select on config_gate_questions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_gate_questions_insert on config_gate_questions;
create policy config_gate_questions_insert on config_gate_questions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_gate_questions_update on config_gate_questions;
create policy config_gate_questions_update on config_gate_questions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_gate_questions_no_delete on config_gate_questions;
create policy config_gate_questions_no_delete on config_gate_questions for delete to authenticated using (false);

drop policy if exists config_gate_evidence_requirements_select on config_gate_evidence_requirements;
create policy config_gate_evidence_requirements_select on config_gate_evidence_requirements for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_gate_evidence_requirements_insert on config_gate_evidence_requirements;
create policy config_gate_evidence_requirements_insert on config_gate_evidence_requirements for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_gate_evidence_requirements_update on config_gate_evidence_requirements;
create policy config_gate_evidence_requirements_update on config_gate_evidence_requirements for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_gate_evidence_requirements_no_delete on config_gate_evidence_requirements;
create policy config_gate_evidence_requirements_no_delete on config_gate_evidence_requirements for delete to authenticated using (false);

drop policy if exists config_gate_decision_outcomes_select on config_gate_decision_outcomes;
create policy config_gate_decision_outcomes_select on config_gate_decision_outcomes for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_gate_decision_outcomes_insert on config_gate_decision_outcomes;
create policy config_gate_decision_outcomes_insert on config_gate_decision_outcomes for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_gate_decision_outcomes_update on config_gate_decision_outcomes;
create policy config_gate_decision_outcomes_update on config_gate_decision_outcomes for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_gate_decision_outcomes_no_delete on config_gate_decision_outcomes;
create policy config_gate_decision_outcomes_no_delete on config_gate_decision_outcomes for delete to authenticated using (false);

comment on table config_gate_definitions is
  'Configurable gate definitions. Gate behavior remains data/configuration and does not implement runtime gate execution.';
