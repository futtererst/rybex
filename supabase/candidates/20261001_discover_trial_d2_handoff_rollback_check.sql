-- Rollback-only authenticated scenario on disposable Discover scratch E.
begin;
set local role authenticated;
do $$
declare w uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  workspace uuid:='a2000000-0000-4000-8000-000000000001';
  g1 uuid:='ac849632-001f-4868-9339-159e2d28e068';
  receiver uuid:='ad000000-0000-4000-8000-000000000005';
  first_submit jsonb; second_submit jsonb; first_response jsonb; accepted jsonb;
  result jsonb; brief jsonb;
begin
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
  result:=public.d5o_get_d2_handoff_v1(workspace,w);
  if result->>'status'<>'not_started' or result->'canSubmit'<>'true'::jsonb then
    raise exception 'author initial state failed: %',result; end if;
  brief:=jsonb_build_object('customerNeed','Assess the North Campus controls need with a testable scope.',
    'scopeBoundary','Define campus control interfaces and exclude unapproved construction work.',
    'assumptions',jsonb_build_array('Customer will provide current drawings.'),
    'unknowns',jsonb_build_array('Panel access window remains unconfirmed.'),
    'actions',jsonb_build_array(jsonb_build_object('text','Confirm panel access and survey dates',
      'ownerProfileId',receiver,'dueOn','2026-10-20')),'dueOn','2026-10-20');
  begin
    perform public.d5o_submit_d2_handoff_v1(workspace,w,g1,4,receiver,
      'd2-stale-version-01',brief);
    raise exception 'stale_work_version_was_allowed';
  exception when others then
    if sqlerrm<>'d2_work_conflict' then raise; end if;
  end;
  begin
    perform public.d5o_submit_d2_handoff_v1(workspace,w,g1,5,
      'ad000000-0000-4000-8000-000000000003',
      'd2-wrong-receiver-01',brief);
    raise exception 'wrong_receiver_was_allowed';
  exception when others then
    if sqlerrm<>'d2_basis_conflict' then raise; end if;
  end;
  first_submit:=public.d5o_submit_d2_handoff_v1(workspace,w,g1,5,receiver,
    'd2-submit-synthetic-01',brief);
  if first_submit->>'revision'<>'1' or first_submit->'receivingAccepted'<>'false'::jsonb
    or first_submit->'events'->>'audit' is null then
    raise exception 'first submission failed: %',first_submit; end if;
  begin
    perform public.d5o_submit_d2_handoff_v1(workspace,w,g1,5,receiver,
      'd2-submit-synthetic-01',jsonb_set(brief,'{customerNeed}',
        to_jsonb('A different need must not reuse this command identifier.'::text)));
    raise exception 'changed_replay_was_allowed';
  exception when others then
    if sqlerrm<>'idempotency_mismatch' then raise; end if;
  end;
  begin
    perform public.d5o_respond_d2_handoff_v1(workspace,w,
      (first_submit->>'submissionId')::uuid,first_submit->>'briefDigest',
      'd2-author-denied-01','accepted','The author must not accept their own handoff.');
    raise exception 'author_response_was_allowed';
  exception when others then
    if sqlerrm<>'d2_permission_denied' then raise; end if;
  end;
  begin
    perform public.d5o_get_d2_handoff_v1('a2000000-0000-4000-8000-000000000002',w);
    raise exception 'cross_tenant_read_was_allowed';
  exception when others then
    if sqlerrm<>'forbidden' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000003',true);
  begin
    perform public.d5o_respond_d2_handoff_v1(workspace,w,
      (first_submit->>'submissionId')::uuid,first_submit->>'briefDigest',
      'd2-admin-denied-01','accepted','An administrator without a grant should be denied.');
    raise exception 'admin_without_grant_accepted';
  exception when others then
    if sqlerrm<>'opportunity_read_permission_denied' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000005',true);
  result:=public.d5o_get_d2_handoff_v1(workspace,w);
  if result->>'status'<>'awaiting_receiver' or result->'canRespond'<>'true'::jsonb
    or result->>'briefDigest'<>first_submit->>'briefDigest' then
    raise exception 'receiver queue failed: %',result; end if;
  begin
    perform public.d5o_respond_d2_handoff_v1(workspace,w,
      (first_submit->>'submissionId')::uuid,repeat('0',64),
      'd2-stale-digest-01','accepted','A stale snapshot must not be accepted by the owner.');
    raise exception 'stale_digest_was_allowed';
  exception when others then
    if sqlerrm<>'d2_response_conflict' then raise; end if;
  end;
  first_response:=public.d5o_respond_d2_handoff_v1(workspace,w,
    (first_submit->>'submissionId')::uuid,first_submit->>'briefDigest',
    'd2-return-synthetic-01','returned','Add the known site access limitation to the brief.');
  if first_response->>'disposition'<>'returned' or first_response->'receivingAccepted'<>'false'::jsonb then
    raise exception 'return failed: %',first_response; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
  result:=public.d5o_get_d2_handoff_v1(workspace,w);
  if result->>'status'<>'returned' or result->'canSubmit'<>'true'::jsonb then
    raise exception 'author correction state failed: %',result; end if;
  brief:=jsonb_set(brief,'{unknowns}',jsonb_build_array(
    'Panel access requires a customer-approved window before any survey starts.'));
  second_submit:=public.d5o_submit_d2_handoff_v1(workspace,w,g1,5,receiver,
    'd2-submit-synthetic-02',brief);
  if second_submit->>'revision'<>'2'
    or second_submit->>'briefDigest'=first_submit->>'briefDigest' then
    raise exception 'correction submission failed: %',second_submit; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000005',true);
  accepted:=public.d5o_respond_d2_handoff_v1(workspace,w,
    (second_submit->>'submissionId')::uuid,second_submit->>'briefDigest',
    'd2-accept-synthetic-01','accepted',
    'The receiving owner accepts the corrected brief and open actions.');
  if accepted->'receivingAccepted'<>'true'::jsonb
    or accepted->'spendingAuthorized'<>'false'::jsonb then
    raise exception 'acceptance failed: %',accepted; end if;
  result:=public.d5o_respond_d2_handoff_v1(workspace,w,
    (second_submit->>'submissionId')::uuid,second_submit->>'briefDigest',
    'd2-accept-synthetic-01','accepted',
    'The receiving owner accepts the corrected brief and open actions.');
  if result->'replayed'<>'true'::jsonb or result->>'responseId'<>accepted->>'responseId' then
    raise exception 'replay failed: %',result; end if;
  result:=public.d5o_get_d2_handoff_v1(workspace,w);
  if result->>'status'<>'accepted' or jsonb_array_length(result->'history')<>2 then
    raise exception 'final history failed: %',result; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
  begin
    perform public.d5o_submit_d2_handoff_v1(workspace,w,g1,5,receiver,
      'd2-after-accept-denied-01',brief);
    raise exception 'third_submission_was_allowed';
  exception when others then
    if sqlerrm<>'d2_handoff_already_pending_or_accepted' then raise; end if;
  end;
  raise notice 'PASS d2 handoff return/correct/accept/replay, same Work %, revisions 1 and 2',w;
end $$;
rollback;
