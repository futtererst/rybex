-- Configuration Foundation 0019 - Tenant activation and configuration versions.
-- Local file creation only. Do not run without separate migration execution authorization.
-- Adds activation/versioning support without runtime template-pack loading.

create table if not exists config_tenant_template_activations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references config_tenants(id) on delete restrict,
  template_pack_version_id uuid not null references config_template_pack_versions(id) on delete restrict,
  activation_scope text not null default 'tenant',
  status text not null default 'requested',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  approver_id uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  rolled_back_at timestamptz,
  rolled_back_by uuid references auth.users(id) on delete set null,
  compatibility_json jsonb not null default '{"status":"compatible","findings":[]}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_tenant_template_activations_scope_format_check check (activation_scope ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_tenant_template_activations_status_check check (status in ('requested','active','superseded','rolled_back','archived')),
  constraint config_tenant_template_activations_effective_range_check check (effective_to is null or effective_to > effective_from),
  constraint config_tenant_template_activations_compatibility_object_check check (jsonb_typeof(compatibility_json) = 'object'),
  constraint config_tenant_template_activations_compatibility_status_check check (
    compatibility_json ? 'status'
    and compatibility_json->>'status' in ('compatible','warning','blocker')
  ),
  constraint config_tenant_template_activations_id_tenant_id_key unique (id, tenant_id)
);

create unique index if not exists config_tenant_template_activations_one_active_scope_uniq
  on config_tenant_template_activations(tenant_id, activation_scope)
  where status = 'active';

create index if not exists config_tenant_template_activations_tenant_id_idx
  on config_tenant_template_activations(tenant_id);

create index if not exists config_tenant_template_activations_pack_version_idx
  on config_tenant_template_activations(template_pack_version_id);

create table if not exists config_tenant_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references config_tenants(id) on delete restrict,
  activation_id uuid not null,
  config_key text not null,
  name text not null,
  mode text not null default 'startup_no_history',
  status text not null default 'draft',
  active_version_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_tenant_configurations_tenant_id_config_key_key unique (tenant_id, config_key),
  constraint config_tenant_configurations_id_tenant_id_key unique (id, tenant_id),
  constraint config_tenant_configurations_activation_tenant_fkey
    foreign key (activation_id, tenant_id) references config_tenant_template_activations(id, tenant_id) on delete restrict,
  constraint config_tenant_configurations_config_key_format_check check (config_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint config_tenant_configurations_mode_check check (mode in ('startup_no_history','mature_historical_baseline')),
  constraint config_tenant_configurations_status_check check (status in ('draft','review','published','active','superseded','deprecated','archived')),
  constraint config_tenant_configurations_metadata_object_check check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists config_tenant_configurations_tenant_id_idx
  on config_tenant_configurations(tenant_id);

create index if not exists config_tenant_configurations_activation_id_idx
  on config_tenant_configurations(activation_id);

create table if not exists config_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_configuration_id uuid not null references config_tenant_configurations(id) on delete restrict,
  version integer not null,
  status text not null default 'draft',
  base_configuration_version_id uuid,
  rollback_of_configuration_version_id uuid,
  source_version_id uuid,
  source_template_pack_version_id uuid references config_template_pack_versions(id) on delete restrict,
  effective_from timestamptz,
  effective_to timestamptz,
  config_manifest_json jsonb not null default '{}'::jsonb,
  diff_json jsonb not null default '{"changed_objects":[]}'::jsonb,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint config_configuration_versions_tenant_configuration_id_version_key unique (tenant_configuration_id, version),
  constraint config_configuration_versions_id_tenant_configuration_id_key unique (id, tenant_configuration_id),
  constraint config_configuration_versions_version_positive_check check (version > 0),
  constraint config_configuration_versions_status_check check (status in ('draft','review','published','superseded','rolled_back','archived')),
  constraint config_configuration_versions_effective_range_check check (effective_to is null or effective_from is null or effective_to > effective_from),
  constraint config_configuration_versions_manifest_object_check check (jsonb_typeof(config_manifest_json) = 'object'),
  constraint config_configuration_versions_diff_object_check check (jsonb_typeof(diff_json) = 'object')
);

alter table config_configuration_versions
  drop constraint if exists config_configuration_versions_base_same_configuration_fkey;

alter table config_configuration_versions
  add constraint config_configuration_versions_base_same_configuration_fkey
  foreign key (base_configuration_version_id, tenant_configuration_id)
  references config_configuration_versions(id, tenant_configuration_id) on delete restrict;

alter table config_configuration_versions
  drop constraint if exists config_configuration_versions_rollback_same_configuration_fkey;

alter table config_configuration_versions
  add constraint config_configuration_versions_rollback_same_configuration_fkey
  foreign key (rollback_of_configuration_version_id, tenant_configuration_id)
  references config_configuration_versions(id, tenant_configuration_id) on delete restrict;

alter table config_configuration_versions
  drop constraint if exists config_configuration_versions_source_same_configuration_fkey;

alter table config_configuration_versions
  add constraint config_configuration_versions_source_same_configuration_fkey
  foreign key (source_version_id, tenant_configuration_id)
  references config_configuration_versions(id, tenant_configuration_id) on delete restrict;

alter table config_tenant_configurations
  drop constraint if exists config_tenant_configurations_active_version_id_fkey;

alter table config_tenant_configurations
  add constraint config_tenant_configurations_active_version_id_fkey
  foreign key (active_version_id, id) references config_configuration_versions(id, tenant_configuration_id) on delete restrict;

alter table config_tenants
  drop constraint if exists config_tenants_active_configuration_version_id_fkey;

alter table config_tenants
  add constraint config_tenants_active_configuration_version_id_fkey
  foreign key (active_configuration_version_id) references config_configuration_versions(id) on delete restrict;

create index if not exists config_configuration_versions_tenant_configuration_id_idx
  on config_configuration_versions(tenant_configuration_id);

create index if not exists config_configuration_versions_status_idx
  on config_configuration_versions(status);

create index if not exists config_configuration_versions_effective_range_idx
  on config_configuration_versions(effective_from, effective_to);

create unique index if not exists config_configuration_versions_one_published_start_uniq
  on config_configuration_versions(tenant_configuration_id, effective_from)
  where status = 'published' and effective_from is not null;

create or replace function public.config_configuration_version_tenant_id(p_configuration_version_id uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select tc.tenant_id
  from config_configuration_versions cv
  join config_tenant_configurations tc
    on tc.id = cv.tenant_configuration_id
  where cv.id = p_configuration_version_id;
$$;

create or replace function public.config_tenant_configuration_tenant_id(p_tenant_configuration_id uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select tenant_id
  from config_tenant_configurations
  where id = p_tenant_configuration_id;
$$;

create or replace function public.config_can_read_configuration_version(p_configuration_version_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.config_can_read_tenant_configuration(public.config_configuration_version_tenant_id(p_configuration_version_id));
$$;

create or replace function public.config_can_admin_configuration_version(p_configuration_version_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.config_can_admin_tenant_configuration(public.config_configuration_version_tenant_id(p_configuration_version_id));
$$;

create or replace function public.config_version_is_draft(p_configuration_version_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from config_configuration_versions
    where id = p_configuration_version_id
      and status in ('draft','review')
  );
$$;

create or replace function public.config_version_is_published(p_configuration_version_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from config_configuration_versions
    where id = p_configuration_version_id
      and status = 'published'
  );
$$;

create or replace function public.config_lock_tenant_configuration_lifecycle(p_tenant_configuration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_tenant_configuration_id is null then
    raise exception 'tenant_configuration_id is required for lifecycle locking'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('config_configuration_versions_lifecycle'),
    hashtext(p_tenant_configuration_id::text)
  );
end;
$$;

create or replace function public.config_validate_tenant_active_configuration_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.active_configuration_version_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from config_configuration_versions cv
    join config_tenant_configurations tc
      on tc.id = cv.tenant_configuration_id
    where cv.id = new.active_configuration_version_id
      and tc.tenant_id = new.id
  ) then
    raise exception 'active configuration version must belong to the same tenant'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists config_tenants_validate_active_configuration_version on config_tenants;
create trigger config_tenants_validate_active_configuration_version
before insert or update of active_configuration_version_id on config_tenants
for each row
execute function public.config_validate_tenant_active_configuration_version();

create or replace function public.config_prevent_configuration_version_reparenting()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.tenant_configuration_id is distinct from new.tenant_configuration_id then
    raise exception 'configuration versions cannot change tenant_configuration_id after creation'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists config_configuration_versions_prevent_reparenting on config_configuration_versions;
create trigger config_configuration_versions_prevent_reparenting
before update of tenant_configuration_id on config_configuration_versions
for each row
execute function public.config_prevent_configuration_version_reparenting();

create or replace function public.config_validate_configuration_version_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.config_lock_tenant_configuration_lifecycle(new.tenant_configuration_id);

  if new.status = 'published' and new.effective_from is null then
    raise exception 'published configuration versions require effective_from'
      using errcode = '23514';
  end if;

  if new.status = 'published' and exists (
    select 1
    from config_configuration_versions existing
    where existing.tenant_configuration_id = new.tenant_configuration_id
      and existing.id <> new.id
      and existing.status = 'published'
      and coalesce(existing.effective_to, 'infinity'::timestamptz) > new.effective_from
      and coalesce(new.effective_to, 'infinity'::timestamptz) > existing.effective_from
  ) then
    raise exception 'published configuration version half-open effective intervals [effective_from, effective_to) must not overlap for the same tenant configuration'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists config_configuration_versions_validate_lifecycle on config_configuration_versions;
create trigger config_configuration_versions_validate_lifecycle
before insert or update of status, effective_from, effective_to, tenant_configuration_id on config_configuration_versions
for each row
execute function public.config_validate_configuration_version_lifecycle();

alter table config_tenant_template_activations enable row level security;
alter table config_tenant_configurations enable row level security;
alter table config_configuration_versions enable row level security;

drop policy if exists config_tenant_template_activations_select on config_tenant_template_activations;
create policy config_tenant_template_activations_select
  on config_tenant_template_activations
  for select
  to authenticated
  using (public.config_can_read_tenant_configuration(tenant_id));

drop policy if exists config_tenant_template_activations_insert on config_tenant_template_activations;
create policy config_tenant_template_activations_insert
  on config_tenant_template_activations
  for insert
  to authenticated
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_tenant_template_activations_update on config_tenant_template_activations;
create policy config_tenant_template_activations_update
  on config_tenant_template_activations
  for update
  to authenticated
  using (public.config_can_admin_tenant_configuration(tenant_id) and status in ('requested','active'))
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_tenant_template_activations_no_delete on config_tenant_template_activations;
create policy config_tenant_template_activations_no_delete
  on config_tenant_template_activations
  for delete
  to authenticated
  using (false);

drop policy if exists config_tenant_configurations_select on config_tenant_configurations;
create policy config_tenant_configurations_select
  on config_tenant_configurations
  for select
  to authenticated
  using (public.config_can_read_tenant_configuration(tenant_id));

drop policy if exists config_tenant_configurations_insert on config_tenant_configurations;
create policy config_tenant_configurations_insert
  on config_tenant_configurations
  for insert
  to authenticated
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_tenant_configurations_update on config_tenant_configurations;
create policy config_tenant_configurations_update
  on config_tenant_configurations
  for update
  to authenticated
  using (public.config_can_admin_tenant_configuration(tenant_id) and status <> 'published')
  with check (public.config_can_admin_tenant_configuration(tenant_id));

drop policy if exists config_tenant_configurations_no_delete on config_tenant_configurations;
create policy config_tenant_configurations_no_delete
  on config_tenant_configurations
  for delete
  to authenticated
  using (false);

drop policy if exists config_configuration_versions_select on config_configuration_versions;
create policy config_configuration_versions_select
  on config_configuration_versions
  for select
  to authenticated
  using (public.config_can_read_configuration_version(id));

drop policy if exists config_configuration_versions_insert on config_configuration_versions;
create policy config_configuration_versions_insert
  on config_configuration_versions
  for insert
  to authenticated
  with check (
    public.config_can_admin_tenant_configuration(public.config_tenant_configuration_tenant_id(tenant_configuration_id))
    or public.config_is_service_role()
  );

drop policy if exists config_configuration_versions_update on config_configuration_versions;
create policy config_configuration_versions_update
  on config_configuration_versions
  for update
  to authenticated
  using (public.config_can_admin_configuration_version(id) and status in ('draft','review'))
  with check (
    public.config_can_admin_tenant_configuration(public.config_tenant_configuration_tenant_id(tenant_configuration_id))
  );

drop policy if exists config_configuration_versions_no_delete on config_configuration_versions;
create policy config_configuration_versions_no_delete
  on config_configuration_versions
  for delete
  to authenticated
  using (false);

comment on table config_configuration_versions is
  'Draft/published Configuration Foundation versions. Published rows are immutable by RLS and future verifier authority.';
