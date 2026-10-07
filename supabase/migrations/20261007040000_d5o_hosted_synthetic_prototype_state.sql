-- Synthetic review state only. These snapshots are never authoritative M1
-- Work Records, decisions, evidence, or configuration. They keep the existing
-- six-stage prototype usable on stateless preview hosting.
create table d5o_hosted.prototype_states (
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  state_key text not null check (state_key in ('work', 'catalog', 'schedule')),
  revision bigint not null check (revision > 0),
  state_json jsonb not null check (pg_catalog.jsonb_typeof(state_json) = 'object'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, state_key)
);
create table d5o_hosted.prototype_state_revisions (
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  state_key text not null check (state_key in ('work', 'catalog', 'schedule')),
  revision bigint not null check (revision > 0),
  state_json jsonb not null,
  actor_user_id uuid not null references auth.users(id),
  membership_id uuid not null references d5o_hosted.memberships(id),
  recorded_at timestamptz not null default now(),
  primary key (workspace_id, state_key, revision)
);
create index d5o_hosted_prototype_revisions_recent_idx
  on d5o_hosted.prototype_state_revisions(workspace_id, recorded_at desc);

alter table d5o_hosted.prototype_states enable row level security;
alter table d5o_hosted.prototype_state_revisions enable row level security;
revoke all on d5o_hosted.prototype_states, d5o_hosted.prototype_state_revisions
  from public, anon, authenticated;

create function public.d5o_hosted_prototype_read_v1(
  p_workspace_key text, p_state_key text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_workspace uuid; v_state d5o_hosted.prototype_states%rowtype;
begin
  if auth.uid() is null or p_workspace_key is null or p_state_key is null
    or p_state_key not in ('work', 'catalog', 'schedule') then
    raise exception 'prototype_scope_forbidden' using errcode = '42501';
  end if;
  select w.id into v_workspace from d5o_hosted.workspaces w
  join d5o_hosted.memberships m on m.workspace_id = w.id
  where w.workspace_key = p_workspace_key and w.status = 'active'
    and m.actor_user_id = auth.uid() and m.status = 'active';
  if v_workspace is null then
    raise exception 'prototype_scope_forbidden' using errcode = '42501';
  end if;
  select * into v_state from d5o_hosted.prototype_states
    where workspace_id = v_workspace and state_key = p_state_key;
  if not found then return pg_catalog.jsonb_build_object('revision', 0, 'state', null); end if;
  return pg_catalog.jsonb_build_object('revision', v_state.revision, 'state', v_state.state_json);
end;
$$;

create function public.d5o_hosted_prototype_save_v1(
  p_workspace_key text, p_state_key text, p_expected_revision bigint, p_state jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_workspace uuid; v_membership d5o_hosted.memberships%rowtype;
  v_revision bigint;
begin
  if auth.uid() is null or p_workspace_key is null or p_state_key is null
    or p_state_key not in ('work', 'catalog', 'schedule')
    or p_expected_revision is null or p_expected_revision < 0
    or p_state is null or pg_catalog.jsonb_typeof(p_state) <> 'object'
    or p_state->>'workspace' is distinct from p_workspace_key
    or p_state->>'schemaVersion' is distinct from '1'
    or pg_catalog.octet_length(p_state::text) > 2000000 then
    raise exception 'invalid_prototype_state' using errcode = '22023';
  end if;
  if (p_state_key = 'work' and pg_catalog.jsonb_typeof(p_state->'records') is distinct from 'array')
    or (p_state_key = 'catalog' and (
      pg_catalog.jsonb_typeof(p_state->'records') is distinct from 'array'
      or pg_catalog.jsonb_typeof(p_state->'packages') is distinct from 'array'))
    or (p_state_key = 'schedule' and (
      pg_catalog.jsonb_typeof(p_state->'assignments') is distinct from 'array'
      or pg_catalog.jsonb_typeof(p_state->'availabilityBlocks') is distinct from 'array'
      or pg_catalog.jsonb_typeof(p_state->'publications') is distinct from 'array'
      or pg_catalog.jsonb_typeof(p_state->'receipts') is distinct from 'array')) then
    raise exception 'invalid_prototype_state' using errcode = '22023';
  end if;
  select m.* into v_membership
    from d5o_hosted.workspaces w
    join d5o_hosted.memberships m on m.workspace_id = w.id
    where w.workspace_key = p_workspace_key and w.status = 'active'
      and m.actor_user_id = auth.uid() and m.status = 'active';
  v_workspace := v_membership.workspace_id;
  if v_workspace is null or v_membership.role not in
    ('admin', 'operations_leader', 'project_manager', 'field_supervisor') then
    raise exception 'prototype_write_forbidden' using errcode = '42501';
  end if;
  if p_expected_revision = 0 then
    insert into d5o_hosted.prototype_states(
      workspace_id, state_key, revision, state_json, updated_by
    ) values (v_workspace, p_state_key, 1, p_state, auth.uid())
    on conflict (workspace_id, state_key) do nothing
    returning revision into v_revision;
  else
    update d5o_hosted.prototype_states set
      revision = revision + 1, state_json = p_state,
      updated_by = auth.uid(), updated_at = now()
    where workspace_id = v_workspace and state_key = p_state_key
      and revision = p_expected_revision
    returning revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'stale_prototype_state' using errcode = '23505';
  end if;
  insert into d5o_hosted.prototype_state_revisions(
    workspace_id, state_key, revision, state_json, actor_user_id, membership_id
  ) values (v_workspace, p_state_key, v_revision, p_state, auth.uid(), v_membership.id);
  return pg_catalog.jsonb_build_object('revision', v_revision, 'state', p_state);
end;
$$;

revoke all on function public.d5o_hosted_prototype_read_v1(text,text) from public, anon;
revoke all on function public.d5o_hosted_prototype_save_v1(text,text,bigint,jsonb) from public, anon;
grant execute on function public.d5o_hosted_prototype_read_v1(text,text) to authenticated;
grant execute on function public.d5o_hosted_prototype_save_v1(text,text,bigint,jsonb) to authenticated;
