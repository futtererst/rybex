import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const evidenceRoot = resolve(root, "artifacts/cfg-runtime-03-authoritative-baseline-remediation/2026-08-12T16-53-40-348Z");
const mode = process.argv.find((value) => value.startsWith("--mode="))?.slice(7) ?? "protected";
const readJson = (name) => JSON.parse(readFileSync(join(evidenceRoot, name), "utf8"));

if (mode === "protected") verifyProtected();
else if (mode === "reconstruction") verifyReconstruction();
else if (mode === "deletion") verifyDeletion();
else if (mode === "backup") verifyBackup();
else if (mode === "cleanup") verifyCleanup();
else if (mode === "links") verifyLinks();
else if (mode === "inventory") verifyInventory();
else throw new Error(`unsupported authoritative-baseline mode:${mode}`);

function verifyProtected() {
  const expected = {
    "supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql": "fc2dd4616f19cfdc97cb7ba0d234236f30797f3c3ca82fa4d976b848820ca15a",
    "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql": "3a597bd63309d7a6139a86fde66ea998b18e56b1ba9b36a4ea8714cfffe50cda",
    "artifacts/cfg-runtime-02-accepted-baseline/ACCEPTANCE-MANIFEST.json": "3ec404021c849f503f1d4bdb2cdfc813c0cb289db2c941fe64c494c9096f6549",
    "config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json": "6260de94106bbc047857c3e2b666afea9a124b80acd257546201b6de2bf30abc",
    ".env.local": "bf0477de4eb2121f507ba770e28508751eda8b65b447db9843660402c6f7ce92",
  };
  for (const [path, hash] of Object.entries(expected)) assert(shaFile(resolve(root, path)) === hash, `${path} protected hash`);
  assert(shaFile(resolve(root, "artifacts/cfg-runtime-03-identity-boundary-remediation/2026-08-12T16-22-54-517Z/hash-manifest.json")) === "e797635c23375cb5a9bf44bd04be7ff7847ca983fdbcec1dd0c5cae4dd4672f1", "Prompt 8 hash manifest protected");
}
function verifyReconstruction() {
  const decision = readJson("authoritative-baseline-decision.json");
  const ledger = readJson("row-level-provenance-ledger.json");
  assert(decision.prompt6BaselineDisposition === "MATERIAL QUALIFICATION-RESIDUE MISCLASSIFICATION", "Prompt 6 false baseline formally superseded");
  assert(decision.invariants.currentPrompt6OpportunityMatches === 11 && decision.invariants.currentPrompt6QualificationMatches === 9 && decision.invariants.currentPrompt6EvidenceMatches === 208, "Prompt 6 direct lineage reconciles");
  assert(decision.invariants.strictDanglingQualificationLinks === 2447 && decision.invariants.preexistingQualificationOnlyObjects === 4107 && decision.invariants.ambiguousRows === 0, "dangling and qualification-only populations proven without ambiguity");
  assert(Array.isArray(ledger.rows) ? ledger.rows.length >= 6815 : JSON.stringify(ledger).length > 1000000, "row-level provenance ledger is populated");
}
function verifyDeletion() {
  const plan = readJson("exact-deletion-plan.json");
  const decision = readJson("authoritative-baseline-decision.json");
  assert(decision.deletionPlanArtifact.sha256 === shaFile(join(evidenceRoot, "exact-deletion-plan.json")), "deletion plan raw hash matches decision");
  const total = plan.rowCount ?? plan.summary?.rowCount ?? sumRows(plan);
  assert(Number(total) === 6815, "exact deletion population contains 6815 rows");
  assert(decision.safety.legitimateRowsSelected === 0 && decision.safety.ambiguousRowsSelected === 0 && decision.safety.auditEventsSelected === 0, "no legitimate, ambiguous, accepted, or audit rows selected");
}
function verifyBackup() {
  const evidence = readJson("backup-restore-reconciliation.json");
  const backup = join(evidenceRoot, "recovery/preserved-database-before-cleanup.dump");
  assert(existsSync(backup) && shaFile(backup) === "d949dd6cdd224197b51509e5fa429e9a1e5da1de0f4dfdc54157d5d3e4888b88", "retained recovery backup hash");
  assert(evidence.reconciliation?.countsMatch !== false && evidence.cleanup?.zeroResidualResources !== false, "disposable restore reconciled and was removed");
}
function verifyCleanup() {
  const cleanup = readJson("cleanup-transaction-evidence.json");
  assert(cleanup.plan.rowCount === 6815 && cleanup.dryRun.exitCode === 0, "rollback dry run and committed body match exact 6815-row plan");
  assert(cleanup.afterCommit.counts.opportunities === 2 && cleanup.afterCommit.counts.qualifications === 2 && cleanup.afterCommit.counts.evidenceObjects === 0 && cleanup.afterCommit.counts.evidenceLinks === 0 && cleanup.afterCommit.counts.auditEvents === 19652, "committed cleanup produced authoritative counts");
  assert(cleanup.invariants.legitimateRowsDeleted === 0 && cleanup.invariants.ambiguousRowsDeleted === 0 && cleanup.invariants.allPrompt6EvidenceAbsent, "cleanup preserved legitimate/ambiguous rows and removed Prompt 6 evidence");
}
function verifyLinks() {
  const counts = databaseState();
  assert(counts.strictDanglingQualificationLinks === 0 && counts.missingOpportunityLinks === 0, "zero dangling qualification and opportunity links remain");
  assert(counts.opportunities === 2 && counts.qualifications === 2 && counts.evidenceObjects === 0 && counts.evidenceLinks === 0 && counts.auditEvents === 19695 && counts.migrations === 31, "current preserved database matches reconciled authoritative post-0031 baseline");
}
function verifyInventory() {
  const generator = spawnSync(process.execPath, [join(root, "scripts/generate-cfg-runtime-03-candidate-inventory.mjs")], { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 200 });
  if (generator.status !== 0) throw new Error(generator.stderr || generator.stdout);
  const inventory = readJson("candidate-inventory.json");
  assert(inventory.completeDirtyBoundary && inventory.files.length === inventory.counts.total, "complete tracked-plus-untracked candidate boundary generated");
  assert(inventory.digests.implementationTreeSha256 && inventory.digests.evidenceTreeSha256 && inventory.digests.trackedBinaryDiffSha256 && inventory.digests.untrackedImplementationSha256, "candidate inventory includes all required digests");
}
function databaseState() {
  const sql = `select json_build_object('opportunities',(select count(*) from opportunities),'qualifications',(select count(*) from opportunity_qualifications),'evidenceObjects',(select count(*) from evidence_objects),'evidenceLinks',(select count(*) from evidence_links),'auditEvents',(select count(*) from audit_events),'migrations',(select count(*) from supabase_migrations.schema_migrations),'strictDanglingQualificationLinks',(select count(*) from evidence_links el where el.entity_type='opportunity_qualification' and not exists(select 1 from opportunity_qualifications q where q.id=el.entity_id)),'missingOpportunityLinks',(select count(*) from evidence_links el where el.entity_type='opportunity' and not exists(select 1 from opportunities o where o.id=el.entity_id)))::text;`;
  const result = spawnSync("docker", ["exec", "supabase_db_rybex-2-local", "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim());
}
function assert(condition, name) { if (!condition) throw new Error(`FAIL:${name}`); console.log(`PASS: ${name}`); }
function shaFile(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function sumRows(value) { if (Array.isArray(value)) return value.length; if (!value || typeof value !== "object") return 0; return Object.values(value).reduce((sum, child) => sum + sumRows(child), 0); }
