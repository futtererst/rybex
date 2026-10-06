import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.env.CFG_RUNTIME_01_VERIFY_ROOT || process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(relativePath, "required file is missing");
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function pass(name) {
  console.log(`PASS: ${name}`);
}

function fail(name, detail) {
  failures.push({ name, detail });
  console.error(`FAIL: ${name} - ${detail}`);
}

function expectIncludes(name, text, fragment) {
  if (text.includes(fragment)) {
    pass(name);
  } else {
    fail(name, `missing ${fragment}`);
  }
}

function expectNotIncludes(name, text, fragment) {
  if (!text.includes(fragment)) {
    pass(name);
  } else {
    fail(name, `forbidden ${fragment}`);
  }
}

const migrationFiles = readdirSync(join(repoRoot, "supabase", "migrations"))
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort();
const expectedTail = [
  "0017_configuration_foundation_core.sql",
  "0018_configuration_template_packs_versions.sql",
  "0019_configuration_tenant_activation_versions.sql",
  "0020_configuration_phase_gate_definitions.sql",
  "0021_configuration_work_types_streams_lanes.sql",
  "0022_configuration_roles_permissions_decision_rights.sql",
  "0023_configuration_artifact_evidence_definitions.sql",
  "0024_configuration_kpi_financial_workforce_handoff_governance.sql",
  "0025_configuration_audit_effective_resolution.sql",
  "0026_configuration_template_pack_seed_data.sql",
  "0027_cfg_runtime_01_pricing_review_readiness.sql",
  "0028_cfg_runtime_02_pursuit_authorization.sql",
  "0029_cfg_runtime_03_bid_submission_approval.sql",
  "0030_cfg_runtime_03_evidence_persistence_authority.sql",
  "0031_cfg_runtime_03_actor_profile_identity_coherence.sql",
];

const actualTail = migrationFiles.filter((name) => Number(name.slice(0, 4)) >= 17);
if (JSON.stringify(actualTail) === JSON.stringify(expectedTail)) {
  pass("exact CFG migration set includes CFG-RUNTIME-01 through CFG-RUNTIME-03");
} else {
  fail("exact CFG migration set includes CFG-RUNTIME-01 through CFG-RUNTIME-03", `saw ${actualTail.join(", ")}`);
}

const sql0027 = read("supabase/migrations/0027_cfg_runtime_01_pricing_review_readiness.sql");
const repoSql = [
  "lib/d5o/opportunities/supabase-repository.ts",
  "lib/d5o/opportunities/database-mapper.ts",
  "lib/d5o/opportunities/types.ts",
  "app/pipeline/[opportunityId]/page.tsx",
].map((path) => read(path)).join("\n");

expectIncludes("0027 adds configuration-version provenance", sql0027, "pricing_review_configuration_version_id uuid");
expectIncludes("0027 provenance FK references config versions", sql0027, "references config_configuration_versions(id) on delete restrict");
expectIncludes("0027 adds semantic gate key", sql0027, "pricing_review_gate_key text");
expectIncludes("0027 adds provenance pair check", sql0027, "opportunities_pricing_review_configuration_pair_check");
expectIncludes("server config resolver exists", sql0027, "p1_01a_pricing_review_configuration_v1");
expectIncludes("server readiness resolver exists", sql0027, "p1_01a_pricing_review_readiness_v1");
expectIncludes("submit mutation resolves readiness at mutation time", sql0027, "readiness := public.p1_01a_pricing_review_readiness_v1(opp.id)");
expectIncludes("submit mutation fails closed when config unavailable", sql0027, "'configuration_unavailable'");
expectIncludes("submit mutation rejects unmet configured requirements", sql0027, "'configured_pricing_review_requirements_unmet'");
expectIncludes("submit mutation persists configuration version", sql0027, "pricing_review_configuration_version_id = config_version_id");
expectIncludes("submit mutation persists semantic gate key", sql0027, "pricing_review_gate_key = gate_key");
expectIncludes("audit event includes configuration provenance", sql0027, "'configurationVersionId', config_version_id");
expectIncludes("idempotency claim is preserved", sql0027, "select * into claim");
expectIncludes("idempotency complete is preserved", sql0027, "complete_command(opp.workspace_id, p_command_id, result)");
expectIncludes("resolver uses effective configuration function", sql0027, "config_effective_configuration_version_id(tenant_record.id, p_as_of)");
expectIncludes("resolver requires pricing review gate key", sql0027, "gate_key = 'pricing-review'");
expectIncludes("resolver requires configured evidence", sql0027, "config_gate_evidence_requirements");
expectIncludes("resolver requires configured decision right", sql0027, "config_decision_right_definitions");
expectIncludes("readiness verifies persisted evidence", sql0027, "join evidence_links el");
expectIncludes("readiness verifies evidence relationship type from config", sql0027, "el.relationship_type = requirement->>'relationshipType'");
expectIncludes("readiness verifies decision-owner role from config", sql0027, "wm.role = role_key");
expectIncludes("readiness uses accepted P1 evidence verification status", sql0027, "eo.verification_status = 'accepted'");
expectNotIncludes("readiness does not invent unsupported verified status", sql0027, "eo.verification_status = 'verified'");
expectNotIncludes("runtime SQL does not recreate platform admin shortcut", sql0027, "config_is_platform_admin");
expectNotIncludes("0027 does not insert template-pack data", sql0027, "insert into config_template");

const pack = JSON.parse(read("config/template-packs/rybex-d5o-pipeline-qualification-v1.json"));
if (
  pack.gate?.key === "pricing-review" &&
  pack.evidenceTypes?.some((item) => item.key === "qualification_decision_support" && item.completionRule?.verificationStatus === "accepted")
) {
  pass("compatibility pack represents accepted Pricing Review evidence");
} else {
  fail("compatibility pack represents accepted Pricing Review evidence", "missing pricing-review gate or accepted decision support evidence");
}

expectIncludes("loader is local-only guarded", read("scripts/cfg-runtime-01-utils.mjs"), "must point to localhost or 127.0.0.1");
expectIncludes("loader refuses immutable pack conflict", read("scripts/load-cfg-runtime-01-pack-local.mjs"), "immutable and has conflicting content");
expectIncludes("repository fetches readiness server-side", repoSql, "p1_01a_pricing_review_readiness_v1");
expectIncludes("mapper exposes pricingReviewReadiness", repoSql, "pricingReviewReadiness");
expectIncludes("UI shows configured evidence", repoSql, "Attach the decision support evidence before the opportunity can advance to Pricing Review.");
expectIncludes("UI places evidence save in main workflow", repoSql, "Save evidence and notes");
expectIncludes("UI places owner correction in main workflow", repoSql, "Assign Decision Owner");
expectIncludes("UI shows eligible owner selector", repoSql, "Choose Operations Leader");
expectIncludes("UI shows accountable decision owner role", repoSql, "Accountable role:");
expectNotIncludes("UI removed retired evidence CTA", repoSql, "Save evidence notes");
expectNotIncludes("runtime code does not branch by tenant name", repoSql, "Rybex Local Pipeline Qualification");
expectNotIncludes("runtime code does not branch by tenant key", repoSql, "rybex-local-pipeline-qualification");

const seed0026 = read("supabase/migrations/0026_configuration_template_pack_seed_data.sql");
expectNotIncludes("0026 remains seed no-op", seed0026.toLowerCase(), "insert into");

if (failures.length > 0) {
  throw new Error(`CFG-RUNTIME-01 static verification failed ${failures.length} check(s).`);
}

console.log("CFG-RUNTIME-01 static verification passed.");
