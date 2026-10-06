-- UNAPPLIED synthetic-trial registry candidate. Not a normal migration.
-- These rows are a D5O-owned source only after a named human verifies them.
-- Text similarity never links a Work record. No client table grant or RPC here.
begin;

alter table public.workspaces add constraint d5o_trial_workspace_organization_key
  unique (id, organization_id);
alter table public.config_tenants add constraint d5o_trial_tenant_scope_key
  unique (id, workspace_id, organization_id);

create table public.d5o_trial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  account_key text not null check (account_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 240),
  source_kind text not null default 'd5o_synthetic_registry'
    check (source_kind = 'd5o_synthetic_registry'),
  status text not null default 'provisional'
    check (status in ('provisional','verified','archived')),
  record_version integer not null default 1 check (record_version >= 1),
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (configuration_tenant_id, account_key),
  unique (id, workspace_id, configuration_tenant_id, organization_id),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id) on delete restrict,
  foreign key (configuration_tenant_id, workspace_id, organization_id)
    references public.config_tenants(id, workspace_id, organization_id) on delete restrict,
  check ((verified_by is null) = (verified_at is null)),
  check (status <> 'verified' or verified_by is not null)
);
create index d5o_trial_accounts_scope_name_idx
  on public.d5o_trial_accounts(configuration_tenant_id, lower(display_name), id);
alter table public.d5o_trial_accounts enable row level security;
revoke all on public.d5o_trial_accounts from public, anon, authenticated, service_role;

create table public.d5o_trial_sites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  site_key text not null check (site_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 240),
  status text not null default 'provisional'
    check (status in ('provisional','verified','archived')),
  record_version integer not null default 1 check (record_version >= 1),
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, site_key),
  unique (id, account_id, workspace_id, configuration_tenant_id, organization_id),
  foreign key (account_id, workspace_id, configuration_tenant_id, organization_id)
    references public.d5o_trial_accounts(id, workspace_id, configuration_tenant_id, organization_id)
    on delete restrict,
  check ((verified_by is null) = (verified_at is null)),
  check (status <> 'verified' or verified_by is not null)
);
create index d5o_trial_sites_scope_name_idx
  on public.d5o_trial_sites(configuration_tenant_id, account_id, lower(display_name), id);
alter table public.d5o_trial_sites enable row level security;
revoke all on public.d5o_trial_sites from public, anon, authenticated, service_role;
commit;
