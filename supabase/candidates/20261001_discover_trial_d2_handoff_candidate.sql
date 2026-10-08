-- UNAPPLIED synthetic trial candidate. D1→D2 receiving handoff on the existing Work ID.
-- No production migration, policy, role grant or release authority is created here.
-- Apply in disposable scratch as supabase_admin, matching existing guarded RPC ownership.
begin;

create table public.d5o_trial_d2_handoff_grants (
  workspace_id uuid not null references public.workspaces(id),
  configuration_version_id uuid not null references public.config_configuration_versions(id),
  permission_id uuid not null,
  user_id uuid not null references auth.users(id),
  profile_id uuid not null references public.user_profiles(id),
  status text not null check(status in ('active','revoked')),
  primary key(workspace_id,configuration_version_id,permission_id,user_id),
  foreign key(permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id)
);
alter table public.d5o_trial_d2_handoff_grants enable row level security;
revoke all on public.d5o_trial_d2_handoff_grants from public,anon,authenticated,service_role;

create table public.d5o_trial_d2_handoff_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  work_id uuid not null,
  configuration_version_id uuid not null,
  revision integer not null check(revision>0),
  g1_decision_id uuid not null references public.d5o_trial_g1_decisions(id),
  source_work_version integer not null check(source_work_version>0),
  receiver_profile_id uuid not null references public.user_profiles(id),
  submitted_by uuid not null references auth.users(id),
  submitter_profile_id uuid not null references public.user_profiles(id),
  permission_id uuid not null references public.config_permission_definitions(id),
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  brief jsonb not null check(jsonb_typeof(brief)='object'),
  brief_digest text not null check(brief_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id),
  domain_event_id uuid references public.domain_events(id),
  submitted_at timestamptz not null default now(),
  unique(work_id,revision),unique(id,work_id,workspace_id),
  foreign key(work_id,workspace_id,configuration_version_id)
    references public.d5o_work_records(id,workspace_id,configuration_version_id)
);
alter table public.d5o_trial_d2_handoff_submissions enable row level security;
revoke all on public.d5o_trial_d2_handoff_submissions from public,anon,authenticated,service_role;

create table public.d5o_trial_d2_handoff_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  workspace_id uuid not null,
  work_id uuid not null,
  disposition text not null check(disposition in ('accepted','returned')),
  reason text not null check(length(btrim(reason)) between 20 and 1000),
  responded_by uuid not null references auth.users(id),
  responder_profile_id uuid not null references public.user_profiles(id),
  permission_id uuid not null references public.config_permission_definitions(id),
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id),
  domain_event_id uuid references public.domain_events(id),
  responded_at timestamptz not null default now(),
  foreign key(submission_id,work_id,workspace_id)
    references public.d5o_trial_d2_handoff_submissions(id,work_id,workspace_id)
);
alter table public.d5o_trial_d2_handoff_responses enable row level security;
revoke all on public.d5o_trial_d2_handoff_responses from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_d2_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'immutable_d2_handoff'; end if;
  if old.audit_event_id is not null or old.domain_event_id is not null
    or new.audit_event_id is null or new.domain_event_id is null
    or (to_jsonb(new)-'audit_event_id'-'domain_event_id')
      is distinct from (to_jsonb(old)-'audit_event_id'-'domain_event_id') then
    raise exception 'immutable_d2_handoff'; end if;
  return new;
end $$;
create trigger d5o_trial_d2_submission_immutable before update or delete
  on public.d5o_trial_d2_handoff_submissions for each row
  execute function rybex_internal.d5o_trial_d2_immutable();
create trigger d5o_trial_d2_response_immutable before update or delete
  on public.d5o_trial_d2_handoff_responses for each row
  execute function rybex_internal.d5o_trial_d2_immutable();
create function rybex_internal.d5o_trial_d2_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='d5o_trial_d2_handoff_submissions' and exists(
    select 1 from public.d5o_trial_d2_handoff_submissions s where s.id=new.id
      and (s.audit_event_id is null or s.domain_event_id is null)) then
    raise exception 'd2_receipt_missing'; end if;
  if tg_table_name='d5o_trial_d2_handoff_responses' and exists(
    select 1 from public.d5o_trial_d2_handoff_responses r where r.id=new.id
      and (r.audit_event_id is null or r.domain_event_id is null)) then
    raise exception 'd2_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_d2_submission_receipt after insert or update
  on public.d5o_trial_d2_handoff_submissions deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_d2_receipt();
create constraint trigger d5o_trial_d2_response_receipt after insert or update
  on public.d5o_trial_d2_handoff_responses deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_d2_receipt();

create function rybex_internal.d5o_trial_d2_authority(
  p_workspace_id uuid,p_version_id uuid,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; actor jsonb; membership public.workspace_memberships%rowtype;
  permission public.config_permission_definitions%rowtype;
  grant_row public.d5o_trial_d2_handoff_grants%rowtype; rule jsonb;
begin
  if p_key not in ('discover.submit_d2_handoff','define.receive_handoff') then
    raise exception 'd2_permission_denied'; end if;
  base:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,p_version_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into membership from public.workspace_memberships
    where id=(actor->>'membership')::uuid for share;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_version_id and permission_key=p_key
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'd2_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? membership.role) then
    raise exception 'd2_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_d2_handoff_grants
    where workspace_id=p_workspace_id and configuration_version_id=p_version_id
      and permission_id=permission.id and user_id=auth.uid()
      and profile_id=(base->>'actorProfileId')::uuid and status='active' for share;
  if grant_row.user_id is null then raise exception 'd2_permission_denied'; end if;
  return base||jsonb_build_object('permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_d2_authority(uuid,uuid,text)
  from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_d2_validate_brief(p_brief jsonb)
returns void language plpgsql stable set search_path=public,pg_temp as $$
declare item jsonb;
begin
  if jsonb_typeof(p_brief) is distinct from 'object'
    or p_brief-'customerNeed'-'scopeBoundary'-'assumptions'-'unknowns'-'actions'-'dueOn'<>'{}'::jsonb
    or length(btrim(coalesce(p_brief->>'customerNeed',''))) not between 20 and 2000
    or length(btrim(coalesce(p_brief->>'scopeBoundary',''))) not between 20 and 2000
    or jsonb_typeof(p_brief->'assumptions') is distinct from 'array'
    or jsonb_typeof(p_brief->'unknowns') is distinct from 'array'
    or jsonb_typeof(p_brief->'actions') is distinct from 'array'
    or jsonb_array_length(p_brief->'actions') not between 1 and 20
    or coalesce(p_brief->>'dueOn','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'invalid_d2_brief'; end if;
  for item in select value from jsonb_array_elements(p_brief->'actions') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item-'text'-'ownerProfileId'-'dueOn'<>'{}'::jsonb
      or length(btrim(coalesce(item->>'text',''))) not between 10 and 500
      or coalesce(item->>'ownerProfileId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item->>'dueOn','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid_d2_action'; end if;
  end loop;
end $$;
revoke all on function rybex_internal.d5o_trial_d2_validate_brief(jsonb)
  from public,anon,authenticated,service_role;

create function public.d5o_submit_d2_handoff_v1(
  p_workspace_id uuid,p_work_id uuid,p_g1_decision_id uuid,
  p_expected_work_version integer,p_receiver_profile_id uuid,p_command_id text,p_brief jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; g1 public.d5o_trial_g1_decisions%rowtype;
  prior public.d5o_trial_d2_handoff_submissions%rowtype; authority jsonb; cfg jsonb;
  cached public.command_idempotency%rowtype; request_hash text; digest text;
  submission_id uuid; revision_number integer; events jsonb; result jsonb; item jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_g1_decision_id is null or p_receiver_profile_id is null
    or p_expected_work_version is null or p_expected_work_version<1
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then
    raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_d2_authority(
    p_workspace_id,w.configuration_version_id,'discover.submit_d2_handoff');
  if w.created_by<>auth.uid() then raise exception 'd2_submit_permission_denied'; end if;
  perform rybex_internal.d5o_trial_d2_validate_brief(p_brief);
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.d2.submit.v1',auth.uid(),p_workspace_id,p_work_id,p_g1_decision_id,
    p_expected_work_version,p_receiver_profile_id,p_brief));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.d2.submit.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_work_version or w.lifecycle_state<>'triage_assigned' then
    raise exception 'd2_work_conflict'; end if;
  select * into g1 from public.d5o_trial_g1_decisions
    where id=p_g1_decision_id and work_id=w.id and workspace_id=p_workspace_id
      and disposition='qualified' for share;
  if g1.id is null or g1.source_work_version<>w.record_version
    or g1.strategy_rule_digest is null
    or not exists(select 1 from public.d5o_trial_g1_assessments assessed
      where assessed.id=g1.assessment_id and assessed.work_id=w.id
        and assessed.payload->>'nextOwnerProfileId'=p_receiver_profile_id::text)
    or exists(select 1 from public.d5o_trial_g1_decisions newer
      where newer.work_id=w.id and newer.disposition='qualified' and newer.decided_at>g1.decided_at)
    or not exists(select 1 from public.user_profiles receiver
      join public.workspace_memberships member on member.user_profile_id=receiver.id
        and member.user_id=receiver.user_id and member.organization_id=receiver.organization_id
        and member.workspace_id=p_workspace_id and member.status='active'
      where receiver.id=p_receiver_profile_id and receiver.status='active'
        and receiver.organization_id=(authority->>'organizationId')::uuid
        and receiver.user_id<>auth.uid()) then
    raise exception 'd2_basis_conflict'; end if;
  if (select current_rule->>'status' from
      (select rybex_internal.d5o_trial_g1_strategy_result(p_workspace_id,w.id) current_rule) x)
      is distinct from 'eligible'
    or (select current_rule->>'ruleDigest' from
      (select rybex_internal.d5o_trial_g1_strategy_result(p_workspace_id,w.id) current_rule) x)
      is distinct from g1.strategy_rule_digest then
    raise exception 'd2_strategy_changed'; end if;
  for item in select value from jsonb_array_elements(p_brief->'actions') loop
    if not exists(select 1 from public.user_profiles action_owner
      join public.workspace_memberships member on member.user_profile_id=action_owner.id
        and member.user_id=action_owner.user_id
        and member.organization_id=action_owner.organization_id
        and member.workspace_id=p_workspace_id and member.status='active'
      where action_owner.id=(item->>'ownerProfileId')::uuid
        and action_owner.status='active'
        and action_owner.organization_id=(authority->>'organizationId')::uuid) then
      raise exception 'd2_action_owner_invalid'; end if;
    perform (item->>'dueOn')::date;
  end loop;
  perform (p_brief->>'dueOn')::date;
  select * into prior from public.d5o_trial_d2_handoff_submissions
    where work_id=w.id order by revision desc limit 1 for share;
  if prior.id is not null and not exists(select 1 from public.d5o_trial_d2_handoff_responses response
    where response.submission_id=prior.id and response.disposition='returned') then
    raise exception 'd2_handoff_already_pending_or_accepted'; end if;
  revision_number:=coalesce(prior.revision,0)+1;
  digest:=rybex_internal.d5o_m1_digest(p_brief);
  insert into public.d5o_trial_d2_handoff_submissions(
    workspace_id,work_id,configuration_version_id,revision,g1_decision_id,
    source_work_version,receiver_profile_id,submitted_by,submitter_profile_id,
    permission_id,permission_digest,brief,brief_digest)
  values(p_workspace_id,w.id,w.configuration_version_id,revision_number,g1.id,
    w.record_version,p_receiver_profile_id,auth.uid(),
    (authority->>'actorProfileId')::uuid,(authority->>'permissionId')::uuid,
    authority->>'permissionDigest',p_brief,digest) returning id into submission_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.d2_handoff_submitted',
    auth.uid(),to_jsonb(w),to_jsonb(w),jsonb_build_object('submissionId',submission_id,
      'revision',revision_number,'briefDigest',digest,'g1DecisionId',g1.id,
      'receiverProfileId',p_receiver_profile_id,'receivingAccepted',false));
  update public.d5o_trial_d2_handoff_submissions
    set audit_event_id=(events->>'audit')::uuid,domain_event_id=(events->>'event')::uuid
    where id=submission_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'submissionId',submission_id,'revision',revision_number,'briefDigest',digest,
    'receivingAccepted',false,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.d2.submit.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_submit_d2_handoff_v1(uuid,uuid,uuid,integer,uuid,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_submit_d2_handoff_v1(uuid,uuid,uuid,integer,uuid,text,jsonb)
  to authenticated;

create function public.d5o_respond_d2_handoff_v1(
  p_workspace_id uuid,p_work_id uuid,p_submission_id uuid,p_brief_digest text,
  p_command_id text,p_disposition text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; submission public.d5o_trial_d2_handoff_submissions%rowtype;
  authority jsonb; cfg jsonb; cached public.command_idempotency%rowtype;
  request_hash text; response_id uuid; events jsonb; result jsonb; clean_reason text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  clean_reason:=btrim(coalesce(p_reason,''));
  if p_work_id is null or p_submission_id is null
    or p_brief_digest !~ '^[0-9a-f]{64}$'
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_disposition not in ('accepted','returned')
    or length(clean_reason) not between 20 and 1000 then
    raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then
    raise exception 'pinned_configuration_changed'; end if;
  authority:=rybex_internal.d5o_trial_d2_authority(
    p_workspace_id,w.configuration_version_id,'define.receive_handoff');
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.d2.respond.v1',auth.uid(),p_workspace_id,p_work_id,p_submission_id,
    p_brief_digest,p_disposition,clean_reason));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.d2.respond.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into submission from public.d5o_trial_d2_handoff_submissions
    where id=p_submission_id and work_id=w.id and workspace_id=p_workspace_id for share;
  if submission.id is null or submission.receiver_profile_id<>(authority->>'actorProfileId')::uuid
    or submission.submitted_by=auth.uid() or submission.brief_digest<>p_brief_digest
    or submission.brief_digest<>rybex_internal.d5o_m1_digest(submission.brief)
    or submission.source_work_version<>w.record_version
    or w.lifecycle_state<>'triage_assigned'
    or submission.revision<>(select max(s.revision) from public.d5o_trial_d2_handoff_submissions s
      where s.work_id=w.id)
    or exists(select 1 from public.d5o_trial_d2_handoff_responses r
      where r.submission_id=submission.id) then
    raise exception 'd2_response_conflict'; end if;
  insert into public.d5o_trial_d2_handoff_responses(
    submission_id,workspace_id,work_id,disposition,reason,responded_by,responder_profile_id,
    permission_id,permission_digest)
  values(submission.id,p_workspace_id,w.id,p_disposition,clean_reason,auth.uid(),
    (authority->>'actorProfileId')::uuid,(authority->>'permissionId')::uuid,
    authority->>'permissionDigest') returning id into response_id;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,
    case when p_disposition='accepted' then 'define.handoff_accepted' else 'define.handoff_returned' end,
    auth.uid(),to_jsonb(w),to_jsonb(w),jsonb_build_object('submissionId',submission.id,
      'revision',submission.revision,'briefDigest',submission.brief_digest,
      'responseId',response_id,'disposition',p_disposition,'reason',clean_reason,
      'receivingAccepted',p_disposition='accepted','spendingAuthorized',false));
  update public.d5o_trial_d2_handoff_responses
    set audit_event_id=(events->>'audit')::uuid,domain_event_id=(events->>'event')::uuid
    where id=response_id;
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'submissionId',submission.id,'responseId',response_id,'disposition',p_disposition,
    'receivingAccepted',p_disposition='accepted','spendingAuthorized',false,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.d2.respond.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_respond_d2_handoff_v1(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_respond_d2_handoff_v1(uuid,uuid,uuid,text,text,text,text)
  to authenticated;

create function public.d5o_get_d2_handoff_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; reader jsonb; cfg jsonb;
  submission public.d5o_trial_d2_handoff_submissions%rowtype;
  response public.d5o_trial_d2_handoff_responses%rowtype;
  g1 public.d5o_trial_g1_decisions%rowtype;
  can_submit boolean:=false; can_respond boolean:=false; history jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then
    raise exception 'pinned_configuration_changed'; end if;
  reader:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,w.configuration_version_id);
  select * into submission from public.d5o_trial_d2_handoff_submissions
    where work_id=w.id order by revision desc limit 1;
  if submission.id is not null
    and w.created_by<>auth.uid()
    and submission.receiver_profile_id<>(reader->>'actorProfileId')::uuid then
    raise exception 'd2_read_denied'; end if;
  if submission.id is null and w.created_by<>auth.uid() then raise exception 'd2_read_denied'; end if;
  if submission.id is not null then
    select * into response from public.d5o_trial_d2_handoff_responses
      where submission_id=submission.id;
  end if;
  select * into g1 from public.d5o_trial_g1_decisions
    where work_id=w.id and workspace_id=p_workspace_id and disposition='qualified'
      and strategy_rule_digest is not null order by decided_at desc limit 1;
  if w.created_by=auth.uid() and g1.id is not null
    and w.record_version=g1.source_work_version and w.lifecycle_state='triage_assigned'
    and (submission.id is null or response.disposition='returned') then
    begin
      perform rybex_internal.d5o_trial_d2_authority(
        p_workspace_id,w.configuration_version_id,'discover.submit_d2_handoff');
      can_submit:=true;
    exception when others then can_submit:=false;
    end;
  end if;
  if submission.id is not null and response.id is null
    and submission.receiver_profile_id=(reader->>'actorProfileId')::uuid
    and submission.submitted_by<>auth.uid() then
    begin
      perform rybex_internal.d5o_trial_d2_authority(
        p_workspace_id,w.configuration_version_id,'define.receive_handoff');
      can_respond:=true;
    exception when others then can_respond:=false;
    end;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('submissionId',s.id,'revision',s.revision,
    'briefDigest',s.brief_digest,'submittedAt',s.submitted_at,
    'disposition',r.disposition,'reason',r.reason,'respondedAt',r.responded_at)
    order by s.revision),'[]'::jsonb) into history
    from public.d5o_trial_d2_handoff_submissions s
    left join public.d5o_trial_d2_handoff_responses r on r.submission_id=s.id
    where s.work_id=w.id and s.workspace_id=p_workspace_id;
  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'g1DecisionId',g1.id,'status',case when submission.id is null then 'not_started'
      when response.disposition='accepted' then 'accepted'
      when response.disposition='returned' then 'returned' else 'awaiting_receiver' end,
    'canSubmit',can_submit,'canRespond',can_respond,
    'submissionId',submission.id,'revision',submission.revision,
    'receiverProfileId',submission.receiver_profile_id,
    'brief',submission.brief,'briefDigest',submission.brief_digest,
    'responseReason',response.reason,'history',history);
end $$;
revoke all on function public.d5o_get_d2_handoff_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_get_d2_handoff_v1(uuid,uuid) to authenticated;

commit;
