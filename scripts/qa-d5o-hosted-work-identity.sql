-- Disposable Postgres-only test. The included authority test creates synthetic
-- auth roles, users and two isolated workspaces; never run against Supabase.
\set ON_ERROR_STOP on
\i /tmp/d5o-hosted-authority-test.sql
\i /tmp/d5o-hosted-work-identity.sql
\i /tmp/d5o-hosted-create-authority.sql
\i /tmp/d5o-hosted-config-manifest.sql

update d5o_hosted.workspaces set status = 'active' where workspace_key = 'rybex';
insert into d5o_hosted.configuration_tenants(id, workspace_id, status) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'active');
insert into d5o_hosted.configuration_versions(id, tenant_id, version_number, status,
  source_sha256, effective_from, manifest_json) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    1, 'draft', repeat('a',64), now() - interval '1 day',
    '{"schemaVersion":1,"workTypes":[{"key":"technical_delivery"}]}'::jsonb),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
    2, 'draft', repeat('b',64), now() - interval '1 day', '{}'::jsonb);
insert into d5o_hosted.configuration_work_types(configuration_version_id, work_type_key,
  display_name, status) values
  ('30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Technical delivery', 'active');
insert into d5o_hosted.configuration_create_rights(configuration_version_id,
  work_type_key, workspace_role) values
  ('30000000-0000-4000-8000-000000000001', 'technical_delivery', 'admin');
update d5o_hosted.configuration_versions set status = 'published'
  where id = '30000000-0000-4000-8000-000000000001';
insert into d5o_hosted.memberships(workspace_id, actor_user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'field_supervisor');

do $$ begin
  begin
    update d5o_hosted.configuration_versions set manifest_json = '{"workTypes":[]}'::jsonb
      where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'published_manifest_mutated';
  exception when check_violation then null; end;
  begin
    delete from d5o_hosted.configuration_create_rights
      where configuration_version_id = '30000000-0000-4000-8000-000000000001';
    raise exception 'published_right_deleted';
  exception when check_violation then null; end;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
do $$ begin
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-denied',
      '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'No configured right');
    raise exception 'unconfigured_create_right_accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  if has_table_privilege('authenticated', 'd5o_hosted.work_records', 'insert')
    or has_table_privilege('authenticated', 'd5o_hosted.work_command_receipts', 'insert')
    or has_function_privilege('authenticated',
      'public.d5o_hosted_create_work_core_v1(text,text,uuid,text,text)', 'execute')
    or has_function_privilege('anon',
      'public.d5o_hosted_create_work_v1(text,text,uuid,text,text)', 'execute')
  then raise exception 'direct_write_or_anon_execute_granted'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
declare first_result jsonb; second_result jsonb; listed jsonb;
begin
  first_result := public.d5o_hosted_create_work_v1('rybex', 'create-rybex-001',
    '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Synthetic data hall');
  second_result := public.d5o_hosted_create_work_v1('rybex', 'create-rybex-001',
    '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Synthetic data hall');
  listed := public.d5o_hosted_list_work_v1('rybex');
  if first_result <> second_result or jsonb_array_length(listed->'records') <> 1
    or first_result->>'configurationDigest' <> repeat('a',64)
    or public.d5o_hosted_load_work_v1('rybex', (first_result->>'workId')::uuid)
      ->'history'->0->>'membership_id' is null
    or (select count(*) from d5o_hosted.work_events) <> 1
  then raise exception 'create_or_idempotency_failed'; end if;
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-001',
      '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Changed title');
    raise exception 'command_reuse_accepted';
  exception when unique_violation then null; end;
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-002',
      '30000000-0000-4000-8000-000000000002', 'technical_delivery', 'Draft version');
    raise exception 'draft_version_accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-003',
      '30000000-0000-4000-8000-000000000001', 'unknown_type', 'Unknown type');
    raise exception 'incompatible_type_accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.d5o_hosted_create_work_v1('rotork', 'create-rotork-001',
      '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Wrong workspace');
    raise exception 'cross_workspace_create_accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.d5o_hosted_list_work_v1('rotork');
    raise exception 'cross_workspace_list_accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.d5o_hosted_load_work_v1('rotork', (first_result->>'workId')::uuid);
    raise exception 'cross_workspace_load_accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Zero and multiple eligible tenants must fail without a partial record.
update d5o_hosted.configuration_tenants set status = 'disabled';
set role authenticated;
do $$ begin
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-004',
      '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Zero mapping');
    raise exception 'zero_mapping_accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
update d5o_hosted.configuration_tenants set status = 'active';
insert into d5o_hosted.configuration_tenants(workspace_id, status)
  values('10000000-0000-4000-8000-000000000001', 'active');
set role authenticated;
do $$ begin
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-005',
      '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Two mappings');
    raise exception 'ambiguous_mapping_accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from d5o_hosted.work_records) <> 1
    or (select count(*) from d5o_hosted.work_events) <> 1 then
    raise exception 'failed_create_left_partial_effects';
  end if;
end $$;
reset role;
delete from d5o_hosted.configuration_tenants where id <> '20000000-0000-4000-8000-000000000001';
update d5o_hosted.configuration_versions set status = 'superseded'
  where id = '30000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  if public.d5o_hosted_create_work_v1('rybex', 'create-rybex-001',
    '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'Synthetic data hall')
    ->>'workId' is null then raise exception 'superseded_retry_lost'; end if;
  begin
    perform public.d5o_hosted_create_work_v1('rybex', 'create-rybex-006',
      '30000000-0000-4000-8000-000000000001', 'technical_delivery', 'New superseded work');
    raise exception 'new_work_on_superseded_version_accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select 'PASS: hosted Work identity, pinning, idempotency and fail-closed scope' as result;
