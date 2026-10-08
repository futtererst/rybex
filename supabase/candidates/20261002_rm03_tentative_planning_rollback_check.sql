-- Rollback-only RM03 tentative planning boundary check in disposable scratch E.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  controls uuid:='67542a88-4587-4235-a8a4-e67747ffce5b';
  mechanical uuid:='2393ecc7-e704-4812-8c96-1ace1d2fe5e8';
  preview jsonb; first_shift jsonb; replay jsonb; adjacent jsonb; cancelled jsonb;
  job_revision integer; profile_revision integer;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  preview:=public.d5o_rm_preview_plan_shift_v1(workspace,work,controls,
    '2026-10-05 12:00+00','2026-10-05 16:00+00');
  job_revision:=(preview->>'jobRevision')::integer;
  profile_revision:=(preview->>'resourceRevision')::integer;
  if jsonb_array_length(preview->'blockers')<>0
    or jsonb_array_length(preview->'warnings')<>0
    or preview->'releaseEligible'<>'false'::jsonb then
    raise exception 'valid preview failed: %',preview; end if;
  first_shift:=public.d5o_rm_commit_plan_shift_v1(workspace,work,controls,
    '2026-10-05 12:00+00','2026-10-05 16:00+00',job_revision,profile_revision,
    '', 'rm03-plan-controls-01');
  if first_shift->>'state'<>'tentative' or first_shift->>'auditId' is null
    or first_shift->>'eventId' is null then raise exception 'commit failed: %',first_shift; end if;
  replay:=public.d5o_rm_commit_plan_shift_v1(workspace,work,controls,
    '2026-10-05 12:00+00','2026-10-05 16:00+00',job_revision,profile_revision,
    '', 'rm03-plan-controls-01');
  if replay->'replayed'<>'true'::jsonb or replay->>'shiftId'<>first_shift->>'shiftId' then
    raise exception 'replay failed'; end if;
  preview:=public.d5o_rm_preview_plan_shift_v1(workspace,work,controls,
    '2026-10-05 13:00+00','2026-10-05 15:00+00');
  if not(preview->'blockers' ? 'overlapping_plan') then raise exception 'overlap preview failed'; end if;
  begin
    perform public.d5o_rm_commit_plan_shift_v1(workspace,work,controls,
      '2026-10-05 13:00+00','2026-10-05 15:00+00',job_revision,profile_revision,
      '', 'rm03-overlap-controls-01');
    raise exception 'overlap_commit_allowed';
  exception when others then
    if sqlerrm not like 'rm_plan_blocked:%overlapping_plan%' then raise; end if;
  end;
  preview:=public.d5o_rm_preview_plan_shift_v1(workspace,work,controls,
    '2026-10-05 16:00+00','2026-10-05 20:00+00');
  if preview->'blockers' ? 'overlapping_plan' then raise exception 'adjacent blocked'; end if;
  adjacent:=public.d5o_rm_commit_plan_shift_v1(workspace,work,controls,
    '2026-10-05 16:00+00','2026-10-05 20:00+00',job_revision,profile_revision,
    '', 'rm03-adjacent-controls-01');
  if adjacent->>'state'<>'tentative' then raise exception 'adjacent failed'; end if;
  preview:=public.d5o_rm_preview_plan_shift_v1(workspace,work,mechanical,
    '2026-10-05 12:00+00','2026-10-05 16:00+00');
  if jsonb_array_length(preview->'warnings')<>2
    or preview->'crewAfterPlan'<>'2'::jsonb then raise exception 'skill/coverage warning failed: %',preview; end if;
  begin
    perform public.d5o_rm_commit_plan_shift_v1(workspace,work,mechanical,
      '2026-10-05 12:00+00','2026-10-05 16:00+00',job_revision,
      (preview->>'resourceRevision')::integer,'','rm03-unack-mechanical-01');
    raise exception 'unacknowledged_warning_allowed';
  exception when others then
    if sqlerrm<>'rm_plan_warning_ack_required' then raise; end if;
  end;
  preview:=public.d5o_rm_preview_plan_shift_v1(workspace,work,controls,
    '2026-10-05 11:00+00','2026-10-05 13:00+00');
  if not(preview->'blockers' ? 'outside_working_hours') then
    raise exception 'working hours blocker missing'; end if;
  cancelled:=public.d5o_rm_cancel_plan_shift_v1(workspace,
    (first_shift->>'shiftId')::uuid,
    'Move the first synthetic controls slot to a later reviewed window.',
    'rm03-cancel-controls-01');
  if cancelled->>'state'<>'cancelled' then raise exception 'cancel failed'; end if;
  preview:=public.d5o_rm_preview_plan_shift_v1(workspace,work,controls,
    '2026-10-05 12:00+00','2026-10-05 16:00+00');
  if preview->'blockers' ? 'overlapping_plan' then raise exception 'cancel did not release slot'; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  begin
    perform public.d5o_rm_preview_plan_shift_v1(workspace,work,controls,
      '2026-10-05 12:00+00','2026-10-05 16:00+00');
    raise exception 'dispatcher_preview_allowed';
  exception when others then
    if sqlerrm<>'rm_plan_permission_denied' then raise; end if;
  end;
  begin
    perform public.d5o_rm_list_plan_shifts_v1('a2000000-0000-4000-8000-000000000002');
    raise exception 'cross_tenant_list_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  if has_table_privilege('authenticated','public.d5o_trial_rm_plan_shifts','SELECT') then
    raise exception 'direct_table_read_allowed'; end if;
  raise notice 'PASS RM03 tentative preview/commit/replay/overlap/adjacent/skills/coverage/hours/cancel/role/tenant';
end $$;
rollback;
