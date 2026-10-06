-- Configuration Foundation 0025 - Audit and effective-configuration support.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Adds immutable configuration audit records and static resolution support.

create table if not exists config_configuration_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references config_tenants(id) on delete restrict,
  tenant_configuration_id uuid references config_tenant_configurations(id) on delete restrict,
  configuration_version_id uuid references config_configuration_versions(id) on delete restrict,
  template_pack_id uuid references config_template_packs(id) on delete restrict,
  template_pack_version_id uuid references config_template_pack_versions(id) on delete restrict,
  event_type text not null,
  event_source text not null default 'configuration_foundation',
  actor_id uuid references auth.users(id) on delete set null,
  actor_role_key text,
  occurred_at timestamptz not null default now(),
  before_json jsonb,
  after_json jsonb,
  diff_json jsonb not null default '{}'::jsonb,
  reason text,
  correlation_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint config_configuration_audit_events_event_type_check check (event_type in ('created','updated','published','activated','rolled_back','deprecated','archived','compatibility_checked','seed_deferred')),
  constraint config_configuration_audit_events_before_object_check check (before_json is null or jsonb_typeof(before_json) = 'object'),
  constraint config_configuration_audit_events_after_object_check check (after_json is null or jsonb_typeof(after_json) = 'object'),
  constraint config_configuration_audit_events_diff_object_check check (jsonb_typeof(diff_json) = 'object'),
  constraint config_configuration_audit_events_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists config_configuration_audit_events_tenant_id_idx on config_configuration_audit_events(tenant_id);
create index if not exists config_configuration_audit_events_configuration_version_id_idx on config_configuration_audit_events(configuration_version_id);
create index if not exists config_configuration_audit_events_occurred_at_idx on config_configuration_audit_events(occurred_at);
create index if not exists config_configuration_versions_active_lookup_idx
  on config_configuration_versions(tenant_configuration_id, status, effective_from, effective_to);
create index if not exists config_tenant_template_activations_active_lookup_idx
  on config_tenant_template_activations(tenant_id, status, effective_from, effective_to);

create or replace function public.config_effective_configuration_version_id(p_tenant_id uuid, p_as_of timestamptz default now())
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select cv.id
  from config_tenants ct
  join config_configuration_versions cv
    on cv.id = ct.active_configuration_version_id
  join config_tenant_configurations tc
    on tc.id = cv.tenant_configuration_id
   and tc.tenant_id = ct.id
  where ct.id = p_tenant_id
    and cv.status = 'published'
    and cv.effective_from <= p_as_of
    and (cv.effective_to is null or cv.effective_to > p_as_of)
  order by cv.effective_from desc, cv.version desc, cv.id asc
  limit 1;
$$;

create or replace function public.config_can_read_configuration_audit_event(p_audit_event_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.config_can_audit_tenant_configuration(tenant_id)
  from config_configuration_audit_events
  where id = p_audit_event_id;
$$;

alter table config_configuration_audit_events enable row level security;

drop policy if exists config_configuration_audit_events_select on config_configuration_audit_events;
create policy config_configuration_audit_events_select
  on config_configuration_audit_events
  for select
  to authenticated
  using (public.config_can_audit_tenant_configuration(tenant_id));

drop policy if exists config_configuration_audit_events_insert on config_configuration_audit_events;
create policy config_configuration_audit_events_insert
  on config_configuration_audit_events
  for insert
  to authenticated
  with check (public.config_is_service_role());

drop policy if exists config_configuration_audit_events_no_update on config_configuration_audit_events;
create policy config_configuration_audit_events_no_update
  on config_configuration_audit_events
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists config_configuration_audit_events_no_delete on config_configuration_audit_events;
create policy config_configuration_audit_events_no_delete
  on config_configuration_audit_events
  for delete
  to authenticated
  using (false);

grant select, insert, update, delete on
  config_tenants,
  config_organizations,
  config_operating_entities,
  config_template_packs,
  config_template_pack_versions,
  config_tenant_template_activations,
  config_tenant_configurations,
  config_configuration_versions,
  config_phase_definitions,
  config_gate_definitions,
  config_gate_questions,
  config_gate_evidence_requirements,
  config_gate_decision_outcomes,
  config_work_item_type_definitions,
  config_work_class_definitions,
  config_workstreams,
  config_service_lanes,
  config_role_definitions,
  config_permission_definitions,
  config_decision_right_definitions,
  config_artifact_type_definitions,
  config_evidence_type_definitions,
  config_kpi_definitions,
  config_financial_model_definitions,
  config_workforce_qualification_rules,
  config_handoff_definitions,
  config_governance_forum_definitions,
  config_exception_rules,
  config_workforce_gate_dependency_links,
  config_handoff_required_evidence_links,
  config_governance_forum_participant_role_links,
  config_governance_forum_kpi_links,
  config_exception_approval_role_links,
  config_configuration_audit_events
to authenticated;

comment on table config_configuration_audit_events is
  'Immutable configuration audit events for schema-authority traceability. Insert is service-role-only and update/delete are denied.';

comment on function public.config_effective_configuration_version_id(uuid, timestamptz) is
  'Static effective-configuration lookup support. Runtime configuration loading remains unauthorized until separately approved.';
