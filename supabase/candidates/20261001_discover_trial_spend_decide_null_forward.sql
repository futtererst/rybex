begin;
create or replace function public.d5o_decide_discover_spend_v1(
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
commit;

