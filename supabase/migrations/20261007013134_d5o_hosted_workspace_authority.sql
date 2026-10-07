-- Isolated hosted D5O authority foundation. This does not alter or seed the
-- existing Rybex application tables, users, workspaces, or memberships.
create schema d5o_hosted;
revoke all on schema d5o_hosted from public, anon, authenticated;

create table d5o_hosted.workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null unique
    check (workspace_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

create table d5o_hosted.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  actor_user_id uuid not null references auth.users(id),
  role text not null check (role in (
    'executive', 'operations_leader', 'business_development_lead',
    'project_manager', 'billing_commercial_lead', 'field_supervisor',
    'closeout_lead', 'admin', 'read_only_auditor'
  )),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (workspace_id, actor_user_id)
);
create index d5o_hosted_memberships_actor_idx
  on d5o_hosted.memberships(actor_user_id, status, workspace_id);

-- No Data API role can query or mutate the isolated tables directly.
alter table d5o_hosted.workspaces enable row level security;
alter table d5o_hosted.memberships enable row level security;
revoke all on all tables in schema d5o_hosted from public, anon, authenticated;

-- Explicit workspace selection is required. Organization membership alone
-- never grants D5O workspace authority, and there is no first-match fallback.
create function public.d5o_hosted_actor_v1(p_workspace_key text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_actor jsonb;
begin
  if v_user is null or p_workspace_key is null then
    raise exception 'workspace_forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'actorUserId', v_user,
    'workspaceId', w.id,
    'workspaceKey', w.workspace_key,
    'workspaceName', w.display_name,
    'membershipId', m.id,
    'role', m.role
  ) into v_actor
  from d5o_hosted.workspaces w
  join d5o_hosted.memberships m on m.workspace_id = w.id
  where w.workspace_key = p_workspace_key
    and w.status = 'active'
    and m.actor_user_id = v_user
    and m.status = 'active';

  if v_actor is null then
    raise exception 'workspace_forbidden' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;
revoke all on function public.d5o_hosted_actor_v1(text) from public, anon;
grant execute on function public.d5o_hosted_actor_v1(text) to authenticated;

-- A signed-in user may see only their own explicitly assigned workspaces.
-- This read model does not select an active workspace on the user's behalf.
create function public.d5o_hosted_workspaces_v1()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_workspaces jsonb;
begin
  if v_user is null then
    raise exception 'workspace_forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'workspaceId', w.id,
    'workspaceKey', w.workspace_key,
    'workspaceName', w.display_name,
    'role', m.role
  ) order by w.workspace_key), '[]'::jsonb)
  into v_workspaces
  from d5o_hosted.workspaces w
  join d5o_hosted.memberships m on m.workspace_id = w.id
  where w.status = 'active'
    and m.actor_user_id = v_user
    and m.status = 'active';
  return v_workspaces;
end;
$$;
revoke all on function public.d5o_hosted_workspaces_v1() from public, anon;
grant execute on function public.d5o_hosted_workspaces_v1() to authenticated;
