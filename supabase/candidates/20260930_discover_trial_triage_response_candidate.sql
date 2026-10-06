-- UNAPPLIED synthetic-only owner acceptance/return command. No qualification.
begin;
create function public.d5o_respond_discover_triage_v1(
  p_workspace_id uuid,p_work_id uuid,p_submission_id uuid,p_expected_version integer,
  p_command_id text,p_disposition text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; cfg jsonb; w public.d5o_work_records%rowtype;
  submission public.d5o_trial_triage_submissions%rowtype;
  permission public.config_permission_definitions%rowtype;
  cached public.command_idempotency%rowtype;
  request_hash text; before_row jsonb; events jsonb; result jsonb;
  response_id uuid; target_state text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_submission_id is null or p_expected_version is null
    or p_expected_version<1 or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_disposition not in ('accepted','returned')
    or length(btrim(coalesce(p_reason,''))) not between 20 and 1000 then
    raise exception 'invalid_command'; end if;
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,
    w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then
    raise exception 'pinned_configuration_changed'; end if;
  select * into submission from public.d5o_trial_triage_submissions
    where id=p_submission_id and work_id=w.id and workspace_id=p_workspace_id
      and configuration_version_id=w.configuration_version_id for update;
  if submission.id is null or submission.proposed_owner_profile_id
      is distinct from (actor->>'profile')::uuid
    or not rybex_internal.d5o_trial_triage_owner_eligible(
      p_workspace_id,w.configuration_version_id,submission.proposed_owner_profile_id) then
    raise exception 'forbidden'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=w.configuration_version_id
      and permission_key='discover.accept_triage'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'triage_accept_permission_unavailable'; end if;
  if submission.snapshot_digest<>rybex_internal.d5o_m1_digest(submission.snapshot)
    or submission.snapshot->>'workVersion' is distinct from submission.from_work_version::text
    or submission.snapshot->>'proposedOwnerProfileId' is distinct from
      submission.proposed_owner_profile_id::text then
    raise exception 'submitted_basis_changed'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.triage.response.v1',auth.uid(),p_workspace_id,p_work_id,p_submission_id,
    p_expected_version,p_disposition,btrim(p_reason)));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.triage.response.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_version then raise exception 'concurrency_conflict'; end if;
  if w.lifecycle_state<>'pending_owner_acceptance'
    or submission.submitted_work_version<>w.record_version
    or submission.submission_revision<>(select max(s.submission_revision)
      from public.d5o_trial_triage_submissions s where s.work_id=w.id)
    or exists(select 1 from public.d5o_trial_triage_responses r
      where r.submission_id=submission.id) then
    raise exception 'triage_response_not_eligible'; end if;
  target_state:=case when p_disposition='accepted' then 'triage_assigned'
    else 'intake_draft' end;
  before_row:=to_jsonb(w);
  insert into public.d5o_trial_triage_responses(submission_id,work_id,workspace_id,
    disposition,reason,from_work_version,after_work_version,responded_by,
    responder_profile_id,accept_permission_id,accept_permission_digest)
  values(submission.id,w.id,p_workspace_id,p_disposition,btrim(p_reason),
    w.record_version,w.record_version+1,auth.uid(),(actor->>'profile')::uuid,
    permission.id,rybex_internal.d5o_m1_digest(to_jsonb(permission)))
  returning id into response_id;
  update public.d5o_work_records set lifecycle_state=target_state,
    record_version=record_version+1 where id=w.id returning * into w;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,
    'discover.triage_'||p_disposition,auth.uid(),before_row,to_jsonb(w),
    jsonb_build_object('submissionId',submission.id,'responseId',response_id,
      'snapshotDigest',submission.snapshot_digest,'disposition',p_disposition,
      'reason',btrim(p_reason),'acceptBy',submission.accept_by,
      'overdueAtResponse',submission.accept_by is not null and now()>submission.accept_by,
      'acceptPermissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission))));
  update public.d5o_trial_triage_responses set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=response_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'lifecycleState',w.lifecycle_state,'submissionId',submission.id,
    'responseId',response_id,'disposition',p_disposition,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,result_status,
    result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.triage.response.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_respond_discover_triage_v1(
  uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
commit;
