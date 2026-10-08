-- Scratch forward: freeze strategy result in each new G1 submission.
begin;
create or replace function public.d5o_write_discover_g1_assessment_v1(
  p_workspace_id uuid,p_work_id uuid,p_instance_id uuid,p_expected_revision integer,
  p_command_id text,p_mode text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; authority jsonb;
  instance public.d5o_trial_g1_instances%rowtype; latest public.d5o_trial_g1_assessments%rowtype;
  cached public.command_idempotency%rowtype; submission public.d5o_trial_triage_submissions%rowtype;
  draft public.d5o_discover_capture_drafts%rowtype; owner_id uuid;
  request_hash text; missing text[]; revision integer; package jsonb; digest text; strategy jsonb;
  assessment_id uuid; events jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_instance_id is null or p_expected_revision is null or p_expected_revision<0
    or p_mode not in ('save','submit') or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_command'; end if;
  missing:=rybex_internal.d5o_trial_g1_validate_payload(p_payload,p_mode='submit');
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
  if w.created_by<>auth.uid() then raise exception 'g1_assessment_permission_denied'; end if;
  select * into instance from public.d5o_trial_g1_instances
    where id=p_instance_id and work_id=w.id and workspace_id=p_workspace_id
      and configuration_version_id=w.configuration_version_id for update;
  if instance.id is null or instance.started_by<>auth.uid() or instance.status<>'assessment_draft'
    or instance.source_work_version<>w.record_version or w.lifecycle_state<>'triage_assigned'
    or instance.policy_digest<>rybex_internal.d5o_m1_digest(instance.policy_snapshot->'rule_json')
    or instance.policy_snapshot->'rule_json'->'requiredDisciplines' is distinct from '["technical"]'::jsonb
    or instance.policy_snapshot->'rule_json'->'spendingAuthorized' is distinct from 'false'::jsonb then
    raise exception 'g1_assessment_not_eligible'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.g1.assessment.v1',auth.uid(),p_workspace_id,p_work_id,p_instance_id,
    p_expected_revision,p_mode,p_payload));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.g1.assessment.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into latest from public.d5o_trial_g1_assessments
    where instance_id=instance.id order by assessment_revision desc limit 1 for update;
  if coalesce(latest.assessment_revision,0)<>p_expected_revision
    or latest.status='submitted' then raise exception 'g1_assessment_conflict'; end if;
  select * into submission from public.d5o_trial_triage_submissions
    where id=instance.source_submission_id and work_id=w.id and workspace_id=p_workspace_id for share;
  if submission.id is null or submission.snapshot_digest<>instance.source_snapshot_digest
    or submission.snapshot_digest<>rybex_internal.d5o_m1_digest(submission.snapshot)
    or not exists(select 1 from public.d5o_trial_triage_responses r
      where r.id=instance.source_response_id and r.submission_id=submission.id
        and r.disposition='accepted' and r.after_work_version=w.record_version) then
    raise exception 'g1_source_changed'; end if;
  if p_mode='submit' then
    if array_length(missing,1)>0 then raise exception 'g1_assessment_incomplete: %',array_to_string(missing,','); end if;
    select * into draft from public.d5o_discover_capture_drafts
      where work_id=w.id and workspace_id=p_workspace_id for share;
    if draft.account_id is null or draft.site_id is null
      or length(btrim(coalesce(draft.need_summary,'')))<20
      or length(btrim(coalesce(draft.source_reference,'')))<3
      or not exists(select 1 from public.d5o_trial_accounts a
        join public.d5o_trial_sites s on s.account_id=a.id
        where a.id=draft.account_id and s.id=draft.site_id
          and a.workspace_id=p_workspace_id and s.workspace_id=p_workspace_id
          and a.configuration_tenant_id=w.configuration_tenant_id
          and s.configuration_tenant_id=w.configuration_tenant_id
          and a.status='trial_active' and s.status='trial_active') then
      raise exception 'g1_identity_or_source_missing'; end if;
    owner_id:=(p_payload->>'nextOwnerProfileId')::uuid;
    if not exists(select 1 from public.user_profiles p
      join public.workspace_memberships m on m.user_profile_id=p.id
        and m.workspace_id=p_workspace_id and m.user_id=p.user_id and m.status='active'
      where p.id=owner_id and p.status='active' and p.auth_user_id=p.user_id
        and p.organization_id=(authority->>'organizationId')::uuid
        and m.organization_id=p.organization_id) then
      raise exception 'g1_next_owner_invalid'; end if;
  end if;
  revision:=p_expected_revision+1;
  strategy:=case when p_mode='submit'
    then rybex_internal.d5o_trial_g1_strategy_result(p_workspace_id,w.id)
    else jsonb_build_object('status','not_evaluated') end;
  package:=jsonb_build_object('workId',w.id,'workVersion',w.record_version,
    'g1InstanceId',instance.id,'assessmentRevision',revision,'status',
    case when p_mode='submit' then 'submitted' else 'draft' end,
    'sourceSubmissionId',submission.id,'sourceSnapshotDigest',submission.snapshot_digest,
    'policyId',instance.policy_id,'policyDigest',instance.policy_digest,
    'payload',p_payload,'strategyResult',strategy,'spendingAuthorized',false);
  digest:=rybex_internal.d5o_m1_digest(package);
  insert into public.d5o_trial_g1_assessments(instance_id,workspace_id,work_id,
    configuration_version_id,assessment_revision,status,payload,package_snapshot,
    package_digest,source_work_version,prepared_by,prepared_by_profile_id,
    permission_id,permission_digest)
  values(instance.id,p_workspace_id,w.id,w.configuration_version_id,revision,
    case when p_mode='submit' then 'submitted' else 'draft' end,p_payload,package,
    digest,w.record_version,auth.uid(),(authority->>'actorProfileId')::uuid,
    (authority->>'startPermissionId')::uuid,authority->>'startPermissionDigest')
  returning id into assessment_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,
    case when p_mode='submit' then 'discover.g1_assessment_submitted'
      else 'discover.g1_assessment_draft_saved' end,auth.uid(),to_jsonb(w),to_jsonb(w),
    jsonb_build_object('g1InstanceId',instance.id,'assessmentId',assessment_id,
      'assessmentRevision',revision,'packageDigest',digest,'policyDigest',instance.policy_digest,
      'sourceSnapshotDigest',submission.snapshot_digest,'spendingAuthorized',false));
  update public.d5o_trial_g1_assessments set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=assessment_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'g1InstanceId',instance.id,
    'assessmentId',assessment_id,'assessmentRevision',revision,
    'assessmentStatus',case when p_mode='submit' then 'submitted' else 'draft' end,
    'packageDigest',digest,'spendingAuthorized',false,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.g1.assessment.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
commit;
