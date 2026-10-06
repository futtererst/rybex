-- UNAPPLIED RM01 operational-profile candidate for disposable Discover scratch E only.
-- Not a production migration or authority policy. Cost rows have no client grant/RPC.
begin;

create table public.d5o_trial_rm_grants (
  workspace_id uuid not null references public.workspaces(id),
  configuration_version_id uuid not null references public.config_configuration_versions(id),
  permission_id uuid not null,
  user_id uuid not null references auth.users(id),
  profile_id uuid not null references public.user_profiles(id),
  status text not null check(status in ('active','revoked')),
  primary key(workspace_id,configuration_version_id,permission_id,user_id),
  foreign key(permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id)
);
alter table public.d5o_trial_rm_grants enable row level security;
revoke all on public.d5o_trial_rm_grants from public,anon,authenticated,service_role;

create table public.d5o_trial_rm_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  organization_id uuid not null references public.organizations(id),
  configuration_tenant_id uuid not null references public.config_tenants(id),
  technician_code text not null check(length(technician_code) between 6 and 32),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(workspace_id,id),unique(workspace_id,technician_code)
);
alter table public.d5o_trial_rm_resources enable row level security;
revoke all on public.d5o_trial_rm_resources from public,anon,authenticated,service_role;

create table public.d5o_trial_rm_profile_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  workspace_id uuid not null,
  revision integer not null check(revision>0),
  profile jsonb not null check(jsonb_typeof(profile)='object'),
  profile_digest text not null check(profile_digest ~ '^[0-9a-f]{64}$'),
  recorded_by uuid not null references auth.users(id),
  permission_id uuid not null references public.config_permission_definitions(id),
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id),
  domain_event_id uuid references public.domain_events(id),
  recorded_at timestamptz not null default now(),
  unique(resource_id,revision),
  foreign key(workspace_id,resource_id)
    references public.d5o_trial_rm_resources(workspace_id,id)
);
alter table public.d5o_trial_rm_profile_versions enable row level security;
revoke all on public.d5o_trial_rm_profile_versions from public,anon,authenticated,service_role;

-- Separate protected store. No user-facing query, report, export or write command exists in this slice.
create table public.d5o_trial_rm_cost_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  resource_id uuid not null,
  effective_from date not null,
  currency text not null check(currency='USD'),
  hourly_cents bigint not null check(hourly_cents>=0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(workspace_id,resource_id)
    references public.d5o_trial_rm_resources(workspace_id,id),
  unique(resource_id,effective_from)
);
alter table public.d5o_trial_rm_cost_rates enable row level security;
revoke all on public.d5o_trial_rm_cost_rates from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_rm_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'immutable_rm_profile'; end if;
  if old.audit_event_id is not null or old.domain_event_id is not null
    or new.audit_event_id is null or new.domain_event_id is null
    or (to_jsonb(new)-'audit_event_id'-'domain_event_id')
       is distinct from (to_jsonb(old)-'audit_event_id'-'domain_event_id') then
    raise exception 'immutable_rm_profile'; end if;
  return new;
end $$;
create trigger d5o_trial_rm_profile_immutable before update or delete
  on public.d5o_trial_rm_profile_versions for each row
  execute function rybex_internal.d5o_trial_rm_immutable();
create function rybex_internal.d5o_trial_rm_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_trial_rm_profile_versions p where p.id=new.id
    and (p.audit_event_id is null or p.domain_event_id is null)) then
    raise exception 'rm_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_rm_profile_receipt after insert or update
  on public.d5o_trial_rm_profile_versions deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_rm_receipt();

create function rybex_internal.d5o_trial_rm_authority(
  p_workspace_id uuid,p_permission_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; membership public.workspace_memberships%rowtype;
  profile public.user_profiles%rowtype; workspace public.workspaces%rowtype;
  tenant public.config_tenants%rowtype; permission public.config_permission_definitions%rowtype;
  grant_row public.d5o_trial_rm_grants%rowtype; rule jsonb;
begin
  if p_permission_key not in ('rm.view_profiles','rm.create_profile','rm.edit_profile') then
    raise exception 'rm_permission_denied'; end if;
  lock table public.config_permission_definitions,
    public.d5o_trial_employee_verifications,public.d5o_trial_rm_grants in share mode;
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into membership from public.workspace_memberships
    where id=(actor->>'membership')::uuid and workspace_id=p_workspace_id
      and user_id=auth.uid() and status='active' for share;
  select * into profile from public.user_profiles
    where id=(actor->>'profile')::uuid and user_id=auth.uid()
      and auth_user_id=auth.uid() and status='active' for share;
  select * into workspace from public.workspaces
    where id=p_workspace_id and status='active' for share;
  select * into tenant from public.config_tenants
    where workspace_id=p_workspace_id and status in ('active','published') for share;
  if membership.id is null or profile.id is null or workspace.id is null or tenant.id is null
    or membership.organization_id<>workspace.organization_id
    or profile.organization_id<>workspace.organization_id
    or tenant.organization_id<>workspace.organization_id
    or (select count(*) from public.config_tenants where workspace_id=p_workspace_id
      and status<>'archived')<>1 then raise exception 'rm_permission_denied'; end if;
  if not exists(select 1 from public.d5o_trial_employee_verifications v
    where v.user_id=auth.uid() and v.organization_id=workspace.organization_id
      and v.status='verified' and (v.expires_at is null or v.expires_at>now())) then
    raise exception 'rm_verification_required'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=tenant.active_configuration_version_id
      and permission_key=p_permission_key and permission_scope='organization'
      and status='active' for share;
  if permission.id is null then raise exception 'rm_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? membership.role) then
    raise exception 'rm_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_rm_grants
    where workspace_id=p_workspace_id
      and configuration_version_id=tenant.active_configuration_version_id
      and permission_id=permission.id and user_id=auth.uid()
      and profile_id=profile.id and status='active' for share;
  if grant_row.user_id is null then raise exception 'rm_permission_denied'; end if;
  return jsonb_build_object('profileId',profile.id,'organizationId',workspace.organization_id,
    'tenantId',tenant.id,'configurationVersionId',tenant.active_configuration_version_id,
    'permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)),
    'workspaceRole',membership.role);
end $$;
revoke all on function rybex_internal.d5o_trial_rm_authority(uuid,text)
  from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_rm_validate_profile(p_profile jsonb)
returns void language plpgsql stable set search_path=public,pg_temp as $$
declare item text; day_number integer;
begin
  if jsonb_typeof(p_profile) is distinct from 'object'
    or p_profile-'name'-'grade'-'skills'-'certificates'-'homeBase'-'region'-'workingDays'-'workStart'-'workEnd'-'ptoDates'-'employmentType'-'active'-'linkedUserId'<>'{}'::jsonb
    or length(btrim(coalesce(p_profile->>'name',''))) not between 3 and 160
    or length(btrim(coalesce(p_profile->>'grade',''))) not between 2 and 80
    or length(btrim(coalesce(p_profile->>'homeBase',''))) not between 2 and 160
    or length(btrim(coalesce(p_profile->>'region',''))) not between 2 and 80
    or p_profile->>'employmentType' not in ('W2','1099')
    or jsonb_typeof(p_profile->'active') is distinct from 'boolean'
    or jsonb_typeof(p_profile->'skills') is distinct from 'array'
    or jsonb_typeof(p_profile->'certificates') is distinct from 'array'
    or jsonb_typeof(p_profile->'workingDays') is distinct from 'array'
    or jsonb_typeof(p_profile->'ptoDates') is distinct from 'array'
    or coalesce(p_profile->>'workStart','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p_profile->>'workEnd','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or (p_profile->>'workStart')::time >= (p_profile->>'workEnd')::time
    or (p_profile->'linkedUserId' is not null
      and jsonb_typeof(p_profile->'linkedUserId') not in ('null','string')) then
    raise exception 'invalid_rm_profile'; end if;
  if jsonb_array_length(p_profile->'skills') not between 1 and 20
    or jsonb_array_length(p_profile->'certificates') not between 0 and 20
    or jsonb_array_length(p_profile->'workingDays') not between 1 and 7
    or jsonb_array_length(p_profile->'ptoDates')>100 then
    raise exception 'invalid_rm_profile'; end if;
  for item in select value from jsonb_array_elements_text(p_profile->'skills') loop
    if length(btrim(item)) not between 2 and 80 then raise exception 'invalid_rm_profile'; end if;
  end loop;
  for item in select value from jsonb_array_elements_text(p_profile->'certificates') loop
    if length(btrim(item)) not between 2 and 80 then raise exception 'invalid_rm_profile'; end if;
  end loop;
  for item in select value from jsonb_array_elements_text(p_profile->'workingDays') loop
    if item not in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun') then
      raise exception 'invalid_rm_profile'; end if;
  end loop;
  for item in select value from jsonb_array_elements_text(p_profile->'ptoDates') loop
    if item !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid_rm_profile'; end if;
    perform item::date;
  end loop;
end $$;
revoke all on function rybex_internal.d5o_trial_rm_validate_profile(jsonb)
  from public,anon,authenticated,service_role;

create function public.d5o_rm_save_profile_v1(
  p_workspace_id uuid,p_resource_id uuid,p_expected_revision integer,
  p_command_id text,p_profile jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; resource public.d5o_trial_rm_resources%rowtype;
  prior public.d5o_trial_rm_profile_versions%rowtype;
  cached public.command_idempotency%rowtype; request_hash text; resource_id uuid;
  revision_number integer; audit_id uuid; event_id uuid; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_authority(p_workspace_id,
    case when p_resource_id is null then 'rm.create_profile' else 'rm.edit_profile' end);
  if p_expected_revision is null or p_expected_revision<0
    or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_command'; end if;
  perform rybex_internal.d5o_trial_rm_validate_profile(p_profile);
  if p_profile->>'linkedUserId' is not null and
    not exists(select 1 from public.user_profiles p
      join public.workspace_memberships m on m.user_profile_id=p.id
        and m.user_id=p.user_id and m.workspace_id=p_workspace_id and m.status='active'
      where p.user_id=(p_profile->>'linkedUserId')::uuid
        and p.organization_id=(authority->>'organizationId')::uuid and p.status='active') then
    raise exception 'invalid_rm_linked_user'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'rm.profile.save.v1',auth.uid(),p_workspace_id,p_resource_id,p_expected_revision,p_profile));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.rm.profile.save.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if p_resource_id is null then
    if p_expected_revision<>0 or authority->>'workspaceRole'<>'admin' then
      raise exception 'rm_profile_conflict'; end if;
    resource_id:=gen_random_uuid();
    insert into public.d5o_trial_rm_resources(id,workspace_id,organization_id,
      configuration_tenant_id,technician_code,created_by)
    values(resource_id,p_workspace_id,(authority->>'organizationId')::uuid,
      (authority->>'tenantId')::uuid,
      'T-'||upper(left(replace(resource_id::text,'-',''),8)),auth.uid());
    revision_number:=1;
  else
    select * into resource from public.d5o_trial_rm_resources
      where id=p_resource_id and workspace_id=p_workspace_id
        and organization_id=(authority->>'organizationId')::uuid
        and configuration_tenant_id=(authority->>'tenantId')::uuid for update;
    if resource.id is null then raise exception 'rm_profile_not_found'; end if;
    select * into prior from public.d5o_trial_rm_profile_versions p
      where p.resource_id=resource.id order by p.revision desc limit 1 for share;
    if prior.revision is distinct from p_expected_revision then
      raise exception 'rm_profile_conflict'; end if;
    if authority->>'workspaceRole'<>'admin'
      and (prior.profile->'employmentType' is distinct from p_profile->'employmentType'
        or prior.profile->'active' is distinct from p_profile->'active'
        or prior.profile->'linkedUserId' is distinct from p_profile->'linkedUserId') then
      raise exception 'rm_permission_denied'; end if;
    resource_id:=resource.id;revision_number:=prior.revision+1;
  end if;
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,'d5o_trial_rm_resource',
    resource_id,p_command_id,case when revision_number=1 then 'rm.profile_created'
      else 'rm.profile_revised' end,
    case when revision_number=1 then null else 'active' end,'active',auth.uid(),
    p_command_id,prior.profile,p_profile,
    jsonb_build_object('revision',revision_number,'profileDigest',
      rybex_internal.d5o_m1_digest(p_profile)));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,'d5o_trial_rm_resource',
    resource_id,revision_number,case when revision_number=1 then 'rm.profile_created'
      else 'rm.profile_revised' end,1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('revision',revision_number,'profileDigest',
      rybex_internal.d5o_m1_digest(p_profile)));
  insert into public.d5o_trial_rm_profile_versions(resource_id,workspace_id,revision,
    profile,profile_digest,recorded_by,permission_id,permission_digest,
    audit_event_id,domain_event_id)
  values(resource_id,p_workspace_id,revision_number,p_profile,
    rybex_internal.d5o_m1_digest(p_profile),auth.uid(),
    (authority->>'permissionId')::uuid,authority->>'permissionDigest',audit_id,event_id);
  result:=jsonb_build_object('success',true,'resourceId',resource_id,
    'revision',revision_number,'auditId',audit_id,'eventId',event_id,
    'created',revision_number=1);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.rm.profile.save.v1','d5o_trial_rm_resource',
    resource_id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_rm_save_profile_v1(uuid,uuid,integer,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_save_profile_v1(uuid,uuid,integer,text,jsonb)
  to authenticated;

create function public.d5o_rm_list_profiles_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_authority(p_workspace_id,'rm.view_profiles');
  select coalesce(jsonb_agg(jsonb_build_object('resourceId',r.id,
    'technicianCode',r.technician_code,'revision',p.revision,
    'profile',p.profile,'updatedAt',p.recorded_at) order by r.technician_code),'[]'::jsonb)
    into items from public.d5o_trial_rm_resources r
    join lateral (select * from public.d5o_trial_rm_profile_versions p
      where p.resource_id=r.id order by p.revision desc limit 1) p on true
    where r.workspace_id=p_workspace_id
      and r.organization_id=(authority->>'organizationId')::uuid
      and r.configuration_tenant_id=(authority->>'tenantId')::uuid;
  return jsonb_build_object('items',items,'canCreate',exists(
    select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.status='active' and d.permission_key='rm.create_profile'
        and d.configuration_version_id=(authority->>'configurationVersionId')::uuid),
    'canEdit',exists(select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.status='active' and d.permission_key='rm.edit_profile'
        and d.configuration_version_id=(authority->>'configurationVersionId')::uuid));
end $$;
revoke all on function public.d5o_rm_list_profiles_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_list_profiles_v1(uuid) to authenticated;

commit;
