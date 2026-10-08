-- Synthetic trial only: stable, scoped read of one Discover Work summary.
-- Apply to the owned scratch database, outside production migrations.
begin;
create function public.d5o_get_workspace_discover_opportunity_v1(
  p_workspace_id uuid,p_configuration_version_id uuid,p_work_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; cfg jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_work_id is null or p_configuration_version_id is null then raise exception 'invalid_command'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,p_configuration_version_id,'discover-opportunity','discover-intake');
  authority:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,p_configuration_version_id);
  if cfg->>'versionId' is distinct from p_configuration_version_id::text
    or cfg->>'tenantId' is distinct from authority->>'tenantId' then
    raise exception 'configuration_mismatch'; end if;
  select jsonb_build_object(
    'workId',w.id,'title',w.title,'state',w.lifecycle_state,
    'recordVersion',w.record_version,'updatedAt',d.updated_at,
    'customerName',coalesce(a.display_name,d.customer_context),
    'siteName',coalesce(s.display_name,d.site_context),
    'identityStatus',case when a.id is not null and s.id is not null then 'registered' else 'provisional' end,
    'needSummary',d.need_summary,'authorName',p.display_name)
    into result
  from public.d5o_work_records w
    join public.d5o_discover_capture_drafts d on d.work_id=w.id
      and d.workspace_id=w.workspace_id and d.configuration_version_id=w.configuration_version_id
    join public.user_profiles p on p.id=w.owner_profile_id
      and p.organization_id=(authority->>'organizationId')::uuid
    left join public.d5o_trial_accounts a on a.id=d.account_id
      and a.workspace_id=w.workspace_id and a.configuration_tenant_id=w.configuration_tenant_id
      and a.organization_id=(authority->>'organizationId')::uuid and a.status='trial_active'
    left join public.d5o_trial_sites s on s.id=d.site_id and s.account_id=a.id
      and s.workspace_id=w.workspace_id and s.configuration_tenant_id=w.configuration_tenant_id
      and s.organization_id=(authority->>'organizationId')::uuid and s.status='trial_active'
  where w.id=p_work_id and w.workspace_id=p_workspace_id
    and w.configuration_tenant_id=(authority->>'tenantId')::uuid
    and w.configuration_version_id=p_configuration_version_id
    and w.configuration_digest=rybex_internal.d5o_m1_digest(cfg)
    and w.work_type_key='discover-opportunity' and w.gate_key='discover-intake'
    and not exists(select 1 from public.d5o_work_sources x where x.work_id=w.id);
  return result;
end $$;
revoke all on function public.d5o_get_workspace_discover_opportunity_v1(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_get_workspace_discover_opportunity_v1(uuid,uuid,uuid)
  to authenticated;
commit;
