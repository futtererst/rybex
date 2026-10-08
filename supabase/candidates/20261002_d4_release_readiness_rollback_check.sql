-- Rollback-only check against disposable Discover scratch E.
begin;
set local role authenticated;
do $$
declare review jsonb; workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  review:=public.d5o_rm_d4_readiness_v1(workspace,work);
  if review->>'workId'<>work::text or review->>'jobRevision'<>'8'
    or review->>'plannedPeople'<>'2'
    or (review->>'minimumCrewAcrossWindow')::integer>=3
    or not(review->'blockers' ? 'crew_window_incomplete')
    or not(review->'blockers' ? 'g3_scope_authority_unconnected')
    or review->'releaseEligible'<>'false'::jsonb
    or review->'releaseAvailable'<>'false'::jsonb then
    raise exception 'D4 readiness did not remain blocked: %',review; end if;
  begin
    perform public.d5o_rm_d4_readiness_v1('a2000000-0000-4000-8000-000000000002',work);
    raise exception 'cross_tenant_read_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  begin
    perform public.d5o_rm_d4_readiness_v1(workspace,
      'a56ec104-aa58-4e78-b9f3-f1f62a70a23b');
    raise exception 'unlinked_job_read_allowed';
  exception when others then if sqlerrm<>'rm_d4_scope_invalid' then raise; end if;
  end;
  if has_function_privilege('authenticated',
      'public.d5o_rm_d4_readiness_v1(uuid,uuid)','EXECUTE') is not true then
    raise exception 'dispatcher_read_function_not_available'; end if;
  raise notice 'PASS D4 scoped read, partial-window blocker, mandatory release hold and tenant denial';
end $$;
rollback;
