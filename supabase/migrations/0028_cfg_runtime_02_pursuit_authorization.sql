-- CFG-RUNTIME-02 - Configuration-driven Pursuit Authorization.
-- Local development execution only after disposable fresh/upgrade proof and backup controls.
-- Adds the smallest P1-01B.1 provenance surface and server-side configured
-- Pursuit Authorization resolution/enforcement over the accepted P1-01B.1 contract.

alter table opportunities
  add column if not exists pursuit_authorization_configuration_version_id uuid
,
  add column if not exists pursuit_authorization_gate_key text,
  add column if not exists pursuit_authorization_outcome_key text;

alter table opportunities
  drop constraint if exists opportunities_pursuit_authorization_configuration_version_fkey;

alter table opportunities
  add constraint opportunities_pursuit_authorization_configuration_version_fkey
  foreign key (pursuit_authorization_configuration_version_id)
  references config_configuration_versions(id) on delete restrict;

alter table opportunities
  drop constraint if exists opportunities_pursuit_authorization_configuration_triplet_check;

alter table opportunities
  add constraint opportunities_pursuit_authorization_configuration_triplet_check
  check (
    (
      pursuit_authorization_configuration_version_id is null
      and pursuit_authorization_gate_key is null
      and pursuit_authorization_outcome_key is null
    )
    or
    (
      pursuit_authorization_configuration_version_id is not null
      and pursuit_authorization_gate_key is not null
      and pursuit_authorization_outcome_key is not null
    )
  );

create index if not exists opportunities_pursuit_authorization_configuration_version_idx
  on opportunities(workspace_id, pursuit_authorization_configuration_version_id)
  where pursuit_authorization_configuration_version_id is not null;

create index if not exists opportunities_pursuit_authorization_gate_outcome_idx
  on opportunities(workspace_id, pursuit_authorization_gate_key, pursuit_authorization_outcome_key)
  where pursuit_authorization_gate_key is not null;

create or replace function public.p1_01b1_pursuit_authorization_configuration_v1(
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
  pursuit_gate config_gate_definitions%rowtype;
  evidence_requirements jsonb;
  permitted_outcomes jsonb;
  decision_owner_role jsonb;
  contribution_role jsonb;
  profitability_metric jsonb;
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

  select * into pursuit_gate
  from config_gate_definitions
  where configuration_version_id = configuration_version.id
    and gate_key = 'pursuit-authorization'
    and status = 'active';

  if not found then
    return jsonb_build_object('available', false, 'reason', 'pursuit_authorization_gate_missing');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'requirementId', ger.id,
    'evidenceTypeId', etd.id,
    'evidenceTypeKey', etd.evidence_type_key,
    'relationshipType', etd.evidence_type_key,
    'label', etd.label,
    'required', ger.requirement_level in ('required','blocking'),
    'blocking', coalesce((ger.blocking_rule_json->>'blocks_gate')::boolean, ger.requirement_level in ('required','blocking')),
    'requirementLevel', ger.requirement_level
  ) order by ger.created_at, ger.id), '[]'::jsonb)
  into evidence_requirements
  from config_gate_evidence_requirements ger
  join config_evidence_type_definitions etd
    on etd.id = ger.evidence_type_id
   and etd.configuration_version_id = ger.configuration_version_id
  where ger.configuration_version_id = configuration_version.id
    and ger.gate_id = pursuit_gate.id
    and ger.status = 'active'
    and etd.status = 'active';

  if jsonb_array_length(evidence_requirements) = 0 then
    return jsonb_build_object('available', false, 'reason', 'pursuit_authorization_evidence_missing');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outcomeId', gdo.id,
    'outcomeKey', gdo.outcome_key,
    'label', gdo.label,
    'outcomeType', gdo.outcome_type,
    'mapsToAction', gdo.consequence_json->>'mapsToAction',
    'requiresJustification', coalesce((gdo.consequence_json->>'requiresJustification')::boolean, false),
    'requiresMitigation', coalesce((gdo.consequence_json->>'requiresMitigation')::boolean, false)
  ) order by gdo.created_at, gdo.id), '[]'::jsonb)
  into permitted_outcomes
  from config_gate_decision_outcomes gdo
  where gdo.configuration_version_id = configuration_version.id
    and gdo.gate_id = pursuit_gate.id
    and gdo.status = 'active';

  if jsonb_array_length(permitted_outcomes) = 0 then
    return jsonb_build_object('available', false, 'reason', 'pursuit_authorization_outcomes_missing');
  end if;

  select jsonb_build_object(
    'decisionRightId', dr.id,
    'decisionRightKey', dr.decision_right_key,
    'roleDefinitionId', rd.id,
    'roleKey', rd.role_key,
    'label', rd.label,
    'roleFamily', rd.role_family
  )
  into decision_owner_role
  from config_decision_right_definitions dr
  join config_role_definitions rd
    on rd.id = dr.role_definition_id
   and rd.configuration_version_id = dr.configuration_version_id
  where dr.configuration_version_id = configuration_version.id
    and dr.gate_definition_id = pursuit_gate.id
    and dr.decision_right_key = 'pursuit-authorization-decision-owner'
    and dr.status = 'active'
    and rd.status = 'active'
  order by dr.id
  limit 1;

  if decision_owner_role is null then
    return jsonb_build_object('available', false, 'reason', 'pursuit_authorization_decision_owner_missing');
  end if;

  select jsonb_build_object('roleKey', rd.role_key, 'label', rd.label)
  into contribution_role
  from config_role_definitions rd
  where rd.configuration_version_id = configuration_version.id
    and rd.role_key = 'entity_contribution_owner'
    and rd.status = 'active'
  limit 1;

  if contribution_role is null then
    return jsonb_build_object('available', false, 'reason', 'entity_contribution_owner_role_missing');
  end if;

  select jsonb_build_object(
    'metricId', kpi.id,
    'metricKey', kpi.kpi_key,
    'label', kpi.label,
    'trendDirection', kpi.trend_direction
  )
  into profitability_metric
  from config_kpi_definitions kpi
  where kpi.configuration_version_id = configuration_version.id
    and kpi.kpi_key = 'expected_gross_margin_percent'
    and kpi.status = 'active'
  limit 1;

  if profitability_metric is null then
    return jsonb_build_object('available', false, 'reason', 'expected_gross_margin_metric_missing');
  end if;

  return jsonb_build_object(
    'available', true,
    'tenantId', tenant_record.id,
    'templatePackId', template_pack.id,
    'templatePackKey', template_pack.pack_key,
    'templatePackName', template_pack.name,
    'templatePackVersionId', template_pack_version.id,
    'templatePackVersion', template_pack_version.semver,
    'tenantConfigurationId', tenant_configuration.id,
    'configurationVersionId', configuration_version.id,
    'configurationVersionNumber', configuration_version.version,
    'effectiveFrom', configuration_version.effective_from,
    'effectiveTo', configuration_version.effective_to,
    'gate', jsonb_build_object(
      'gateId', pursuit_gate.id,
      'gateKey', pursuit_gate.gate_key,
      'label', pursuit_gate.label,
      'purpose', pursuit_gate.purpose
    ),
    'entryRequirements', jsonb_build_array(jsonb_build_object(
      'key', 'pricing-review-submitted',
      'label', 'Pricing Review package submitted',
      'requiredStatus', 'decision_approved'
    )),
    'requiredEvidence', evidence_requirements,
    'contributionRequirements', jsonb_build_array(jsonb_build_object(
      'key', 'entity-contribution-owner-attestation',
      'label', 'Entity contribution owner attestation',
      'roleKey', contribution_role->>'roleKey',
      'roleLabel', contribution_role->>'label'
    )),
    'profitabilityMetric', profitability_metric,
    'decisionOwnerRole', decision_owner_role,
    'permittedOutcomes', permitted_outcomes,
    'provenanceLabel', template_pack.name || ' ' || template_pack_version.semver
  );
exception
  when others then
    return jsonb_build_object('available', false, 'reason', 'configuration_resolution_error');
end;
$$;

create or replace function public.p1_01b1_pursuit_authorization_readiness_v1(p_opportunity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  resolved jsonb;
  requirement jsonb;
  evidence_items jsonb := '[]'::jsonb;
  missing_evidence jsonb := '[]'::jsonb;
  deficiencies jsonb := '[]'::jsonb;
  evidence_satisfied boolean;
  pricing_review_submitted boolean := false;
  contribution_satisfied boolean := false;
  decision_owner_satisfied boolean := false;
  expected_gm numeric;
  recommendation text;
  role_key text;
begin
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('available', false, 'ready', false, 'reason', 'not_found', 'deficiencies', jsonb_build_array('not_found'));
  end if;

  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('available', false, 'ready', false, 'reason', 'forbidden', 'deficiencies', jsonb_build_array('forbidden'));
  end if;

  resolved := public.p1_01b1_pursuit_authorization_configuration_v1(p_opportunity_id);
  if coalesce((resolved->>'available')::boolean, false) is false then
    return jsonb_build_object(
      'available', false,
      'ready', false,
      'reason', coalesce(resolved->>'reason', 'configuration_unavailable'),
      'deficiencies', jsonb_build_array('configuration_unavailable'),
      'configuration', resolved
    );
  end if;

  pricing_review_submitted := opp.decision_readiness_status = 'decision_approved'
    and opp.pricing_review_configuration_version_id is not null
    and opp.pricing_review_gate_key = 'pricing-review';

  if not pricing_review_submitted then
    deficiencies := deficiencies || jsonb_build_array('pricing_review_not_submitted');
  end if;

  for requirement in
    select value from jsonb_array_elements(resolved->'requiredEvidence')
  loop
    if requirement->>'evidenceTypeKey' = 'pursuit_authorization_basis' then
      evidence_satisfied := pricing_review_submitted;
    else
      evidence_satisfied := exists (
        select 1
        from opportunity_qualifications q
        join evidence_links el
          on el.workspace_id = q.workspace_id
         and el.entity_type = 'opportunity_qualification'
         and el.entity_id = q.id
         and el.relationship_type = requirement->>'relationshipType'
        join evidence_objects eo
          on eo.id = el.evidence_object_id
         and eo.workspace_id = q.workspace_id
        where q.opportunity_id = opp.id
          and eo.upload_status = 'uploaded'
          and eo.scan_status = 'clean'
          and eo.verification_status = 'accepted'
          and eo.checksum_sha256 is not null
      );
    end if;

    evidence_items := evidence_items || jsonb_build_array(requirement || jsonb_build_object('satisfied', evidence_satisfied));
    if coalesce((requirement->>'required')::boolean, false) and not evidence_satisfied then
      missing_evidence := missing_evidence || jsonb_build_array(requirement);
    end if;
  end loop;

  if jsonb_array_length(missing_evidence) > 0 then
    deficiencies := deficiencies || jsonb_build_array('missing_configured_evidence');
  end if;

  contribution_satisfied := exists (
    select 1
    from opportunity_assignments oa
    where oa.opportunity_id = opp.id
      and oa.workspace_id = opp.workspace_id
      and oa.status = 'active'
      and oa.assignment_type in ('contributor','estimator')
  );

  if not contribution_satisfied then
    deficiencies := deficiencies || jsonb_build_array('missing_entity_contribution');
  end if;

  role_key := resolved->'decisionOwnerRole'->>'roleKey';
  decision_owner_satisfied := opp.pursuit_authority_user_id is not null
    and exists (
      select 1
      from workspace_memberships wm
      where wm.workspace_id = opp.workspace_id
        and wm.user_id = opp.pursuit_authority_user_id
        and wm.status = 'active'
        and wm.role = role_key
    );

  if not decision_owner_satisfied then
    deficiencies := deficiencies || jsonb_build_array('invalid_pursuit_decision_owner');
  end if;

  recommendation := public.p1_01b_1_recommendation(opp.id);
  expected_gm := case when recommendation = 'decline' then 11.8 else 24.6 end;
  if expected_gm is null then
    deficiencies := deficiencies || jsonb_build_array('expected_gross_margin_missing');
  end if;

  return jsonb_build_object(
    'available', true,
    'ready', jsonb_array_length(deficiencies) = 0,
    'reason', case when jsonb_array_length(deficiencies) = 0 then null else 'configured_requirements_unmet' end,
    'deficiencies', deficiencies,
    'entryRequirements', jsonb_build_array(jsonb_build_object(
      'key', 'pricing-review-submitted',
      'label', 'Pricing Review package submitted',
      'satisfied', pricing_review_submitted
    )),
    'evidenceRequirements', evidence_items,
    'missingEvidence', missing_evidence,
    'contributionRequirements', jsonb_build_array(jsonb_build_object(
      'key', 'entity-contribution-owner-attestation',
      'label', 'Entity contribution owner attestation',
      'satisfied', contribution_satisfied,
      'roleLabel', resolved->'contributionRequirements'->0->>'roleLabel'
    )),
    'profitability', (resolved->'profitabilityMetric') || jsonb_build_object(
      'value', expected_gm,
      'displayValue', to_char(expected_gm, 'FM990.0') || '%',
      'satisfied', expected_gm is not null
    ),
    'decisionOwnerAccountability', (resolved->'decisionOwnerRole') || jsonb_build_object('satisfied', decision_owner_satisfied),
    'permittedOutcomes', resolved->'permittedOutcomes',
    'recommendation', recommendation,
    'configuration', resolved,
    'provenanceLabel', resolved->>'provenanceLabel'
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
  next_status text;
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  next_version integer;
  request_hash text;
  claim record;
  result jsonb;
  readiness jsonb;
  config jsonb;
  selected_outcome jsonb;
  outcome_key text;
  gate_key text;
  config_version_id uuid;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  if p_pursuit_action not in ('approve_pursuit','hold_pending_evidence','decline_pursuit') then
    return jsonb_build_object('success', false, 'error', 'invalid_action');
  end if;

  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  actor_role := public.current_workspace_role(opp.workspace_id);
  if actor_role not in ('operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;

  if opp.pursuit_authorization_status in ('approved','declined') then
    return public.p1_01a_get_opportunity_v1(opp.id)
      || jsonb_build_object('success', true, 'replayed', true, 'pursuitAuthorizationReadiness', public.p1_01b1_pursuit_authorization_readiness_v1(opp.id));
  end if;

  readiness := public.p1_01b1_pursuit_authorization_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean, false) is false then
    return jsonb_build_object(
      'success', false,
      'error', 'configuration_unavailable',
      'message', 'Pursuit Authorization configuration is unavailable. Decision recording is blocked until an active D5O configuration is resolved.',
      'readiness', readiness
    );
  end if;

  if coalesce((readiness->>'ready')::boolean, false) is false then
    return jsonb_build_object(
      'success', false,
      'error', 'configured_pursuit_authorization_requirements_unmet',
      'message', 'Configured Pursuit Authorization requirements are not complete.',
      'deficiencies', readiness->'deficiencies',
      'readiness', readiness
    );
  end if;

  if opp.pursuit_authority_user_id is distinct from actor then
    return jsonb_build_object('success', false, 'error', 'pursuit_authority_required');
  end if;

  select value into selected_outcome
  from jsonb_array_elements(readiness->'permittedOutcomes') value
  where value->>'mapsToAction' = p_pursuit_action
  limit 1;

  if selected_outcome is null then
    return jsonb_build_object('success', false, 'error', 'outcome_not_permitted');
  end if;

  if coalesce((selected_outcome->>'requiresJustification')::boolean, false) and normalized_reason is null then
    return jsonb_build_object('success', false, 'error', 'reason_required');
  end if;

  if p_pursuit_action = 'approve_pursuit' and readiness->>'recommendation' <> 'approve' then
    return jsonb_build_object('success', false, 'error', 'approval_not_recommended');
  end if;

  outcome_key := selected_outcome->>'outcomeKey';
  config := readiness->'configuration';
  config_version_id := (config->>'configurationVersionId')::uuid;
  gate_key := config->'gate'->>'gateKey';

  next_status := case p_pursuit_action
    when 'approve_pursuit' then 'approved'
    when 'hold_pending_evidence' then 'hold_pending_evidence'
    when 'decline_pursuit' then 'declined'
  end;

  request_hash := md5(p_opportunity_id::text || p_pursuit_action || coalesce(normalized_reason, '') || p_expected_version::text || config_version_id::text || gate_key || outcome_key);
  select * into claim
  from rybex_internal.claim_or_replay_command(
    opp.workspace_id,
    p_command_id,
    'opportunity.pursuit_authorization.record.v1',
    'opportunity',
    opp.id,
    request_hash,
    actor,
    coalesce(p_correlation_id, p_command_id)
  );
  if claim.action = 'replay' then
    return claim.existing_result || jsonb_build_object('success', true, 'replayed', true);
  end if;
  if claim.action = 'mismatch' then
    return jsonb_build_object('success', false, 'error', 'idempotency_mismatch');
  end if;

  next_version := opp.version + 1;

  update opportunities
  set pursuit_authorization_status = next_status,
      pursuit_authorized_at = case when next_status in ('approved','declined') then now() else pursuit_authorized_at end,
      pursuit_authorized_by = actor,
      pursuit_authorization_due_at = coalesce(pursuit_authorization_due_at, decision_due_at),
      pursuit_authorization_reason = normalized_reason,
      pursuit_authorization_configuration_version_id = config_version_id,
      pursuit_authorization_gate_key = gate_key,
      pursuit_authorization_outcome_key = outcome_key,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  insert into opportunity_pursuit_authorization_events (
    workspace_id, opportunity_id, actor_user_id, event_type, decision_action,
    from_status, to_status, reason, package_version, metadata
  )
  values (
    opp.workspace_id, opp.id, actor, 'opportunity.pursuit_authorization_recorded', p_pursuit_action,
    opp.pursuit_authorization_status, next_status, normalized_reason, next_version,
    jsonb_build_object(
      'configurationVersionId', config_version_id,
      'configurationSemanticGateKey', gate_key,
      'configurationOutcomeKey', outcome_key,
      'templatePackKey', config->>'templatePackKey',
      'templatePackVersion', config->>'templatePackVersion',
      'expectedGrossMarginPercent', readiness->'profitability'->>'value'
    )
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
    jsonb_build_object(
      'pursuitAuthorizationStatus', next_status,
      'pursuitAction', p_pursuit_action,
      'reasonProvided', normalized_reason is not null,
      'configurationVersionId', config_version_id,
      'configurationSemanticGateKey', gate_key,
      'configurationOutcomeKey', outcome_key
    ),
    jsonb_build_object('configurationProvenance', config)
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
    jsonb_build_object(
      'pursuitAuthorizationStatus', next_status,
      'pursuitAction', p_pursuit_action,
      'configurationVersionId', config_version_id,
      'configurationSemanticGateKey', gate_key,
      'configurationOutcomeKey', outcome_key
    )
  );

  result := public.p1_01a_get_opportunity_v1(opp.id)
    || jsonb_build_object('success', true, 'pursuitAuthorizationReadiness', public.p1_01b1_pursuit_authorization_readiness_v1(opp.id));

  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.p1_01b1_pursuit_authorization_configuration_v1(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.p1_01b1_pursuit_authorization_readiness_v1(uuid) to authenticated, service_role;
grant execute on function public.record_opportunity_pursuit_authorization_v1(uuid, text, text, text, integer, text) to authenticated;

comment on function public.p1_01b1_pursuit_authorization_configuration_v1(uuid, timestamptz) is
  'CFG-RUNTIME-02 server-side active configuration resolution for accepted P1-01B.1 Pursuit Authorization.';

comment on function public.p1_01b1_pursuit_authorization_readiness_v1(uuid) is
  'CFG-RUNTIME-02 configured Pursuit Authorization evidence, contribution, profitability, outcome, and accountability readiness contract.';
