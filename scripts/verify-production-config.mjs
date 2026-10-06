import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const productionConfigPath = "lib/d5o/security/production-config.ts";
const productionReadinessPath = "lib/d5o/security/production-readiness.ts";
const envExample = read(".env.example");
const config = existsSync(join(root, productionConfigPath)) ? read(productionConfigPath) : "";

check(Boolean(config), "production-config.ts must exist.");
check(existsSync(join(root, productionReadinessPath)), "production-readiness.ts must exist.");
for (const expected of [
  "RYBEXOS_RUNTIME_MODE",
  "RYBEXOS_AUTH_MODE",
  "RYBEXOS_DATA_SOURCE",
  "RYBEXOS_BILLING_V2_PERSISTENCE",
  "RYBEXOS_FIELD_ISSUE_PERSISTENCE",
  "RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE",
  "RYBEXOS_EVIDENCE_STORE",
  "RYBEXOS_SCANNER_MODE"
]) {
  check(config.includes(expected) || envExample.includes(expected), `${expected} must be represented in the production contract.`);
}
check(config.includes("getProductionReadiness"), "Production readiness function must exist.");
check(config.includes("scanner_url") && config.includes("RYBEXOS_SCANNER_URL"), "Production scanner URL validation must exist.");
check(!config.includes("console.log(process.env"), "Production config must not log environment secrets.");

const runtimeMode = process.env.RYBEXOS_RUNTIME_MODE ?? "local";
const summary = {
  runtimeMode,
  dataSource: process.env.RYBEXOS_DATA_SOURCE ?? "unset",
  billingPersistence: process.env.RYBEXOS_BILLING_V2_PERSISTENCE ?? "unset",
  fieldIssuePersistence: process.env.RYBEXOS_FIELD_ISSUE_PERSISTENCE ?? "unset",
  closeoutPersistence: process.env.RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE ?? "unset",
  evidenceMode: process.env.RYBEXOS_EVIDENCE_STORE ?? "unset",
  scannerMode: process.env.RYBEXOS_SCANNER_MODE ?? "unset",
  hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  hasServerKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
};

if (failures.length > 0) {
  console.error("Production config verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log("Production config verification passed.");
console.log(JSON.stringify(summary, null, 2));
