-- UNAPPLIED, SYNTHETIC-TRIAL AUTHORITY CANDIDATE. No seed rows or grants.
-- Requires the existing M1 actor and configuration functions. Never run in
-- production or move into the migration chain without a separate review.

begin;

create table public.d5o_trial_employee_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  verified_by uuid not null references auth.users(id) on delete restrict,
  verification_reference text not null check (length(trim(verification_reference)) between 1 and 500),
  status text not null check (status in ('verified','revoked')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, organization_id),
  check (verified_by <> user_id),
  check (expires_at is null or expires_at > verified_at),
  check ((status = 'revoked') = (revoked_at is not null))
);
alter table public.d5o_trial_employee_verifications enable row level security;
revoke all on public.d5o_trial_employee_verifications from public, anon, authenticated;

create function rybex_internal.d5o_discover_capture_trial_authority(
  p_workspace_id uuid, p_configuration_version_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb;
  m public.workspace_memberships%rowtype;
  p public.user_profiles%rowtype;
  w public.workspaces%rowtype;
  t public.config_tenants%rowtype;
  permission public.config_permission_definitions%rowtype;
  verification public.d5o_trial_employee_verifications%rowtype;
  grant_rule jsonb;
begin
  -- The caller's transaction must also lock M1 configuration lineage before
  -- this function. This lock prevents a concurrent edit to the action grant.
  lock table public.config_permission_definitions,
    public.d5o_trial_employee_verifications in share mode;
  actor := rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into m from public.workspace_memberships
    where id=(actor->>'membership')::uuid and workspace_id=p_workspace_id
      and user_id=auth.uid() and status='active' for share;
  select * into p from public.user_profiles
    where id=(actor->>'profile')::uuid and user_id=auth.uid()
      and auth_user_id=auth.uid() and status='active' for share;
  select * into w from public.workspaces
    where id=p_workspace_id and status='active' for share;
  if m.id is null or p.id is null or w.id is null
     or w.organization_id is null
     or m.organization_id is distinct from w.organization_id
     or p.organization_id is distinct from w.organization_id
     or m.role='read_only_auditor' then
    raise exception 'forbidden';
  end if;
  select * into t from public.config_tenants
    where workspace_id=p_workspace_id and status<>'archived' for share;
  if not found or t.organization_id is distinct from w.organization_id then
    raise exception 'forbidden';
  end if;
  if (select count(*) from public.config_tenants
      where workspace_id=p_workspace_id and status<>'archived') <> 1 then
    raise exception 'ambiguous_tenant_mapping';
  end if;
  if public.config_configuration_version_tenant_id(p_configuration_version_id)
      is distinct from t.id then
    raise exception 'configuration_mismatch';
  end if;
  select * into verification from public.d5o_trial_employee_verifications
    where user_id=auth.uid() and organization_id=w.organization_id
      and status='verified' and (expires_at is null or expires_at>now()) for share;
  if not found then raise exception 'employee_verification_required'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_configuration_version_id
      and permission_key='discover.capture'
      and permission_scope='organization' and status='active' for share;
  if not found then raise exception 'capture_permission_unavailable'; end if;
  grant_rule := permission.default_grant_rule_json;
  if grant_rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired' <> '{}'::jsonb
     or jsonb_typeof(grant_rule->'workspaceRoles') is distinct from 'array'
     or jsonb_array_length(grant_rule->'workspaceRoles')=0
     or grant_rule->>'organizationScope' is distinct from 'same'
     or grant_rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
     or not (grant_rule->'workspaceRoles' ? m.role) then
    raise exception 'capture_permission_denied';
  end if;
  return jsonb_build_object(
    'actorUserId',auth.uid(), 'actorProfileId',p.id,
    'membershipId',m.id, 'organizationId',w.organization_id,
    'tenantId',t.id, 'permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)),
    'employeeVerificationId',verification.id);
end $$;

revoke all on function rybex_internal.d5o_discover_capture_trial_authority(uuid,uuid)
  from public, anon, authenticated, service_role;

-- No direct authenticated EXECUTE grant. A future reviewed capture RPC will
-- call this after d5o_m1_lock and within the root/draft/audit transaction.
-- Replay must rerun this check before returning a cached private receipt.
commit;
