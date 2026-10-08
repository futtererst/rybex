-- CFG-RUNTIME-03 evidence persistence authority extension.
-- Forward-only: migration 0029 remains immutable.

create table if not exists opportunity_bid_evidence_satisfactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  opportunity_id uuid not null references opportunities(id) on delete restrict,
  evidence_link_id uuid not null references evidence_links(id) on delete restrict,
  evidence_object_id uuid not null references evidence_objects(id) on delete restrict,
  configuration_version_id uuid not null references config_configuration_versions(id) on delete restrict,
  template_pack_version_id uuid not null references config_template_pack_versions(id) on delete restrict,
  gate_requirement_id uuid not null,
  evidence_type_id uuid not null,
  package_revision integer not null,
  bid_package_version text not null,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  actor_profile_id uuid not null references user_profiles(id) on delete restrict,
  audit_event_id uuid not null references audit_events(id) on delete restrict,
  command_id text not null,
  created_at timestamptz not null default now(),
  constraint opportunity_bid_evidence_satisfactions_package_revision_check check (package_revision > 0),
  constraint opportunity_bid_evidence_satisfactions_bid_package_check check (length(trim(bid_package_version)) > 0),
  constraint opportunity_bid_evidence_satisfactions_command_check check (length(trim(command_id)) > 0),
  constraint opportunity_bid_evidence_satisfactions_requirement_configuration_fkey
    foreign key (gate_requirement_id, configuration_version_id)
    references config_gate_evidence_requirements(id, configuration_version_id) on delete restrict,
  constraint opportunity_bid_evidence_satisfactions_evidence_type_configuration_fkey
    foreign key (evidence_type_id, configuration_version_id)
    references config_evidence_type_definitions(id, configuration_version_id) on delete restrict,
  constraint opp_bid_evidence_link_scope_uniq
    unique (evidence_link_id, evidence_object_id, workspace_id, opportunity_id),
  constraint opp_bid_evidence_req_revision_uniq
    unique (workspace_id, opportunity_id, package_revision, bid_package_version, configuration_version_id, gate_requirement_id),
  constraint opp_bid_evidence_command_uniq
    unique (workspace_id, command_id)
);

create index if not exists opportunity_bid_evidence_satisfactions_readiness_idx
  on opportunity_bid_evidence_satisfactions (
    workspace_id,
    opportunity_id,
    package_revision,
    bid_package_version,
    configuration_version_id,
    gate_requirement_id
  );

create index if not exists opportunity_bid_evidence_satisfactions_evidence_idx
  on opportunity_bid_evidence_satisfactions (evidence_object_id, evidence_link_id);

create or replace function rybex_internal.validate_bid_evidence_satisfaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opp opportunities%rowtype;
  link evidence_links%rowtype;
  evidence evidence_objects%rowtype;
  requirement config_gate_evidence_requirements%rowtype;
  evidence_type config_evidence_type_definitions%rowtype;
  config_version config_configuration_versions%rowtype;
  audit audit_events%rowtype;
begin
  select * into opp from opportunities where id = new.opportunity_id;
  if not found or opp.workspace_id <> new.workspace_id then
    raise exception 'bid_evidence_opportunity_scope_mismatch';
  end if;
  if opp.version <> new.package_revision
     or opp.bid_package_version is distinct from new.bid_package_version then
    raise exception 'bid_evidence_package_revision_mismatch';
  end if;

  select * into link from evidence_links where id = new.evidence_link_id;
  if not found
     or link.workspace_id <> new.workspace_id
     or link.entity_type <> 'opportunity'
     or link.entity_id <> new.opportunity_id
     or link.evidence_object_id <> new.evidence_object_id then
    raise exception 'bid_evidence_link_scope_mismatch';
  end if;

  select * into evidence from evidence_objects where id = new.evidence_object_id;
  if not found
     or evidence.workspace_id <> new.workspace_id
     or evidence.upload_status <> 'uploaded'
     or evidence.scan_status <> 'clean'
     or evidence.verification_status <> 'accepted'
     or nullif(trim(evidence.original_filename), '') is null
     or evidence.size_bytes is null
     or evidence.size_bytes <= 0
     or evidence.checksum_sha256 is null
     or evidence.checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'bid_evidence_metadata_invalid';
  end if;

  select * into requirement
  from config_gate_evidence_requirements
  where id = new.gate_requirement_id
    and configuration_version_id = new.configuration_version_id
    and evidence_type_id = new.evidence_type_id
    and status = 'active';
  if not found then
    raise exception 'bid_evidence_requirement_invalid';
  end if;

  select * into evidence_type
  from config_evidence_type_definitions
  where id = new.evidence_type_id
    and configuration_version_id = new.configuration_version_id
    and status = 'active';
  if not found or link.relationship_type <> evidence_type.evidence_type_key then
    raise exception 'bid_evidence_requirement_relationship_mismatch';
  end if;

  select * into config_version
  from config_configuration_versions
  where id = new.configuration_version_id;
  if not found
     or config_version.source_template_pack_version_id is distinct from new.template_pack_version_id then
    raise exception 'bid_evidence_configuration_scope_mismatch';
  end if;

  select * into audit from audit_events where id = new.audit_event_id;
  if not found
     or audit.workspace_id <> new.workspace_id
     or audit.entity_type <> 'opportunity'
     or audit.entity_id <> new.opportunity_id
     or audit.command_id <> new.command_id
     or audit.actor_auth_user_id <> new.actor_auth_user_id
     or audit.actor_user_id <> new.actor_profile_id
     or audit.action <> 'opportunity.bid_approval_evidence_attached'
     or audit.after_values->>'evidenceId' <> new.evidence_object_id::text
     or audit.metadata->>'gateRequirementId' <> new.gate_requirement_id::text
     or audit.metadata->>'configurationVersionId' <> new.configuration_version_id::text
     or audit.metadata->>'packageRevision' <> new.package_revision::text
     or audit.metadata->>'bidPackageVersion' <> new.bid_package_version then
    raise exception 'bid_evidence_audit_scope_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bid_evidence_satisfaction_before_insert on opportunity_bid_evidence_satisfactions;
create trigger validate_bid_evidence_satisfaction_before_insert
before insert on opportunity_bid_evidence_satisfactions
for each row execute function rybex_internal.validate_bid_evidence_satisfaction();

create or replace function rybex_internal.prevent_bid_evidence_satisfaction_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'opportunity_bid_evidence_satisfactions are append-only';
end;
$$;

drop trigger if exists prevent_bid_evidence_satisfaction_update_delete on opportunity_bid_evidence_satisfactions;
create trigger prevent_bid_evidence_satisfaction_update_delete
before update or delete on opportunity_bid_evidence_satisfactions
for each row execute function rybex_internal.prevent_bid_evidence_satisfaction_mutation();

alter table opportunity_bid_evidence_satisfactions enable row level security;
drop policy if exists opportunity_bid_evidence_satisfactions_no_direct_select on opportunity_bid_evidence_satisfactions;
create policy opportunity_bid_evidence_satisfactions_no_direct_select
  on opportunity_bid_evidence_satisfactions for select to authenticated using (false);
drop policy if exists opportunity_bid_evidence_satisfactions_no_direct_insert on opportunity_bid_evidence_satisfactions;
create policy opportunity_bid_evidence_satisfactions_no_direct_insert
  on opportunity_bid_evidence_satisfactions for insert to authenticated with check (false);
drop policy if exists opportunity_bid_evidence_satisfactions_no_direct_update on opportunity_bid_evidence_satisfactions;
create policy opportunity_bid_evidence_satisfactions_no_direct_update
  on opportunity_bid_evidence_satisfactions for update to authenticated using (false) with check (false);
drop policy if exists opportunity_bid_evidence_satisfactions_no_direct_delete on opportunity_bid_evidence_satisfactions;
create policy opportunity_bid_evidence_satisfactions_no_direct_delete
  on opportunity_bid_evidence_satisfactions for delete to authenticated using (false);

revoke all on opportunity_bid_evidence_satisfactions from public, anon, authenticated;
grant select, insert on opportunity_bid_evidence_satisfactions to service_role;

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
  satisfaction jsonb;
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
      'available', false, 'ready', false,
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
    select jsonb_build_object(
      'fileName', eo.original_filename,
      'mimeType', eo.mime_type,
      'sizeBytes', eo.size_bytes,
      'verificationStatus', eo.verification_status,
      'attachedAt', s.created_at,
      'packageRevision', s.package_revision,
      'bidPackageVersion', s.bid_package_version
    )
    into satisfaction
    from opportunity_bid_evidence_satisfactions s
    join evidence_links el
      on el.id = s.evidence_link_id
     and el.evidence_object_id = s.evidence_object_id
     and el.workspace_id = s.workspace_id
     and el.entity_type = 'opportunity'
     and el.entity_id = s.opportunity_id
    join evidence_objects eo
      on eo.id = s.evidence_object_id
     and eo.workspace_id = s.workspace_id
    where s.workspace_id = opp.workspace_id
      and s.opportunity_id = opp.id
      and s.package_revision = opp.version
      and s.bid_package_version = opp.bid_package_version
      and s.configuration_version_id = (config->>'configurationVersionId')::uuid
      and s.gate_requirement_id = (req->>'requirementId')::uuid
      and s.evidence_type_id = (req->>'evidenceTypeId')::uuid
      and el.relationship_type = req->>'relationshipType'
      and eo.upload_status = 'uploaded'
      and eo.scan_status = 'clean'
      and eo.verification_status = 'accepted'
      and nullif(trim(eo.original_filename), '') is not null
      and eo.size_bytes > 0
      and eo.checksum_sha256 ~ '^[0-9a-fA-F]{64}$'
    order by s.created_at, s.id
    limit 1;

    req := req || jsonb_build_object(
      'satisfied', satisfaction is not null,
      'evidence', satisfaction
    );
    requirements := requirements || jsonb_build_array(req);
    if (req->>'required')::boolean and (req->>'satisfied')::boolean is not true then
      missing := missing || jsonb_build_array(req);
    end if;
    satisfaction := null;
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
    'packageRevision', opp.version,
    'bidPackageVersion', opp.bid_package_version,
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
  requirement jsonb;
  relationship_key text := coalesce(p_relationship_type, '');
  evidence_id uuid := gen_random_uuid();
  evidence_link_uuid uuid;
  audit_uuid uuid;
  template_pack_version_uuid uuid;
  object_path text;
  request_hash text;
  claim record;
  result jsonb;
  file_name text := nullif(trim(coalesce(p_payload->>'fileName', '')), '');
  mime_type text := nullif(trim(coalesce(p_payload->>'mimeType', '')), '');
  size_bytes bigint;
  checksum text := lower(coalesce(p_payload->>'checksumSha256', ''));
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select id into actor_profile from user_profiles where user_id = actor and status = 'active' limit 1;
  if actor_profile is null then return jsonb_build_object('success', false, 'error', 'actor_profile_required'); end if;

  begin
    size_bytes := (p_payload->>'sizeBytes')::bigint;
  exception when others then
    return jsonb_build_object('success', false, 'error', 'invalid_evidence_file');
  end;
  if file_name is null
     or mime_type not in (
       'text/plain',
       'application/pdf',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     )
     or size_bytes is null or size_bytes <= 0 or size_bytes > 52428800
     or checksum !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('success', false, 'error', 'invalid_evidence_file');
  end if;

  select * into opp from opportunities where id = p_opportunity_id for update;
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
  if opp.bid_package_version is null then return jsonb_build_object('success', false, 'error', 'bid_package_revision_required'); end if;
  if opp.bid_submission_status not in ('submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held') then
    return jsonb_build_object('success', false, 'error', 'invalid_state');
  end if;

  readiness := public.p1_01b2_bid_submission_approval_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'error', 'configuration_unavailable');
  end if;
  select value into requirement
  from jsonb_array_elements(readiness->'evidenceRequirements') value
  where value->>'relationshipType' = relationship_key
  limit 1;
  if requirement is null then return jsonb_build_object('success', false, 'error', 'unknown_evidence_key'); end if;

  select source_template_pack_version_id into template_pack_version_uuid
  from config_configuration_versions
  where id = (readiness->>'configurationVersionId')::uuid;
  if template_pack_version_uuid is null then return jsonb_build_object('success', false, 'error', 'configuration_authority_incomplete'); end if;

  if exists (
    select 1 from opportunity_bid_evidence_satisfactions s
    where s.workspace_id = opp.workspace_id
      and s.opportunity_id = opp.id
      and s.package_revision = opp.version
      and s.bid_package_version = opp.bid_package_version
      and s.configuration_version_id = (readiness->>'configurationVersionId')::uuid
      and s.gate_requirement_id = (requirement->>'requirementId')::uuid
  ) then
    return jsonb_build_object('success', false, 'error', 'evidence_requirement_already_satisfied');
  end if;

  request_hash := md5(
    p_payload::text
    || p_expected_version::text
    || relationship_key
    || (requirement->>'requirementId')
  );
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.bid_approval_evidence.attach.v2', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  object_path := opp.workspace_id::text || '/opportunities/' || opp.id::text || '/bid-approval/' || evidence_id::text || '-' || regexp_replace(file_name, '[^a-zA-Z0-9._-]+', '-', 'g');
  insert into evidence_objects (
    id, workspace_id, project_id, bucket_id, object_path, original_filename, mime_type,
    size_bytes, checksum_sha256, uploaded_by, upload_status, scan_status, verification_status, uploaded_at
  ) values (
    evidence_id, opp.workspace_id, null, 'rybexos-evidence', object_path, file_name, mime_type,
    size_bytes, checksum, actor, 'uploaded', 'clean', 'accepted', now()
  );

  insert into evidence_links (
    workspace_id, project_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
  ) values (
    opp.workspace_id, null, evidence_id, 'opportunity', opp.id, relationship_key, actor
  ) returning id into evidence_link_uuid;

  audit_uuid := rybex_internal.append_audit_event(
    opp.workspace_id, null, 'opportunity', opp.id, p_command_id,
    'opportunity.bid_approval_evidence_attached', opp.bid_submission_status, opp.bid_submission_status,
    actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb,
    jsonb_build_object('evidenceId', evidence_id, 'relationshipType', relationship_key),
    jsonb_build_object(
      'configurationVersionId', readiness->>'configurationVersionId',
      'templatePackVersionId', template_pack_version_uuid,
      'gateKey', readiness->>'gateKey',
      'gateRequirementId', requirement->>'requirementId',
      'evidenceTypeId', requirement->>'evidenceTypeId',
      'packageRevision', opp.version,
      'bidPackageVersion', opp.bid_package_version,
      'actorProfileId', actor_profile
    )
  );

  insert into opportunity_bid_evidence_satisfactions (
    workspace_id, opportunity_id, evidence_link_id, evidence_object_id,
    configuration_version_id, template_pack_version_id, gate_requirement_id, evidence_type_id,
    package_revision, bid_package_version, actor_auth_user_id, actor_profile_id, audit_event_id, command_id
  ) values (
    opp.workspace_id, opp.id, evidence_link_uuid, evidence_id,
    (readiness->>'configurationVersionId')::uuid, template_pack_version_uuid,
    (requirement->>'requirementId')::uuid, (requirement->>'evidenceTypeId')::uuid,
    opp.version, opp.bid_package_version, actor, actor_profile, audit_uuid, p_command_id
  );

  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result || jsonb_build_object('success', true);
end;
$$;

grant execute on function public.p1_01b2_bid_submission_approval_readiness_v1(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.attach_opportunity_bid_approval_evidence_v1(uuid, text, jsonb, text, integer, text) to authenticated, service_role;

comment on table opportunity_bid_evidence_satisfactions is
  'Append-only authority linking accepted evidence to one configured requirement and one exact bid-package revision. Legacy evidence_links remain preserved but cannot satisfy CFG-RUNTIME-03 without this authority.';
