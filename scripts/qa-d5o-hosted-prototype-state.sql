-- Synthetic no-network Postgres harness only. Never run against a live project.
\set ON_ERROR_STOP on
\i /tmp/d5o-hosted-authority-test.sql
\i /tmp/d5o-hosted-prototype-state.sql
\i /tmp/d5o-hosted-prototype-nested-scope.sql
update d5o_hosted.workspaces set status = 'active' where workspace_key = 'rybex';

do $$ begin
  if has_table_privilege('authenticated', 'd5o_hosted.prototype_states', 'insert')
    or has_table_privilege('authenticated', 'd5o_hosted.prototype_state_revisions', 'select')
    or has_function_privilege('anon',
      'public.d5o_hosted_prototype_save_v1(text,text,bigint,jsonb)', 'execute') then
    raise exception 'direct_prototype_access_granted';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
declare v_first jsonb; v_second jsonb;
begin
  if public.d5o_hosted_prototype_read_v1('rybex','work')->>'revision' <> '0' then
    raise exception 'uninitialized_revision_incorrect';
  end if;
  v_first := public.d5o_hosted_prototype_save_v1('rybex','work',0,
    '{"schemaVersion":1,"workspace":"rybex","revision":1,"records":[]}'::jsonb);
  v_second := public.d5o_hosted_prototype_save_v1('rybex','work',1,
    '{"schemaVersion":1,"workspace":"rybex","revision":2,"records":[{"id":"rybex-1","workspace":"rybex"}]}'::jsonb);
  if v_first->>'revision' <> '1' or v_second->>'revision' <> '2'
    or public.d5o_hosted_prototype_read_v1('rybex','work')->'state'->'records'->0->>'id' <> 'rybex-1' then
    raise exception 'prototype_round_trip_failed';
  end if;
  begin
    perform public.d5o_hosted_prototype_save_v1('rybex','work',1,
      '{"schemaVersion":1,"workspace":"rybex","records":[]}'::jsonb);
    raise exception 'stale_revision_accepted';
  exception when unique_violation then null; end;
  begin
    perform public.d5o_hosted_prototype_save_v1('rotork','work',0,
      '{"schemaVersion":1,"workspace":"rotork","records":[]}'::jsonb);
    raise exception 'cross_workspace_write_accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.d5o_hosted_prototype_read_v1('rotork','work');
    raise exception 'cross_workspace_read_accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.d5o_hosted_prototype_save_v1('rybex','work',2,
      '{"schemaVersion":1,"workspace":"rotork","records":[]}'::jsonb);
    raise exception 'payload_scope_mismatch_accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.d5o_hosted_prototype_save_v1('rybex','work',2,
      '{"schemaVersion":1,"workspace":"rybex","records":[{"id":"rotork-1","workspace":"rotork"}]}'::jsonb);
    raise exception 'nested_payload_scope_mismatch_accepted';
  exception when check_violation then null; end;
end $$;
reset role;

insert into d5o_hosted.memberships(workspace_id,actor_user_id,role) values
  ('10000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000003','read_only_auditor');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
do $$ begin
  if public.d5o_hosted_prototype_read_v1('rybex','work')->>'revision' <> '2' then
    raise exception 'auditor_cannot_read';
  end if;
  begin
    perform public.d5o_hosted_prototype_save_v1('rybex','work',2,
      '{"schemaVersion":1,"workspace":"rybex","records":[]}'::jsonb);
    raise exception 'auditor_write_accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  if (select count(*) from d5o_hosted.prototype_state_revisions
      where state_key='work') <> 2
    or (select count(*) from d5o_hosted.prototype_states where state_key='work') <> 1 then
    raise exception 'revision_history_or_atomicity_failed';
  end if;
end $$;
select 'PASS: hosted synthetic prototype persistence, scope, revision and history' as result;
