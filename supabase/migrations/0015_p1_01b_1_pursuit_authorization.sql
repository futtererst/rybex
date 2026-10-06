-- P1-01B.1 - Pursuit Authorization.
-- Bounded to approve / hold / decline pursuit after P1-01A qualification approval.
-- Does not add bid submission, pursuit outcome, award readiness, projects,
-- mobilization, field execution, billing, closeout, or broad Phase 1 behavior.

alter table opportunities
  add column if not exists pursuit_authorization_status text not null default 'not_started',
  add column if not exists pursuit_authority_user_id uuid references auth.users(id) on delete set null,
  add column if not exists pursuit_authorization_due_at date,
  add column if not exists pursuit_authorized_at timestamptz,
  add column if not exists pursuit_authorized_by uuid references auth.users(id) on delete set null,
  add column if not exists pursuit_authorization_reason text;

alter table opportunities drop constraint if exists opportunities_p1_01b_1_pursuit_authorization_status_check;
alter table opportunities add constraint opportunities_p1_01b_1_pursuit_authorization_status_check
  check (pursuit_authorization_status in ('not_started','ready_for_authorization','hold_pending_evidence','approved','declined'));

create index if not exists opportunities_p1_01b_1_authority_idx
  on opportunities(workspace_id, pursuit_authority_user_id, pursuit_authorization_status);

create table if not exists opportunity_pursuit_authorization_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  event_type text not null,
  decision_action text not null,
  from_status text,
  to_status text,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  package_version integer,
  metadata jsonb not null default '{}'::jsonb,
  command_id text,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint opportunity_pursuit_authorization_events_action_check
    check (decision_action in ('approve_pursuit','hold_pending_evidence','decline_pursuit','system_note')),
  constraint opportunity_pursuit_authorization_events_status_check
    check (
      (from_status is null or from_status in ('not_started','ready_for_authorization','hold_pending_evidence','approved','declined'))
      and (to_status is null or to_status in ('not_started','ready_for_authorization','hold_pending_evidence','approved','declined'))
    )
);

create index if not exists opportunity_pursuit_authorization_events_opportunity_idx
  on opportunity_pursuit_authorization_events(workspace_id, opportunity_id, created_at desc);

alter table opportunity_pursuit_authorization_events enable row level security;
revoke insert, update, delete on opportunity_pursuit_authorization_events from authenticated;

drop policy if exists opportunity_pursuit_authorization_events_select on opportunity_pursuit_authorization_events;
create policy opportunity_pursuit_authorization_events_select
  on opportunity_pursuit_authorization_events
  for select
  to authenticated
  using (public.p1_01a_can_access_opportunity(opportunity_id));

drop policy if exists opportunity_pursuit_authorization_events_no_direct_insert on opportunity_pursuit_authorization_events;
create policy opportunity_pursuit_authorization_events_no_direct_insert
  on opportunity_pursuit_authorization_events
  for insert
  to authenticated
  with check (false);

drop policy if exists opportunity_pursuit_authorization_events_no_direct_update on opportunity_pursuit_authorization_events;
create policy opportunity_pursuit_authorization_events_no_direct_update
  on opportunity_pursuit_authorization_events
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists opportunity_pursuit_authorization_events_no_direct_delete on opportunity_pursuit_authorization_events;
create policy opportunity_pursuit_authorization_events_no_direct_delete
  on opportunity_pursuit_authorization_events
  for delete
  to authenticated
  using (false);

create or replace function public.p1_01b_1_is_pursuit_authority(opportunity_uuid uuid)
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
      and coalesce(o.pursuit_authority_user_id, o.decision_owner_user_id) = auth.uid()
  );
$$;

create or replace function public.p1_01b_1_recommendation(opportunity_uuid uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  qual opportunity_qualifications%rowtype;
  evidence_ready boolean;
begin
  select * into opp from opportunities where id = opportunity_uuid;
  if not found or opp.decision_readiness_status <> 'decision_approved' then
    return 'none';
  end if;

  select * into qual from opportunity_qualifications where opportunity_id = opportunity_uuid;
  evidence_ready := public.p1_01a_valid_qualification_evidence(opportunity_uuid);

  if not evidence_ready then
    return 'hold';
  end if;
  if coalesce(qual.recommendation, '') in ('decline','no_bid') then
    return 'decline';
  end if;
  if coalesce(qual.margin_confidence, '') = 'risk' or coalesce(qual.commercial_terms_risk, '') = 'risk' then
    return 'hold';
  end if;
  return 'approve';
end;
$$;

create or replace function public.p1_01a_effective_work_context(opportunity_uuid uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.p1_01a_current_opportunity_role(opportunity_uuid);
begin
  if actor_role = 'read_only_auditor' then
    return 'auditor';
  end if;
  if public.p1_01b_1_is_pursuit_authority(opportunity_uuid) then
    return 'pursuit_authority';
  end if;
  if public.p1_01a_is_decision_owner(opportunity_uuid) then
    return 'decision_owner';
  end if;
  if public.p1_01a_is_assigned_estimator(opportunity_uuid) then
    return 'estimator';
  end if;
  if actor_role = 'business_development_lead' then
    return 'business_development_lead';
  end if;
  return actor_role;
end;
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
  actor_role text;
  context text;
  owner_summary jsonb;
  decision_owner_summary jsonb;
  pursuit_authority_summary jsonb;
  can_submit boolean;
  evidence_ready boolean;
  pursuit_recommendation text;
  pursuit_state text;
  can_mutate_pursuit boolean;
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
  can_mutate_pursuit := context = 'pursuit_authority'
    and opp.decision_readiness_status = 'decision_approved'
    and opp.pursuit_authorization_status in ('not_started','ready_for_authorization','hold_pending_evidence');

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
      'canDeclinePursuit', can_mutate_pursuit
    ),
    'denialReason', case
      when actor_role = 'read_only_auditor' then 'read_only'
      when context = 'estimator' then 'estimator_scope'
      when context = 'decision_owner' then 'decision_owner_scope'
      when opp.decision_readiness_status = 'decision_approved' and context <> 'pursuit_authority' then 'pursuit_authority_required'
      else null
    end
  );
end;
$$;

create or replace function public.record_opportunity_pursuit_authorization_v1(
  p_opportunity_id uuid,
  p_pursuit_action text,
  p_reason text,
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
  actor_role text;
  normalized_action text := lower(trim(coalesce(p_pursuit_action, '')));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  recommendation text;
  next_status text;
  next_version integer;
  request_hash text;
  claim record;
  payload jsonb;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;

  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;

  actor_role := public.current_workspace_role(opp.workspace_id);
  if actor_role not in ('operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if not public.p1_01b_1_is_pursuit_authority(opp.id) then
    return jsonb_build_object('success', false, 'error', 'pursuit_authority_required');
  end if;
  if opp.decision_readiness_status <> 'decision_approved' then
    return jsonb_build_object('success', false, 'error', 'invalid_state', 'message', 'P1-01A qualification must be approved before pursuit authorization.');
  end if;
  if opp.pursuit_authorization_status in ('approved','declined') then
    return jsonb_build_object('success', false, 'error', 'invalid_state', 'message', 'Pursuit authorization already has a terminal outcome.');
  end if;
  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;
  if normalized_action not in ('approve_pursuit','hold_pending_evidence','decline_pursuit') then
    return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Choose approve, hold, or decline pursuit.');
  end if;
  if normalized_action in ('hold_pending_evidence','decline_pursuit') and normalized_reason is null then
    return jsonb_build_object('success', false, 'error', 'reason_required', 'message', 'A reason is required.');
  end if;

  recommendation := public.p1_01b_1_recommendation(opp.id);
  if normalized_action = 'approve_pursuit' and recommendation <> 'approve' then
    return jsonb_build_object('success', false, 'error', 'evidence_or_risk_blocked', 'message', 'Approval is unavailable until blocking evidence and commercial risk are resolved.');
  end if;

  next_status := case
    when normalized_action = 'approve_pursuit' then 'approved'
    when normalized_action = 'hold_pending_evidence' then 'hold_pending_evidence'
    else 'declined'
  end;

  request_hash := md5(p_opportunity_id::text || normalized_action || coalesce(normalized_reason, '') || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.pursuit_authorization.record.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  next_version := opp.version + 1;
  payload := jsonb_build_object(
    'action', normalized_action,
    'reason', normalized_reason,
    'recommendation', recommendation,
    'decidedBy', actor,
    'decidedAt', now(),
    'pursuitAuthorityUserId', coalesce(opp.pursuit_authority_user_id, opp.decision_owner_user_id),
    'decisionOwnerUserId', opp.decision_owner_user_id,
    'noBidSubmitted', true,
    'p1_01b_2Started', false,
    'p1_01b_3Started', false
  );

  update opportunities
  set pursuit_authorization_status = next_status,
      pursuit_authority_user_id = coalesce(pursuit_authority_user_id, decision_owner_user_id),
      pursuit_authorization_due_at = coalesce(pursuit_authorization_due_at, decision_due_at),
      pursuit_authorized_at = now(),
      pursuit_authorized_by = actor,
      pursuit_authorization_reason = normalized_reason,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('p1_01b1PursuitAuthorization', payload),
      version = next_version,
      updated_at = now()
  where id = opp.id;

  insert into opportunity_pursuit_authorization_events (
    workspace_id,
    opportunity_id,
    event_type,
    decision_action,
    from_status,
    to_status,
    reason,
    actor_user_id,
    package_version,
    metadata,
    command_id,
    correlation_id
  ) values (
    opp.workspace_id,
    opp.id,
    'opportunity.pursuit_authorization_recorded',
    normalized_action,
    opp.pursuit_authorization_status,
    next_status,
    normalized_reason,
    actor,
    next_version,
    payload,
    p_command_id,
    coalesce(p_correlation_id, p_command_id)
  );

  perform rybex_internal.append_audit_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    p_command_id,
    'opportunity.pursuit_authorization_recorded',
    opp.pursuit_authorization_status,
    next_status,
    actor,
    coalesce(p_correlation_id, p_command_id),
    jsonb_build_object('pursuitAuthorizationStatus', opp.pursuit_authorization_status),
    jsonb_build_object('pursuitAuthorizationStatus', next_status, 'pursuitAction', normalized_action, 'reasonProvided', normalized_reason is not null),
    '{}'::jsonb
  );
  perform rybex_internal.append_domain_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    next_version,
    'opportunity.pursuit_authorization_recorded',
    1,
    p_command_id,
    coalesce(p_correlation_id, p_command_id),
    actor,
    payload
  );

  result := public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('pursuitAction', normalized_action, 'reasonPersisted', normalized_reason is not null);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.record_opportunity_pursuit_authorization_v1(uuid, text, text, text, integer, text) to authenticated;
