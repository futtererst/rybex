-- Disposable scratch E: version-bound requests for D4 evidence, not evidence custody or clearance.
begin;
create table public.d5o_trial_d4_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  work_id uuid not null,
  package_id uuid not null,
  package_revision integer not null check(package_revision>0),
  job_revision integer not null check(job_revision>0),
  discipline text not null check(discipline in
    ('g3_scope','technical_design','hseq_access','supply_equipment',
     'certificate_policy','execution_pack')),
  title text not null check(length(btrim(title)) between 8 and 160),
  acceptance_criterion text not null check(length(btrim(acceptance_criterion)) between 20 and 1000),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  permission_id uuid not null references public.config_permission_definitions(id),
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id),
  foreign key(package_id,workspace_id) references public.d5o_trial_d4_packages(id,workspace_id),
  foreign key(package_id,package_revision) references public.d5o_trial_d4_package_versions(package_id,revision)
);
create index d5o_trial_d4_evidence_requests_package_idx
  on public.d5o_trial_d4_evidence_requests(package_id,package_revision,requested_at);
alter table public.d5o_trial_d4_evidence_requests enable row level security;
revoke all on public.d5o_trial_d4_evidence_requests from public,anon,authenticated,service_role;
create trigger d5o_trial_d4_evidence_request_immutable before update or delete
  on public.d5o_trial_d4_evidence_requests for each row
  execute function rybex_internal.d5o_trial_d4_package_immutable();

create function public.d5o_d4_list_evidence_requests_v1(p_workspace_id uuid,p_package_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; package public.d5o_trial_d4_packages%rowtype;
  current_version public.d5o_trial_d4_package_versions%rowtype;
  current_job_revision integer; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into package from public.d5o_trial_d4_packages
    where id=p_package_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if package.id is null then raise exception 'd4_evidence_request_scope_invalid'; end if;
  select * into current_version from public.d5o_trial_d4_package_versions
    where package_id=package.id order by revision desc limit 1 for share;
  select revision into current_job_revision from public.d5o_trial_rm_job_versions
    where work_id=package.work_id order by revision desc limit 1 for share;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'discipline',r.discipline,'title',r.title,
    'acceptanceCriterion',r.acceptance_criterion,
    'packageRevision',r.package_revision,'jobRevision',r.job_revision,
    'requestedBy',r.requested_by,'requestedAt',r.requested_at,
    'status',case when r.package_revision=current_version.revision
      and r.job_revision=current_job_revision
      and current_version.job_revision=current_job_revision
      then 'evidence_needed' else 'historical' end)
    order by r.requested_at desc,r.id),'[]'::jsonb) into items
    from public.d5o_trial_d4_evidence_requests r
    where r.package_id=package.id and r.workspace_id=p_workspace_id;
  return jsonb_build_object('workId',package.work_id,'packageId',package.id,
    'currentRevision',current_version.revision,'items',items,
    'canRequest',exists(select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.profile_id=(authority->>'profileId')::uuid and g.status='active'
        and g.configuration_version_id=(authority->>'configurationVersionId')::uuid
        and d.permission_key='d4.edit_package_draft' and d.status='active'));
end $$;
revoke all on function public.d5o_d4_list_evidence_requests_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_list_evidence_requests_v1(uuid,uuid) to authenticated;

create function public.d5o_d4_record_evidence_request_v1(
  p_workspace_id uuid,p_package_id uuid,p_expected_revision integer,
  p_expected_job_revision integer,p_discipline text,p_title text,
  p_acceptance_criterion text,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; package public.d5o_trial_d4_packages%rowtype;
  current_version public.d5o_trial_d4_package_versions%rowtype;
  job_version public.d5o_trial_rm_job_versions%rowtype;
  cached public.command_idempotency%rowtype; request_hash text;
  request_id uuid; audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_d4_package_authority(p_workspace_id);
  if p_expected_revision is null or p_expected_revision<1
    or p_expected_job_revision is null or p_expected_job_revision<1
    or p_discipline not in ('g3_scope','technical_design','hseq_access',
      'supply_equipment','certificate_policy','execution_pack')
    or length(btrim(coalesce(p_title,''))) not between 8 and 160
    or length(btrim(coalesce(p_acceptance_criterion,''))) not between 20 and 1000
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_d4_evidence_request'; end if;
  select * into package from public.d5o_trial_d4_packages
    where id=p_package_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if package.id is null then raise exception 'd4_evidence_request_scope_invalid'; end if;
  select * into current_version from public.d5o_trial_d4_package_versions
    where package_id=package.id order by revision desc limit 1 for share;
  select * into job_version from public.d5o_trial_rm_job_versions
    where work_id=package.work_id order by revision desc limit 1 for share;
  if current_version.revision is distinct from p_expected_revision
    or job_version.revision is distinct from p_expected_job_revision
    or current_version.job_revision<>job_version.revision then
    raise exception 'd4_evidence_request_stale'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'd4.evidence.request.v1',auth.uid(),p_workspace_id,p_package_id,
    p_expected_revision,p_expected_job_revision,p_discipline,
    btrim(p_title),btrim(p_acceptance_criterion)));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.d4.evidence.request.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  request_id:=gen_random_uuid();
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,
    'd5o_trial_d4_evidence_request',request_id,p_command_id,
    'd4.evidence_requested',null,'evidence_needed',auth.uid(),p_command_id,
    '{}'::jsonb,jsonb_build_object('discipline',p_discipline,
      'title',btrim(p_title),'acceptanceCriterion',btrim(p_acceptance_criterion)),
    jsonb_build_object('workId',package.work_id,'packageId',package.id,
      'packageRevision',current_version.revision,'jobRevision',job_version.revision));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,
    'd5o_trial_d4_evidence_request',request_id,1,'d4.evidence_requested',
    1,p_command_id,p_command_id,auth.uid(),jsonb_build_object(
      'workId',package.work_id,'packageId',package.id,
      'packageRevision',current_version.revision,'discipline',p_discipline));
  insert into public.d5o_trial_d4_evidence_requests(id,workspace_id,
    configuration_tenant_id,organization_id,work_id,package_id,
    package_revision,job_revision,discipline,title,acceptance_criterion,
    requested_by,permission_id,permission_digest,audit_event_id,domain_event_id)
  values(request_id,p_workspace_id,package.configuration_tenant_id,
    package.organization_id,package.work_id,package.id,current_version.revision,
    job_version.revision,p_discipline,btrim(p_title),btrim(p_acceptance_criterion),
    auth.uid(),(authority->>'permissionId')::uuid,
    authority->>'permissionDigest',audit_id,event_id);
  result:=jsonb_build_object('success',true,'requestId',request_id,
    'packageId',package.id,'packageRevision',current_version.revision,
    'auditId',audit_id,'eventId',event_id,'status','evidence_needed',
    'releaseEligible',false);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.d4.evidence.request.v1',
    'd5o_trial_d4_evidence_request',request_id,request_hash,auth.uid(),p_command_id,
    'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_d4_record_evidence_request_v1(
  uuid,uuid,integer,integer,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_record_evidence_request_v1(
  uuid,uuid,integer,integer,text,text,text,text) to authenticated;
commit;
