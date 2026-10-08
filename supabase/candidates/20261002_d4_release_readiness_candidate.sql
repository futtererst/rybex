-- Disposable scratch E: scoped D4 readiness inspection only.
-- No G3/G4 decision, release command, executable assignment or policy grant.
begin;
create function public.d5o_rm_d4_readiness_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; job public.d5o_trial_rm_jobs%rowtype;
  version public.d5o_trial_rm_job_versions%rowtype;
  work public.d5o_work_records%rowtype;
  minimum_crew integer; planned_people integer; stale_shifts integer;
  warning_shifts integer; blockers jsonb:='[]'::jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into job from public.d5o_trial_rm_jobs
    where work_id=p_work_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if job.work_id is null then raise exception 'rm_d4_scope_invalid'; end if;
  select * into work from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id
      and configuration_tenant_id=job.configuration_tenant_id for share;
  select * into version from public.d5o_trial_rm_job_versions
    where work_id=p_work_id order by revision desc limit 1 for share;
  if work.id is null or version.id is null then raise exception 'rm_d4_scope_invalid'; end if;
  select count(distinct s.resource_id) into planned_people
    from public.d5o_trial_rm_plan_shifts s
    where s.workspace_id=p_workspace_id and s.work_id=p_work_id
      and s.cancelled_at is null;
  with edges as (
    select (version.payload->>'scheduledStart')::timestamptz as at_time
    union select (version.payload->>'scheduledEnd')::timestamptz
    union select greatest(s.starts_at,(version.payload->>'scheduledStart')::timestamptz)
      from public.d5o_trial_rm_plan_shifts s where s.workspace_id=p_workspace_id
        and s.work_id=p_work_id and s.cancelled_at is null
    union select least(s.ends_at,(version.payload->>'scheduledEnd')::timestamptz)
      from public.d5o_trial_rm_plan_shifts s where s.workspace_id=p_workspace_id
        and s.work_id=p_work_id and s.cancelled_at is null
  ), segments as (
    select at_time,lead(at_time) over(order by at_time) as next_time from edges
  )
  select coalesce(min((select count(distinct s.resource_id)
    from public.d5o_trial_rm_plan_shifts s
    where s.workspace_id=p_workspace_id and s.work_id=p_work_id
      and s.cancelled_at is null and s.starts_at<=g.at_time
      and s.ends_at>=g.next_time)),0) into minimum_crew
    from segments g where g.next_time>g.at_time
      and g.at_time>=(version.payload->>'scheduledStart')::timestamptz
      and g.next_time<=(version.payload->>'scheduledEnd')::timestamptz;
  select count(*) filter(where s.job_revision<>version.revision
      or s.resource_revision<>p.revision),
    count(*) filter(where jsonb_array_length(s.warning_codes)>0)
    into stale_shifts,warning_shifts
    from public.d5o_trial_rm_plan_shifts s
    join lateral(select revision from public.d5o_trial_rm_profile_versions
      where resource_id=s.resource_id order by revision desc limit 1) p on true
    where s.workspace_id=p_workspace_id and s.work_id=p_work_id
      and s.cancelled_at is null;
  if version.state<>'ready_for_dispatch' then
    blockers:=blockers||'"job_planning_incomplete"'::jsonb; end if;
  if minimum_crew<(version.payload->>'requiredCrewSize')::integer then
    blockers:=blockers||'"crew_window_incomplete"'::jsonb; end if;
  if stale_shifts>0 then blockers:=blockers||'"stale_plan_revision"'::jsonb; end if;
  if warning_shifts>0 then blockers:=blockers||'"qualification_warning_needs_release_policy"'::jsonb; end if;
  -- These prerequisites have no authoritative records/policy in the bounded trial.
  blockers:=blockers||'["g3_scope_authority_unconnected", "design_method_clearances_unconnected", "hseq_access_supply_clearances_unconnected", "certificate_policy_unconfigured", "site_calendar_policy_unconfigured", "d4_release_authority_unconfigured", "execution_pack_and_notification_unconnected"]'::jsonb;
  return jsonb_build_object('workId',work.id,'workVersion',work.record_version,
    'jobRevision',version.revision,'jobState',version.state,
    'requiredCrew',(version.payload->>'requiredCrewSize')::integer,
    'plannedPeople',planned_people,'minimumCrewAcrossWindow',minimum_crew,
    'staleShifts',stale_shifts,'warningShifts',warning_shifts,
    'blockers',blockers,'releaseEligible',false,'releaseAvailable',false);
end $$;
revoke all on function public.d5o_rm_d4_readiness_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_d4_readiness_v1(uuid,uuid) to authenticated;
commit;
