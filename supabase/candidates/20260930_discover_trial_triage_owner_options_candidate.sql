-- UNAPPLIED synthetic trial candidate. Explicit owner eligibility and a
-- minimal, tenant-scoped picker. Proposal is not owner acceptance.
begin;

create function rybex_internal.d5o_trial_triage_owner_eligible(
  p_workspace_id uuid,p_configuration_version_id uuid,p_owner_profile_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare permission public.config_permission_definitions%rowtype; rule jsonb;
begin
  if p_owner_profile_id is null then return false; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_configuration_version_id
      and permission_key='discover.accept_triage'
      and permission_scope='organization' and status='active';
  if permission.id is null then return false; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb then
    return false; end if;
  return exists(select 1 from public.user_profiles p
    join public.workspace_memberships m on m.user_profile_id=p.id
      and m.workspace_id=p_workspace_id and m.user_id=p.user_id
    join public.workspaces w on w.id=m.workspace_id and w.status='active'
    join public.config_tenants t on t.workspace_id=w.id and t.status='active'
    join public.d5o_trial_employee_verifications v on v.user_id=p.user_id
      and v.organization_id=w.organization_id
      and v.status='verified' and (v.expires_at is null or v.expires_at>now())
    where p.id=p_owner_profile_id and p.status='active' and m.status='active'
      and p.auth_user_id=p.user_id and p.organization_id=w.organization_id
      and m.organization_id=w.organization_id
      and t.organization_id=w.organization_id
      and t.active_configuration_version_id=p_configuration_version_id
      and rule->'workspaceRoles' ? m.role);
end $$;
revoke all on function rybex_internal.d5o_trial_triage_owner_eligible(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;

create function public.d5o_list_discover_triage_owners_v1(
  p_workspace_id uuid,p_configuration_version_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; permission public.config_permission_definitions%rowtype;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(
    p_workspace_id,p_configuration_version_id);
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_configuration_version_id
      and permission_key='discover.accept_triage'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'triage_owner_policy_unavailable'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
      'profileId',r.id,'label',r.display_name) order by r.display_name,r.id)
    from (select p.id,p.display_name from public.user_profiles p
      where p.organization_id=(authority->>'organizationId')::uuid
        and rybex_internal.d5o_trial_triage_owner_eligible(
          p_workspace_id,p_configuration_version_id,p.id)
      order by p.display_name,p.id limit 30) r),'[]'::jsonb),
    'policyDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function public.d5o_list_discover_triage_owners_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
commit;
