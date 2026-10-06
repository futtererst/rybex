-- Forward-only P1/CFG custody and scoped content-fitness acceptance.
-- No legacy row is certified or rewritten. D1/D2/D3 approved for disposable proof.
create table rybex_internal.opportunity_evidence_bindings (
 evidence_id uuid primary key references public.evidence_objects(id) on delete restrict,
 workspace_id uuid not null references public.workspaces(id) on delete restrict,
 opportunity_id uuid not null references public.opportunities(id) on delete restrict,
 qualification_id uuid references public.opportunity_qualifications(id) on delete restrict,
 purpose text not null check(purpose in ('decision_support','bid_approval')),
 relationship_type text not null,
 opportunity_version integer not null,
 bid_package_version text,
 configuration_version_id uuid references public.config_configuration_versions(id) on delete restrict,
 requirement_id uuid references public.config_gate_evidence_requirements(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 actor_profile_id uuid not null references public.user_profiles(id) on delete restrict,
 state text not null default 'staged' check(state in ('staged','accepted')),
 receipt_id uuid references rybex_internal.evidence_scan_receipts(id) on delete restrict,
 finalization_audit_id uuid references public.audit_events(id) on delete restrict,
 acceptance_audit_id uuid references public.audit_events(id) on delete restrict,
 accepted_evidence_version integer,
 authority_snapshot jsonb,
 accepted_command_id text,
 created_at timestamptz not null default now(), accepted_at timestamptz,
 check((state='staged' and receipt_id is null and finalization_audit_id is null and acceptance_audit_id is null and accepted_evidence_version is null and authority_snapshot is null and accepted_command_id is null and accepted_at is null)
 or (state='accepted' and receipt_id is not null and finalization_audit_id is not null and acceptance_audit_id is not null and accepted_evidence_version is not null and authority_snapshot is not null and accepted_command_id is not null and accepted_at is not null)),
 check((purpose='decision_support' and qualification_id is not null and length(trim(relationship_type))>0) or (purpose='bid_approval' and qualification_id is null and configuration_version_id is not null and requirement_id is not null and bid_package_version is not null))
);
alter table rybex_internal.opportunity_evidence_bindings enable row level security;
revoke all on rybex_internal.opportunity_evidence_bindings from public,anon,authenticated,service_role;

create function rybex_internal.enforce_opportunity_evidence_binding_v1() returns trigger language plpgsql security definer set search_path=public,rybex_internal,pg_temp as $$
declare ev evidence_objects%rowtype; rec rybex_internal.evidence_scan_receipts%rowtype; obj storage.objects%rowtype; opp opportunities%rowtype; fin audit_events%rowtype; att audit_events%rowtype;
begin
 if tg_op='DELETE' then raise exception 'opportunity_evidence_binding_immutable'; end if;
 if tg_op='UPDATE' and (old.state<>'staged' or new.state<>'accepted' or
 (to_jsonb(new)-array['state','receipt_id','finalization_audit_id','acceptance_audit_id','accepted_evidence_version','authority_snapshot','accepted_command_id','accepted_at']) is distinct from (to_jsonb(old)-array['state','receipt_id','finalization_audit_id','acceptance_audit_id','accepted_evidence_version','authority_snapshot','accepted_command_id','accepted_at'])) then raise exception 'opportunity_evidence_binding_immutable'; end if;
 if tg_op='INSERT' and new.state<>'staged' then raise exception 'opportunity_evidence_requires_staging'; end if;
 select * into opp from opportunities where id=new.opportunity_id;
 select * into ev from evidence_objects where id=new.evidence_id;
 if ev.id is null or opp.id is null or ev.workspace_id is distinct from new.workspace_id or opp.workspace_id is distinct from new.workspace_id or ev.project_id is not null or ev.uploaded_by is distinct from new.actor_id then raise exception 'opportunity_evidence_scope_mismatch'; end if;
 if not exists(select 1 from user_profiles p where p.id=new.actor_profile_id and p.user_id=new.actor_id and p.auth_user_id=new.actor_id and p.status='active') then raise exception 'opportunity_evidence_actor_mismatch'; end if;
 if new.qualification_id is not null and not exists(select 1 from opportunity_qualifications q where q.id=new.qualification_id and q.opportunity_id=new.opportunity_id and q.workspace_id=new.workspace_id) then raise exception 'opportunity_evidence_qualification_mismatch'; end if;
 if new.state='accepted' then
  select * into rec from rybex_internal.evidence_scan_receipts where id=new.receipt_id;
  select * into obj from storage.objects where id=rec.storage_object_id for share;
  select * into fin from audit_events where id=new.finalization_audit_id;
  select * into att from audit_events where id=new.acceptance_audit_id;
  if rec.id is null or rec.evidence_object_id is distinct from ev.id or rec.workspace_id is distinct from ev.workspace_id or rec.project_id is not null or rec.requested_by_auth_user_id is distinct from new.actor_id or rec.result<>'clean'
   or ev.upload_status<>'uploaded' or ev.scan_status<>'clean' or ev.verification_status<>'accepted' or ev.version is distinct from new.accepted_evidence_version or rec.expected_evidence_version+2<>ev.version
   or ev.checksum_sha256 is distinct from rec.sha256 or ev.size_bytes is distinct from rec.size_bytes
   or obj.id is null or obj.bucket_id is distinct from rec.bucket_id or obj.name is distinct from rec.object_path or obj.version is distinct from rec.storage_version or obj.updated_at is distinct from rec.storage_updated_at
   or fin.id is null or fin.action<>'evidence.upload_finalized' or fin.entity_id is distinct from ev.id or fin.workspace_id is distinct from ev.workspace_id or fin.actor_auth_user_id is distinct from new.actor_id or fin.metadata->>'scanReceiptId' is distinct from rec.id::text
   or att.id is null or att.workspace_id is distinct from new.workspace_id or att.entity_id is distinct from new.opportunity_id or att.actor_auth_user_id is distinct from new.actor_id or att.command_id is distinct from new.accepted_command_id
   or att.action not in ('opportunity.evidence_attached','opportunity.bid_approval_evidence_attached') or att.after_values->>'evidenceId' is distinct from ev.id::text
  then raise exception 'opportunity_evidence_provenance_invalid'; end if;
 end if;
 return new;
end; $$;
create trigger opportunity_evidence_binding_guard before insert or update or delete on rybex_internal.opportunity_evidence_bindings for each row execute function rybex_internal.enforce_opportunity_evidence_binding_v1();
revoke all on function rybex_internal.enforce_opportunity_evidence_binding_v1() from public,anon,authenticated,service_role;

create function rybex_internal.opportunity_evidence_is_authoritative_v1(p_evidence uuid,p_opportunity uuid,p_relationship text) returns boolean language sql stable security definer set search_path=public,rybex_internal,pg_temp as $$
 select exists(select 1 from rybex_internal.opportunity_evidence_bindings b
 join evidence_objects e on e.id=b.evidence_id and e.workspace_id=b.workspace_id
 join rybex_internal.evidence_scan_receipts r on r.id=b.receipt_id and r.evidence_object_id=e.id and r.workspace_id=b.workspace_id
 join storage.objects o on o.id=r.storage_object_id and o.bucket_id=r.bucket_id and o.name=r.object_path and o.version=r.storage_version and o.updated_at=r.storage_updated_at
 join audit_events f on f.id=b.finalization_audit_id and f.entity_id=e.id and f.metadata->>'scanReceiptId'=r.id::text and f.action='evidence.upload_finalized'
 join audit_events a on a.id=b.acceptance_audit_id and a.entity_id=b.opportunity_id and a.command_id=b.accepted_command_id and a.actor_auth_user_id=b.actor_id
 where b.evidence_id=p_evidence and b.opportunity_id=p_opportunity and b.relationship_type=p_relationship and b.state='accepted'
 and e.upload_status='uploaded' and e.scan_status='clean' and e.verification_status='accepted' and e.version=b.accepted_evidence_version and r.result='clean' and r.requested_by_auth_user_id=b.actor_id and e.checksum_sha256=r.sha256 and e.size_bytes=r.size_bytes);
$$;
revoke all on function rybex_internal.opportunity_evidence_is_authoritative_v1(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.create_opportunity_evidence_upload_intent_v1(p_opportunity_id uuid,p_purpose text,p_relationship_type text,p_expected_version integer,p_original_filename text,p_mime_type text,p_size_bytes bigint) returns jsonb language plpgsql security definer set search_path=public,rybex_internal,pg_temp as $$
declare opp opportunities%rowtype; actor uuid:=auth.uid(); prof user_profiles%rowtype; q uuid; config jsonb; req jsonb; result jsonb;
begin
 if actor is null then return jsonb_build_object('success',false,'error','unauthenticated'); end if;
 select * into opp from opportunities where id=p_opportunity_id for update;
 if not found then return jsonb_build_object('success',false,'error','not_found'); end if;
 select * into prof from user_profiles where user_id=actor and auth_user_id=actor and status='active';
 if prof.id is null or prof.active_workspace_id is distinct from opp.workspace_id or not public.is_active_workspace_member(opp.workspace_id) or not public.p1_01a_can_access_opportunity(opp.id) then return jsonb_build_object('success',false,'error','forbidden'); end if;
 if opp.version is distinct from p_expected_version then return jsonb_build_object('success',false,'error','concurrency_conflict'); end if;
 if p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>1048576 or p_mime_type is null or p_mime_type not in ('text/plain','application/pdf','image/png','image/jpeg','image/webp') or nullif(trim(p_original_filename),'') is null then return jsonb_build_object('success',false,'error','unsupported_evidence_file'); end if;
 if p_purpose='decision_support' then
  if nullif(trim(p_relationship_type),'') is null or not public.p1_01a_can_mutate_opportunity(opp.id) then return jsonb_build_object('success',false,'error','forbidden'); end if;
  select id into q from opportunity_qualifications where opportunity_id=opp.id and workspace_id=opp.workspace_id;
  if q is null then return jsonb_build_object('success',false,'error','qualification_required'); end if;
  config:=public.p1_01a_pricing_review_configuration_v1(opp.id);
  if coalesce((config->>'available')::boolean,false) then
   select value into req from jsonb_array_elements(config->'requiredEvidence') value where value->>'relationshipType'=p_relationship_type;
  end if;
  if p_relationship_type<>'qualification_decision_support' and req is null then return jsonb_build_object('success',false,'error','unknown_evidence_key'); end if;

 elsif p_purpose='bid_approval' then
  if p_mime_type not in ('text/plain','application/pdf') then return jsonb_build_object('success',false,'error','unsupported_evidence_file'); end if;
  if not exists(select 1 from workspace_memberships where workspace_id=opp.workspace_id and user_id=actor and status='active' and role in ('operations_leader','admin')) then return jsonb_build_object('success',false,'error','bid_evidence_authority_required'); end if;
  if opp.bid_package_version is null or opp.bid_submission_status not in ('submission_preparation','submission_blocked','ready_for_submission_approval','submission_approval_held') then return jsonb_build_object('success',false,'error','invalid_state'); end if;
  config:=public.p1_01b2_bid_submission_approval_readiness_v1(opp.id);
  if coalesce((config->>'available')::boolean,false) is not true then return jsonb_build_object('success',false,'error','configuration_unavailable'); end if;
  select value into req from jsonb_array_elements(config->'evidenceRequirements') value where value->>'relationshipType'=p_relationship_type;
  if req is null then return jsonb_build_object('success',false,'error','unknown_evidence_key'); end if;
 else return jsonb_build_object('success',false,'error','invalid_evidence_purpose'); end if;
 result:=public.create_evidence_upload_intent_v1('opportunity',opp.id,null,p_original_filename,p_mime_type);
 if coalesce((result->>'success')::boolean,false) is not true then return result; end if;
 insert into rybex_internal.opportunity_evidence_bindings(evidence_id,workspace_id,opportunity_id,qualification_id,purpose,relationship_type,opportunity_version,bid_package_version,configuration_version_id,requirement_id,actor_id,actor_profile_id)
 values((result->>'evidenceId')::uuid,opp.workspace_id,opp.id,q,p_purpose,p_relationship_type,opp.version,case when p_purpose='bid_approval' then opp.bid_package_version end,(config->>'configurationVersionId')::uuid,(req->>'requirementId')::uuid,actor,prof.id);
 return result;
end; $$;
revoke all on function public.create_opportunity_evidence_upload_intent_v1(uuid,text,text,integer,text,text,bigint) from public,anon,service_role;
grant execute on function public.create_opportunity_evidence_upload_intent_v1(uuid,text,text,integer,text,text,bigint) to authenticated;

CREATE OR REPLACE FUNCTION public.p1_01a_valid_qualification_evidence(opportunity_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      and eo.scan_status = 'clean' and rybex_internal.opportunity_evidence_is_authoritative_v1(eo.id,opportunity_uuid,el.relationship_type)
      and eo.checksum_sha256 is not null
  );
$function$
;

CREATE OR REPLACE FUNCTION public.p1_01a_pricing_review_readiness_v1(p_opportunity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        and eo.scan_status = 'clean' and rybex_internal.opportunity_evidence_is_authoritative_v1(eo.id,opp.id,el.relationship_type)
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
$function$
;

CREATE OR REPLACE FUNCTION public.p1_01b1_pursuit_authorization_readiness_v1(p_opportunity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
          and eo.scan_status = 'clean' and rybex_internal.opportunity_evidence_is_authoritative_v1(eo.id,opp.id,el.relationship_type)
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
$function$
;

CREATE OR REPLACE FUNCTION public.p1_01b2_bid_submission_approval_readiness_v1(p_opportunity_id uuid, p_as_of timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      and eo.scan_status = 'clean' and rybex_internal.opportunity_evidence_is_authoritative_v1(eo.id,opp.id,el.relationship_type)
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
$function$
;

CREATE OR REPLACE FUNCTION rybex_internal.validate_bid_evidence_satisfaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
     or not rybex_internal.opportunity_evidence_is_authoritative_v1(evidence.id,new.opportunity_id,link.relationship_type)
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
$function$
;

CREATE OR REPLACE FUNCTION public.attach_opportunity_decision_support_evidence_v1(p_opportunity_id uuid, p_payload jsonb, p_command_id text, p_expected_version integer, p_correlation_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'rybex_internal', 'pg_temp'
AS $function$
declare
  binding rybex_internal.opportunity_evidence_bindings%rowtype; ev evidence_objects%rowtype; receipt rybex_internal.evidence_scan_receipts%rowtype; stored storage.objects%rowtype; expected_evidence integer; finalization_id uuid; receipt_id uuid; acceptance_audit uuid;

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
  select * into opp from opportunities where id = p_opportunity_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  if not public.p1_01a_can_mutate_opportunity(p_opportunity_id) then return jsonb_build_object('success', false, 'error', 'forbidden'); end if;
  select * into qual from opportunity_qualifications where opportunity_id = opp.id;
  if not found then return jsonb_build_object('success', false, 'error', 'qualification_required'); end if;


  if p_payload->>'evidenceId' is null or p_payload->>'expectedEvidenceVersion' is null then return jsonb_build_object('success',false,'error','evidence_reference_required'); end if;
  begin evidence_id := (p_payload->>'evidenceId')::uuid; expected_evidence := (p_payload->>'expectedEvidenceVersion')::integer; exception when others then return jsonb_build_object('success',false,'error','invalid_evidence_reference'); end;
  select * into binding from rybex_internal.opportunity_evidence_bindings b where b.evidence_id= (p_payload->>'evidenceId')::uuid for update;
  select * into ev from evidence_objects where id=evidence_id for update;
  if binding.evidence_id is null or binding.opportunity_id is distinct from opp.id or binding.workspace_id is distinct from opp.workspace_id or binding.actor_id is distinct from actor or binding.purpose is distinct from 'decision_support' or binding.relationship_type is distinct from coalesce(nullif(p_payload->>'relationshipType',''),'qualification_decision_support') or ev.uploaded_by is distinct from actor then return jsonb_build_object('success',false,'error','evidence_scope_mismatch'); end if;
  if binding.opportunity_version is distinct from opp.version or opp.version is distinct from p_expected_version then return jsonb_build_object('success',false,'error','concurrency_conflict'); end if;
  if not public.is_active_workspace_member(opp.workspace_id) then return jsonb_build_object('success',false,'error','forbidden'); end if;
  if binding.state='accepted' then
    if binding.accepted_command_id=p_command_id and expected_evidence=binding.accepted_evidence_version-1 and rybex_internal.opportunity_evidence_is_authoritative_v1(ev.id,opp.id,binding.relationship_type) then
      select ci.result_payload into result from command_idempotency ci where ci.workspace_id=opp.workspace_id and ci.command_id=p_command_id and ci.actor_user_id=actor and ci.request_hash=md5(jsonb_build_array(p_payload,p_expected_version,binding.relationship_type,actor)::text) and ci.result_status='completed';
      if result is not null then return result || jsonb_build_object('success',true,'replayed',true); end if;
    end if;
    return jsonb_build_object('success',false,'error','evidence_already_accepted');
  end if;
  if ev.version is distinct from expected_evidence then return jsonb_build_object('success',false,'error','concurrency_conflict'); end if;
  if ev.upload_status<>'uploaded' or ev.scan_status<>'clean' or ev.verification_status<>'pending' then return jsonb_build_object('success',false,'error','evidence_not_finalized'); end if;
  select a.id, (a.metadata->>'scanReceiptId')::uuid into finalization_id, receipt_id from audit_events a where a.entity_id=ev.id and a.workspace_id=ev.workspace_id and a.actor_auth_user_id=actor and a.action='evidence.upload_finalized' order by a.created_at desc limit 1;
  select * into receipt from rybex_internal.evidence_scan_receipts where id=receipt_id;
  select * into stored from storage.objects where id=receipt.storage_object_id for share;
  if finalization_id is null or receipt.id is null or receipt.evidence_object_id is distinct from ev.id or receipt.requested_by_auth_user_id is distinct from actor or receipt.result<>'clean' or receipt.expected_evidence_version+1<>ev.version or receipt.sha256 is distinct from ev.checksum_sha256 or receipt.size_bytes is distinct from ev.size_bytes or stored.id is null or stored.version is distinct from receipt.storage_version or stored.updated_at is distinct from receipt.storage_updated_at then return jsonb_build_object('success',false,'error','evidence_provenance_invalid'); end if;

  request_hash := md5(jsonb_build_array(p_payload,p_expected_version,binding.relationship_type,actor)::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.evidence.attach.v1', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;


  update evidence_objects set verification_status='accepted',version=version+1 where id=evidence_id;
  insert into evidence_links (
    workspace_id, project_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
  )
  values (
    opp.workspace_id, null, evidence_id, 'opportunity_qualification', qual.id, binding.relationship_type, actor
  );

  acceptance_audit := rybex_internal.append_audit_event(opp.workspace_id, null, 'opportunity', opp.id, p_command_id, 'opportunity.evidence_attached', opp.lifecycle_status, opp.lifecycle_status, actor, coalesce(p_correlation_id, p_command_id), '{}'::jsonb, jsonb_build_object('evidenceId', evidence_id, 'qualificationId', qual.id, 'relationshipType', binding.relationship_type), '{}'::jsonb);

  update rybex_internal.opportunity_evidence_bindings b set state='accepted',receipt_id=receipt.id,finalization_audit_id=finalization_id,acceptance_audit_id=acceptance_audit,accepted_evidence_version=ev.version+1,accepted_command_id=p_command_id,accepted_at=now(),authority_snapshot=jsonb_build_object('actor',actor,'profile',binding.actor_profile_id,'workspace',opp.workspace_id,'purpose',binding.purpose,'configurationVersion',binding.configuration_version_id,'opportunityVersion',opp.version,'bidPackageVersion',binding.bid_package_version,'role',(select wm.role from workspace_memberships wm where wm.workspace_id=opp.workspace_id and wm.user_id=actor and wm.status='active'),'fitnessAttestation',true,'workflowApproval',false)
  where b.evidence_id=ev.id;

  perform rybex_internal.append_domain_event(opp.workspace_id, null, 'opportunity', opp.id, opp.version, 'opportunity.evidence_attached', 1, p_command_id, coalesce(p_correlation_id, p_command_id), actor, jsonb_build_object('evidenceId', evidence_id, 'qualificationId', qual.id, 'relationshipType', binding.relationship_type));

  result := public.p1_01a_get_opportunity_v1(opp.id);
  perform rybex_internal.complete_command(opp.workspace_id, p_command_id, result);
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.attach_opportunity_bid_approval_evidence_v1(p_opportunity_id uuid, p_relationship_type text, p_payload jsonb, p_command_id text, p_expected_version integer, p_correlation_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'rybex_internal', 'pg_temp'
AS $function$
declare
  binding rybex_internal.opportunity_evidence_bindings%rowtype; ev evidence_objects%rowtype; receipt rybex_internal.evidence_scan_receipts%rowtype; stored storage.objects%rowtype; expected_evidence integer; finalization_id uuid; receipt_id uuid; acceptance_audit uuid;

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

  if exists(select 1 from opportunity_bid_evidence_satisfactions x where x.workspace_id=opp.workspace_id and x.opportunity_id=opp.id and x.package_revision=opp.version and x.bid_package_version=opp.bid_package_version and x.configuration_version_id=(readiness->>'configurationVersionId')::uuid and x.gate_requirement_id=(requirement->>'requirementId')::uuid and x.command_id is distinct from p_command_id) then return jsonb_build_object('success',false,'error','evidence_requirement_already_satisfied'); end if;
  if p_payload->>'evidenceId' is null or p_payload->>'expectedEvidenceVersion' is null then return jsonb_build_object('success',false,'error','evidence_reference_required'); end if;
  begin evidence_id := (p_payload->>'evidenceId')::uuid; expected_evidence := (p_payload->>'expectedEvidenceVersion')::integer; exception when others then return jsonb_build_object('success',false,'error','invalid_evidence_reference'); end;
  select * into binding from rybex_internal.opportunity_evidence_bindings b where b.evidence_id= (p_payload->>'evidenceId')::uuid for update;
  select * into ev from evidence_objects where id=evidence_id for update;
  if binding.evidence_id is null or binding.opportunity_id is distinct from opp.id or binding.workspace_id is distinct from opp.workspace_id or binding.actor_id is distinct from actor or binding.purpose is distinct from 'bid_approval' or binding.relationship_type is distinct from relationship_key or ev.uploaded_by is distinct from actor then return jsonb_build_object('success',false,'error','evidence_scope_mismatch'); end if;
  if binding.opportunity_version is distinct from opp.version or opp.version is distinct from p_expected_version then return jsonb_build_object('success',false,'error','concurrency_conflict'); end if;
  if not public.is_active_workspace_member(opp.workspace_id) then return jsonb_build_object('success',false,'error','forbidden'); end if;
  readiness:=public.p1_01b2_bid_submission_approval_readiness_v1(opp.id);
  if coalesce((readiness->>'available')::boolean,false) is not true or binding.configuration_version_id is distinct from (readiness->>'configurationVersionId')::uuid or binding.bid_package_version is distinct from opp.bid_package_version then return jsonb_build_object('success',false,'error','evidence_configuration_mismatch'); end if;
  if binding.state='accepted' then
    if binding.accepted_command_id=p_command_id and expected_evidence=binding.accepted_evidence_version-1 and rybex_internal.opportunity_evidence_is_authoritative_v1(ev.id,opp.id,binding.relationship_type) then
      select ci.result_payload into result from command_idempotency ci where ci.workspace_id=opp.workspace_id and ci.command_id=p_command_id and ci.actor_user_id=actor and ci.request_hash=md5(jsonb_build_array(p_payload,p_expected_version,binding.relationship_type,actor)::text) and ci.result_status='completed';
      if result is not null then return result || jsonb_build_object('success',true,'replayed',true); end if;
    end if;
    return jsonb_build_object('success',false,'error','evidence_already_accepted');
  end if;
  if ev.version is distinct from expected_evidence then return jsonb_build_object('success',false,'error','concurrency_conflict'); end if;
  if ev.upload_status<>'uploaded' or ev.scan_status<>'clean' or ev.verification_status<>'pending' then return jsonb_build_object('success',false,'error','evidence_not_finalized'); end if;
  select a.id, (a.metadata->>'scanReceiptId')::uuid into finalization_id, receipt_id from audit_events a where a.entity_id=ev.id and a.workspace_id=ev.workspace_id and a.actor_auth_user_id=actor and a.action='evidence.upload_finalized' order by a.created_at desc limit 1;
  select * into receipt from rybex_internal.evidence_scan_receipts where id=receipt_id;
  select * into stored from storage.objects where id=receipt.storage_object_id for share;
  if finalization_id is null or receipt.id is null or receipt.evidence_object_id is distinct from ev.id or receipt.requested_by_auth_user_id is distinct from actor or receipt.result<>'clean' or receipt.expected_evidence_version+1<>ev.version or receipt.sha256 is distinct from ev.checksum_sha256 or receipt.size_bytes is distinct from ev.size_bytes or stored.id is null or stored.version is distinct from receipt.storage_version or stored.updated_at is distinct from receipt.storage_updated_at then return jsonb_build_object('success',false,'error','evidence_provenance_invalid'); end if;

  if binding.configuration_version_id is distinct from (readiness->>'configurationVersionId')::uuid or binding.requirement_id is distinct from (requirement->>'requirementId')::uuid or binding.bid_package_version is distinct from opp.bid_package_version then return jsonb_build_object('success',false,'error','evidence_configuration_mismatch'); end if;
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

  request_hash := md5(jsonb_build_array(p_payload,p_expected_version,binding.relationship_type,actor)::text);
  select * into claim
  from rybex_internal.claim_or_replay_command(opp.workspace_id, p_command_id, 'opportunity.bid_approval_evidence.attach.v2', 'opportunity', opp.id, request_hash, actor, coalesce(p_correlation_id, p_command_id));
  if claim.action = 'replay' then return claim.existing_result || jsonb_build_object('success', true, 'replayed', true); end if;
  if claim.action = 'mismatch' then return jsonb_build_object('success', false, 'error', 'idempotency_mismatch'); end if;


  update evidence_objects set verification_status='accepted',version=version+1 where id=evidence_id;
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


  update rybex_internal.opportunity_evidence_bindings b set state='accepted',receipt_id=receipt.id,finalization_audit_id=finalization_id,acceptance_audit_id=audit_uuid,accepted_evidence_version=ev.version+1,accepted_command_id=p_command_id,accepted_at=now(),authority_snapshot=jsonb_build_object('actor',actor,'profile',binding.actor_profile_id,'workspace',opp.workspace_id,'purpose',binding.purpose,'configurationVersion',binding.configuration_version_id,'opportunityVersion',opp.version,'bidPackageVersion',binding.bid_package_version,'role',(select wm.role from workspace_memberships wm where wm.workspace_id=opp.workspace_id and wm.user_id=actor and wm.status='active'),'fitnessAttestation',true,'workflowApproval',false)
  where b.evidence_id=ev.id;

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
$function$
;
