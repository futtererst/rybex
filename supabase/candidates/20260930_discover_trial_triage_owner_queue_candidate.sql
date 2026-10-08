-- UNAPPLIED synthetic-only owner queue. Only the proposed, currently eligible
-- owner can see a pending submitted basis; no organization-wide disclosure.
begin;
create function public.d5o_list_my_discover_triage_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; version_id uuid; permission public.config_permission_definitions%rowtype;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select active_configuration_version_id into version_id from public.config_tenants
    where workspace_id=p_workspace_id and status='active';
  if version_id is null or not rybex_internal.d5o_trial_triage_owner_eligible(
      p_workspace_id,version_id,(actor->>'profile')::uuid) then
    raise exception 'triage_owner_denied'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=version_id
      and permission_key='discover.accept_triage' and status='active' for share;
  if permission.id is null then raise exception 'triage_owner_denied'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
      'workId',r.work_id,'recordVersion',r.record_version,
      'submissionId',r.submission_id,'submissionRevision',r.submission_revision,
      'title',r.title,'customerContext',r.customer_context,
      'siteContext',r.site_context,'needSummary',r.need_summary,
      'source',r.source_kind,'sourceReference',r.source_reference,
      'workType',r.work_type,'responseDueOn',r.response_due_on,
      'submittedAt',r.submitted_at,'acceptBy',r.accept_by,
      'overdue',r.accept_by is not null and r.accept_by<now(),
      'snapshotDigest',r.snapshot_digest)
    order by r.submitted_at desc,r.work_id desc)
    from (select w.id as work_id,w.record_version,w.title,s.id as submission_id,
      s.submission_revision,s.submitted_at,s.accept_by,s.snapshot_digest,
      s.snapshot->'draft'->>'customer_context' as customer_context,
      s.snapshot->'draft'->>'site_context' as site_context,
      s.snapshot->'draft'->>'need_summary' as need_summary,
      s.snapshot->'draft'->>'source_kind' as source_kind,
      s.snapshot->'draft'->>'source_reference' as source_reference,
      s.snapshot->'draft'->>'work_type' as work_type,
      s.snapshot->'draft'->>'response_due_on' as response_due_on
      from public.d5o_trial_triage_submissions s
      join public.d5o_work_records w on w.id=s.work_id
        and w.workspace_id=s.workspace_id
      where s.workspace_id=p_workspace_id
        and s.configuration_version_id=version_id
        and s.proposed_owner_profile_id=(actor->>'profile')::uuid
        and w.configuration_tenant_id=public.config_configuration_version_tenant_id(version_id)
        and w.lifecycle_state='pending_owner_acceptance'
        and w.record_version=s.submitted_work_version
        and s.snapshot_digest=rybex_internal.d5o_m1_digest(s.snapshot)
        and not exists(select 1 from public.d5o_trial_triage_responses x
          where x.submission_id=s.id)
      order by s.submitted_at desc,w.id desc limit 50) r),'[]'::jsonb));
end $$;
revoke all on function public.d5o_list_my_discover_triage_v1(uuid)
  from public,anon,authenticated,service_role;
commit;
