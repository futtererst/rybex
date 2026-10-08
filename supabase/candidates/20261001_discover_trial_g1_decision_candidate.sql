-- Disposable synthetic G1 decision trial. The triage Work root remains frozen.
-- Fresh setup: apply G1 strategy and assessment candidates before this file.
begin;
create table public.d5o_trial_g1_decision_grants (
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
alter table public.d5o_trial_g1_decision_grants enable row level security;
revoke all on public.d5o_trial_g1_decision_grants from public,anon,authenticated,service_role;

create table public.d5o_trial_g1_decisions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.d5o_trial_g1_instances(id) on delete restrict,
  assessment_id uuid not null unique references public.d5o_trial_g1_assessments(id) on delete restrict,
  workspace_id uuid not null,
  work_id uuid not null,
  configuration_version_id uuid not null,
  assessment_revision integer not null check(assessment_revision>0),
  package_digest text not null check(package_digest ~ '^[0-9a-f]{64}$'),
  source_work_version integer not null check(source_work_version>0),
  disposition text not null check(disposition in ('returned','qualified')),
  reason text not null check(length(btrim(reason)) between 20 and 1000),
  conditions text check(conditions is null or length(btrim(conditions)) between 20 and 2000),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decision_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  policy_digest text not null check(policy_digest ~ '^[0-9a-f]{64}$'),
  strategy_rule_id uuid references public.d5o_trial_g1_strategy_rules(id) on delete restrict,
  strategy_rule_digest text check(strategy_rule_digest is null or strategy_rule_digest ~ '^[0-9a-f]{64}$'),
  strategy_rule_snapshot jsonb check(strategy_rule_snapshot is null or jsonb_typeof(strategy_rule_snapshot)='object'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  decided_at timestamptz not null default now(),
  unique(work_id,assessment_revision),
  foreign key(work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict
);
create unique index d5o_trial_g1_one_qualification on public.d5o_trial_g1_decisions(instance_id)
  where disposition='qualified';
alter table public.d5o_trial_g1_decisions enable row level security;
revoke all on public.d5o_trial_g1_decisions from public,anon,authenticated,service_role;
create trigger d5o_trial_g1_decision_immutable before update or delete
  on public.d5o_trial_g1_decisions for each row
  execute function rybex_internal.d5o_trial_g1_assessment_immutable();
create function rybex_internal.d5o_trial_g1_decision_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_trial_g1_decisions d where d.id=new.id
    and (d.audit_event_id is null or d.domain_event_id is null)) then
    raise exception 'g1_decision_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_g1_decision_receipt after insert or update
  on public.d5o_trial_g1_decisions deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_g1_decision_receipt();

create function rybex_internal.d5o_trial_g1_decision_authority(p_workspace_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; actor jsonb; membership public.workspace_memberships%rowtype;
  permission public.config_permission_definitions%rowtype;
  grant_row public.d5o_trial_g1_decision_grants%rowtype; rule jsonb;
begin
  base:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,p_version_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into membership from public.workspace_memberships
    where id=(actor->>'membership')::uuid for share;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_version_id and permission_key='discover.qualify_pursuit'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'g1_decision_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'-'allowedDispositions'-'maximumProposedCapAmount'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or rule->'allowedDispositions' is distinct from '["return", "qualify"]'::jsonb
    or jsonb_typeof(rule->'maximumProposedCapAmount') is distinct from 'number'
    or (rule->>'maximumProposedCapAmount')::numeric<0
    or not(rule->'workspaceRoles' ? membership.role) then
    raise exception 'g1_decision_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_g1_decision_grants
    where workspace_id=p_workspace_id and configuration_version_id=p_version_id
      and permission_id=permission.id and user_id=auth.uid()
      and profile_id=(base->>'actorProfileId')::uuid and status='active' for share;
  if grant_row.user_id is null then raise exception 'g1_decision_permission_denied'; end if;
  return base||jsonb_build_object('decisionPermissionId',permission.id,
    'decisionPermissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)),
    'maximumProposedCapAmount',(rule->>'maximumProposedCapAmount')::numeric);
end $$;
revoke all on function rybex_internal.d5o_trial_g1_decision_authority(uuid,uuid)
  from public,anon,authenticated,service_role;

create function public.d5o_decide_discover_g1_v1(
  p_workspace_id uuid,p_work_id uuid,p_assessment_id uuid,p_package_digest text,
  p_expected_work_version integer,p_command_id text,p_disposition text,p_reason text,p_conditions text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; authority jsonb;
  instance public.d5o_trial_g1_instances%rowtype; assessment public.d5o_trial_g1_assessments%rowtype;
  cached public.command_idempotency%rowtype; request_hash text; decision_id uuid;
  events jsonb; result jsonb; clean_reason text; clean_conditions text; strategy jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  clean_reason:=btrim(coalesce(p_reason,''));
  clean_conditions:=nullif(btrim(coalesce(p_conditions,'')),'');
  if p_work_id is null or p_assessment_id is null or p_expected_work_version is null
    or p_expected_work_version<1 or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_package_digest !~ '^[0-9a-f]{64}$' or p_disposition not in ('return','qualify')
    or length(clean_reason) not between 20 and 1000
    or (clean_conditions is not null and length(clean_conditions) not between 20 and 2000)
    or (p_disposition='return' and clean_conditions is not null) then
    raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_g1_decision_authority(p_workspace_id,w.configuration_version_id);
  if w.created_by=auth.uid() then raise exception 'g1_separation_of_duties'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.g1.decision.v1',auth.uid(),p_workspace_id,p_work_id,p_assessment_id,
    p_package_digest,p_expected_work_version,p_disposition,clean_reason,clean_conditions));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.g1.decision.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into instance from public.d5o_trial_g1_instances
    where work_id=w.id and workspace_id=p_workspace_id for share;
  select * into assessment from public.d5o_trial_g1_assessments
    where id=p_assessment_id and instance_id=instance.id and work_id=w.id
      and workspace_id=p_workspace_id for share;
  if instance.id is null or assessment.id is null or assessment.status<>'submitted'
    or assessment.assessment_revision<>(select max(a.assessment_revision)
      from public.d5o_trial_g1_assessments a where a.instance_id=instance.id)
    or assessment.package_digest<>p_package_digest
    or assessment.package_digest<>rybex_internal.d5o_m1_digest(assessment.package_snapshot)
    or assessment.package_snapshot->>'sourceSnapshotDigest'<>instance.source_snapshot_digest
    or instance.policy_digest<>rybex_internal.d5o_m1_digest(instance.policy_snapshot->'rule_json')
    or instance.policy_snapshot->'rule_json'->'requiredDisciplines' is distinct from '["technical"]'::jsonb
    or instance.policy_snapshot->'rule_json'->'spendingAuthorized' is distinct from 'false'::jsonb
    or w.record_version<>p_expected_work_version or w.record_version<>instance.source_work_version
    or w.lifecycle_state<>'triage_assigned'
    or exists(select 1 from public.d5o_trial_g1_decisions d where d.assessment_id=assessment.id
      or (d.instance_id=instance.id and d.disposition='qualified')) then
    raise exception 'g1_decision_conflict'; end if;
  if p_disposition='qualify' and (assessment.payload->>'proposedCapAmount' is null
    or (assessment.payload->>'proposedCapAmount')::numeric>
      (authority->>'maximumProposedCapAmount')::numeric) then
    raise exception 'g1_qualification_limit_exceeded'; end if;
  if p_disposition='qualify' and not exists(
    select 1 from public.d5o_discover_capture_drafts draft
    join public.d5o_trial_accounts account on account.id=draft.account_id
      and account.workspace_id=p_workspace_id
      and account.configuration_tenant_id=w.configuration_tenant_id
      and account.organization_id=(authority->>'organizationId')::uuid
      and account.status='trial_active'
    join public.d5o_trial_sites site on site.id=draft.site_id
      and site.account_id=account.id and site.workspace_id=p_workspace_id
      and site.configuration_tenant_id=w.configuration_tenant_id
      and site.organization_id=account.organization_id and site.status='trial_active'
    join public.user_profiles owner on owner.id=(assessment.payload->>'nextOwnerProfileId')::uuid
      and owner.organization_id=account.organization_id and owner.status='active'
    join public.workspace_memberships membership on membership.user_profile_id=owner.id
      and membership.workspace_id=p_workspace_id and membership.user_id=owner.user_id
      and membership.organization_id=owner.organization_id and membership.status='active'
    where draft.work_id=w.id and draft.workspace_id=p_workspace_id
      and length(btrim(coalesce(draft.need_summary,'')))>=20
      and length(btrim(coalesce(draft.source_kind,'')))>0
      and length(btrim(coalesce(draft.source_reference,'')))>=3
      and draft.response_due_on is not null) then
    raise exception 'g1_qualification_basis_changed'; end if;
  if p_disposition='qualify' then
    strategy:=rybex_internal.d5o_trial_g1_strategy_result(p_workspace_id,w.id);
    if strategy->>'status'='unconfigured' then raise exception 'g1_strategy_unconfigured'; end if;
    if strategy->>'status'='prohibited' then raise exception 'g1_strategy_prohibited'; end if;
    if strategy->>'status'='reserved' then raise exception 'g1_reserved_matter_pending'; end if;
    if strategy->>'status' is distinct from 'eligible'
      or assessment.package_snapshot->'strategyResult'->>'status' is distinct from 'eligible'
      or assessment.package_snapshot->'strategyResult'->>'ruleDigest' is distinct from strategy->>'ruleDigest'
      or assessment.package_snapshot->'strategyResult'->'ruleSnapshot' is distinct from strategy->'ruleSnapshot' then
      raise exception 'g1_strategy_stale'; end if;
  end if;
  insert into public.d5o_trial_g1_decisions(instance_id,assessment_id,workspace_id,work_id,
    configuration_version_id,assessment_revision,package_digest,source_work_version,
    disposition,reason,conditions,decided_by,decision_profile_id,permission_id,
    permission_digest,policy_digest,strategy_rule_id,strategy_rule_digest,strategy_rule_snapshot)
  values(instance.id,assessment.id,p_workspace_id,w.id,w.configuration_version_id,
    assessment.assessment_revision,assessment.package_digest,w.record_version,
    case when p_disposition='return' then 'returned' else 'qualified' end,
    clean_reason,clean_conditions,auth.uid(),(authority->>'actorProfileId')::uuid,
    (authority->>'decisionPermissionId')::uuid,authority->>'decisionPermissionDigest',instance.policy_digest,
    (strategy->>'ruleId')::uuid,strategy->>'ruleDigest',strategy->'ruleSnapshot')
  returning id into decision_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,
    case when p_disposition='return' then 'discover.g1_returned' else 'discover.g1_qualified' end,
    auth.uid(),to_jsonb(w),to_jsonb(w),jsonb_build_object('g1InstanceId',instance.id,
      'assessmentId',assessment.id,'assessmentRevision',assessment.assessment_revision,
      'packageDigest',assessment.package_digest,'decisionId',decision_id,
      'disposition',p_disposition,'reason',clean_reason,'conditions',clean_conditions,
      'policyDigest',instance.policy_digest,'strategyRuleDigest',strategy->>'ruleDigest',
      'decisionPermissionDigest',authority->>'decisionPermissionDigest',
      'spendingAuthorized',false));
  update public.d5o_trial_g1_decisions set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=decision_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'assessmentId',assessment.id,'decisionId',decision_id,'packageDigest',assessment.package_digest,
    'disposition',p_disposition,'strategyRuleDigest',strategy->>'ruleDigest',
    'spendingAuthorized',false,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.g1.decision.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_decide_discover_g1_v1(uuid,uuid,uuid,text,integer,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_decide_discover_g1_v1(uuid,uuid,uuid,text,integer,text,text,text,text)
  to authenticated;

create function public.d5o_get_discover_g1_decision_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; reader jsonb; authority jsonb;
  instance public.d5o_trial_g1_instances%rowtype; assessment public.d5o_trial_g1_assessments%rowtype;
  decision public.d5o_trial_g1_decisions%rowtype; can_decide boolean:=false;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  reader:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  select * into instance from public.d5o_trial_g1_instances
    where work_id=w.id and workspace_id=p_workspace_id for share;
  if instance.id is null then return jsonb_build_object('status','not_started','canDecide',false); end if;
  select * into assessment from public.d5o_trial_g1_assessments
    where instance_id=instance.id order by assessment_revision desc limit 1 for share;
  select * into decision from public.d5o_trial_g1_decisions
    where instance_id=instance.id order by decided_at desc,id desc limit 1 for share;
  if assessment.status='submitted' and (decision.id is null or decision.assessment_id<>assessment.id)
    and w.created_by<>auth.uid() and w.record_version=instance.source_work_version
    and w.lifecycle_state='triage_assigned' then
    begin
      authority:=rybex_internal.d5o_trial_g1_decision_authority(p_workspace_id,w.configuration_version_id);
      can_decide:=true;
    exception when others then can_decide:=false;
    end;
  end if;
  return jsonb_build_object('status',case when decision.disposition='qualified' then 'qualified'
    when assessment.id is null then 'preparing'
    when assessment.status='draft' then 'preparing'
    when decision.assessment_id=assessment.id and decision.disposition='returned' then 'returned'
    else 'pending_decision' end,
    'assessmentId',assessment.id,'assessmentRevision',assessment.assessment_revision,
    'packageDigest',case when assessment.status='submitted' then assessment.package_digest else null end,
    'recordVersion',w.record_version,'canDecide',can_decide,
    'decisionId',decision.id,'decisionReason',decision.reason,
    'decisionConditions',decision.conditions,'decisionByProfileId',decision.decision_profile_id,
    'spendingAuthorized',false);
end $$;
revoke all on function public.d5o_get_discover_g1_decision_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_get_discover_g1_decision_v1(uuid,uuid) to authenticated;
commit;
