-- Rollback-only field review handoff check in disposable scratch E.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  package_id uuid; payload jsonb; submitted jsonb; replay jsonb;
  returned jsonb; revised jsonb; reviewed jsonb; listed jsonb;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  listed:=public.d5o_d4_list_package_drafts_v1(workspace,work);
  package_id:=(listed->'items'->0->>'id')::uuid;
  payload:=listed->'items'->0->'payload';
  if package_id is null or listed->'items'->0->>'revision'<>'2' then
    raise exception 'trial_package_missing'; end if;
  submitted:=public.d5o_d4_submit_buildability_v1(workspace,work,package_id,2,8,
    'd4-field-submit-rollback-01');
  if submitted->>'state'<>'pending' or submitted->'releaseEligible'<>'false'::jsonb
    or submitted->>'auditId' is null or submitted->>'eventId' is null then
    raise exception 'field submission failed: %',submitted; end if;
  replay:=public.d5o_d4_submit_buildability_v1(workspace,work,package_id,2,8,
    'd4-field-submit-rollback-01');
  if replay->'replayed'<>'true'::jsonb
    or replay->>'submissionId'<>submitted->>'submissionId' then
    raise exception 'submission replay failed'; end if;
  begin
    perform public.d5o_d4_respond_buildability_v1(workspace,
      (submitted->>'submissionId')::uuid,'reviewed',
      'Operations may not review its own submitted package.',
      'd4-field-self-rollback-01');
    raise exception 'author_review_allowed';
  exception when others then if sqlerrm<>'d4_field_permission_denied' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  listed:=public.d5o_d4_list_buildability_v1(workspace,work);
  if listed->'canRespond'<>'true'::jsonb
    or listed->'canSubmit'<>'false'::jsonb
    or listed->'items'->0->>'packageRevision'<>'2' then
    raise exception 'review queue failed: %',listed; end if;
  returned:=public.d5o_d4_respond_buildability_v1(workspace,
    (submitted->>'submissionId')::uuid,'returned',
    'Clarify isolation sequence before field buildability review.',
    'd4-field-return-rollback-01');
  if returned->>'disposition'<>'returned' or returned->'releaseEligible'<>'false'::jsonb
    or returned->>'auditId' is null or returned->>'eventId' is null then
    raise exception 'field return failed: %',returned; end if;
  replay:=public.d5o_d4_respond_buildability_v1(workspace,
    (submitted->>'submissionId')::uuid,'returned',
    'Clarify isolation sequence before field buildability review.',
    'd4-field-return-rollback-01');
  if replay->'replayed'<>'true'::jsonb then raise exception 'response replay failed'; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  revised:=public.d5o_d4_save_package_draft_v1(workspace,work,package_id,2,8,
    'd4-field-revise-rollback-01',jsonb_set(payload,'{hazardNotes}',
      '"Revised isolation sequence: disconnect, lock out and test before work."'::jsonb));
  if revised->>'revision'<>'3' then raise exception 'revision after return failed'; end if;
  submitted:=public.d5o_d4_submit_buildability_v1(workspace,work,package_id,3,8,
    'd4-field-submit-rollback-02');
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  reviewed:=public.d5o_d4_respond_buildability_v1(workspace,
    (submitted->>'submissionId')::uuid,'reviewed',
    'Field sequence reviewed for this frozen draft revision only.',
    'd4-field-review-rollback-02');
  if reviewed->>'disposition'<>'reviewed'
    or reviewed->'releaseEligible'<>'false'::jsonb then
    raise exception 'review result failed'; end if;
  begin
    perform public.d5o_d4_list_buildability_v1(
      'a2000000-0000-4000-8000-000000000002',work);
    raise exception 'cross_tenant_review_read_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if;
  end;
  if has_table_privilege('authenticated','public.d5o_trial_d4_field_submissions','SELECT')
    or has_table_privilege('authenticated','public.d5o_trial_d4_field_responses','SELECT') then
    raise exception 'direct_review_table_read_allowed'; end if;
  raise notice 'PASS D4 buildability submit/replay/return/revise/review/role/tenant/release hold';
end $$;
rollback;
