import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const read = (path) => readFileSync(join(root, path), "utf8");
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const migrationPath = "supabase/migrations/0009_closeout_production_persistence.sql";
const migration = existsSync(join(root, migrationPath)) ? read(migrationPath) : "";
const packageJson = JSON.parse(read("package.json"));
const persistenceMode = read("lib/d5o/closeout-final-billing/persistence-mode.ts");
const storeFacade = read("lib/d5o/closeout-final-billing/store.ts");
const databaseStore = read("lib/d5o/closeout-final-billing/database-store.ts");
const closeoutAction = read("app/actions/closeout-final-billing.ts");
const closeoutPage = read("app/closeout/page.tsx");
const billingPage = read("app/billing/page.tsx");
const commandCenterPage = read("app/command-center/page.tsx");

check(Boolean(migration), "0009 Closeout production persistence migration must exist.");
for (const table of [
  "closeout_release_cases",
  "closeout_requirements",
  "closeout_evidence_references",
  "closeout_readiness_validations",
  "closeout_reviews",
  "closeout_review_decisions",
  "closeout_blocker_clearances",
  "final_billing_retainage_projections"
]) {
  check(migration.includes(`create table if not exists ${table}`), `${table} table must exist.`);
}
check((migration.match(/enable row level security/g) ?? []).length >= 8, "0E tables must have RLS enabled.");
check(!migration.includes("using (true)"), "0E migration must not include permissive USING (true) policies.");
check(migration.includes("command_idempotency"), "0E commands must use Foundation 0B idempotency.");
check(migration.includes("append_audit_event") && migration.includes("append_domain_event"), "0E commands must append audit and domain events.");
check(migration.includes("p_expected_version") && migration.includes("concurrency_conflict"), "0E commands must enforce optimistic concurrency.");
check(migration.includes("evidence_objects") && migration.includes("evidence_links"), "0E evidence must use Foundation 0B managed evidence.");
check(migration.includes("final_billing_status = 'ready_for_processing'"), "Closeout clearance must set final billing ready for processing.");
check(migration.includes("retainage_status = 'release_approved'"), "Closeout clearance must set retainage release approved.");
check(migration.includes("payment_status = 'not_recorded'"), "Closeout clearance must preserve payment not recorded.");
check(migration.includes("commercial_state = 'closeout_restriction_cleared'"), "Closeout clearance must clear the closeout restriction without claiming payment.");
check(!migration.includes("final_billing_status = 'paid'") && !migration.includes("commercial_state = 'recovered'"), "0E projection must not write false paid/recovered states.");
for (const rpc of [
  "closeout_get_state_v1",
  "closeout_seed_fixture_v1",
  "closeout_start_release_v1",
  "closeout_save_assessment_v1",
  "closeout_attach_evidence_v1",
  "closeout_validate_readiness_v1",
  "closeout_submit_review_v1",
  "closeout_record_decision_v1",
  "closeout_clear_blocker_v1"
]) {
  check(migration.includes(rpc), `${rpc} RPC must exist.`);
}
check(migration.includes("grant execute on function public.closeout_seed_fixture_v1(boolean) to service_role"), "Closeout fixture seed must be service-role only.");

check(persistenceMode.includes("RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE"), "Closeout persistence mode env contract must exist.");
check(persistenceMode.includes("Production Closeout Final Billing requires RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE=database"), "Production Closeout mode must fail closed without database persistence.");
check(storeFacade.includes("getCloseoutFinalBillingPersistenceMode() === \"database\""), "Closeout store facade must select database mode explicitly.");
check(databaseStore.includes("createRybexSupabaseServerClient"), "Closeout database store must use the server Supabase boundary.");
check(databaseStore.includes("closeout_get_state_v1"), "Closeout database store must load state through RPC.");
check(!databaseStore.includes("readLocalOperatingSliceStore") && !databaseStore.includes("writeLocalOperatingSliceStore"), "Database store must not read/write local JSON.");
check(closeoutAction.includes("@/lib/d5o/closeout-final-billing/store"), "Closeout server actions must use the persistence facade.");
check(!closeoutAction.includes("assertCanUseLocalBusinessAdapter"), "Closeout actions must not block database persistence with local-adapter guard.");
check(closeoutPage.includes("@/lib/d5o/closeout-final-billing/store"), "Closeout page must use the persistence facade.");
check(billingPage.includes("@/lib/d5o/closeout-final-billing/store"), "Billing projection must derive Closeout state through persistence facade.");
check(commandCenterPage.includes("@/lib/d5o/closeout-final-billing/store"), "Command Center must derive Closeout state through persistence facade.");
check(existsSync(join(root, "scripts/migrate-closeout-local-to-supabase.mjs")), "Closeout migration script must exist.");

for (const script of [
  "foundation-0e:verify",
  "foundation-0e:qa-closeout",
  "foundation-0e:qa-browser",
  "foundation-0e:gate-local",
  "closeout:migrate-local:dry-run",
  "closeout:migrate-local:apply"
]) {
  check(Boolean(packageJson.scripts?.[script]), `package.json must expose ${script}.`);
}

check(!read("package.json").includes("package-output/rybexos-demo-package"), "package-output export must not influence 0E scripts.");

if (failures.length > 0) {
  console.error("Foundation 0E static verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0E static verification passed.");
