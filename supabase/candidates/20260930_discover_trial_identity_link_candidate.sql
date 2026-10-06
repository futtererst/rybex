-- UNAPPLIED synthetic-only forward candidate. Apply only after the registry and
-- capture candidates in the owned Discover scratch database. No production grant.
begin;

alter table public.d5o_trial_accounts drop constraint d5o_trial_accounts_status_check;
alter table public.d5o_trial_sites drop constraint d5o_trial_sites_status_check;
alter table public.d5o_trial_accounts add column fixture_manifest_digest text;
alter table public.d5o_trial_sites add column fixture_manifest_digest text;
alter table public.d5o_trial_accounts add constraint d5o_trial_accounts_status_check
  check (status in ('provisional','trial_active','verified','archived'));
alter table public.d5o_trial_sites add constraint d5o_trial_sites_status_check
  check (status in ('provisional','trial_active','verified','archived'));
alter table public.d5o_trial_accounts add constraint d5o_trial_accounts_fixture_check
  check ((status = 'trial_active') = (fixture_manifest_digest is not null)
    and (fixture_manifest_digest is null or fixture_manifest_digest ~ '^[0-9a-f]{64}$'));
alter table public.d5o_trial_sites add constraint d5o_trial_sites_fixture_check
  check ((status = 'trial_active') = (fixture_manifest_digest is not null)
    and (fixture_manifest_digest is null or fixture_manifest_digest ~ '^[0-9a-f]{64}$'));

alter table public.d5o_trial_sites add constraint d5o_trial_site_account_pair_key unique (id, account_id);
alter table public.d5o_discover_capture_drafts add column account_id uuid;
alter table public.d5o_discover_capture_drafts add column site_id uuid;
alter table public.d5o_discover_capture_drafts add column linked_by uuid references auth.users(id) on delete restrict;
alter table public.d5o_discover_capture_drafts add column linked_at timestamptz;
alter table public.d5o_discover_capture_drafts add constraint d5o_discover_link_complete
  check ((account_id is null and site_id is null and linked_by is null and linked_at is null)
    or (account_id is not null and site_id is not null and linked_by is not null and linked_at is not null));
alter table public.d5o_discover_capture_drafts add constraint d5o_discover_link_site_parent
  foreign key (site_id, account_id) references public.d5o_trial_sites(id, account_id) on delete restrict;

create function public.d5o_discover_trial_identity_context_v1(p_workspace_id uuid, p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; authority jsonb; cfg jsonb;
  w public.d5o_work_records%rowtype; d public.d5o_discover_capture_drafts%rowtype;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity'
    or w.owner_profile_id is distinct from (actor->>'profile')::uuid
    or exists(select 1 from public.d5o_work_sources s where s.work_id=w.id) then
    raise exception 'forbidden';
  end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or d.capture_permission_digest is distinct from authority->>'permissionDigest'
    or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object('workId',w.id,'recordVersion',w.record_version,
    'accountId',d.account_id,'siteId',d.site_id,'linkedAt',d.linked_at,
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.display_name) order by a.display_name,a.id)
      from public.d5o_trial_accounts a where a.workspace_id=p_workspace_id
        and a.configuration_tenant_id=w.configuration_tenant_id
        and a.organization_id=(authority->>'organizationId')::uuid
        and a.status='trial_active' and a.fixture_manifest_digest is not null),'[]'::jsonb),
    'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'accountId',s.account_id,'name',s.display_name) order by s.display_name,s.id)
      from public.d5o_trial_sites s join public.d5o_trial_accounts a
        on a.id=s.account_id and a.workspace_id=s.workspace_id
        and a.configuration_tenant_id=s.configuration_tenant_id and a.organization_id=s.organization_id
      where s.workspace_id=p_workspace_id and s.configuration_tenant_id=w.configuration_tenant_id
        and s.organization_id=(authority->>'organizationId')::uuid
        and s.status='trial_active' and a.status='trial_active'
        and s.fixture_manifest_digest=a.fixture_manifest_digest),'[]'::jsonb));
end $$;

create function public.d5o_link_discover_account_site_v1(
  p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_command_id text,
  p_account_id uuid,p_site_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb; authority jsonb; cfg jsonb; cached public.command_idempotency%rowtype;
  w public.d5o_work_records%rowtype; d public.d5o_discover_capture_drafts%rowtype;
  a public.d5o_trial_accounts%rowtype; s public.d5o_trial_sites%rowtype;
  request_hash text; old_version integer; events jsonb; result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  if p_expected_version is null or p_expected_version<1
    or length(coalesce(p_command_id,'')) not between 8 and 200
    or p_account_id is null or p_site_id is null then raise exception 'invalid_command'; end if;
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity'
    or w.owner_profile_id is distinct from (actor->>'profile')::uuid
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for update;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or d.capture_permission_digest is distinct from authority->>'permissionDigest'
    or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'pinned_configuration_changed'; end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.link_identity.v1',auth.uid(),p_workspace_id,p_work_id,p_expected_version,p_account_id,p_site_id));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
      or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.link_identity.v1' then
      raise exception 'idempotency_mismatch'; end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_version then raise exception 'concurrency_conflict'; end if;
  if cfg->'workType'->'lifecycle_json'->>'initialState' is distinct from 'intake_draft'
    or w.lifecycle_state<>'intake_draft'
    or exists(select 1 from public.d5o_proof_packages p where p.work_id=w.id and p.status<>'draft')
    or exists(select 1 from public.d5o_work_decisions x where x.work_id=w.id) then
    raise exception 'draft_not_editable'; end if;
  select * into a from public.d5o_trial_accounts where id=p_account_id
    and workspace_id=p_workspace_id and configuration_tenant_id=w.configuration_tenant_id
    and organization_id=(authority->>'organizationId')::uuid and status='trial_active'
    and fixture_manifest_digest is not null for share;
  select * into s from public.d5o_trial_sites where id=p_site_id and account_id=p_account_id
    and workspace_id=p_workspace_id and configuration_tenant_id=w.configuration_tenant_id
    and organization_id=(authority->>'organizationId')::uuid and status='trial_active'
    and fixture_manifest_digest=a.fixture_manifest_digest for share;
  if a.id is null or s.id is null then raise exception 'registry_link_invalid'; end if;
  if d.account_id is not null and (d.account_id<>a.id or d.site_id<>s.id) then
    raise exception 'link_change_requires_review'; end if;
  if d.account_id=a.id and d.site_id=s.id then raise exception 'already_linked'; end if;
  old_version:=w.record_version;
  update public.d5o_work_records set record_version=record_version+1
    where id=w.id and workspace_id=p_workspace_id returning * into w;
  update public.d5o_discover_capture_drafts set account_id=a.id,site_id=s.id,
    linked_by=auth.uid(),linked_at=now(),updated_by=auth.uid(),updated_at=now()
    where work_id=w.id and workspace_id=p_workspace_id;
  if not found then raise exception 'concurrency_conflict'; end if;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.identity_linked',auth.uid(),
    jsonb_build_object('record_version',old_version,'accountId',d.account_id,'siteId',d.site_id),
    jsonb_build_object('record_version',w.record_version,'accountId',a.id,'siteId',s.id),
    jsonb_build_object('configurationDigest',w.configuration_digest,
      'capturePermissionDigest',authority->>'permissionDigest',
      'fixtureManifestDigest',a.fixture_manifest_digest,'explicitConfirmation',true));
  result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,
    'accountId',a.id,'siteId',s.id,'events',events);
  insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,
    entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.link_identity.v1','d5o_work_record',w.id,
    request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;

revoke all on function public.d5o_discover_trial_identity_context_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.d5o_link_discover_account_site_v1(uuid,uuid,integer,text,uuid,uuid)
  from public,anon,authenticated,service_role;
commit;
