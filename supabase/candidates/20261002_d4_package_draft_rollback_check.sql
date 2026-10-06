-- Rollback-only D4 draft authority and version check in disposable scratch E.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  payload jsonb:='{"scopeSummary":"Prepare synthetic campus controls installation package for review.","siteZone":"North Campus","methodReference":"DRAFT-METHOD-01","hazardNotes":"Draft hazard list pending HSEQ clearance.","permitNotes":"Permit requirements to be reviewed.","materialNotes":"Material list requires supply confirmation.","testInstructions":"Draft functional test instructions.","holdPoints":"Supervisor hold before energization.","contingency":"Stop and escalate for unexpected live equipment.","plannedStart":"2026-10-05T12:00:00Z","plannedEnd":"2026-10-05T20:00:00Z"}'::jsonb;
  first_save jsonb; replay jsonb; second_save jsonb; listed jsonb;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  first_save:=public.d5o_d4_save_package_draft_v1(workspace,work,null,0,8,
    'd4-draft-create-rollback-01',payload);
  if first_save->>'state'<>'draft' or first_save->>'revision'<>'1'
    or first_save->'releaseEligible'<>'false'::jsonb
    or first_save->>'auditId' is null or first_save->>'eventId' is null then
    raise exception 'first draft failed: %',first_save; end if;
  replay:=public.d5o_d4_save_package_draft_v1(workspace,work,null,0,8,
    'd4-draft-create-rollback-01',payload);
  if replay->'replayed'<>'true'::jsonb
    or replay->>'packageId'<>first_save->>'packageId' then
    raise exception 'draft replay failed'; end if;
  second_save:=public.d5o_d4_save_package_draft_v1(workspace,work,
    (first_save->>'packageId')::uuid,1,8,'d4-draft-revise-rollback-01',
    jsonb_set(payload,'{hazardNotes}',
      '"Updated draft hazards pending HSEQ clearance."'::jsonb));
  if second_save->>'revision'<>'2' then raise exception 'draft revision failed'; end if;
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  if jsonb_array_length(listed->'items')<>1
    or listed->'items'->0->>'revision'<>'2'
    or listed->'canEdit'<>'true'::jsonb then raise exception 'list failed: %',listed; end if;
  begin
    perform public.d5o_d4_save_package_draft_v1(workspace,work,
      (first_save->>'packageId')::uuid,1,8,'d4-draft-stale-rollback-01',payload);
    raise exception 'stale_revision_allowed';
  exception when others then if sqlerrm<>'d4_package_conflict' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  if listed->'canEdit'<>'false'::jsonb then raise exception 'dispatcher edit advertised'; end if;
  begin
    perform public.d5o_d4_save_package_draft_v1(workspace,work,
      (first_save->>'packageId')::uuid,2,8,'d4-draft-dispatch-rollback-01',payload);
    raise exception 'dispatcher_edit_allowed';
  exception when others then if sqlerrm<>'d4_package_permission_denied' then raise; end if;
  end;
  begin
    perform public.d5o_d4_list_package_drafts_v1(
      'a2000000-0000-4000-8000-000000000002',work);
    raise exception 'cross_tenant_read_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  if has_table_privilege('authenticated','public.d5o_trial_d4_packages','SELECT')
    or has_table_privilege('authenticated','public.d5o_trial_d4_package_versions','SELECT') then
    raise exception 'direct_table_read_allowed'; end if;
  raise notice 'PASS D4 draft create/replay/revise/stale/read-only role/tenant/table denial';
end $$;
rollback;
