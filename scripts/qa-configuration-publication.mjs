import {readFileSync} from "node:fs";
import {sql} from "./m1/implementation-context.mjs";

const migration = ["20261005210000_d5o_configuration_activation_split", "20261005220000_d5o_candidate_activation_guard"]
  .filter((name) => sql(`select count(*) from supabase_migrations.schema_migrations where version='${name.slice(0,14)}'`) !== "1")
  .map((name) => readFileSync(`supabase/migrations/${name}.sql`, "utf8")).join("\n");
const workspace = "5488a1a7-d6eb-460c-88a4-4629d742d705";
const active = sql(`select active_configuration_version_id from config_tenants where workspace_id='${workspace}' and status<>'archived'`);
if (!/^[0-9a-f-]{36}$/i.test(active)) throw new Error("active_configuration_unavailable");
const actor = "999430a5-2066-4495-8caa-4171fb28a988";
const result = sql(`begin;
${migration}
set local "request.jwt.claim.sub"='${actor}';
set local role authenticated;
do $$ begin
  perform public.d5o_configuration_create_draft_v1('${workspace}','${active}');
  raise exception 'nonadmin_was_allowed';
exception when others then
  if sqlerrm <> 'configuration_admin_required' then raise; end if;
end $$;
reset role;
update workspace_memberships set role='admin' where workspace_id='${workspace}' and user_id='${actor}';
set local role authenticated;
create temporary table d5o_test_result as
  select public.d5o_configuration_create_draft_v1('${workspace}','${active}') result;
do $$ declare d uuid; begin
  select (result->>'draftVersionId')::uuid into d from d5o_test_result;
  begin
    update config_configuration_versions set status='published',effective_from=now() where id=d;
    raise exception 'direct_publication_was_allowed';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin
    update config_gate_definitions set exit_rule_json='{"op":"unsupported"}'::jsonb
      where configuration_version_id=(select (result->>'draftVersionId')::uuid from d5o_test_result);
    perform public.d5o_configuration_publish_v1('${workspace}',
      (select (result->>'draftVersionId')::uuid from d5o_test_result),'${active}');
    raise exception 'invalid_graph_was_published';
  exception when others then
    if sqlerrm not in ('unknown_rule_operator','invalid_rule') then raise; end if;
  end;
end $$;
select jsonb_build_object('activeAfterRejectedPublish',(select active_configuration_version_id from config_tenants where workspace_id='${workspace}'),
 'draftStatusAfterRejectedPublish',(select status from config_configuration_versions where id=(select (result->>'draftVersionId')::uuid from d5o_test_result)));
select public.d5o_configuration_save_draft_v1('${workspace}',
  (select (result->>'draftVersionId')::uuid from d5o_test_result),
  (select config_manifest_json || jsonb_build_object('d5oPresentation',
     jsonb_build_object('schemaVersion',1,'phaseLabels',jsonb_build_object('define','Define delivery'),
       'changeReason','Synthetic publication verification'))
   from config_configuration_versions where id=(select (result->>'draftVersionId')::uuid from d5o_test_result)));
select public.d5o_configuration_publish_v1('${workspace}',
  (select (result->>'draftVersionId')::uuid from d5o_test_result),'${active}');
select jsonb_build_object('activeBeforeActivation',(select active_configuration_version_id from config_tenants where workspace_id='${workspace}'),
  'candidateStatus',(select status from config_configuration_versions where id=(select (result->>'draftVersionId')::uuid from d5o_test_result)));
do $$ begin
  update config_tenants set active_configuration_version_id=(select (result->>'draftVersionId')::uuid from d5o_test_result)
    where workspace_id='${workspace}';
  raise exception 'direct_activation_was_allowed';
exception when others then
  if sqlerrm <> 'configuration_activation_command_required' then raise; end if;
end $$;
select public.d5o_configuration_activate_v1('${workspace}',
  (select (result->>'draftVersionId')::uuid from d5o_test_result),'${active}');
select public.d5o_create_work_record_v1('${workspace}',gen_random_uuid()::text,
  jsonb_build_object('title','Synthetic new-version pin verification','workTypeKey','technical-delivery',
   'gateKey','certification-turnover','configurationVersionId',
   (select result->>'draftVersionId' from d5o_test_result)));
reset role;
select jsonb_build_object('newStatus',(select status from config_configuration_versions where id=(select (result->>'draftVersionId')::uuid from d5o_test_result)),
  'oldStatus',(select status from config_configuration_versions where id='${active}'),
  'active',(select active_configuration_version_id from config_tenants where workspace_id='${workspace}'),
  'existingPinnedToOld',(select count(*) from d5o_work_records where workspace_id='${workspace}' and configuration_version_id<>(select result->>'draftVersionId' from d5o_test_result)::uuid),
  'newPinnedToPublished',(select count(*) from d5o_work_records where workspace_id='${workspace}' and title='Synthetic new-version pin verification'
    and configuration_version_id=(select (result->>'draftVersionId')::uuid from d5o_test_result)),
  'audit',(select count(*) from config_configuration_audit_events where configuration_version_id=(select (result->>'draftVersionId')::uuid from d5o_test_result)));
rollback;
select jsonb_build_object('active',(select active_configuration_version_id from config_tenants where workspace_id='${workspace}'),
  'sourceStatus',(select status from config_configuration_versions where id='${active}'),
  'actorRole',(select role from workspace_memberships where workspace_id='${workspace}' and user_id='${actor}'));
`);
console.log(result);
