-- Configuration Foundation 0024 - KPI, financial, workforce, handoff, governance, and exception definitions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Keeps optional modules configurable and does not create runtime dashboard, workforce, or delivery behavior.

create table if not exists config_kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  kpi_key text not null,
  label text not null,
  formula_json jsonb not null default '{}'::jsonb,
  owner_role_key text,
  frequency text,
  data_source_json jsonb not null default '{}'::jsonb,
  threshold_json jsonb not null default '{}'::jsonb,
  trend_direction text,
  action_trigger_json jsonb not null default '{}'::jsonb,
  baseline_mode text not null default 'startup_no_history',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_kpi_definitions_configuration_version_id_kpi_key_key unique (configuration_version_id, kpi_key),
  constraint config_kpi_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_kpi_definitions_owner_role_same_configuration_fkey
    foreign key (configuration_version_id, owner_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_kpi_definitions_key_format_check check (kpi_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_kpi_definitions_baseline_mode_check check (baseline_mode in ('startup_no_history','mature_historical_baseline','prospective_baseline')),
  constraint config_kpi_definitions_trend_direction_check check (trend_direction is null or trend_direction in ('higher_is_better','lower_is_better','target_band')),
  constraint config_kpi_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_kpi_definitions_formula_object_check check (jsonb_typeof(formula_json) = 'object'),
  constraint config_kpi_definitions_data_source_object_check check (jsonb_typeof(data_source_json) = 'object'),
  constraint config_kpi_definitions_threshold_object_check check (jsonb_typeof(threshold_json) = 'object'),
  constraint config_kpi_definitions_action_trigger_object_check check (jsonb_typeof(action_trigger_json) = 'object')
);

create table if not exists config_financial_model_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  financial_model_key text not null,
  label text not null,
  formula_json jsonb not null default '{}'::jsonb,
  required_field_json jsonb not null default '{"fields":[]}'::jsonb,
  baseline_mode text not null default 'prospective_baseline',
  currency_rule_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_financial_model_definitions_configuration_version_id_financial_model_key_key unique (configuration_version_id, financial_model_key),
  constraint config_financial_model_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_financial_model_definitions_key_format_check check (financial_model_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_financial_model_definitions_baseline_mode_check check (baseline_mode in ('startup_no_history','mature_historical_baseline','prospective_baseline')),
  constraint config_financial_model_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_financial_model_definitions_formula_object_check check (jsonb_typeof(formula_json) = 'object'),
  constraint config_financial_model_definitions_required_field_object_check check (jsonb_typeof(required_field_json) = 'object'),
  constraint config_financial_model_definitions_currency_rule_object_check check (jsonb_typeof(currency_rule_json) = 'object')
);

create table if not exists config_workforce_qualification_rules (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  qualification_rule_key text not null,
  label text not null,
  skill_category text,
  task_authorization_json jsonb not null default '{}'::jsonb,
  expiration_rule_json jsonb not null default '{}'::jsonb,
  assignment_restriction_json jsonb not null default '{}'::jsonb,
  gate_dependency_json jsonb not null default '{}'::jsonb,
  optional_module boolean not null default true,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_workforce_qualification_rules_configuration_version_id_qualification_rule_key_key unique (configuration_version_id, qualification_rule_key),
  constraint config_workforce_qualification_rules_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_workforce_qualification_rules_key_format_check check (qualification_rule_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_workforce_qualification_rules_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_workforce_qualification_rules_task_object_check check (jsonb_typeof(task_authorization_json) = 'object'),
  constraint config_workforce_qualification_rules_expiration_object_check check (jsonb_typeof(expiration_rule_json) = 'object'),
  constraint config_workforce_qualification_rules_assignment_object_check check (jsonb_typeof(assignment_restriction_json) = 'object'),
  constraint config_workforce_qualification_rules_gate_object_check check (jsonb_typeof(gate_dependency_json) = 'object'),
  constraint config_workforce_qualification_rules_gate_json_empty_check check (gate_dependency_json = '{}'::jsonb)
);

create table if not exists config_handoff_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  handoff_key text not null,
  label text not null,
  sending_role_key text,
  receiving_role_key text,
  required_evidence_json jsonb not null default '{}'::jsonb,
  acceptance_criteria_json jsonb not null default '{}'::jsonb,
  escalation_path_json jsonb not null default '{}'::jsonb,
  open_condition_rule_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_handoff_definitions_configuration_version_id_handoff_key_key unique (configuration_version_id, handoff_key),
  constraint config_handoff_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_handoff_definitions_sending_role_same_configuration_fkey
    foreign key (configuration_version_id, sending_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_handoff_definitions_receiving_role_same_configuration_fkey
    foreign key (configuration_version_id, receiving_role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_handoff_definitions_key_format_check check (handoff_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_handoff_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_handoff_definitions_required_evidence_object_check check (jsonb_typeof(required_evidence_json) = 'object'),
  constraint config_handoff_definitions_required_evidence_json_empty_check check (required_evidence_json = '{}'::jsonb),
  constraint config_handoff_definitions_acceptance_object_check check (jsonb_typeof(acceptance_criteria_json) = 'object'),
  constraint config_handoff_definitions_escalation_object_check check (jsonb_typeof(escalation_path_json) = 'object'),
  constraint config_handoff_definitions_open_condition_object_check check (jsonb_typeof(open_condition_rule_json) = 'object')
);

create table if not exists config_governance_forum_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  forum_key text not null,
  label text not null,
  purpose text not null,
  cadence text,
  participant_role_keys text[] not null default '{}'::text[],
  required_input_json jsonb not null default '{}'::jsonb,
  required_output_json jsonb not null default '{}'::jsonb,
  decision_type_json jsonb not null default '{}'::jsonb,
  linked_kpi_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_governance_forum_definitions_configuration_version_id_forum_key_key unique (configuration_version_id, forum_key),
  constraint config_governance_forum_definitions_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_governance_forum_definitions_participant_roles_empty_check check (cardinality(participant_role_keys) = 0),
  constraint config_governance_forum_definitions_key_format_check check (forum_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_governance_forum_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_governance_forum_definitions_input_object_check check (jsonb_typeof(required_input_json) = 'object'),
  constraint config_governance_forum_definitions_output_object_check check (jsonb_typeof(required_output_json) = 'object'),
  constraint config_governance_forum_definitions_decision_object_check check (jsonb_typeof(decision_type_json) = 'object'),
  constraint config_governance_forum_definitions_kpi_object_check check (jsonb_typeof(linked_kpi_json) = 'object'),
  constraint config_governance_forum_definitions_linked_kpi_json_empty_check check (linked_kpi_json = '{}'::jsonb)
);

create table if not exists config_exception_rules (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  exception_rule_key text not null,
  label text not null,
  applies_to text not null,
  waiver_rule_json jsonb not null default '{}'::jsonb,
  override_rule_json jsonb not null default '{}'::jsonb,
  approval_rule_json jsonb not null default '{}'::jsonb,
  audit_rule_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_exception_rules_configuration_version_id_exception_rule_key_key unique (configuration_version_id, exception_rule_key),
  constraint config_exception_rules_id_configuration_version_id_key unique (id, configuration_version_id),
  constraint config_exception_rules_key_format_check check (exception_rule_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_exception_rules_applies_to_check check (applies_to in ('gate','evidence','artifact','decision','handoff','workforce','financial','kpi')),
  constraint config_exception_rules_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_exception_rules_waiver_object_check check (jsonb_typeof(waiver_rule_json) = 'object'),
  constraint config_exception_rules_override_object_check check (jsonb_typeof(override_rule_json) = 'object'),
  constraint config_exception_rules_approval_object_check check (jsonb_typeof(approval_rule_json) = 'object'),
  constraint config_exception_rules_approval_json_empty_check check (approval_rule_json = '{}'::jsonb),
  constraint config_exception_rules_audit_object_check check (jsonb_typeof(audit_rule_json) = 'object')
);

create table if not exists config_workforce_gate_dependency_links (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  workforce_qualification_rule_id uuid not null,
  gate_key text not null,
  dependency_rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint config_workforce_gate_dependency_links_rule_gate_key unique (workforce_qualification_rule_id, gate_key),
  constraint config_workforce_gate_dependency_links_rule_same_configuration_fkey
    foreign key (workforce_qualification_rule_id, configuration_version_id) references config_workforce_qualification_rules(id, configuration_version_id) on delete restrict,
  constraint config_workforce_gate_dependency_links_gate_same_configuration_fkey
    foreign key (configuration_version_id, gate_key) references config_gate_definitions(configuration_version_id, gate_key) on delete restrict,
  constraint config_workforce_gate_dependency_links_rule_object_check check (jsonb_typeof(dependency_rule_json) = 'object')
);

create table if not exists config_handoff_required_evidence_links (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  handoff_definition_id uuid not null,
  evidence_type_key text not null,
  requirement_rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint config_handoff_required_evidence_links_handoff_evidence_key unique (handoff_definition_id, evidence_type_key),
  constraint config_handoff_required_evidence_links_handoff_same_configuration_fkey
    foreign key (handoff_definition_id, configuration_version_id) references config_handoff_definitions(id, configuration_version_id) on delete restrict,
  constraint config_handoff_required_evidence_links_evidence_same_configuration_fkey
    foreign key (configuration_version_id, evidence_type_key) references config_evidence_type_definitions(configuration_version_id, evidence_type_key) on delete restrict,
  constraint config_handoff_required_evidence_links_rule_object_check check (jsonb_typeof(requirement_rule_json) = 'object')
);

create table if not exists config_governance_forum_participant_role_links (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  governance_forum_definition_id uuid not null,
  role_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint config_governance_forum_participant_role_links_forum_role_key unique (governance_forum_definition_id, role_key),
  constraint config_governance_forum_participant_role_links_forum_same_configuration_fkey
    foreign key (governance_forum_definition_id, configuration_version_id) references config_governance_forum_definitions(id, configuration_version_id) on delete restrict,
  constraint config_governance_forum_participant_role_links_role_same_configuration_fkey
    foreign key (configuration_version_id, role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_governance_forum_participant_role_links_sort_order_check check (sort_order >= 0)
);

create table if not exists config_governance_forum_kpi_links (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  governance_forum_definition_id uuid not null,
  kpi_key text not null,
  link_rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint config_governance_forum_kpi_links_forum_kpi_key unique (governance_forum_definition_id, kpi_key),
  constraint config_governance_forum_kpi_links_forum_same_configuration_fkey
    foreign key (governance_forum_definition_id, configuration_version_id) references config_governance_forum_definitions(id, configuration_version_id) on delete restrict,
  constraint config_governance_forum_kpi_links_kpi_same_configuration_fkey
    foreign key (configuration_version_id, kpi_key) references config_kpi_definitions(configuration_version_id, kpi_key) on delete restrict,
  constraint config_governance_forum_kpi_links_rule_object_check check (jsonb_typeof(link_rule_json) = 'object')
);

create table if not exists config_exception_approval_role_links (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  exception_rule_id uuid not null,
  role_key text not null,
  approval_rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint config_exception_approval_role_links_exception_role_key unique (exception_rule_id, role_key),
  constraint config_exception_approval_role_links_exception_same_configuration_fkey
    foreign key (exception_rule_id, configuration_version_id) references config_exception_rules(id, configuration_version_id) on delete restrict,
  constraint config_exception_approval_role_links_role_same_configuration_fkey
    foreign key (configuration_version_id, role_key) references config_role_definitions(configuration_version_id, role_key) on delete restrict,
  constraint config_exception_approval_role_links_rule_object_check check (jsonb_typeof(approval_rule_json) = 'object')
);

create index if not exists config_kpi_definitions_configuration_version_id_idx on config_kpi_definitions(configuration_version_id);
create index if not exists config_financial_model_definitions_configuration_version_id_idx on config_financial_model_definitions(configuration_version_id);
create index if not exists config_workforce_qualification_rules_configuration_version_id_idx on config_workforce_qualification_rules(configuration_version_id);
create index if not exists config_handoff_definitions_configuration_version_id_idx on config_handoff_definitions(configuration_version_id);
create index if not exists config_governance_forum_definitions_configuration_version_id_idx on config_governance_forum_definitions(configuration_version_id);
create index if not exists config_exception_rules_configuration_version_id_idx on config_exception_rules(configuration_version_id);
create index if not exists config_workforce_gate_dependency_links_configuration_version_id_idx on config_workforce_gate_dependency_links(configuration_version_id);
create index if not exists config_handoff_required_evidence_links_configuration_version_id_idx on config_handoff_required_evidence_links(configuration_version_id);
create index if not exists config_governance_forum_participant_role_links_configuration_version_id_idx on config_governance_forum_participant_role_links(configuration_version_id);
create index if not exists config_governance_forum_kpi_links_configuration_version_id_idx on config_governance_forum_kpi_links(configuration_version_id);
create index if not exists config_exception_approval_role_links_configuration_version_id_idx on config_exception_approval_role_links(configuration_version_id);

alter table config_kpi_definitions enable row level security;
alter table config_financial_model_definitions enable row level security;
alter table config_workforce_qualification_rules enable row level security;
alter table config_handoff_definitions enable row level security;
alter table config_governance_forum_definitions enable row level security;
alter table config_exception_rules enable row level security;
alter table config_workforce_gate_dependency_links enable row level security;
alter table config_handoff_required_evidence_links enable row level security;
alter table config_governance_forum_participant_role_links enable row level security;
alter table config_governance_forum_kpi_links enable row level security;
alter table config_exception_approval_role_links enable row level security;

drop policy if exists config_kpi_definitions_select on config_kpi_definitions;
create policy config_kpi_definitions_select on config_kpi_definitions for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_kpi_definitions_insert on config_kpi_definitions;
create policy config_kpi_definitions_insert on config_kpi_definitions for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_kpi_definitions_update on config_kpi_definitions;
create policy config_kpi_definitions_update on config_kpi_definitions for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_kpi_definitions_no_delete on config_kpi_definitions;
create policy config_kpi_definitions_no_delete on config_kpi_definitions for delete to authenticated using (false);

drop policy if exists config_financial_model_definitions_select on config_financial_model_definitions;
create policy config_financial_model_definitions_select on config_financial_model_definitions for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_financial_model_definitions_insert on config_financial_model_definitions;
create policy config_financial_model_definitions_insert on config_financial_model_definitions for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_financial_model_definitions_update on config_financial_model_definitions;
create policy config_financial_model_definitions_update on config_financial_model_definitions for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_financial_model_definitions_no_delete on config_financial_model_definitions;
create policy config_financial_model_definitions_no_delete on config_financial_model_definitions for delete to authenticated using (false);

drop policy if exists config_workforce_qualification_rules_select on config_workforce_qualification_rules;
create policy config_workforce_qualification_rules_select on config_workforce_qualification_rules for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_workforce_qualification_rules_insert on config_workforce_qualification_rules;
create policy config_workforce_qualification_rules_insert on config_workforce_qualification_rules for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_workforce_qualification_rules_update on config_workforce_qualification_rules;
create policy config_workforce_qualification_rules_update on config_workforce_qualification_rules for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_workforce_qualification_rules_no_delete on config_workforce_qualification_rules;
create policy config_workforce_qualification_rules_no_delete on config_workforce_qualification_rules for delete to authenticated using (false);

drop policy if exists config_handoff_definitions_select on config_handoff_definitions;
create policy config_handoff_definitions_select on config_handoff_definitions for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_handoff_definitions_insert on config_handoff_definitions;
create policy config_handoff_definitions_insert on config_handoff_definitions for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_handoff_definitions_update on config_handoff_definitions;
create policy config_handoff_definitions_update on config_handoff_definitions for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_handoff_definitions_no_delete on config_handoff_definitions;
create policy config_handoff_definitions_no_delete on config_handoff_definitions for delete to authenticated using (false);

drop policy if exists config_governance_forum_definitions_select on config_governance_forum_definitions;
create policy config_governance_forum_definitions_select on config_governance_forum_definitions for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_governance_forum_definitions_insert on config_governance_forum_definitions;
create policy config_governance_forum_definitions_insert on config_governance_forum_definitions for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_governance_forum_definitions_update on config_governance_forum_definitions;
create policy config_governance_forum_definitions_update on config_governance_forum_definitions for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_governance_forum_definitions_no_delete on config_governance_forum_definitions;
create policy config_governance_forum_definitions_no_delete on config_governance_forum_definitions for delete to authenticated using (false);

drop policy if exists config_exception_rules_select on config_exception_rules;
create policy config_exception_rules_select on config_exception_rules for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_exception_rules_insert on config_exception_rules;
create policy config_exception_rules_insert on config_exception_rules for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_exception_rules_update on config_exception_rules;
create policy config_exception_rules_update on config_exception_rules for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_exception_rules_no_delete on config_exception_rules;
create policy config_exception_rules_no_delete on config_exception_rules for delete to authenticated using (false);

drop policy if exists config_workforce_gate_dependency_links_select on config_workforce_gate_dependency_links;
create policy config_workforce_gate_dependency_links_select on config_workforce_gate_dependency_links for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_workforce_gate_dependency_links_insert on config_workforce_gate_dependency_links;
create policy config_workforce_gate_dependency_links_insert on config_workforce_gate_dependency_links for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_workforce_gate_dependency_links_update on config_workforce_gate_dependency_links;
create policy config_workforce_gate_dependency_links_update on config_workforce_gate_dependency_links for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_workforce_gate_dependency_links_no_delete on config_workforce_gate_dependency_links;
create policy config_workforce_gate_dependency_links_no_delete on config_workforce_gate_dependency_links for delete to authenticated using (false);

drop policy if exists config_handoff_required_evidence_links_select on config_handoff_required_evidence_links;
create policy config_handoff_required_evidence_links_select on config_handoff_required_evidence_links for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_handoff_required_evidence_links_insert on config_handoff_required_evidence_links;
create policy config_handoff_required_evidence_links_insert on config_handoff_required_evidence_links for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_handoff_required_evidence_links_update on config_handoff_required_evidence_links;
create policy config_handoff_required_evidence_links_update on config_handoff_required_evidence_links for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_handoff_required_evidence_links_no_delete on config_handoff_required_evidence_links;
create policy config_handoff_required_evidence_links_no_delete on config_handoff_required_evidence_links for delete to authenticated using (false);

drop policy if exists config_governance_forum_participant_role_links_select on config_governance_forum_participant_role_links;
create policy config_governance_forum_participant_role_links_select on config_governance_forum_participant_role_links for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_governance_forum_participant_role_links_insert on config_governance_forum_participant_role_links;
create policy config_governance_forum_participant_role_links_insert on config_governance_forum_participant_role_links for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_governance_forum_participant_role_links_update on config_governance_forum_participant_role_links;
create policy config_governance_forum_participant_role_links_update on config_governance_forum_participant_role_links for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_governance_forum_participant_role_links_no_delete on config_governance_forum_participant_role_links;
create policy config_governance_forum_participant_role_links_no_delete on config_governance_forum_participant_role_links for delete to authenticated using (false);

drop policy if exists config_governance_forum_kpi_links_select on config_governance_forum_kpi_links;
create policy config_governance_forum_kpi_links_select on config_governance_forum_kpi_links for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_governance_forum_kpi_links_insert on config_governance_forum_kpi_links;
create policy config_governance_forum_kpi_links_insert on config_governance_forum_kpi_links for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_governance_forum_kpi_links_update on config_governance_forum_kpi_links;
create policy config_governance_forum_kpi_links_update on config_governance_forum_kpi_links for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_governance_forum_kpi_links_no_delete on config_governance_forum_kpi_links;
create policy config_governance_forum_kpi_links_no_delete on config_governance_forum_kpi_links for delete to authenticated using (false);

drop policy if exists config_exception_approval_role_links_select on config_exception_approval_role_links;
create policy config_exception_approval_role_links_select on config_exception_approval_role_links for select to authenticated using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_exception_approval_role_links_insert on config_exception_approval_role_links;
create policy config_exception_approval_role_links_insert on config_exception_approval_role_links for insert to authenticated with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_exception_approval_role_links_update on config_exception_approval_role_links;
create policy config_exception_approval_role_links_update on config_exception_approval_role_links for update to authenticated using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id)) with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_exception_approval_role_links_no_delete on config_exception_approval_role_links;
create policy config_exception_approval_role_links_no_delete on config_exception_approval_role_links for delete to authenticated using (false);

comment on table config_kpi_definitions is
  'Configurable KPI definitions. Startup/no-history mode prevents fake historical metrics.';
