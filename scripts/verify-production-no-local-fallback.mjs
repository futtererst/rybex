import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const runtime = read("lib/d5o/security/runtime-mode.ts");
const dataSource = read("lib/d5o/data/data-source.ts");
const billingMode = read("lib/d5o/billing-v2/persistence-mode.ts");
const fieldMode = read("lib/d5o/field-issue-escalation/persistence-mode.ts");
const closeoutMode = read("lib/d5o/closeout-final-billing/persistence-mode.ts");
const moduleAvailability = read("lib/d5o/security/production-module-availability.ts");
const proxy = existsSync(join(root, "proxy.ts")) ? read("proxy.ts") : "";

check(runtime.includes("productionLocalAdapterError"), "Runtime must expose production local-adapter fail-closed error.");
check(dataSource.includes("RYBEXOS_RUNTIME_MODE === \"production\"") && dataSource.includes("return \"database\""), "Production data source must default to database, not seed.");
check(billingMode.includes("Production Billing V2 requires RYBEXOS_BILLING_V2_PERSISTENCE=database"), "Billing production mode must refuse local persistence.");
check(fieldMode.includes("Production Field Issue Escalation requires RYBEXOS_FIELD_ISSUE_PERSISTENCE=database"), "Field Issue production mode must refuse local persistence.");
check(closeoutMode.includes("Production Closeout Final Billing requires RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE=database"), "Closeout production mode must refuse local persistence.");
check(moduleAvailability.includes("unavailable_until_migrated"), "Production module availability registry must classify unavailable modules.");
check(proxy.includes("isProductionRouteAvailable") && proxy.includes("503"), "Proxy must contain unavailable production modules before render.");
check(proxy.includes("auth.getUser") && proxy.includes("/auth/sign-in"), "Proxy must protect production-enabled routes with Supabase auth.");

for (const file of [
  ".rybexos-local/billing-v2-store.json",
  ".rybexos-local/field-issue-escalation-store.json",
  ".rybexos-local/closeout-final-billing-store.json"
]) {
  const path = join(root, file);
  const stats = existsSync(path) ? statSync(path) : null;
  check(!stats || stats.isFile(), `${file} must be a file when present.`);
}

if (failures.length > 0) {
  console.error("Production no-local-fallback verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production no-local-fallback verification passed.");
