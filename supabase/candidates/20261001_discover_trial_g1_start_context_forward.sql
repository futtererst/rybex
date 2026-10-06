-- Synthetic trial forward correction: the visible CTA must match the command's
-- full grant and accepted-triage prerequisites. The command itself is unchanged.
begin;
create or replace function public.d5o_get_discover_g1_start_v1(p_workspace_id uuid,p_work_id uuid)
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
    and policy.rule_digest=rybex_internal.d5o_m1_digest(policy.rule_json)
    and exists(select 1 from public.d5o_trial_triage_submissions s
      join public.d5o_trial_triage_responses r on r.submission_id=s.id
      where s.work_id=w.id and s.workspace_id=p_workspace_id
        and r.disposition='accepted' and r.after_work_version=w.record_version
        and s.snapshot_digest=rybex_internal.d5o_m1_digest(s.snapshot)) then
    begin
      perform rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
      start_allowed:=true;
    exception when others then start_allowed:=false;
    end;
  end if;
  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'g1Status',case when instance.id is not null then instance.status
      when w.lifecycle_state<>'triage_assigned' then 'awaiting_triage_acceptance'
      when policy.id is null then 'gate_unconfigured' else 'not_started' end,
    'g1InstanceId',instance.id,'canStart',start_allowed,'spendingAuthorized',false);
end $$;
commit;
