import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const apply = args.has("--apply");
const runtimeMode = process.env.RYBEXOS_RUNTIME_MODE;

if (!["local", "test"].includes(runtimeMode ?? "")) {
  throw new Error("Field Issue migration requires RYBEXOS_RUNTIME_MODE=local or test.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Field Issue migration requires local Supabase URL and server-only service key.");
}

const storePath = process.env.RYBEXOS_FIELD_ISSUE_STORE_PATH ?? join(root, ".rybexos-local", "field-issue-escalation-store.json");
const reportPath = process.env.FIELD_ISSUE_MIGRATION_REPORT_PATH ?? join(root, "visual-qa-output", "foundation-0d-field", dryRun ? "migration-dry-run.json" : "migration-apply.json");
const store = readStore(storePath);
const issue = Object.values(store.issues ?? {})[0] ?? null;
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const report = {
  runTimestamp: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "apply",
  localStorePath: storePath,
  sourceExists: Boolean(issue),
  fieldIssueCount: issue ? 1 : 0,
  assessmentCount: issue?.assessment ? 1 : 0,
  rfiCount: issue?.downstreamRecords?.some((record) => record.recordType === "rfi") ? 1 : 0,
  changeEventCount: issue?.downstreamRecords?.some((record) => record.recordType === "change_event") ? 1 : 0,
  resolutionCount: issue?.state === "resolved" ? 1 : 0,
  stableKeys: {
    issue: issue?.id,
    rfi: issue?.downstreamRecords?.find((record) => record.recordType === "rfi")?.id,
    changeEvent: issue?.downstreamRecords?.find((record) => record.recordType === "change_event")?.id
  },
  selectedPath: issue?.selectedEscalationPath ?? null,
  status: issue?.state ?? "missing",
  legacyEvidenceReferencesRequireManagedEvidenceMigration: (issue?.evidenceReferences ?? []).map((reference) => ({
    requirementId: reference.requirementId,
    referenceType: reference.referenceType,
    migratedAsManagedEvidence: false
  })),
  applied: false,
  mismatches: []
};

if (apply) {
  const seed = await supabase.rpc("field_issue_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success === false) {
    throw new Error(seed.error?.message ?? JSON.stringify(seed.data));
  }
  report.applied = true;
}

writeJson(reportPath, report);
console.log(JSON.stringify({
  status: "ok",
  mode: report.mode,
  fieldIssueCount: report.fieldIssueCount,
  applied: report.applied,
  reportPath
}));

function readStore(path) {
  if (!existsSync(path)) {
    return { version: 1, issues: {}, updatedAt: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}
