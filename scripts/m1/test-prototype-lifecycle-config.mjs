import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { j, q, sql } from "./implementation-context.mjs";

const fixtures = JSON.parse(readFileSync("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json", "utf8"));
const results = [];
for (const fixture of fixtures.scenarios) {
  const pack = JSON.parse(readFileSync("config/template-packs/d5o-prototype-lifecycle-" + fixture.name + "-v2.json", "utf8"));
  const key = pack.packKey + "-m1-" + fixtures.run;
  const row = JSON.parse(sql("select jsonb_build_object('version',v.id,'default',t.active_configuration_version_id)"
    + " from public.config_template_packs pk"
    + " join public.config_template_pack_versions pv on pv.template_pack_id=pk.id"
    + " join public.config_tenant_template_activations a on a.template_pack_version_id=pv.id"
    + " join public.config_tenant_configurations c on c.activation_id=a.id"
    + " join public.config_configuration_versions v on v.tenant_configuration_id=c.id"
    + " join public.config_tenants t on t.id=a.tenant_id"
    + " where pk.pack_key=" + q(key) + " and t.id=" + q(fixture.tenant) + "::uuid;"));
  assert(row?.version && row.default === fixture.version, "new pack must be published but not default");
  const actor = fixture.actors.upstream_authority;
  const transition = pack.transitions[0];
  const sourceKey = randomUUID();
  const payload = { title: "Synthetic lifecycle transaction rehearsal", workTypeKey: pack.workType.key,
    gateKey: pack.gate.key, configurationVersionId: row.version,
    source: { system: "d5o-lifecycle-rehearsal", type: "work_record", key: sourceKey } };
  const factKey = transition.requirements[0].key;
  const cmd = (kind, user, body = "'{}'::jsonb", proof = "null") =>
    "set local request.jwt.claim.sub=" + q(user) + ";"
    + "select public.d5o_execute_work_command_v1(" + q(fixture.workspace) + "::uuid,"
    + "current_setting('lifecycle.work')::uuid,"
    + "(public.d5o_load_work_record_v1(" + q(fixture.workspace)
    + "::uuid,current_setting('lifecycle.work')::uuid)->'work'->>'record_version')::integer,"
    + proof + "," + q(randomUUID()) + "," + q(kind) + "," + body + ");";
  let statement = "begin;";
  statement += "update public.config_tenants set active_configuration_version_id=" + q(row.version) + " where id=" + q(fixture.tenant) + "::uuid;";
  statement += "set local role authenticated;set local request.jwt.claim.role='authenticated';";
  statement += "set local request.jwt.claim.sub=" + q(fixture.actors.preparer.id) + ";";
  statement += "select set_config('lifecycle.work',(public.d5o_create_work_record_v1("
    + q(fixture.workspace) + "::uuid," + q(randomUUID()) + "," + j(payload) + ")->>'workId'),true);";
  statement += "reset role;";
  statement += "insert into public.d5o_work_participants(workspace_id,work_id,configuration_version_id,profile_id,role_key,assigned_by)"
    + " values(" + q(fixture.workspace) + "::uuid,current_setting('lifecycle.work')::uuid,"
    + q(row.version) + "::uuid," + q(actor.profile) + "::uuid," + q(transition.role) + ","
    + q(fixture.actors.preparer.id) + "::uuid);";
  statement += "insert into public.d5o_work_facts(workspace_id,work_id,fact_key,fact_revision,fact_type,value,scope_key,actor_profile_id,provenance)"
    + " values(" + q(fixture.workspace) + "::uuid,current_setting('lifecycle.work')::uuid,"
    + q(factKey) + ",1,'assessment','true'::jsonb,'work'," + q(fixture.actors.preparer.profile)
    + "::uuid,'{\"source\":\"synthetic-lifecycle-rehearsal\",\"synthetic\":true}'::jsonb);";
  statement += "set local role authenticated;set local request.jwt.claim.role='authenticated';";
  statement += cmd("new_proof", fixture.actors.preparer.id);
  statement += cmd("submit_proof", fixture.actors.preparer.id, "'{}'::jsonb", "1");
  statement += cmd("decide", actor.id, j({ rightKey: transition.right, reason: "Synthetic configured lifecycle rehearsal" }), "1");
  const repeat = "public.d5o_execute_work_command_v1(" + q(fixture.workspace)
    + "::uuid,current_setting('lifecycle.work')::uuid,"
    + "(public.d5o_load_work_record_v1(" + q(fixture.workspace)
    + "::uuid,current_setting('lifecycle.work')::uuid)->'work'->>'record_version')::integer,"
    + "1," + q(randomUUID()) + ",'decide',"
    + j({ rightKey: transition.right, reason: "Out-of-order repeat must fail" }) + ")";
  statement += "do $reject$ declare caught text;begin begin perform " + repeat
    + ";exception when others then caught:=SQLERRM;end;"
    + "if caught is distinct from 'readiness_blocked' then raise exception 'unexpected repeat result: %',coalesce(caught,'SUCCESS');end if;"
    + "perform set_config('lifecycle.reject',caught,true);end $reject$;";
  statement += "reset role;";
  const decisionProof = "(select id from public.d5o_proof_packages where work_id=current_setting('lifecycle.work')::uuid order by proof_package_revision desc limit 1)";
  const priorRule = q(JSON.stringify({ op: "decision_recorded_prior", right: transition.right, outcome: transition.outcome })) + "::jsonb";
  const wrongPriorRule = q(JSON.stringify({ op: "decision_recorded_prior", right: transition.right, outcome: "incorrect-outcome" })) + "::jsonb";
  statement += "select jsonb_build_object('workId',current_setting('lifecycle.work'),"
    + "'state',(select lifecycle_state from public.d5o_work_records where id=current_setting('lifecycle.work')::uuid),"
    + "'version',(select configuration_version_id from public.d5o_work_records where id=current_setting('lifecycle.work')::uuid),"
    + "'decisions',(select count(*) from public.d5o_work_decisions where work_id=current_setting('lifecycle.work')::uuid),"
    + "'sources',(select count(*) from public.d5o_work_sources where work_id=current_setting('lifecycle.work')::uuid),"
    + "'outOfOrder',current_setting('lifecycle.reject'),"
    + "'priorDecision',rybex_internal.d5o_m1_evaluate(" + priorRule + ",current_setting('lifecycle.work')::uuid,"
    + decisionProof + ",'{\"facts\":[],\"evidence\":[]}'::jsonb,'{}'::jsonb),"
    + "'wrongPriorDecision',rybex_internal.d5o_m1_evaluate(" + wrongPriorRule + ",current_setting('lifecycle.work')::uuid,"
    + decisionProof + ",'{\"facts\":[],\"evidence\":[]}'::jsonb,'{}'::jsonb));rollback;";
  const output = sql(statement).split("\n").at(-1);
  const proof = JSON.parse(output);
  assert.equal(proof.state, transition.to);
  assert.equal(proof.version, row.version);
  assert.equal(Number(proof.decisions), 1);
  assert.equal(Number(proof.sources), 1);
  assert.equal(proof.outOfOrder, "readiness_blocked");
  assert.deepEqual(proof.priorDecision, []);
  assert.equal(proof.wrongPriorDecision.length, 1);
  assert.equal(sql("select count(*) from public.d5o_work_records where id=" + q(proof.workId) + "::uuid;"), "0");
  assert.equal(sql("select active_configuration_version_id from public.config_tenants where id=" + q(fixture.tenant) + "::uuid;"), fixture.version);
  results.push({ scenario: fixture.name, from: transition.from, to: transition.to,
    sameWorkRecord: proof.workId, authoritativeDecision: 1, outOfOrder: proof.outOfOrder,
    priorDecision: "correct outcome matches", incorrectPriorDecision: "blocked",
    result: "PASS — transaction rolled back" });
}
console.log(JSON.stringify({ status: "PASS", results }, null, 2));
