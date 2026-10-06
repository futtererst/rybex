-- Synthetic-only workspace CRM projection. Apply only to the owned scratch
-- database; keep outside normal migrations and production policy.
begin;

create table public.d5o_trial_opportunity_read_grants (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  permission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null check (status in ('active','revoked')),
  granted_at timestamptz not null default now(),
  primary key (workspace_id,configuration_version_id,user_id),
  foreign key (permission_id,configuration_version_id)
    references public.config_permission_definitions(id,configuration_version_id) on delete restrict
);
alter table public.d5o_trial_opportunity_read_grants enable row level security;
revoke all on public.d5o_trial_opportunity_read_grants from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; m public.workspace_memberships%rowtype; p public.user_profiles%rowtype;
  w public.workspaces%rowtype; t public.config_tenants%rowtype;
  permission public.config_permission_definitions%rowtype;
  verification public.d5o_trial_employee_verifications%rowtype;
  grant_row public.d5o_trial_opportunity_read_grants%rowtype; rule jsonb;
begin
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into m from public.workspace_memberships where id=(actor->>'membership')::uuid
    and workspace_id=p_workspace_id and user_id=auth.uid() and status='active' for share;
  select * into p from public.user_profiles where id=(actor->>'profile')::uuid
    and user_id=auth.uid() and auth_user_id=auth.uid() and status='active' for share;
  select * into w from public.workspaces where id=p_workspace_id and status='active' for share;
  if m.id is null or p.id is null or w.id is null or w.organization_id is null
    or m.organization_id is distinct from w.organization_id
    or p.organization_id is distinct from w.organization_id
    or m.user_profile_id is distinct from p.id or m.role='read_only_auditor' then
    raise exception 'forbidden'; end if;
  select * into t from public.config_tenants where workspace_id=p_workspace_id and status<>'archived' for share;
  if t.id is null or t.organization_id is distinct from w.organization_id
    or (select count(*) from public.config_tenants where workspace_id=p_workspace_id and status<>'archived')<>1
    or public.config_configuration_version_tenant_id(p_version_id) is distinct from t.id then
    raise exception 'ambiguous_tenant_mapping'; end if;
  select * into verification from public.d5o_trial_employee_verifications
    where user_id=auth.uid() and organization_id=w.organization_id
      and status='verified' and (expires_at is null or expires_at>now()) for share;
  if verification.id is null then raise exception 'employee_verification_required'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_version_id and permission_key='discover.read_opportunities'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'opportunity_read_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? m.role) then
    raise exception 'opportunity_read_permission_denied'; end if;
  select * into grant_row from public.d5o_trial_opportunity_read_grants
    where workspace_id=p_workspace_id and configuration_version_id=p_version_id
      and permission_id=permission.id and user_id=auth.uid() and profile_id=p.id
      and status='active' for share;
  if grant_row.user_id is null then raise exception 'opportunity_read_permission_denied'; end if;
  return jsonb_build_object('actorProfileId',p.id,'organizationId',w.organization_id,'tenantId',t.id,
    'permissionId',permission.id,'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_opportunity_read_authority(uuid,uuid)
  from public,anon,authenticated,service_role;

create function public.d5o_list_workspace_discover_opportunities_v1(
  p_workspace_id uuid,p_configuration_version_id uuid,p_query text default '',
  p_state text default 'all',p_sort text default 'newest',
  p_before_updated_at timestamptz default null,p_before_work_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  authority jsonb; cfg jsonb; search_text text; items jsonb; more_rows boolean;
  next_updated_at timestamptz; next_work_id uuid;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  if p_configuration_version_id is null or length(coalesce(p_query,''))>120
    or p_state is null or p_state not in ('all','intake_draft','pending_owner_acceptance','triage_assigned','duplicate_closed')
    or p_sort is null or p_sort not in ('newest','oldest')
    or (p_before_updated_at is null)<>(p_before_work_id is null) then raise exception 'invalid_command'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,p_configuration_version_id,'discover-opportunity','discover-intake');
  authority:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,p_configuration_version_id);
  if cfg->>'versionId' is distinct from p_configuration_version_id::text
    or cfg->>'tenantId' is distinct from authority->>'tenantId' then
    raise exception 'configuration_mismatch'; end if;
  search_text:=lower(btrim(coalesce(p_query,'')));
  with eligible as (
    select w.id,w.title,w.lifecycle_state,w.record_version,d.updated_at,
      coalesce(a.display_name,d.customer_context) as customer_name,
      coalesce(s.display_name,d.site_context) as site_name,
      case when a.id is not null and s.id is not null then 'registered' else 'provisional' end as identity_status,
      d.need_summary,p.display_name as author_name
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
    where w.workspace_id=p_workspace_id and w.configuration_tenant_id=(authority->>'tenantId')::uuid
      and w.configuration_version_id=p_configuration_version_id
      and w.configuration_digest=rybex_internal.d5o_m1_digest(cfg)
      and w.work_type_key='discover-opportunity' and w.gate_key='discover-intake'
      and not exists(select 1 from public.d5o_work_sources x where x.work_id=w.id)
      and (p_state='all' or w.lifecycle_state=p_state)
      and (search_text='' or strpos(lower(w.title),search_text)>0
        or strpos(lower(coalesce(a.display_name,d.customer_context,'')),search_text)>0
        or strpos(lower(coalesce(s.display_name,d.site_context,'')),search_text)>0)
      and (p_before_updated_at is null
        or (p_sort='newest' and (d.updated_at,w.id)<(p_before_updated_at,p_before_work_id))
        or (p_sort='oldest' and (d.updated_at,w.id)>(p_before_updated_at,p_before_work_id)))
    order by case when p_sort='newest' then d.updated_at end desc,
      case when p_sort='newest' then w.id end desc,
      case when p_sort='oldest' then d.updated_at end asc,
      case when p_sort='oldest' then w.id end asc
    limit 51
  ), page as (
    select * from eligible order by case when p_sort='newest' then updated_at end desc,
      case when p_sort='newest' then id end desc,
      case when p_sort='oldest' then updated_at end asc,
      case when p_sort='oldest' then id end asc limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'workId',id,'title',title,'state',lifecycle_state,'recordVersion',record_version,
    'updatedAt',updated_at,'customerName',customer_name,'siteName',site_name,
    'identityStatus',identity_status,'needSummary',need_summary,'authorName',author_name)
    order by case when p_sort='newest' then updated_at end desc,
      case when p_sort='newest' then id end desc,
      case when p_sort='oldest' then updated_at end asc,
      case when p_sort='oldest' then id end asc),'[]'::jsonb),
    (select count(*)>50 from eligible) into items,more_rows from page;
  if more_rows then
    select (entry->>'updatedAt')::timestamptz,(entry->>'workId')::uuid
      into next_updated_at,next_work_id
    from jsonb_array_elements(items) with ordinality as e(entry,ordinality) where ordinality=50;
  end if;
  return jsonb_build_object('items',items,'hasMore',more_rows,
    'nextCursor',case when more_rows then jsonb_build_object(
      'updatedAt',next_updated_at,'workId',next_work_id) else null end);
end $$;
revoke all on function public.d5o_list_workspace_discover_opportunities_v1(
  uuid,uuid,text,text,text,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.d5o_list_workspace_discover_opportunities_v1(
  uuid,uuid,text,text,text,timestamptz,uuid) to authenticated;
commit;
