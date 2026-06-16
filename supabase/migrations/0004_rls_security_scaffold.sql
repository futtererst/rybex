-- RybexOS RLS + Storage Security Foundation scaffold.
--
-- Purpose:
-- - Define helper functions for future organization/workspace/project access.
-- - Document policy families for core workflow and evidence records.
-- - Avoid blindly enabling RLS across existing pilot tables before human review.
--
-- Production warning:
-- This migration intentionally does not run broad `alter table ... enable row
-- level security` statements. Enable RLS table-by-table only after Supabase Auth,
-- membership records, service-role boundaries, and pilot queries have been
-- tested in a non-production environment.

create or replace function public.auth_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.id
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and up.status = 'active'
  limit 1
$$;

create or replace function public.auth_user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_memberships wm
  where wm.user_profile_id = public.auth_user_profile_id()
    and wm.status = 'active'
$$;

create or replace function public.auth_user_role_keys()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_memberships wm
  where wm.user_profile_id = public.auth_user_profile_id()
    and wm.status = 'active'
$$;

create or replace function public.is_workspace_member(workspace_uuid uuid)
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
      and wm.user_profile_id = public.auth_user_profile_id()
      and wm.status = 'active'
  )
$$;

create or replace function public.has_workspace_permission(workspace_uuid uuid, permission_key text)
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
      and wm.user_profile_id = public.auth_user_profile_id()
      and wm.status = 'active'
      and (
        wm.role = 'admin'
        or permission_key = 'view'
        or (permission_key = 'finance' and wm.role in ('executive', 'operations_leader', 'project_manager', 'finance_admin'))
        or (permission_key = 'safety' and wm.role in ('operations_leader', 'project_manager', 'superintendent', 'field_supervisor', 'safety_manager'))
        or (permission_key = 'quality' and wm.role in ('operations_leader', 'project_manager', 'superintendent', 'field_supervisor', 'quality_manager'))
        or (permission_key = 'workflow_write' and wm.role in ('operations_leader', 'project_manager', 'superintendent', 'field_supervisor', 'safety_manager', 'quality_manager', 'finance_admin'))
        or (permission_key = 'evidence_upload' and wm.role in ('operations_leader', 'project_manager', 'superintendent', 'field_supervisor', 'safety_manager', 'quality_manager', 'finance_admin'))
      )
  )
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
      and public.is_workspace_member(p.workspace_id)
  )
$$;

create or replace function public.can_access_workflow_instance(workflow_instance_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workflow_instances wi
    where wi.id = workflow_instance_uuid
      and public.is_workspace_member(wi.workspace_id)
      and (wi.project_id is null or public.can_access_project(wi.project_id))
  )
$$;

create or replace function public.can_access_evidence_requirement(evidence_requirement_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workflow_evidence_requirements wer
    join public.workflow_instances wi on wi.id = wer.workflow_instance_id
    where wer.id = evidence_requirement_uuid
      and public.can_access_workflow_instance(wi.id)
  )
$$;

create or replace function public.security_scaffold_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'helper_functions', jsonb_build_array(
      'auth_user_profile_id',
      'auth_user_workspace_ids',
      'auth_user_role_keys',
      'is_workspace_member',
      'has_workspace_permission',
      'can_access_project',
      'can_access_workflow_instance',
      'can_access_evidence_requirement'
    ),
    'rls_enabled', (
      select coalesce(jsonb_object_agg(c.relname, c.relrowsecurity), '{}'::jsonb)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'organizations',
          'workspaces',
          'user_profiles',
          'workspace_memberships',
          'projects',
          'opportunities',
          'workflow_instances',
          'workflow_transactions',
          'workflow_evidence_requirements',
          'attachments',
          'entity_attachments',
          'audit_events',
          'status_history'
        )
    ),
    'policy_count', (
      select count(*)
      from pg_policies
      where schemaname in ('public', 'storage')
    ),
    'production_ready', false,
    'message', 'RLS helper scaffold exists. Broad RLS enforcement is intentionally not enabled by this migration.'
  )
$$;

comment on function public.auth_user_profile_id() is
  'Maps auth.uid() to public.user_profiles.id for future RLS policies.';
comment on function public.has_workspace_permission(uuid, text) is
  'RybexOS permission scaffold. Replace with normalized role/permission table checks before production.';
comment on function public.security_scaffold_status() is
  'Read-only diagnostic RPC for the RLS/security scaffold. Does not mutate data.';

-- Policy family scaffold. Review and enable table-by-table later.
--
-- organizations:
--   select where id is linked to a workspace membership.
--
-- workspaces:
--   select where public.is_workspace_member(id).
--
-- user_profiles / workspace_memberships:
--   users can select their own profile and memberships; admins can manage.
--
-- projects / opportunities:
--   select where public.is_workspace_member(workspace_id).
--   update/insert only through reviewed server actions and role-specific permissions.
--
-- workflow_instances:
--   select where public.can_access_workflow_instance(id).
--   update only for workflow transaction server actions with workflow_write permission.
--
-- workflow_transactions:
--   select through parent workflow instance access.
--   insert only through server-side transaction actions.
--
-- workflow_evidence_requirements:
--   select where public.can_access_evidence_requirement(id).
--   update only through server-side evidence upload/verification actions.
--
-- attachments / entity_attachments:
--   select inherits linked entity access.
--   insert only through server-side evidence upload actions.
--   delete/replacement requires admin or owner policy review.
--
-- audit_events / status_history:
--   select for authorized leadership/admin roles.
--   insert only through server-side trusted actions.
--
-- Example policy templates - intentionally commented:
--
-- alter table public.workflow_instances enable row level security;
-- create policy workflow_instances_select_member
--   on public.workflow_instances
--   for select
--   using (public.can_access_workflow_instance(id));
--
-- create policy workflow_transactions_select_member
--   on public.workflow_transactions
--   for select
--   using (public.can_access_workflow_instance(workflow_instance_id));
--
-- create policy workflow_evidence_select_member
--   on public.workflow_evidence_requirements
--   for select
--   using (public.can_access_evidence_requirement(id));
--
-- create policy attachments_select_via_entity_link
--   on public.attachments
--   for select
--   using (
--     exists (
--       select 1
--       from public.entity_attachments ea
--       where ea.attachment_id = attachments.id
--         and (
--           ea.entity_type <> 'workflow_evidence_requirement'
--           or public.can_access_evidence_requirement(ea.entity_id)
--         )
--     )
--   );
