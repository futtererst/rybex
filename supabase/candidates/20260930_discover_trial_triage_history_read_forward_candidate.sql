-- UNAPPLIED synthetic-only author triage history read forward candidate.
-- Depends on same-work read and triage transfer foundation. No broader collection grant.
begin;

create or replace function public.d5o_load_my_discover_draft_v1(
  p_workspace_id uuid, p_work_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor jsonb;
  authority jsonb;
  cfg jsonb;
  w public.d5o_work_records%rowtype;
  d public.d5o_discover_capture_drafts%rowtype;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for share;
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
      and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null
     or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
     or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
     or d.capture_permission_digest is distinct from authority->>'permissionDigest'
     or d.employee_verification_id::text is distinct from authority->>'employeeVerificationId' then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'workId',w.id,'recordVersion',w.record_version,'title',w.title,
    'lifecycleState',w.lifecycle_state,'ownerProfileId',w.owner_profile_id,
    'updatedAt',d.updated_at,
    'triageHistory',coalesce((select jsonb_agg(jsonb_build_object(
      'submissionId',s.id,'submissionRevision',s.submission_revision,
      'submittedAt',s.submitted_at,'snapshotDigest',s.snapshot_digest,
      'acceptBy',s.accept_by,'proposedOwnerProfileId',s.proposed_owner_profile_id,
      'disposition',r.disposition,'reason',r.reason,
      'respondedAt',r.responded_at,'responderProfileId',r.responder_profile_id)
      order by s.submission_revision desc)
      from public.d5o_trial_triage_submissions s
      left join public.d5o_trial_triage_responses r on r.submission_id=s.id
      where s.work_id=w.id and s.workspace_id=p_workspace_id
        and s.configuration_version_id=w.configuration_version_id),'[]'::jsonb),
    'retainedWorkId',(select c.retained_work_id from public.d5o_trial_same_work_closures c
      where c.duplicate_work_id=w.id and w.lifecycle_state='duplicate_closed'),
    'draft',jsonb_build_object(
      'customerContext',d.customer_context,'siteContext',d.site_context,
      'source',d.source_kind,'sourceReference',d.source_reference,
      'needSummary',d.need_summary,'workType',d.work_type,
      'contactContext',d.contact_context,'valueBand',d.value_band,
      'currency',d.currency,'responseDueOn',d.response_due_on,
      'procurement',d.procurement,
      'triageOwnerProfileId',d.triage_owner_profile_id,
      'nextAction',d.next_action,
      'duplicateDisposition',d.duplicate_disposition,
      'duplicateReason',d.duplicate_reason));
end $$;

revoke all on function public.d5o_load_my_discover_draft_v1(uuid,uuid)
  from public, anon, authenticated, service_role;
-- Synthetic trial exposure only; the function itself enforces current
-- authenticated capture authority and exact owner/workspace/tenant binding.
grant execute on function public.d5o_load_my_discover_draft_v1(uuid,uuid)
  to authenticated;
commit;

