-- P1-01A role/accountability read-model remediation.
-- Adds record-scoped decision accountability and effective work context only.
-- Does not add P1-01B decisions, pursuit outcomes, awards, projects, or work packages.

alter table opportunities
  add column if not exists decision_owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists decision_due_at date;

create index if not exists opportunities_p1_decision_owner_idx
  on opportunities(workspace_id, decision_owner_user_id, lifecycle_status);

create or replace function public.p1_01a_profile_summary(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'userId', up.user_id,
        'profileId', up.id,
        'name', coalesce(nullif(up.display_name, ''), nullif(up.email, ''), 'Assigned user'),
        'email', up.email,
        'initials', upper(left(coalesce(nullif(up.display_name, ''), nullif(up.email, ''), 'AU'), 1))
      )
      from user_profiles up
      where up.user_id = p_user_id
         or up.auth_user_id = p_user_id
      limit 1
    ),
    jsonb_build_object('userId', p_user_id, 'name', 'Assigned user', 'initials', 'AU')
  );
$$;

create or replace function public.p1_01a_is_assigned_estimator(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunity_assignments oa
    join opportunities o on o.id = oa.opportunity_id and o.workspace_id = oa.workspace_id
    join workspace_memberships wm on wm.workspace_id = o.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'
    where oa.opportunity_id = opportunity_uuid
      and oa.user_id = auth.uid()
      and oa.assignment_type = 'estimator'
      and oa.status = 'active'
  );
$$;

create or replace function public.p1_01a_is_decision_owner(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunities o
    join workspace_memberships wm on wm.workspace_id = o.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'
    where o.id = opportunity_uuid
      and o.decision_owner_user_id = auth.uid()
      and wm.role in ('operations_leader','admin')
  );
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

create or replace function public.set_opportunity_decision_accountability_v1(
  p_opportunity_id uuid,
  p_decision_owner_user_id uuid,
  p_decision_due_at date,
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
  owner_role text;
  next_version integer;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;

  actor_role := public.current_workspace_role(opp.workspace_id);
  if actor_role not in ('business_development_lead','operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;
  if p_decision_owner_user_id is null or p_decision_due_at is null then
    return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Decision owner and due date are required.');
  end if;

  select wm.role into owner_role
  from workspace_memberships wm
  where wm.workspace_id = opp.workspace_id
    and wm.user_id = p_decision_owner_user_id
    and wm.status = 'active'
  limit 1;
  if owner_role not in ('operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'invalid_decision_owner');
  end if;

  request_hash := md5(p_opportunity_id::text || p_decision_owner_user_id::text || p_decision_due_at::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.decision_accountability.set.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  next_version := opp.version + 1;
  update opportunities
  set decision_owner_user_id = p_decision_owner_user_id,
      decision_due_at = p_decision_due_at,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.decision_accountability_set', opp.lifecycle_status, opp.lifecycle_status, actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('decisionOwnerUserId', p_decision_owner_user_id, 'decisionDueAt', p_decision_due_at), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.decision_accountability_set', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('decisionOwnerUserId', p_decision_owner_user_id, 'decisionDueAt', p_decision_due_at));

  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

create or replace function public.p1_01a_list_decision_owner_options_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace_uuid uuid := public.p1_01a_current_workspace_id();
  actor_role text;
  options jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  if workspace_uuid is null then return jsonb_build_object('success', false, 'error', 'workspace_required'); end if;
  actor_role := public.current_workspace_role(workspace_uuid);
  if actor_role not in ('business_development_lead','operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', wm.user_id,
    'membershipId', wm.id,
    'role', wm.role,
    'name', coalesce(nullif(up.display_name, ''), nullif(up.email, ''), 'Decision owner'),
    'email', up.email,
    'initials', upper(left(coalesce(nullif(up.display_name, ''), nullif(up.email, ''), 'DO'), 1))
  ) order by up.display_name, up.email), '[]'::jsonb)
  into options
  from workspace_memberships wm
  left join user_profiles up
    on up.user_id = wm.user_id
    or up.auth_user_id = wm.user_id
  where wm.workspace_id = workspace_uuid
    and wm.status = 'active'
    and wm.role in ('operations_leader','admin');

  return jsonb_build_object('success', true, 'items', options);
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
  actor_role text;
  context text;
  owner_summary jsonb;
  decision_owner_summary jsonb;
  can_submit boolean;
  evidence_ready boolean;
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

  owner_summary := public.p1_01a_profile_summary(opp.owner_user_id);
  decision_owner_summary := case
    when opp.decision_owner_user_id is null then null
    else public.p1_01a_profile_summary(opp.decision_owner_user_id)
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
    'workspaceRole', actor_role,
    'workspaceAccessRole', actor_role,
    'effectiveWorkContext', context,
    'opportunityResponsibility', context,
    'accessMode', case when actor_role = 'read_only_auditor' then 'read_only' else 'editable' end,
    'bdOwner', owner_summary,
    'decisionOwner', decision_owner_summary,
    'decisionDueAt', opp.decision_due_at,
    'capabilities', jsonb_build_object(
      'canSubmitForDecision', can_submit,
      'canCompleteEstimatorContribution', context = 'estimator',
      'canApproveDecision', context = 'decision_owner' and opp.decision_readiness_status = 'ready_for_decision',
      'canReturnDecision', context = 'decision_owner' and opp.decision_readiness_status = 'ready_for_decision',
      'canDeclineDecision', context = 'decision_owner' and opp.decision_readiness_status = 'ready_for_decision',
      'canAttachOpportunityEvidence', context in ('business_development_lead','operations_leader','admin'),
      'canEditQualification', context in ('business_development_lead','operations_leader','admin'),
      'canEditEstimatorContribution', context = 'estimator'
    ),
    'denialReason', case
      when actor_role = 'read_only_auditor' then 'read_only'
      when context = 'estimator' then 'estimator_scope'
      when context = 'decision_owner' then 'decision_owner_scope'
      else null
    end
  );
end;
$$;

create or replace function public.submit_opportunity_for_decision_v1(
  p_opportunity_id uuid,
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
  qual opportunity_qualifications%rowtype;
  next_version integer;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) and not public.has_workspace_role(opp.workspace_id, array['business_development_lead','operations_leader','admin']) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if public.p1_01a_is_assigned_estimator(opp.id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;
  if opp.owner_user_id is null or not opp.intake_complete then return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Complete intake and owner before submitting.'); end if;
  if opp.decision_owner_user_id is null or opp.decision_due_at is null then return jsonb_build_object('success', false, 'error', 'decision_accountability_required', 'message', 'Decision owner and due date are required before handoff.'); end if;
  select * into qual from opportunity_qualifications where opportunity_id = opp.id;
  if not found or qual.completeness_result <> 'complete' then return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Complete qualification before submitting.'); end if;
  if not public.p1_01a_valid_qualification_evidence(opp.id) then return jsonb_build_object('success', false, 'error', 'evidence_missing', 'message', 'Attach one clean managed decision support document before submitting.'); end if;

  request_hash := md5(opp.id::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.submit_for_decision.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  next_version := opp.version + 1;
  update opportunities
  set lifecycle_status = 'decision_required',
      status = 'awaiting_go_no_go',
      decision_readiness_status = 'ready_for_decision',
      submitted_for_decision_at = now(),
      submitted_for_decision_by = actor,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.submitted_for_decision', opp.lifecycle_status, 'decision_required', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('qualificationId', qual.id, 'decisionOwnerUserId', opp.decision_owner_user_id, 'decisionDueAt', opp.decision_due_at), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.submitted_for_decision', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('qualificationId', qual.id, 'decisionOwnerUserId', opp.decision_owner_user_id, 'decisionDueAt', opp.decision_due_at));
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.p1_01a_profile_summary(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_is_assigned_estimator(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_is_decision_owner(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_effective_work_context(uuid) to authenticated, service_role;
grant execute on function public.set_opportunity_decision_accountability_v1(uuid, uuid, date, text, integer, text) to authenticated;
grant execute on function public.p1_01a_list_decision_owner_options_v1() to authenticated;
