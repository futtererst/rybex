-- UNAPPLIED synthetic-only author edit candidate. Depends on authority,
-- storage, and create candidates. Does not edit submitted intake evidence.
begin;

create function public.d5o_edit_my_discover_draft_v1(
  p_workspace_id uuid, p_work_id uuid, p_expected_version integer,
  p_command_id text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb;
  authority jsonb;
  cfg jsonb;
  cached public.command_idempotency%rowtype;
  w public.d5o_work_records%rowtype;
  d public.d5o_discover_capture_drafts%rowtype;
  request_hash text;
  title_value text;
  customer_value text;
  triage_owner uuid;
  old_version integer;
  events jsonb;
  result jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  if p_expected_version is null or p_expected_version<1
     or length(coalesce(p_command_id,'')) not between 8 and 200 then
    raise exception 'invalid_command';
  end if;
  perform rybex_internal.d5o_discover_validate_capture(p_payload);
  title_value:=nullif(btrim(p_payload->>'title'),'');
  customer_value:=nullif(btrim(p_payload->>'customerContext'),'');
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for update;
  if w.id is null or w.work_type_key<>'discover-opportunity'
     or w.owner_profile_id is distinct from (actor->>'profile')::uuid
     or exists(select 1 from public.d5o_work_sources s where s.work_id=w.id) then
    raise exception 'forbidden';
  end if;
  cfg:=rybex_internal.d5o_m1_configuration(
    p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_discover_capture_trial_authority(
    p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id
      and configuration_version_id=w.configuration_version_id for update;
  if d.work_id is null
     or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
     or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
     or d.capture_permission_digest is distinct from authority->>'permissionDigest'
     or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'pinned_configuration_changed';
  end if;
  request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array(
    'discover.edit.v1',auth.uid(),p_workspace_id,p_work_id,p_expected_version,p_payload));
  select * into cached from public.command_idempotency
    where workspace_id=p_workspace_id and command_id=p_command_id for update;
  if found then
    if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash
       or cached.entity_id<>w.id or cached.command_type<>'d5o.discover.edit.v1' then
      raise exception 'idempotency_mismatch';
    end if;
    if cached.result_status<>'completed' then raise exception 'command_in_progress'; end if;
    return cached.result_payload||jsonb_build_object('replayed',true);
  end if;
  if w.record_version<>p_expected_version then raise exception 'concurrency_conflict'; end if;
  if cfg->'workType'->'lifecycle_json'->>'initialState' is distinct from 'intake_draft'
     or w.lifecycle_state<>'intake_draft'
     or exists(select 1 from public.d5o_proof_packages p
       where p.work_id=w.id and p.status<>'draft')
     or exists(select 1 from public.d5o_work_decisions x where x.work_id=w.id) then
    raise exception 'draft_not_editable';
  end if;
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
  lock table public.opportunities in share mode;
  if rybex_internal.d5o_discover_possible_duplicate(
    p_workspace_id,w.configuration_tenant_id,
    (authority->>'organizationId')::uuid,w.id,title_value,customer_value,
    p_payload->>'siteContext',p_payload->>'needSummary') then
    raise exception 'possible_duplicate';
  end if;
  old_version:=w.record_version;
  update public.d5o_work_records
    set title=title_value,record_version=record_version+1
    where id=w.id and workspace_id=p_workspace_id returning * into w;
  update public.d5o_discover_capture_drafts set
    customer_context=customer_value,
    site_context=nullif(btrim(p_payload->>'siteContext'),''),
    source_kind=nullif(p_payload->>'source',''),
    source_reference=nullif(btrim(p_payload->>'sourceReference'),''),
    need_summary=nullif(btrim(p_payload->>'needSummary'),''),
    work_type=nullif(p_payload->>'workType',''),
    contact_context=nullif(btrim(p_payload->>'contactContext'),''),
    value_band=coalesce(nullif(p_payload->>'valueBand',''),'unknown'),
    currency=nullif(p_payload->>'currency',''),
    response_due_on=nullif(p_payload->>'responseDueOn','')::date,
    procurement=nullif(p_payload->>'procurement',''),
    triage_owner_profile_id=triage_owner,
    next_action=nullif(btrim(p_payload->>'nextAction'),''),
    duplicate_disposition=coalesce(p_payload->>'duplicateDisposition','unreviewed'),
    duplicate_reason=nullif(btrim(p_payload->>'duplicateReason'),''),
    capture_permission_id=(authority->>'permissionId')::uuid,
    capture_permission_digest=authority->>'permissionDigest',
    employee_verification_id=(authority->>'employeeVerificationId')::uuid,
    updated_by=auth.uid(),updated_at=now()
    where work_id=w.id and workspace_id=p_workspace_id;
  if not found then raise exception 'concurrency_conflict'; end if;
  events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'discover.draft_edited',
    auth.uid(),jsonb_build_object('lifecycle_state',w.lifecycle_state,
      'record_version',old_version),
    jsonb_build_object('lifecycle_state',w.lifecycle_state,
      'record_version',w.record_version),
    jsonb_build_object('configurationDigest',w.configuration_digest,
      'capturePermissionDigest',authority->>'permissionDigest',
      'draftMutation',true));
  result:=jsonb_build_object('success',true,'workId',w.id,
    'recordVersion',w.record_version,'events',events);
  insert into public.command_idempotency(
    workspace_id,command_id,command_type,entity_type,entity_id,
    request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.discover.edit.v1','d5o_work_record',
    w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
  return result;
end $$;

revoke all on function public.d5o_edit_my_discover_draft_v1(uuid,uuid,integer,text,jsonb)
  from public, anon, authenticated, service_role;
commit;
