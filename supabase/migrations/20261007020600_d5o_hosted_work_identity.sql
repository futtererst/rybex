-- Forward-only hosted counterpart of the M1 Work Record identity contract.
-- All objects stay in the isolated D5O schema. Existing Rybex objects are untouched.
create table d5o_hosted.configuration_tenants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  status text not null check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table d5o_hosted.configuration_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references d5o_hosted.configuration_tenants(id),
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft', 'published', 'superseded')),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, version_number),
  unique (id, tenant_id),
  check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create table d5o_hosted.configuration_work_types (
  configuration_version_id uuid not null references d5o_hosted.configuration_versions(id),
  work_type_key text not null check (work_type_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  status text not null check (status in ('active', 'disabled')),
  primary key (configuration_version_id, work_type_key)
);

create table d5o_hosted.work_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  configuration_tenant_id uuid not null,
  configuration_version_id uuid not null,
  configuration_digest text not null check (configuration_digest ~ '^[0-9a-f]{64}$'),
  work_type_key text not null,
  title text not null check (length(trim(title)) between 1 and 240),
  lifecycle_state text not null default 'discover' check (lifecycle_state = 'discover'),
  record_version integer not null default 1 check (record_version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (configuration_tenant_id, workspace_id)
    references d5o_hosted.configuration_tenants(id, workspace_id),
  foreign key (configuration_version_id, configuration_tenant_id)
    references d5o_hosted.configuration_versions(id, tenant_id),
  foreign key (configuration_version_id, work_type_key)
    references d5o_hosted.configuration_work_types(configuration_version_id, work_type_key)
);
create index d5o_hosted_work_records_workspace_idx
  on d5o_hosted.work_records(workspace_id, created_at desc, id);

create table d5o_hosted.work_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  work_id uuid not null,
  event_type text not null check (event_type = 'work_created'),
  record_version integer not null check (record_version > 0),
  actor_user_id uuid not null references auth.users(id),
  membership_id uuid not null references d5o_hosted.memberships(id),
  authority_role text not null,
  configuration_version_id uuid not null references d5o_hosted.configuration_versions(id),
  configuration_digest text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now(),
  unique (work_id, record_version),
  foreign key (work_id, workspace_id) references d5o_hosted.work_records(id, workspace_id)
);

create table d5o_hosted.work_command_receipts (
  workspace_id uuid not null references d5o_hosted.workspaces(id),
  command_id text not null check (length(command_id) between 8 and 120),
  request_fingerprint text not null,
  work_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, command_id),
  foreign key (work_id, workspace_id) references d5o_hosted.work_records(id, workspace_id)
);

alter table d5o_hosted.configuration_tenants enable row level security;
alter table d5o_hosted.configuration_versions enable row level security;
alter table d5o_hosted.configuration_work_types enable row level security;
alter table d5o_hosted.work_records enable row level security;
alter table d5o_hosted.work_events enable row level security;
alter table d5o_hosted.work_command_receipts enable row level security;
revoke all on d5o_hosted.configuration_tenants, d5o_hosted.configuration_versions,
  d5o_hosted.configuration_work_types, d5o_hosted.work_records,
  d5o_hosted.work_events, d5o_hosted.work_command_receipts
  from public, anon, authenticated;

-- Read access is scoped by current, active membership. No client role can write tables.
grant select on d5o_hosted.work_records, d5o_hosted.work_events to authenticated;
create policy d5o_hosted_work_member_read on d5o_hosted.work_records
  for select to authenticated using (
    exists (select 1 from d5o_hosted.memberships m
      join d5o_hosted.workspaces w on w.id = m.workspace_id
      where m.workspace_id = work_records.workspace_id
        and m.actor_user_id = (select auth.uid())
        and m.status = 'active' and w.status = 'active')
  );
create policy d5o_hosted_work_event_member_read on d5o_hosted.work_events
  for select to authenticated using (
    exists (select 1 from d5o_hosted.work_records r where r.id = work_events.work_id
      and r.workspace_id = work_events.workspace_id)
  );

-- This is a command boundary. SECURITY DEFINER is required because authenticated
-- callers have no table INSERT privilege; every input is rechecked inside it.
create function public.d5o_hosted_create_work_v1(
  p_workspace_key text, p_command_id text, p_configuration_version_id uuid,
  p_work_type_key text, p_title text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_workspace d5o_hosted.workspaces%rowtype;
  v_membership d5o_hosted.memberships%rowtype;
  v_tenant d5o_hosted.configuration_tenants%rowtype;
  v_version d5o_hosted.configuration_versions%rowtype;
  v_count integer;
  v_fingerprint text;
  v_receipt d5o_hosted.work_command_receipts%rowtype;
  v_work_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or p_workspace_key is null or p_configuration_version_id is null
      or p_work_type_key is null or p_command_id is null
      or length(p_command_id) not between 8 and 120
      or p_title is null or length(trim(p_title)) not between 1 and 240 then
    raise exception 'invalid_work_command' using errcode = '22023';
  end if;
  select * into v_workspace from d5o_hosted.workspaces
    where workspace_key = p_workspace_key and status = 'active';
  if not found then raise exception 'workspace_forbidden' using errcode = '42501'; end if;
  select * into v_membership from d5o_hosted.memberships
    where workspace_id = v_workspace.id and actor_user_id = v_actor and status = 'active';
  if not found or v_membership.role = 'read_only_auditor' then
    raise exception 'workspace_forbidden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('d5o-hosted-work:' || v_workspace.id::text, 0));
  v_fingerprint := pg_catalog.md5(p_configuration_version_id::text || ':' ||
    p_work_type_key || ':' || trim(p_title));
  select * into v_receipt from d5o_hosted.work_command_receipts
    where workspace_id = v_workspace.id and command_id = p_command_id;
  if found then
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'command_id_reused' using errcode = '23505';
    end if;
    return v_receipt.result;
  end if;
  select count(*) into v_count from d5o_hosted.configuration_tenants
    where workspace_id = v_workspace.id and status = 'active';
  if v_count = 0 then raise exception 'no_tenant_mapping' using errcode = '22023'; end if;
  if v_count <> 1 then raise exception 'ambiguous_tenant_mapping' using errcode = '22023'; end if;
  select * into v_tenant from d5o_hosted.configuration_tenants
    where workspace_id = v_workspace.id and status = 'active';
  select * into v_version from d5o_hosted.configuration_versions
    where id = p_configuration_version_id and tenant_id = v_tenant.id
      and status = 'published' and effective_from <= now()
      and (effective_to is null or effective_to > now());
  if not found then raise exception 'configuration_unavailable' using errcode = '22023'; end if;
  if not exists (select 1 from d5o_hosted.configuration_work_types
      where configuration_version_id = v_version.id
        and work_type_key = p_work_type_key and status = 'active') then
    raise exception 'incompatible_work_type' using errcode = '22023';
  end if;
  insert into d5o_hosted.work_records(id, workspace_id, configuration_tenant_id,
    configuration_version_id, configuration_digest, work_type_key, title, created_by)
  values(v_work_id, v_workspace.id, v_tenant.id, v_version.id,
    v_version.source_sha256, p_work_type_key, trim(p_title), v_actor);
  insert into d5o_hosted.work_events(workspace_id, work_id, event_type, record_version,
    actor_user_id, membership_id, authority_role, configuration_version_id,
    configuration_digest, payload)
  values(v_workspace.id, v_work_id, 'work_created', 1, v_actor, v_membership.id,
    v_membership.role, v_version.id, v_version.source_sha256,
    pg_catalog.jsonb_build_object('title', trim(p_title), 'workTypeKey', p_work_type_key));
  v_result := pg_catalog.jsonb_build_object('workId', v_work_id, 'workspaceId', v_workspace.id,
    'recordVersion', 1, 'configurationVersionId', v_version.id,
    'configurationDigest', v_version.source_sha256);
  insert into d5o_hosted.work_command_receipts(workspace_id, command_id,
    request_fingerprint, work_id, result)
  values(v_workspace.id, p_command_id, v_fingerprint, v_work_id, v_result);
  return v_result;
end;
$$;
revoke all on function public.d5o_hosted_create_work_v1(text,text,uuid,text,text) from public, anon;
grant execute on function public.d5o_hosted_create_work_v1(text,text,uuid,text,text) to authenticated;

create function public.d5o_hosted_list_work_v1(p_workspace_key text, p_limit integer default 50)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_actor jsonb; v_records jsonb;
begin
  v_actor := public.d5o_hosted_actor_v1(p_workspace_key);
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  select coalesce(pg_catalog.jsonb_agg(x.item order by x.created_at desc, x.id), '[]'::jsonb)
    into v_records from (
      select r.id, r.created_at,
        pg_catalog.jsonb_build_object('id', r.id, 'title', r.title,
          'workTypeKey', r.work_type_key, 'lifecycleState', r.lifecycle_state,
          'recordVersion', r.record_version,
          'configurationVersionId', r.configuration_version_id,
          'createdAt', r.created_at) as item
      from d5o_hosted.work_records r
      where r.workspace_id = (v_actor->>'workspaceId')::uuid
      order by r.created_at desc, r.id limit p_limit
    ) x;
  return pg_catalog.jsonb_build_object('workspaceId', v_actor->>'workspaceId', 'records', v_records);
end;
$$;
revoke all on function public.d5o_hosted_list_work_v1(text,integer) from public, anon;
grant execute on function public.d5o_hosted_list_work_v1(text,integer) to authenticated;

create function public.d5o_hosted_load_work_v1(p_workspace_key text, p_work_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_actor jsonb; v_result jsonb;
begin
  v_actor := public.d5o_hosted_actor_v1(p_workspace_key);
  select pg_catalog.jsonb_build_object(
    'work', pg_catalog.to_jsonb(r),
    'history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e)
      order by e.record_version desc) from d5o_hosted.work_events e
      where e.work_id = r.id and e.workspace_id = r.workspace_id), '[]'::jsonb))
  into v_result from d5o_hosted.work_records r
  where r.id = p_work_id and r.workspace_id = (v_actor->>'workspaceId')::uuid;
  return v_result;
end;
$$;
revoke all on function public.d5o_hosted_load_work_v1(text,uuid) from public, anon;
grant execute on function public.d5o_hosted_load_work_v1(text,uuid) to authenticated;
