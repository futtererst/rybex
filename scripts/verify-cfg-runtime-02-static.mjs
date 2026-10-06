import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.env.CFG_RUNTIME_02_VERIFY_ROOT || process.cwd();
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
  if (text.includes(fragment)) pass(name);
  else fail(name, `missing ${fragment}`);
}

function expectNotIncludes(name, text, fragment) {
  if (!text.includes(fragment)) pass(name);
  else fail(name, `forbidden ${fragment}`);
}

const migrations = readdirSync(join(repoRoot, "supabase", "migrations"))
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
const actualTail = migrations.filter((name) => Number(name.slice(0, 4)) >= 17);
if (JSON.stringify(actualTail) === JSON.stringify(expectedTail)) pass("exact CFG runtime migration set includes CFG-RUNTIME-01 through CFG-RUNTIME-03");
else fail("exact CFG runtime migration set includes CFG-RUNTIME-01 through CFG-RUNTIME-03", `saw ${actualTail.join(", ")}`);

const sql0028 = read("supabase/migrations/0028_cfg_runtime_02_pursuit_authorization.sql");
const runtime = [
  "lib/d5o/opportunities/supabase-repository.ts",
  "lib/d5o/opportunities/database-mapper.ts",
  "lib/d5o/opportunities/types.ts",
  "app/pipeline/[opportunityId]/page.tsx",
  "app/pipeline/[opportunityId]/PursuitOutcomeSelectionClient.tsx",
].map((path) => read(path)).join("\n");
const page = read("app/pipeline/[opportunityId]/page.tsx");
const browserHarness = read("scripts/capture-cfg-runtime-02-browser.mjs");
const outcomeClient = read("app/pipeline/[opportunityId]/PursuitOutcomeSelectionClient.tsx");
const loader = read("scripts/load-cfg-runtime-02-pack-local.mjs");
const utils = read("scripts/cfg-runtime-01-utils.mjs");
const pack = JSON.parse(read("config/template-packs/rybex-d5o-pipeline-qualification-v1.1.json"));

expectIncludes("0028 adds P1-01B.1 configuration provenance", sql0028, "pursuit_authorization_configuration_version_id uuid");
expectIncludes("0028 provenance references config versions", sql0028, "references config_configuration_versions(id) on delete restrict");
expectIncludes("0028 adds configured gate key", sql0028, "pursuit_authorization_gate_key text");
expectIncludes("0028 adds configured outcome key", sql0028, "pursuit_authorization_outcome_key text");
expectIncludes("0028 has provenance triplet check", sql0028, "opportunities_pursuit_authorization_configuration_triplet_check");
expectIncludes("Pursuit config resolver exists", sql0028, "p1_01b1_pursuit_authorization_configuration_v1");
expectIncludes("Pursuit readiness resolver exists", sql0028, "p1_01b1_pursuit_authorization_readiness_v1");
expectIncludes("Pursuit mutation resolves readiness at submission", sql0028, "readiness := public.p1_01b1_pursuit_authorization_readiness_v1(opp.id)");
expectIncludes("Pursuit mutation fails closed on config unavailable", sql0028, "'configuration_unavailable'");
expectIncludes("Pursuit mutation rejects configured unmet requirements", sql0028, "'configured_pursuit_authorization_requirements_unmet'");
expectIncludes("Pursuit mutation validates configured outcomes", sql0028, "jsonb_array_elements(readiness->'permittedOutcomes')");
expectIncludes("Pursuit mutation requires configured justification", sql0028, "requiresJustification");
expectIncludes("Pursuit mutation persists configuration version", sql0028, "pursuit_authorization_configuration_version_id = config_version_id");
expectIncludes("Pursuit mutation persists semantic gate key", sql0028, "pursuit_authorization_gate_key = gate_key");
expectIncludes("Pursuit mutation persists outcome key", sql0028, "pursuit_authorization_outcome_key = outcome_key");
expectIncludes("Pursuit audit includes config provenance", sql0028, "'configurationProvenance', config");
expectIncludes("Expected GM is modeled as configured KPI", sql0028, "expected_gross_margin_percent");
expectIncludes("Entity contribution is checked", sql0028, "missing_entity_contribution");
expectIncludes("Decision owner role is config-derived", sql0028, "resolved->'decisionOwnerRole'->>'roleKey'");
expectNotIncludes("No platform-admin shortcut is introduced", sql0028, "config_is_platform_admin");
expectNotIncludes("No Rybex tenant branch in SQL", sql0028, "rybex-local-pipeline-qualification");

if (pack.version === "1.1.0" && pack.gates?.some((gate) => gate.key === "pursuit-authorization")) pass("v2 pack adds immutable pursuit authorization gate");
else fail("v2 pack adds immutable pursuit authorization gate", "missing version 1.1.0 or pursuit-authorization");
if (pack.gates?.some((gate) => gate.key === "pricing-review") && pack.evidenceTypes?.some((entry) => entry.key === "qualification_decision_support")) pass("v2 pack preserves accepted P1-01A definitions");
else fail("v2 pack preserves accepted P1-01A definitions", "missing pricing-review or qualification evidence");
if (pack.decisionOutcomes?.map((entry) => entry.mapsToAction).sort().join(",") === "approve_pursuit,decline_pursuit,hold_pending_evidence") pass("v2 pack contains accepted P1-01B.1 outcome set");
else fail("v2 pack contains accepted P1-01B.1 outcome set", "outcome action set differs");

expectIncludes("loader validates CFG-RUNTIME-02 pack", loader, "validatePipelineQualificationRuntime02Pack(pack)");
expectIncludes("loader refuses remote URLs", utils, "must point to localhost or 127.0.0.1");
expectIncludes("loader refuses immutable content conflicts", loader, "immutable and has conflicting content");
expectIncludes("loader activates configuration version 2", loader, "version = 2");
expectIncludes("repository fetches pursuit readiness server-side", runtime, "p1_01b1_pursuit_authorization_readiness_v1");
expectIncludes("mapper exposes pursuitAuthorizationReadiness", runtime, "pursuitAuthorizationReadiness");
expectIncludes("UI uses configured outcomes", runtime, "configuredOutcomes");
expectIncludes("UI shows Expected Gross Margin %", runtime, "Expected Gross Margin %");
expectIncludes("UI uses explicit absent-margin text", page, "profitabilityDisplayValue");
expectIncludes("UI does not synthesize missing Expected GM as zero", page, "?? \"Not available\"");
expectIncludes("UI shows unavailable state once", runtime, "Pursuit Authorization rules are unavailable");
expectIncludes("UI derives profitability attention from readiness recommendation", page, "readiness.recommendation === \"decline\"");
expectNotIncludes("UI does not allow query override to force decline recommendation", page, "\"decline-recommended\"].includes(stateOverride)");
expectNotIncludes("Expected GM is not derived from view state", page, "state === \"decline-recommended\" || state === \"declined-outcome\" ? 0.118");
expectIncludes("outcome form disables CTA until configured input is complete", outcomeClient, "disabled={!canSubmit}");
expectIncludes("browser proof asserts ready CTA disabled state", browserHarness, "assertDecisionButtonDisabled(page, \"ready initial decision CTA\")");
expectIncludes("browser proof asserts disabled CTA computed styling", browserHarness, "assertDisabledDecisionButtonStyling(page)");
expectIncludes("browser proof asserts unavailable margin presentation", browserHarness, "assertUnavailableMarginPresentation");
expectIncludes("browser proof asserts conditional outcome enablement", browserHarness, "assertOutcomeEnablementBehavior(page)");
expectIncludes("browser proof rejects query-forged business state", browserHarness, "assertQueryForgeryDoesNotChangeReadyState");
expectIncludes("browser proof compares visible margin to database readiness", browserHarness, "assertDisplayedProfitabilityMatchesDatabase");
expectNotIncludes("runtime code does not branch by tenant key", runtime, "rybex-local-pipeline-qualification");

if (failures.length > 0) {
  throw new Error(`CFG-RUNTIME-02 static verification failed ${failures.length} check(s).`);
}

console.log("CFG-RUNTIME-02 static verification passed.");
