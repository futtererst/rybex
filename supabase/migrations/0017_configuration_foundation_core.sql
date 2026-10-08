-- Configuration Foundation 0017 - Core configuration roots.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Establishes tenant / organization / operating-entity configuration roots and helper predicates.
-- Does not implement runtime configuration, Configuration Studio, P1-01B.3,
-- project readiness, mobilization, demo readiness, or production readiness.

create table if not exists config_tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null,
  name text not null,
  organization_id uuid references organizations(id) on delete restrict,
  workspace_id uuid references workspaces(id) on delete restrict,
  active_configuration_version_id uuid,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_tenants_tenant_key_key unique (tenant_key),
  constraint config_tenants_tenant_key_format_check check (tenant_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_tenants_status_check check (status in ('draft','review','published','active','superseded','deprecated','archived')),
  constraint config_tenants_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists config_tenants_workspace_id_idx
  on config_tenants(workspace_id);

create index if not exists config_tenants_organization_id_idx
  on config_tenants(organization_id);

create table if not exists config_organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references config_tenants(id) on delete restrict,
  organization_key text not null,
  name text not null,
  organization_type text not null,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_organizations_tenant_id_organization_key_key unique (tenant_id, organization_key),
  constraint config_organizations_key_format_check check (organization_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_organizations_status_check check (status in ('draft','review','published','active','superseded','deprecated','archived')),
  constraint config_organizations_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists config_organizations_tenant_id_idx
  on config_organizations(tenant_id);

create table if not exists config_operating_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references config_tenants(id) on delete restrict,
  organization_id uuid references config_organizations(id) on delete set null,
  entity_key text not null,
  name text not null,
  entity_type text not null,
  region text,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_operating_entities_tenant_id_entity_key_key unique (tenant_id, entity_key),
  constraint config_operating_entities_key_format_check check (entity_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_operating_entities_status_check check (status in ('draft','review','published','active','superseded','deprecated','archived')),
  constraint config_operating_entities_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists config_operating_entities_tenant_id_idx
  on config_operating_entities(tenant_id);

create index if not exists config_operating_entities_organization_id_idx
  on config_operating_entities(organization_id);

create or replace function public.config_is_service_role()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function public.config_current_tenant_id()
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select ct.id
  from config_tenants ct
  join workspace_memberships wm
    on wm.workspace_id = ct.workspace_id
   and wm.user_id = auth.uid()
   and wm.status = 'active'
  where ct.status <> 'archived'
  order by ct.created_at asc
  limit 1;
$$;

create or replace function public.config_can_read_tenant_configuration(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.config_is_service_role()
    or exists (
      select 1
      from config_tenants ct
      join workspace_memberships wm
        on wm.workspace_id = ct.workspace_id
       and wm.user_id = auth.uid()
       and wm.status = 'active'
      where ct.id = p_tenant_id
    );
$$;

create or replace function public.config_can_admin_tenant_configuration(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.config_is_service_role()
    or exists (
      select 1
      from config_tenants ct
      join workspace_memberships wm
        on wm.workspace_id = ct.workspace_id
       and wm.user_id = auth.uid()
       and wm.status = 'active'
      where ct.id = p_tenant_id
        and wm.role = 'admin'
    );
$$;

create or replace function public.config_can_audit_tenant_configuration(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.config_can_read_tenant_configuration(p_tenant_id);
$$;

alter table config_tenants enable row level security;
alter table config_organizations enable row level security;
alter table config_operating_entities enable row level security;

drop policy if exists config_tenants_select on config_tenants;
create policy config_tenants_select
  on config_tenants
  for select
  to authenticated
  using (public.config_can_read_tenant_configuration(id));

drop policy if exists config_tenants_insert on config_tenants;
create policy config_tenants_insert
  on config_tenants
  for insert
  to authenticated
  with check (public.config_is_service_role());

drop policy if exists config_tenants_update on config_tenants;
create policy config_tenants_update
  on config_tenants
  for update
  to authenticated
  using (public.config_can_admin_tenant_configuration(id))
  with check (public.config_can_admin_tenant_configuration(id));

drop policy if exists config_tenants_no_delete on config_tenants;
create policy config_tenants_no_delete
  on config_tenants
  for delete
  to authenticated
  using (false);

drop policy if exists config_organizations_select on config_organizations;
create policy config_organizations_select
  on config_organizations
  for select
  to authenticated
  using (public.config_can_read_tenant_configuration(tenant_id));

drop policy if exists config_organizations_insert on config_organizations;
create policy config_organizations_insert
  on config_organizations
  for insert
  to authenticated
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_organizations_update on config_organizations;
create policy config_organizations_update
  on config_organizations
  for update
  to authenticated
  using (public.config_can_admin_tenant_configuration(tenant_id) and status <> 'published')
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_organizations_no_delete on config_organizations;
create policy config_organizations_no_delete
  on config_organizations
  for delete
  to authenticated
  using (false);

drop policy if exists config_operating_entities_select on config_operating_entities;
create policy config_operating_entities_select
  on config_operating_entities
  for select
  to authenticated
  using (public.config_can_read_tenant_configuration(tenant_id));

drop policy if exists config_operating_entities_insert on config_operating_entities;
create policy config_operating_entities_insert
  on config_operating_entities
  for insert
  to authenticated
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_operating_entities_update on config_operating_entities;
create policy config_operating_entities_update
  on config_operating_entities
  for update
  to authenticated
  using (public.config_can_admin_tenant_configuration(tenant_id) and status <> 'published')
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_operating_entities_no_delete on config_operating_entities;
create policy config_operating_entities_no_delete
  on config_operating_entities
  for delete
  to authenticated
  using (false);

comment on table config_tenants is
  'Configuration Foundation tenant root / workspace bridge. Authority only; does not implement runtime configuration.';
