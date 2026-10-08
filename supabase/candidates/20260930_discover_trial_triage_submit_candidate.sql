-- UNAPPLIED synthetic-only submission candidate. Requires owner option and
-- frozen transfer foundation. No qualification, spending or production route.
begin;
create function public.d5o_submit_discover_triage_v1(
  p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; authority jsonb; cfg jsonb;
  w public.d5o_work_records%rowtype; d public.d5o_discover_capture_drafts%rowtype;
  review public.d5o_trial_duplicate_reviews%rowtype;
  permission public.config_permission_definitions%rowtype;
  policy public.d5o_trial_triage_route_policies%rowtype;
  cached public.command_idempotency%rowtype;
  candidates uuid[]; legacy_hold boolean; rule jsonb;
  request_hash text; snapshot jsonb; snapshot_digest text;
  before_row jsonb; events jsonb; result jsonb; submission_id uuid;
  revision integer; acceptance_deadline timestamptz;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_expected_version is null or p_expected_version<1
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_command'; end if;
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity'
    or w.owner_profile_id is distinct from (actor->>'profile')::uuid
    or w.created_by<>auth.uid()
    or exists(select 1 from public.d5o_work_sources s where s.work_id=w.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,
    w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(
    p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or w.owner_profile_id is distinct from (authority->>'actorProfileId')::uuid then
    raise exception 'pinned_configuration_changed'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=w.configuration_version_id
      and permission_key='discover.submit_triage'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'triage_submit_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? (actor->>'workspace_role')) then
    raise exception 'triage_submit_permission_denied'; end if;
  select * into d from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id
      and configuration_version_id=w.configuration_version_id for update;
  if d.work_id is null
    or d.capture_permission_digest is distinct from authority->>'permissionDigest'
    or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'pinned_configuration_changed'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.triage.submit.v1',auth.uid(),p_workspace_id,p_work_id,p_expected_version));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.triage.submit.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_version then raise exception 'concurrency_conflict'; end if;
  select * into policy from public.d5o_trial_triage_route_policies
    where configuration_version_id=w.configuration_version_id and status='trial_active'
    for share;
  if policy.id is null or policy.rule_digest<>rybex_internal.d5o_m1_digest(policy.rule_json)
    or policy.rule_json<>jsonb_build_object('ownerRole','business_development_lead',
      'submittedState','pending_owner_acceptance','acceptedState','triage_assigned',
      'returnedState','intake_draft','qualification',false,'spending',false)
    then raise exception 'triage_route_policy_unavailable'; end if;
  if w.lifecycle_state<>'intake_draft' or d.source_kind is null
    or d.source_reference is null or d.need_summary is null or d.work_type is null
    or d.response_due_on is null or d.response_due_on<current_date
    or d.account_id is null or d.site_id is null
    or not rybex_internal.d5o_trial_triage_owner_eligible(
      p_workspace_id,w.configuration_version_id,d.triage_owner_profile_id)
    or not exists(select 1 from public.d5o_trial_accounts a
      join public.d5o_trial_sites s on s.id=d.site_id and s.account_id=a.id
        and s.workspace_id=a.workspace_id and s.configuration_tenant_id=a.configuration_tenant_id
        and s.organization_id=a.organization_id
      where a.id=d.account_id and a.workspace_id=p_workspace_id
        and a.configuration_tenant_id=w.configuration_tenant_id
        and a.organization_id=(authority->>'organizationId')::uuid
        and a.status='trial_active' and s.status='trial_active'
        and a.fixture_manifest_digest is not null
        and s.fixture_manifest_digest=a.fixture_manifest_digest)
    or exists(select 1 from public.d5o_trial_same_work_closures c where c.duplicate_work_id=w.id)
    or exists(select 1 from public.d5o_proof_packages p where p.work_id=w.id)
    or exists(select 1 from public.d5o_work_decisions x where x.work_id=w.id)
    or exists(select 1 from public.d5o_work_relations x
      where x.work_id=w.id or x.related_work_id=w.id) then
    raise exception 'triage_submission_not_ready'; end if;
  candidates:=rybex_internal.d5o_trial_duplicate_candidate_ids(
    p_workspace_id,w.configuration_tenant_id,w.id,d.account_id,d.customer_context,w.title);
  if coalesce(array_length(candidates,1),0)>20 then raise exception 'too_many_candidates'; end if;
  lock table public.opportunities in share mode;
  select exists(select 1 from public.opportunities o where o.workspace_id=p_workspace_id
    and o.organization_id=(authority->>'organizationId')::uuid
    and (lower(btrim(o.gc_client))=lower(btrim(d.customer_context))
      or lower(btrim(o.name))=lower(btrim(w.title)))) into legacy_hold;
  if legacy_hold then raise exception 'legacy_match_requires_source_review'; end if;
  select * into review from public.d5o_trial_duplicate_reviews
    where work_id=w.id and workspace_id=p_workspace_id for share;
  if review.work_id is null or review.disposition<>'distinct'
    or review.reviewed_work_version<>w.record_version
    or review.compared_work_ids is distinct from candidates
    or not exists(select 1 from public.config_permission_definitions p
      where p.id=review.permission_id and p.configuration_version_id=w.configuration_version_id
        and p.permission_key='discover.resolve_duplicate' and p.status='active'
        and review.permission_digest=rybex_internal.d5o_m1_digest(to_jsonb(p))) then
    raise exception 'independent_duplicate_review_required'; end if;
  select coalesce(max(submission_revision),0)+1 into revision
    from public.d5o_trial_triage_submissions where work_id=w.id;
  acceptance_deadline:=case when policy.acceptance_window_hours is null then null
    else now()+make_interval(hours=>policy.acceptance_window_hours) end;
  snapshot:=jsonb_build_object('workId',w.id,'workVersion',w.record_version,
    'title',w.title,'configurationDigest',w.configuration_digest,
    'draft',to_jsonb(d),'duplicateReview',to_jsonb(review),
    'candidateWorkIds',to_jsonb(candidates),
    'routePolicy',to_jsonb(policy),'proposedOwnerProfileId',d.triage_owner_profile_id);
  snapshot_digest:=rybex_internal.d5o_m1_digest(snapshot);
  before_row:=to_jsonb(w);
  insert into public.d5o_trial_triage_submissions(work_id,workspace_id,
    configuration_version_id,submission_revision,from_work_version,
    submitted_work_version,proposed_owner_profile_id,submitted_by,
    submit_permission_id,submit_permission_digest,route_policy_id,
    route_policy_digest,snapshot,snapshot_digest,accept_by)
  values(w.id,p_workspace_id,w.configuration_version_id,revision,w.record_version,
    w.record_version+1,d.triage_owner_profile_id,auth.uid(),permission.id,
    rybex_internal.d5o_m1_digest(to_jsonb(permission)),policy.id,
    rybex_internal.d5o_m1_digest(to_jsonb(policy)),snapshot,snapshot_digest,
    acceptance_deadline) returning id into submission_id;
  update public.d5o_work_records set lifecycle_state='pending_owner_acceptance',
    record_version=record_version+1 where id=w.id returning * into w;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.triage_submitted',
    auth.uid(),before_row,to_jsonb(w),jsonb_build_object('submissionId',submission_id,
      'submissionRevision',revision,'snapshotDigest',snapshot_digest,
      'routePolicyDigest',rybex_internal.d5o_m1_digest(to_jsonb(policy)),
      'submitPermissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)),
      'proposedOwnerProfileId',d.triage_owner_profile_id,'acceptBy',acceptance_deadline));
  update public.d5o_trial_triage_submissions set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=submission_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'lifecycleState',w.lifecycle_state,'submissionId',submission_id,
    'submissionRevision',revision,'proposedOwnerProfileId',d.triage_owner_profile_id,
    'acceptBy',acceptance_deadline,'snapshotDigest',snapshot_digest,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,result_status,
    result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.triage.submit.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_submit_discover_triage_v1(uuid,uuid,integer,text)
  from public,anon,authenticated,service_role;
commit;
