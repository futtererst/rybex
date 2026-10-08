-- Configuration Foundation 0018 - Template packs and immutable versions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Defines shipped template-pack roots and versions. Does not activate tenants or seed runtime records.

create table if not exists config_template_packs (
  id uuid primary key default gen_random_uuid(),
  pack_key text not null,
  name text not null,
  domain text not null,
  owner_type text not null default 'platform',
  status text not null default 'draft',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_template_packs_pack_key_key unique (pack_key),
  constraint config_template_packs_pack_key_format_check check (pack_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_template_packs_status_check check (status in ('draft','released','deprecated','archived')),
  constraint config_template_packs_owner_type_check check (owner_type in ('platform','tenant')),
  constraint config_template_packs_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create table if not exists config_template_pack_versions (
  id uuid primary key default gen_random_uuid(),
  template_pack_id uuid not null references config_template_packs(id) on delete restrict,
  semver text not null,
  status text not null default 'draft',
  defaults_json jsonb not null default '{}'::jsonb,
  compatibility_json jsonb not null default '{"status":"compatible","findings":[]}'::jsonb,
  released_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_template_pack_versions_template_pack_id_semver_key unique (template_pack_id, semver),
  constraint config_template_pack_versions_status_check check (status in ('draft','released','deprecated','archived')),
  constraint config_template_pack_versions_defaults_object_check check (jsonb_typeof(defaults_json) = 'object'),
  constraint config_template_pack_versions_compatibility_object_check check (jsonb_typeof(compatibility_json) = 'object'),
  constraint config_template_pack_versions_compatibility_status_check check (
    compatibility_json ? 'status'
    and compatibility_json->>'status' in ('compatible','warning','blocker')
  )
);

create index if not exists config_template_pack_versions_template_pack_id_idx
  on config_template_pack_versions(template_pack_id);

create index if not exists config_template_pack_versions_status_idx
  on config_template_pack_versions(status);

alter table config_template_packs enable row level security;
alter table config_template_pack_versions enable row level security;

drop policy if exists config_template_packs_select on config_template_packs;
create policy config_template_packs_select
  on config_template_packs
  for select
  to authenticated
  using (status = 'released');

drop policy if exists config_template_packs_insert on config_template_packs;
create policy config_template_packs_insert
  on config_template_packs
  for insert
  to authenticated
  with check (public.config_is_service_role());

drop policy if exists config_template_packs_update on config_template_packs;
create policy config_template_packs_update
  on config_template_packs
  for update
  to authenticated
  using (public.config_is_service_role() and status <> 'released')
  with check (public.config_is_service_role());

drop policy if exists config_template_packs_no_delete on config_template_packs;
create policy config_template_packs_no_delete
  on config_template_packs
  for delete
  to authenticated
  using (false);

drop policy if exists config_template_pack_versions_select on config_template_pack_versions;
create policy config_template_pack_versions_select
  on config_template_pack_versions
  for select
  to authenticated
  using (status = 'released');

drop policy if exists config_template_pack_versions_insert on config_template_pack_versions;
create policy config_template_pack_versions_insert
  on config_template_pack_versions
  for insert
  to authenticated
  with check (public.config_is_service_role());

drop policy if exists config_template_pack_versions_update on config_template_pack_versions;
create policy config_template_pack_versions_update
  on config_template_pack_versions
  for update
  to authenticated
  using (public.config_is_service_role() and status <> 'released')
  with check (public.config_is_service_role());

drop policy if exists config_template_pack_versions_no_delete on config_template_pack_versions;
create policy config_template_pack_versions_no_delete
  on config_template_pack_versions
  for delete
  to authenticated
  using (false);

comment on table config_template_packs is
  'Configuration Foundation template-pack root. Rybex, Rotork, and Generic D5O are pack records, not platform-core hard-codes.';
