-- RM03 synthetic scratch candidate: tentative planning intervals only.
-- No executable assignment, technician duty, notification, D4 release or production migration.
begin;

create table public.d5o_trial_rm_plan_shifts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  work_id uuid not null,
  resource_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  job_revision integer not null check(job_revision>0),
  resource_revision integer not null check(resource_revision>0),
  warning_codes jsonb not null default '[]'::jsonb check(jsonb_typeof(warning_codes)='array'),
  warning_ack_reason text,
  planned_by uuid not null references auth.users(id),
  planned_at timestamptz not null default now(),
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id),
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancel_reason text,
  cancel_audit_event_id uuid references public.audit_events(id),
  cancel_domain_event_id uuid references public.domain_events(id),
  foreign key(work_id,workspace_id) references public.d5o_trial_rm_jobs(work_id,workspace_id),
  foreign key(resource_id,workspace_id) references public.d5o_trial_rm_resources(id,workspace_id),
  check(ends_at>starts_at),
  check((cancelled_by is null and cancelled_at is null and cancel_reason is null
    and cancel_audit_event_id is null and cancel_domain_event_id is null)
    or (cancelled_by is not null and cancelled_at is not null
    and length(btrim(cancel_reason)) between 20 and 1000
    and cancel_audit_event_id is not null and cancel_domain_event_id is not null))
);
create index d5o_trial_rm_plan_resource_window on public.d5o_trial_rm_plan_shifts
  (workspace_id,resource_id,starts_at,ends_at) where cancelled_at is null;
create index d5o_trial_rm_plan_work_window on public.d5o_trial_rm_plan_shifts
  (workspace_id,work_id,starts_at) where cancelled_at is null;
alter table public.d5o_trial_rm_plan_shifts enable row level security;
revoke all on public.d5o_trial_rm_plan_shifts from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_rm_plan_authority(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; permission public.config_permission_definitions%rowtype; rule jsonb;
begin
  base:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into permission from public.config_permission_definitions
    where configuration_version_id=(base->>'configurationVersionId')::uuid
      and permission_key='rm.plan_shift' and permission_scope='organization'
      and status='active' for share;
  if permission.id is null then raise exception 'rm_plan_permission_denied'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? (base->>'workspaceRole'))
    or not exists(select 1 from public.d5o_trial_rm_grants g
      where g.workspace_id=p_workspace_id
        and g.configuration_version_id=(base->>'configurationVersionId')::uuid
        and g.permission_id=permission.id and g.user_id=auth.uid()
        and g.profile_id=(base->>'profileId')::uuid and g.status='active') then
    raise exception 'rm_plan_permission_denied'; end if;
  return base||jsonb_build_object('permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_rm_plan_authority(uuid)
  from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_rm_plan_check(p_workspace_id uuid,
  p_work_id uuid,p_resource_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.d5o_trial_rm_jobs%rowtype;
  version public.d5o_trial_rm_job_versions%rowtype;
  resource public.d5o_trial_rm_resources%rowtype;
  profile public.d5o_trial_rm_profile_versions%rowtype;
  blockers jsonb:='[]'::jsonb; warnings jsonb:='[]'::jsonb;
  start_local timestamp; end_local timestamp; skill text; coverage integer;
begin
  select * into job from public.d5o_trial_rm_jobs
    where work_id=p_work_id and workspace_id=p_workspace_id for share;
  select * into version from public.d5o_trial_rm_job_versions v
    where v.work_id=job.work_id order by v.revision desc limit 1 for share;
  select * into resource from public.d5o_trial_rm_resources
    where id=p_resource_id and workspace_id=p_workspace_id
      and configuration_tenant_id=job.configuration_tenant_id
      and organization_id=job.organization_id for share;
  select * into profile from public.d5o_trial_rm_profile_versions p
    where p.resource_id=resource.id order by p.revision desc limit 1 for share;
  if job.work_id is null or version.id is null or resource.id is null or profile.id is null then
    raise exception 'rm_plan_scope_invalid'; end if;
  if version.state<>'ready_for_dispatch' then blockers:=blockers||'"job_planning_not_ready"'::jsonb; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then
    raise exception 'invalid_rm_shift_window'; end if;
  if p_starts_at<(version.payload->>'scheduledStart')::timestamptz
    or p_ends_at>(version.payload->>'scheduledEnd')::timestamptz then
    blockers:=blockers||'"outside_job_span"'::jsonb; end if;
  -- Synthetic tenant A uses an explicit fixture time zone. Production uses versioned tenant policy.
  start_local:=p_starts_at at time zone 'America/New_York';
  end_local:=p_ends_at at time zone 'America/New_York';
  if start_local::date<>end_local::date then blockers:=blockers||'"overnight_shift"'::jsonb; end if;
  if not(profile.profile->'workingDays' ? trim(to_char(start_local,'Dy')))
    then blockers:=blockers||'"non_working_day"'::jsonb; end if;
  if start_local::time<(profile.profile->>'workStart')::time
    or end_local::time>(profile.profile->>'workEnd')::time then
    blockers:=blockers||'"outside_working_hours"'::jsonb; end if;
  if profile.profile->'ptoDates' ? to_char(start_local,'YYYY-MM-DD') then
    blockers:=blockers||'"pto_unavailable"'::jsonb; end if;
  if profile.profile->>'active'<>'true' then blockers:=blockers||'"inactive_technician"'::jsonb; end if;
  if exists(select 1 from public.d5o_trial_rm_plan_shifts s
    where s.workspace_id=p_workspace_id and s.resource_id=p_resource_id
      and s.cancelled_at is null and s.starts_at<p_ends_at and s.ends_at>p_starts_at) then
    blockers:=blockers||'"overlapping_plan"'::jsonb; end if;
  if jsonb_array_length(version.payload->'requiredGrades')>0
    and not(version.payload->'requiredGrades' ? (profile.profile->>'grade')) then
    blockers:=blockers||'"grade_mismatch"'::jsonb; end if;
  for skill in select value from jsonb_array_elements_text(version.payload->'requiredSkills') loop
    if not(profile.profile->'skills' ? skill) then
      warnings:=warnings||jsonb_build_array('skill_mismatch:'||skill); end if;
  end loop;
  select count(distinct s.resource_id) into coverage from public.d5o_trial_rm_plan_shifts s
    where s.workspace_id=p_workspace_id and s.work_id=p_work_id
      and s.cancelled_at is null and s.starts_at<p_ends_at and s.ends_at>p_starts_at;
  return jsonb_build_object('workId',p_work_id,'resourceId',p_resource_id,
    'jobRevision',version.revision,'resourceRevision',profile.revision,
    'blockers',blockers,'warnings',warnings,
    'crewRequired',(version.payload->>'requiredCrewSize')::integer,
    'crewCoveringWindow',coverage,
    'crewAfterPlan',coverage+case when exists(select 1 from public.d5o_trial_rm_plan_shifts s
      where s.workspace_id=p_workspace_id and s.work_id=p_work_id
        and s.resource_id=p_resource_id and s.cancelled_at is null
        and s.starts_at<p_ends_at and s.ends_at>p_starts_at) then 0 else 1 end,
    'releaseEligible',false);
end $$;
revoke all on function rybex_internal.d5o_trial_rm_plan_check(uuid,uuid,uuid,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;

create function public.d5o_rm_list_plan_shifts_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'workId',s.work_id,
    'resourceId',s.resource_id,'startsAt',s.starts_at,'endsAt',s.ends_at,
    'jobRevision',s.job_revision,'resourceRevision',s.resource_revision,
    'warnings',s.warning_codes,'ackReason',s.warning_ack_reason,
    'plannedAt',s.planned_at,'cancelledAt',s.cancelled_at,
    'cancelReason',s.cancel_reason,'currentJobRevision',v.revision,
    'currentResourceRevision',p.revision) order by s.starts_at,s.id),'[]'::jsonb)
    into items from public.d5o_trial_rm_plan_shifts s
    join lateral(select revision from public.d5o_trial_rm_job_versions v
      where v.work_id=s.work_id order by revision desc limit 1) v on true
    join lateral(select revision from public.d5o_trial_rm_profile_versions p
      where p.resource_id=s.resource_id order by revision desc limit 1) p on true
    where s.workspace_id=p_workspace_id
      and s.configuration_tenant_id=(authority->>'tenantId')::uuid
      and s.organization_id=(authority->>'organizationId')::uuid;
  return jsonb_build_object('items',items,'canPlan',exists(
    select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.status='active' and d.permission_key='rm.plan_shift'
        and d.configuration_version_id=(authority->>'configurationVersionId')::uuid));
end $$;
revoke all on function public.d5o_rm_list_plan_shifts_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_list_plan_shifts_v1(uuid) to authenticated;

create function public.d5o_rm_preview_plan_shift_v1(p_workspace_id uuid,
  p_work_id uuid,p_resource_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  perform rybex_internal.d5o_trial_rm_plan_authority(p_workspace_id);
  return rybex_internal.d5o_trial_rm_plan_check(p_workspace_id,p_work_id,p_resource_id,
    p_starts_at,p_ends_at);
end $$;
revoke all on function public.d5o_rm_preview_plan_shift_v1(uuid,uuid,uuid,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_preview_plan_shift_v1(uuid,uuid,uuid,timestamptz,timestamptz)
  to authenticated;

create function public.d5o_rm_commit_plan_shift_v1(p_workspace_id uuid,
  p_work_id uuid,p_resource_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,
  p_expected_job_revision integer,p_expected_resource_revision integer,
  p_ack_reason text,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; check_result jsonb; cached public.command_idempotency%rowtype;
  request_hash text; shift_id uuid; audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_plan_authority(p_workspace_id);
  if p_work_id is null or p_resource_id is null
    or p_expected_job_revision is null or p_expected_resource_revision is null
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_rm_plan_command'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'rm.plan.shift.v1',auth.uid(),p_workspace_id,p_work_id,p_resource_id,
    p_starts_at,p_ends_at,p_expected_job_revision,p_expected_resource_revision,p_ack_reason));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.rm.plan.shift.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  check_result:=rybex_internal.d5o_trial_rm_plan_check(p_workspace_id,p_work_id,
    p_resource_id,p_starts_at,p_ends_at);
  if (check_result->>'jobRevision')::integer<>p_expected_job_revision
    or (check_result->>'resourceRevision')::integer<>p_expected_resource_revision then
    raise exception 'rm_plan_stale'; end if;
  if jsonb_array_length(check_result->'blockers')>0 then
    raise exception 'rm_plan_blocked:%',check_result->'blockers'; end if;
  if jsonb_array_length(check_result->'warnings')>0
    and length(btrim(coalesce(p_ack_reason,''))) not between 20 and 1000 then
    raise exception 'rm_plan_warning_ack_required'; end if;
  shift_id:=gen_random_uuid();
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,'d5o_trial_rm_plan_shift',
    shift_id,p_command_id,'rm.plan_shift_created',null,'tentative',auth.uid(),
    p_command_id,null,jsonb_build_object('workId',p_work_id,'resourceId',p_resource_id,
      'startsAt',p_starts_at,'endsAt',p_ends_at),check_result);
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,'d5o_trial_rm_plan_shift',
    shift_id,1,'rm.plan_shift_created',1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('workId',p_work_id,'resourceId',p_resource_id,
      'startsAt',p_starts_at,'endsAt',p_ends_at,'tentative',true));
  insert into public.d5o_trial_rm_plan_shifts(id,workspace_id,configuration_tenant_id,
    organization_id,work_id,resource_id,starts_at,ends_at,job_revision,resource_revision,
    warning_codes,warning_ack_reason,planned_by,audit_event_id,domain_event_id)
  values(shift_id,p_workspace_id,(authority->>'tenantId')::uuid,
    (authority->>'organizationId')::uuid,p_work_id,p_resource_id,p_starts_at,p_ends_at,
    p_expected_job_revision,p_expected_resource_revision,check_result->'warnings',
    nullif(btrim(p_ack_reason),''),auth.uid(),audit_id,event_id);
  result:=jsonb_build_object('success',true,'shiftId',shift_id,'state','tentative',
    'workId',p_work_id,'resourceId',p_resource_id,'auditId',audit_id,'eventId',event_id,
    'crewAfterPlan',check_result->'crewAfterPlan','crewRequired',check_result->'crewRequired',
    'releaseEligible',false);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.rm.plan.shift.v1','d5o_trial_rm_plan_shift',
    shift_id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_rm_commit_plan_shift_v1(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_commit_plan_shift_v1(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text)
  to authenticated;

create function public.d5o_rm_cancel_plan_shift_v1(p_workspace_id uuid,
  p_shift_id uuid,p_reason text,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; shift public.d5o_trial_rm_plan_shifts%rowtype;
  cached public.command_idempotency%rowtype; request_hash text;
  audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_plan_authority(p_workspace_id);
  if p_shift_id is null or length(btrim(coalesce(p_reason,''))) not between 20 and 1000
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_rm_cancel_command'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'rm.plan.cancel.v1',auth.uid(),p_workspace_id,p_shift_id,btrim(p_reason)));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.rm.plan.cancel.v1' then raise exception 'idempotency_mismatch'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into shift from public.d5o_trial_rm_plan_shifts
    where id=p_shift_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for update;
  if shift.id is null or shift.cancelled_at is not null then raise exception 'rm_plan_cancel_conflict'; end if;
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,'d5o_trial_rm_plan_shift',
    shift.id,p_command_id,'rm.plan_shift_cancelled','tentative','cancelled',auth.uid(),
    p_command_id,jsonb_build_object('workId',shift.work_id,'resourceId',shift.resource_id),
    jsonb_build_object('reason',btrim(p_reason)),jsonb_build_object('reason',btrim(p_reason)));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,'d5o_trial_rm_plan_shift',
    shift.id,2,'rm.plan_shift_cancelled',1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('reason',btrim(p_reason)));
  update public.d5o_trial_rm_plan_shifts set cancelled_by=auth.uid(),
    cancelled_at=now(),cancel_reason=btrim(p_reason),
    cancel_audit_event_id=audit_id,cancel_domain_event_id=event_id where id=shift.id;
  result:=jsonb_build_object('success',true,'shiftId',shift.id,'state','cancelled',
    'auditId',audit_id,'eventId',event_id);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.rm.plan.cancel.v1','d5o_trial_rm_plan_shift',
    shift.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_rm_cancel_plan_shift_v1(uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_cancel_plan_shift_v1(uuid,uuid,text,text)
  to authenticated;
commit;
