-- Rollback-only D4 upload intent, private policy, role/tenant and release-hold check.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  package_id uuid:='582643ae-4e8e-4be7-a8e3-8b1f9f595d84';
  request_id uuid; requests jsonb; prepared jsonb; replay jsonb;
  staged jsonb; matrix jsonb;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  requests:=public.d5o_d4_list_evidence_requests_v1(workspace,package_id);
  request_id:=(requests->'items'->0->>'id')::uuid;
  prepared:=public.d5o_d4_prepare_upload_v1(workspace,request_id,3,8,
    'rollback-private.txt','text/plain','d4-private-intent-rollback-01');
  if prepared->>'uploadStatus'<>'pending_upload'
    or prepared->'releaseEligible'<>'false'::jsonb
    or prepared->>'auditId' is null or prepared->>'eventId' is null
    or prepared->>'bucket'<>'d5o-trial-d4-evidence' then
    raise exception 'prepare_failed: %',prepared; end if;
  replay:=public.d5o_d4_prepare_upload_v1(workspace,request_id,3,8,
    'rollback-private.txt','text/plain','d4-private-intent-rollback-01');
  if replay->'replayed'<>'true'::jsonb
    or replay->>'evidenceId'<>prepared->>'evidenceId' then
    raise exception 'prepare_replay_failed'; end if;
  if not public.d5o_trial_d4_can_insert_storage_v1(
    prepared->>'bucket',prepared->>'objectPath') then
    raise exception 'owner_storage_insert_denied'; end if;
  if exists(select 1 from public.evidence_objects
    where id=(prepared->>'evidenceId')::uuid) then
    raise exception 'private_evidence_metadata_directly_visible'; end if;
  if has_table_privilege('authenticated','public.d5o_trial_d4_upload_intents','SELECT')
    or has_table_privilege('authenticated','public.d5o_trial_d4_upload_intents','INSERT') then
    raise exception 'intent_table_direct_access_allowed'; end if;
  staged:=public.d5o_d4_list_staged_uploads_v1(workspace,package_id);
  if not exists(select 1 from jsonb_array_elements(staged->'items') x
    where x->>'evidenceId'=prepared->>'evidenceId'
      and x->>'uploadStatus'='pending_upload') then
    raise exception 'scoped_staging_read_failed'; end if;
  matrix:=public.d5o_d4_package_clearance_matrix_v1(workspace,package_id);
  if matrix->>'custodyCandidates'<>'0'
    or matrix->'releaseEligible'<>'false'::jsonb then
    raise exception 'pending_intent_counted_as_clearance'; end if;
  begin
    perform public.d5o_d4_prepare_upload_v1(workspace,request_id,2,8,
      'stale-private.txt','text/plain','d4-private-stale-rollback-01');
    raise exception 'stale_upload_allowed';
  exception when others then if sqlerrm<>'d4_upload_stale' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  if public.d5o_trial_d4_can_insert_storage_v1(
    prepared->>'bucket',prepared->>'objectPath') then
    raise exception 'other_actor_storage_insert_allowed'; end if;
  begin
    perform public.d5o_d4_prepare_upload_v1(workspace,request_id,3,8,
      'wrong-role.txt','text/plain','d4-private-role-rollback-01');
    raise exception 'wrong_role_upload_allowed';
  exception when others then if sqlerrm<>'d4_package_permission_denied' then raise; end if;
  end;
  begin
    perform public.d5o_d4_list_staged_uploads_v1(
      'a2000000-0000-4000-8000-000000000002',package_id);
    raise exception 'cross_tenant_staging_read_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  raise notice 'PASS D4 private intent/replay/owner-policy/role/tenant/stale/privacy/release hold';
end $$;
rollback;
