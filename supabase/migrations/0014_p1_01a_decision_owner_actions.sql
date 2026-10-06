-- P1-01A Decision Owner action closure.
-- Bounded approve / return-for-clarification / decline outcomes for the assigned
-- Decision Owner. Does not add P1-01B pursuit outcomes, awards, projects, or
-- generalized approval workflows.

alter table opportunities drop constraint if exists opportunities_p1_01a_decision_readiness_status_check;
alter table opportunities add constraint opportunities_p1_01a_decision_readiness_status_check
  check (decision_readiness_status in ('not_ready','ready_for_decision','decision_approved','returned_for_clarification','decision_declined'));

create or replace function public.record_opportunity_decision_action_v1(
  p_opportunity_id uuid,
  p_decision_action text,
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
  next_version integer;
  normalized_action text := lower(trim(coalesce(p_decision_action, '')));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  request_hash text;
  claim record;
  next_lifecycle text;
  next_readiness text;
  decision_payload jsonb;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;

  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;

  actor_role := public.current_workspace_role(opp.workspace_id);
  if actor_role not in ('operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if opp.decision_owner_user_id is distinct from actor then
    return jsonb_build_object('success', false, 'error', 'decision_owner_required');
  end if;
  if opp.lifecycle_status <> 'decision_required' then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;
  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;
  if normalized_action not in ('approved','returned_for_clarification','declined') then
    return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Choose approve, return, or decline.');
  end if;
  if normalized_action in ('returned_for_clarification','declined') and normalized_reason is null then
    return jsonb_build_object('success', false, 'error', 'reason_required', 'message', 'A reason is required.');
  end if;

  request_hash := md5(p_opportunity_id::text || normalized_action || coalesce(normalized_reason, '') || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.decision_action.record.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  next_version := opp.version + 1;
  next_lifecycle := case
    when normalized_action = 'approved' then 'decision_required'
    when normalized_action = 'returned_for_clarification' then 'qualifying'
    else 'decision_required'
  end;
  next_readiness := case
    when normalized_action = 'approved' then 'decision_approved'
    when normalized_action = 'returned_for_clarification' then 'returned_for_clarification'
    else 'decision_declined'
  end;
  decision_payload := jsonb_build_object(
    'action', normalized_action,
    'reason', normalized_reason,
    'decidedBy', actor,
    'decidedAt', now(),
    'decisionOwnerUserId', opp.decision_owner_user_id,
    'decisionDueAt', opp.decision_due_at
  );

  update opportunities
  set lifecycle_status = next_lifecycle,
      decision_readiness_status = next_readiness,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('p1_01aDecision', decision_payload),
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    p_command_id,
    'opportunity.decision_action_recorded',
    opp.lifecycle_status,
    next_lifecycle,
    actor,
    coalesce(p_correlation_id, p_command_id),
    jsonb_build_object('decisionReadinessStatus', opp.decision_readiness_status),
    jsonb_build_object('decisionReadinessStatus', next_readiness, 'decisionAction', normalized_action, 'reasonProvided', normalized_reason is not null),
    '{}'::jsonb
  );
  perform rybex_internal.append_domain_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    next_version,
    'opportunity.decision_action_recorded',
    1,
    p_command_id,
    coalesce(p_correlation_id, p_command_id),
    actor,
    decision_payload
  );

  result := public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('decisionAction', normalized_action, 'reasonPersisted', normalized_reason is not null);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.record_opportunity_decision_action_v1(uuid, text, text, text, integer, text) to authenticated;
