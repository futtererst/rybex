-- Rollback-only authenticated RM01 scenario in disposable Discover scratch E.
begin;
set local role authenticated;
do $$
declare workspace uuid:='a2000000-0000-4000-8000-000000000001';
  base jsonb; changed jsonb; created jsonb; second jsonb; edited jsonb; listed jsonb;
  resource uuid;
begin
  base:=jsonb_build_object('name','Synthetic controls lead','grade','Lead',
    'skills',jsonb_build_array('Controls','Cat6'),
    'certificates',jsonb_build_array('OSHA10'),
    'homeBase','North office','region','North',
    'workingDays',jsonb_build_array('Mon','Tue','Wed','Thu','Fri'),
    'workStart','08:00','workEnd','16:00',
    'ptoDates',jsonb_build_array('2026-10-06'),
    'employmentType','W2','active',true,'linkedUserId',null);
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000003',true);
  created:=public.d5o_rm_save_profile_v1(workspace,null,0,'rm-create-synthetic-01',base);
  resource:=(created->>'resourceId')::uuid;
  if created->>'revision'<>'1' or created->>'auditId' is null
    or created->>'eventId' is null then raise exception 'create failed: %',created; end if;
  second:=public.d5o_rm_save_profile_v1(workspace,null,0,'rm-create-synthetic-01',base);
  if second->'replayed'<>'true'::jsonb or second->>'resourceId'<>resource::text then
    raise exception 'replay failed: %',second; end if;
  begin
    perform public.d5o_rm_save_profile_v1(workspace,null,0,'rm-create-synthetic-01',
      jsonb_set(base,'{name}','"Different technician"'::jsonb));
    raise exception 'changed_command_replay_allowed';
  exception when others then
    if sqlerrm<>'idempotency_mismatch' then raise; end if;
  end;
  listed:=public.d5o_rm_list_profiles_v1(workspace);
  if listed->'canCreate'<>'true'::jsonb or jsonb_array_length(listed->'items')<>1
    or listed::text like '%hourly_cents%' then raise exception 'admin list failed: %',listed; end if;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000007',true);
  listed:=public.d5o_rm_list_profiles_v1(workspace);
  if listed->'canCreate'<>'false'::jsonb or listed->'canEdit'<>'true'::jsonb then
    raise exception 'operations rights failed: %',listed; end if;
  changed:=jsonb_set(base,'{skills}',jsonb_build_array('Controls','Cat6','Fiber'));
  edited:=public.d5o_rm_save_profile_v1(workspace,resource,1,'rm-edit-synthetic-01',changed);
  if edited->>'revision'<>'2' then raise exception 'operations edit failed: %',edited; end if;
  begin
    perform public.d5o_rm_save_profile_v1(workspace,resource,1,'rm-stale-edit-01',changed);
    raise exception 'stale_edit_allowed';
  exception when others then
    if sqlerrm<>'rm_profile_conflict' then raise; end if;
  end;
  begin
    perform public.d5o_rm_save_profile_v1(workspace,resource,2,'rm-status-edit-01',
      jsonb_set(changed,'{active}','false'::jsonb));
    raise exception 'operations_status_edit_allowed';
  exception when others then
    if sqlerrm<>'rm_permission_denied' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000008',true);
  listed:=public.d5o_rm_list_profiles_v1(workspace);
  if listed->'canEdit'<>'false'::jsonb or listed::text like '%hourly_cents%' then
    raise exception 'dispatcher read failed: %',listed; end if;
  begin
    perform public.d5o_rm_save_profile_v1(workspace,resource,2,'rm-dispatch-denied-01',changed);
    raise exception 'dispatcher_edit_allowed';
  exception when others then
    if sqlerrm<>'rm_permission_denied' then raise; end if;
  end;
  begin
    perform public.d5o_rm_list_profiles_v1('a2000000-0000-4000-8000-000000000002');
    raise exception 'cross_tenant_read_allowed';
  exception when others then
    if sqlerrm<>'forbidden' then raise; end if;
  end;
  if has_table_privilege('authenticated','public.d5o_trial_rm_cost_rates','SELECT')
    or has_table_privilege('authenticated','public.d5o_trial_rm_profile_versions','SELECT') then
    raise exception 'direct_table_exposure'; end if;
  raise notice 'PASS RM01 create/replay/read/edit/stale/role/tenant/rate-boundary, resource %',resource;
end $$;
rollback;
