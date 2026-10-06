-- Disposable Discover scratch E: versioned D4 package drafts, no approval or release.
begin;
create table public.d5o_trial_d4_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  work_id uuid not null,
  package_code text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(id,workspace_id),unique(workspace_id,package_code),
  foreign key(work_id,workspace_id) references public.d5o_trial_rm_jobs(work_id,workspace_id)
);
alter table public.d5o_trial_d4_packages enable row level security;
revoke all on public.d5o_trial_d4_packages from public,anon,authenticated,service_role;
create table public.d5o_trial_d4_package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null,
  workspace_id uuid not null,
  revision integer not null check(revision>0),
  work_id uuid not null,
  job_revision integer not null check(job_revision>0),
  state text not null default 'draft' check(state='draft'),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  payload_digest text not null check(payload_digest ~ '^[0-9a-f]{64}$'),
  recorded_by uuid not null references auth.users(id),
  permission_id uuid not null references public.config_permission_definitions(id),
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid not null references public.audit_events(id),
  domain_event_id uuid not null references public.domain_events(id),
  recorded_at timestamptz not null default now(),
  unique(package_id,revision),
  foreign key(package_id,workspace_id) references public.d5o_trial_d4_packages(id,workspace_id)
);
alter table public.d5o_trial_d4_package_versions enable row level security;
revoke all on public.d5o_trial_d4_package_versions from public,anon,authenticated,service_role;
create function rybex_internal.d5o_trial_d4_package_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'immutable_d4_package_version';
end $$;
create trigger d5o_trial_d4_package_immutable before update or delete
  on public.d5o_trial_d4_package_versions for each row
  execute function rybex_internal.d5o_trial_d4_package_immutable();

create function rybex_internal.d5o_trial_d4_package_authority(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; permission public.config_permission_definitions%rowtype; rule jsonb;
begin
  base:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into permission from public.config_permission_definitions
    where configuration_version_id=(base->>'configurationVersionId')::uuid
      and permission_key='d4.edit_package_draft'
      and permission_scope='organization' and status='active' for share;
  if permission.id is null then raise exception 'd4_package_permission_denied'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? (base->>'workspaceRole'))
    or not exists(select 1 from public.d5o_trial_rm_grants g
      where g.workspace_id=p_workspace_id
        and g.configuration_version_id=(base->>'configurationVersionId')::uuid
        and g.permission_id=permission.id and g.user_id=auth.uid()
        and g.profile_id=(base->>'profileId')::uuid and g.status='active') then
    raise exception 'd4_package_permission_denied'; end if;
  return base||jsonb_build_object('permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_d4_package_authority(uuid)
  from public,anon,authenticated,service_role;

create function public.d5o_d4_list_package_drafts_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; job public.d5o_trial_rm_jobs%rowtype; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into job from public.d5o_trial_rm_jobs
    where work_id=p_work_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if job.work_id is null then raise exception 'd4_package_scope_invalid'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.package_code,
    'revision',v.revision,'jobRevision',v.job_revision,'state',v.state,
    'payload',v.payload,'updatedAt',v.recorded_at) order by p.created_at,p.id),'[]'::jsonb)
    into items from public.d5o_trial_d4_packages p
    join lateral(select * from public.d5o_trial_d4_package_versions v
      where v.package_id=p.id order by v.revision desc limit 1) v on true
    where p.work_id=p_work_id and p.workspace_id=p_workspace_id
      and p.configuration_tenant_id=job.configuration_tenant_id
      and p.organization_id=job.organization_id;
  return jsonb_build_object('workId',p_work_id,'items',items,
    'canEdit',exists(select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions d on d.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.profile_id=(authority->>'profileId')::uuid and g.status='active'
        and d.permission_key='d4.edit_package_draft'
        and d.configuration_version_id=(authority->>'configurationVersionId')::uuid));
end $$;
revoke all on function public.d5o_d4_list_package_drafts_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_list_package_drafts_v1(uuid,uuid) to authenticated;

create function public.d5o_d4_save_package_draft_v1(p_workspace_id uuid,p_work_id uuid,
  p_package_id uuid,p_expected_revision integer,p_expected_job_revision integer,
  p_command_id text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; job public.d5o_trial_rm_jobs%rowtype;
  job_version public.d5o_trial_rm_job_versions%rowtype;
  package public.d5o_trial_d4_packages%rowtype;
  prior public.d5o_trial_d4_package_versions%rowtype;
  cached public.command_idempotency%rowtype;
  request_hash text; new_id uuid; revision_number integer;
  audit_id uuid; event_id uuid; result jsonb; key text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_d4_package_authority(p_workspace_id);
  if p_work_id is null or p_expected_revision is null or p_expected_revision<0
    or p_expected_job_revision is null or p_expected_job_revision<1
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload-'scopeSummary'-'siteZone'-'methodReference'-'hazardNotes'
      -'permitNotes'-'materialNotes'-'testInstructions'-'holdPoints'
      -'contingency'-'plannedStart'-'plannedEnd'<>'{}'::jsonb then
    raise exception 'invalid_d4_package_command'; end if;
  foreach key in array array['scopeSummary','siteZone','methodReference',
    'hazardNotes','permitNotes','materialNotes','testInstructions','holdPoints',
    'contingency','plannedStart','plannedEnd'] loop
    if jsonb_typeof(p_payload->key) is distinct from 'string'
      or length(p_payload->>key)>4000 then raise exception 'invalid_d4_package_payload'; end if;
  end loop;
  if length(btrim(p_payload->>'scopeSummary'))<20
    or length(btrim(p_payload->>'siteZone'))<2
    or (p_payload->>'plannedStart')::timestamptz
      >=(p_payload->>'plannedEnd')::timestamptz then
    raise exception 'invalid_d4_package_payload'; end if;
  select * into job from public.d5o_trial_rm_jobs
    where work_id=p_work_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  select * into job_version from public.d5o_trial_rm_job_versions
    where work_id=job.work_id order by revision desc limit 1 for share;
  if job.work_id is null or job_version.id is null then
    raise exception 'd4_package_scope_invalid'; end if;
  if job_version.revision<>p_expected_job_revision then
    raise exception 'd4_package_job_stale'; end if;
  if (p_payload->>'plannedStart')::timestamptz
      <(job_version.payload->>'scheduledStart')::timestamptz
    or (p_payload->>'plannedEnd')::timestamptz
      >(job_version.payload->>'scheduledEnd')::timestamptz then
    raise exception 'd4_package_window_outside_job'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'd4.package.draft.v1',auth.uid(),p_workspace_id,p_work_id,p_package_id,
    p_expected_revision,p_expected_job_revision,p_payload));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.d4.package.draft.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if p_package_id is null then
    if p_expected_revision<>0 then raise exception 'd4_package_conflict'; end if;
    new_id:=gen_random_uuid();revision_number:=1;
    insert into public.d5o_trial_d4_packages(id,workspace_id,
      configuration_tenant_id,organization_id,work_id,package_code,created_by)
    values(new_id,p_workspace_id,job.configuration_tenant_id,job.organization_id,
      p_work_id,'PKG-'||upper(left(replace(new_id::text,'-',''),8)),auth.uid());
  else
    select * into package from public.d5o_trial_d4_packages
      where id=p_package_id and workspace_id=p_workspace_id and work_id=p_work_id
        and configuration_tenant_id=job.configuration_tenant_id
        and organization_id=job.organization_id for update;
    if package.id is null then raise exception 'd4_package_scope_invalid'; end if;
    select * into prior from public.d5o_trial_d4_package_versions
      where package_id=p_package_id order by revision desc limit 1 for share;
    if prior.revision is distinct from p_expected_revision then
      raise exception 'd4_package_conflict'; end if;
    new_id:=package.id;revision_number:=prior.revision+1;
  end if;
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,
    'd5o_trial_d4_package',new_id,p_command_id,'d4.package_draft_revised',
    prior.state,'draft',auth.uid(),p_command_id,prior.payload,p_payload,
    jsonb_build_object('revision',revision_number,'jobRevision',job_version.revision));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,
    'd5o_trial_d4_package',new_id,revision_number,'d4.package_draft_revised',
    1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('workId',p_work_id,'revision',revision_number,'draft',true));
  insert into public.d5o_trial_d4_package_versions(package_id,workspace_id,
    revision,work_id,job_revision,state,payload,payload_digest,recorded_by,
    permission_id,permission_digest,audit_event_id,domain_event_id)
  values(new_id,p_workspace_id,revision_number,p_work_id,job_version.revision,
    'draft',p_payload,rybex_internal.d5o_m1_digest(p_payload),auth.uid(),
    (authority->>'permissionId')::uuid,authority->>'permissionDigest',audit_id,event_id);
  result:=jsonb_build_object('success',true,'workId',p_work_id,
    'packageId',new_id,'revision',revision_number,'state','draft',
    'jobRevision',job_version.revision,'auditId',audit_id,'eventId',event_id,
    'releaseEligible',false);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.d4.package.draft.v1',
    'd5o_trial_d4_package',new_id,request_hash,auth.uid(),p_command_id,
    'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_d4_save_package_draft_v1(uuid,uuid,uuid,integer,integer,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_save_package_draft_v1(uuid,uuid,uuid,integer,integer,text,jsonb)
  to authenticated;
commit;
