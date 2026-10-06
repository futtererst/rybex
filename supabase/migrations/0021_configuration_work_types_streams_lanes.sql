-- Configuration Foundation 0021 - Work taxonomy definitions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Supports opportunity-led, signal-led, Rybex workstream, Rotork service-lane,
-- and Generic D5O taxonomy without creating runtime work items.

create table if not exists config_work_item_type_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  work_item_type_key text not null,
  label text not null,
  intake_model text not null,
  lifecycle_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_work_item_type_definitions_configuration_version_id_work_item_type_key_key unique (configuration_version_id, work_item_type_key),
  constraint config_work_item_type_definitions_key_format_check check (work_item_type_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_work_item_type_definitions_intake_model_check check (intake_model in ('opportunity_led','signal_led','manual','integration')),
  constraint config_work_item_type_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_work_item_type_definitions_lifecycle_object_check check (jsonb_typeof(lifecycle_json) = 'object')
);

create table if not exists config_work_class_definitions (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  work_class_key text not null,
  label text not null,
  criteria_json jsonb not null default '{"criteria":[]}'::jsonb,
  severity_rank integer,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_work_class_definitions_configuration_version_id_work_class_key_key unique (configuration_version_id, work_class_key),
  constraint config_work_class_definitions_key_format_check check (work_class_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_work_class_definitions_severity_rank_check check (severity_rank is null or severity_rank > 0),
  constraint config_work_class_definitions_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_work_class_definitions_criteria_object_check check (jsonb_typeof(criteria_json) = 'object')
);

alter table config_gate_evidence_requirements
  drop constraint if exists config_gate_evidence_requirements_applies_to_class_same_configuration_fkey;

alter table config_gate_evidence_requirements
  add constraint config_gate_evidence_requirements_applies_to_class_same_configuration_fkey
  foreign key (configuration_version_id, applies_to_class_key)
  references config_work_class_definitions(configuration_version_id, work_class_key) on delete restrict;

create table if not exists config_workstreams (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  workstream_key text not null,
  label text not null,
  owner_role_key text,
  status text not null default 'draft',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_workstreams_configuration_version_id_workstream_key_key unique (configuration_version_id, workstream_key),
  constraint config_workstreams_key_format_check check (workstream_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_workstreams_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_workstreams_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create table if not exists config_service_lanes (
  id uuid primary key default gen_random_uuid(),
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  service_lane_key text not null,
  label text not null,
  owner_role_key text,
  service_model_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_service_lanes_configuration_version_id_service_lane_key_key unique (configuration_version_id, service_lane_key),
  constraint config_service_lanes_key_format_check check (service_lane_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_service_lanes_status_check check (status in ('draft','active','inactive','archived')),
  constraint config_service_lanes_service_model_object_check check (jsonb_typeof(service_model_json) = 'object')
);

create index if not exists config_work_item_type_definitions_configuration_version_id_idx on config_work_item_type_definitions(configuration_version_id);
create index if not exists config_work_class_definitions_configuration_version_id_idx on config_work_class_definitions(configuration_version_id);
create index if not exists config_workstreams_configuration_version_id_idx on config_workstreams(configuration_version_id);
create index if not exists config_service_lanes_configuration_version_id_idx on config_service_lanes(configuration_version_id);

alter table config_work_item_type_definitions enable row level security;
alter table config_work_class_definitions enable row level security;
alter table config_workstreams enable row level security;
alter table config_service_lanes enable row level security;

drop policy if exists config_work_item_type_definitions_select on config_work_item_type_definitions;
create policy config_work_item_type_definitions_select on config_work_item_type_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_work_item_type_definitions_insert on config_work_item_type_definitions;
create policy config_work_item_type_definitions_insert on config_work_item_type_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_work_item_type_definitions_update on config_work_item_type_definitions;
create policy config_work_item_type_definitions_update on config_work_item_type_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_work_item_type_definitions_no_delete on config_work_item_type_definitions;
create policy config_work_item_type_definitions_no_delete on config_work_item_type_definitions for delete to authenticated using (false);

drop policy if exists config_work_class_definitions_select on config_work_class_definitions;
create policy config_work_class_definitions_select on config_work_class_definitions for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_work_class_definitions_insert on config_work_class_definitions;
create policy config_work_class_definitions_insert on config_work_class_definitions for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_work_class_definitions_update on config_work_class_definitions;
create policy config_work_class_definitions_update on config_work_class_definitions for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_work_class_definitions_no_delete on config_work_class_definitions;
create policy config_work_class_definitions_no_delete on config_work_class_definitions for delete to authenticated using (false);

drop policy if exists config_workstreams_select on config_workstreams;
create policy config_workstreams_select on config_workstreams for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_workstreams_insert on config_workstreams;
create policy config_workstreams_insert on config_workstreams for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_workstreams_update on config_workstreams;
create policy config_workstreams_update on config_workstreams for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_workstreams_no_delete on config_workstreams;
create policy config_workstreams_no_delete on config_workstreams for delete to authenticated using (false);

drop policy if exists config_service_lanes_select on config_service_lanes;
create policy config_service_lanes_select on config_service_lanes for select to authenticated
  using (public.config_can_read_configuration_version(configuration_version_id));
drop policy if exists config_service_lanes_insert on config_service_lanes;
create policy config_service_lanes_insert on config_service_lanes for insert to authenticated
  with check (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id));
drop policy if exists config_service_lanes_update on config_service_lanes;
create policy config_service_lanes_update on config_service_lanes for update to authenticated
  using (public.config_can_admin_configuration_version(configuration_version_id) and public.config_version_is_draft(configuration_version_id))
  with check (public.config_can_admin_configuration_version(configuration_version_id));
drop policy if exists config_service_lanes_no_delete on config_service_lanes;
create policy config_service_lanes_no_delete on config_service_lanes for delete to authenticated using (false);

comment on table config_service_lanes is
  'Configurable service-lane definitions for same-engine Rotork/Generic D5O representation. Does not create Rotork runtime behavior.';
