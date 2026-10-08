import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const apply = args.has("--apply");
const runtimeMode = process.env.RYBEXOS_RUNTIME_MODE;

if (!["local", "test"].includes(runtimeMode ?? "")) {
  throw new Error("Closeout migration requires RYBEXOS_RUNTIME_MODE=local or test.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Closeout migration requires local Supabase URL and server-only service key.");
}

const storePath = process.env.RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH ?? join(root, ".rybexos-local", "closeout-final-billing-store.json");
const reportPath = process.env.CLOSEOUT_MIGRATION_REPORT_PATH ?? join(root, "visual-qa-output", "foundation-0e-closeout", dryRun ? "migration-dry-run.json" : "migration-apply.json");
const store = readStore(storePath);
const blocker = Object.values(store.blockers ?? {})[0] ?? null;
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const report = {
  runTimestamp: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "apply",
  localStorePath: storePath,
  sourceExists: Boolean(blocker),
  closeoutCaseCount: blocker ? 1 : 0,
  requirementCount: blocker?.evidenceRequirements?.length ?? 0,
  evidenceReferenceCount: blocker?.evidenceReferences?.length ?? 0,
  reviewCount: blocker?.review ? 1 : 0,
  clearanceCount: blocker?.state === "resolved" ? 1 : 0,
  stableKeys: {
    case: blocker?.id,
    package: blocker?.closeoutPackageId,
    payApplication: blocker?.linkedPayApplicationId,
    commercialExposure: blocker?.linkedCommercialExposureId
  },
  status: blocker?.state ?? "missing",
  paymentRecorded: false,
  legacyEvidenceReferencesRequireManagedEvidenceMigration: (blocker?.evidenceReferences ?? []).map((reference) => ({
    requirementId: reference.requirementId,
    referenceType: reference.referenceType,
    migratedAsManagedEvidence: false
  })),
  applied: false,
  mismatches: []
};

if (apply) {
  const seed = await supabase.rpc("closeout_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success === false) {
    throw new Error(seed.error?.message ?? JSON.stringify(seed.data));
  }
  report.applied = true;
}

writeJson(reportPath, report);
console.log(JSON.stringify({
  status: "ok",
  mode: report.mode,
  closeoutCaseCount: report.closeoutCaseCount,
  applied: report.applied,
  reportPath
}));

function readStore(path) {
  if (!existsSync(path)) {
    return { version: 1, blockers: {}, updatedAt: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}
