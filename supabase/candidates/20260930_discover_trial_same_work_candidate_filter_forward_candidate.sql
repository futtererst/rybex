-- UNAPPLIED synthetic same-work active-candidate forward. Closed records remain historical.
begin;
create or replace function rybex_internal.d5o_discover_possible_duplicate(
  p_workspace_id uuid, p_tenant_id uuid, p_organization_id uuid,
  p_exclude_work_id uuid, p_title text, p_customer text,
  p_site text, p_need text
) returns boolean
language sql volatile security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.d5o_work_records existing
      left join public.d5o_discover_capture_drafts d on d.work_id=existing.id
      where existing.workspace_id=p_workspace_id
        and existing.configuration_tenant_id=p_tenant_id
        and existing.lifecycle_state<>'duplicate_closed'
        and (p_exclude_work_id is null or existing.id<>p_exclude_work_id)
        and ((lower(btrim(existing.title))=lower(btrim(p_title))
          and (p_customer is null or d.customer_context is null
            or lower(btrim(d.customer_context))=lower(btrim(p_customer))))
          or (p_customer is not null and nullif(btrim(p_site),'') is not null
            and nullif(btrim(p_need),'') is not null
            and lower(btrim(d.customer_context))=lower(btrim(p_customer))
            and lower(btrim(d.site_context))=lower(btrim(p_site))
            and lower(btrim(d.need_summary))=lower(btrim(p_need)))))
    or exists(select 1 from public.opportunities legacy
      where legacy.workspace_id=p_workspace_id
        and legacy.organization_id=p_organization_id
        and ((lower(btrim(legacy.name))=lower(btrim(p_title))
          and (p_customer is null or lower(btrim(legacy.gc_client))=lower(btrim(p_customer))))
          or (p_customer is not null and nullif(btrim(p_site),'') is not null
            and nullif(btrim(p_need),'') is not null
            and lower(btrim(legacy.gc_client))=lower(btrim(p_customer))
            and lower(btrim(legacy.project_location))=lower(btrim(p_site))
            and lower(btrim(legacy.scope_summary))=lower(btrim(p_need)))))
$$;
create or replace function public.d5o_find_discover_candidates_v1(
  p_workspace_id uuid, p_configuration_version_id uuid, p_gate_key text,
  p_customer_query text, p_title_query text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb;
  cfg jsonb;
  m public.workspace_memberships%rowtype;
  profile public.user_profiles%rowtype;
  workspace public.workspaces%rowtype;
  permission public.config_permission_definitions%rowtype;
  verification public.d5o_trial_employee_verifications%rowtype;
  rule jsonb;
  customer_query text;
  title_query text;
  rows jsonb;
  legacy_possible boolean;
begin
  if p_workspace_id is null or p_configuration_version_id is null
     or p_gate_key is null or p_gate_key !~ '^[a-z0-9][a-z0-9_-]*$'
     or p_customer_query is null or length(btrim(p_customer_query)) not between 3 and 120
     or (p_title_query is not null and nullif(btrim(p_title_query),'') is not null
       and length(btrim(p_title_query)) not between 3 and 240) then
    raise exception 'invalid_command';
  end if;
  customer_query:=lower(btrim(p_customer_query));
  title_query:=nullif(lower(btrim(p_title_query)),'');
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,p_configuration_version_id,'discover-opportunity',p_gate_key);
  if cfg->>'versionId' is distinct from p_configuration_version_id::text
     or cfg->'workType'->'lifecycle_json'->>'initialState' is distinct from 'intake_draft'
     or not exists(select 1 from public.config_gate_definitions g
       join public.config_phase_definitions ph
         on ph.id=g.phase_id and ph.configuration_version_id=g.configuration_version_id
       where g.configuration_version_id=p_configuration_version_id
         and g.gate_key=p_gate_key and ph.phase_key='discover'
         and g.status='active' and ph.status='active') then
    raise exception 'configuration_mismatch';
  end if;
  lock table public.config_permission_definitions,
    public.d5o_trial_employee_verifications in share mode;
  select * into m from public.workspace_memberships
    where id=(actor->>'membership')::uuid and workspace_id=p_workspace_id
      and user_id=auth.uid() and status='active' for share;
  select * into profile from public.user_profiles
    where id=(actor->>'profile')::uuid and user_id=auth.uid()
      and auth_user_id=auth.uid() and status='active' for share;
  select * into workspace from public.workspaces
    where id=p_workspace_id and status='active' for share;
  if m.id is null or profile.id is null or workspace.id is null
     or workspace.organization_id is null
     or m.organization_id is distinct from workspace.organization_id
     or profile.organization_id is distinct from workspace.organization_id
     or m.user_profile_id is distinct from profile.id
     or m.role='read_only_auditor' then
    raise exception 'forbidden';
  end if;
  if not exists(select 1 from public.config_tenants t
      where t.id=(cfg->>'tenantId')::uuid and t.workspace_id=p_workspace_id
        and t.organization_id=workspace.organization_id and t.status<>'archived')
     or (select count(*) from public.config_tenants t
       where t.workspace_id=p_workspace_id and t.status<>'archived')<>1 then
    raise exception 'ambiguous_tenant_mapping';
  end if;
  select * into verification from public.d5o_trial_employee_verifications
    where user_id=auth.uid() and organization_id=workspace.organization_id
      and status='verified' and (expires_at is null or expires_at>now()) for share;
  if not found then raise exception 'employee_verification_required'; end if;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=p_configuration_version_id
      and permission_key='discover.review_candidates'
      and permission_scope='organization' and status='active' for share;
  if not found then raise exception 'candidate_permission_unavailable'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired' <> '{}'::jsonb
     or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
     or jsonb_array_length(rule->'workspaceRoles')=0
     or rule->>'organizationScope' is distinct from 'same'
     or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
     or not (rule->'workspaceRoles' ? m.role) then
    raise exception 'candidate_permission_denied';
  end if;
  -- A currently authorized actor sees only minimal provisional context from
  -- new canonical roots in this workspace and configuration tenant. No count.
  select coalesce(jsonb_agg(jsonb_build_object(
      'workId',r.id,'title',r.title,'customerContext',r.customer_context,
      'siteContext',r.site_context,'lifecycleState',r.lifecycle_state)
      order by r.updated_at desc,r.id desc),'[]'::jsonb)
    into rows
  from (
    select w.id,w.title,d.customer_context,d.site_context,w.lifecycle_state,d.updated_at
    from public.d5o_work_records w
      join public.d5o_discover_capture_drafts d
        on d.work_id=w.id and d.workspace_id=w.workspace_id
    where w.workspace_id=p_workspace_id
      and w.configuration_tenant_id=(cfg->>'tenantId')::uuid
      and w.work_type_key='discover-opportunity'
      and w.lifecycle_state<>'duplicate_closed'
      and (strpos(lower(coalesce(d.customer_context,'')),customer_query)>0
        or (title_query is not null and lower(btrim(w.title))=title_query))
    order by d.updated_at desc,w.id desc limit 10
  ) r;
  -- Legacy opportunities remain separately identified. Until the source
  -- mapping is accepted, disclose only whether a potential hold exists.
  select exists(select 1 from public.opportunities o
    where o.workspace_id=p_workspace_id
      and o.organization_id=workspace.organization_id
      and (strpos(lower(o.gc_client),customer_query)>0
        or (title_query is not null and lower(btrim(o.name))=title_query)))
    into legacy_possible;
  return jsonb_build_object('items',rows,'legacyMatchPossible',legacy_possible);
end $$;
commit;

