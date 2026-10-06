-- UNAPPLIED SCHEMA CANDIDATE. Do not place in supabase/migrations or execute alone.
-- Alternative to, not cumulative with, 20260930100729_discover_draft_candidate.sql.
-- Retire/merge the older candidate before any future migration is assembled.
-- No RPC, policy grant, form route, or live writer is authorized by this file.
-- Requires the trial verification table from the separate authority candidate.

begin;

create table public.d5o_discover_capture_drafts (
  work_id uuid primary key,
  workspace_id uuid not null,
  configuration_version_id uuid not null,
  customer_context text,
  site_context text,
  source_kind text,
  source_reference text,
  need_summary text,
  work_type text,
  contact_context text,
  value_band text not null default 'unknown',
  currency text,
  response_due_on date,
  procurement text,
  triage_owner_profile_id uuid references public.user_profiles(id) on delete restrict,
  next_action text,
  duplicate_disposition text not null default 'unreviewed',
  duplicate_reason text,
  capture_permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  capture_permission_digest text not null check (capture_permission_digest ~ '^[0-9a-f]{64}$'),
  employee_verification_id uuid not null references public.d5o_trial_employee_verifications(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  foreign key (work_id, workspace_id, configuration_version_id)
    references public.d5o_work_records(id, workspace_id, configuration_version_id) on delete restrict,
  foreign key (capture_permission_id, configuration_version_id)
    references public.config_permission_definitions(id, configuration_version_id) on delete restrict,
  check (customer_context is null or length(customer_context) between 1 and 240),
  check (site_context is null or length(site_context) between 1 and 240),
  check (source_kind is null or source_kind in
    ('customer_request','referral','tender_invitation','crm_reference','lifecycle_lead')),
  check (source_reference is null or length(source_reference) between 1 and 500),
  check (need_summary is null or length(need_summary) between 1 and 4000),
  check (work_type is null or work_type in
    ('project','service','assessment','lifecycle_follow_up')),
  check (contact_context is null or length(contact_context) between 1 and 500),
  check (value_band in ('unknown','below_100k','100k_250k','250k_500k','above_500k')),
  check (currency is null or currency in ('USD','GBP','EUR')),
  check (value_band = 'unknown' or currency is not null),
  check (procurement is null or procurement in
    ('direct','competitive_tender','existing_agreement','paid_discovery')),
  check (next_action is null or length(next_action) between 1 and 500),
  check (duplicate_disposition in ('unreviewed','distinct')),
  check (duplicate_reason is null or length(duplicate_reason) between 1 and 1000)
);

create index d5o_discover_capture_drafts_workspace_due_idx
  on public.d5o_discover_capture_drafts(workspace_id, response_due_on, work_id);
alter table public.d5o_discover_capture_drafts enable row level security;
revoke all on public.d5o_discover_capture_drafts from public, anon, authenticated;

-- A later writer must verify tenant/workspace/organization binding, effective
-- configured action permission, scoped owner, state/version, duplicate candidates,
-- provenance and idempotency in the same transaction as root, draft and audit.
-- A table constraint alone does not prove that the named owner is active or in scope.
commit;
