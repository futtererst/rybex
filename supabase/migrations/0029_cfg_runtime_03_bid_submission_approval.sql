-- CFG-RUNTIME-03 - Configuration-driven Bid Submission Approval Readiness.
-- Bounded to approving a prepared bid package as ready to send or holding it
-- from submission. This does not record actual bid submission, receipt,
-- clarification, BAFO, pursuit outcome, award validation, project readiness,
-- mobilization, demo readiness, or production readiness.

alter table opportunities
  add column if not exists submission_approver_user_id uuid,
  add column if not exists bid_submission_approval_configuration_version_id uuid,
  add column if not exists bid_submission_approval_gate_key text,
  add column if not exists bid_submission_approval_outcome_key text;

alter table opportunities
  drop constraint if exists opportunities_submission_approver_user_fkey;

alter table opportunities
  add constraint opportunities_submission_approver_user_fkey
  foreign key (submission_approver_user_id)
  references user_profiles(id) on delete set null;

alter table opportunities
  drop constraint if exists opportunities_bid_submission_approval_configuration_version_fkey;

alter table opportunities
  add constraint opportunities_bid_submission_approval_configuration_version_fkey
  foreign key (bid_submission_approval_configuration_version_id)
  references config_configuration_versions(id) on delete restrict;

alter table opportunities
  drop constraint if exists opportunities_bid_submission_approval_configuration_triplet_check;

alter table opportunities
  add constraint opportunities_bid_submission_approval_configuration_triplet_check
  check (
    (
      bid_submission_approval_configuration_version_id is null
      and bid_submission_approval_gate_key is null
      and bid_submission_approval_outcome_key is null
    )
    or
    (
      bid_submission_approval_configuration_version_id is not null
      and bid_submission_approval_gate_key is not null
      and bid_submission_approval_outcome_key is not null
    )
  );

alter table opportunity_bid_submission_events
  add column if not exists configuration_version_id uuid,
  add column if not exists configuration_gate_key text,
  add column if not exists configuration_outcome_key text,
  add column if not exists actor_profile_id uuid;

alter table opportunity_bid_submission_events
  drop constraint if exists opportunity_bid_submission_events_configuration_version_fkey;

alter table opportunity_bid_submission_events
  add constraint opportunity_bid_submission_events_configuration_version_fkey
  foreign key (configuration_version_id)
  references config_configuration_versions(id) on delete restrict;

alter table opportunity_bid_submission_events
  drop constraint if exists opportunity_bid_submission_events_actor_profile_fkey;

alter table opportunity_bid_submission_events
  add constraint opportunity_bid_submission_events_actor_profile_fkey
  foreign key (actor_profile_id)
  references user_profiles(id) on delete set null;

alter table opportunity_bid_submission_events
  drop constraint if exists opportunity_bid_submission_events_cfg_runtime_03_provenance_check;

alter table opportunity_bid_submission_events
  add constraint opportunity_bid_submission_events_cfg_runtime_03_provenance_check
  check (
    bid_action not in ('approve_submission','hold_submission_approval')
    or configuration_version_id is null
    or (
      configuration_gate_key is not null
      and configuration_outcome_key is not null
      and actor_profile_id is not null
    )
  );

create index if not exists opportunities_submission_approver_idx
  on opportunities(workspace_id, submission_approver_user_id)
  where submission_approver_user_id is not null;

create index if not exists opportunities_bid_submission_approval_configuration_idx
  on opportunities(workspace_id, bid_submission_approval_configuration_version_id)
  where bid_submission_approval_configuration_version_id is not null;

create index if not exists opportunity_bid_submission_events_configuration_idx
  on opportunity_bid_submission_events(workspace_id, configuration_version_id, created_at desc)
  where configuration_version_id is not null;

create index if not exists opportunity_bid_submission_events_cfg_decision_idx
  on opportunity_bid_submission_events(workspace_id, opportunity_id, configuration_gate_key, configuration_outcome_key, created_at desc)
  where configuration_gate_key is not null;

create or replace function public.p1_01b2_bid_submission_approval_configuration_v1(
  p_opportunity_id uuid,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  tenant_record config_tenants%rowtype;
  tenant_count integer;
  configuration_version config_configuration_versions%rowtype;
  tenant_configuration config_tenant_configurations%rowtype;
  activation config_tenant_template_activations%rowtype;
  template_pack config_template_packs%rowtype;
  template_pack_version config_template_pack_versions%rowtype;
  approval_gate config_gate_definitions%rowtype;
  evidence_requirements jsonb;
  permitted_outcomes jsonb;
  submission_approver_role jsonb;
begin
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('available', false, 'reason', 'not_found');
  end if;

  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('available', false, 'reason', 'forbidden');
  end if;

  select count(*) into tenant_count
  from config_tenants ct
  where ct.workspace_id = opp.workspace_id
    and ct.status <> 'archived';

  if tenant_count = 0 then
    return jsonb_build_object('available', false, 'reason', 'no_tenant_mapping');
  end if;
  if tenant_count > 1 then
    return jsonb_build_object('available', false, 'reason', 'ambiguous_tenant_mapping');
  end if;

  select * into tenant_record
  from config_tenants ct
  where ct.workspace_id = opp.workspace_id
    and ct.status <> 'archived'
  order by ct.created_at asc, ct.id asc
  limit 1;

  select * into configuration_version
  from config_configuration_versions cv
  where cv.id = public.config_effective_configuration_version_id(tenant_record.id, p_as_of);

  if not found then
    return jsonb_build_object('available', false, 'reason', 'no_published_effective_configuration');
  end if;

  select * into tenant_configuration
  from config_tenant_configurations
  where id = configuration_version.tenant_configuration_id
    and tenant_id = tenant_record.id;

  if not found then
    return jsonb_build_object('available', false, 'reason', 'invalid_configuration_lineage');
  end if;

  select * into activation
  from config_tenant_template_activations
  where id = tenant_configuration.activation_id
    and tenant_id = tenant_record.id
    and status = 'active';

  if not found then
    return jsonb_build_object('available', false, 'reason', 'no_active_template_activation');
  end if;

  select * into template_pack_version
  from config_template_pack_versions
  where id = activation.template_pack_version_id
    and status = 'released';

  if not found then
    return jsonb_build_object('available', false, 'reason', 'template_pack_version_unavailable');
  end if;

  select * into template_pack
  from config_template_packs
  where id = template_pack_version.template_pack_id
    and status = 'released';

  if not found then
    return jsonb_build_object('available', false, 'reason', 'template_pack_unavailable');
  end if;

  select * into approval_gate
  from config_gate_definitions
  where configuration_version_id = configuration_version.id
    and gate_key = 'bid-submission-approval'
    and status = 'active';

  if not found then
    return jsonb_build_object('available', false, 'reason', 'bid_submission_approval_gate_missing');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'requirementId', ger.id,
    'evidenceTypeId', etd.id,
    'evidenceTypeKey', etd.evidence_type_key,
    'relationshipType', etd.evidence_type_key,
    'label', etd.label,
    'required', ger.requirement_level in ('required','blocking'),
    'blocking', coalesce((ger.blocking_rule_json->>'blocking')::boolean, ger.requirement_level = 'blocking')
  ) order by etd.evidence_type_key), '[]'::jsonb)
  into evidence_requirements
  from config_gate_evidence_requirements ger
  join config_evidence_type_definitions etd
    on etd.id = ger.evidence_type_id
   and etd.configuration_version_id = ger.configuration_version_id
  where ger.configuration_version_id = configuration_version.id
    and ger.gate_id = approval_gate.id
    and ger.status = 'active'
    and etd.status = 'active';

  if jsonb_array_length(evidence_requirements) = 0 then
    return jsonb_build_object('available', false, 'reason', 'bid_submission_approval_evidence_missing');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outcomeKey', gdo.outcome_key,
    'label', gdo.label,
    'outcomeType', gdo.outcome_type,
    'requiresJustification', coalesce((gdo.consequence_json->>'requiresJustification')::boolean, false),
    'requiresMitigation', coalesce((gdo.consequence_json->>'requiresMitigation')::boolean, false),
    'mapsToAction', gdo.consequence_json->>'mapsToAction'
  ) order by gdo.outcome_key), '[]'::jsonb)
  into permitted_outcomes
  from config_gate_decision_outcomes gdo
  where gdo.configuration_version_id = configuration_version.id
    and gdo.gate_id = approval_gate.id
    and gdo.status = 'active';

  if not exists (
    select 1
    from jsonb_array_elements(permitted_outcomes) outcome
    where outcome->>'outcomeKey' = 'approve-for-submission'
      and outcome->>'mapsToAction' = 'approve_submission'
  ) or not exists (
    select 1
    from jsonb_array_elements(permitted_outcomes) outcome
    where outcome->>'outcomeKey' = 'hold-submission-approval'
      and outcome->>'mapsToAction' = 'hold_submission_approval'
      and (outcome->>'requiresJustification')::boolean = true
  ) then
    return jsonb_build_object('available', false, 'reason', 'bid_submission_approval_outcomes_invalid');
  end if;

  select jsonb_build_object(
    'decisionRightKey', dr.decision_right_key,
    'roleKey', rd.role_key,
    'label', rd.label,
    'recordScope', dr.record_scope_json
  )
  into submission_approver_role
  from config_decision_right_definitions dr
  join config_role_definitions rd
    on rd.id = dr.role_definition_id
   and rd.configuration_version_id = dr.configuration_version_id
  where dr.configuration_version_id = configuration_version.id
    and dr.gate_definition_id = approval_gate.id
    and dr.decision_right_key = 'bid-submission-approval-approver'
    and dr.status = 'active'
    and rd.status = 'active'
  limit 1;

  if submission_approver_role is null then
    return jsonb_build_object('available', false, 'reason', 'submission_approver_role_missing');
  end if;

  return jsonb_build_object(
    'available', true,
    'configurationVersionId', configuration_version.id,
    'configurationVersionNumber', configuration_version.version,
    'templatePackKey', template_pack.pack_key,
    'templatePackVersion', template_pack_version.semver,
    'tenantConfigurationId', tenant_configuration.id,
    'gateKey', approval_gate.gate_key,
    'gateLabel', approval_gate.label,
    'evidenceRequirements', evidence_requirements,
    'permittedOutcomes', permitted_outcomes,
    'submissionApproverRole', submission_approver_role,
    'effectiveFrom', configuration_version.effective_from,
    'effectiveTo', configuration_version.effective_to,
    'provenanceLabel', template_pack.name || ' ' || template_pack_version.semver
  );
end;
$$;

create or replace function public.p1_01b2_bid_submission_approval_readiness_v1(
  p_opportunity_id uuid,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  config jsonb;
  requirements jsonb := '[]'::jsonb;
  missing jsonb := '[]'::jsonb;
  req jsonb;
  relationship_key text;
  submission_approver user_profiles%rowtype;
  approver_membership workspace_memberships%rowtype;
  approver_satisfied boolean := false;
  deficiencies text[] := array[]::text[];
begin
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('available', false, 'ready', false, 'reason', 'not_found', 'deficiencies', jsonb_build_array('not_found'));
  end if;

  config := public.p1_01b2_bid_submission_approval_configuration_v1(opp.id, p_as_of);
  if coalesce((config->>'available')::boolean, false) is not true then
    return jsonb_build_object(
      'available', false,
      'ready', false,
      'reason', coalesce(config->>'reason', 'configuration_unavailable'),
      'deficiencies', jsonb_build_array('configuration_unavailable'),
      'configuration', config
    );
  end if;

  if opp.pursuit_authorization_status <> 'approved' then
    deficiencies := array_append(deficiencies, 'pursuit_authorization_required');
  end if;

  if opp.bid_submission_status <> 'ready_for_submission_approval' then
    deficiencies := array_append(deficiencies, 'bid_package_not_ready_for_approval');
  end if;

  if opp.bid_package_version is null or opp.approved_estimate_version is null or opp.bid_submission_price is null or opp.bid_pricing_validity is null or opp.bid_schedule_commitment is null then
    deficiencies := array_append(deficiencies, 'commercial_basis_incomplete');
  end if;

  for req in select * from jsonb_array_elements(config->'evidenceRequirements') loop
    relationship_key := req->>'relationshipType';
    req := req || jsonb_build_object(
      'satisfied',
      exists (
        select 1
        from evidence_links el
        join evidence_objects eo
          on eo.id = el.evidence_object_id
         and eo.workspace_id = el.workspace_id
        where el.workspace_id = opp.workspace_id
          and el.entity_type = 'opportunity'
          and el.entity_id = opp.id
          and el.relationship_type = relationship_key
          and eo.upload_status = 'uploaded'
          and eo.verification_status in ('accepted','pending')
      )
    );
    requirements := requirements || jsonb_build_array(req);
    if (req->>'required')::boolean and (req->>'satisfied')::boolean is not true then
      missing := missing || jsonb_build_array(req);
    end if;
  end loop;

  if jsonb_array_length(missing) > 0 then
    deficiencies := array_append(deficiencies, 'missing_bid_evidence');
  end if;

  if opp.submission_approver_user_id is not null then
    select * into submission_approver from user_profiles where id = opp.submission_approver_user_id and status = 'active';
    if found then
      select * into approver_membership
      from workspace_memberships wm
      where wm.workspace_id = opp.workspace_id
        and wm.user_profile_id = submission_approver.id
        and wm.status = 'active'
        and wm.role in ('operations_leader','admin')
      limit 1;
      approver_satisfied := found;
    end if;
  end if;

  if approver_satisfied is not true then
    deficiencies := array_append(deficiencies, 'invalid_submission_approver');
  end if;

  return jsonb_build_object(
    'available', true,
    'ready', cardinality(deficiencies) = 0,
    'reason', case when cardinality(deficiencies) = 0 then null else 'requirements_unmet' end,
    'deficiencies', to_jsonb(deficiencies),
    'configuration', config,
    'configurationVersionId', config->>'configurationVersionId',
    'gateKey', config->>'gateKey',
    'evidenceRequirements', requirements,
    'missingEvidence', missing,
    'submissionApproverAccountability', jsonb_build_object(
      'roleKey', config->'submissionApproverRole'->>'roleKey',
      'label', config->'submissionApproverRole'->>'label',
      'satisfied', approver_satisfied,
      'profileId', case when approver_satisfied then submission_approver.id::text else null end,
      'name', case when approver_satisfied then coalesce(submission_approver.display_name, submission_approver.email, 'Submission Approver') else null end
    ),
    'permittedOutcomes', config->'permittedOutcomes',
    'provenanceLabel', config->>'provenanceLabel'
  );
end;
$$;

create or replace function public.assign_opportunity_submission_approver_v1(
  p_opportunity_id uuid,
  p_submission_approver_profile_id uuid,
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
  actor_profile uuid;
  opp opportunities%rowtype;
  target_profile user_profiles%rowtype;
  target_membership workspace_memberships%rowtype;
  readiness jsonb;
  next_version integer;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select id into actor_profile from user_profiles where user_id = actor and status = 'active' limit 1;
  if actor_profile is null then return jsonb_build_object('success', false, 'error', 'actor_profile_required'); end if;

  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  if not exists (
    select 1 from workspace_memberships wm
    where wm.workspace_id = opp.workspace_id
      and wm.user_id = actor
      and wm.status = 'active'
      and wm.role in ('operations_leader','admin')
  ) then
    return jsonb_build_object('success', false, 'error', 'submission_approver_assignment_authority_required');
  end if;
  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;
  if opp.bid_submission_status not in ('submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;

  readiness := public.p1_01b2_bid_submission_approval_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'error', 'configuration_unavailable');
  end if;

  select * into target_profile from user_profiles where id = p_submission_approver_profile_id and status = 'active';
  if not found then return jsonb_build_object('success', false, 'error', 'invalid_submission_approver'); end if;

  select * into target_membership
  from workspace_memberships wm
  where wm.workspace_id = opp.workspace_id
    and wm.user_profile_id = target_profile.id
    and wm.status = 'active'
    and wm.role in ('operations_leader','admin')
  limit 1;
  if not found then return jsonb_build_object('success', false, 'error', 'invalid_submission_approver'); end if;

  if opp.submission_approver_user_id is not distinct from target_profile.id then
    return public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('success', true, 'idempotent', true);
  end if;

  next_version := opp.version + 1;
  update opportunities
  set submission_approver_user_id = target_profile.id,
      version = next_version,
      updated_by = actor_profile,
      updated_at = now()
  where id = opp.id
    and version = p_expected_version
    and bid_submission_status in ('submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held');

  if not found then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict');
  end if;

  perform rybex_internal.append_audit_event(
    opp.workspace_id, null, 'opportunity', opp.id, p_command_id,
    'opportunity.submission_approver_assigned', opp.submission_approver_user_id::text, target_profile.id::text,
    actor, coalesce(p_correlation_id, p_command_id),
    jsonb_build_object('submissionApproverProfileId', opp.submission_approver_user_id),
    jsonb_build_object('submissionApproverProfileId', target_profile.id),
    jsonb_build_object('configurationVersionId', readiness->>'configurationVersionId', 'gateKey', readiness->>'gateKey')
  );

  return public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('success', true);
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

  select jsonb_agg(jsonb_build_object(
    'userId', wm.user_id,
    'profileId', up.id,
    'membershipId', wm.id,
    'role', wm.role,
    'name', coalesce(nullif(up.display_name, ''), nullif(up.email, ''), 'Decision owner'),
    'email', up.email,
    'initials', upper(left(coalesce(nullif(up.display_name, ''), nullif(up.email, ''), 'DO'), 1))
  ) order by up.display_name, up.email)
  into options
  from workspace_memberships wm
  left join user_profiles up
    on up.user_id = wm.user_id
    or up.auth_user_id = wm.user_id
  where wm.workspace_id = workspace_uuid
    and wm.status = 'active'
    and wm.role in ('operations_leader','admin')
    and up.id is not null;

  return jsonb_build_object('success', true, 'items', coalesce(options, '[]'::jsonb));
end;
$$;

create or replace function public.record_configured_bid_submission_approval_v1(
  p_opportunity_id uuid,
  p_outcome_key text,
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
  actor_profile uuid;
  opp opportunities%rowtype;
  normalized_outcome text := coalesce(p_outcome_key, '');
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  readiness jsonb;
  outcome jsonb;
  config_version uuid;
  gate_key text;
  next_status text;
  next_version integer;
  existing_event opportunity_bid_submission_events%rowtype;
  request_hash text;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  if normalized_outcome <> p_outcome_key then return jsonb_build_object('success', false, 'error', 'invalid_outcome'); end if;
  select id into actor_profile from user_profiles where user_id = actor and status = 'active' limit 1;
  if actor_profile is null then return jsonb_build_object('success', false, 'error', 'actor_profile_required'); end if;

  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;

  select * into existing_event
  from opportunity_bid_submission_events
  where workspace_id = opp.workspace_id
    and command_id = p_command_id
  limit 1;
  if found then
    return public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('success', true, 'replayed', true);
  end if;

  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;
  if opp.bid_submission_status <> 'ready_for_submission_approval' then return jsonb_build_object('success', false, 'error', 'invalid_state'); end if;
  if opp.submission_approver_user_id is null or opp.submission_approver_user_id <> actor_profile then
    return jsonb_build_object('success', false, 'error', 'submission_approver_required');
  end if;

  readiness := public.p1_01b2_bid_submission_approval_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'error', 'configuration_unavailable');
  end if;
  if coalesce((readiness->>'ready')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'error', 'configured_bid_submission_approval_requirements_unmet', 'deficiencies', readiness->'deficiencies');
  end if;

  select value into outcome
  from jsonb_array_elements(readiness->'permittedOutcomes') value
  where value->>'outcomeKey' = normalized_outcome
  limit 1;

  if outcome is null then return jsonb_build_object('success', false, 'error', 'invalid_outcome'); end if;
  if coalesce((outcome->>'requiresJustification')::boolean, false) and normalized_reason is null then
    return jsonb_build_object('success', false, 'error', 'hold_rationale_required');
  end if;

  if outcome->>'mapsToAction' = 'approve_submission' then
    next_status := 'submission_approved_ready_to_send';
  elsif outcome->>'mapsToAction' = 'hold_submission_approval' then
    next_status := 'submission_approval_held';
  else
    return jsonb_build_object('success', false, 'error', 'invalid_outcome');
  end if;

  config_version := (readiness->>'configurationVersionId')::uuid;
  gate_key := readiness->>'gateKey';
  next_version := opp.version + 1;
  request_hash := md5(coalesce(p_command_id, '') || ':' || normalized_outcome || ':' || coalesce(p_reason, ''));

  update opportunities
  set bid_submission_status = next_status,
      bid_outcome_reason = case when next_status = 'submission_approval_held' then normalized_reason else bid_outcome_reason end,
      bid_submission_approval_configuration_version_id = config_version,
      bid_submission_approval_gate_key = gate_key,
      bid_submission_approval_outcome_key = normalized_outcome,
      version = next_version,
      updated_by = actor_profile,
      updated_at = now()
  where id = opp.id
    and version = p_expected_version
    and bid_submission_status = 'ready_for_submission_approval'
    and submission_approver_user_id = actor_profile;

  if not found then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict');
  end if;

  insert into opportunity_bid_submission_events (
    workspace_id, opportunity_id, event_type, bid_action, from_status, to_status,
    reason, actor_user_id, actor_profile_id, package_version, metadata, command_id, correlation_id,
    configuration_version_id, configuration_gate_key, configuration_outcome_key
  )
  values (
    opp.workspace_id, opp.id, 'opportunity.bid_submission_approval_recorded', outcome->>'mapsToAction',
    opp.bid_submission_status, next_status, normalized_reason, actor, actor_profile, next_version,
    jsonb_build_object(
      'requestHash', request_hash,
      'configuredOutcomeKey', normalized_outcome,
      'bidSubmissionRecorded', false,
      'configurationProvenance', jsonb_build_object('configurationVersionId', config_version, 'gateKey', gate_key, 'outcomeKey', normalized_outcome)
    ),
    p_command_id, p_correlation_id, config_version, gate_key, normalized_outcome
  );

  perform rybex_internal.append_audit_event(
    opp.workspace_id, null, 'opportunity', opp.id, p_command_id,
    'opportunity.bid_submission_approval_recorded', opp.bid_submission_status, next_status,
    actor, coalesce(p_correlation_id, p_command_id),
    jsonb_build_object('bidSubmissionStatus', opp.bid_submission_status),
    jsonb_build_object('bidSubmissionStatus', next_status, 'configuredOutcomeKey', normalized_outcome, 'bidSubmissionRecorded', false),
    jsonb_build_object('configurationVersionId', config_version, 'gateKey', gate_key, 'outcomeKey', normalized_outcome, 'actorProfileId', actor_profile)
  );

  perform rybex_internal.append_domain_event(
    opp.workspace_id, null, 'opportunity', opp.id, next_version,
    'opportunity.bid_submission_approval_recorded', 1, p_command_id,
    coalesce(p_correlation_id, p_command_id), actor,
    jsonb_build_object('status', next_status, 'configuredOutcomeKey', normalized_outcome, 'bidSubmissionRecorded', false)
  );

  result := public.p1_01a_get_opportunity_v1(opp.id);
  return result || jsonb_build_object('success', true, 'bidSubmissionState', next_status, 'configuredOutcomeKey', normalized_outcome);
end;
$$;

create or replace function public.attach_opportunity_bid_approval_evidence_v1(
  p_opportunity_id uuid,
  p_relationship_type text,
  p_payload jsonb,
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
  actor_profile uuid;
  opp opportunities%rowtype;
  readiness jsonb;
  relationship_key text := coalesce(p_relationship_type, '');
  evidence_id uuid := gen_random_uuid();
  object_path text;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select id into actor_profile from user_profiles where user_id = actor and status = 'active' limit 1;
  if actor_profile is null then return jsonb_build_object('success', false, 'error', 'actor_profile_required'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  if not exists (
    select 1 from workspace_memberships wm
    where wm.workspace_id = opp.workspace_id
      and wm.user_id = actor
      and wm.status = 'active'
      and wm.role in ('operations_leader','admin')
  ) then
    return jsonb_build_object('success', false, 'error', 'bid_evidence_authority_required');
  end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;
  if opp.bid_submission_status not in ('submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;

  readiness := public.p1_01b2_bid_submission_approval_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'error', 'configuration_unavailable');
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(readiness->'evidenceRequirements') item
    where item->>'relationshipType' = relationship_key
  ) then
    return jsonb_build_object('success', false, 'error', 'unknown_evidence_key');
  end if;

  request_hash := md5(p_payload::text || p_expected_version::text || relationship_key);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.bid_approval_evidence.attach.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  object_path := opp.workspace_id::text || '/opportunities/' || opp.id::text || '/bid-approval/' || evidence_id::text || '-' || regexp_replace(coalesce(p_payload->>'fileName', 'bid-evidence.txt'), '[^a-zA-Z0-9._-]+', '-', 'g');

  insert into evidence_objects (
    id, workspace_id, project_id, bucket_id, object_path, original_filename, mime_type,
    size_bytes, checksum_sha256, uploaded_by, upload_status, scan_status, verification_status, uploaded_at
  )
  values (
    evidence_id, opp.workspace_id, null, 'rybexos-evidence', object_path,
    coalesce(nullif(p_payload->>'fileName', ''), 'bid-evidence.txt'),
    coalesce(nullif(p_payload->>'mimeType', ''), 'text/plain'),
    coalesce(nullif(p_payload->>'sizeBytes', '')::bigint, 1),
    coalesce(nullif(p_payload->>'checksumSha256', ''), md5(object_path)),
    actor, 'uploaded', 'clean', 'accepted', now()
  );

  insert into evidence_links (
    workspace_id, project_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
  )
  values (
    opp.workspace_id, null, evidence_id, 'opportunity', opp.id, relationship_key, actor
  )
  on conflict (workspace_id, evidence_object_id, entity_type, entity_id, relationship_type) do nothing;

  perform rybex_internal.append_audit_event(
    opp.workspace_id, null, 'opportunity', opp.id, p_command_id,
    'opportunity.bid_approval_evidence_attached', opp.bid_submission_status, opp.bid_submission_status,
    actor, coalesce(p_correlation_id, p_command_id),
    '{}'::jsonb,
    jsonb_build_object('evidenceId', evidence_id, 'relationshipType', relationship_key),
    jsonb_build_object('configurationVersionId', readiness->>'configurationVersionId', 'gateKey', readiness->>'gateKey', 'actorProfileId', actor_profile)
  );
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.p1_01b2_bid_submission_approval_configuration_v1(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.p1_01b2_bid_submission_approval_readiness_v1(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.assign_opportunity_submission_approver_v1(uuid, uuid, integer, text, text) to authenticated, service_role;
grant execute on function public.p1_01a_list_decision_owner_options_v1() to authenticated, service_role;
grant execute on function public.record_configured_bid_submission_approval_v1(uuid, text, text, text, integer, text) to authenticated, service_role;
grant execute on function public.attach_opportunity_bid_approval_evidence_v1(uuid, text, jsonb, text, integer, text) to authenticated, service_role;

grant select, insert, update on
  config_template_packs,
  config_template_pack_versions,
  config_tenants,
  config_tenant_template_activations,
  config_tenant_configurations,
  config_configuration_versions,
  config_phase_definitions,
  config_gate_definitions,
  config_role_definitions,
  config_permission_definitions,
  config_evidence_type_definitions,
  config_gate_evidence_requirements,
  config_gate_decision_outcomes,
  config_decision_right_definitions,
  config_kpi_definitions,
  config_configuration_audit_events
to service_role;

grant select on opportunity_bid_submission_events to service_role;
