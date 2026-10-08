-- Synthetic-only G1 assessment revisions. Apply to owned disposable scratch.
-- Submission freezes a review package; it does not decide G1 or spend.
-- Fresh setup: apply G1 start, then G1 strategy, then this candidate.
begin;
create table public.d5o_trial_g1_assessments (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.d5o_trial_g1_instances(id) on delete restrict,
  workspace_id uuid not null,
  work_id uuid not null,
  configuration_version_id uuid not null,
  assessment_revision integer not null check(assessment_revision>0),
  status text not null check(status in ('draft','submitted')),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  package_snapshot jsonb not null check(jsonb_typeof(package_snapshot)='object'),
  package_digest text not null check(package_digest ~ '^[0-9a-f]{64}$'),
  source_work_version integer not null check(source_work_version>0),
  prepared_by uuid not null references auth.users(id) on delete restrict,
  prepared_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(instance_id,assessment_revision),unique(work_id,assessment_revision),
  foreign key(work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict,
  foreign key(work_id,workspace_id)
    references public.d5o_trial_g1_instances(work_id,workspace_id) on delete restrict
);
alter table public.d5o_trial_g1_assessments enable row level security;
revoke all on public.d5o_trial_g1_assessments from public,anon,authenticated,service_role;
create function rybex_internal.d5o_trial_g1_assessment_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'immutable_g1_assessment'; end if;
  if old.audit_event_id is not null or old.domain_event_id is not null
    or new.audit_event_id is null or new.domain_event_id is null
    or (to_jsonb(new)-'audit_event_id'-'domain_event_id')
      is distinct from (to_jsonb(old)-'audit_event_id'-'domain_event_id') then
    raise exception 'immutable_g1_assessment'; end if;
  return new;
end $$;
create trigger d5o_trial_g1_assessment_immutable before update or delete
  on public.d5o_trial_g1_assessments for each row
  execute function rybex_internal.d5o_trial_g1_assessment_immutable();
create function rybex_internal.d5o_trial_g1_assessment_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_trial_g1_assessments a where a.id=new.id
    and (a.audit_event_id is null or a.domain_event_id is null)) then
    raise exception 'g1_assessment_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_g1_assessment_receipt after insert or update
  on public.d5o_trial_g1_assessments deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_g1_assessment_receipt();

create function rybex_internal.d5o_trial_g1_validate_payload(p_payload jsonb,p_submit boolean)
returns text[] language plpgsql stable set search_path=public,pg_temp as $$
declare key text; value jsonb; missing text[]:=array[]::text[];
  text_keys text[]:=array['strategicRationale','customerRationale','technicalAssessment',
    'technicalRisk','capacityPosition','commercialRisk','pursuitPlan','knownUnknowns'];
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_payload) k
      where k<>all(text_keys||array['proposedCapAmount','proposedCapCurrency','nextOwnerProfileId'])) then
    raise exception 'invalid_assessment_payload'; end if;
  foreach key in array text_keys loop
    value:=p_payload->key;
    if value is not null and jsonb_typeof(value) not in ('string','null') then
      raise exception 'invalid_assessment_payload'; end if;
    if length(coalesce(p_payload->>key,''))>2000 then raise exception 'invalid_assessment_payload'; end if;
    if p_submit and key<>'knownUnknowns' and length(btrim(coalesce(p_payload->>key,'')))<20 then
      missing:=array_append(missing,key); end if;
  end loop;
  if p_payload ? 'proposedCapAmount' and jsonb_typeof(p_payload->'proposedCapAmount') not in ('number','null') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload->>'proposedCapAmount' is not null
    and ((p_payload->>'proposedCapAmount')::numeric<0 or (p_payload->>'proposedCapAmount')::numeric>1000000000) then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload ? 'proposedCapCurrency'
    and jsonb_typeof(p_payload->'proposedCapCurrency') not in ('string','null') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload->>'proposedCapCurrency' is not null
    and p_payload->>'proposedCapCurrency' not in ('USD','GBP','EUR') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload ? 'nextOwnerProfileId'
    and jsonb_typeof(p_payload->'nextOwnerProfileId') not in ('string','null') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload->>'nextOwnerProfileId' is not null
    and p_payload->>'nextOwnerProfileId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_assessment_payload'; end if;
  if p_submit then
    if p_payload->>'proposedCapAmount' is null then missing:=array_append(missing,'proposedCapAmount'); end if;
    if p_payload->>'proposedCapCurrency' is null then missing:=array_append(missing,'proposedCapCurrency'); end if;
    if p_payload->>'nextOwnerProfileId' is null then missing:=array_append(missing,'nextOwnerProfileId'); end if;
  end if;
  return missing;
end $$;
revoke all on function rybex_internal.d5o_trial_g1_validate_payload(jsonb,boolean)
  from public,anon,authenticated,service_role;

create function public.d5o_write_discover_g1_assessment_v1(
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
revoke all on function public.d5o_write_discover_g1_assessment_v1(uuid,uuid,uuid,integer,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_write_discover_g1_assessment_v1(uuid,uuid,uuid,integer,text,text,jsonb) to authenticated;

create function public.d5o_get_discover_g1_assessment_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; reader jsonb;
  instance public.d5o_trial_g1_instances%rowtype; latest public.d5o_trial_g1_assessments%rowtype;
  can_edit boolean:=false;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  reader:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  select * into instance from public.d5o_trial_g1_instances where work_id=w.id for share;
  if instance.id is null then return jsonb_build_object('status','not_started','canEdit',false); end if;
  select * into latest from public.d5o_trial_g1_assessments
    where instance_id=instance.id order by assessment_revision desc limit 1 for share;
  if w.created_by=auth.uid() and instance.started_by=auth.uid()
    and instance.source_work_version=w.record_version and w.lifecycle_state='triage_assigned'
    and (latest.id is null or latest.status='draft') then
    begin
      perform rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
      can_edit:=true;
    exception when others then can_edit:=false;
    end;
  end if;
  return jsonb_build_object('status',case when latest.id is null then 'empty'
    when latest.status='draft' and not can_edit then 'draft_private'
    else latest.status end,'g1InstanceId',instance.id,
    'assessmentRevision',coalesce(latest.assessment_revision,0),'canEdit',can_edit,
    'payload',case when can_edit or latest.status='submitted' then latest.payload else null end,
    'packageDigest',case when latest.status='submitted' then latest.package_digest else null end,
    'spendingAuthorized',false);
end $$;
revoke all on function public.d5o_get_discover_g1_assessment_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_get_discover_g1_assessment_v1(uuid,uuid) to authenticated;
commit;
