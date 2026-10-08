import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hash, j, q, sql } from "./implementation-context.mjs";

const apply = process.argv.includes("--apply");
const fixtures = JSON.parse(readFileSync("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json", "utf8"));
const sourcePrefix = "config/template-packs/d5o-prototype-lifecycle-";
const migrationSource = readFileSync("supabase/migrations/20261005122038_d5o_configured_lifecycle_rules.sql", "utf8");
const migrationBody = migrationSource.replace(/\bbegin;\s*$/m, "").replace(/\bcommit;\s*$/m, "");
const insert = (table, row) => "insert into public." + table + "(" + Object.keys(row).join(",") + ") values("
  + Object.values(row).map((value) => value && typeof value === "object" ? j(value) : q(value)).join(",") + ");";
const reports = [];

for (const scenario of fixtures.scenarios) {
  const path = sourcePrefix + scenario.name + "-v2.json";
  const bytes = readFileSync(path);
  const pack = JSON.parse(bytes);
  assert.equal(pack.workType.lifecycle.gateKey, pack.gate.key);
  assert.equal(pack.transitions[0].from, pack.workType.lifecycle.initialState);
  assert.equal(pack.transitions.at(-1).to, pack.workType.lifecycle.completeState);
  assert.equal(new Set(pack.transitions.map((item) => item.right)).size, pack.transitions.length);
  assert.equal(new Set(pack.transitions.map((item) => item.outcome)).size, pack.transitions.length);
  const roles = new Map(pack.roles.map((item) => [item.key, randomUUID()]));
  const evidence = new Map(pack.evidence.map((item) => [item.key, randomUUID()]));
  const knownStates = new Set([pack.workType.lifecycle.initialState, ...pack.transitions.map((item) => item.to).filter(Boolean)]);
  for (const transition of pack.transitions) {
    assert(roles.has(transition.role), "unknown role: " + transition.role);
    assert(knownStates.has(transition.from), "unknown source state: " + transition.from);
    if (transition.to) assert(knownStates.has(transition.to), "unknown target state: " + transition.to);
  }
  const ids = { template: randomUUID(), templateVersion: randomUUID(), activation: randomUUID(),
    configuration: randomUUID(), version: randomUUID(), phase: randomUUID(), gate: randomUUID() };
  const packKey = pack.packKey + "-m1-" + fixtures.run;
  const prior = sql("select count(*) from public.config_template_packs where pack_key=" + q(packKey) + ";");
  assert.equal(prior, "0", "lifecycle pack already exists; never overwrite a published version");
  let statement = "begin;" + (apply ? "" : migrationBody);
  statement += insert("config_template_packs", { id: ids.template, pack_key: packKey, name: pack.packName, domain: pack.domain, status: "released" });
  statement += insert("config_template_pack_versions", { id: ids.templateVersion, template_pack_id: ids.template, semver: pack.version, status: "released", defaults_json: pack });
  statement += insert("config_tenant_template_activations", { id: ids.activation, tenant_id: scenario.tenant,
    template_pack_version_id: ids.templateVersion, activation_scope: "prototype-lifecycle", status: "active" });
  statement += insert("config_tenant_configurations", { id: ids.configuration, tenant_id: scenario.tenant, activation_id: ids.activation,
    config_key: "prototype-lifecycle-" + scenario.name, name: pack.packName, status: "active" });
  statement += insert("config_configuration_versions", { id: ids.version, tenant_configuration_id: ids.configuration, version: 1,
    status: "draft", source_template_pack_version_id: ids.templateVersion,
    effective_from: new Date(Date.now() - 60000).toISOString(),
    config_manifest_json: { synthetic: true, sourceSha256: hash(bytes), purpose: "prototype lifecycle candidate", notActiveDefault: true } });
  statement += insert("config_phase_definitions", { id: ids.phase, configuration_version_id: ids.version,
    phase_key: pack.phase.key, label: pack.phase.label, status: "active" });
  statement += insert("config_gate_definitions", { id: ids.gate, configuration_version_id: ids.version, phase_id: ids.phase,
    gate_key: pack.gate.key, label: pack.gate.label, purpose: pack.gate.purpose, status: "active",
    entry_rule_json: pack.gate.entryRule, exit_rule_json: pack.gate.exitRule });
  statement += insert("config_work_item_type_definitions", { configuration_version_id: ids.version,
    work_item_type_key: pack.workType.key, label: pack.workType.label, intake_model: "manual",
    lifecycle_json: pack.workType.lifecycle, status: "active" });
  for (const role of pack.roles) statement += insert("config_role_definitions", {
    id: roles.get(role.key), configuration_version_id: ids.version, role_key: role.key,
    label: role.label, status: "active", eligibility_rule_json: { workspaceRoles: role.workspaceRoles }
  });
  for (const item of pack.evidence) {
    statement += insert("config_evidence_type_definitions", { id: evidence.get(item.key),
      configuration_version_id: ids.version, evidence_type_key: item.key, label: item.label, status: "active" });
    statement += insert("config_gate_evidence_requirements", { configuration_version_id: ids.version, gate_id: ids.gate,
      evidence_type_id: evidence.get(item.key), requirement_level: "optional", status: "active" });
  }
  for (const transition of pack.transitions) {
    const consequence = transition.to
      ? { final: transition.to === pack.workType.lifecycle.completeState, state: transition.to }
      : { final: false };
    statement += insert("config_gate_decision_outcomes", { configuration_version_id: ids.version, gate_id: ids.gate,
      outcome_key: transition.outcome, label: transition.label, outcome_type: transition.type ?? "approve",
      consequence_json: consequence, status: "active" });
    statement += insert("config_decision_right_definitions", { configuration_version_id: ids.version,
      decision_right_key: transition.right, label: transition.label, role_definition_id: roles.get(transition.role),
      gate_definition_id: ids.gate, outcome_key: transition.outcome, status: "active",
      approval_rule_json: { requires: { op: "all", items: [{ op: "state_equals", value: transition.from }, ...transition.requirements] },
        forbidPreparer: true, distinctFactKeys: transition.distinctFactKeys ?? [],
        distinctDecisionRights: transition.distinctDecisionRights ?? [],
        ...(transition.exceptionRuleKey ? { exceptionRuleKey: transition.exceptionRuleKey } : {}) } });
  }
  if (pack.exception) {
    const exceptionId = randomUUID();
    statement += insert("config_exception_rules", { id: exceptionId, configuration_version_id: ids.version,
      exception_rule_key: pack.exception.key, label: pack.exception.label, applies_to: "gate",
      waiver_rule_json: { factKey: pack.exception.factKey, scope: pack.exception.scope }, status: "active" });
    statement += insert("config_exception_approval_role_links", { configuration_version_id: ids.version,
      exception_rule_id: exceptionId, role_key: pack.exception.roleKey });
  }
  statement += "update public.config_configuration_versions set status='published',published_at=now() where id=" + q(ids.version) + ";";
  statement += "update public.config_tenant_configurations set active_version_id=" + q(ids.version) + " where id=" + q(ids.configuration) + ";";
  statement += "select rybex_internal.d5o_m1_configuration(" + q(scenario.workspace) + "::uuid," + q(ids.version) + "::uuid,"
    + q(pack.workType.key) + "," + q(pack.gate.key) + ")->>'versionId';";
  statement += apply ? "commit;" : "rollback;";
  const resolved = sql(statement);
  assert.equal(resolved, ids.version, "new version failed configuration resolution");
  const defaultVersion = sql("select active_configuration_version_id from public.config_tenants where id=" + q(scenario.tenant) + "::uuid;");
  assert.equal(defaultVersion, scenario.version, "existing synthetic workspace default changed");
  reports.push({ scenario: scenario.name, source: path, sha256: hash(bytes), configurationVersionId: ids.version,
    transitionCount: pack.transitions.length, mode: apply ? "PUBLISHED_NOT_DEFAULT" : "ROLLED_BACK" });
}
console.log(JSON.stringify({ status: "PASS", reports }, null, 2));
