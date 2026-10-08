-- Forward-only hardening of the isolated hosted create command. A role may
-- create a Work Type only when that pinned version explicitly grants it.
create table d5o_hosted.configuration_create_rights (
  configuration_version_id uuid not null,
  work_type_key text not null,
  workspace_role text not null check (workspace_role in (
    'executive', 'operations_leader', 'business_development_lead',
    'project_manager', 'billing_commercial_lead', 'field_supervisor',
    'closeout_lead', 'admin'
  )),
  primary key (configuration_version_id, work_type_key, workspace_role),
  foreign key (configuration_version_id, work_type_key)
    references d5o_hosted.configuration_work_types(configuration_version_id, work_type_key)
);
alter table d5o_hosted.configuration_create_rights enable row level security;
revoke all on d5o_hosted.configuration_create_rights from public, anon, authenticated;

-- Preserve the applied function source. The core is no longer directly
-- executable by an API role; the wrapper below validates current authority,
-- mapping and version even when the core returns an idempotent prior receipt.
alter function public.d5o_hosted_create_work_v1(text,text,uuid,text,text)
  rename to d5o_hosted_create_work_core_v1;
revoke all on function public.d5o_hosted_create_work_core_v1(text,text,uuid,text,text)
  from public, anon, authenticated;

create function public.d5o_hosted_create_work_v1(
  p_workspace_key text, p_command_id text, p_configuration_version_id uuid,
  p_work_type_key text, p_title text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_workspace d5o_hosted.workspaces%rowtype;
  v_membership d5o_hosted.memberships%rowtype;
  v_tenant d5o_hosted.configuration_tenants%rowtype;
  v_version d5o_hosted.configuration_versions%rowtype;
  v_count integer;
  v_retry boolean;
begin
  if v_actor is null or p_workspace_key is null or p_configuration_version_id is null
      or p_work_type_key is null or p_command_id is null
      or length(p_command_id) not between 8 and 120
      or p_title is null or length(trim(p_title)) not between 1 and 240 then
    raise exception 'invalid_work_command' using errcode = '22023';
  end if;
  select * into v_workspace from d5o_hosted.workspaces
    where workspace_key = p_workspace_key and status = 'active' for share;
  if not found then raise exception 'workspace_forbidden' using errcode = '42501'; end if;
  select * into v_membership from d5o_hosted.memberships
    where workspace_id = v_workspace.id and actor_user_id = v_actor
      and status = 'active' for share;
  if not found or v_membership.role = 'read_only_auditor' then
    raise exception 'workspace_forbidden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('d5o-hosted-work:' || v_workspace.id::text, 0));
  lock table d5o_hosted.configuration_tenants,
    d5o_hosted.configuration_versions,
    d5o_hosted.configuration_work_types,
    d5o_hosted.configuration_create_rights in share mode;
  select count(*) into v_count from d5o_hosted.configuration_tenants
    where workspace_id = v_workspace.id and status = 'active';
  if v_count = 0 then raise exception 'no_tenant_mapping' using errcode = '22023'; end if;
  if v_count <> 1 then raise exception 'ambiguous_tenant_mapping' using errcode = '22023'; end if;
  select * into v_tenant from d5o_hosted.configuration_tenants
    where workspace_id = v_workspace.id and status = 'active';
  select exists(select 1 from d5o_hosted.work_command_receipts
    where workspace_id = v_workspace.id and command_id = p_command_id) into v_retry;
  select * into v_version from d5o_hosted.configuration_versions
    where id = p_configuration_version_id and tenant_id = v_tenant.id
      and (status = 'published' or (v_retry and status = 'superseded'))
      and (v_retry or (effective_from <= now()
        and (effective_to is null or effective_to > now())));
  if not found then raise exception 'configuration_unavailable' using errcode = '22023'; end if;
  if not exists (select 1 from d5o_hosted.configuration_work_types
      where configuration_version_id = v_version.id
        and work_type_key = p_work_type_key and status = 'active') then
    raise exception 'incompatible_work_type' using errcode = '22023';
  end if;
  if not exists (select 1 from d5o_hosted.configuration_create_rights
      where configuration_version_id = v_version.id
        and work_type_key = p_work_type_key
        and workspace_role = v_membership.role) then
    raise exception 'create_authority_denied' using errcode = '42501';
  end if;
  return public.d5o_hosted_create_work_core_v1(p_workspace_key, p_command_id,
    p_configuration_version_id, p_work_type_key, p_title);
end;
$$;
revoke all on function public.d5o_hosted_create_work_v1(text,text,uuid,text,text)
  from public, anon;
grant execute on function public.d5o_hosted_create_work_v1(text,text,uuid,text,text)
  to authenticated;
