-- Disposable Postgres-only harness. Never run against a Supabase project.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end;
$$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

\i /tmp/d5o-hosted-authority.sql
\i /tmp/d5o-hosted-invoker-hardening.sql

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
insert into d5o_hosted.workspaces(id, workspace_key, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'rybex', 'Synthetic Rybex'),
  ('10000000-0000-4000-8000-000000000002', 'rotork', 'Synthetic Rotork');
insert into d5o_hosted.memberships(workspace_id, actor_user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'admin'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'project_manager');

do $$
begin
  if has_function_privilege('anon', 'public.d5o_hosted_actor_v1(text)', 'execute')
    or has_function_privilege('anon', 'public.d5o_hosted_workspaces_v1()', 'execute')
    or has_schema_privilege('anon', 'd5o_hosted', 'usage')
    or not has_table_privilege('authenticated', 'd5o_hosted.memberships', 'select')
    or has_table_privilege('authenticated', 'd5o_hosted.workspaces', 'insert')
    or exists (
      select 1 from pg_proc
      where oid in (
        'public.d5o_hosted_actor_v1(text)'::regprocedure,
        'public.d5o_hosted_workspaces_v1()'::regprocedure
      ) and prosecdef
    )
  then raise exception 'hosted_authority_grants_too_broad'; end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
begin
  if public.d5o_hosted_actor_v1('rybex')->>'role' <> 'admin'
    or jsonb_array_length(public.d5o_hosted_workspaces_v1()) <> 1
    or (select count(*) from d5o_hosted.memberships) <> 1
    or (select count(*) from d5o_hosted.workspaces) <> 1
  then raise exception 'expected_rybex_membership_missing'; end if;
  begin
    perform public.d5o_hosted_actor_v1('rotork');
    raise exception 'cross_workspace_access_succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
do $$
begin
  if public.d5o_hosted_workspaces_v1() <> '[]'::jsonb then
    raise exception 'unassigned_workspace_visible';
  end if;
  if (select count(*) from d5o_hosted.memberships) <> 0
    or (select count(*) from d5o_hosted.workspaces) <> 0
  then raise exception 'unassigned_direct_read_visible'; end if;
  begin
    perform public.d5o_hosted_actor_v1('rybex');
    raise exception 'membership_bypass_succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set role anon;
do $$
begin
  begin
    perform public.d5o_hosted_workspaces_v1();
    raise exception 'anonymous_workspace_list_succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

update d5o_hosted.memberships set status = 'suspended'
where actor_user_id = '00000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
begin
  if public.d5o_hosted_workspaces_v1() <> '[]'::jsonb then
    raise exception 'suspended_membership_visible';
  end if;
  begin
    perform public.d5o_hosted_actor_v1('rybex');
    raise exception 'suspended_membership_accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

update d5o_hosted.memberships set status = 'active'
where actor_user_id = '00000000-0000-4000-8000-000000000001';
update d5o_hosted.workspaces set status = 'disabled' where workspace_key = 'rybex';
set role authenticated;
do $$
begin
  if public.d5o_hosted_workspaces_v1() <> '[]'::jsonb then
    raise exception 'disabled_workspace_visible';
  end if;
  begin
    perform public.d5o_hosted_actor_v1('rybex');
    raise exception 'disabled_workspace_accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'PASS: isolated workspace resolution and access denials' as result;
