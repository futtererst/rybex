import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validatePipelineQualificationRuntime03Pack } from "./cfg-runtime-01-utils.mjs";

const repoRoot = process.env.CFG_RUNTIME_03_VERIFY_ROOT || process.cwd();
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
  "0031_cfg_runtime_03_actor_profile_identity_coherence.sql"
];
const actualTail = migrations.filter((name) => Number(name.slice(0, 4)) >= 17);
if (JSON.stringify(actualTail) === JSON.stringify(expectedTail)) pass("exact CFG runtime migration set is 0017 through 0031");
else fail("exact CFG runtime migration set is 0017 through 0031", `saw ${actualTail.join(", ")}`);

const sql0029 = read("supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql");
const sql0031 = read("supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql");
const page = read("app/pipeline/[opportunityId]/page.tsx");
const actions = read("app/actions/opportunities.ts");
const repo = read("lib/d5o/opportunities/supabase-repository.ts");
const mapper = read("lib/d5o/opportunities/database-mapper.ts");
const types = read("lib/d5o/opportunities/types.ts");
const client = read("app/pipeline/[opportunityId]/BidApprovalOutcomeSelectionClient.tsx");
const evidenceClient = read("app/pipeline/[opportunityId]/BidEvidenceUploadClient.tsx");
const loader = read("scripts/load-cfg-runtime-03-pack-local.mjs");
const guard = read("scripts/cfg-runtime-03-loopback-guard.mjs");
const browserCapture = read("scripts/capture-cfg-runtime-03-browser.mjs");
const supabaseConfig = read("supabase/config.toml");
const packageJsonText = read("package.json");
const packageLockText = read("package-lock.json");
const packageJson = packageJsonText ? JSON.parse(packageJsonText) : null;
const packageLock = packageLockText ? JSON.parse(packageLockText) : null;
const packText = read("config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json");
const pack = packText ? JSON.parse(packText) : null;

if (pack) {
  try {
    validatePipelineQualificationRuntime03Pack(pack);
    pass("v1.2 pack validates with CFG-RUNTIME-03 validator");
  } catch (error) {
    fail("v1.2 pack validates with CFG-RUNTIME-03 validator", error.message);
  }
}

expectIncludes("migration adds dedicated submission approver field", sql0029, "submission_approver_user_id");
expectIncludes("submission approver FK is declared", sql0029, "foreign key (submission_approver_user_id)");
expectIncludes("submission approver references user_profiles", sql0029, "references user_profiles(id)");
if (/coalesce\s*\([^)]*(pursuit_authority|decision_owner|owner_user|estimator|bid_preparer)/i.test(sql0029)) {
  fail("migration does not backfill approver from unrelated owner fields", "found approver-like coalesce fallback");
} else {
  pass("migration does not backfill approver from unrelated owner fields");
}
expectIncludes("bid events store configuration version provenance", sql0029, "configuration_version_id uuid");
expectIncludes("bid events store gate key provenance", sql0029, "configuration_gate_key text");
expectIncludes("bid events store outcome key provenance", sql0029, "configuration_outcome_key text");
expectIncludes("bid events store actor profile provenance", sql0029, "actor_profile_id uuid");
expectIncludes("provenance version FK is restrictive", sql0029, "references config_configuration_versions(id) on delete restrict");
expectIncludes("bid approval configuration resolver exists", sql0029, "p1_01b2_bid_submission_approval_configuration_v1");
expectIncludes("bid approval readiness resolver exists", sql0029, "p1_01b2_bid_submission_approval_readiness_v1");
expectIncludes("dedicated approver assignment RPC exists", sql0029, "assign_opportunity_submission_approver_v1");
expectIncludes("configured bid approval mutation RPC exists", sql0029, "record_configured_bid_submission_approval_v1");
expectIncludes("configured bid evidence RPC exists", sql0029, "attach_opportunity_bid_approval_evidence_v1");
expectIncludes("approval mutation enforces ready entry state", sql0029, "ready_for_submission_approval");
expectIncludes("approval mutation persists approved state", sql0029, "submission_approved_ready_to_send");
expectIncludes("hold mutation persists held state", sql0029, "submission_approval_held");
expectIncludes("approval mutation enforces exact approve outcome", sql0029, "approve-for-submission");
expectIncludes("hold mutation enforces exact hold outcome", sql0029, "hold-submission-approval");
expectIncludes("hold mutation requires rationale", sql0029, "hold_rationale_required");
expectIncludes("mutation uses revision in update predicate", sql0029, "and version = p_expected_version");
expectIncludes("mutation uses state in update predicate", sql0029, "and bid_submission_status = 'ready_for_submission_approval'");
expectIncludes("mutation has idempotency command check", sql0029, "where workspace_id = opp.workspace_id");
expectIncludes("mutation checks command identity", sql0029, "and command_id = p_command_id");
expectIncludes("0031 preflights incoherent actor/profile authority", sql0031, "cfg_runtime_03_actor_profile_preflight_incoherent_authority");
expectIncludes("0031 enforces canonical actor/profile composite FK", sql0031, "foreign key (actor_auth_user_id, actor_profile_id)");
expectIncludes("0031 references canonical user/profile pair", sql0031, "references public.user_profiles(user_id, id)");
expectIncludes("0031 prevents actor identity reassignment", sql0031, "on update restrict");

expectIncludes("types expose dedicated submission approver", types, "submissionApproverUserId");
expectIncludes("types expose bid approval readiness", types, "BidSubmissionApprovalReadiness");
expectIncludes("mapper reads submission approver", mapper, "submissionApprover");
expectIncludes("mapper reads bid approval readiness", mapper, "bidSubmissionApprovalReadiness");
expectIncludes("repository reads bid approval readiness RPC", repo, "p1_01b2_bid_submission_approval_readiness_v1");
expectIncludes("completed decision provenance uses the server-only event read authority", repo, "const db = createRybexSupabaseAdminClient() as unknown as");
expectIncludes("repository assigns submission approver through RPC", repo, "assign_opportunity_submission_approver_v1");
expectIncludes("repository records configured bid approval through RPC", repo, "record_configured_bid_submission_approval_v1");
expectIncludes("repository attaches bid approval evidence through RPC", repo, "attach_opportunity_bid_approval_evidence_v1");
expectIncludes("server action exposes submission approver assignment", actions, "assignOpportunitySubmissionApproverAction");
expectIncludes("server action exposes configured bid approval", actions, "recordConfiguredBidSubmissionApprovalAction");
expectIncludes("server action exposes bid approval evidence attachment", actions, "attachOpportunityBidApprovalEvidenceAction");
expectIncludes("server action rejects empty evidence files", actions, "!file.size");
const custody = read("lib/d5o/opportunities/evidence-custody-service.ts");
expectIncludes("server action delegates evidence custody", actions, "await stageOpportunityEvidence(");
expectIncludes("server action imports shared custody", actions, "evidence-custody-service");
expectIncludes("shared custody rejects oversized evidence files at 1 MiB", custody, "file.size > 1048576");
expectIncludes("shared custody restricts evidence MIME types", custody, "!allowed.includes(file.type)");
expectIncludes("page renders CFG-RUNTIME-03 configured surface", page, "cfg-runtime-03-bid-approval");
expectIncludes("page preserves approved versus submitted boundary", page, "No bid submission has been recorded");
expectIncludes("ready state renders configured evidence in the main workspace", page, "data-ready-evidence-summary");
expectIncludes("ready state identifies the satisfying evidence file", page, "requirement.evidence.fileName");
expectIncludes("completed states sanitize fixture-like profile names", page, "humanReadablePersonName");
expectNotIncludes("page does not coalesce submission approver from pursuit or owner fields", page, "pursuitAuthority ??");
expectNotIncludes("page does not coalesce submission approver from opportunity owner", page, "bdOwner ??");
expectIncludes("client starts with no selected outcome", client, "useState(\"\")");
expectIncludes("client disables CTA until configured inputs are complete", client, "disabled={!canSubmit}");
expectIncludes("client uses exact bid approval outcome key field", client, "bidApprovalOutcomeKey");
expectIncludes("missing-evidence client starts with no valid file", evidenceClient, "useState(false)");
expectIncludes("missing-evidence client enables only for a non-empty selected file", evidenceClient, "files?.[0]?.size");
expectIncludes("missing-evidence client disables save without a valid file", evidenceClient, "disabled={!hasValidFile || !relationshipType}");
expectIncludes("missing-evidence client explains notes cannot satisfy evidence", evidenceClient, "Notes cannot satisfy this requirement");
expectIncludes("loader targets the CFG-RUNTIME-03 pack path", loader, "defaultRuntime03PackPath");
expectIncludes("loader uses local-only guard", loader, "assertLocalSupabaseUrl");
expectIncludes("browser capture supports bounded relative evidence namespace", browserCapture, "--evidence-namespace");
expectIncludes("browser capture proves notes alone keep save disabled", browserCapture, "notes alone enabled bid evidence save");
expectIncludes("browser capture rejects raw fixture profile labels", browserCapture, "(?:ops|bd|pm|auditor|user|estimator|admin)");

if (packageJson?.devDependencies?.supabase === "2.109.1") pass("package.json pins repository-local Supabase CLI exactly to 2.109.1");
else fail("package.json pins repository-local Supabase CLI exactly to 2.109.1", String(packageJson?.devDependencies?.supabase ?? "missing"));
const lockedSupabase = packageLock?.packages?.["node_modules/supabase"];
if (packageLock?.packages?.[""]?.devDependencies?.supabase === "2.109.1" && lockedSupabase?.version === "2.109.1" && lockedSupabase?.integrity) {
  pass("package-lock.json resolves Supabase CLI 2.109.1 with integrity metadata");
} else {
  fail("package-lock.json resolves Supabase CLI 2.109.1 with integrity metadata", String(lockedSupabase?.version ?? "missing"));
}

for (const [label, value] of Object.entries({ shadow: "55320", api: "55321", db: "55322", studio: "55323", inbucket: "55324", smtp: "55325", pop3: "55326", analytics: "55327", pooler: "55329" })) {
  expectIncludes(`supabase config declares authoritative ${label} port ${value}`, supabaseConfig, value);
}
expectIncludes("Supabase pooler remains disabled", supabaseConfig, "[db.pooler]\nenabled = false");
expectIncludes("guard verifies authoritative package manifests", guard, "assertAuthoritativeLocalSource");
expectIncludes("guard verifies approved .env.local hash", guard, "CFG_RUNTIME_03_ENV_LOCAL_SHA256");
expectIncludes("guard rejects inherited local credentials", guard, "requiredLocalEnvKeys");

const executableRoots = ["app", "lib", "scripts"];
const executableFiles = executableRoots.flatMap((directory) => listExecutableFiles(join(repoRoot, directory)));
executableFiles.push(join(repoRoot, "supabase", "config.toml"));
const obsoleteExecutablePorts = executableFiles.filter((path) => /5432[0-9]/.test(readFileSync(path, "utf8")));
if (obsoleteExecutablePorts.length === 0) pass("no executable obsolete local-port fallback remains");
else fail("no executable obsolete local-port fallback remains", obsoleteExecutablePorts.map((path) => path.slice(repoRoot.length + 1)).join(", "));

const configuredSurfaceStart = page.indexOf("function ConfiguredBidSubmissionApprovalSurface");
const configuredSurfaceEnd = page.indexOf("function shouldRenderBidSubmission", configuredSurfaceStart);
const configuredSurface = configuredSurfaceStart >= 0 && configuredSurfaceEnd > configuredSurfaceStart
  ? page.slice(configuredSurfaceStart, configuredSurfaceEnd)
  : "";
expectNotIncludes("configured CFG-RUNTIME-03 surface does not expose actual bid submission action", configuredSurface, "Submit bid");
expectNotIncludes("configured CFG-RUNTIME-03 surface does not expose P1-01B.3 selected outcome", configuredSurface, "selected_intent_to_award");

if (failures.length) {
  console.error(`CFG-RUNTIME-03 static verification failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("CFG-RUNTIME-03 static verification passed.");

function listExecutableFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return listExecutableFiles(absolute);
    return /\.(?:js|mjs|cjs|ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}
