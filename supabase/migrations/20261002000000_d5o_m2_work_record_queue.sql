-- M2 additive, local prototype queue. Reads remain workspace-scoped through
-- the established M1 actor resolver; direct table access stays revoked.
begin;

create index if not exists d5o_work_records_workspace_created_idx
  on public.d5o_work_records(workspace_id, created_at desc, id desc);

create function public.d5o_list_work_records_v1(p_workspace_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor jsonb; records jsonb;
begin
  actor := rybex_internal.d5o_m1_actor(p_workspace_id);
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'invalid_limit'; end if;

  select coalesce(jsonb_agg(to_jsonb(summary) order by summary.created_at desc, summary.id desc), '[]'::jsonb)
  into records
  from (
    select w.id, w.workspace_id, w.title, w.work_type_key, w.gate_key, w.lifecycle_state,
      w.record_version, w.configuration_version_id, w.created_at,
      proof.proof_package_revision, proof.status as proof_status,
      coalesce(decision.decision_count, 0) as decision_count
    from public.d5o_work_records w
    left join lateral (
      select p.proof_package_revision, p.status
      from public.d5o_proof_packages p
      where p.work_id = w.id and p.workspace_id = w.workspace_id
      order by p.proof_package_revision desc
      limit 1
    ) proof on true
    left join lateral (
      select count(*)::integer as decision_count
      from public.d5o_work_decisions d
      where d.work_id = w.id and d.workspace_id = w.workspace_id
    ) decision on true
    where w.workspace_id = p_workspace_id
    order by w.created_at desc, w.id desc
    limit p_limit
  ) summary;

  return jsonb_build_object('workspaceId', p_workspace_id, 'actor', actor, 'records', records);
end $$;

revoke all on function public.d5o_list_work_records_v1(uuid, integer) from public, anon, service_role;
grant execute on function public.d5o_list_work_records_v1(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
