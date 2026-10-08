-- UNAPPLIED synthetic-only forward candidate for submission readiness.
-- Aligns the read-only projection with the server-enforced submit candidate.
begin;
create or replace function public.d5o_discover_trial_triage_preflight_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; authority jsonb; cfg jsonb;
  w public.d5o_work_records%rowtype; d public.d5o_discover_capture_drafts%rowtype;
  rv public.d5o_trial_duplicate_reviews%rowtype;
  identity_current boolean; owner_current boolean; review_current boolean;
  candidate_ids uuid[]; legacy_hold boolean; route_ready boolean; submit_right boolean;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity'
    or w.owner_profile_id is distinct from (actor->>'profile')::uuid
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or d.capture_permission_digest is distinct from authority->>'permissionDigest'
    or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'forbidden'; end if;
  select exists(select 1 from public.d5o_trial_accounts a
      join public.d5o_trial_sites s on s.id=d.site_id and s.account_id=a.id
        and s.workspace_id=a.workspace_id and s.configuration_tenant_id=a.configuration_tenant_id
        and s.organization_id=a.organization_id
      where a.id=d.account_id and a.workspace_id=p_workspace_id
        and a.configuration_tenant_id=w.configuration_tenant_id
        and a.organization_id=(authority->>'organizationId')::uuid
        and a.status='trial_active' and s.status='trial_active'
        and a.fixture_manifest_digest is not null
        and s.fixture_manifest_digest=a.fixture_manifest_digest)
    into identity_current;
  owner_current:=rybex_internal.d5o_trial_triage_owner_eligible(
    p_workspace_id,w.configuration_version_id,d.triage_owner_profile_id);
  candidate_ids:=rybex_internal.d5o_trial_duplicate_candidate_ids(
    p_workspace_id,w.configuration_tenant_id,w.id,d.account_id,d.customer_context,w.title);
  lock table public.opportunities in share mode;
  select exists(select 1 from public.opportunities o where o.workspace_id=p_workspace_id
    and o.organization_id=(authority->>'organizationId')::uuid
    and (lower(btrim(o.gc_client))=lower(btrim(d.customer_context))
      or lower(btrim(o.name))=lower(btrim(w.title)))) into legacy_hold;
  select * into rv from public.d5o_trial_duplicate_reviews where work_id=w.id for share;
  review_current:=rv.work_id is not null and rv.disposition='distinct'
    and rv.reviewed_work_version=w.record_version
    and rv.compared_work_ids=candidate_ids and not legacy_hold
    and exists(select 1 from public.config_permission_definitions permission
      where permission.id=rv.permission_id and permission.status='active'
        and permission.configuration_version_id=w.configuration_version_id
        and permission.permission_key='discover.resolve_duplicate'
        and rv.permission_digest=rybex_internal.d5o_m1_digest(to_jsonb(permission)));
  select exists(select 1 from public.d5o_trial_triage_route_policies p
    where p.configuration_version_id=w.configuration_version_id and p.status='trial_active'
      and p.rule_digest=rybex_internal.d5o_m1_digest(p.rule_json)
      and p.rule_json=jsonb_build_object('ownerRole','business_development_lead',
        'submittedState','pending_owner_acceptance','acceptedState','triage_assigned',
        'returnedState','intake_draft','qualification',false,'spending',false))
    into route_ready;
  select exists(select 1 from public.config_permission_definitions p
    where p.configuration_version_id=w.configuration_version_id
      and p.permission_key='discover.submit_triage'
      and p.permission_scope='organization' and p.status='active'
      and p.default_grant_rule_json-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'='{}'::jsonb
      and jsonb_typeof(p.default_grant_rule_json->'workspaceRoles')='array'
      and p.default_grant_rule_json->>'organizationScope'='same'
      and p.default_grant_rule_json->'verifiedEmployeeRequired'='true'::jsonb
      and p.default_grant_rule_json->'workspaceRoles' ? (actor->>'workspace_role')
      and w.created_by=auth.uid())
    into submit_right;  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'lifecycleState',w.lifecycle_state,'checkedAt',now(),
    'facts',jsonb_build_object(
      'identityLinked',d.account_id is not null and d.site_id is not null,
      'identityCurrent',identity_current,
      'sourceRecorded',d.source_kind is not null,
      'needRecorded',d.need_summary is not null,
      'triageOwnerSelected',d.triage_owner_profile_id is not null,
      'triageOwnerCurrent',owner_current,
      'possibleDuplicate',coalesce(array_length(candidate_ids,1),0)>0 or legacy_hold,
      'duplicateReviewCurrent',review_current,
      'authorDisposition',d.duplicate_disposition),
    'blockers',to_jsonb(array_remove(array[
      case when w.lifecycle_state<>'intake_draft' then 'not_intake_draft' end,
      case when not identity_current then 'account_site_link_required' end,
      case when d.source_kind is null then 'source_required' end,
      case when d.source_reference is null then 'source_reference_required' end,
      case when d.work_type is null then 'work_type_required' end,
      case when d.response_due_on is null or d.response_due_on<current_date then 'response_due_required' end,
      case when d.need_summary is null then 'customer_need_required' end,
      case when not owner_current then 'triage_owner_required' end,
      case when legacy_hold then 'legacy_match_requires_source_review' end,
      case when not review_current then 'independent_duplicate_review_required' end,
      case when not route_ready then 'triage_owner_routing_not_commissioned' end,
      case when not submit_right then 'triage_submission_not_commissioned' end
    ]::text[],null)));
end $$;
commit;

