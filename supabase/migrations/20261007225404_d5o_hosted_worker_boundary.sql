-- Isolated synthetic worker role and private assignment binding.
alter table d5o_hosted.memberships drop constraint memberships_role_check;
alter table d5o_hosted.memberships add constraint memberships_role_check check (role in (
  'executive', 'operations_leader', 'business_development_lead', 'project_manager',
  'billing_commercial_lead', 'field_supervisor', 'field_worker', 'closeout_lead',
  'admin', 'read_only_auditor'));
create table d5o_hosted.crew_bindings (
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  actor_user_id uuid not null references auth.users(id),
  person text not null check (length(trim(person)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (workspace_id, actor_user_id), unique (workspace_id, person));
alter table d5o_hosted.crew_bindings enable row level security;
revoke all on d5o_hosted.crew_bindings from public, anon, authenticated;

-- Existing full-snapshot RPC must never serve a field worker.
create or replace function public.d5o_hosted_prototype_read_v1(p_workspace_key text, p_state_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_workspace uuid; v_state d5o_hosted.prototype_states%rowtype;
begin
  if auth.uid() is null or p_workspace_key is null or p_state_key not in ('work', 'catalog', 'schedule') then
    raise exception 'prototype_scope_forbidden' using errcode = '42501'; end if;
  select w.id into v_workspace from d5o_hosted.workspaces w
  join d5o_hosted.memberships m on m.workspace_id = w.id
  where w.workspace_key = p_workspace_key and w.status = 'active'
    and m.actor_user_id = auth.uid() and m.status = 'active' and m.role <> 'field_worker';
  if v_workspace is null then raise exception 'prototype_scope_forbidden' using errcode = '42501'; end if;
  select * into v_state from d5o_hosted.prototype_states
    where workspace_id = v_workspace and state_key = p_state_key;
  if not found then return pg_catalog.jsonb_build_object('revision', 0, 'state', null); end if;
  return pg_catalog.jsonb_build_object('revision', v_state.revision, 'state', v_state.state_json);
end; $$;

-- Called only through server-only service credentials after authenticated membership checks.
create function public.d5o_hosted_worker_binding_v1(p_workspace_key text, p_actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_person text;
begin
  select b.person into v_person from d5o_hosted.crew_bindings b
  join d5o_hosted.workspaces w on w.id = b.workspace_id
  join d5o_hosted.memberships m on m.workspace_id = w.id and m.actor_user_id = b.actor_user_id
  where w.workspace_key = p_workspace_key and w.status = 'active' and b.active
    and b.actor_user_id = p_actor_user_id and m.status = 'active' and m.role = 'field_worker';
  return pg_catalog.jsonb_build_object('person', v_person);
end; $$;
create function public.d5o_hosted_server_read_v1(p_workspace_key text, p_state_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_state d5o_hosted.prototype_states%rowtype;
begin
  if p_state_key not in ('work', 'catalog', 'schedule') then raise exception 'invalid_state' using errcode = '22023'; end if;
  select s.* into v_state from d5o_hosted.prototype_states s
  join d5o_hosted.workspaces w on w.id = s.workspace_id
  where w.workspace_key = p_workspace_key and w.status = 'active' and s.state_key = p_state_key;
  if not found then return pg_catalog.jsonb_build_object('revision', 0, 'state', null); end if;
  return pg_catalog.jsonb_build_object('revision', v_state.revision, 'state', v_state.state_json);
end; $$;
create function public.d5o_hosted_server_worker_save_v1(
  p_workspace_key text, p_state_key text, p_expected_revision bigint, p_state jsonb,
  p_actor_user_id uuid, p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_workspace uuid; v_revision bigint;
begin
  if p_state_key not in ('work', 'schedule') or p_expected_revision < 1
    or p_state is null or pg_catalog.jsonb_typeof(p_state) <> 'object'
    or p_state->>'workspace' is distinct from p_workspace_key
    or p_state->>'schemaVersion' is distinct from '1'
    or pg_catalog.octet_length(p_state::text) > 2000000 then
    raise exception 'invalid_state' using errcode = '22023'; end if;
  select w.id into v_workspace from d5o_hosted.workspaces w
  join d5o_hosted.memberships m on m.workspace_id = w.id
  join d5o_hosted.crew_bindings b on b.workspace_id = w.id and b.actor_user_id = m.actor_user_id
  where w.workspace_key = p_workspace_key and w.status = 'active' and m.id = p_membership_id
    and m.actor_user_id = p_actor_user_id and m.role = 'field_worker' and m.status = 'active' and b.active;
  if v_workspace is null then raise exception 'worker_scope_forbidden' using errcode = '42501'; end if;
  update d5o_hosted.prototype_states set revision = revision + 1, state_json = p_state,
    updated_by = p_actor_user_id, updated_at = now()
  where workspace_id = v_workspace and state_key = p_state_key and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'stale_state' using errcode = '23505'; end if;
  insert into d5o_hosted.prototype_state_revisions
    (workspace_id, state_key, revision, state_json, actor_user_id, membership_id)
  values (v_workspace, p_state_key, v_revision, p_state, p_actor_user_id, p_membership_id);
  return pg_catalog.jsonb_build_object('revision', v_revision, 'state', p_state);
end; $$;
revoke all on function public.d5o_hosted_worker_binding_v1(text,uuid) from public, anon, authenticated;
revoke all on function public.d5o_hosted_server_read_v1(text,text) from public, anon, authenticated;
revoke all on function public.d5o_hosted_server_worker_save_v1(text,text,bigint,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.d5o_hosted_worker_binding_v1(text,uuid) to service_role;
grant execute on function public.d5o_hosted_server_read_v1(text,text) to service_role;
grant execute on function public.d5o_hosted_server_worker_save_v1(text,text,bigint,jsonb,uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('d5o-deploy-evidence','d5o-deploy-evidence',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']);
