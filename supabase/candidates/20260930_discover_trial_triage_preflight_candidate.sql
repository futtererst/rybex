-- UNAPPLIED read-only synthetic trial candidate. Requires capture, registry and
-- identity-link candidates. This does not create a triage command or right.
begin;

create function public.d5o_discover_trial_triage_preflight_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; authority jsonb; cfg jsonb;
  w public.d5o_work_records%rowtype; d public.d5o_discover_capture_drafts%rowtype;
  identity_current boolean; owner_current boolean; possible_duplicate boolean;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity'
    or w.owner_profile_id is distinct from (actor->>'profile')::uuid
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or d.capture_permission_digest is distinct from authority->>'permissionDigest'
    or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'forbidden'; end if;
  select exists(select 1 from public.d5o_trial_accounts a
      join public.d5o_trial_sites s on s.id=d.site_id and s.account_id=a.id
        and s.workspace_id=a.workspace_id and s.configuration_tenant_id=a.configuration_tenant_id
        and s.organization_id=a.organization_id
      where a.id=d.account_id and a.workspace_id=p_workspace_id
        and a.configuration_tenant_id=w.configuration_tenant_id
        and a.organization_id=(authority->>'organizationId')::uuid
        and a.status='trial_active' and s.status='trial_active'
        and a.fixture_manifest_digest is not null
        and s.fixture_manifest_digest=a.fixture_manifest_digest)
    into identity_current;
  select exists(select 1 from public.user_profiles p
      join public.workspace_memberships m on m.user_profile_id=p.id
        and m.user_id=p.user_id and m.workspace_id=p_workspace_id
      where p.id=d.triage_owner_profile_id and p.status='active' and m.status='active'
        and p.organization_id=(authority->>'organizationId')::uuid
        and m.organization_id=p.organization_id)
    into owner_current;
  -- Snapshot only. A future submission must recheck inside its write transaction.
  lock table public.opportunities in share mode;
  possible_duplicate:=rybex_internal.d5o_discover_possible_duplicate(
    p_workspace_id,w.configuration_tenant_id,(authority->>'organizationId')::uuid,
    w.id,w.title,d.customer_context,d.site_context,d.need_summary);
  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'lifecycleState',w.lifecycle_state,'checkedAt',now(),
    'facts',jsonb_build_object(
      'identityLinked',d.account_id is not null and d.site_id is not null,
      'identityCurrent',identity_current,
      'sourceRecorded',d.source_kind is not null,
      'needRecorded',d.need_summary is not null,
      'triageOwnerSelected',d.triage_owner_profile_id is not null,
      'triageOwnerCurrent',owner_current,
      'possibleDuplicate',possible_duplicate,
      'authorDisposition',d.duplicate_disposition),
    'blockers',to_jsonb(array_remove(array[
      case when w.lifecycle_state<>'intake_draft' then 'not_intake_draft' end,
      case when not identity_current then 'account_site_link_required' end,
      case when d.source_kind is null then 'source_required' end,
      case when d.need_summary is null then 'customer_need_required' end,
      case when not owner_current then 'triage_owner_required' end,
      case when possible_duplicate then 'possible_existing_work' end,
      'independent_duplicate_disposition_not_commissioned',
      'triage_owner_routing_not_commissioned',
      'triage_submission_not_commissioned'
    ]::text[],null)));
end $$;

revoke all on function public.d5o_discover_trial_triage_preflight_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
commit;
