-- Scoped synthetic G1 reviewer inbox; only submitted undecided packages appear.
begin;
create function public.d5o_list_discover_g1_review_queue_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; version_id uuid; items jsonb;
begin
  perform rybex_internal.d5o_m1_lock(p_workspace_id);
  actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
  select t.active_configuration_version_id into version_id from public.config_tenants t
    where t.workspace_id=p_workspace_id and t.status<>'archived' for share;
  if version_id is null then raise exception 'g1_queue_unavailable'; end if;
  perform rybex_internal.d5o_trial_g1_decision_authority(p_workspace_id,version_id);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.submitted_at,q.work_id),'[]'::jsonb)
    into items from (
      select w.id as work_id,w.title,w.record_version,
        a.id as assessment_id,a.assessment_revision,a.package_digest,
        a.created_at as submitted_at,account.display_name as account_name,
        site.display_name as site_name
      from public.d5o_trial_g1_instances g
      join public.d5o_work_records w on w.id=g.work_id and w.workspace_id=p_workspace_id
      join public.d5o_trial_g1_assessments a on a.instance_id=g.id and a.status='submitted'
      join public.d5o_discover_capture_drafts draft on draft.work_id=w.id and draft.workspace_id=p_workspace_id
      left join public.d5o_trial_accounts account on account.id=draft.account_id
        and account.workspace_id=p_workspace_id
      left join public.d5o_trial_sites site on site.id=draft.site_id
        and site.workspace_id=p_workspace_id
      where g.workspace_id=p_workspace_id and g.configuration_version_id=version_id
        and w.configuration_version_id=version_id and w.lifecycle_state='triage_assigned'
        and w.record_version=g.source_work_version and w.created_by<>auth.uid()
        and w.configuration_tenant_id=(select t.id from public.config_tenants t
          where t.workspace_id=p_workspace_id and t.status<>'archived')
        and a.assessment_revision=(select max(x.assessment_revision)
          from public.d5o_trial_g1_assessments x where x.instance_id=g.id)
        and a.package_digest=rybex_internal.d5o_m1_digest(a.package_snapshot)
        and not exists(select 1 from public.d5o_trial_g1_decisions d
          where d.assessment_id=a.id or (d.instance_id=g.id and d.disposition='qualified'))
      order by a.created_at,w.id limit 50
    ) q;
  return jsonb_build_object('items',items,'count',jsonb_array_length(items));
end $$;
revoke all on function public.d5o_list_discover_g1_review_queue_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.d5o_list_discover_g1_review_queue_v1(uuid) to authenticated;
commit;
