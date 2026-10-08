-- Disposable scratch E: private package bytes may be staged but never count as verified evidence.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('d5o-trial-d4-evidence','d5o-trial-d4-evidence',false,1048576,
  array['text/plain','application/pdf','image/png','image/jpeg','image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table public.d5o_trial_d4_upload_intents (
  evidence_id uuid primary key references public.evidence_objects(id) on delete restrict,
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  work_id uuid not null,
  package_id uuid not null,
  package_revision integer not null,
  job_revision integer not null,
  request_id uuid not null references public.d5o_trial_d4_evidence_requests(id),
  uploaded_by uuid not null references auth.users(id),
  object_path text not null unique,
  created_at timestamptz not null default now(),
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id),
  foreign key(package_id,workspace_id) references public.d5o_trial_d4_packages(id,workspace_id),
  foreign key(package_id,package_revision) references public.d5o_trial_d4_package_versions(package_id,revision)
);
create index d5o_trial_d4_upload_intents_package_idx
  on public.d5o_trial_d4_upload_intents(package_id,package_revision,created_at);
alter table public.d5o_trial_d4_upload_intents enable row level security;
revoke all on public.d5o_trial_d4_upload_intents from public,anon,authenticated,service_role;
create trigger d5o_trial_d4_upload_intent_immutable before update or delete
  on public.d5o_trial_d4_upload_intents for each row
  execute function rybex_internal.d5o_trial_d4_package_immutable();

-- The shared evidence metadata policy is otherwise workspace-wide for unassigned
-- objects. Hide D4 trial metadata from direct reads; only scoped RPCs expose it.
drop policy evidence_objects_select_authorized on public.evidence_objects;
create policy evidence_objects_select_authorized on public.evidence_objects
  for select to authenticated using (
    bucket_id<>'d5o-trial-d4-evidence'
    and public.is_active_workspace_member(workspace_id)
    and (project_id is null or public.can_access_project(project_id)));
create function public.d5o_trial_d4_can_insert_storage_v1(p_bucket text,p_name text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
  select p_bucket='d5o-trial-d4-evidence' and exists(
    select 1 from public.d5o_trial_d4_upload_intents i
    join public.evidence_objects e on e.id=i.evidence_id
    where i.object_path=p_name and i.uploaded_by=auth.uid()
      and public.is_active_workspace_member(i.workspace_id)
      and e.upload_status='pending_upload'
      and e.bucket_id=p_bucket and e.object_path=p_name);
$$;
revoke all on function public.d5o_trial_d4_can_insert_storage_v1(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_trial_d4_can_insert_storage_v1(text,text)
  to authenticated;
create policy d5o_trial_d4_storage_insert on storage.objects
  for insert to authenticated with check (
    public.d5o_trial_d4_can_insert_storage_v1(bucket_id,name));

create function public.d5o_d4_list_staged_uploads_v1(p_workspace_id uuid,p_package_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; package public.d5o_trial_d4_packages%rowtype;
  current_revision integer; current_job_revision integer; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into package from public.d5o_trial_d4_packages
    where id=p_package_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if package.id is null then raise exception 'd4_upload_scope_invalid'; end if;
  select revision into current_revision from public.d5o_trial_d4_package_versions
    where package_id=package.id order by revision desc limit 1 for share;
  select revision into current_job_revision from public.d5o_trial_rm_job_versions
    where work_id=package.work_id order by revision desc limit 1 for share;
  select coalesce(jsonb_agg(jsonb_build_object('evidenceId',i.evidence_id,
    'requestId',i.request_id,'packageRevision',i.package_revision,
    'jobRevision',i.job_revision,'filename',e.original_filename,
    'sizeBytes',e.size_bytes,'checksumSha256',e.checksum_sha256,
    'uploadStatus',e.upload_status,'scanStatus',e.scan_status,
    'verificationStatus',e.verification_status,'createdAt',i.created_at,
    'current',i.package_revision=current_revision and i.job_revision=current_job_revision)
    order by i.created_at desc,i.evidence_id),'[]'::jsonb) into items
  from public.d5o_trial_d4_upload_intents i
    join public.evidence_objects e on e.id=i.evidence_id
  where i.package_id=package.id and i.workspace_id=p_workspace_id;
  return jsonb_build_object('packageId',package.id,'currentRevision',current_revision,
    'items',items);
end $$;
revoke all on function public.d5o_d4_list_staged_uploads_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_list_staged_uploads_v1(uuid,uuid) to authenticated;

create function public.d5o_d4_prepare_upload_v1(
  p_workspace_id uuid,p_request_id uuid,p_expected_package_revision integer,
  p_expected_job_revision integer,p_filename text,p_mime_type text,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; request public.d5o_trial_d4_evidence_requests%rowtype;
  package public.d5o_trial_d4_packages%rowtype;
  current_revision integer; current_job_revision integer;
  cached public.command_idempotency%rowtype; request_hash text;
  pending_intent public.d5o_trial_d4_upload_intents%rowtype;
  evidence_id uuid; safe_name text; object_path text;
  audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_d4_package_authority(p_workspace_id);
  if p_expected_package_revision is null or p_expected_package_revision<1
    or p_expected_job_revision is null or p_expected_job_revision<1
    or length(btrim(coalesce(p_filename,''))) not between 1 and 120
    or p_mime_type not in ('text/plain','application/pdf','image/png','image/jpeg','image/webp')
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_d4_upload'; end if;
  select * into request from public.d5o_trial_d4_evidence_requests
    where id=p_request_id and workspace_id=p_workspace_id for share;
  select * into package from public.d5o_trial_d4_packages
    where id=request.package_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if request.id is null or package.id is null then raise exception 'd4_upload_scope_invalid'; end if;
  select revision into current_revision from public.d5o_trial_d4_package_versions
    where package_id=package.id order by revision desc limit 1 for share;
  select revision into current_job_revision from public.d5o_trial_rm_job_versions
    where work_id=package.work_id order by revision desc limit 1 for share;
  if request.package_revision<>current_revision or request.job_revision<>current_job_revision
    or current_revision<>p_expected_package_revision
    or current_job_revision<>p_expected_job_revision then
    raise exception 'd4_upload_stale'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'd4.upload.intent.v1',auth.uid(),p_workspace_id,p_request_id,
    p_expected_package_revision,p_expected_job_revision,p_filename,p_mime_type));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.d4.upload.intent.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  -- A lost browser/server response can retry the same actor/request/file without
  -- creating another pending object. Byte equality is verified by the server.
  select i.* into pending_intent from public.d5o_trial_d4_upload_intents i
    join public.evidence_objects e on e.id=i.evidence_id
    where i.request_id=request.id and i.uploaded_by=auth.uid()
      and i.package_revision=current_revision and i.job_revision=current_job_revision
      and e.original_filename=p_filename and e.mime_type=p_mime_type
      and e.upload_status='pending_upload'
    order by i.created_at desc limit 1 for share of i;
  if pending_intent.evidence_id is not null then
    return jsonb_build_object('success',true,'evidenceId',pending_intent.evidence_id,
      'bucket','d5o-trial-d4-evidence','objectPath',pending_intent.object_path,
      'packageId',package.id,'packageRevision',current_revision,
      'auditId',pending_intent.audit_event_id,
      'eventId',pending_intent.domain_event_id,
      'uploadStatus','pending_upload','releaseEligible',false,'reused',true);
  end if;
  evidence_id:=gen_random_uuid();
  safe_name:=left(regexp_replace(btrim(p_filename),'[^a-zA-Z0-9._-]','-','g'),120);
  object_path:=p_workspace_id::text||'/'||package.organization_id::text||'/'
    ||package.id::text||'/'||current_revision::text||'/'||request.id::text
    ||'/'||evidence_id::text||'/'||safe_name;
  insert into public.evidence_objects(id,workspace_id,project_id,bucket_id,
    object_path,original_filename,mime_type,uploaded_by)
  values(evidence_id,p_workspace_id,null,'d5o-trial-d4-evidence',object_path,
    p_filename,p_mime_type,auth.uid());
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,
    'd5o_trial_d4_upload',evidence_id,p_command_id,'d4.upload_intent_created',
    null,'pending_upload',auth.uid(),p_command_id,'{}'::jsonb,
    jsonb_build_object('requestId',request.id,'filename',p_filename),
    jsonb_build_object('workId',package.work_id,'packageId',package.id,
      'packageRevision',current_revision,'jobRevision',current_job_revision));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,
    'd5o_trial_d4_upload',evidence_id,1,'d4.upload_intent_created',
    1,p_command_id,p_command_id,auth.uid(),jsonb_build_object(
      'workId',package.work_id,'packageId',package.id,'requestId',request.id,
      'packageRevision',current_revision));
  insert into public.d5o_trial_d4_upload_intents(evidence_id,workspace_id,
    configuration_tenant_id,organization_id,work_id,package_id,
    package_revision,job_revision,request_id,uploaded_by,object_path,
    audit_event_id,domain_event_id)
  values(evidence_id,p_workspace_id,package.configuration_tenant_id,
    package.organization_id,package.work_id,package.id,current_revision,
    current_job_revision,request.id,auth.uid(),object_path,audit_id,event_id);
  result:=jsonb_build_object('success',true,'evidenceId',evidence_id,
    'bucket','d5o-trial-d4-evidence','objectPath',object_path,
    'packageId',package.id,'packageRevision',current_revision,
    'auditId',audit_id,'eventId',event_id,'uploadStatus','pending_upload',
    'releaseEligible',false);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.d4.upload.intent.v1',
    'd5o_trial_d4_upload',evidence_id,request_hash,auth.uid(),p_command_id,
    'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_d4_prepare_upload_v1(
  uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_prepare_upload_v1(
  uuid,uuid,integer,integer,text,text,text) to authenticated;

create function public.d5o_d4_acknowledge_upload_v1(
  p_evidence_id uuid,p_actor_id uuid,p_storage_object_id uuid,
  p_storage_version text,p_storage_updated_at timestamptz,
  p_size_bytes bigint,p_sha256 text,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare intent public.d5o_trial_d4_upload_intents%rowtype;
  evidence public.evidence_objects%rowtype; stored storage.objects%rowtype;
  audit_id uuid; event_id uuid; result jsonb;
begin
  select * into intent from public.d5o_trial_d4_upload_intents
    where evidence_id=p_evidence_id for share;
  select * into evidence from public.evidence_objects
    where id=p_evidence_id for update;
  if intent.evidence_id is null or evidence.id is null
    or intent.uploaded_by<>p_actor_id or evidence.uploaded_by<>p_actor_id
    or evidence.bucket_id<>'d5o-trial-d4-evidence'
    or evidence.object_path<>intent.object_path
    or p_size_bytes not between 1 and 1048576
    or p_sha256 !~ '^[0-9a-f]{64}$'
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'd4_upload_ack_invalid'; end if;
  select * into stored from storage.objects
    where id=p_storage_object_id and bucket_id=evidence.bucket_id
      and name=evidence.object_path for share;
  -- Storage's HTTP metadata is millisecond precision; Postgres retains microseconds.
  if stored.id is null or stored.version is distinct from p_storage_version
    or date_trunc('milliseconds',stored.updated_at) is distinct from p_storage_updated_at then
    raise exception 'd4_upload_storage_changed'; end if;
  if evidence.upload_status='uploaded' and evidence.version=2
    and evidence.size_bytes=p_size_bytes and evidence.checksum_sha256=p_sha256
    and evidence.scan_status='not_configured'
    and evidence.verification_status='pending' then
    return jsonb_build_object('success',true,'replayed',true,
      'evidenceId',evidence.id,'uploadStatus','uploaded',
      'scanStatus','not_configured','verificationStatus','pending',
      'releaseEligible',false);
  end if;
  if evidence.upload_status<>'pending_upload' or evidence.version<>1 then
    raise exception 'd4_upload_ack_invalid'; end if;
  update public.evidence_objects set upload_status='uploaded',scan_status='not_configured',
    verification_status='pending',size_bytes=p_size_bytes,
    checksum_sha256=p_sha256,version=2,uploaded_at=now()
    where id=evidence.id;
  audit_id:=rybex_internal.append_audit_event(intent.workspace_id,null,
    'd5o_trial_d4_upload',evidence.id,p_command_id,'d4.upload_staged',
    'pending_upload','uploaded',p_actor_id,p_command_id,
    jsonb_build_object('version',1),jsonb_build_object('version',2,
      'sizeBytes',p_size_bytes,'checksumSha256',p_sha256),
    jsonb_build_object('requestId',intent.request_id,'packageId',intent.package_id,
      'packageRevision',intent.package_revision,'scannerConfigured',false));
  event_id:=rybex_internal.append_domain_event(intent.workspace_id,null,
    'd5o_trial_d4_upload',evidence.id,2,'d4.upload_staged',1,
    p_command_id,p_command_id,p_actor_id,jsonb_build_object(
      'requestId',intent.request_id,'packageId',intent.package_id,
      'packageRevision',intent.package_revision,'scanStatus','not_configured'));
  result:=jsonb_build_object('success',true,'evidenceId',evidence.id,
    'uploadStatus','uploaded','scanStatus','not_configured',
    'verificationStatus','pending','auditId',audit_id,'eventId',event_id,
    'releaseEligible',false);
  return result;
end $$;
revoke all on function public.d5o_d4_acknowledge_upload_v1(
  uuid,uuid,uuid,text,timestamptz,bigint,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_acknowledge_upload_v1(
  uuid,uuid,uuid,text,timestamptz,bigint,text,text) to service_role;
commit;
