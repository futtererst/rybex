-- UNAPPLIED synthetic-only create-command candidate. Depends on the authority
-- and storage candidates. No route or EXECUTE grant is supplied here.
-- Duplicate matches block creation until scoped read/review is implemented.

begin;

create function rybex_internal.d5o_discover_possible_duplicate(
  p_workspace_id uuid, p_tenant_id uuid, p_organization_id uuid,
  p_exclude_work_id uuid, p_title text, p_customer text,
  p_site text, p_need text
) returns boolean
language sql volatile security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.d5o_work_records existing
      left join public.d5o_discover_capture_drafts d on d.work_id=existing.id
      where existing.workspace_id=p_workspace_id
        and existing.configuration_tenant_id=p_tenant_id
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
revoke all on function rybex_internal.d5o_discover_possible_duplicate(
  uuid,uuid,uuid,uuid,text,text,text,text)
  from public, anon, authenticated, service_role;

create function rybex_internal.d5o_discover_validate_capture(p_payload jsonb)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare due_value date;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_command';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in (
       'title','customerContext','siteContext','source','sourceReference',
       'needSummary','workType','contactContext','valueBand','currency',
       'responseDueOn','procurement','triageOwnerProfileId','nextAction',
       'duplicateDisposition','duplicateReason'))
     or exists(select 1 from jsonb_each(p_payload) x
       where jsonb_typeof(x.value) not in ('string','null'))
     or nullif(btrim(p_payload->>'title'),'') is null
     or length(btrim(p_payload->>'title'))>240
     or length(coalesce(p_payload->>'customerContext',''))>240
     or length(coalesce(p_payload->>'siteContext',''))>240
     or length(coalesce(p_payload->>'sourceReference',''))>500
     or length(coalesce(p_payload->>'needSummary',''))>4000
     or length(coalesce(p_payload->>'contactContext',''))>500
     or length(coalesce(p_payload->>'nextAction',''))>500
     or length(coalesce(p_payload->>'duplicateReason',''))>1000
     or coalesce(p_payload->>'valueBand','unknown') not in
       ('unknown','below_100k','100k_250k','250k_500k','above_500k')
     or (nullif(p_payload->>'source','') is not null and p_payload->>'source' not in
       ('customer_request','referral','tender_invitation','crm_reference','lifecycle_lead'))
     or (nullif(p_payload->>'workType','') is not null and p_payload->>'workType' not in
       ('project','service','assessment','lifecycle_follow_up'))
     or (nullif(p_payload->>'currency','') is not null and p_payload->>'currency' not in
       ('USD','GBP','EUR'))
     or (coalesce(p_payload->>'valueBand','unknown')<>'unknown'
       and nullif(p_payload->>'currency','') is null)
     or (nullif(p_payload->>'procurement','') is not null and p_payload->>'procurement' not in
       ('direct','competitive_tender','existing_agreement','paid_discovery'))
     or coalesce(p_payload->>'duplicateDisposition','unreviewed') not in
       ('unreviewed','distinct','same_work')
     or (p_payload->>'duplicateDisposition'='distinct'
       and nullif(btrim(p_payload->>'duplicateReason'),'') is null)
     or (nullif(p_payload->>'triageOwnerProfileId','') is not null
       and p_payload->>'triageOwnerProfileId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
     or (nullif(p_payload->>'responseDueOn','') is not null
       and p_payload->>'responseDueOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    raise exception 'invalid_command';
  end if;
  begin
    due_value:=nullif(p_payload->>'responseDueOn','')::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid_command';
  end;
  if p_payload->>'duplicateDisposition'='same_work' then
    raise exception 'use_existing_work';
  end if;
end $$;
revoke all on function rybex_internal.d5o_discover_validate_capture(jsonb)
  from public, anon, authenticated, service_role;

create function public.d5o_capture_discover_draft_v1(
  p_workspace_id uuid, p_configuration_version_id uuid,
  p_gate_key text, p_command_id text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  cfg jsonb;
  authority jsonb;
  cached public.command_idempotency%rowtype;
  w public.d5o_work_records%rowtype;
  draft public.d5o_discover_capture_drafts%rowtype;
  request_hash text;
  title_value text;
  customer_value text;
  due_value date;
  triage_owner uuid;
  events jsonb;
  result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  perform rybex_internal.d5o_m1_actor(p_workspace_id);
  if length(coalesce(p_command_id,'')) not between 8 and 200
     or coalesce(p_gate_key,'')='' or p_configuration_version_id is null then
    raise exception 'invalid_command';
  end if;
  perform rybex_internal.d5o_discover_validate_capture(p_payload);
  title_value:=nullif(btrim(p_payload->>'title'),'');
  customer_value:=nullif(btrim(p_payload->>'customerContext'),'');
  due_value:=nullif(p_payload->>'responseDueOn','')::date;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.capture.v1',auth.uid(),p_workspace_id,p_configuration_version_id,
    p_gate_key,p_payload));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
       or cached.command_type<>'d5o.discover.capture.v1' then
      raise exception 'idempotency_mismatch';
    end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    select * into w from public.d5o_work_records
      where id=cached.entity_id and workspace_id=p_workspace_id for update;
    if w.id is null or w.work_type_key<>'discover-opportunity'
       or w.gate_key<>p_gate_key
       or w.configuration_version_id<>p_configuration_version_id then
      raise exception 'forbidden';
    end if;
    cfg:=rybex_internal.d5o_m1_configuration(
      p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
    authority:=rybex_internal.d5o_discover_capture_trial_authority(
      p_workspace_id,w.configuration_version_id);
    select * into draft from public.d5o_discover_capture_drafts
      where work_id=w.id and workspace_id=p_workspace_id;
    if draft.work_id is null
       or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
       or w.configuration_version_id<>p_configuration_version_id
       or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
       or draft.capture_permission_digest is distinct from authority->>'permissionDigest'
       or draft.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
      raise exception 'pinned_configuration_changed';
    end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,null,'discover-opportunity',p_gate_key);
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
  authority:=rybex_internal.d5o_discover_capture_trial_authority(
    p_workspace_id,p_configuration_version_id);
  if nullif(p_payload->>'triageOwnerProfileId','') is not null then
    triage_owner:=(p_payload->>'triageOwnerProfileId')::uuid;
    if not exists(select 1 from public.user_profiles p
       join public.workspace_memberships m on m.user_profile_id=p.id
         and m.user_id=p.user_id and m.workspace_id=p_workspace_id
       where p.id=triage_owner and p.status='active' and m.status='active'
         and p.organization_id=(authority->>'organizationId')::uuid
         and m.organization_id=p.organization_id) then
      raise exception 'invalid_triage_owner';
    end if;
  end if;
  -- M1's workspace lock serializes synthetic root writers. Lock the legacy
  -- table as well so a matching legacy insert cannot race this check.
  lock table public.opportunities in share mode;
  if rybex_internal.d5o_discover_possible_duplicate(
    p_workspace_id,(cfg->>'tenantId')::uuid,
    (authority->>'organizationId')::uuid,null,title_value,customer_value,
    p_payload->>'siteContext',p_payload->>'needSummary') then
    -- Do not reveal restricted names, counts or IDs to a capture-only actor.
    raise exception 'possible_duplicate';
  end if;
  insert into public.d5o_work_records(
    workspace_id,configuration_tenant_id,configuration_version_id,
    work_type_key,gate_key,configuration_digest,configuration_snapshot,
    title,owner_profile_id,lifecycle_state,created_by)
  values(p_workspace_id,(cfg->>'tenantId')::uuid,p_configuration_version_id,
    'discover-opportunity',p_gate_key,rybex_internal.d5o_m1_digest(cfg),cfg,
    title_value,(authority->>'actorProfileId')::uuid,
    cfg->'workType'->'lifecycle_json'->>'initialState',auth.uid()) returning * into w;
  insert into public.d5o_discover_capture_drafts(
    work_id,workspace_id,configuration_version_id,customer_context,site_context,
    source_kind,source_reference,need_summary,work_type,contact_context,
    value_band,currency,response_due_on,procurement,triage_owner_profile_id,
    next_action,duplicate_disposition,duplicate_reason,
    capture_permission_id,capture_permission_digest,
    employee_verification_id,updated_by)
  values(w.id,p_workspace_id,p_configuration_version_id,customer_value,
    nullif(btrim(p_payload->>'siteContext'),''),nullif(p_payload->>'source',''),
    nullif(btrim(p_payload->>'sourceReference'),''),
    nullif(btrim(p_payload->>'needSummary'),''),nullif(p_payload->>'workType',''),
    nullif(btrim(p_payload->>'contactContext'),''),
    coalesce(nullif(p_payload->>'valueBand',''),'unknown'),
    nullif(p_payload->>'currency',''),due_value,
    nullif(p_payload->>'procurement',''),triage_owner,
    nullif(btrim(p_payload->>'nextAction'),''),
    coalesce(p_payload->>'duplicateDisposition','unreviewed'),
    nullif(btrim(p_payload->>'duplicateReason'),''),
    (authority->>'permissionId')::uuid,authority->>'permissionDigest',
    (authority->>'employeeVerificationId')::uuid,auth.uid());
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.draft_captured',
    auth.uid(),'{}'::jsonb,
    jsonb_build_object('lifecycle_state',w.lifecycle_state,
      'record_version',w.record_version),
    jsonb_build_object('configurationDigest',w.configuration_digest,
      'capturePermissionDigest',authority->>'permissionDigest',
      'employeeVerificationId',authority->>'employeeVerificationId',
      'duplicateDisposition',coalesce(p_payload->>'duplicateDisposition','unreviewed')));
  result:=jsonb_build_object('success',true,'workId',w.id,
    'recordVersion',w.record_version,'events',events);
  insert into public.command_idempotency(
    workspace_id,command_id,command_type,entity_type,entity_id,
    request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.capture.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;

revoke all on function public.d5o_capture_discover_draft_v1(uuid,uuid,text,text,jsonb)
  from public, anon, authenticated, service_role;
commit;
