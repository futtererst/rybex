-- Scratch correction for qualified decision table references.
begin;
create or replace function public.d5o_reopen_discover_g1_assessment_v1(
  p_workspace_id uuid,p_work_id uuid,p_assessment_id uuid,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; authority jsonb;
  instance public.d5o_trial_g1_instances%rowtype; prior public.d5o_trial_g1_assessments%rowtype;
  decision public.d5o_trial_g1_decisions%rowtype; cached public.command_idempotency%rowtype;
  request_hash text; revision integer; package jsonb; digest text; assessment_id uuid;
  events jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_assessment_id is null or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
  if w.created_by<>auth.uid() then raise exception 'g1_reopen_permission_denied'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.g1.reopen.v1',auth.uid(),p_workspace_id,p_work_id,p_assessment_id));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.g1.reopen.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into instance from public.d5o_trial_g1_instances
    where work_id=w.id and workspace_id=p_workspace_id for share;
  select * into prior from public.d5o_trial_g1_assessments
    where id=p_assessment_id and instance_id=instance.id and work_id=w.id for share;
  select * into decision from public.d5o_trial_g1_decisions d
    where d.assessment_id=prior.id and d.instance_id=instance.id for share;
  if instance.id is null or instance.started_by<>auth.uid()
    or prior.id is null or prior.status<>'submitted'
    or prior.assessment_revision<>(select max(a.assessment_revision)
      from public.d5o_trial_g1_assessments a where a.instance_id=instance.id)
    or decision.id is null or decision.disposition<>'returned'
    or prior.package_digest<>rybex_internal.d5o_m1_digest(prior.package_snapshot)
    or instance.policy_digest<>rybex_internal.d5o_m1_digest(instance.policy_snapshot->'rule_json')
    or w.record_version<>instance.source_work_version or w.lifecycle_state<>'triage_assigned'
    or exists(select 1 from public.d5o_trial_g1_decisions d
      where d.instance_id=instance.id and d.disposition='qualified') then
    raise exception 'g1_reopen_conflict'; end if;
  revision:=prior.assessment_revision+1;
  package:=prior.package_snapshot||jsonb_build_object('assessmentRevision',revision,'status','draft',
    'payload',prior.payload,'correctsAssessmentId',prior.id,'returnDecisionId',decision.id);
  digest:=rybex_internal.d5o_m1_digest(package);
  insert into public.d5o_trial_g1_assessments(instance_id,workspace_id,work_id,
    configuration_version_id,assessment_revision,status,payload,package_snapshot,
    package_digest,source_work_version,prepared_by,prepared_by_profile_id,
    permission_id,permission_digest)
  values(instance.id,p_workspace_id,w.id,w.configuration_version_id,revision,'draft',
    prior.payload,package,digest,w.record_version,auth.uid(),(authority->>'actorProfileId')::uuid,
    (authority->>'startPermissionId')::uuid,authority->>'startPermissionDigest')
  returning id into assessment_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.g1_correction_opened',
    auth.uid(),to_jsonb(w),to_jsonb(w),jsonb_build_object('g1InstanceId',instance.id,
      'assessmentId',assessment_id,'assessmentRevision',revision,'priorAssessmentId',prior.id,
      'returnDecisionId',decision.id,'packageDigest',digest,'spendingAuthorized',false));
  update public.d5o_trial_g1_assessments set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=assessment_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'assessmentId',assessment_id,
    'assessmentRevision',revision,'returnDecisionId',decision.id,'packageDigest',digest,
    'spendingAuthorized',false,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.g1.reopen.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
commit;
