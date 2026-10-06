import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const read = (path) => readFileSync(join(root, path), "utf8");
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const migrationPath = "supabase/migrations/0008_field_issue_rfi_change_production_persistence.sql";
const migration = existsSync(join(root, migrationPath)) ? read(migrationPath) : "";
const packageJson = JSON.parse(read("package.json"));
const persistenceMode = read("lib/d5o/field-issue-escalation/persistence-mode.ts");
const storeFacade = read("lib/d5o/field-issue-escalation/store.ts");
const databaseStore = read("lib/d5o/field-issue-escalation/database-store.ts");
const fieldAction = read("app/actions/field-issue-escalation.ts");
const fieldPage = read("app/field-execution/page.tsx");
const commandCenterPage = read("app/command-center/page.tsx");
const rfiPage = read("app/rfis-submittals/page.tsx");
const changesPage = read("app/changes/page.tsx");

check(Boolean(migration), "0008 Field Issue/RFI/Change production persistence migration must exist.");
for (const table of [
  "field_issues",
  "field_issue_assessments",
  "field_issue_evidence_references",
  "rfis",
  "change_events",
  "field_issue_resolutions"
]) {
  check(migration.includes(`create table if not exists ${table}`), `${table} table must exist.`);
}
check((migration.match(/enable row level security/g) ?? []).length >= 6, "0D tables must have RLS enabled.");
check(!migration.includes("using (true)"), "0D migration must not include permissive USING (true) policies.");
check(migration.includes("command_idempotency"), "0D commands must use Foundation 0B idempotency.");
check(migration.includes("append_audit_event") && migration.includes("append_domain_event"), "0D commands must append audit and domain events.");
check(migration.includes("p_expected_version") && migration.includes("concurrency_conflict"), "0D commands must enforce optimistic concurrency.");
check(migration.includes("evidence_objects") && migration.includes("evidence_links"), "0D evidence must use Foundation 0B managed evidence.");
for (const rpc of [
  "field_issue_get_state_v1",
  "field_issue_seed_fixture_v1",
  "field_issue_start_escalation_v1",
  "field_issue_save_assessment_v1",
  "field_issue_attach_evidence_v1",
  "field_issue_select_path_v1",
  "field_issue_create_rfi_v1",
  "field_issue_create_change_event_v1",
  "field_issue_resolve_escalation_v1"
]) {
  check(migration.includes(rpc), `${rpc} RPC must exist.`);
}
check(migration.includes("source_path") && migration.includes("direct_change") && migration.includes("linked_rfi"), "Source-path model must be explicit.");
check(migration.includes("grant execute on function public.field_issue_seed_fixture_v1(boolean) to service_role"), "Field fixture seed must be service-role only.");

check(persistenceMode.includes("RYBEXOS_FIELD_ISSUE_PERSISTENCE"), "Field Issue persistence mode env contract must exist.");
check(persistenceMode.includes("Production Field Issue Escalation requires RYBEXOS_FIELD_ISSUE_PERSISTENCE=database"), "Production Field mode must fail closed without database persistence.");
check(storeFacade.includes("getFieldIssuePersistenceMode() === \"database\""), "Field Issue store facade must select database mode explicitly.");
check(databaseStore.includes("createRybexSupabaseServerClient"), "Field database store must use the server Supabase boundary.");
check(databaseStore.includes("field_issue_get_state_v1"), "Field database store must load state through RPC.");
check(!databaseStore.includes("readLocalOperatingSliceStore") && !databaseStore.includes("writeLocalOperatingSliceStore"), "Database store must not read/write local JSON.");
check(fieldAction.includes("@/lib/d5o/field-issue-escalation/store"), "Field server actions must use the persistence facade.");
check(!fieldAction.includes("assertCanUseLocalBusinessAdapter"), "Field actions must not block database persistence with local-adapter guard.");
check(fieldPage.includes("@/lib/d5o/field-issue-escalation/store"), "Field Execution page must use the persistence facade.");
check(commandCenterPage.includes("@/lib/d5o/field-issue-escalation/store"), "Command Center must derive Field state through persistence facade.");
check(rfiPage.includes("@/lib/d5o/field-issue-escalation/store"), "RFIs/Submittals must use the persistence facade.");
check(changesPage.includes("@/lib/d5o/field-issue-escalation/store"), "Changes must use the persistence facade.");
check(existsSync(join(root, "scripts/migrate-field-issue-local-to-supabase.mjs")), "Field Issue migration script must exist.");

for (const script of [
  "foundation-0d:verify",
  "foundation-0d:qa-field",
  "foundation-0d:qa-browser",
  "foundation-0d:gate-local",
  "field-issue:migrate-local:dry-run",
  "field-issue:migrate-local:apply"
]) {
  check(Boolean(packageJson.scripts?.[script]), `package.json must expose ${script}.`);
}

check(!read("package.json").includes("package-output/rybexos-demo-package"), "package-output export must not influence 0D scripts.");

if (failures.length > 0) {
  console.error("Foundation 0D static verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0D static verification passed.");
