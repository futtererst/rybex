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

create or replace function public.p1_01a_get_opportunity_v1(p_opportunity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  qualification jsonb;
  assignments jsonb;
  evidence jsonb;
  pursuit_events jsonb;
  bid_submission_events jsonb;
  actor_role text;
  context text;
  owner_summary jsonb;
  decision_owner_summary jsonb;
  pursuit_authority_summary jsonb;
  can_submit boolean;
  evidence_ready boolean;
  bid_evidence_ready boolean;
  pursuit_recommendation text;
  pursuit_state text;
  bid_submission_state text;
  can_mutate_pursuit boolean;
  can_mutate_bid boolean;
begin
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  actor_role := public.p1_01a_current_opportunity_role(opp.id);
  context := public.p1_01a_effective_work_context(opp.id);
  evidence_ready := public.p1_01a_valid_qualification_evidence(opp.id);
  bid_evidence_ready := evidence_ready and opp.pursuit_authorization_status = 'approved';
  pursuit_recommendation := public.p1_01b_1_recommendation(opp.id);
  pursuit_state := case
    when actor_role = 'read_only_auditor' and opp.decision_readiness_status = 'decision_approved' then 'auditor_read_only'
    when opp.decision_readiness_status <> 'decision_approved' then 'not_eligible'
    when context <> 'pursuit_authority' and actor_role in ('operations_leader','admin') then 'unavailable'
    when opp.pursuit_authorization_status = 'approved' then 'authorized_outcome'
    when opp.pursuit_authorization_status = 'hold_pending_evidence' then 'hold_outcome'
    when opp.pursuit_authorization_status = 'declined' then 'declined_outcome'
    when pursuit_recommendation = 'hold' then 'hold_pending_evidence'
    when pursuit_recommendation = 'decline' then 'decline_recommended'
    when pursuit_recommendation = 'approve' then 'decision_ready'
    else 'empty'
  end;
  bid_submission_state := case
    when actor_role = 'read_only_auditor' and opp.pursuit_authorization_status = 'approved' then 'auditor_read_only'
    when opp.pursuit_authorization_status <> 'approved' then 'not_eligible'
    when context <> 'pursuit_authority' and actor_role in ('operations_leader','admin') then 'unavailable'
    else opp.bid_submission_status
  end;
  can_mutate_pursuit := context = 'pursuit_authority'
    and opp.decision_readiness_status = 'decision_approved'
    and opp.pursuit_authorization_status in ('not_started','ready_for_authorization','hold_pending_evidence');
  can_mutate_bid := context = 'pursuit_authority'
    and opp.pursuit_authorization_status = 'approved'
    and opp.bid_submission_status not in ('lost_not_selected','withdrawn_no_submit','selected_intent_to_award');

  select coalesce(to_jsonb(q), '{}'::jsonb)
  into qualification
  from opportunity_qualifications q
  where q.opportunity_id = opp.id;

  select coalesce(jsonb_agg(to_jsonb(oa) order by oa.created_at), '[]'::jsonb)
  into assignments
  from opportunity_assignments oa
  where oa.opportunity_id = opp.id
    and oa.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', eo.id,
    'fileName', eo.original_filename,
    'mimeType', eo.mime_type,
    'sizeBytes', eo.size_bytes,
    'checksumSha256', eo.checksum_sha256,
    'uploadStatus', eo.upload_status,
    'scanStatus', eo.scan_status,
    'verificationStatus', eo.verification_status,
    'relationshipType', el.relationship_type,
    'createdAt', el.created_at
  ) order by el.created_at desc), '[]'::jsonb)
  into evidence
  from opportunity_qualifications q
  join evidence_links el
    on el.workspace_id = q.workspace_id
   and el.entity_type = 'opportunity_qualification'
   and el.entity_id = q.id
  join evidence_objects eo
    on eo.id = el.evidence_object_id
   and eo.workspace_id = q.workspace_id
  where q.opportunity_id = opp.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'eventType', e.event_type,
    'decisionAction', e.decision_action,
    'fromStatus', e.from_status,
    'toStatus', e.to_status,
    'reason', e.reason,
    'actorUserId', e.actor_user_id,
    'createdAt', e.created_at,
    'packageVersion', e.package_version
  ) order by e.created_at desc), '[]'::jsonb)
  into pursuit_events
  from opportunity_pursuit_authorization_events e
  where e.opportunity_id = opp.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'eventType', e.event_type,
    'bidAction', e.bid_action,
    'fromStatus', e.from_status,
    'toStatus', e.to_status,
    'reason', e.reason,
    'actorUserId', e.actor_user_id,
    'createdAt', e.created_at,
    'packageVersion', e.package_version,
    'metadata', e.metadata
  ) order by e.created_at desc), '[]'::jsonb)
  into bid_submission_events
  from opportunity_bid_submission_events e
  where e.opportunity_id = opp.id;

  owner_summary := public.p1_01a_profile_summary(opp.owner_user_id);
  decision_owner_summary := case
    when opp.decision_owner_user_id is null then null
    else public.p1_01a_profile_summary(opp.decision_owner_user_id)
  end;
  pursuit_authority_summary := case
    when coalesce(opp.pursuit_authority_user_id, opp.decision_owner_user_id) is null then null
    else public.p1_01a_profile_summary(coalesce(opp.pursuit_authority_user_id, opp.decision_owner_user_id))
  end;

  can_submit := actor_role in ('business_development_lead','operations_leader','admin')
    and opp.lifecycle_status <> 'decision_required'
    and opp.decision_owner_user_id is not null
    and opp.decision_due_at is not null
    and evidence_ready
    and coalesce((qualification->>'completeness_result') = 'complete', false);

  return jsonb_build_object(
    'success', true,
    'opportunity', to_jsonb(opp),
    'qualification', coalesce(qualification, '{}'::jsonb),
    'assignments', coalesce(assignments, '[]'::jsonb),
    'evidence', coalesce(evidence, '[]'::jsonb),
    'evidenceReady', evidence_ready,
    'pursuitAuthorizationReady', opp.decision_readiness_status = 'decision_approved',
    'pursuitAuthorizationRecommendation', pursuit_recommendation,
    'pursuitAuthorizationState', pursuit_state,
    'pursuitAuthorizationEvents', coalesce(pursuit_events, '[]'::jsonb),
    'bidSubmissionState', bid_submission_state,
    'bidSubmissionEvents', coalesce(bid_submission_events, '[]'::jsonb),
    'bidEvidenceReady', bid_evidence_ready,
    'bidSubmissionReady', opp.bid_submission_status in ('ready_for_submission_approval','submission_approved_ready_to_send','submitted_pending_outcome','revised_submission_recorded'),
    'bidOutcomeReady', opp.bid_submission_status in ('lost_not_selected','withdrawn_no_submit','selected_intent_to_award'),
    'workspaceRole', actor_role,
    'workspaceAccessRole', actor_role,
    'effectiveWorkContext', context,
    'opportunityResponsibility', context,
    'accessMode', case when actor_role = 'read_only_auditor' then 'read_only' else 'editable' end,
    'bdOwner', owner_summary,
    'decisionOwner', decision_owner_summary,
    'pursuitAuthority', pursuit_authority_summary,
    'decisionDueAt', opp.decision_due_at,
    'capabilities', jsonb_build_object(
      'canSubmitForDecision', can_submit,
      'canCompleteEstimatorContribution', context = 'estimator',
      'canApproveDecision', context = 'decision_owner' and opp.decision_readiness_status = 'ready_for_decision',
      'canReturnDecision', context = 'decision_owner' and opp.decision_readiness_status = 'ready_for_decision',
      'canDeclineDecision', context = 'decision_owner' and opp.decision_readiness_status = 'ready_for_decision',
      'canAttachOpportunityEvidence', context in ('business_development_lead','operations_leader','admin'),
      'canEditQualification', context in ('business_development_lead','operations_leader','admin'),
      'canEditEstimatorContribution', context = 'estimator',
      'canApprovePursuit', can_mutate_pursuit and pursuit_recommendation = 'approve',
      'canHoldPursuit', can_mutate_pursuit,
      'canDeclinePursuit', can_mutate_pursuit,
      'canPrepareBidSubmission', can_mutate_bid,
      'canMarkBidPackageReady', can_mutate_bid and opp.bid_submission_status in ('not_started','submission_preparation','submission_blocked','submission_approval_held'),
      'canRequestBidEvidence', can_mutate_bid and opp.bid_submission_status in ('not_started','submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held'),
      'canApproveBidSubmission', can_mutate_bid and opp.bid_submission_status = 'ready_for_submission_approval',
      'canHoldBidSubmission', can_mutate_bid and opp.bid_submission_status = 'ready_for_submission_approval',
      'canRecordBidSubmission', can_mutate_bid and opp.bid_submission_status in ('submission_approved_ready_to_send','revision_bafo_required'),
      'canRecordBidOutcome', can_mutate_bid and opp.bid_submission_status in ('submitted_pending_outcome','revised_submission_recorded')
    ),
    'denialReason', case
      when actor_role = 'read_only_auditor' then 'read_only'
      when context = 'estimator' then 'estimator_scope'
      when context = 'decision_owner' then 'decision_owner_scope'
      when opp.pursuit_authorization_status = 'approved' and context <> 'pursuit_authority' then 'bid_submission_authority_required'
      when opp.decision_readiness_status = 'decision_approved' and context <> 'pursuit_authority' then 'pursuit_authority_required'
      else null
    end
  );
end;
$$;

grant execute on function public.p1_01a_get_opportunity_v1(uuid) to authenticated, service_role;

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

  if normalized_action = 'mark_package_ready' and opp.bid_submission_status not in ('not_started','submission_preparation','submission_blocked','submission_approval_held') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'request_missing_evidence' and opp.bid_submission_status not in ('not_started','submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'approve_submission' and opp.bid_submission_status <> 'ready_for_submission_approval' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'hold_submission_approval' and opp.bid_submission_status <> 'ready_for_submission_approval' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'record_submission' and opp.bid_submission_status <> 'submission_approved_ready_to_send' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'record_submission' and coalesce(trim(p_confirmation), '') = '' then
    return jsonb_build_object('success', false, 'error', 'submission_receipt_required');
  end if;
  if normalized_action in ('record_clarification_request','record_revision_bafo_request') and opp.bid_submission_status <> 'submitted_pending_outcome' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'record_revised_submission' and opp.bid_submission_status <> 'revision_bafo_required' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action = 'record_revised_submission' and coalesce(trim(p_confirmation), '') = '' then
    return jsonb_build_object('success', false, 'error', 'submission_receipt_required');
  end if;
  if normalized_action in ('record_lost_not_selected','record_withdrawn_no_submit','record_selected_handoff') and opp.bid_submission_status not in ('submitted_pending_outcome','revised_submission_recorded') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if normalized_action in ('record_lost_not_selected','record_withdrawn_no_submit') and normalized_reason is null then
    return jsonb_build_object('success', false, 'error', 'outcome_reason_required');
  end if;
  if normalized_action = 'record_selected_handoff' and coalesce(trim(p_confirmation), '') = '' then
    return jsonb_build_object('success', false, 'error', 'selection_evidence_required');
  end if;

  request_hash := md5(coalesce(p_command_id, '') || ':' || normalized_action || ':' || coalesce(p_reason, ''));
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
    null,
    'opportunity',
    opp.id,
    p_command_id,
    'opportunity.bid_submission_action_recorded',
    opp.bid_submission_status,
    next_status,
    actor,
    coalesce(p_correlation_id, p_command_id),
    jsonb_build_object('bidSubmissionStatus', opp.bid_submission_status),
    jsonb_build_object('bidSubmissionStatus', next_status, 'bidAction', normalized_action, 'reasonProvided', normalized_reason is not null),
    '{}'::jsonb
  );

  perform rybex_internal.append_domain_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    next_version,
    'opportunity.bid_submission_action_recorded',
    1,
    p_command_id,
    coalesce(p_correlation_id, p_command_id),
    actor,
    jsonb_build_object('action', normalized_action, 'status', next_status, 'handoffOnly', normalized_action = 'record_selected_handoff')
  );

  result := public.p1_01a_get_opportunity_v1(opp.id);
  return result || jsonb_build_object('success', true, 'bidSubmissionState', next_status);
end;
$$;
