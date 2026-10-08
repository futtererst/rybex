-- Disposable synthetic Discover trial only. Never apply as a production migration.
-- A G1 qualification selects pursuit; this separate record governs a bounded expense.
begin;

create table public.d5o_trial_spend_grants (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  permission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null check(status in ('active','revoked')),
  primary key(workspace_id,configuration_version_id,permission_id,user_id),
  foreign key(permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_spend_grants enable row level security;
revoke all on public.d5o_trial_spend_grants from public,anon,authenticated,service_role;

create table public.d5o_trial_spend_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  work_id uuid not null unique,
  configuration_version_id uuid not null,
  g1_decision_id uuid not null unique references public.d5o_trial_g1_decisions(id) on delete restrict,
  g1_package_digest text not null check(g1_package_digest ~ '^[0-9a-f]{64}$'),
  source_work_version integer not null check(source_work_version>0),
  amount numeric(12,2) not null check(amount>0),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  expires_on date not null,
  purpose text not null check(length(btrim(purpose)) between 20 and 1000),
  request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),
  requested_by uuid not null references auth.users(id) on delete restrict,
  request_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  request_permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  request_permission_digest text not null check(request_permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  requested_at timestamptz not null default now(),
  foreign key(work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_spend_requests enable row level security;
revoke all on public.d5o_trial_spend_requests from public,anon,authenticated,service_role;
create trigger d5o_trial_spend_request_immutable before update or delete
  on public.d5o_trial_spend_requests for each row
  execute function rybex_internal.d5o_trial_g1_assessment_immutable();

create table public.d5o_trial_spend_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.d5o_trial_spend_requests(id) on delete restrict,
  workspace_id uuid not null,
  work_id uuid not null,
  request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),
  disposition text not null check(disposition in ('authorize','decline')),
  reason text not null check(length(btrim(reason)) between 20 and 1000),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decision_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  decision_permission_id uuid not null references public.config_permission_definitions(id) on delete restrict,
  decision_permission_digest text not null check(decision_permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  domain_event_id uuid references public.domain_events(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id) on delete restrict
);
alter table public.d5o_trial_spend_decisions enable row level security;
revoke all on public.d5o_trial_spend_decisions from public,anon,authenticated,service_role;
create trigger d5o_trial_spend_decision_immutable before update or delete
  on public.d5o_trial_spend_decisions for each row
  execute function rybex_internal.d5o_trial_g1_assessment_immutable();

create function rybex_internal.d5o_trial_spend_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='d5o_trial_spend_requests' and exists(
    select 1 from public.d5o_trial_spend_requests r where r.id=new.id
      and (r.audit_event_id is null or r.domain_event_id is null)) then
    raise exception 'spend_receipt_missing'; end if;
  if tg_table_name='d5o_trial_spend_decisions' and exists(
    select 1 from public.d5o_trial_spend_decisions d where d.id=new.id
      and (d.audit_event_id is null or d.domain_event_id is null)) then
    raise exception 'spend_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_spend_request_receipt after insert or update
  on public.d5o_trial_spend_requests deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_spend_receipt();
create constraint trigger d5o_trial_spend_decision_receipt after insert or update
  on public.d5o_trial_spend_decisions deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_spend_receipt();

create function rybex_internal.d5o_trial_spend_authority(
  p_workspace_id uuid,p_version_id uuid,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; actor jsonb; membership public.workspace_memberships%rowtype;
  permission public.config_permission_definitions%rowtype;
  grant_row public.d5o_trial_spend_grants%rowtype; rule jsonb;
begin
  if p_key not in ('discover.request_spend','discover.authorize_spend') then
    raise exception 'spend_permission_denied'; end if;
  base:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,p_version_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into membership from public.workspace_memberships
    where id=(actor->>'membership')::uuid for share;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_version_id and permission_key=p_key
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'spend_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'-'maximumAmount'-'currency'-'maximumDurationDays'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? membership.role)
    or jsonb_typeof(rule->'maximumAmount') is distinct from 'number'
    or (rule->>'maximumAmount')::numeric<=0
    or rule->>'currency' is distinct from 'USD'
    or jsonb_typeof(rule->'maximumDurationDays') is distinct from 'number'
    or (rule->>'maximumDurationDays')::numeric not between 1 and 30 then
    raise exception 'spend_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_spend_grants
    where workspace_id=p_workspace_id and configuration_version_id=p_version_id
      and permission_id=permission.id and user_id=auth.uid()
      and profile_id=(base->>'actorProfileId')::uuid and status='active' for share;
  if grant_row.user_id is null then raise exception 'spend_permission_denied'; end if;
  return base||jsonb_build_object('spendPermissionId',permission.id,
    'spendPermissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)),
    'maximumAmount',(rule->>'maximumAmount')::numeric,
    'currency',rule->>'currency','maximumDurationDays',(rule->>'maximumDurationDays')::integer);
end $$;
revoke all on function rybex_internal.d5o_trial_spend_authority(uuid,uuid,text)
  from public,anon,authenticated,service_role;

create function public.d5o_request_discover_spend_v1(
  p_workspace_id uuid,p_work_id uuid,p_g1_decision_id uuid,p_expected_work_version integer,
  p_command_id text,p_amount numeric,p_currency text,p_expires_on date,p_purpose text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; qualified public.d5o_trial_g1_decisions%rowtype;
  authority jsonb; cfg jsonb; cached public.command_idempotency%rowtype;
  request_hash text; request_id uuid; request_digest text; events jsonb; result jsonb;
  clean_purpose text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  clean_purpose:=btrim(coalesce(p_purpose,''));
  if p_work_id is null or p_g1_decision_id is null or p_expected_work_version is null
    or p_expected_work_version<1
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2)
    or p_currency is distinct from 'USD' or p_expires_on is null
    or length(clean_purpose) not between 20 and 1000 then raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_spend_authority(p_workspace_id,w.configuration_version_id,'discover.request_spend');
  if w.created_by<>auth.uid() then raise exception 'spend_request_author_denied'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('discover.spend.request.v1',
    auth.uid(),p_workspace_id,p_work_id,p_g1_decision_id,p_expected_work_version,
    p_amount,p_currency,p_expires_on,clean_purpose));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.spend.request.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into qualified from public.d5o_trial_g1_decisions
    where id=p_g1_decision_id and work_id=w.id and workspace_id=p_workspace_id
      and disposition='qualified' for share;
  if qualified.id is null or qualified.strategy_rule_digest is null
    or w.record_version<>p_expected_work_version
    or w.record_version<>qualified.source_work_version or w.lifecycle_state<>'triage_assigned'
    or exists(select 1 from public.d5o_trial_spend_requests r where r.work_id=w.id) then
    raise exception 'spend_request_conflict'; end if;
  if p_amount>(authority->>'maximumAmount')::numeric
    or p_expires_on<current_date
    or p_expires_on>current_date+(authority->>'maximumDurationDays')::integer then
    raise exception 'spend_request_limit_exceeded'; end if;
  request_digest:=rybex_internal.d5o_m1_digest(jsonb_build_object('workId',w.id,
    'g1DecisionId',qualified.id,'g1PackageDigest',qualified.package_digest,
    'sourceWorkVersion',w.record_version,'amount',p_amount,'currency',p_currency,
    'expiresOn',p_expires_on,'purpose',clean_purpose,
    'requestPermissionDigest',authority->>'spendPermissionDigest'));
  insert into public.d5o_trial_spend_requests(workspace_id,work_id,configuration_version_id,
    g1_decision_id,g1_package_digest,source_work_version,amount,currency,expires_on,purpose,
    request_digest,requested_by,request_profile_id,request_permission_id,request_permission_digest)
  values(p_workspace_id,w.id,w.configuration_version_id,qualified.id,qualified.package_digest,
    w.record_version,p_amount,p_currency,p_expires_on,clean_purpose,request_digest,
    auth.uid(),(authority->>'actorProfileId')::uuid,
    (authority->>'spendPermissionId')::uuid,authority->>'spendPermissionDigest') returning id into request_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.spend_requested',
    auth.uid(),to_jsonb(w),to_jsonb(w),jsonb_build_object('requestId',request_id,
      'requestDigest',request_digest,'g1DecisionId',qualified.id,'amount',p_amount,
      'currency',p_currency,'expiresOn',p_expires_on,'purpose',clean_purpose,
      'spendingAuthorized',false));
  update public.d5o_trial_spend_requests set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=request_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'requestId',request_id,
    'requestDigest',request_digest,'spendingAuthorized',false,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.spend.request.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_request_discover_spend_v1(uuid,uuid,uuid,integer,text,numeric,text,date,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_request_discover_spend_v1(uuid,uuid,uuid,integer,text,numeric,text,date,text)
  to authenticated;

create function public.d5o_decide_discover_spend_v1(
  p_workspace_id uuid,p_work_id uuid,p_request_id uuid,p_request_digest text,
  p_command_id text,p_disposition text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; request_row public.d5o_trial_spend_requests%rowtype;
  qualified public.d5o_trial_g1_decisions%rowtype; authority jsonb; cfg jsonb;
  cached public.command_idempotency%rowtype; request_hash text; decision_id uuid;
  events jsonb; result jsonb; clean_reason text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  clean_reason:=btrim(coalesce(p_reason,''));
  if p_work_id is null or p_request_id is null or p_request_digest is null
    or p_request_digest !~ '^[0-9a-f]{64}$'
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_disposition is null or p_disposition not in ('authorize','decline')
    or length(clean_reason) not between 20 and 1000 then raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_spend_authority(p_workspace_id,w.configuration_version_id,'discover.authorize_spend');
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('discover.spend.decision.v1',
    auth.uid(),p_workspace_id,p_work_id,p_request_id,p_request_digest,p_disposition,clean_reason));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.spend.decision.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into request_row from public.d5o_trial_spend_requests
    where id=p_request_id and work_id=w.id and workspace_id=p_workspace_id for share;
  select * into qualified from public.d5o_trial_g1_decisions
    where id=request_row.g1_decision_id and work_id=w.id and workspace_id=p_workspace_id
      and disposition='qualified' for share;
  if request_row.id is null or qualified.id is null or qualified.strategy_rule_digest is null
    or request_row.request_digest<>p_request_digest
    or request_row.g1_package_digest<>qualified.package_digest
    or request_row.source_work_version<>w.record_version or w.lifecycle_state<>'triage_assigned'
    or exists(select 1 from public.d5o_trial_spend_decisions d where d.request_id=request_row.id)
    or request_row.requested_by=auth.uid() or qualified.decided_by=auth.uid() then
    raise exception 'spend_decision_conflict'; end if;
  if p_disposition='authorize' and (request_row.expires_on<current_date
    or request_row.amount>(authority->>'maximumAmount')::numeric
    or request_row.currency is distinct from authority->>'currency'
    or request_row.expires_on>request_row.requested_at::date+(authority->>'maximumDurationDays')::integer) then
    raise exception 'spend_decision_limit_exceeded'; end if;
  insert into public.d5o_trial_spend_decisions(request_id,workspace_id,work_id,request_digest,
    disposition,reason,decided_by,decision_profile_id,decision_permission_id,decision_permission_digest)
  values(request_row.id,p_workspace_id,w.id,request_row.request_digest,p_disposition,clean_reason,
    auth.uid(),(authority->>'actorProfileId')::uuid,(authority->>'spendPermissionId')::uuid,
    authority->>'spendPermissionDigest') returning id into decision_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,
    case when p_disposition='authorize' then 'discover.spend_authorized' else 'discover.spend_declined' end,
    auth.uid(),to_jsonb(w),to_jsonb(w),jsonb_build_object('requestId',request_row.id,
      'requestDigest',request_row.request_digest,'decisionId',decision_id,
      'disposition',p_disposition,'reason',clean_reason,'amount',request_row.amount,
      'currency',request_row.currency,'expiresOn',request_row.expires_on,
      'spendingAuthorized',p_disposition='authorize'));
  update public.d5o_trial_spend_decisions set audit_event_id=(events->>'audit')::uuid,
    domain_event_id=(events->>'event')::uuid where id=decision_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'requestId',request_row.id,
    'decisionId',decision_id,'disposition',p_disposition,
    'spendingAuthorized',p_disposition='authorize','events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.spend.decision.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_decide_discover_spend_v1(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_decide_discover_spend_v1(uuid,uuid,uuid,text,text,text,text)
  to authenticated;

create function public.d5o_get_discover_spend_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; reader jsonb;
  qualified public.d5o_trial_g1_decisions%rowtype;
  request_row public.d5o_trial_spend_requests%rowtype;
  decision_row public.d5o_trial_spend_decisions%rowtype;
  can_request boolean:=false; can_decide boolean:=false;
  request_authority jsonb; decision_authority jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  reader:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  select * into qualified from public.d5o_trial_g1_decisions
    where work_id=w.id and workspace_id=p_workspace_id and disposition='qualified' for share;
  select * into request_row from public.d5o_trial_spend_requests
    where work_id=w.id and workspace_id=p_workspace_id for share;
  select * into decision_row from public.d5o_trial_spend_decisions
    where request_id=request_row.id for share;
  if qualified.id is not null and qualified.strategy_rule_digest is not null
    and request_row.id is null and w.created_by=auth.uid()
    and w.record_version=qualified.source_work_version and w.lifecycle_state='triage_assigned' then
    begin
      request_authority:=rybex_internal.d5o_trial_spend_authority(p_workspace_id,w.configuration_version_id,'discover.request_spend');
      can_request:=true;
    exception when others then can_request:=false;
    end;
  end if;
  if request_row.id is not null and decision_row.id is null
    and request_row.requested_by<>auth.uid() and qualified.decided_by<>auth.uid()
    and w.record_version=request_row.source_work_version and w.lifecycle_state='triage_assigned' then
    begin
      decision_authority:=rybex_internal.d5o_trial_spend_authority(p_workspace_id,w.configuration_version_id,'discover.authorize_spend');
      can_decide:=true;
    exception when others then can_decide:=false;
    end;
  end if;
  return jsonb_build_object('status',case when qualified.id is null then 'not_qualified'
    when qualified.strategy_rule_digest is null then 'historical_qualification'
    when request_row.id is null then 'ready_to_request'
    when decision_row.disposition='decline' then 'declined'
    when decision_row.disposition='authorize' and request_row.expires_on<current_date then 'expired'
    when decision_row.disposition='authorize' then 'authorized'
    when request_row.expires_on<current_date then 'expired_pending'
    else 'pending_decision' end,
    'canRequest',can_request,'canDecide',can_decide,
    'g1DecisionId',qualified.id,'recordVersion',w.record_version,
    'requestId',request_row.id,'requestDigest',request_row.request_digest,
    'amount',request_row.amount,'currency',request_row.currency,
    'expiresOn',request_row.expires_on,'purpose',request_row.purpose,
    'requestedAt',request_row.requested_at,'decisionId',decision_row.id,
    'decisionReason',decision_row.reason,'maximumRequestAmount',request_authority->'maximumAmount',
    'maximumDecisionAmount',decision_authority->'maximumAmount',
    'spendingAuthorized',coalesce(decision_row.disposition='authorize' and request_row.expires_on>=current_date,false));
end $$;
revoke all on function public.d5o_get_discover_spend_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_get_discover_spend_v1(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
