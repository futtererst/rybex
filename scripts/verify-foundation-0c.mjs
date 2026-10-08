import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const read = (path) => readFileSync(join(root, path), "utf8");
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const migrationPath = "supabase/migrations/0007_billing_v2_production_persistence.sql";
const migration = existsSync(join(root, migrationPath)) ? read(migrationPath) : "";
const packageJson = JSON.parse(read("package.json"));
const persistenceMode = read("lib/d5o/billing-v2/persistence-mode.ts");
const storeFacade = read("lib/d5o/billing-v2/store.ts");
const databaseStore = read("lib/d5o/billing-v2/database-store.ts");
const billingAction = read("app/actions/billing-v2.ts");
const billingPage = read("app/billing/page.tsx");
const commandCenterPage = read("app/command-center/page.tsx");

check(Boolean(migration), "0007 Billing V2 production persistence migration must exist.");
check(migration.includes("create table if not exists billing_backup_packages"), "Billing package table must exist.");
check(migration.includes("create table if not exists billing_backup_requirements"), "Billing proof requirements table must exist.");
check(migration.includes("create table if not exists billing_commercial_reviews"), "Billing commercial review table must exist.");
check(migration.includes("create table if not exists billing_review_decisions"), "Billing review decision table must exist.");
check(migration.includes("create table if not exists billing_blocker_clearances"), "Billing blocker clearance table must exist.");
check((migration.match(/enable row level security/g) ?? []).length >= 5, "Billing tables must have RLS enabled.");
check(!migration.includes("using (true)"), "Billing migration must not include permissive USING (true) policies.");
check(migration.includes("command_idempotency"), "Billing commands must use Foundation 0B idempotency.");
check(migration.includes("append_audit_event") && migration.includes("append_domain_event"), "Billing commands must append audit and domain events.");
check(migration.includes("p_expected_version") && migration.includes("concurrency_conflict"), "Billing commands must enforce optimistic concurrency.");
check(migration.includes("evidence_objects") && migration.includes("evidence_links"), "Billing evidence command must integrate managed evidence metadata/links.");
check(migration.includes("grant execute on function public.billing_v2_seed_fixture_v1(boolean) to service_role"), "Billing fixture seed must be service-role only.");
check(migration.includes("billing_v2_start_package_v1"), "Billing start RPC must exist.");
check(migration.includes("billing_v2_clear_blocker_v1"), "Billing clear-blocker RPC must exist.");

check(persistenceMode.includes("RYBEXOS_BILLING_V2_PERSISTENCE"), "Billing V2 persistence mode env contract must exist.");
check(persistenceMode.includes("Production Billing V2 requires RYBEXOS_BILLING_V2_PERSISTENCE=database"), "Production Billing mode must fail closed without database persistence.");
check(storeFacade.includes("getBillingV2PersistenceMode() === \"database\""), "Store facade must select database mode explicitly.");
check(databaseStore.includes("createRybexSupabaseServerClient"), "Database store must use the server Supabase boundary.");
check(databaseStore.includes("billing_v2_get_package_v1"), "Database store must load package through Billing RPC.");
check(!databaseStore.includes("readLocalOperatingSliceStore") && !databaseStore.includes("writeLocalOperatingSliceStore"), "Database store must not read/write local JSON.");
check(billingAction.includes("@/lib/d5o/billing-v2/store"), "Billing server actions must use the persistence facade.");
check(!billingAction.includes("assertCanUseLocalBusinessAdapter"), "Billing actions must not block database persistence with local-adapter guard.");
check(billingPage.includes("@/lib/d5o/billing-v2/store"), "Billing page must use persistence facade.");
check(commandCenterPage.includes("@/lib/d5o/billing-v2/store"), "Command Center must derive Billing state through persistence facade.");

for (const script of [
  "foundation-0c:verify",
  "foundation-0c:qa-billing",
  "foundation-0c:qa-browser",
  "foundation-0c:gate-local"
]) {
  check(Boolean(packageJson.scripts?.[script]), `package.json must expose ${script}.`);
}

if (failures.length > 0) {
  console.error("Foundation 0C static verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0C static verification passed.");
