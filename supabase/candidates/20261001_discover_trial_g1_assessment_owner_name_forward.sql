-- Scratch trial read projection: show the submitted next owner by name.
begin;
create or replace function public.d5o_get_discover_g1_assessment_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; reader jsonb;
  instance public.d5o_trial_g1_instances%rowtype; latest public.d5o_trial_g1_assessments%rowtype;
  can_edit boolean:=false; owner_name text;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  reader:=rybex_internal.d5o_trial_opportunity_read_authority(p_workspace_id,w.configuration_version_id);
  if w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg) then raise exception 'pinned_configuration_changed'; end if;
  select * into instance from public.d5o_trial_g1_instances where work_id=w.id for share;
  if instance.id is null then return jsonb_build_object('status','not_started','canEdit',false); end if;
  select * into latest from public.d5o_trial_g1_assessments
    where instance_id=instance.id order by assessment_revision desc limit 1 for share;
  if w.created_by=auth.uid() and instance.started_by=auth.uid()
    and instance.source_work_version=w.record_version and w.lifecycle_state='triage_assigned'
    and (latest.id is null or latest.status='draft') then
    begin
      perform rybex_internal.d5o_trial_g1_start_authority(p_workspace_id,w.configuration_version_id);
      can_edit:=true;
    exception when others then can_edit:=false;
    end;
  end if;
  if latest.status='submitted' and latest.payload->>'nextOwnerProfileId' is not null then
    select p.display_name into owner_name from public.user_profiles p
      join public.workspace_memberships m on m.user_profile_id=p.id
      where p.id=(latest.payload->>'nextOwnerProfileId')::uuid
        and m.workspace_id=p_workspace_id and m.user_id=p.user_id
        and p.organization_id=m.organization_id;
  end if;
  return jsonb_build_object('status',case when latest.id is null then 'empty'
    when latest.status='draft' and not can_edit then 'draft_private'
    else latest.status end,'g1InstanceId',instance.id,
    'assessmentRevision',coalesce(latest.assessment_revision,0),'canEdit',can_edit,
    'payload',case when can_edit or latest.status='submitted' then latest.payload else null end,
    'packageDigest',case when latest.status='submitted' then latest.package_digest else null end,
    'strategyResult',case when latest.status='submitted' then latest.package_snapshot->'strategyResult' else null end,
    'nextOwnerName',case when latest.status='submitted' then owner_name else null end,
    'spendingAuthorized',false);
end $$;
commit;
