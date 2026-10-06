-- UNAPPLIED synthetic trial foundation. Requires Discover capture, registry,
-- independent duplicate review and explicit triage-owner eligibility.
-- The 24-hour fixture is a working assumption, not production policy.
begin;

create table public.d5o_trial_triage_route_policies (
  id uuid primary key,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  policy_version integer not null check (policy_version>0),
  acceptance_window_hours integer check (acceptance_window_hours between 1 and 168),
  rule_json jsonb not null check (jsonb_typeof(rule_json)='object'),
  rule_digest text not null check (rule_digest ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('trial_active','retired')),
  unique(configuration_version_id,policy_version)
);
create unique index d5o_trial_one_active_triage_route
  on public.d5o_trial_triage_route_policies(configuration_version_id)
  where status='trial_active';
alter table public.d5o_trial_triage_route_policies enable row level security;
revoke all on public.d5o_trial_triage_route_policies from public,anon,authenticated,service_role;

create table public.d5o_trial_triage_submissions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null,
  workspace_id uuid not null,
  configuration_version_id uuid not null,
  submission_revision integer not null check (submission_revision>0),
  from_work_version integer not null check (from_work_version>0),
  submitted_work_version integer not null check (submitted_work_version=from_work_version+1),
  proposed_owner_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submit_permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  submit_permission_digest text not null check (submit_permission_digest ~ '^[0-9a-f]{64}$'),
  route_policy_id uuid not null references public.d5o_trial_triage_route_policies(id) on delete restrict,
  route_policy_digest text not null check (route_policy_digest ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  accept_by timestamptz,
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique(work_id,submission_revision),unique(work_id,submitted_work_version),
  unique(id,work_id,workspace_id),
  foreign key (work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key (submit_permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_triage_submissions enable row level security;
revoke all on public.d5o_trial_triage_submissions from public,anon,authenticated,service_role;

create table public.d5o_trial_triage_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  work_id uuid not null,
  workspace_id uuid not null,
  disposition text not null check (disposition in ('accepted','returned')),
  reason text not null check (length(btrim(reason)) between 20 and 1000),
  from_work_version integer not null check (from_work_version>0),
  after_work_version integer not null check (after_work_version=from_work_version+1),
  responded_by uuid not null references auth.users(id) on delete restrict,
  responder_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  accept_permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  accept_permission_digest text not null check (accept_permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  responded_at timestamptz not null default now(),
  foreign key (submission_id,work_id,workspace_id)
    references public.d5o_trial_triage_submissions(id,work_id,workspace_id) on delete restrict
);
alter table public.d5o_trial_triage_responses enable row level security;
revoke all on public.d5o_trial_triage_responses from public,anon,authenticated,service_role;

-- Snapshot/response content never changes after insertion. The only allowed
-- update fills the two event references in the same command transaction.
create function rybex_internal.d5o_trial_triage_receipt_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'immutable_triage_record'; end if;
  if old.audit_event_id is not null or old.domain_event_id is not null
    or new.audit_event_id is null or new.domain_event_id is null
    or (to_jsonb(new)-'audit_event_id'-'domain_event_id')
      is distinct from (to_jsonb(old)-'audit_event_id'-'domain_event_id') then
    raise exception 'immutable_triage_record'; end if;
  return new;
end $$;
create trigger d5o_trial_triage_submission_immutable before update or delete
  on public.d5o_trial_triage_submissions for each row
  execute function rybex_internal.d5o_trial_triage_receipt_guard();
create trigger d5o_trial_triage_response_immutable before update or delete
  on public.d5o_trial_triage_responses for each row
  execute function rybex_internal.d5o_trial_triage_receipt_guard();

create function rybex_internal.d5o_trial_triage_receipt_complete() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare complete boolean;
begin
  if tg_table_name='d5o_trial_triage_submissions' then
    select s.audit_event_id is not null and s.domain_event_id is not null into complete
      from public.d5o_trial_triage_submissions s where s.id=new.id;
  else
    select r.audit_event_id is not null and r.domain_event_id is not null into complete
      from public.d5o_trial_triage_responses r where r.id=new.id;
  end if;
  if not coalesce(complete,false) then raise exception 'triage_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_triage_submission_receipt
  after insert or update on public.d5o_trial_triage_submissions
  deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_triage_receipt_complete();
create constraint trigger d5o_trial_triage_response_receipt
  after insert or update on public.d5o_trial_triage_responses
  deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_triage_receipt_complete();

-- Generic M1 commands update the root. The private submission/response row
-- must already exist for the exact version and state transition.
create function rybex_internal.d5o_trial_triage_root_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.lifecycle_state='pending_owner_acceptance' and old.lifecycle_state='intake_draft' then
    if new.record_version<>old.record_version+1 or not exists(
      select 1 from public.d5o_trial_triage_submissions s
      where s.work_id=old.id and s.workspace_id=old.workspace_id
        and s.from_work_version=old.record_version
        and s.submitted_work_version=new.record_version
        and not exists(select 1 from public.d5o_trial_triage_responses r where r.submission_id=s.id)) then
      raise exception 'triage_transition_denied'; end if;
  elsif old.lifecycle_state='pending_owner_acceptance' then
    if new.record_version<>old.record_version+1 or not exists(
      select 1 from public.d5o_trial_triage_submissions s
      join public.d5o_trial_triage_responses r on r.submission_id=s.id
      where s.work_id=old.id and s.workspace_id=old.workspace_id
        and s.submitted_work_version=old.record_version
        and r.from_work_version=old.record_version
        and r.after_work_version=new.record_version
        and ((r.disposition='accepted' and new.lifecycle_state='triage_assigned')
          or (r.disposition='returned' and new.lifecycle_state='intake_draft'))) then
      raise exception 'triage_frozen'; end if;
  elsif old.lifecycle_state='triage_assigned'
    or new.lifecycle_state in ('pending_owner_acceptance','triage_assigned') then
    raise exception 'triage_frozen';
  end if;
  return new;
end $$;
create trigger d5o_trial_triage_root_guard before update on public.d5o_work_records
  for each row execute function rybex_internal.d5o_trial_triage_root_guard();

create function rybex_internal.d5o_trial_triage_draft_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_work_records w where w.id=old.work_id
      and w.lifecycle_state in ('pending_owner_acceptance','triage_assigned')) then
    raise exception 'triage_frozen'; end if;
  return new;
end $$;
create trigger d5o_trial_triage_draft_guard before update or delete
  on public.d5o_discover_capture_drafts for each row
  execute function rybex_internal.d5o_trial_triage_draft_guard();

create function rybex_internal.d5o_trial_triage_relation_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_work_records w
      where w.id in (new.work_id,new.related_work_id)
        and w.lifecycle_state in ('pending_owner_acceptance','triage_assigned')) then
    raise exception 'triage_frozen'; end if;
  return new;
end $$;
create trigger d5o_trial_triage_relation_guard before insert or update
  on public.d5o_work_relations for each row
  execute function rybex_internal.d5o_trial_triage_relation_guard();
commit;
