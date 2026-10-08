-- Disposable synthetic trial only. A G1 assessment instance attaches to the
-- same canonical Work without altering the frozen Discover intake root.
-- This is not G1 qualification or spending authorization.
begin;
create table public.d5o_trial_g1_policies (
  id uuid primary key,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  gate_key text not null check(gate_key='discover-g1'),
  policy_version integer not null check(policy_version>0),
  rule_json jsonb not null check(jsonb_typeof(rule_json)='object'),
  rule_digest text not null check(rule_digest ~ '^[0-9a-f]{64}$'),
  status text not null check(status in ('trial_active','retired')),
  unique(configuration_version_id,gate_key,policy_version)
);
create unique index d5o_trial_one_active_g1_policy on public.d5o_trial_g1_policies(configuration_version_id,gate_key)
  where status='trial_active';
alter table public.d5o_trial_g1_policies enable row level security;
revoke all on public.d5o_trial_g1_policies from public,anon,authenticated,service_role;

create table public.d5o_trial_g1_start_grants (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  permission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null check(status in ('active','revoked')),
  primary key(workspace_id,configuration_version_id,user_id),
  foreign key(permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_g1_start_grants enable row level security;
revoke all on public.d5o_trial_g1_start_grants from public,anon,authenticated,service_role;

create table public.d5o_trial_g1_instances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  work_id uuid not null,
  configuration_version_id uuid not null,
  policy_id uuid not null references public.d5o_trial_g1_policies(id) on delete restrict,
  policy_digest text not null check(policy_digest ~ '^[0-9a-f]{64}$'),
  policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object'),
  source_submission_id uuid not null references public.d5o_trial_triage_submissions(id) on delete restrict,
  source_response_id uuid not null unique references public.d5o_trial_triage_responses(id) on delete restrict,
  source_work_version integer not null check(source_work_version>0),
  source_snapshot_digest text not null check(source_snapshot_digest ~ '^[0-9a-f]{64}$'),
  status text not null check(status in ('assessment_draft','submitted','returned','qualified','declined')),
  started_by uuid not null references auth.users(id) on delete restrict,
  started_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  start_permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  start_permission_digest text not null check(start_permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  started_at timestamptz not null default now(),
  unique(work_id),unique(work_id,workspace_id),
  foreign key(work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_g1_instances enable row level security;
revoke all on public.d5o_trial_g1_instances from public,anon,authenticated,service_role;
create function rybex_internal.d5o_trial_g1_instance_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'immutable_g1_instance'; end if;
  if old.audit_event_id is not null or old.domain_event_id is not null
    or new.audit_event_id is null or new.domain_event_id is null
    or (to_jsonb(new)-'audit_event_id'-'domain_event_id')
      is distinct from (to_jsonb(old)-'audit_event_id'-'domain_event_id') then
    raise exception 'immutable_g1_instance'; end if;
  return new;
end $$;
create trigger d5o_trial_g1_instance_immutable before update or delete
  on public.d5o_trial_g1_instances for each row
  execute function rybex_internal.d5o_trial_g1_instance_immutable();
create function rybex_internal.d5o_trial_g1_instance_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_trial_g1_instances x where x.id=new.id
    and (x.audit_event_id is null or x.domain_event_id is null)) then
    raise exception 'g1_start_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_g1_instance_receipt after insert or update
  on public.d5o_trial_g1_instances deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_g1_instance_receipt();

create function rybex_internal.d5o_trial_g1_start_authority(p_workspace_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; actor jsonb; permission public.config_permission_definitions%rowtype;
  grant_row public.d5o_trial_g1_start_grants%rowtype; membership public.workspace_memberships%rowtype; rule jsonb;
begin
  base:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,p_version_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into membership from public.workspace_memberships where id=(actor->>'membership')::uuid for share;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_version_id and permission_key='discover.prepare_g1'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'g1_start_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? membership.role) then raise exception 'g1_start_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_g1_start_grants
    where workspace_id=p_workspace_id and configuration_version_id=p_version_id
      and permission_id=permission.id and user_id=auth.uid()
      and profile_id=(base->>'actorProfileId')::uuid and status='active' for share;
  if grant_row.user_id is null then raise exception 'g1_start_permission_denied'; end if;
  return base||jsonb_build_object('startPermissionId',permission.id,
    'startPermissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_g1_start_authority(uuid,uuid)
  from public,anon,authenticated,service_role;

create function public.d5o_start_discover_g1_v1(p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_command_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; authority jsonb;
  policy public.d5o_trial_g1_policies%rowtype; submission public.d5o_trial_triage_submissions%rowtype;
  response public.d5o_trial_triage_responses%rowtype; cached public.command_idempotency%rowtype;
  request_hash text; instance_id uuid; events jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_expected_version is null or p_expected_version<1
    or length(coalesce(p_command_id,'')) not between 8 and 200 then raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
  if w.created_by<>auth.uid() then raise exception 'g1_start_permission_denied'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.g1.start.v1',auth.uid(),p_workspace_id,p_work_id,p_expected_version));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.g1.start.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_version or w.lifecycle_state<>'triage_assigned'
    or exists(select 1 from public.d5o_trial_g1_instances x where x.work_id=w.id) then
    raise exception 'g1_start_not_eligible'; end if;
  select s.* into submission from public.d5o_trial_triage_submissions s
    join public.d5o_trial_triage_responses r on r.submission_id=s.id
    where s.work_id=w.id and s.workspace_id=p_workspace_id and r.disposition='accepted'
      and r.after_work_version=w.record_version
    order by s.submission_revision desc limit 1 for share of s;
  if submission.id is null then raise exception 'g1_start_not_eligible'; end if;
  select * into response from public.d5o_trial_triage_responses
    where submission_id=submission.id for share;
  if response.id is null or response.disposition<>'accepted'
    or submission.snapshot_digest<>rybex_internal.d5o_m1_digest(submission.snapshot) then
    raise exception 'g1_start_not_eligible'; end if;
  select * into policy from public.d5o_trial_g1_policies
    where configuration_version_id=w.configuration_version_id and gate_key='discover-g1'
      and status='trial_active' for share;
  if policy.id is null or policy.rule_digest<>rybex_internal.d5o_m1_digest(policy.rule_json)
    or policy.rule_json-'requiredDisciplines'-'spendingAuthorized'-'requiresRegisteredIdentity'<>'{}'::jsonb
    or jsonb_typeof(policy.rule_json->'requiredDisciplines') is distinct from 'array'
    or policy.rule_json->'spendingAuthorized' is distinct from 'false'::jsonb
    or policy.rule_json->'requiresRegisteredIdentity' is distinct from 'true'::jsonb then
    raise exception 'g1_policy_unavailable'; end if;
  insert into public.d5o_trial_g1_instances(workspace_id,work_id,configuration_version_id,
    policy_id,policy_digest,policy_snapshot,source_submission_id,source_response_id,
    source_work_version,source_snapshot_digest,status,started_by,started_by_profile_id,
    start_permission_id,start_permission_digest)
  values(p_workspace_id,w.id,w.configuration_version_id,policy.id,policy.rule_digest,
    to_jsonb(policy),submission.id,response.id,w.record_version,submission.snapshot_digest,
    'assessment_draft',auth.uid(),(authority->>'actorProfileId')::uuid,
    (authority->>'startPermissionId')::uuid,authority->>'startPermissionDigest')
  returning id into instance_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.g1_assessment_started',auth.uid(),
    to_jsonb(w),to_jsonb(w),jsonb_build_object('g1InstanceId',instance_id,
      'sourceSubmissionId',submission.id,'sourceResponseId',response.id,
      'sourceSnapshotDigest',submission.snapshot_digest,'policyDigest',policy.rule_digest,
      'startPermissionDigest',authority->>'startPermissionDigest','spendingAuthorized',false));
  update public.d5o_trial_g1_instances set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=instance_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'g1InstanceId',instance_id,'g1Status','assessment_draft','events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.g1.start.v1','d5o_work_record',w.id,
    request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_start_discover_g1_v1(uuid,uuid,integer,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_start_discover_g1_v1(uuid,uuid,integer,text) to authenticated;

create function public.d5o_get_discover_g1_start_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; reader jsonb; start_allowed boolean:=false;
  instance public.d5o_trial_g1_instances%rowtype; policy public.d5o_trial_g1_policies%rowtype;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  reader:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  select * into instance from public.d5o_trial_g1_instances where work_id=w.id for share;
  select * into policy from public.d5o_trial_g1_policies
    where configuration_version_id=w.configuration_version_id and gate_key='discover-g1'
      and status='trial_active' for share;
  if w.created_by=auth.uid() and w.lifecycle_state='triage_assigned'
    and instance.id is null and policy.id is not null
    and policy.rule_digest=rybex_internal.d5o_m1_digest(policy.rule_json) then
    select true into start_allowed from public.config_permission_definitions p
      join public.d5o_trial_g1_start_grants g on g.permission_id=p.id
        and g.configuration_version_id=p.configuration_version_id
      where p.configuration_version_id=w.configuration_version_id
        and p.permission_key='discover.prepare_g1' and p.status='active'
        and g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.profile_id=(reader->>'actorProfileId')::uuid and g.status='active';
  end if;
  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'g1Status',case when instance.id is not null then instance.status
      when w.lifecycle_state<>'triage_assigned' then 'awaiting_triage_acceptance'
      when policy.id is null then 'gate_unconfigured' else 'not_started' end,
    'g1InstanceId',instance.id,'canStart',coalesce(start_allowed,false),
    'spendingAuthorized',false);
end $$;
revoke all on function public.d5o_get_discover_g1_start_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_get_discover_g1_start_v1(uuid,uuid) to authenticated;
commit;
