-- Rollback-only package matrix source and staleness check in scratch E.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  package_id uuid; payload jsonb; matrix jsonb; listed jsonb;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  package_id:=(listed->'items'->0->>'id')::uuid;
  matrix:=public.d5o_d4_package_clearance_matrix_v1(workspace,package_id);
  if matrix->>'packageRevision'<>'3' or matrix->>'custodyCandidates'<>'0'
    or matrix->'releaseEligible'<>'false'::jsonb
    or not exists(select 1 from jsonb_array_elements(matrix->'rows') row
      where row->>'key'='field_buildability' and row->>'status'='reviewed'
        and row->>'sourceId'=matrix->>'fieldReviewResponseId')
    or not exists(select 1 from jsonb_array_elements(matrix->'rows') row
      where row->>'key'='crew_capacity' and row->>'status'='blocked')
    or not exists(select 1 from jsonb_array_elements(matrix->'rows') row
      where row->>'key'='hseq_access' and row->>'status'='uncommissioned') then
    raise exception 'source matrix invalid: %',matrix; end if;
  begin
    perform public.d5o_d4_package_clearance_matrix_v1(
      'a2000000-0000-4000-8000-000000000002',package_id);
    raise exception 'cross_tenant_matrix_read_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  payload:=listed->'items'->0->'payload';
  perform public.d5o_d4_save_package_draft_v1(workspace,work,package_id,3,8,
    'd4-matrix-stale-rollback-01',jsonb_set(payload,'{scopeSummary}',
      '"Revised synthetic controls package scope that requires a fresh field review."'::jsonb));
  matrix:=public.d5o_d4_package_clearance_matrix_v1(workspace,package_id);
  if matrix->>'packageRevision'<>'4'
    or not exists(select 1 from jsonb_array_elements(matrix->'rows') row
      where row->>'key'='field_buildability' and row->>'status'='missing')
    or matrix->'releaseEligible'<>'false'::jsonb then
    raise exception 'new revision inherited old review: %',matrix; end if;
  raise notice 'PASS D4 matrix scoped source, partial crew, absent custody, revision reset and release hold';
end $$;
rollback;
