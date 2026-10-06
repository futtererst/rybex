-- BRC-01: forward-only baseline reconciliation; historical SQL remains immutable.
create table rybex_internal.evidence_scan_receipts (
 id uuid primary key default gen_random_uuid(),
 evidence_object_id uuid not null references public.evidence_objects(id) on delete restrict,
 workspace_id uuid not null references public.workspaces(id) on delete restrict,
 project_id uuid references public.projects(id) on delete restrict,
 requested_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
 storage_object_id uuid not null, bucket_id text not null, object_path text not null,
 storage_version text not null check(length(storage_version)>0), storage_updated_at timestamptz not null,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), size_bytes bigint not null check(size_bytes>=0),
 scanner text not null check(length(trim(scanner))>0),
 result text not null check(result in ('clean','infected','scanner_unavailable','scan_failed')),
 scanned_at timestamptz not null, expected_evidence_version integer not null check(expected_evidence_version>0),
 correlation_id text not null, receipt_idempotency_key text not null check(length(trim(receipt_idempotency_key))>0),
 payload_digest text not null,
 unique(workspace_id,receipt_idempotency_key),
 unique(evidence_object_id,expected_evidence_version,requested_by_auth_user_id,storage_object_id,storage_version,storage_updated_at,sha256,size_bytes,result)
);
alter table rybex_internal.evidence_scan_receipts enable row level security;
revoke all on rybex_internal.evidence_scan_receipts from public,anon,authenticated,service_role;
create function rybex_internal.prevent_evidence_scan_receipt_mutation() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin raise exception 'scan_receipt_immutable'; end; $$;
revoke all on function rybex_internal.prevent_evidence_scan_receipt_mutation() from public,anon,authenticated,service_role;
create trigger evidence_scan_receipt_immutable before update or delete on rybex_internal.evidence_scan_receipts
for each row execute function rybex_internal.prevent_evidence_scan_receipt_mutation();

create function public.record_evidence_scan_receipt_v1(
 p_evidence_id uuid, p_workspace_id uuid, p_project_id uuid, p_requested_by uuid,
 p_storage_object_id uuid, p_bucket_id text, p_object_path text, p_storage_version text,
 p_storage_updated_at timestamptz, p_sha256 text, p_size_bytes bigint, p_scanner text,
 p_result text, p_scanned_at timestamptz, p_expected_version integer,
 p_correlation_id text, p_receipt_key text
) returns jsonb language plpgsql security definer set search_path=public,rybex_internal,pg_temp as $$
declare e public.evidence_objects%rowtype; o storage.objects%rowtype;
 receipt rybex_internal.evidence_scan_receipts%rowtype; digest text; audit_id uuid;
begin
 -- ACL is the admission boundary; never accept an ordinary user's claimed role.
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    and coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' is distinct from 'service_role'
 then raise exception 'scanner_authority_required' using errcode='42501'; end if;
 select * into e from public.evidence_objects where id=p_evidence_id for update;
 if not found or e.workspace_id is distinct from p_workspace_id or e.project_id is distinct from p_project_id
 or e.bucket_id is distinct from p_bucket_id or e.object_path is distinct from p_object_path
 or e.version is distinct from p_expected_version or e.upload_status<>'pending_upload' then raise exception 'scan_receipt_scope_or_version_mismatch'; end if;
 if not exists(select 1 from public.workspace_memberships wm join public.user_profiles up on up.id=wm.user_profile_id
  where wm.workspace_id=e.workspace_id and wm.user_id=p_requested_by and up.user_id=p_requested_by
  and up.auth_user_id=p_requested_by and wm.status='active' and up.status='active'
  and (e.project_id is null or wm.role in ('executive','operations_leader','project_manager','billing_commercial_lead','closeout_lead','admin')
    or exists(select 1 from public.project_memberships pm where pm.project_id=e.project_id and pm.workspace_id=e.workspace_id and pm.user_id=p_requested_by and pm.status='active')))
 then raise exception 'scan_requester_not_authorized'; end if;
 select * into o from storage.objects where id=p_storage_object_id for share;
 if not found or o.bucket_id is distinct from e.bucket_id or o.name is distinct from e.object_path
 or o.version is distinct from p_storage_version or date_trunc('milliseconds',o.updated_at) is distinct from p_storage_updated_at
 or o.version is null or o.version='' or (o.metadata->>'size')::bigint is distinct from p_size_bytes then raise exception 'scan_storage_version_mismatch'; end if;
 if p_scanned_at is null or p_scanned_at>clock_timestamp()+interval '1 minute' then raise exception 'invalid_scan_time'; end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array(p_evidence_id,p_workspace_id,p_project_id,p_requested_by,p_storage_object_id,p_bucket_id,p_object_path,p_storage_version,o.updated_at,p_sha256,p_size_bytes,p_scanner,p_result,p_expected_version)::text,'UTF8'),'sha256'),'hex');
 select * into receipt from rybex_internal.evidence_scan_receipts where workspace_id=e.workspace_id and receipt_idempotency_key=p_receipt_key;
 if found then
  if receipt.payload_digest<>digest then raise exception 'scan_receipt_idempotency_mismatch'; end if;
  return jsonb_build_object('success',true,'receiptId',receipt.id,'replayed',true);
 end if;
 select * into receipt from rybex_internal.evidence_scan_receipts where evidence_object_id=e.id and expected_evidence_version=e.version
 and requested_by_auth_user_id=p_requested_by and storage_object_id=o.id and storage_version=o.version and storage_updated_at=o.updated_at
 and sha256=p_sha256 and size_bytes=p_size_bytes and result=p_result;
 if found then
  if receipt.payload_digest<>digest then raise exception 'conflicting_scan_receipt'; end if;
  return jsonb_build_object('success',true,'receiptId',receipt.id,'replayed',true);
 end if;
 insert into rybex_internal.evidence_scan_receipts(evidence_object_id,workspace_id,project_id,requested_by_auth_user_id,storage_object_id,bucket_id,object_path,storage_version,storage_updated_at,sha256,size_bytes,scanner,result,scanned_at,expected_evidence_version,correlation_id,receipt_idempotency_key,payload_digest)
 values(e.id,e.workspace_id,e.project_id,p_requested_by,o.id,o.bucket_id,o.name,o.version,o.updated_at,p_sha256,p_size_bytes,p_scanner,p_result,p_scanned_at,e.version,p_correlation_id,p_receipt_key,digest) returning * into receipt;
 audit_id:=rybex_internal.append_audit_event(e.workspace_id,e.project_id,'evidence_scan_receipt',receipt.id,p_receipt_key,'evidence.scan_recorded',null,p_result,p_requested_by,p_correlation_id,'{}'::jsonb,jsonb_build_object('result',p_result,'receiptId',receipt.id),jsonb_build_object('attester','service_role','scanner',p_scanner,'requestedBy',p_requested_by,'evidenceId',e.id,'storageObjectId',o.id,'storageVersion',o.version,'sha256',p_sha256));
 return jsonb_build_object('success',true,'receiptId',receipt.id,'auditEventId',audit_id,'replayed',false);
end; $$;
revoke all on function public.record_evidence_scan_receipt_v1(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,bigint,text,text,timestamptz,integer,text,text) from public,anon,authenticated;
grant execute on function public.record_evidence_scan_receipt_v1(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,bigint,text,text,timestamptz,integer,text,text) to service_role;

create or replace function public.finalize_evidence_upload_v1(
 p_evidence_id uuid,p_entity_type text,p_entity_id uuid,p_relationship_type text,p_size_bytes bigint,p_checksum_sha256 text,
 p_expected_version integer,p_command_id text,p_correlation_id text default null
) returns jsonb language plpgsql security definer set search_path=public,rybex_internal,pg_temp as $$
declare actor uuid:=auth.uid(); e public.evidence_objects%rowtype; o storage.objects%rowtype;
 receipt rybex_internal.evidence_scan_receipts%rowtype; receipt_count integer;
 prior public.command_idempotency%rowtype; claim record; digest text; old_digest text;
 audit_id uuid; event_id uuid; link_id uuid; result jsonb; command_payload jsonb;
 correlation text:=coalesce(nullif(p_correlation_id,''),gen_random_uuid()::text);
begin
 if actor is null then return jsonb_build_object('success',false,'error','unauthenticated'); end if;
 select * into e from public.evidence_objects where id=p_evidence_id for update;
 if not found then return jsonb_build_object('success',false,'error','not_found'); end if;
 if not public.is_active_workspace_member(e.workspace_id) or (e.project_id is not null and not public.can_access_project(e.project_id)) then return jsonb_build_object('success',false,'error','forbidden'); end if;
 command_payload:=jsonb_build_array('brc01',actor,e.workspace_id,e.project_id,e.id,p_entity_type,p_entity_id,coalesce(nullif(p_relationship_type,''),'evidence'),p_expected_version,p_size_bytes,p_checksum_sha256);
 select * into prior from public.command_idempotency where workspace_id=e.workspace_id and command_id=p_command_id;
 if found then
  if prior.command_type<>'evidence.finalize_upload.v1' or prior.entity_id<>e.id then return jsonb_build_object('success',false,'error','idempotency_mismatch'); end if;
  if prior.result_payload->>'hashVersion'='brc01' then
   digest:=encode(extensions.digest(convert_to((command_payload||jsonb_build_array(prior.result_payload->>'scanReceiptId'))::text,'UTF8'),'sha256'),'hex');
   if digest<>prior.request_hash then return jsonb_build_object('success',false,'error','idempotency_mismatch'); end if;
  else
   old_digest:=encode(extensions.digest(convert_to(e.id::text||'|'||p_expected_version::text||'|'||p_size_bytes::text||'|'||p_checksum_sha256,'UTF8'),'sha256'),'hex');
   if prior.actor_user_id<>actor or prior.request_hash<>old_digest then return jsonb_build_object('success',false,'error','idempotency_mismatch'); end if;
  end if;
  if prior.result_status='completed' then return prior.result_payload||jsonb_build_object('success',true,'replayed',true); end if;
  return jsonb_build_object('success',false,'error','command_in_progress');
 end if;
 if e.version<>p_expected_version then return jsonb_build_object('success',false,'error','concurrency_conflict','currentVersion',e.version); end if;
 if e.upload_status<>'pending_upload' then return jsonb_build_object('success',false,'error','evidence_not_pending'); end if;
 select * into o from storage.objects where bucket_id=e.bucket_id and name=e.object_path for share;
 if not found then return jsonb_build_object('success',false,'error','missing_storage_object'); end if;
 if o.version is null or o.version='' then raise exception 'storage_version_unavailable'; end if;
 select count(*) into receipt_count from rybex_internal.evidence_scan_receipts s where s.evidence_object_id=e.id and s.workspace_id=e.workspace_id
 and s.project_id is not distinct from e.project_id and s.requested_by_auth_user_id=actor and s.expected_evidence_version=e.version
 and s.storage_object_id=o.id and s.storage_version=o.version and s.storage_updated_at=o.updated_at and s.bucket_id=o.bucket_id and s.object_path=o.name
 and s.sha256=p_checksum_sha256 and s.size_bytes=p_size_bytes and s.result='clean';
 if receipt_count<>1 or (o.metadata->>'size')::bigint is distinct from p_size_bytes then raise exception 'evidence_scan_not_clean'; end if;
 select * into strict receipt from rybex_internal.evidence_scan_receipts s where s.evidence_object_id=e.id and s.requested_by_auth_user_id=actor and s.expected_evidence_version=e.version and s.storage_object_id=o.id and s.storage_version=o.version and s.storage_updated_at=o.updated_at and s.sha256=p_checksum_sha256 and s.size_bytes=p_size_bytes and s.result='clean';
 digest:=encode(extensions.digest(convert_to((command_payload||jsonb_build_array(receipt.id::text))::text,'UTF8'),'sha256'),'hex');
 select * into claim from rybex_internal.claim_or_replay_command(e.workspace_id,p_command_id,'evidence.finalize_upload.v1','evidence_object',e.id,digest,actor,correlation);
 if claim.action='mismatch' then return jsonb_build_object('success',false,'error','idempotency_mismatch'); end if;
 if claim.action='replay' then return claim.existing_result||jsonb_build_object('success',true,'replayed',true); end if;
 update public.evidence_objects set upload_status='uploaded',scan_status='clean',verification_status='pending',size_bytes=p_size_bytes,checksum_sha256=p_checksum_sha256,version=e.version+1,uploaded_at=now() where id=e.id;
 insert into public.evidence_links(workspace_id,project_id,evidence_object_id,entity_type,entity_id,relationship_type,created_by)
 values(e.workspace_id,e.project_id,e.id,p_entity_type,p_entity_id,coalesce(nullif(p_relationship_type,''),'evidence'),actor)
 on conflict(workspace_id,evidence_object_id,entity_type,entity_id,relationship_type) do update set relationship_type=excluded.relationship_type returning id into link_id;
 audit_id:=rybex_internal.append_audit_event(e.workspace_id,e.project_id,'evidence_object',e.id,p_command_id,'evidence.upload_finalized',e.upload_status,'uploaded',actor,correlation,jsonb_build_object('uploadStatus',e.upload_status,'version',e.version),jsonb_build_object('uploadStatus','uploaded','version',e.version+1,'sizeBytes',p_size_bytes,'checksumSha256',p_checksum_sha256),jsonb_build_object('entityType',p_entity_type,'entityId',p_entity_id,'scanReceiptId',receipt.id));
 event_id:=rybex_internal.append_domain_event(e.workspace_id,e.project_id,'evidence_object',e.id,e.version+1,'evidence.upload_finalized',1,p_command_id,correlation,actor,jsonb_build_object('evidenceId',e.id,'entityType',p_entity_type,'entityId',p_entity_id,'scanReceiptId',receipt.id));
 result:=jsonb_build_object('success',true,'replayed',false,'evidenceId',e.id,'linkId',link_id,'resultingVersion',e.version+1,'auditEventId',audit_id,'domainEventId',event_id,'correlationId',correlation,'hashVersion','brc01','scanReceiptId',receipt.id);
 perform rybex_internal.complete_command(e.workspace_id,p_command_id,result);return result;
end; $$;
