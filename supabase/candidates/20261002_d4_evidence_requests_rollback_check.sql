-- Rollback-only evidence request, authority, version and release-hold check.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  package_id uuid; listed jsonb; recorded jsonb; replay jsonb;
  request_id uuid; payload jsonb; matrix jsonb; baseline_count integer;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  package_id:=(listed->'items'->0->>'id')::uuid;
  if listed->'items'->0->>'revision'<>'3' then raise exception 'package_revision_changed'; end if;
  listed:=public.d5o_d4_list_evidence_requests_v1(workspace,package_id);
  baseline_count:=jsonb_array_length(listed->'items');
  if listed->'canRequest'<>'true'::jsonb then
    raise exception 'request_baseline_invalid: %',listed; end if;
  recorded:=public.d5o_d4_record_evidence_request_v1(workspace,package_id,3,8,
    'technical_design','Approved method revision',
    'Independent technical reviewer verifies the controlled method revision and scope.',
    'd4-evidence-request-rollback-01');
  request_id:=(recorded->>'requestId')::uuid;
  if recorded->>'status'<>'evidence_needed'
    or recorded->'releaseEligible'<>'false'::jsonb
    or recorded->>'auditId' is null or recorded->>'eventId' is null then
    raise exception 'request_record_failed: %',recorded; end if;
  replay:=public.d5o_d4_record_evidence_request_v1(workspace,package_id,3,8,
    'technical_design','Approved method revision',
    'Independent technical reviewer verifies the controlled method revision and scope.',
    'd4-evidence-request-rollback-01');
  if replay->'replayed'<>'true'::jsonb or replay->>'requestId'<>request_id::text then
    raise exception 'request_replay_failed'; end if;
  listed:=public.d5o_d4_list_evidence_requests_v1(workspace,package_id);
  if jsonb_array_length(listed->'items')<>baseline_count+1
    or listed->'items'->0->>'status'<>'evidence_needed' then
    raise exception 'request_readback_failed: %',listed; end if;
  matrix:=public.d5o_d4_package_clearance_matrix_v1(workspace,package_id);
  if matrix->'releaseEligible'<>'false'::jsonb
    or not exists(select 1 from jsonb_array_elements(matrix->'rows') row
      where row->>'key'='technical_design' and row->>'status'='uncommissioned') then
    raise exception 'request_mistaken_for_clearance'; end if;
  begin
    perform public.d5o_d4_record_evidence_request_v1(workspace,package_id,2,8,
      'technical_design','Old package revision',
      'A stale package request must be rejected by the server.',
      'd4-evidence-request-rollback-02');
    raise exception 'stale_request_allowed';
  exception when others then if sqlerrm<>'d4_evidence_request_stale' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  listed:=public.d5o_d4_list_evidence_requests_v1(workspace,package_id);
  if listed->'canRequest'<>'false'::jsonb
    or jsonb_array_length(listed->'items')<>baseline_count+1 then
    raise exception 'read_only_scope_failed'; end if;
  begin
    perform public.d5o_d4_record_evidence_request_v1(workspace,package_id,3,8,
      'hseq_access','Site access evidence',
      'HSEQ reviewer verifies the applicable current site access source.',
      'd4-evidence-request-rollback-03');
    raise exception 'field_request_allowed';
  exception when others then if sqlerrm<>'d4_package_permission_denied' then raise; end if;
  end;
  begin
    perform public.d5o_d4_list_evidence_requests_v1(
      'a2000000-0000-4000-8000-000000000002',package_id);
    raise exception 'cross_tenant_request_read_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  if has_table_privilege('authenticated','public.d5o_trial_d4_evidence_requests','SELECT')
    or has_table_privilege('authenticated','public.d5o_trial_d4_evidence_requests','INSERT') then
    raise exception 'direct_request_table_access_allowed'; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  payload:=listed->'items'->0->'payload';
  perform public.d5o_d4_save_package_draft_v1(workspace,work,package_id,3,8,
    'd4-evidence-request-revise-rollback-01',jsonb_set(payload,'{scopeSummary}',
      '"Revised package scope retaining old evidence request only as history."'::jsonb));
  listed:=public.d5o_d4_list_evidence_requests_v1(workspace,package_id);
  if listed->>'currentRevision'<>'4'
    or listed->'items'->0->>'status'<>'historical' then
    raise exception 'request_revision_reset_failed: %',listed; end if;
  raise notice 'PASS D4 evidence request write/replay/read/role/tenant/stale/revision/release hold';
end $$;
rollback;
