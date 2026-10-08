begin;
create or replace function public.d5o_get_discover_spend_v1(p_workspace_id uuid,p_work_id uuid)
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
commit;

