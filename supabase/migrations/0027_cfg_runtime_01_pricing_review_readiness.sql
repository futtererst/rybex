-- CFG-RUNTIME-01 - Configuration-driven Pricing Review readiness.
-- Local development execution only after accepted 0017-0026 baseline and backup controls.
-- Adds the smallest P1-01A provenance surface and server-side fail-closed
-- configuration resolution for the existing Pricing Review handoff.
-- Does not implement Configuration Studio, template-pack runtime loading, P1-01B.3,
-- project readiness, mobilization, demo readiness, or production readiness.

alter table opportunities
  add column if not exists pricing_review_configuration_version_id uuid
    references config_configuration_versions(id) on delete restrict,
  add column if not exists pricing_review_gate_key text;

alter table opportunities
  drop constraint if exists opportunities_pricing_review_configuration_pair_check;

alter table opportunities
  add constraint opportunities_pricing_review_configuration_pair_check
  check (
    (pricing_review_configuration_version_id is null and pricing_review_gate_key is null)
    or
    (pricing_review_configuration_version_id is not null and pricing_review_gate_key is not null)
  );

create index if not exists opportunities_pricing_review_configuration_version_idx
  on opportunities(workspace_id, pricing_review_configuration_version_id)
  where pricing_review_configuration_version_id is not null;

create index if not exists opportunities_pricing_review_gate_idx
  on opportunities(workspace_id, pricing_review_gate_key)
  where pricing_review_gate_key is not null;

create or replace function public.p1_01a_pricing_review_configuration_v1(
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
  pricing_gate config_gate_definitions%rowtype;
  evidence_requirements jsonb;
  decision_right_count integer;
  decision_owner_role jsonb;
begin
  select * into opp
  from opportunities
  where id = p_opportunity_id;

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

  select * into pricing_gate
  from config_gate_definitions
  where configuration_version_id = configuration_version.id
    and gate_key = 'pricing-review'
    and status = 'active';

  if not found then
    return jsonb_build_object('available', false, 'reason', 'pricing_review_gate_missing');
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
    and ger.gate_id = pricing_gate.id
    and ger.status = 'active'
    and etd.status = 'active';

  if jsonb_array_length(evidence_requirements) = 0 then
    return jsonb_build_object('available', false, 'reason', 'pricing_review_evidence_missing');
  end if;

  select count(*)
  into decision_right_count
  from config_decision_right_definitions dr
  join config_role_definitions rd
    on rd.id = dr.role_definition_id
   and rd.configuration_version_id = dr.configuration_version_id
  where dr.configuration_version_id = configuration_version.id
    and dr.gate_definition_id = pricing_gate.id
    and dr.decision_right_key = 'pricing-review-decision-owner'
    and dr.status = 'active'
    and rd.status = 'active';

  if decision_right_count <> 1 then
    return jsonb_build_object('available', false, 'reason', 'pricing_review_decision_owner_ambiguous');
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
    and dr.gate_definition_id = pricing_gate.id
    and dr.decision_right_key = 'pricing-review-decision-owner'
    and dr.status = 'active'
    and rd.status = 'active'
  order by dr.id
  limit 1;

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
      'gateId', pricing_gate.id,
      'gateKey', pricing_gate.gate_key,
      'label', pricing_gate.label,
      'purpose', pricing_gate.purpose
    ),
    'requiredEvidence', evidence_requirements,
    'decisionOwnerRole', decision_owner_role,
    'provenanceLabel', template_pack.name || ' ' || template_pack_version.semver
  );
exception
  when others then
    return jsonb_build_object('available', false, 'reason', 'configuration_resolution_error');
end;
$$;

create or replace function public.p1_01a_pricing_review_readiness_v1(p_opportunity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  qualification jsonb;
  resolved jsonb;
  evidence_items jsonb := '[]'::jsonb;
  missing_evidence jsonb := '[]'::jsonb;
  deficiencies jsonb := '[]'::jsonb;
  requirement jsonb;
  evidence_satisfied boolean;
  decision_owner_satisfied boolean := false;
  qualification_complete boolean := false;
  role_key text;
begin
  select * into opp
  from opportunities
  where id = p_opportunity_id;

  if not found then
    return jsonb_build_object('available', false, 'ready', false, 'reason', 'not_found', 'deficiencies', jsonb_build_array('not_found'));
  end if;

  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('available', false, 'ready', false, 'reason', 'forbidden', 'deficiencies', jsonb_build_array('forbidden'));
  end if;

  resolved := public.p1_01a_pricing_review_configuration_v1(p_opportunity_id);
  if coalesce((resolved->>'available')::boolean, false) is false then
    return jsonb_build_object(
      'available', false,
      'ready', false,
      'reason', coalesce(resolved->>'reason', 'configuration_unavailable'),
      'deficiencies', jsonb_build_array('configuration_unavailable'),
      'configuration', resolved
    );
  end if;

  select coalesce(to_jsonb(q), '{}'::jsonb)
  into qualification
  from opportunity_qualifications q
  where q.opportunity_id = opp.id;

  qualification_complete := coalesce((qualification->>'completeness_result') = 'complete', false);

  for requirement in
    select value
    from jsonb_array_elements(resolved->'requiredEvidence')
  loop
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

    evidence_items := evidence_items || jsonb_build_array(requirement || jsonb_build_object('satisfied', evidence_satisfied));

    if coalesce((requirement->>'required')::boolean, false) and not evidence_satisfied then
      missing_evidence := missing_evidence || jsonb_build_array(requirement);
    end if;
  end loop;

  role_key := resolved->'decisionOwnerRole'->>'roleKey';
  decision_owner_satisfied := opp.decision_owner_user_id is not null
    and exists (
      select 1
      from workspace_memberships wm
      where wm.workspace_id = opp.workspace_id
        and wm.user_id = opp.decision_owner_user_id
        and wm.status = 'active'
        and wm.role = role_key
    );

  if not qualification_complete then
    deficiencies := deficiencies || jsonb_build_array('qualification_incomplete');
  end if;

  if jsonb_array_length(missing_evidence) > 0 then
    deficiencies := deficiencies || jsonb_build_array('missing_configured_evidence');
  end if;

  if opp.decision_owner_user_id is null or opp.decision_due_at is null then
    deficiencies := deficiencies || jsonb_build_array('decision_accountability_required');
  elsif not decision_owner_satisfied then
    deficiencies := deficiencies || jsonb_build_array('invalid_decision_owner_accountability');
  end if;

  return jsonb_build_object(
    'available', true,
    'ready', jsonb_array_length(deficiencies) = 0,
    'reason', case when jsonb_array_length(deficiencies) = 0 then null else 'configured_requirements_unmet' end,
    'deficiencies', deficiencies,
    'evidenceRequirements', evidence_items,
    'missingEvidence', missing_evidence,
    'decisionOwnerAccountability', (resolved->'decisionOwnerRole') || jsonb_build_object('satisfied', decision_owner_satisfied),
    'configuration', resolved,
    'provenanceLabel', resolved->>'provenanceLabel'
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
  actor_role text;
  next_version integer;
  request_hash text;
  readiness jsonb;
  config jsonb;
  config_version_id uuid;
  gate_key text;
  claim record;
  result jsonb;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'error', 'unauthenticated');
  end if;

  select * into opp
  from opportunities
  where id = p_opportunity_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  actor_role := public.current_workspace_role(opp.workspace_id);
  if actor_role not in ('business_development_lead','operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if opp.version <> p_expected_version then
    return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version);
  end if;

  if opp.lifecycle_status = 'decision_required' then
    return public.p1_01a_get_opportunity_v1(opp.id) || jsonb_build_object('success', true, 'replayed', true);
  end if;

  select * into qual
  from opportunity_qualifications
  where opportunity_id = opp.id;

  if not found or qual.completeness_result <> 'complete' then
    return jsonb_build_object('success', false, 'error', 'validation_failed');
  end if;

  readiness := public.p1_01a_pricing_review_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean, false) is false then
    return jsonb_build_object(
      'success', false,
      'error', 'configuration_unavailable',
      'message', 'Pricing Review configuration is unavailable. Advancement is blocked until an active D5O configuration is resolved.',
      'readiness', readiness
    );
  end if;

  if coalesce((readiness->>'ready')::boolean, false) is false then
    return jsonb_build_object(
      'success', false,
      'error', 'configured_pricing_review_requirements_unmet',
      'message', 'Configured Pricing Review requirements are not complete.',
      'deficiencies', readiness->'deficiencies',
      'missingEvidence', readiness->'missingEvidence',
      'readiness', readiness
    );
  end if;

  config := readiness->'configuration';
  config_version_id := (config->>'configurationVersionId')::uuid;
  gate_key := config->'gate'->>'gateKey';

  request_hash := md5(p_opportunity_id::text || p_expected_version::text || config_version_id::text || gate_key);
  select * into claim
  from rybex_internal.claim_or_replay_command(
    opp.workspace_id,
    p_command_id,
    'opportunity.submit_for_decision.v1',
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
  set lifecycle_status = 'decision_required',
      decision_readiness_status = 'ready_for_decision',
      submitted_for_decision_at = now(),
      submitted_for_decision_by = actor,
      pricing_review_configuration_version_id = config_version_id,
      pricing_review_gate_key = gate_key,
      version = next_version,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    p_command_id,
    'opportunity.submitted_for_decision',
    opp.lifecycle_status,
    'decision_required',
    actor,
    coalesce(p_correlation_id, p_command_id),
    '{}'::jsonb,
    jsonb_build_object(
      'qualificationId', qual.id,
      'decisionOwnerUserId', opp.decision_owner_user_id,
      'decisionDueAt', opp.decision_due_at,
      'configurationVersionId', config_version_id,
      'configurationSemanticGateKey', gate_key,
      'templatePackKey', config->>'templatePackKey',
      'templatePackVersion', config->>'templatePackVersion'
    ),
    jsonb_build_object('configurationProvenance', config)
  );

  perform rybex_internal.append_domain_event(
    opp.workspace_id,
    null,
    'opportunity',
    opp.id,
    next_version,
    'opportunity.submitted_for_decision',
    1,
    p_command_id,
    coalesce(p_correlation_id, p_command_id),
    actor,
    jsonb_build_object(
      'qualificationId', qual.id,
      'decisionOwnerUserId', opp.decision_owner_user_id,
      'decisionDueAt', opp.decision_due_at,
      'configurationVersionId', config_version_id,
      'configurationSemanticGateKey', gate_key,
      'templatePackKey', config->>'templatePackKey',
      'templatePackVersion', config->>'templatePackVersion'
    )
  );

  result := public.p1_01a_get_opportunity_v1(opp.id)
    || jsonb_build_object('success', true, 'pricingReviewReadiness', public.p1_01a_pricing_review_readiness_v1(opp.id));

  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.p1_01a_pricing_review_configuration_v1(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.p1_01a_pricing_review_readiness_v1(uuid) to authenticated, service_role;
grant execute on function public.submit_opportunity_for_decision_v1(uuid, text, integer, text) to authenticated;

comment on function public.p1_01a_pricing_review_configuration_v1(uuid, timestamptz) is
  'CFG-RUNTIME-01 server-side active configuration resolution for existing P1-01A Pricing Review readiness.';

comment on function public.p1_01a_pricing_review_readiness_v1(uuid) is
  'CFG-RUNTIME-01 configured Pricing Review evidence and decision-owner readiness contract.';
