-- Foundation 0B - Shared Command, Audit, Concurrency, and Evidence Foundation
--
-- Scope:
-- - Shared command idempotency.
-- - Optimistic-concurrency reference command.
-- - Append-only audit and immutable domain events.
-- - Private evidence metadata/link model and storage bucket.
-- - Does not migrate Billing, Field Issue/RFI/Change, or Closeout domain state.

create extension if not exists "pgcrypto";

create schema if not exists rybex_internal;
revoke all on schema rybex_internal from public;
grant usage on schema rybex_internal to authenticated, service_role;

alter table audit_events
  add column if not exists command_id text,
  add column if not exists previous_status text,
  add column if not exists resulting_status text,
  add column if not exists correlation_id text,
  add column if not exists actor_auth_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists before_values jsonb,
  add column if not exists after_values jsonb,
  add column if not exists occurred_at timestamptz not null default now();

update audit_events
set occurred_at = created_at
where occurred_at is null;

create index if not exists audit_events_workspace_time_idx on audit_events(workspace_id, occurred_at desc);
create index if not exists audit_events_entity_time_idx on audit_events(workspace_id, entity_type, entity_id, occurred_at desc);
create index if not exists audit_events_actor_time_idx on audit_events(workspace_id, actor_user_id, occurred_at desc);
create index if not exists audit_events_actor_auth_time_idx on audit_events(workspace_id, actor_auth_user_id, occurred_at desc);
create index if not exists audit_events_command_idx on audit_events(workspace_id, command_id);

create table if not exists command_idempotency (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  command_id text not null,
  command_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  request_hash text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  correlation_id text not null,
  result_status text not null default 'in_progress',
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, command_id),
  constraint command_idempotency_result_status_check
    check (result_status in ('in_progress', 'completed', 'failed'))
);

create index if not exists command_idempotency_workspace_created_idx on command_idempotency(workspace_id, created_at desc);
create index if not exists command_idempotency_entity_idx on command_idempotency(workspace_id, entity_type, entity_id);
create index if not exists command_idempotency_type_idx on command_idempotency(workspace_id, command_type);

create table if not exists domain_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version integer not null,
  event_type text not null,
  event_version integer not null default 1,
  command_id text not null,
  correlation_id text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (workspace_id, aggregate_type, aggregate_id, command_id, event_type)
);

create index if not exists domain_events_aggregate_idx on domain_events(workspace_id, aggregate_type, aggregate_id, occurred_at desc);
create index if not exists domain_events_command_idx on domain_events(workspace_id, command_id);
create index if not exists domain_events_time_idx on domain_events(workspace_id, occurred_at desc);

create table if not exists evidence_objects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  bucket_id text not null default 'rybexos-evidence',
  object_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint,
  checksum_sha256 text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  upload_status text not null default 'pending_upload',
  scan_status text not null default 'not_configured',
  verification_status text not null default 'pending',
  version integer not null default 1,
  supersedes_evidence_id uuid references evidence_objects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_at timestamptz,
  constraint evidence_objects_upload_status_check
    check (upload_status in ('pending_upload', 'uploaded', 'failed', 'superseded')),
  constraint evidence_objects_scan_status_check
    check (scan_status in ('pending', 'clean', 'quarantined', 'failed', 'not_configured')),
  constraint evidence_objects_verification_status_check
    check (verification_status in ('pending', 'accepted', 'rejected', 'superseded')),
  unique (workspace_id, object_path)
);

create trigger set_evidence_objects_updated_at
before update on evidence_objects
for each row
execute function set_updated_at();

create index if not exists evidence_objects_workspace_created_idx on evidence_objects(workspace_id, created_at desc);
create index if not exists evidence_objects_project_idx on evidence_objects(workspace_id, project_id);
create index if not exists evidence_objects_uploaded_by_idx on evidence_objects(workspace_id, uploaded_by);

create table if not exists evidence_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  evidence_object_id uuid not null references evidence_objects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  relationship_type text not null default 'evidence',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, evidence_object_id, entity_type, entity_id, relationship_type)
);

create index if not exists evidence_links_entity_idx on evidence_links(workspace_id, entity_type, entity_id);
create index if not exists evidence_links_evidence_idx on evidence_links(evidence_object_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rybexos-evidence',
  'rybexos-evidence',
  false,
  1048576,
  array['text/plain', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

grant select on command_idempotency to service_role;
grant insert, update, delete on command_idempotency to service_role;
grant select on audit_events to authenticated, service_role;
grant insert, update, delete on audit_events to service_role;
grant select on domain_events to authenticated, service_role;
grant insert, update, delete on domain_events to service_role;
grant select on evidence_objects, evidence_links to authenticated, service_role;
grant insert, update, delete on evidence_objects, evidence_links to service_role;

alter table command_idempotency enable row level security;
alter table audit_events enable row level security;
alter table domain_events enable row level security;
alter table evidence_objects enable row level security;
alter table evidence_links enable row level security;

drop policy if exists command_idempotency_no_direct_access on command_idempotency;
create policy command_idempotency_no_direct_access
  on command_idempotency
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists audit_events_select_authorized on audit_events;
create policy audit_events_select_authorized
  on audit_events
  for select
  to authenticated
  using (
    public.is_active_workspace_member(workspace_id)
    and public.has_workspace_role(workspace_id, array['admin','executive','operations_leader','read_only_auditor'])
  );

drop policy if exists domain_events_select_authorized on domain_events;
create policy domain_events_select_authorized
  on domain_events
  for select
  to authenticated
  using (
    public.is_active_workspace_member(workspace_id)
    and public.has_workspace_role(workspace_id, array['admin','executive','operations_leader','read_only_auditor'])
  );

drop policy if exists evidence_objects_select_authorized on evidence_objects;
create policy evidence_objects_select_authorized
  on evidence_objects
  for select
  to authenticated
  using (
    public.is_active_workspace_member(workspace_id)
    and (
      project_id is null
      or public.can_access_project(project_id)
    )
  );

drop policy if exists evidence_links_select_authorized on evidence_links;
create policy evidence_links_select_authorized
  on evidence_links
  for select
  to authenticated
  using (
    public.is_active_workspace_member(workspace_id)
    and (
      project_id is null
      or public.can_access_project(project_id)
    )
  );

drop policy if exists storage_evidence_select_authorized on storage.objects;
create policy storage_evidence_select_authorized
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'rybexos-evidence'
    and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
    and (
      (storage.foldername(name))[2] = 'unassigned'
      or public.can_access_project((storage.foldername(name))[2]::uuid)
    )
  );

drop policy if exists storage_evidence_insert_authorized_pending on storage.objects;
create policy storage_evidence_insert_authorized_pending
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'rybexos-evidence'
    and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
    and exists (
      select 1
      from public.evidence_objects eo
      where eo.workspace_id = (storage.foldername(name))[1]::uuid
        and eo.object_path = name
        and eo.uploaded_by = auth.uid()
        and eo.upload_status = 'pending_upload'
    )
  );

drop policy if exists storage_evidence_no_update on storage.objects;
create policy storage_evidence_no_update
  on storage.objects
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists storage_evidence_no_delete on storage.objects;
create policy storage_evidence_no_delete
  on storage.objects
  for delete
  to authenticated
  using (false);

create or replace function rybex_internal.command_lock_key(workspace_uuid uuid, command_text text)
returns bigint
language sql
immutable
set search_path = public, pg_temp
as $$
  select hashtextextended(workspace_uuid::text || ':' || command_text, 0)
$$;

create or replace function rybex_internal.claim_or_replay_command(
  p_workspace_id uuid,
  p_command_id text,
  p_command_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_request_hash text,
  p_actor_user_id uuid,
  p_correlation_id text
)
returns table(action text, existing_result jsonb)
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
<<update_workspace_command>>
declare
  existing command_idempotency%rowtype;
begin
  perform pg_advisory_xact_lock(rybex_internal.command_lock_key(p_workspace_id, p_command_id));

  select *
  into existing
  from command_idempotency
  where workspace_id = p_workspace_id
    and command_id = p_command_id
  for update;

  if found then
    if existing.request_hash <> p_request_hash then
      return query select 'mismatch'::text, jsonb_build_object('error', 'idempotency_mismatch');
      return;
    end if;

    if existing.result_status = 'completed' then
      return query select 'replay'::text, existing.result_payload;
      return;
    end if;

    return query select 'in_progress'::text, jsonb_build_object('error', 'command_in_progress');
    return;
  end if;

  insert into command_idempotency (
    workspace_id,
    command_id,
    command_type,
    entity_type,
    entity_id,
    request_hash,
    actor_user_id,
    correlation_id
  )
  values (
    p_workspace_id,
    p_command_id,
    p_command_type,
    p_entity_type,
    p_entity_id,
    p_request_hash,
    p_actor_user_id,
    p_correlation_id
  );

  return query select 'claimed'::text, '{}'::jsonb;
end;
$$;

create or replace function rybex_internal.append_audit_event(
  p_workspace_id uuid,
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_command_id text,
  p_action text,
  p_previous_status text,
  p_resulting_status text,
  p_actor_user_id uuid,
  p_correlation_id text,
  p_before_values jsonb,
  p_after_values jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  actor_profile_id uuid;
begin
  select up.id
  into actor_profile_id
  from user_profiles up
  where up.user_id = p_actor_user_id
     or up.auth_user_id = p_actor_user_id
  limit 1;

  insert into audit_events (
    workspace_id,
    project_id,
    entity_type,
    entity_id,
    command_id,
    action,
    previous_status,
    resulting_status,
    actor_user_id,
    actor_auth_user_id,
    correlation_id,
    before_values,
    after_values,
    before_state,
    after_state,
    metadata,
    summary,
    occurred_at,
    created_at
  )
  values (
    p_workspace_id,
    p_project_id,
    p_entity_type,
    p_entity_id,
    p_command_id,
    p_action,
    p_previous_status,
    p_resulting_status,
    actor_profile_id,
    p_actor_user_id,
    p_correlation_id,
    coalesce(p_before_values, '{}'::jsonb),
    coalesce(p_after_values, '{}'::jsonb),
    coalesce(p_before_values, '{}'::jsonb),
    coalesce(p_after_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    p_action,
    now(),
    now()
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function rybex_internal.append_domain_event(
  p_workspace_id uuid,
  p_project_id uuid,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_aggregate_version integer,
  p_event_type text,
  p_event_version integer,
  p_command_id text,
  p_correlation_id text,
  p_actor_user_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  insert into domain_events (
    workspace_id,
    project_id,
    aggregate_type,
    aggregate_id,
    aggregate_version,
    event_type,
    event_version,
    command_id,
    correlation_id,
    actor_user_id,
    payload,
    occurred_at
  )
  values (
    p_workspace_id,
    p_project_id,
    p_aggregate_type,
    p_aggregate_id,
    p_aggregate_version,
    p_event_type,
    p_event_version,
    p_command_id,
    p_correlation_id,
    p_actor_user_id,
    coalesce(p_payload, '{}'::jsonb),
    now()
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function rybex_internal.complete_command(
  p_workspace_id uuid,
  p_command_id text,
  p_result_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update command_idempotency
  set result_status = 'completed',
      result_payload = coalesce(p_result_payload, '{}'::jsonb),
      completed_at = now()
  where workspace_id = p_workspace_id
    and command_id = p_command_id;
end;
$$;

create or replace function public.update_workspace_display_name_v1(
  p_command_id text,
  p_expected_version integer,
  p_new_display_name text,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  resolved_workspace_id uuid;
  workspace_role text;
  current_workspace workspaces%rowtype;
  claim record;
  existing_command command_idempotency%rowtype;
  request_hash text;
  next_version integer;
  audit_id uuid;
  event_id uuid;
  result jsonb;
  correlation text := coalesce(nullif(p_correlation_id, ''), gen_random_uuid()::text);
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  select up.active_workspace_id
  into resolved_workspace_id
  from user_profiles up
  where up.user_id = actor
    and up.status = 'active'
  limit 1;

  if resolved_workspace_id is null then
    select wm.workspace_id
    into resolved_workspace_id
    from workspace_memberships wm
    where wm.user_id = actor
      and wm.status = 'active'
    limit 1;
  end if;

  if resolved_workspace_id is null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;

  workspace_role := public.current_workspace_role(resolved_workspace_id);
  if workspace_role <> 'admin' then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_command_id is null or length(trim(p_command_id)) < 8 then
    return jsonb_build_object('success', false, 'error', 'validation_failed');
  end if;

  if p_new_display_name is null or length(trim(p_new_display_name)) < 2 or length(trim(p_new_display_name)) > 120 then
    return jsonb_build_object('success', false, 'error', 'validation_failed');
  end if;

  select *
  into current_workspace
  from workspaces
  where id = resolved_workspace_id
  for update;

  request_hash := encode(extensions.digest(
    convert_to(resolved_workspace_id::text || '|' || p_expected_version::text || '|' || trim(p_new_display_name), 'UTF8'),
    'sha256'
  ), 'hex');

  select *
  into existing_command
  from command_idempotency ci
  where ci.workspace_id = resolved_workspace_id
    and ci.command_id = p_command_id;

  if found then
    if existing_command.request_hash <> request_hash then
      return jsonb_build_object('success', false, 'error', 'idempotency_mismatch');
    end if;

    if existing_command.result_status = 'completed' then
      return existing_command.result_payload || jsonb_build_object('success', true, 'replayed', true);
    end if;

    return jsonb_build_object('success', false, 'error', 'command_in_progress');
  end if;

  if current_workspace.version <> p_expected_version then
    return jsonb_build_object(
      'success', false,
      'error', 'concurrency_conflict',
      'currentVersion', current_workspace.version
    );
  end if;

  select *
  into claim
  from rybex_internal.claim_or_replay_command(
    resolved_workspace_id,
    p_command_id,
    'workspace.update_display_name.v1',
    'workspace',
    resolved_workspace_id,
    request_hash,
    actor,
    correlation
  );

  if claim.action = 'replay' then
    return claim.existing_result || jsonb_build_object('success', true, 'replayed', true);
  end if;

  if claim.action = 'mismatch' then
    return jsonb_build_object('success', false, 'error', 'idempotency_mismatch');
  end if;

  next_version := current_workspace.version + 1;

  update workspaces
  set name = trim(p_new_display_name),
      version = next_version,
      updated_at = now()
  where id = resolved_workspace_id;

  audit_id := rybex_internal.append_audit_event(
    resolved_workspace_id,
    null,
    'workspace',
    resolved_workspace_id,
    p_command_id,
    'workspace.display_name_updated',
    current_workspace.status,
    current_workspace.status,
    actor,
    correlation,
    jsonb_build_object('name', current_workspace.name, 'version', current_workspace.version),
    jsonb_build_object('name', trim(p_new_display_name), 'version', next_version),
    jsonb_build_object('foundationIncrement', '0B')
  );

  event_id := rybex_internal.append_domain_event(
    resolved_workspace_id,
    null,
    'workspace',
    resolved_workspace_id,
    next_version,
    'workspace.display_name_updated',
    1,
    p_command_id,
    correlation,
    actor,
    jsonb_build_object('name', trim(p_new_display_name), 'version', next_version)
  );

  result := jsonb_build_object(
    'success', true,
    'replayed', false,
    'workspaceId', resolved_workspace_id,
    'name', trim(p_new_display_name),
    'resultingVersion', next_version,
    'auditEventId', audit_id,
    'domainEventId', event_id,
    'correlationId', correlation
  );

  perform rybex_internal.complete_command(resolved_workspace_id, p_command_id, result);

  return result;
exception
  when others then
    raise;
end;
$$;

create or replace function public.create_evidence_upload_intent_v1(
  p_entity_type text,
  p_entity_id uuid,
  p_project_id uuid,
  p_original_filename text,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  workspace_id uuid;
  evidence_id uuid := gen_random_uuid();
  safe_name text;
  object_path text;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  select up.active_workspace_id
  into workspace_id
  from user_profiles up
  where up.user_id = actor
    and up.status = 'active'
  limit 1;

  if workspace_id is null then
    return jsonb_build_object('success', false, 'error', 'workspace_required');
  end if;

  if p_project_id is not null and not public.can_access_project(p_project_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_mime_type not in ('text/plain', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp') then
    return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'unsupported_mime_type');
  end if;

  safe_name := regexp_replace(coalesce(nullif(trim(p_original_filename), ''), 'evidence.txt'), '[^a-zA-Z0-9._-]', '-', 'g');
  safe_name := left(regexp_replace(safe_name, '-+', '-', 'g'), 120);
  object_path := workspace_id::text || '/' || coalesce(p_project_id::text, 'unassigned') || '/' || p_entity_type || '/' || p_entity_id::text || '/' || evidence_id::text || '/' || safe_name;

  insert into evidence_objects (
    id,
    workspace_id,
    project_id,
    bucket_id,
    object_path,
    original_filename,
    mime_type,
    uploaded_by
  )
  values (
    evidence_id,
    workspace_id,
    p_project_id,
    'rybexos-evidence',
    object_path,
    p_original_filename,
    p_mime_type,
    actor
  );

  return jsonb_build_object(
    'success', true,
    'evidenceId', evidence_id,
    'bucket', 'rybexos-evidence',
    'objectPath', object_path
  );
end;
$$;

create or replace function public.finalize_evidence_upload_v1(
  p_evidence_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_relationship_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text,
  p_expected_version integer,
  p_command_id text,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  evidence evidence_objects%rowtype;
  storage_exists boolean;
  claim record;
  existing_command command_idempotency%rowtype;
  request_hash text;
  audit_id uuid;
  event_id uuid;
  link_id uuid;
  result jsonb;
  correlation text := coalesce(nullif(p_correlation_id, ''), gen_random_uuid()::text);
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  select *
  into evidence
  from evidence_objects
  where id = p_evidence_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.is_active_workspace_member(evidence.workspace_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if evidence.project_id is not null and not public.can_access_project(evidence.project_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  request_hash := encode(extensions.digest(
    convert_to(evidence.id::text || '|' || p_expected_version::text || '|' || p_size_bytes::text || '|' || p_checksum_sha256, 'UTF8'),
    'sha256'
  ), 'hex');

  select *
  into existing_command
  from command_idempotency ci
  where ci.workspace_id = evidence.workspace_id
    and ci.command_id = p_command_id;

  if found then
    if existing_command.request_hash <> request_hash then
      return jsonb_build_object('success', false, 'error', 'idempotency_mismatch');
    end if;

    if existing_command.result_status = 'completed' then
      return existing_command.result_payload || jsonb_build_object('success', true, 'replayed', true);
    end if;

    return jsonb_build_object('success', false, 'error', 'command_in_progress');
  end if;

  if evidence.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', evidence.version);
  end if;

  select *
  into claim
  from rybex_internal.claim_or_replay_command(
    evidence.workspace_id,
    p_command_id,
    'evidence.finalize_upload.v1',
    'evidence_object',
    evidence.id,
    request_hash,
    actor,
    correlation
  );

  if claim.action = 'replay' then
    return claim.existing_result || jsonb_build_object('success', true, 'replayed', true);
  end if;

  if claim.action = 'mismatch' then
    return jsonb_build_object('success', false, 'error', 'idempotency_mismatch');
  end if;

  select exists (
    select 1
    from storage.objects so
    where so.bucket_id = evidence.bucket_id
      and so.name = evidence.object_path
  )
  into storage_exists;

  if not storage_exists then
    return jsonb_build_object('success', false, 'error', 'missing_storage_object');
  end if;

  update evidence_objects
  set upload_status = 'uploaded',
      scan_status = 'not_configured',
      verification_status = 'pending',
      size_bytes = p_size_bytes,
      checksum_sha256 = p_checksum_sha256,
      version = evidence.version + 1,
      uploaded_at = now()
  where id = evidence.id;

  insert into evidence_links (
    workspace_id,
    project_id,
    evidence_object_id,
    entity_type,
    entity_id,
    relationship_type,
    created_by
  )
  values (
    evidence.workspace_id,
    evidence.project_id,
    evidence.id,
    p_entity_type,
    p_entity_id,
    coalesce(nullif(p_relationship_type, ''), 'evidence'),
    actor
  )
  on conflict (workspace_id, evidence_object_id, entity_type, entity_id, relationship_type)
  do update set relationship_type = excluded.relationship_type
  returning id into link_id;

  audit_id := rybex_internal.append_audit_event(
    evidence.workspace_id,
    evidence.project_id,
    'evidence_object',
    evidence.id,
    p_command_id,
    'evidence.upload_finalized',
    evidence.upload_status,
    'uploaded',
    actor,
    correlation,
    jsonb_build_object('uploadStatus', evidence.upload_status, 'version', evidence.version),
    jsonb_build_object('uploadStatus', 'uploaded', 'version', evidence.version + 1, 'sizeBytes', p_size_bytes, 'checksumSha256', p_checksum_sha256),
    jsonb_build_object('entityType', p_entity_type, 'entityId', p_entity_id)
  );

  event_id := rybex_internal.append_domain_event(
    evidence.workspace_id,
    evidence.project_id,
    'evidence_object',
    evidence.id,
    evidence.version + 1,
    'evidence.upload_finalized',
    1,
    p_command_id,
    correlation,
    actor,
    jsonb_build_object('evidenceId', evidence.id, 'entityType', p_entity_type, 'entityId', p_entity_id)
  );

  result := jsonb_build_object(
    'success', true,
    'replayed', false,
    'evidenceId', evidence.id,
    'linkId', link_id,
    'resultingVersion', evidence.version + 1,
    'auditEventId', audit_id,
    'domainEventId', event_id,
    'correlationId', correlation
  );

  perform rybex_internal.complete_command(evidence.workspace_id, p_command_id, result);

  return result;
end;
$$;

create or replace function public.create_evidence_download_grant_v1(p_evidence_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evidence evidence_objects%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  select *
  into evidence
  from evidence_objects
  where id = p_evidence_id
    and upload_status = 'uploaded';

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.is_active_workspace_member(evidence.workspace_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if evidence.project_id is not null and not public.can_access_project(evidence.project_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  return jsonb_build_object(
    'success', true,
    'bucket', evidence.bucket_id,
    'objectPath', evidence.object_path,
    'expiresIn', 60
  );
end;
$$;

grant execute on function public.update_workspace_display_name_v1(text, integer, text, text) to authenticated;
grant execute on function public.create_evidence_upload_intent_v1(text, uuid, uuid, text, text) to authenticated;
grant execute on function public.finalize_evidence_upload_v1(uuid, text, uuid, text, bigint, text, integer, text, text) to authenticated;
grant execute on function public.create_evidence_download_grant_v1(uuid) to authenticated;
revoke all on function rybex_internal.command_lock_key(uuid, text) from public;
revoke all on function rybex_internal.claim_or_replay_command(uuid, text, text, text, uuid, text, uuid, text) from public;
revoke all on function rybex_internal.append_audit_event(uuid, uuid, text, uuid, text, text, text, text, uuid, text, jsonb, jsonb, jsonb) from public;
revoke all on function rybex_internal.append_domain_event(uuid, uuid, text, uuid, integer, text, integer, text, text, uuid, jsonb) from public;
revoke all on function rybex_internal.complete_command(uuid, text, jsonb) from public;

create or replace function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are append-only';
end;
$$;

drop trigger if exists prevent_audit_event_update on audit_events;
create trigger prevent_audit_event_update
before update or delete on audit_events
for each row execute function public.prevent_audit_event_mutation();

create or replace function public.prevent_domain_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'domain_events are immutable';
end;
$$;

drop trigger if exists prevent_domain_event_update on domain_events;
create trigger prevent_domain_event_update
before update or delete on domain_events
for each row execute function public.prevent_domain_event_mutation();
