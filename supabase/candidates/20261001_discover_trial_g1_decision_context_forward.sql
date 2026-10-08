-- Add correction availability to the scoped G1 decision read projection.
begin;
create or replace function public.d5o_get_discover_g1_decision_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; reader jsonb; authority jsonb;
  instance public.d5o_trial_g1_instances%rowtype; assessment public.d5o_trial_g1_assessments%rowtype;
  decision public.d5o_trial_g1_decisions%rowtype; can_decide boolean:=false; can_reopen boolean:=false;
  strategy jsonb; strategy_status text; strategy_reason text;
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
  if instance.id is null then return jsonb_build_object('status','not_started','canDecide',false,'canReopen',false); end if;
  select * into assessment from public.d5o_trial_g1_assessments
    where instance_id=instance.id order by assessment_revision desc limit 1 for share;
  select * into decision from public.d5o_trial_g1_decisions
    where instance_id=instance.id order by decided_at desc,id desc limit 1 for share;
  if decision.disposition='qualified' then
    strategy_status:=case when decision.strategy_rule_digest is null
      then 'historical_unrecorded' else 'recorded' end;
    strategy_reason:=case when decision.strategy_rule_digest is null
      then 'This earlier synthetic decision has no pinned strategy rule.' else null end;
  elsif assessment.status='submitted' then
    strategy:=rybex_internal.d5o_trial_g1_strategy_result(p_workspace_id,w.id);
    if assessment.package_snapshot->'strategyResult' is null then
      strategy_status:='stale';
      strategy_reason:='This package predates the strategy rule. Return it for a fresh submission.';
    elsif assessment.package_snapshot->'strategyResult'->>'status' is distinct from 'eligible' then
      strategy_status:=coalesce(assessment.package_snapshot->'strategyResult'->>'status','unconfigured');
      strategy_reason:=assessment.package_snapshot->'strategyResult'->>'reason';
    elsif strategy->>'status' is distinct from 'eligible' then
      strategy_status:=coalesce(strategy->>'status','unconfigured');
      strategy_reason:=strategy->>'reason';
    elsif assessment.package_snapshot->'strategyResult'->>'ruleDigest' is distinct from strategy->>'ruleDigest'
      or assessment.package_snapshot->'strategyResult'->'ruleSnapshot' is distinct from strategy->'ruleSnapshot' then
      strategy_status:='stale';
      strategy_reason:='The strategy rule changed after submission. Return for a new package.';
    else strategy_status:='eligible'; strategy_reason:=strategy->>'reason'; end if;
  end if;
  if assessment.status='submitted' and (decision.id is null or decision.assessment_id<>assessment.id)
    and w.created_by<>auth.uid() and w.record_version=instance.source_work_version
    and w.lifecycle_state='triage_assigned' then
    begin
      authority:=rybex_internal.d5o_trial_g1_decision_authority(p_workspace_id,w.configuration_version_id);
      can_decide:=true;
    exception when others then can_decide:=false;
    end;
  end if;
  if assessment.status='submitted' and decision.assessment_id=assessment.id
    and decision.disposition='returned' and w.created_by=auth.uid()
    and instance.started_by=auth.uid() and w.record_version=instance.source_work_version
    and w.lifecycle_state='triage_assigned' then
    begin
      authority:=rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
      can_reopen:=true;
    exception when others then can_reopen:=false;
    end;
  end if;
  return jsonb_build_object('status',case when decision.disposition='qualified' then 'qualified'
    when assessment.id is null or assessment.status='draft' then 'preparing'
    when decision.assessment_id=assessment.id and decision.disposition='returned' then 'returned'
    else 'pending_decision' end,
    'assessmentId',assessment.id,'assessmentRevision',assessment.assessment_revision,
    'packageDigest',case when assessment.status='submitted' then assessment.package_digest else null end,
    'recordVersion',w.record_version,'canDecide',can_decide,'canReopen',can_reopen,
    'canQualify',coalesce(can_decide and strategy_status='eligible'
      and (assessment.payload->>'proposedCapAmount')::numeric<=(authority->>'maximumProposedCapAmount')::numeric,false),
    'strategyStatus',strategy_status,'strategyReason',strategy_reason,
    'strategyRuleDigest',case when decision.disposition='qualified' then decision.strategy_rule_digest
      else assessment.package_snapshot->'strategyResult'->>'ruleDigest' end,
    'maximumProposedCapAmount',case when can_decide then authority->'maximumProposedCapAmount' else null end,
    'decisionId',decision.id,'decisionReason',decision.reason,
    'decisionConditions',decision.conditions,'decisionByProfileId',decision.decision_profile_id,
    'spendingAuthorized',false);
end $$;
commit;
