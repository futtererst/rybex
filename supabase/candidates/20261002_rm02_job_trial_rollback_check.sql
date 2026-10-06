-- Rollback-only synthetic RM02 boundary check in disposable scratch E.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  work uuid:='a17a70a1-eeb8-4ee0-b0da-61fb71a384d4';
  payload jsonb; draft jsonb; ready jsonb; again jsonb; listed jsonb;
  prior_revision integer;
begin
  payload:=jsonb_build_object('jobType','install','scope',
    'Replace controls in the North Campus mechanical room and verify operation.',
    'priority','normal','siteAddress','100 Synthetic Campus Way, Albany, NY',
    'requiredSkills',jsonb_build_array('Controls'),
    'requiredGrades',jsonb_build_array('Senior Technician'),
    'estimatedPersonHours',24,'requiredCrewSize',3,
    'scheduledStart','2026-10-05T12:00:00Z','scheduledEnd','2026-10-05T20:00:00Z',
    'customerContact','Synthetic site contact · 555-0100','notes','Trial only',
    'documentRefs',jsonb_build_array());
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  listed:=public.d5o_rm_list_jobs_v1(workspace);
  prior_revision:=coalesce((listed->'items'->0->>'revision')::integer,0);
  draft:=public.d5o_rm_save_job_v1(workspace,work,prior_revision,'rm02-draft-check-01','save',payload);
  if draft->>'workId'<>work::text or (draft->>'revision')::integer<>prior_revision+1
    or draft->>'state'<>'draft' or draft->>'auditId' is null
    or draft->>'eventId' is null
    or draft->'readiness'->>'equalShareHours'<>'8.00'
    or draft->'readiness'->>'jobSpanHours'<>'8.00' then
    raise exception 'draft failed: %',draft; end if;
  again:=public.d5o_rm_save_job_v1(workspace,work,prior_revision,'rm02-draft-check-01','save',payload);
  if again->'replayed'<>'true'::jsonb or (again->>'revision')::integer<>prior_revision+1 then
    raise exception 'replay failed: %',again; end if;
  begin
    perform public.d5o_rm_save_job_v1(workspace,work,prior_revision,'rm02-draft-check-01','save',
      jsonb_set(payload,'{notes}','"Changed"'::jsonb));
    raise exception 'changed_replay_allowed';
  exception when others then if sqlerrm<>'idempotency_mismatch' then raise; end if; end;
  ready:=public.d5o_rm_save_job_v1(workspace,work,prior_revision+1,'rm02-ready-check-01','ready',payload);
  if ready->>'state'<>'ready_for_dispatch' or (ready->>'revision')::integer<>prior_revision+2 then
    raise exception 'ready failed: %',ready; end if;
  begin
    perform public.d5o_rm_save_job_v1(workspace,work,prior_revision+1,'rm02-stale-check-01','save',payload);
    raise exception 'stale_allowed';
  exception when others then if sqlerrm<>'rm_job_conflict' then raise; end if; end;
  begin
    perform public.d5o_rm_save_job_v1(workspace,work,prior_revision+2,'rm02-bad-doc-check-01','save',
      jsonb_set(payload,'{documentRefs}',jsonb_build_array(gen_random_uuid())));
    raise exception 'unlinked_document_allowed';
  exception when others then if sqlerrm<>'rm_job_document_invalid' then raise; end if; end;
  begin
    perform public.d5o_rm_save_job_v1(workspace,work,prior_revision+2,'rm02-bad-site-check-01','save',
      jsonb_set(payload,'{siteAddress}','"Unrelated field address"'::jsonb));
    raise exception 'unregistered_site_address_allowed';
  exception when others then if sqlerrm<>'rm_site_address_mismatch' then raise; end if; end;
  begin
    perform public.d5o_rm_save_job_v1(workspace,
      'a56ec104-aa58-4e78-b9f3-f1f62a70a23b',0,'rm02-no-handoff-check','save',payload);
    raise exception 'unaccepted_handoff_allowed';
  exception when others then if sqlerrm<>'rm_handoff_required' then raise; end if; end;
  listed:=public.d5o_rm_list_jobs_v1(workspace);
  if listed->'canSave'<>'true'::jsonb or jsonb_array_length(listed->'items')<>1
    or (listed->'items'->0->>'workId')<>work::text
    or listed::text like '%hourly_cents%' then raise exception 'list failed: %',listed; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  listed:=public.d5o_rm_list_jobs_v1(workspace);
  if listed->'canSave'<>'false'::jsonb then raise exception 'dispatcher view failed'; end if;
  begin
    perform public.d5o_rm_save_job_v1(workspace,work,prior_revision+2,'rm02-dispatch-denied','save',payload);
    raise exception 'dispatcher_save_allowed';
  exception when others then if sqlerrm<>'rm_job_permission_denied' then raise; end if; end;
  begin
    perform public.d5o_rm_list_jobs_v1('a2000000-0000-4000-8000-000000000002');
    raise exception 'cross_tenant_allowed';
  exception when others then if sqlerrm<>'forbidden' then raise; end if; end;
  if (listed->'works'->0->>'workVersion')::integer<>5
    or has_table_privilege('authenticated','public.d5o_trial_rm_jobs','SELECT')
    or has_table_privilege('authenticated','public.d5o_trial_rm_job_versions','SELECT') then
    raise exception 'work_identity_or_table_boundary_failed'; end if;
  raise notice 'PASS RM02 draft/ready/replay/stale/handoff/doc/role/tenant/person-hours/Work identity';
end $$;
rollback;
