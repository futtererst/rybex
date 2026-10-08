-- Foundation 0A - Identity, Workspace, Membership, Project Access, and Initial RLS
--
-- Scope:
-- - Hardens existing identity/workspace tables from 0001_core_foundation.sql.
-- - Adds the minimal project membership boundary required for Phase 0.
-- - Enables initial RLS for identity/access tables and project isolation proof.
-- - Does not migrate Billing, Field Issue, Closeout, evidence custody, or notifications.

create extension if not exists "pgcrypto";

alter table workspaces
  add column if not exists version integer not null default 1;

alter table user_profiles
  add column if not exists user_id uuid,
  add column if not exists active_workspace_id uuid references workspaces(id) on delete set null;

update user_profiles
set user_id = auth_user_id
where user_id is null
  and auth_user_id is not null;

alter table workspace_memberships
  add column if not exists user_id uuid,
  add column if not exists invited_by uuid references user_profiles(id) on delete set null;

update workspace_memberships wm
set user_id = up.user_id
from user_profiles up
where wm.user_profile_id = up.id
  and wm.user_id is null
  and up.user_id is not null;

create table if not exists project_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null,
  user_profile_id uuid references user_profiles(id) on delete cascade,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists user_profiles_user_id_idx on user_profiles(user_id);
create index if not exists user_profiles_active_workspace_idx on user_profiles(active_workspace_id);
create index if not exists workspace_memberships_user_id_idx on workspace_memberships(user_id);
create index if not exists workspace_memberships_workspace_user_status_idx on workspace_memberships(workspace_id, user_id, status);
create index if not exists project_memberships_workspace_user_idx on project_memberships(workspace_id, user_id);
create index if not exists project_memberships_project_user_status_idx on project_memberships(project_id, user_id, status);

create trigger set_project_memberships_updated_at
before update on project_memberships
for each row
execute function set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_user_id_fkey'
  ) then
    alter table user_profiles add constraint user_profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_user_id_key'
  ) then
    alter table user_profiles add constraint user_profiles_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_memberships_user_id_fkey'
  ) then
    alter table workspace_memberships add constraint workspace_memberships_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_memberships_workspace_user_key'
  ) then
    alter table workspace_memberships add constraint workspace_memberships_workspace_user_key unique (workspace_id, user_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'project_memberships_user_id_fkey'
  ) then
    alter table project_memberships add constraint project_memberships_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_status_check'
  ) then
    alter table workspaces add constraint workspaces_status_check
      check (status in ('active', 'inactive', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_status_check'
  ) then
    alter table user_profiles add constraint user_profiles_status_check
      check (status in ('active', 'invited', 'suspended', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_memberships_role_check'
  ) then
    alter table workspace_memberships add constraint workspace_memberships_role_check
      check (role in (
        'executive',
        'operations_leader',
        'project_manager',
        'billing_commercial_lead',
        'field_supervisor',
        'closeout_lead',
        'admin',
        'read_only_auditor'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_memberships_status_check'
  ) then
    alter table workspace_memberships add constraint workspace_memberships_status_check
      check (status in ('active', 'invited', 'suspended', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'project_memberships_status_check'
  ) then
    alter table project_memberships add constraint project_memberships_status_check
      check (status in ('active', 'suspended', 'archived'));
  end if;
end $$;

-- Server/RLS helper functions.
-- SECURITY DEFINER is used only to evaluate membership predicates while RLS is
-- active on membership tables. Functions use auth.uid(), fixed search_path, and
-- no dynamic SQL.

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.id
  from public.user_profiles up
  where up.user_id = auth.uid()
     or up.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_active_workspace_member(workspace_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = workspace_uuid
      and wm.status = 'active'
      and wm.user_id = auth.uid()
  )
$$;

create or replace function public.current_workspace_role(workspace_uuid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_memberships wm
  where wm.workspace_id = workspace_uuid
    and wm.status = 'active'
    and wm.user_id = auth.uid()
  limit 1
$$;

create or replace function public.has_workspace_role(workspace_uuid uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_workspace_role(workspace_uuid) = any(allowed_roles)
$$;

create or replace function public.can_access_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = project_uuid
      and public.is_active_workspace_member(p.workspace_id)
      and (
        public.has_workspace_role(p.workspace_id, array['executive','operations_leader','project_manager','billing_commercial_lead','closeout_lead','admin'])
        or exists (
          select 1
          from public.project_memberships pm
          where pm.project_id = p.id
            and pm.workspace_id = p.workspace_id
            and pm.user_id = auth.uid()
            and pm.status = 'active'
        )
      )
  )
$$;

comment on function public.current_user_profile_id() is
  'Foundation 0A helper: maps auth.uid() to a RybexOS user profile id without exposing profile rows.';
comment on function public.is_active_workspace_member(uuid) is
  'Foundation 0A helper: true only for active workspace memberships for auth.uid().';
comment on function public.current_workspace_role(uuid) is
  'Foundation 0A helper: returns one canonical active membership role for auth.uid() in a workspace.';
comment on function public.has_workspace_role(uuid, text[]) is
  'Foundation 0A helper: checks current active workspace role against an allowed role list.';
comment on function public.can_access_project(uuid) is
  'Foundation 0A helper: grants project access through elevated workspace role or explicit project membership.';

alter table workspaces enable row level security;
alter table user_profiles enable row level security;
alter table workspace_memberships enable row level security;
alter table project_memberships enable row level security;
alter table projects enable row level security;
alter table opportunities enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  organizations,
  workspaces,
  user_profiles,
  workspace_memberships,
  project_memberships,
  projects,
  opportunities
to authenticated, service_role;
grant execute on function public.current_user_profile_id() to authenticated, service_role;
grant execute on function public.is_active_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.current_workspace_role(uuid) to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.can_access_project(uuid) to authenticated, service_role;

drop policy if exists workspaces_select_active_member on workspaces;
create policy workspaces_select_active_member
  on workspaces
  for select
  to authenticated
  using (public.is_active_workspace_member(id));

drop policy if exists workspaces_update_admin on workspaces;
create policy workspaces_update_admin
  on workspaces
  for update
  to authenticated
  using (public.has_workspace_role(id, array['admin']))
  with check (public.has_workspace_role(id, array['admin']));

drop policy if exists user_profiles_select_self_or_admin on user_profiles;
create policy user_profiles_select_self_or_admin
  on user_profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or auth_user_id = auth.uid()
    or (
      active_workspace_id is not null
      and public.has_workspace_role(active_workspace_id, array['admin'])
    )
  );

drop policy if exists user_profiles_update_self_limited on user_profiles;
create policy user_profiles_update_self_limited
  on user_profiles
  for update
  to authenticated
  using (user_id = auth.uid() or auth_user_id = auth.uid())
  with check (user_id = auth.uid() or auth_user_id = auth.uid());

drop policy if exists workspace_memberships_select_self_or_admin on workspace_memberships;
create policy workspace_memberships_select_self_or_admin
  on workspace_memberships
  for select
  to authenticated
  using (
    (user_id = auth.uid() and status = 'active')
    or public.has_workspace_role(workspace_id, array['admin'])
  );

drop policy if exists workspace_memberships_admin_manage on workspace_memberships;
create policy workspace_memberships_admin_manage
  on workspace_memberships
  for all
  to authenticated
  using (public.has_workspace_role(workspace_id, array['admin']))
  with check (public.has_workspace_role(workspace_id, array['admin']));

drop policy if exists project_memberships_select_self_or_admin on project_memberships;
create policy project_memberships_select_self_or_admin
  on project_memberships
  for select
  to authenticated
  using (
    (user_id = auth.uid() and status = 'active')
    or public.has_workspace_role(workspace_id, array['admin','operations_leader','project_manager'])
  );

drop policy if exists project_memberships_admin_manage on project_memberships;
create policy project_memberships_admin_manage
  on project_memberships
  for all
  to authenticated
  using (public.has_workspace_role(workspace_id, array['admin','operations_leader','project_manager']))
  with check (public.has_workspace_role(workspace_id, array['admin','operations_leader','project_manager']));

drop policy if exists projects_select_workspace_or_project_member on projects;
create policy projects_select_workspace_or_project_member
  on projects
  for select
  to authenticated
  using (public.can_access_project(id));

drop policy if exists opportunities_select_active_workspace_member on opportunities;
create policy opportunities_select_active_workspace_member
  on opportunities
  for select
  to authenticated
  using (public.is_active_workspace_member(workspace_id));

-- Deferred to 0C-0E:
-- Billing V2, Field Issue/RFI/Change, Closeout, evidence custody, and durable
-- notification RLS remain out of scope for Foundation 0A.
