-- Unapplied RM02 candidate. Disposable Discover scratch E only; not production policy.
-- One field-job projection per canonical Work. No dispatch, release or spending command.
begin;

-- Trial registry extension: the field address belongs to the linked site.
alter table public.d5o_trial_sites add column address_text text
  check(address_text is null or length(btrim(address_text)) between 10 and 500);

create table public.d5o_trial_rm_job_catalog (
  workspace_id uuid not null references public.workspaces(id),
  configuration_tenant_id uuid not null references public.config_tenants(id),
  kind text not null check(kind in ('job_type','priority')),
  catalog_key text not null check(catalog_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check(length(btrim(label)) between 2 and 80),
  status text not null check(status in ('active','retired')),
  primary key(workspace_id,configuration_tenant_id,kind,catalog_key)
);
alter table public.d5o_trial_rm_job_catalog enable row level security;
revoke all on public.d5o_trial_rm_job_catalog from public,anon,authenticated,service_role;

create table public.d5o_trial_rm_jobs (
  work_id uuid primary key,
  workspace_id uuid not null,
  configuration_tenant_id uuid not null,
  organization_id uuid not null,
  account_id uuid not null,
  site_id uuid not null,
  job_code text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(work_id,workspace_id),unique(workspace_id,job_code),
  foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id),
  foreign key(account_id,workspace_id,configuration_tenant_id,organization_id)
    references public.d5o_trial_accounts(id,workspace_id,configuration_tenant_id,organization_id),
  foreign key(site_id,account_id,workspace_id,configuration_tenant_id,organization_id)
    references public.d5o_trial_sites(id,account_id,workspace_id,configuration_tenant_id,organization_id)
);
alter table public.d5o_trial_rm_jobs enable row level security;
revoke all on public.d5o_trial_rm_jobs from public,anon,authenticated,service_role;

create table public.d5o_trial_rm_job_versions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null,
  workspace_id uuid not null,
  revision integer not null check(revision>0),
  state text not null check(state in ('draft','ready_for_dispatch')),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  payload_digest text not null check(payload_digest ~ '^[0-9a-f]{64}$'),
  readiness jsonb not null check(jsonb_typeof(readiness)='object'),
  recorded_by uuid not null references auth.users(id),
  permission_id uuid not null references public.config_permission_definitions(id),
  permission_digest text not null check(permission_digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid references public.audit_events(id),
  domain_event_id uuid references public.domain_events(id),
  recorded_at timestamptz not null default now(),
  unique(work_id,revision),
  foreign key(work_id,workspace_id) references public.d5o_trial_rm_jobs(work_id,workspace_id)
);
alter table public.d5o_trial_rm_job_versions enable row level security;
revoke all on public.d5o_trial_rm_job_versions from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_rm_job_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' or old.audit_event_id is not null or old.domain_event_id is not null
    or new.audit_event_id is null or new.domain_event_id is null
    or (to_jsonb(new)-'audit_event_id'-'domain_event_id')
       is distinct from (to_jsonb(old)-'audit_event_id'-'domain_event_id') then
    raise exception 'immutable_rm_job'; end if;
  return new;
end $$;
create trigger d5o_trial_rm_job_version_immutable before update or delete
  on public.d5o_trial_rm_job_versions for each row
  execute function rybex_internal.d5o_trial_rm_job_immutable();
create function rybex_internal.d5o_trial_rm_job_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.d5o_trial_rm_job_versions v where v.id=new.id
    and (v.audit_event_id is null or v.domain_event_id is null)) then
    raise exception 'rm_job_receipt_missing'; end if;
  return null;
end $$;
create constraint trigger d5o_trial_rm_job_version_receipt after insert or update
  on public.d5o_trial_rm_job_versions deferrable initially deferred for each row
  execute function rybex_internal.d5o_trial_rm_job_receipt();

create function rybex_internal.d5o_trial_rm_job_authority(
  p_workspace_id uuid,p_permission_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare base jsonb; tenant public.config_tenants%rowtype;
  permission public.config_permission_definitions%rowtype; rule jsonb;
begin
  if p_permission_key not in ('rm.view_jobs','rm.save_job') then
    raise exception 'rm_job_permission_denied'; end if;
  -- RM01's authority verifies identity, employee record, active matching membership,
  -- organization/tenant scope and an explicit base grant before this separate right.
  base:=rybex_internal.d5o_trial_rm_authority(p_workspace_id,'rm.view_profiles');
  select * into tenant from public.config_tenants
    where id=(base->>'tenantId')::uuid and workspace_id=p_workspace_id for share;
  select * into permission from public.config_permission_definitions
    where configuration_version_id=tenant.active_configuration_version_id
      and permission_key=p_permission_key and permission_scope='organization'
      and status='active' for share;
  if permission.id is null then raise exception 'rm_job_permission_denied'; end if;
  rule:=permission.default_grant_rule_json;
  if rule-'workspaceRoles'-'organizationScope'-'verifiedEmployeeRequired'<>'{}'::jsonb
    or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array'
    or rule->>'organizationScope' is distinct from 'same'
    or rule->'verifiedEmployeeRequired' is distinct from 'true'::jsonb
    or not(rule->'workspaceRoles' ? (base->>'workspaceRole'))
    or not exists(select 1 from public.d5o_trial_rm_grants g
      where g.workspace_id=p_workspace_id
        and g.configuration_version_id=tenant.active_configuration_version_id
        and g.permission_id=permission.id and g.user_id=auth.uid()
        and g.profile_id=(base->>'profileId')::uuid and g.status='active') then
    raise exception 'rm_job_permission_denied'; end if;
  return base||jsonb_build_object('permissionId',permission.id,
    'permissionDigest',rybex_internal.d5o_m1_digest(to_jsonb(permission)));
end $$;
revoke all on function rybex_internal.d5o_trial_rm_job_authority(uuid,text)
  from public,anon,authenticated,service_role;

create function rybex_internal.d5o_trial_rm_job_readiness(
  p_workspace_id uuid,p_tenant_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare blockers jsonb:='[]'::jsonb; warnings jsonb:='[]'::jsonb;
  start_at timestamptz; end_at timestamptz; item text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload-'jobType'-'scope'-'priority'-'siteAddress'-'requiredSkills'
      -'requiredGrades'-'estimatedPersonHours'-'requiredCrewSize'
      -'scheduledStart'-'scheduledEnd'-'customerContact'-'notes'
      -'documentRefs'<>'{}'::jsonb
    or jsonb_typeof(p_payload->'requiredSkills') is distinct from 'array'
    or jsonb_typeof(p_payload->'requiredGrades') is distinct from 'array'
    or jsonb_typeof(p_payload->'documentRefs') is distinct from 'array'
    or jsonb_typeof(p_payload->'estimatedPersonHours') is distinct from 'number'
    or jsonb_typeof(p_payload->'requiredCrewSize') is distinct from 'number'
    or length(coalesce(p_payload->>'scope',''))>4000
    or length(coalesce(p_payload->>'siteAddress',''))>500
    or length(coalesce(p_payload->>'customerContact',''))>500
    or length(coalesce(p_payload->>'notes',''))>4000
    or jsonb_array_length(p_payload->'requiredSkills')>20
    or jsonb_array_length(p_payload->'requiredGrades')>20
    or jsonb_array_length(p_payload->'documentRefs')>20 then
    raise exception 'invalid_rm_job'; end if;
  if coalesce(p_payload->>'jobType','')<>'' and not exists(
    select 1 from public.d5o_trial_rm_job_catalog c
    where c.workspace_id=p_workspace_id and c.configuration_tenant_id=p_tenant_id
      and c.kind='job_type' and c.catalog_key=p_payload->>'jobType' and c.status='active') then
    raise exception 'invalid_rm_job_type'; end if;
  if coalesce(p_payload->>'priority','')<>'' and not exists(
    select 1 from public.d5o_trial_rm_job_catalog c
    where c.workspace_id=p_workspace_id and c.configuration_tenant_id=p_tenant_id
      and c.kind='priority' and c.catalog_key=p_payload->>'priority' and c.status='active') then
    raise exception 'invalid_rm_job_priority'; end if;
  if coalesce(p_payload->>'jobType','')='' then blockers:=blockers||'"job_type_required"'::jsonb; end if;
  if length(btrim(coalesce(p_payload->>'scope','')))<20 then blockers:=blockers||'"scope_required"'::jsonb; end if;
  if coalesce(p_payload->>'priority','')='' then blockers:=blockers||'"priority_required"'::jsonb; end if;
  if length(btrim(coalesce(p_payload->>'siteAddress','')))<10 then blockers:=blockers||'"site_address_required"'::jsonb; end if;
  if (p_payload->>'requiredCrewSize')::numeric<1 or (p_payload->>'requiredCrewSize')::numeric>30
    or (p_payload->>'requiredCrewSize')::numeric<>trunc((p_payload->>'requiredCrewSize')::numeric) then
    blockers:=blockers||'"crew_size_invalid"'::jsonb; end if;
  if (p_payload->>'estimatedPersonHours')::numeric<=0
    or (p_payload->>'estimatedPersonHours')::numeric>10000 then
    blockers:=blockers||'"person_hours_invalid"'::jsonb; end if;
  if jsonb_array_length(p_payload->'requiredSkills')=0
    and jsonb_array_length(p_payload->'requiredGrades')=0 then
    blockers:=blockers||'"qualification_required"'::jsonb; end if;
  for item in select value from jsonb_array_elements_text(p_payload->'requiredSkills') loop
    if length(btrim(item)) not between 2 and 80 then raise exception 'invalid_rm_job'; end if;
  end loop;
  for item in select value from jsonb_array_elements_text(p_payload->'requiredGrades') loop
    if length(btrim(item)) not between 2 and 80 then raise exception 'invalid_rm_job'; end if;
  end loop;
  if coalesce(p_payload->>'scheduledStart','')<>'' and
    coalesce(p_payload->>'scheduledEnd','')<>'' then
    begin
      start_at:=(p_payload->>'scheduledStart')::timestamptz;
      end_at:=(p_payload->>'scheduledEnd')::timestamptz;
      if end_at<=start_at then blockers:=blockers||'"schedule_invalid"'::jsonb; end if;
    exception when others then raise exception 'invalid_rm_schedule'; end;
  else blockers:=blockers||'"schedule_required"'::jsonb; end if;
  if length(btrim(coalesce(p_payload->>'customerContact','')))<3 then
    warnings:=warnings||'"customer_contact_missing"'::jsonb; end if;
  if jsonb_array_length(p_payload->'documentRefs')=0 then
    warnings:=warnings||'"documents_missing"'::jsonb; end if;
  return jsonb_build_object('blockers',blockers,'warnings',warnings,
    'estimatedPersonHours',(p_payload->>'estimatedPersonHours')::numeric,
    'requiredCrewSize',(p_payload->>'requiredCrewSize')::integer,
    'equalShareHours',round((p_payload->>'estimatedPersonHours')::numeric /
      greatest((p_payload->>'requiredCrewSize')::numeric,1),2),
    'jobSpanHours',case when start_at is not null and end_at>start_at
      then round(extract(epoch from end_at-start_at)::numeric/3600,2) else null end);
end $$;
revoke all on function rybex_internal.d5o_trial_rm_job_readiness(uuid,uuid,jsonb)
  from public,anon,authenticated,service_role;

create function public.d5o_rm_list_jobs_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; items jsonb; works jsonb; types jsonb; priorities jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select coalesce(jsonb_agg(jsonb_build_object('workId',w.id,'title',w.title,
    'accountName',a.display_name,'siteName',s.display_name,
    'siteAddress',s.address_text,
    'accountId',a.id,'siteId',s.id,'workVersion',w.record_version)
    order by w.title),'[]'::jsonb) into works
  from public.d5o_work_records w
  join public.d5o_discover_capture_drafts d on d.work_id=w.id and d.workspace_id=w.workspace_id
  join public.d5o_trial_accounts a on a.id=d.account_id
  join public.d5o_trial_sites s on s.id=d.site_id and s.account_id=a.id
  where w.workspace_id=p_workspace_id and w.configuration_tenant_id=(authority->>'tenantId')::uuid
    and w.lifecycle_state='triage_assigned' and a.status in ('trial_active','verified')
    and s.status in ('trial_active','verified')
    and exists(select 1 from public.d5o_trial_d2_handoff_submissions h
      join public.d5o_trial_d2_handoff_responses r on r.submission_id=h.id
      where h.work_id=w.id and r.disposition='accepted'
        and h.revision=(select max(h2.revision) from public.d5o_trial_d2_handoff_submissions h2
          where h2.work_id=w.id));
  select coalesce(jsonb_agg(jsonb_build_object('workId',j.work_id,
    'jobCode',j.job_code,'accountName',a.display_name,'siteName',s.display_name,
    'revision',v.revision,'state',v.state,'payload',v.payload,
    'readiness',v.readiness,'updatedAt',v.recorded_at) order by v.recorded_at desc),'[]'::jsonb)
    into items from public.d5o_trial_rm_jobs j
    join public.d5o_trial_accounts a on a.id=j.account_id
    join public.d5o_trial_sites s on s.id=j.site_id
    join lateral(select * from public.d5o_trial_rm_job_versions v
      where v.work_id=j.work_id order by v.revision desc limit 1) v on true
    where j.workspace_id=p_workspace_id and j.organization_id=(authority->>'organizationId')::uuid
      and j.configuration_tenant_id=(authority->>'tenantId')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object('key',catalog_key,'label',label)
    order by label),'[]'::jsonb) into types from public.d5o_trial_rm_job_catalog
    where workspace_id=p_workspace_id and configuration_tenant_id=(authority->>'tenantId')::uuid
      and kind='job_type' and status='active';
  select coalesce(jsonb_agg(jsonb_build_object('key',catalog_key,'label',label)
    order by label),'[]'::jsonb) into priorities from public.d5o_trial_rm_job_catalog
    where workspace_id=p_workspace_id and configuration_tenant_id=(authority->>'tenantId')::uuid
      and kind='priority' and status='active';
  return jsonb_build_object('works',works,'items',items,'jobTypes',types,
    'priorities',priorities,'canSave',exists(select 1 from public.d5o_trial_rm_grants g
      join public.config_permission_definitions p on p.id=g.permission_id
      where g.workspace_id=p_workspace_id and g.user_id=auth.uid()
        and g.status='active' and p.permission_key='rm.save_job'
        and p.configuration_version_id=(authority->>'configurationVersionId')::uuid));
end $$;
revoke all on function public.d5o_rm_list_jobs_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_list_jobs_v1(uuid) to authenticated;

create function public.d5o_rm_save_job_v1(p_workspace_id uuid,p_work_id uuid,
  p_expected_revision integer,p_command_id text,p_mode text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; work public.d5o_work_records%rowtype;
  draft public.d5o_discover_capture_drafts%rowtype;
  account public.d5o_trial_accounts%rowtype; site public.d5o_trial_sites%rowtype;
  job public.d5o_trial_rm_jobs%rowtype; prior public.d5o_trial_rm_job_versions%rowtype;
  cached public.command_idempotency%rowtype; request_hash text; readiness jsonb;
  revision_number integer; audit_id uuid; event_id uuid; result jsonb; new_state text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.save_job');
  if p_work_id is null or p_expected_revision is null or p_expected_revision<0
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_mode not in ('save','ready') then raise exception 'invalid_rm_job_command'; end if;
  select * into work from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and lifecycle_state='triage_assigned' for share;
  if work.id is null then raise exception 'rm_work_unavailable'; end if;
  select * into draft from public.d5o_discover_capture_drafts
    where work_id=work.id and workspace_id=p_workspace_id for share;
  select * into account from public.d5o_trial_accounts
    where id=draft.account_id and workspace_id=p_workspace_id
      and configuration_tenant_id=work.configuration_tenant_id
      and organization_id=(authority->>'organizationId')::uuid
      and status in ('trial_active','verified') for share;
  select * into site from public.d5o_trial_sites
    where id=draft.site_id and account_id=account.id
      and workspace_id=p_workspace_id and configuration_tenant_id=work.configuration_tenant_id
      and organization_id=(authority->>'organizationId')::uuid
      and status in ('trial_active','verified') for share;
  if account.id is null or site.id is null then raise exception 'rm_site_link_required'; end if;
  if site.address_text is null or length(btrim(site.address_text))<10
    or p_payload->>'siteAddress' is distinct from site.address_text then
    raise exception 'rm_site_address_mismatch'; end if;
  if not exists(select 1 from public.d5o_trial_d2_handoff_submissions h
    join public.d5o_trial_d2_handoff_responses r on r.submission_id=h.id
    where h.work_id=work.id and h.workspace_id=p_workspace_id
      and r.disposition='accepted'
      and h.revision=(select max(h2.revision) from public.d5o_trial_d2_handoff_submissions h2
        where h2.work_id=work.id)) then raise exception 'rm_handoff_required'; end if;
  readiness:=rybex_internal.d5o_trial_rm_job_readiness(
    p_workspace_id,work.configuration_tenant_id,p_payload);
  if p_mode='ready' and jsonb_array_length(readiness->'blockers')>0 then
    raise exception 'rm_job_not_ready'; end if;
  -- Linked documents must already be custody objects attached to this Work.
  if exists(select 1 from jsonb_array_elements_text(p_payload->'documentRefs') ref
    where ref.value !~ '^[0-9a-f-]{36}$'
      or not exists(select 1 from public.evidence_objects e
        join public.evidence_links l on l.evidence_object_id=e.id
          and l.workspace_id=e.workspace_id
        where e.id=ref.value::uuid and e.workspace_id=p_workspace_id
          and e.upload_status='uploaded' and e.scan_status in ('clean','not_configured')
          and l.entity_type='d5o_work_record' and l.entity_id=p_work_id)) then
    raise exception 'rm_job_document_invalid'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'rm.job.save.v1',auth.uid(),p_workspace_id,p_work_id,p_expected_revision,p_mode,p_payload));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.command_type<>'d5o.rm.job.save.v1' then raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into job from public.d5o_trial_rm_jobs
    where work_id=p_work_id and workspace_id=p_workspace_id for update;
  if job.work_id is null then
    if p_expected_revision<>0 then raise exception 'rm_job_conflict'; end if;
    insert into public.d5o_trial_rm_jobs(work_id,workspace_id,configuration_tenant_id,
      organization_id,account_id,site_id,job_code,created_by)
    values(work.id,p_workspace_id,work.configuration_tenant_id,
      (authority->>'organizationId')::uuid,account.id,site.id,
      'J-'||upper(left(replace(work.id::text,'-',''),8)),auth.uid());
    revision_number:=1;
  else
    if job.account_id<>account.id or job.site_id<>site.id then
      raise exception 'rm_job_identity_changed'; end if;
    select * into prior from public.d5o_trial_rm_job_versions v
      where v.work_id=p_work_id order by v.revision desc limit 1 for share;
    if prior.revision is distinct from p_expected_revision then
      raise exception 'rm_job_conflict'; end if;
    revision_number:=prior.revision+1;
  end if;
  new_state:=case when p_mode='ready' then 'ready_for_dispatch' else 'draft' end;
  audit_id:=rybex_internal.append_audit_event(p_workspace_id,null,'d5o_trial_rm_job',
    work.id,p_command_id,'rm.job_revised',prior.state,new_state,auth.uid(),
    p_command_id,prior.payload,p_payload,jsonb_build_object('revision',revision_number,
      'readiness',readiness));
  event_id:=rybex_internal.append_domain_event(p_workspace_id,null,'d5o_trial_rm_job',
    work.id,revision_number,'rm.job_revised',1,p_command_id,p_command_id,auth.uid(),
    jsonb_build_object('revision',revision_number,'state',new_state));
  insert into public.d5o_trial_rm_job_versions(work_id,workspace_id,revision,
    state,payload,payload_digest,readiness,recorded_by,permission_id,
    permission_digest,audit_event_id,domain_event_id)
  values(work.id,p_workspace_id,revision_number,new_state,p_payload,
    rybex_internal.d5o_m1_digest(p_payload),readiness,auth.uid(),
    (authority->>'permissionId')::uuid,authority->>'permissionDigest',audit_id,event_id);
  result:=jsonb_build_object('success',true,'workId',work.id,'revision',revision_number,
    'state',new_state,'readiness',readiness,'auditId',audit_id,'eventId',event_id);
  insert into public.command_idempotency(workspace_id,command_id,command_type,
    entity_type,entity_id,request_hash,actor_user_id,correlation_id,
    result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.rm.job.save.v1','d5o_trial_rm_job',work.id,
    request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;
revoke all on function public.d5o_rm_save_job_v1(uuid,uuid,integer,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_rm_save_job_v1(uuid,uuid,integer,text,text,jsonb)
  to authenticated;

commit;
