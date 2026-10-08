-- CFG-RUNTIME-03 actor/profile identity coherence.
-- Forward-only: migrations 0029 and 0030 remain immutable.

do $preflight$
begin
  if exists (
    select 1
    from public.user_profiles up
    where up.user_id is not null
      and up.auth_user_id is not null
      and up.user_id is distinct from up.auth_user_id
  ) then
    raise exception 'cfg_runtime_03_actor_profile_preflight_incoherent_profile';
  end if;

  if exists (
    select 1
    from public.opportunity_bid_evidence_satisfactions s
    left join public.user_profiles up
      on up.id = s.actor_profile_id
     and up.user_id = s.actor_auth_user_id
    where up.id is null
  ) then
    raise exception 'cfg_runtime_03_actor_profile_preflight_incoherent_authority';
  end if;

  if exists (
    select 1
    from public.opportunity_bid_evidence_satisfactions s
    left join public.evidence_links el on el.id = s.evidence_link_id
    left join public.evidence_objects eo on eo.id = s.evidence_object_id
    left join public.opportunities o on o.id = s.opportunity_id
    where el.id is null
       or eo.id is null
       or o.id is null
  ) then
    raise exception 'cfg_runtime_03_authority_preflight_dangling_relationship';
  end if;
end
$preflight$;

alter table public.user_profiles
  add constraint user_profiles_auth_identity_coherence_check
  check (
    user_id is null
    or auth_user_id is null
    or user_id = auth_user_id
  );

alter table public.user_profiles
  add constraint user_profiles_user_id_id_key
  unique (user_id, id);

alter table public.opportunity_bid_evidence_satisfactions
  add constraint opportunity_bid_evidence_satisfactions_actor_identity_fkey
  foreign key (actor_auth_user_id, actor_profile_id)
  references public.user_profiles(user_id, id)
  on update restrict
  on delete restrict;

create index opportunity_bid_evidence_satisfactions_actor_identity_idx
  on public.opportunity_bid_evidence_satisfactions (actor_auth_user_id, actor_profile_id);

-- Promote only the accepted bid-action function correction that was stranded in
-- the noncanonical 0016 parallel file. This preserves existing P1-01B.2 meaning
-- while making a fresh canonical migration chain compatible with the current
-- audit/domain helper contracts.
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
  if opp.bid_submission_status in ('lost_not_selected','withdrawn_no_submit','selected_intent_to_award') then return jsonb_build_object('success', false, 'error', 'terminal_state'); end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;

  select * into existing_event from opportunity_bid_submission_events
  where workspace_id = opp.workspace_id and command_id = p_command_id limit 1;
  if found then return public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('success', true, 'replayed', true); end if;

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
  if normalized_action = 'mark_package_ready' and opp.bid_submission_status not in ('not_started','submission_preparation','submission_blocked','submission_approval_held') then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'request_missing_evidence' and opp.bid_submission_status not in ('not_started','submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held') then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'approve_submission' and opp.bid_submission_status <> 'ready_for_submission_approval' then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'hold_submission_approval' and opp.bid_submission_status <> 'ready_for_submission_approval' then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'record_submission' and opp.bid_submission_status <> 'submission_approved_ready_to_send' then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'record_submission' and coalesce(trim(p_confirmation), '') = '' then return jsonb_build_object('success', false, 'error', 'submission_receipt_required'); end if;
  if normalized_action in ('record_clarification_request','record_revision_bafo_request') and opp.bid_submission_status <> 'submitted_pending_outcome' then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'record_revised_submission' and opp.bid_submission_status <> 'revision_bafo_required' then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action = 'record_revised_submission' and coalesce(trim(p_confirmation), '') = '' then return jsonb_build_object('success', false, 'error', 'submission_receipt_required'); end if;
  if normalized_action in ('record_lost_not_selected','record_withdrawn_no_submit','record_selected_handoff') and opp.bid_submission_status not in ('submitted_pending_outcome','revised_submission_recorded') then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if normalized_action in ('record_lost_not_selected','record_withdrawn_no_submit') and normalized_reason is null then return jsonb_build_object('success', false, 'error', 'outcome_reason_required'); end if;
  if normalized_action = 'record_selected_handoff' and coalesce(trim(p_confirmation), '') = '' then return jsonb_build_object('success', false, 'error', 'selection_evidence_required'); end if;

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
  ) values (
    opp.workspace_id, opp.id, 'opportunity.bid_submission_action_recorded', normalized_action,
    opp.bid_submission_status, next_status, normalized_reason, actor, next_version,
    jsonb_build_object('requestHash', request_hash, 'recipient', nullif(trim(p_recipient), ''), 'channel', nullif(trim(p_channel), ''), 'confirmation', nullif(trim(p_confirmation), ''), 'handoffOnly', normalized_action = 'record_selected_handoff', 'awardValidationStarted', false),
    p_command_id, p_correlation_id
  );

  perform rybex_internal.append_audit_event(
    opp.workspace_id, null, 'opportunity', opp.id, p_command_id,
    'opportunity.bid_submission_action_recorded', opp.bid_submission_status, next_status,
    actor, coalesce(p_correlation_id, p_command_id),
    jsonb_build_object('bidSubmissionStatus', opp.bid_submission_status),
    jsonb_build_object('bidSubmissionStatus', next_status, 'bidAction', normalized_action, 'reasonProvided', normalized_reason is not null),
    '{}'::jsonb
  );
  perform rybex_internal.append_domain_event(
    opp.workspace_id, null, 'opportunity', opp.id, next_version,
    'opportunity.bid_submission_action_recorded', 1, p_command_id,
    coalesce(p_correlation_id, p_command_id), actor,
    jsonb_build_object('action', normalized_action, 'status', next_status, 'handoffOnly', normalized_action = 'record_selected_handoff')
  );
  result := public.p1_01a_get_opportunity_v1(opp.id);
  return result || jsonb_build_object('success', true, 'bidSubmissionState', next_status);
end;
$$;

-- The canonical 0016 implementation calls pgcrypto.digest. Supabase owns that
-- extension in the extensions schema, so fresh databases must expose the same
-- secured resolution path as the accepted local runtime without rewriting 0016.
alter function public.record_opportunity_bid_submission_action_v1(
  uuid, text, text, text, text, text, text, integer, text
) set search_path = public, rybex_internal, extensions, pg_temp;

comment on constraint opportunity_bid_evidence_satisfactions_actor_identity_fkey
  on public.opportunity_bid_evidence_satisfactions is
  'Database authority that the immutable evidence actor auth user and profile identify the same canonical person.';

comment on constraint user_profiles_auth_identity_coherence_check
  on public.user_profiles is
  'When both legacy auth identity columns are populated, they must identify the same auth user.';
