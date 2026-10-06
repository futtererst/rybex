-- P1-01B.2 - Bid Submission / Pursuit Outcome.
-- Bounded to package readiness, submission approval, actual submission,
-- clarification/revision/BAFO, and pursuit outcome recording.
-- Does not implement award validation, contract validation, projects,
-- readiness, mobilization, field execution, billing, closeout, demo readiness,
-- production readiness, or broad Phase 1 behavior.

alter table opportunities
  add column if not exists bid_submission_status text not null default 'not_started',
  add column if not exists bid_package_version text,
  add column if not exists approved_estimate_version text,
  add column if not exists bid_submission_price numeric,
  add column if not exists bid_pricing_validity date,
  add column if not exists bid_schedule_commitment text,
  add column if not exists bid_recipient text,
  add column if not exists bid_submission_channel text,
  add column if not exists bid_submitted_at timestamptz,
  add column if not exists bid_submission_confirmation text,
  add column if not exists bid_outcome_reason text,
  add column if not exists bid_selected_notice text;

alter table opportunities drop constraint if exists opportunities_p1_01b_2_bid_submission_status_check;
alter table opportunities add constraint opportunities_p1_01b_2_bid_submission_status_check
  check (bid_submission_status in (
    'not_started',
    'submission_preparation',
    'submission_blocked',
    'ready_for_submission_approval',
    'submission_approval_held',
    'submission_approved_ready_to_send',
    'submitted_pending_outcome',
    'clarification_requested',
    'revision_bafo_required',
    'revised_submission_recorded',
    'lost_not_selected',
    'withdrawn_no_submit',
    'selected_intent_to_award'
  ));

create index if not exists opportunities_p1_01b_2_status_idx
  on opportunities(workspace_id, bid_submission_status, pursuit_authorization_status);

create table if not exists opportunity_bid_submission_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  event_type text not null,
  bid_action text not null,
  from_status text,
  to_status text,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  package_version integer,
  metadata jsonb not null default '{}'::jsonb,
  command_id text,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint opportunity_bid_submission_events_action_check
    check (bid_action in (
      'mark_package_ready',
      'request_missing_evidence',
      'approve_submission',
      'hold_submission_approval',
      'record_submission',
      'record_clarification_request',
      'record_revision_bafo_request',
      'record_revised_submission',
      'record_lost_not_selected',
      'record_withdrawn_no_submit',
      'record_selected_handoff',
      'system_note'
    ))
);

create unique index if not exists opportunity_bid_submission_events_command_idx
  on opportunity_bid_submission_events(workspace_id, command_id)
  where command_id is not null;

create index if not exists opportunity_bid_submission_events_opportunity_idx
  on opportunity_bid_submission_events(workspace_id, opportunity_id, created_at desc);

alter table opportunity_bid_submission_events enable row level security;
revoke insert, update, delete on opportunity_bid_submission_events from authenticated;

drop policy if exists opportunity_bid_submission_events_select on opportunity_bid_submission_events;
create policy opportunity_bid_submission_events_select
  on opportunity_bid_submission_events
  for select
  to authenticated
  using (public.p1_01a_can_access_opportunity(opportunity_id));

drop policy if exists opportunity_bid_submission_events_no_direct_insert on opportunity_bid_submission_events;
create policy opportunity_bid_submission_events_no_direct_insert
  on opportunity_bid_submission_events
  for insert
  to authenticated
  with check (false);

drop policy if exists opportunity_bid_submission_events_no_direct_update on opportunity_bid_submission_events;
create policy opportunity_bid_submission_events_no_direct_update
  on opportunity_bid_submission_events
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists opportunity_bid_submission_events_no_direct_delete on opportunity_bid_submission_events;
create policy opportunity_bid_submission_events_no_direct_delete
  on opportunity_bid_submission_events
  for delete
  to authenticated
  using (false);

create or replace function public.p1_01b_2_is_submission_authority(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunities o
    join workspace_memberships wm
      on wm.workspace_id = o.workspace_id
     and wm.user_id = auth.uid()
     and wm.status = 'active'
    where o.id = opportunity_uuid
      and wm.role in ('operations_leader','admin')
      and o.pursuit_authorization_status = 'approved'
      and coalesce(o.pursuit_authority_user_id, o.decision_owner_user_id, o.owner_user_id) = auth.uid()
  );
$$;

create or replace function public.record_opportunity_bid_submission_action_v1(
  p_opportunity_id uuid,
  p_bid_action text,
  p_reason text,
  p_recipient text,
  p_channel text,
  p_confirmation text,
  p_command_id text,
  p_expected_version integer,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, rybex_internal, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opp opportunities%rowtype;
  normalized_action text := lower(trim(coalesce(p_bid_action, '')));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  next_status text;
  next_version integer;
  request_hash text;
  existing_event opportunity_bid_submission_events%rowtype;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;

  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  if not public.p1_01b_2_is_submission_authority(opp.id) then return jsonb_build_object('success', false, 'error', 'bid_submission_authority_required'); end if;
  if opp.pursuit_authorization_status <> 'approved' then return jsonb_build_object('success', false, 'error', 'invalid_state', 'message', 'Pursuit authorization must be approved before bid submission.'); end if;
  if opp.bid_submission_status in ('lost_not_selected','withdrawn_no_submit','selected_intent_to_award') then
    return jsonb_build_object('success', false, 'error', 'terminal_state');
  end if;
  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;

  select * into existing_event
  from opportunity_bid_submission_events
  where workspace_id = opp.workspace_id
    and command_id = p_command_id
  limit 1;
  if found then
    return public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('success', true, 'replayed', true);
  end if;

  next_status := case normalized_action
    when 'mark_package_ready' then 'ready_for_submission_approval'
    when 'request_missing_evidence' then 'submission_blocked'
    when 'approve_submission' then 'submission_approved_ready_to_send'
    when 'hold_submission_approval' then 'submission_approval_held'
    when 'record_submission' then 'submitted_pending_outcome'
    when 'record_clarification_request' then 'clarification_requested'
    when 'record_revision_bafo_request' then 'revision_bafo_required'
    when 'record_revised_submission' then 'revised_submission_recorded'
    when 'record_lost_not_selected' then 'lost_not_selected'
    when 'record_withdrawn_no_submit' then 'withdrawn_no_submit'
    when 'record_selected_handoff' then 'selected_intent_to_award'
    else null
  end;

  if next_status is null then return jsonb_build_object('success', false, 'error', 'invalid_action'); end if;

  if normalized_action = 'approve_submission' and opp.bid_submission_status <> 'ready_for_submission_approval' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'record_submission' and opp.bid_submission_status <> 'submission_approved_ready_to_send' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action in ('record_lost_not_selected','record_withdrawn_no_submit','record_selected_handoff') and opp.bid_submission_status not in ('submitted_pending_outcome','revised_submission_recorded') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'record_selected_handoff' and coalesce(trim(p_confirmation), '') = '' then
    return jsonb_build_object('success', false, 'error', 'selection_evidence_required');
  end if;

  request_hash := encode(digest(coalesce(p_command_id, '') || ':' || normalized_action || ':' || coalesce(p_reason, ''), 'sha256'), 'hex');
  next_version := opp.version + 1;

  update opportunities
  set bid_submission_status = next_status,
      bid_package_version = coalesce(nullif(bid_package_version, ''), 'PROP-' || next_version::text),
      approved_estimate_version = coalesce(nullif(approved_estimate_version, ''), 'EST-' || next_version::text),
      bid_submission_price = coalesce(bid_submission_price, estimated_value),
      bid_pricing_validity = coalesce(bid_pricing_validity, bid_due_date + interval '30 days'),
      bid_schedule_commitment = coalesce(nullif(bid_schedule_commitment, ''), '18 weeks'),
      bid_recipient = coalesce(nullif(trim(p_recipient), ''), bid_recipient),
      bid_submission_channel = coalesce(nullif(trim(p_channel), ''), bid_submission_channel),
      bid_submitted_at = case when normalized_action in ('record_submission','record_revised_submission') then now() else bid_submitted_at end,
      bid_submission_confirmation = coalesce(nullif(trim(p_confirmation), ''), bid_submission_confirmation),
      bid_outcome_reason = case when normalized_action in ('record_lost_not_selected','record_withdrawn_no_submit') then normalized_reason else bid_outcome_reason end,
      bid_selected_notice = case when normalized_action = 'record_selected_handoff' then coalesce(nullif(trim(p_confirmation), ''), normalized_reason) else bid_selected_notice end,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  insert into opportunity_bid_submission_events (
    workspace_id, opportunity_id, event_type, bid_action, from_status, to_status,
    reason, actor_user_id, package_version, metadata, command_id, correlation_id
  )
  values (
    opp.workspace_id, opp.id, 'opportunity.bid_submission_action_recorded', normalized_action,
    opp.bid_submission_status, next_status, normalized_reason, actor, next_version,
    jsonb_build_object(
      'requestHash', request_hash,
      'recipient', nullif(trim(p_recipient), ''),
      'channel', nullif(trim(p_channel), ''),
      'confirmation', nullif(trim(p_confirmation), ''),
      'handoffOnly', normalized_action = 'record_selected_handoff',
      'awardValidationStarted', false
    ),
    p_command_id, p_correlation_id
  );

  perform rybex_internal.append_audit_event(
    opp.workspace_id,
    'opportunity_bid_submission',
    opp.id,
    'opportunity.bid_submission_action_recorded',
    actor,
    jsonb_build_object('action', normalized_action, 'fromStatus', opp.bid_submission_status, 'toStatus', next_status, 'packageVersion', next_version),
    p_correlation_id
  );

  perform rybex_internal.append_domain_event(
    opp.workspace_id,
    'opportunity.bid_submission_action_recorded',
    'opportunity',
    opp.id,
    jsonb_build_object('action', normalized_action, 'status', next_status, 'handoffOnly', normalized_action = 'record_selected_handoff'),
    p_correlation_id
  );

  result := public.p1_01a_get_opportunity_v1(opp.id);
  return result || jsonb_build_object('success', true, 'bidSubmissionState', next_status);
end;
$$;
