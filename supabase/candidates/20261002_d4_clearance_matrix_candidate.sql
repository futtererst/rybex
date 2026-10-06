-- Disposable scratch E: version-aware package clearance inventory, read-only.
-- Custody candidates are counted but never treated as approvals or release.
begin;
create function public.d5o_d4_package_clearance_matrix_v1(
  p_workspace_id uuid,p_package_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare authority jsonb; package public.d5o_trial_d4_packages%rowtype;
  version public.d5o_trial_d4_package_versions%rowtype;
  job_version public.d5o_trial_rm_job_versions%rowtype;
  field_submission public.d5o_trial_d4_field_submissions%rowtype;
  field_response public.d5o_trial_d4_field_responses%rowtype;
  field_state text; minimum_crew integer; required_crew integer;
  current_shifts integer; custody_candidates integer;
  rows jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  authority:=rybex_internal.d5o_trial_rm_job_authority(p_workspace_id,'rm.view_jobs');
  select * into package from public.d5o_trial_d4_packages
    where id=p_package_id and workspace_id=p_workspace_id
      and configuration_tenant_id=(authority->>'tenantId')::uuid
      and organization_id=(authority->>'organizationId')::uuid for share;
  if package.id is null then raise exception 'd4_matrix_scope_invalid'; end if;
  select * into version from public.d5o_trial_d4_package_versions
    where package_id=package.id order by revision desc limit 1 for share;
  select * into job_version from public.d5o_trial_rm_job_versions
    where work_id=package.work_id order by revision desc limit 1 for share;
  if version.id is null or job_version.id is null then
    raise exception 'd4_matrix_scope_invalid'; end if;
  select * into field_submission from public.d5o_trial_d4_field_submissions
    where package_id=package.id and package_revision=version.revision;
  if field_submission.id is not null then
    select * into field_response from public.d5o_trial_d4_field_responses
      where submission_id=field_submission.id;
  end if;
  field_state:=case
    when field_submission.id is null then 'missing'
    when field_submission.job_revision<>job_version.revision
      or field_submission.payload_digest<>version.payload_digest then 'stale'
    when field_response.id is null then 'pending'
    when field_response.disposition='returned' then 'returned'
    else 'reviewed' end;
  required_crew:=(job_version.payload->>'requiredCrewSize')::integer;
  with edges as (
    select (version.payload->>'plannedStart')::timestamptz at_time
    union select (version.payload->>'plannedEnd')::timestamptz
    union select greatest(s.starts_at,(version.payload->>'plannedStart')::timestamptz)
      from public.d5o_trial_rm_plan_shifts s
      where s.workspace_id=p_workspace_id and s.work_id=package.work_id
        and s.cancelled_at is null
        and s.starts_at<(version.payload->>'plannedEnd')::timestamptz
        and s.ends_at>(version.payload->>'plannedStart')::timestamptz
    union select least(s.ends_at,(version.payload->>'plannedEnd')::timestamptz)
      from public.d5o_trial_rm_plan_shifts s
      where s.workspace_id=p_workspace_id and s.work_id=package.work_id
        and s.cancelled_at is null
        and s.starts_at<(version.payload->>'plannedEnd')::timestamptz
        and s.ends_at>(version.payload->>'plannedStart')::timestamptz
  ), segments as (
    select at_time,lead(at_time) over(order by at_time) next_time from edges
  )
  select coalesce(min((select count(distinct s.resource_id)
    from public.d5o_trial_rm_plan_shifts s
    where s.workspace_id=p_workspace_id and s.work_id=package.work_id
      and s.cancelled_at is null and s.starts_at<=g.at_time
      and s.ends_at>=g.next_time)),0)
    into minimum_crew from segments g where g.next_time>g.at_time
      and g.at_time>=(version.payload->>'plannedStart')::timestamptz
      and g.next_time<=(version.payload->>'plannedEnd')::timestamptz;
  select count(*) into current_shifts from public.d5o_trial_rm_plan_shifts s
    join lateral(select revision from public.d5o_trial_rm_profile_versions
      where resource_id=s.resource_id order by revision desc limit 1) pv on true
    where s.workspace_id=p_workspace_id and s.work_id=package.work_id
      and s.cancelled_at is null
      and s.starts_at<(version.payload->>'plannedEnd')::timestamptz
      and s.ends_at>(version.payload->>'plannedStart')::timestamptz
      and s.job_revision=job_version.revision
      and s.resource_revision=pv.revision;
  select count(*) into custody_candidates from public.evidence_links l
    join public.evidence_objects e on e.id=l.evidence_object_id
      and e.workspace_id=l.workspace_id
    where l.workspace_id=p_workspace_id and l.entity_type='d5o_trial_d4_package'
      and l.entity_id=package.id and e.upload_status='uploaded'
      and e.scan_status='clean' and e.verification_status='accepted'
      and e.size_bytes>0 and e.checksum_sha256 ~ '^[0-9a-fA-F]{64}$';
  rows:=jsonb_build_array(
    jsonb_build_object('key','g3_scope','label','Accepted G3 scope and authority',
      'status','uncommissioned','sourceId',null,'detail','No controlled G3 source is linked.'),
    jsonb_build_object('key','technical_design','label','Technical design and method',
      'status','uncommissioned','sourceId',null,
      'detail','A draft method reference is not an approved design revision.'),
    jsonb_build_object('key','field_buildability','label','Field buildability',
      'status',field_state,'sourceId',field_response.id,
      'detail','Review applies only to package revision '||version.revision::text||'.'),
    jsonb_build_object('key','hseq_access','label','HSEQ and site access',
      'status','uncommissioned','sourceId',null,
      'detail','No scoped HSEQ or access clearance and validity source.'),
    jsonb_build_object('key','supply_equipment','label','Supply and equipment',
      'status','uncommissioned','sourceId',null,
      'detail','No inspected materials, tools or calibration clearance.'),
    jsonb_build_object('key','crew_capacity','label','Qualified crew window',
      'status',case when minimum_crew<required_crew then 'blocked'
        when version.job_revision<>job_version.revision then 'stale'
        else 'planned_unreleased' end,'sourceId',null,
      'detail','Minimum '||minimum_crew::text||' of '||required_crew::text||
        ' required people across the package window.'),
    jsonb_build_object('key','certificate_policy','label','Mandatory credentials',
      'status','uncommissioned','sourceId',null,
      'detail','Tenant certificate policy and validity evidence are absent.'),
    jsonb_build_object('key','execution_pack','label','Execution and evidence pack',
      'status','uncommissioned','sourceId',null,
      'detail','Crew-facing controlled forms, tests and offline pack are absent.')
  );
  return jsonb_build_object('workId',package.work_id,'packageId',package.id,
    'packageRevision',version.revision,'jobRevision',job_version.revision,
    'fieldReviewSubmissionId',field_submission.id,
    'fieldReviewResponseId',field_response.id,
    'minimumCrewAcrossWindow',minimum_crew,'requiredCrew',required_crew,
    'currentShiftCount',current_shifts,'custodyCandidates',custody_candidates,
    'rows',rows,'releaseEligible',false);
end $$;
revoke all on function public.d5o_d4_package_clearance_matrix_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_d4_package_clearance_matrix_v1(uuid,uuid)
  to authenticated;
commit;
