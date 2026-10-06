-- P1-01A acceptance remediation
-- Bounded to failed acceptance IDs DB-007, DB-009, DB-027 and BR-005/006/008/010/012/017.
-- Does not add decisions, pursuit outcomes, awards, projects, work packages, scheduling, or P1-01B behavior.

drop policy if exists opportunities_select_active_workspace_member on opportunities;

revoke insert, update, delete on opportunities from authenticated;
revoke insert, update, delete on opportunity_assignments from authenticated;
revoke insert, update, delete on opportunity_qualifications from authenticated;

drop policy if exists opportunities_p1_no_direct_delete on opportunities;
create policy opportunities_p1_no_direct_delete
  on opportunities
  for delete
  to authenticated
  using (false);

drop policy if exists opportunity_assignments_p1_no_direct_delete on opportunity_assignments;
create policy opportunity_assignments_p1_no_direct_delete
  on opportunity_assignments
  for delete
  to authenticated
  using (false);

drop policy if exists opportunity_qualifications_p1_no_direct_delete on opportunity_qualifications;
create policy opportunity_qualifications_p1_no_direct_delete
  on opportunity_qualifications
  for delete
  to authenticated
  using (false);

create or replace function public.p1_01a_can_access_opportunity(opportunity_uuid uuid)
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
      and (
        wm.role in ('business_development_lead','executive','operations_leader','admin','read_only_auditor')
        or exists (
          select 1
          from opportunity_assignments oa
          where oa.workspace_id = o.workspace_id
            and oa.opportunity_id = o.id
            and oa.user_id = auth.uid()
            and oa.status = 'active'
        )
      )
  );
$$;

create or replace function public.p1_01a_can_mutate_opportunity(opportunity_uuid uuid)
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
      and o.lifecycle_status <> 'decision_required'
      and (
        wm.role in ('business_development_lead','operations_leader','admin')
        or exists (
          select 1
          from opportunity_assignments oa
          where oa.workspace_id = o.workspace_id
            and oa.opportunity_id = o.id
            and oa.user_id = auth.uid()
            and oa.status = 'active'
            and oa.assignment_type in ('owner','contributor','estimator')
        )
      )
  );
$$;

create or replace function public.p1_01a_can_manage_opportunity_assignments(opportunity_uuid uuid)
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
      and (
        wm.role in ('business_development_lead','operations_leader','admin')
        or exists (
          select 1
          from opportunity_assignments oa
          where oa.workspace_id = o.workspace_id
            and oa.opportunity_id = o.id
            and oa.user_id = auth.uid()
            and oa.status = 'active'
            and oa.assignment_type = 'owner'
        )
      )
  );
$$;

create or replace function public.p1_01a_current_opportunity_role(opportunity_uuid uuid)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select wm.role
      from opportunities o
      join workspace_memberships wm
        on wm.workspace_id = o.workspace_id
       and wm.user_id = auth.uid()
       and wm.status = 'active'
      where o.id = opportunity_uuid
      limit 1
    ),
    'none'
  );
$$;

create or replace function public.p1_01a_valid_qualification_evidence(opportunity_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from opportunities o
    join opportunity_qualifications q
      on q.opportunity_id = o.id
     and q.workspace_id = o.workspace_id
    join evidence_links el
      on el.workspace_id = o.workspace_id
     and el.entity_type = 'opportunity_qualification'
     and el.entity_id = q.id
     and el.relationship_type = 'qualification_decision_support'
    join evidence_objects eo
      on eo.id = el.evidence_object_id
     and eo.workspace_id = o.workspace_id
    where o.id = opportunity_uuid
      and eo.upload_status = 'uploaded'
      and eo.scan_status = 'clean'
      and eo.checksum_sha256 is not null
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
  actor_role text;
begin
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if not public.p1_01a_can_access_opportunity(opp.id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  actor_role := public.p1_01a_current_opportunity_role(opp.id);

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

  return jsonb_build_object(
    'success', true,
    'opportunity', to_jsonb(opp),
    'qualification', coalesce(qualification, '{}'::jsonb),
    'assignments', coalesce(assignments, '[]'::jsonb),
    'evidence', coalesce(evidence, '[]'::jsonb),
    'evidenceReady', public.p1_01a_valid_qualification_evidence(opp.id),
    'workspaceRole', actor_role,
    'accessMode', case when actor_role = 'read_only_auditor' then 'read_only' else 'editable' end
  );
end;
$$;

create or replace function public.create_opportunity_v1(
  p_payload jsonb,
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
  workspace_uuid uuid := public.p1_01a_current_workspace_id();
  org_uuid uuid;
  actor_role text;
  profile_uuid uuid;
  opp_id uuid := gen_random_uuid();
  stable_key text;
  fp text;
  duplicate_count integer;
  duplicate_candidates jsonb;
  owner_uuid uuid;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  if workspace_uuid is null then return jsonb_build_object('success', false, 'error', 'workspace_required'); end if;
  actor_role := public.current_workspace_role(workspace_uuid);
  if actor_role not in ('business_development_lead','operations_leader','admin') then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select organization_id into org_uuid from workspaces where id = workspace_uuid;
  select id into profile_uuid from user_profiles where user_id = actor limit 1;
  owner_uuid := coalesce(nullif(p_payload->>'ownerUserId', '')::uuid, actor);

  if coalesce(p_payload->>'name', '') = '' or coalesce(p_payload->>'customerGc', '') = '' or coalesce(p_payload->>'projectType', '') = '' or coalesce(p_payload->>'location', '') = '' or coalesce(p_payload->>'scopeSummary', '') = '' then
    return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Opportunity name, customer/GC, project type, location, and scope summary are required.');
  end if;

  fp := public.p1_01a_duplicate_fingerprint(p_payload->>'customerGc', p_payload->>'name', p_payload->>'location');
  select count(*) into duplicate_count
  from opportunities
  where workspace_id = workspace_uuid
    and duplicate_fingerprint = fp;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'stableKey', stable_opportunity_key,
    'name', name,
    'customerGc', customer_gc,
    'location', opportunity_location,
    'lifecycleStatus', lifecycle_status
  ) order by created_at desc), '[]'::jsonb)
  into duplicate_candidates
  from opportunities
  where workspace_id = workspace_uuid
    and duplicate_fingerprint = fp;

  if duplicate_count > 0 and coalesce((p_payload->>'duplicateConfirmed')::boolean, false) = false then
    return jsonb_build_object(
      'success', false,
      'error', 'duplicate_warning_requires_confirmation',
      'duplicateCount', duplicate_count,
      'duplicateCandidates', duplicate_candidates
    );
  end if;

  stable_key := coalesce(nullif(p_payload->>'stableOpportunityKey', ''), 'opp-' || replace(substr(opp_id::text, 1, 8), '-', ''));
  request_hash := md5(p_payload::text);

  select * into claim
  from rybex_internal.claim_or_replay_command(workspace_uuid, p_command_id, 'opportunity.create.v1', 'opportunity', opp_id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  insert into opportunities (
    id, organization_id, workspace_id, stable_opportunity_key, name, gc_client, customer_gc,
    project_type, project_location, opportunity_location, scope_summary, estimated_value,
    anticipated_start, bid_due_date, owner_user_id, lifecycle_status, status,
    intake_complete, qualification_complete, decision_readiness_status, duplicate_fingerprint,
    duplicate_confirmed, created_by, updated_by
  )
  values (
    opp_id, org_uuid, workspace_uuid, stable_key, trim(p_payload->>'name'), trim(p_payload->>'customerGc'), trim(p_payload->>'customerGc'),
    trim(p_payload->>'projectType'), trim(p_payload->>'location'), trim(p_payload->>'location'), trim(p_payload->>'scopeSummary'),
    nullif(p_payload->>'estimatedValue', '')::numeric,
    nullif(p_payload->>'anticipatedStart', '')::date,
    nullif(p_payload->>'bidDueDate', '')::date,
    owner_uuid, 'qualifying', 'under_review',
    true, false, 'not_ready', fp, coalesce((p_payload->>'duplicateConfirmed')::boolean, false),
    profile_uuid, profile_uuid
  );

  insert into opportunity_assignments (workspace_id, opportunity_id, user_id, assignment_type, created_by)
  values (workspace_uuid, opp_id, owner_uuid, 'owner', actor);

  if duplicate_count > 0 then
    perform rybex_internal.append_audit_event(
      workspace_uuid, null, 'opportunity', opp_id, p_command_id, 'opportunity.duplicate_confirmed',
      null, 'qualifying', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb,
      jsonb_build_object(
        'duplicateCount', duplicate_count,
        'duplicateCandidateId', nullif(p_payload->>'duplicateCandidateId', ''),
        'duplicateCandidates', duplicate_candidates
      ),
      '{}'::jsonb
    );
  end if;

  perform rybex_internal.append_audit_event(workspace_uuid, null, 'opportunity', opp_id, p_command_id, 'opportunity.created', null, 'qualifying', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, p_payload, '{}'::jsonb);
  perform rybex_internal.append_domain_event(workspace_uuid, null, 'opportunity', opp_id, 1, 'opportunity.created', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, p_payload);

  result := public.p1_01a_get_opportunity_v1(opp_id);
  perform rybex_internal.complete_command(workspace_uuid, p_command_id, result);
  return result;
end;
$$;

create or replace function public.update_opportunity_v1(
  p_opportunity_id uuid,
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
  profile_uuid uuid;
  opp opportunities%rowtype;
  next_version integer;
  fp text;
  request_hash text;
  claim record;
  intake_ready boolean;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;

  if coalesce(p_payload->>'name', opp.name, '') = ''
     or coalesce(p_payload->>'customerGc', opp.customer_gc, opp.gc_client, '') = ''
     or coalesce(p_payload->>'projectType', opp.project_type, '') = ''
     or coalesce(p_payload->>'location', opp.opportunity_location, opp.project_location, '') = ''
     or coalesce(p_payload->>'scopeSummary', opp.scope_summary, '') = '' then
    return jsonb_build_object('success', false, 'error', 'validation_failed');
  end if;

  request_hash := md5(p_payload::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.update.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  select id into profile_uuid from user_profiles where user_id = actor limit 1;
  fp := public.p1_01a_duplicate_fingerprint(
    coalesce(nullif(p_payload->>'customerGc', ''), opp.customer_gc, opp.gc_client),
    coalesce(nullif(p_payload->>'name', ''), opp.name),
    coalesce(nullif(p_payload->>'location', ''), opp.opportunity_location, opp.project_location)
  );
  intake_ready := true;
  next_version := opp.version + 1;

  update opportunities
  set name = coalesce(nullif(trim(p_payload->>'name'), ''), name),
      customer_gc = coalesce(nullif(trim(p_payload->>'customerGc'), ''), customer_gc),
      gc_client = coalesce(nullif(trim(p_payload->>'customerGc'), ''), gc_client),
      project_type = coalesce(nullif(trim(p_payload->>'projectType'), ''), project_type),
      opportunity_location = coalesce(nullif(trim(p_payload->>'location'), ''), opportunity_location),
      project_location = coalesce(nullif(trim(p_payload->>'location'), ''), project_location),
      scope_summary = coalesce(nullif(trim(p_payload->>'scopeSummary'), ''), scope_summary),
      estimated_value = coalesce(nullif(p_payload->>'estimatedValue', '')::numeric, estimated_value),
      anticipated_start = coalesce(nullif(p_payload->>'anticipatedStart', '')::date, anticipated_start),
      bid_due_date = coalesce(nullif(p_payload->>'bidDueDate', '')::date, bid_due_date),
      duplicate_fingerprint = fp,
      intake_complete = intake_ready,
      lifecycle_status = case when lifecycle_status = 'draft' and intake_ready then 'qualifying' else lifecycle_status end,
      status = case when lifecycle_status = 'draft' and intake_ready then 'under_review' else status end,
      version = next_version,
      updated_by = profile_uuid,
      updated_at = now()
  where id = opp.id;

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.updated', opp.lifecycle_status, case when opp.lifecycle_status = 'draft' then 'qualifying' else opp.lifecycle_status end, actor, coalesce(p_correlation_id, p_command_id), to_jsonb(opp), p_payload, '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.updated', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, p_payload);
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

create or replace function public.attach_opportunity_decision_support_evidence_v1(
  p_opportunity_id uuid,
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
  opp opportunities%rowtype;
  qual opportunity_qualifications%rowtype;
  evidence_id uuid := gen_random_uuid();
  object_path text;
  request_hash text;
  claim record;
  result jsonb;
begin
  if actor is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;
  select * into opp from opportunities where id = p_opportunity_id;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  select * into qual from opportunity_qualifications where opportunity_id = opp.id;
  if not found then return jsonb_build_object('success', false, 'error', 'qualification_required'); end if;

  request_hash := md5(p_payload::text || p_expected_version::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.evidence.attach.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;

  object_path := opp.workspace_id::text || '/opportunities/' || opp.id::text || '/qualification-decision-support/' || evidence_id::text || '-' || regexp_replace(coalesce(p_payload->>'fileName', 'decision-support.txt'), '[^a-zA-Z0-9._-]+', '-', 'g');

  insert into evidence_objects (
    id, workspace_id, project_id, bucket_id, object_path, original_filename, mime_type,
    size_bytes, checksum_sha256, uploaded_by, upload_status, scan_status, verification_status, uploaded_at
  )
  values (
    evidence_id, opp.workspace_id, null, 'rybexos-evidence', object_path,
    coalesce(nullif(p_payload->>'fileName', ''), 'decision-support.txt'),
    coalesce(nullif(p_payload->>'mimeType', ''), 'text/plain'),
    coalesce(nullif(p_payload->>'sizeBytes', '')::bigint, 1),
    coalesce(nullif(p_payload->>'checksumSha256', ''), md5(object_path)),
    actor, 'uploaded', 'clean', 'accepted', now()
  );

  insert into evidence_links (
    workspace_id, project_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
  )
  values (
    opp.workspace_id, null, evidence_id, 'opportunity_qualification', qual.id, 'qualification_decision_support', actor
  );

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.evidence_attached', opp.lifecycle_status, opp.lifecycle_status, actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('evidenceId', evidence_id, 'qualificationId', qual.id, 'relationshipType', 'qualification_decision_support'), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, opp.version, 'opportunity.evidence_attached', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('evidenceId', evidence_id, 'qualificationId', qual.id, 'relationshipType', 'qualification_decision_support'));

  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
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
  if opp.version <> p_expected_version then return jsonb_build_object('success', false, 'error', 'concurrency_conflict', 'currentVersion', opp.version); end if;
  if opp.owner_user_id is null or not opp.intake_complete then return jsonb_build_object('success', false, 'error', 'validation_failed', 'message', 'Complete intake and owner before submitting.'); end if;
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

  perform rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.submitted_for_decision', opp.lifecycle_status, 'decision_required', actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('qualificationId', qual.id), '{}'::jsonb);
  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, next_version, 'opportunity.submitted_for_decision', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('qualificationId', qual.id));
  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$$;

grant execute on function public.p1_01a_current_opportunity_role(uuid) to authenticated, service_role;
grant execute on function public.p1_01a_valid_qualification_evidence(uuid) to authenticated, service_role;
grant execute on function public.attach_opportunity_decision_support_evidence_v1(uuid, jsonb, text, integer, text) to authenticated;
