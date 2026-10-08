begin;
create or replace function public.d5o_request_discover_spend_v1(
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
commit;

