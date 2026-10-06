-- Disposable scratch E: package-specific field buildability review only.
-- Reviewed means a field supervisor reviewed the frozen draft; it is not HSEQ,
-- technical design, commercial authority, or D4 package release.
begin;
create table public.d5o_trial_d4_field_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  work_id uuid not null,
  package_id uuid not null,
  package_revision integer not null check(package_revision>0),
  job_revision integer not null check(job_revision>0),
  payload_digest text not null check(payload_digest ~ '^[0-9a-f]{64}$'),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id),
  unique(package_id,package_revision),
  foreign key(package_id,workspace_id) references public.d5o_trial_d4_packages(id,workspace_id)
);
alter table public.d5o_trial_d4_field_submissions enable row level security;
revoke all on public.d5o_trial_d4_field_submissions from public,anon,authenticated,service_role;
create table public.d5o_trial_d4_field_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.d5o_trial_d4_field_submissions(id),
  workspace_id uuid not null,
  work_id uuid not null,
  package_id uuid not null,
  disposition text not null check(disposition in ('reviewed','returned')),
  reason text not null check(length(btrim(reason)) between 20 and 1000),
  responded_by uuid not null references auth.users(id),
  responded_at timestamptz not null default now(),
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id)
);
alter table public.d5o_trial_d4_field_responses enable row level security;
revoke all on public.d5o_trial_d4_field_responses from public,anon,authenticated,service_role;
create function rybex_internal.d5o_trial_d4_field_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'immutable_d4_field_review'; end $$;
create trigger d5o_trial_d4_field_submission_immutable before update or delete
  on public.d5o_trial_d4_field_submissions for each row
  execute function rybex_internal.d5o_trial_d4_field_immutable();
create trigger d5o_trial_d4_field_response_immutable before update or delete
  on public.d5o_trial_d4_field_responses for each row
  execute function rybex_internal.d5o_trial_d4_field_immutable();

create function rybex_internal.d5o_trial_d4_field_authority(
  p_workspace_id uuid,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; permission public.config_permission_definitions%rowtype; rule jsonb;
begin
  if p_key not in ('d4.submit_buildability','d4.review_buildability') then
    raise exception 'd4_field_permission_denied'; end if;
  base:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into permission from public.config_permission_definitions
    where configuration_version_id=(base->>'configurationVersionId')::uuid
      and permission_key=p_key and permission_scope='organization'
      and status='active' for share;
  if permission.id is null then raise exception 'd4_field_permission_denied'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? (base->>'workspaceRole'))
    or not exists(select 1 from public.d5o_trial_rm_grants g
      where g.workspace_id=p_workspace_id
        and g.configuration_version_id=(base->>'configurationVersionId')::uuid
        and g.permission_id=permission.id and g.user_id=auth.uid()
        and g.profile_id=(base->>'profileId')::uuid and g.status='active') then
    raise exception 'd4_field_permission_denied'; end if;
  return base||jsonb_build_object('permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_d4_field_authority(uuid,text)
  from public,anon,authenticated,service_role;

create function public.d5o_d4_list_buildability_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; package_count integer; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select count(*) into package_count from public.d5o_trial_d4_packages p
    where p.work_id=p_work_id and p.workspace_id=p_workspace_id
      and p.configuration_tenant_id=(authority->>'tenantId')::uuid
      and p.organization_id=(authority->>'organizationId')::uuid;
  if package_count=0 and not exists(select 1 from public.d5o_trial_rm_jobs j
    where j.work_id=p_work_id and j.workspace_id=p_workspace_id
      and j.configuration_tenant_id=(authority->>'tenantId')::uuid
      and j.organization_id=(authority->>'organizationId')::uuid) then
    raise exception 'd4_field_scope_invalid'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('submissionId',s.id,
    'packageId',s.package_id,'packageRevision',s.package_revision,
    'jobRevision',s.job_revision,'payloadDigest',s.payload_digest,
    'submittedBy',s.submitted_by,'submittedAt',s.submitted_at,
    'disposition',r.disposition,'reason',r.reason,
    'respondedBy',r.responded_by,'respondedAt',r.responded_at,
    'currentPackageRevision',v.revision,'currentJobRevision',jv.revision,
    'frozenPayload',pv.payload) order by s.submitted_at desc),'[]'::jsonb)
    into items from public.d5o_trial_d4_field_submissions s
    join public.d5o_trial_d4_packages p on p.id=s.package_id
    join lateral(select revision from public.d5o_trial_d4_package_versions
      where package_id=s.package_id order by revision desc limit 1) v on true
    join public.d5o_trial_d4_package_versions pv on pv.package_id=s.package_id
      and pv.revision=s.package_revision
    join lateral(select revision from public.d5o_trial_rm_job_versions
      where work_id=s.work_id order by revision desc limit 1) jv on true
    left join public.d5o_trial_d4_field_responses r on r.submission_id=s.id
    where s.work_id=p_work_id and s.workspace_id=p_workspace_id
      and s.configuration_tenant_id=(authority->>'tenantId')::uuid
      and s.organization_id=(authority->>'organizationId')::uuid;
  return jsonb_build_object('workId',p_work_id,'items',items,
    'canSubmit',exists(select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.profile_id=(authority->>'profileId')::uuid and g.status='active'
        and d.configuration_version_id=(authority->>'configurationVersionId')::uuid
        and d.permission_key='d4.submit_buildability'),
    'canRespond',exists(select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.profile_id=(authority->>'profileId')::uuid and g.status='active'
        and d.configuration_version_id=(authority->>'configurationVersionId')::uuid
        and d.permission_key='d4.review_buildability'));
end $$;
revoke all on function public.d5o_d4_list_buildability_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_list_buildability_v1(uuid,uuid) to authenticated;

create function public.d5o_d4_submit_buildability_v1(p_workspace_id uuid,
  p_work_id uuid,p_package_id uuid,p_expected_package_revision integer,
  p_expected_job_revision integer,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; package public.d5o_trial_d4_packages%rowtype;
  version public.d5o_trial_d4_package_versions%rowtype;
  job_version public.d5o_trial_rm_job_versions%rowtype;
  cached public.command_idempotency%rowtype; request_hash text;
  submission_id uuid; audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_d4_field_authority(
    p_workspace_id,'d4.submit_buildability');
  if p_work_id is null or p_package_id is null
    or p_expected_package_revision is null or p_expected_package_revision<1
    or p_expected_job_revision is null or p_expected_job_revision<1
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_d4_field_command'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'd4.field.submit.v1',auth.uid(),p_workspace_id,p_work_id,p_package_id,
    p_expected_package_revision,p_expected_job_revision));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.d4.field.submit.v1' then
      raise exception 'idempotency_mismatch'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into package from public.d5o_trial_d4_packages
    where id=p_package_id and work_id=p_work_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  select * into version from public.d5o_trial_d4_package_versions
    where package_id=package.id order by revision desc limit 1 for share;
  select * into job_version from public.d5o_trial_rm_job_versions
    where work_id=p_work_id order by revision desc limit 1 for share;
  if package.id is null or version.id is null or job_version.id is null then
    raise exception 'd4_field_scope_invalid'; end if;
  if version.revision<>p_expected_package_revision
    or job_version.revision<>p_expected_job_revision
    or version.job_revision<>job_version.revision then
    raise exception 'd4_field_stale'; end if;
  if length(btrim(version.payload->>'methodReference'))<3
    or length(btrim(version.payload->>'hazardNotes'))<20
    or length(btrim(version.payload->>'holdPoints'))<10 then
    raise exception 'd4_field_brief_incomplete'; end if;
  if exists(select 1 from public.d5o_trial_d4_field_submissions
    where package_id=p_package_id and package_revision=version.revision) then
    raise exception 'd4_field_already_submitted'; end if;
  submission_id:=gen_random_uuid();
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,
    'd5o_trial_d4_field_submission',submission_id,p_command_id,
    'd4.buildability_submitted',null,'pending',auth.uid(),p_command_id,null,
    jsonb_build_object('packageId',p_package_id,'revision',version.revision),
    jsonb_build_object('payloadDigest',version.payload_digest));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,
    'd5o_trial_d4_field_submission',submission_id,1,'d4.buildability_submitted',
    1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('workId',p_work_id,'packageId',p_package_id,
      'revision',version.revision));
  insert into public.d5o_trial_d4_field_submissions(id,workspace_id,
    configuration_tenant_id,organization_id,work_id,package_id,
    package_revision,job_revision,payload_digest,submitted_by,
    audit_event_id,domain_event_id)
  values(submission_id,p_workspace_id,package.configuration_tenant_id,
    package.organization_id,p_work_id,p_package_id,version.revision,
    job_version.revision,version.payload_digest,auth.uid(),audit_id,event_id);
  result:=jsonb_build_object('success',true,'submissionId',submission_id,
    'packageId',p_package_id,'packageRevision',version.revision,
    'state','pending','auditId',audit_id,'eventId',event_id,
    'releaseEligible',false);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.d4.field.submit.v1',
    'd5o_trial_d4_field_submission',submission_id,request_hash,auth.uid(),
    p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_d4_submit_buildability_v1(uuid,uuid,uuid,integer,integer,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_submit_buildability_v1(uuid,uuid,uuid,integer,integer,text)
  to authenticated;

create function public.d5o_d4_respond_buildability_v1(p_workspace_id uuid,
  p_submission_id uuid,p_disposition text,p_reason text,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; submission public.d5o_trial_d4_field_submissions%rowtype;
  version public.d5o_trial_d4_package_versions%rowtype;
  job_version public.d5o_trial_rm_job_versions%rowtype;
  cached public.command_idempotency%rowtype; request_hash text;
  response_id uuid; audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_d4_field_authority(
    p_workspace_id,'d4.review_buildability');
  if p_submission_id is null or p_disposition not in ('reviewed','returned')
    or length(btrim(coalesce(p_reason,''))) not between 20 and 1000
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_d4_field_response'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'd4.field.respond.v1',auth.uid(),p_workspace_id,p_submission_id,
    p_disposition,btrim(p_reason)));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.d4.field.respond.v1' then
      raise exception 'idempotency_mismatch'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into submission from public.d5o_trial_d4_field_submissions
    where id=p_submission_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if submission.id is null then raise exception 'd4_field_scope_invalid'; end if;
  if submission.submitted_by=auth.uid() then raise exception 'd4_field_self_review_denied'; end if;
  if exists(select 1 from public.d5o_trial_d4_field_responses
    where submission_id=p_submission_id) then raise exception 'd4_field_already_responded'; end if;
  select * into version from public.d5o_trial_d4_package_versions
    where package_id=submission.package_id order by revision desc limit 1 for share;
  select * into job_version from public.d5o_trial_rm_job_versions
    where work_id=submission.work_id order by revision desc limit 1 for share;
  if version.revision<>submission.package_revision
    or version.payload_digest<>submission.payload_digest
    or job_version.revision<>submission.job_revision then
    raise exception 'd4_field_stale'; end if;
  response_id:=gen_random_uuid();
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,
    'd5o_trial_d4_field_response',response_id,p_command_id,
    'd4.buildability_'||p_disposition,'pending',p_disposition,auth.uid(),
    p_command_id,jsonb_build_object('submissionId',p_submission_id),
    jsonb_build_object('reason',btrim(p_reason)),
    jsonb_build_object('packageId',submission.package_id,
      'revision',submission.package_revision));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,
    'd5o_trial_d4_field_response',response_id,1,
    'd4.buildability_'||p_disposition,1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('submissionId',p_submission_id,
      'packageId',submission.package_id,'revision',submission.package_revision));
  insert into public.d5o_trial_d4_field_responses(id,submission_id,
    workspace_id,work_id,package_id,disposition,reason,responded_by,
    audit_event_id,domain_event_id)
  values(response_id,p_submission_id,p_workspace_id,submission.work_id,
    submission.package_id,p_disposition,btrim(p_reason),auth.uid(),audit_id,event_id);
  result:=jsonb_build_object('success',true,'responseId',response_id,
    'submissionId',p_submission_id,'packageId',submission.package_id,
    'disposition',p_disposition,'auditId',audit_id,'eventId',event_id,
    'releaseEligible',false);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.d4.field.respond.v1',
    'd5o_trial_d4_field_response',response_id,request_hash,auth.uid(),
    p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_d4_respond_buildability_v1(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_respond_buildability_v1(uuid,uuid,text,text,text)
  to authenticated;
commit;
