-- UNAPPLIED synthetic-only reviewer UX forward candidate. The writer already
-- enforces separation of duties; this exposes the same fact for a disabled UI.
begin;
create or replace function public.d5o_discover_duplicate_review_context_v1(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  authority jsonb; cfg jsonb; w public.d5o_work_records%rowtype;
  d public.d5o_discover_capture_drafts%rowtype; candidate_ids uuid[]; legacy_hold boolean;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' or w.lifecycle_state<>'intake_draft'
    or exists(select 1 from public.d5o_work_sources x where x.work_id=w.id) then
    raise exception 'forbidden'; end if;
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  authority:=rybex_internal.d5o_trial_duplicate_authority(p_workspace_id,w.configuration_version_id);
  select * into d from public.d5o_discover_capture_drafts where work_id=w.id
    and workspace_id=p_workspace_id and configuration_version_id=w.configuration_version_id for share;
  if d.work_id is null or w.configuration_tenant_id::text is distinct from cfg->>'tenantId'
    or w.configuration_digest<>rybex_internal.d5o_m1_digest(cfg)
    or d.account_id is null or d.site_id is null then raise exception 'forbidden'; end if;
  candidate_ids:=rybex_internal.d5o_trial_duplicate_candidate_ids(
    p_workspace_id,w.configuration_tenant_id,w.id,d.account_id,d.customer_context,w.title);
  lock table public.opportunities in share mode;
  select exists(select 1 from public.opportunities o where o.workspace_id=p_workspace_id
    and o.organization_id=(authority->>'organizationId')::uuid
    and (lower(btrim(o.gc_client))=lower(btrim(d.customer_context))
      or lower(btrim(o.name))=lower(btrim(w.title)))) into legacy_hold;
  return jsonb_build_object('workId',w.id,'title',w.title,'recordVersion',w.record_version,
    'customerContext',d.customer_context,'siteContext',d.site_context,
    'accountId',d.account_id,'siteId',d.site_id,
    'selfReview',w.owner_profile_id=(authority->>'actorProfileId')::uuid or w.created_by=auth.uid(),
    'candidateIds',to_jsonb(candidate_ids),'legacyHold',legacy_hold,
    'tooManyCandidates',coalesce(array_length(candidate_ids,1),0)>20,
    'reviewedVersion',(select rv.reviewed_work_version from public.d5o_trial_duplicate_reviews rv where rv.work_id=w.id),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object('workId',c.id,'title',c.title,
      'customerContext',cd.customer_context,'siteContext',cd.site_context)
      order by c.id) from public.d5o_work_records c
      join public.d5o_discover_capture_drafts cd on cd.work_id=c.id
      where c.id=any(candidate_ids)),'[]'::jsonb));
end $$;
commit;
