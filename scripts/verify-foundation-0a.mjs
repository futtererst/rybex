import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(root, "supabase", "migrations", "0005_identity_workspace_security.sql");

const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const runtimeMode = read("lib/d5o/security/runtime-mode.ts");
const supabaseServer = read("lib/d5o/auth/supabase-server.ts");
const requestContext = read("lib/d5o/auth/request-context.ts");
const currentUser = read("lib/d5o/auth/current-user.ts");
const rbac = read("lib/d5o/rbac.ts");
const billingAction = read("app/actions/billing-v2.ts");
const billingPersistenceMode = read("lib/d5o/billing-v2/persistence-mode.ts");
const fieldAction = read("app/actions/field-issue-escalation.ts");
const fieldPersistenceMode = existsSync(join(root, "lib/d5o/field-issue-escalation/persistence-mode.ts"))
  ? read("lib/d5o/field-issue-escalation/persistence-mode.ts")
  : "";
const closeoutAction = read("app/actions/closeout-final-billing.ts");
const closeoutPersistenceMode = existsSync(join(root, "lib/d5o/closeout-final-billing/persistence-mode.ts"))
  ? read("lib/d5o/closeout-final-billing/persistence-mode.ts")
  : "";
const packageJson = read("package.json");

check("0005 migration exists", existsSync(migrationPath));
check("workspaces hardened", /alter table workspaces[\s\S]*version/.test(migration));
check("profiles map auth user", /user_profiles[\s\S]*user_id uuid/.test(migration) && /active_workspace_id/.test(migration));
check("workspace memberships include user id and role check", /workspace_memberships[\s\S]*user_id uuid/.test(migration) && /workspace_memberships_role_check/.test(migration));
check("project memberships table exists", /create table if not exists project_memberships/.test(migration));
check("RLS enabled on 0A tables", [
  "workspaces",
  "user_profiles",
  "workspace_memberships",
  "project_memberships"
].every((table) => migration.includes(`alter table ${table} enable row level security`)));
check("No permissive USING true policies", !/using\s*\(\s*true\s*\)/i.test(migration));
check("Helper functions use auth.uid", [
  "is_active_workspace_member",
  "current_workspace_role",
  "has_workspace_role",
  "can_access_project"
].every((fn) => migration.includes(fn)) && migration.includes("auth.uid()"));
check("Runtime mode contract exists", /RybexRuntimeMode = "local" \| "test" \| "production"/.test(runtimeMode));
check("Production runtime readiness guard exists", runtimeMode.includes("assertProductionRuntimeReady") && runtimeMode.includes("productionLocalAdapterError"));
check("Server-only Supabase client exists", supabaseServer.includes("import \"server-only\"") && supabaseServer.includes("@supabase/ssr"));
check("Request context exists", requestContext.includes("getRequestContext") && requestContext.includes("workspace_selection_required"));
check("Canonical roles exist", [
  "billing_commercial_lead",
  "closeout_lead",
  "read_only_auditor"
].every((role) => rbac.includes(role)));
check("Canonical permissions exist", [
  "workspace.manage",
  "billing.clear_blocker",
  "field_issue.create_rfi",
  "closeout.clear_blocker"
].every((permission) => rbac.includes(permission)));
check("Supabase current-user resolution active", currentUser.includes("getRequestContext") && !currentUser.includes("reserved for the next pass"));
check("Demo identity impossible in production", runtimeMode.includes("RYBEXOS_AUTH_MODE=supabase") && requestContext.includes("runtimeMode === \"production\""));
check("Local business adapters blocked in production",
  (
    fieldAction.includes("assertCanUseLocalBusinessAdapter") ||
    (
      fieldPersistenceMode.includes("Production Field Issue Escalation requires RYBEXOS_FIELD_ISSUE_PERSISTENCE=database") &&
      fieldAction.includes("@/lib/d5o/field-issue-escalation/store")
    )
  ) &&
    (
      closeoutAction.includes("assertCanUseLocalBusinessAdapter") ||
      (
        closeoutPersistenceMode.includes("Production Closeout Final Billing requires RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE=database") &&
        closeoutAction.includes("@/lib/d5o/closeout-final-billing/store")
      )
    ) &&
    billingPersistenceMode.includes("Production Billing V2 requires RYBEXOS_BILLING_V2_PERSISTENCE=database") &&
    billingAction.includes("@/lib/d5o/billing-v2/store")
);
check("Service role not imported into client code", !/components[\s\S]*SUPABASE_SERVICE_ROLE_KEY/.test(read("lib/d5o/auth/supabase-server.ts")));
check("Package scripts registered", packageJson.includes("foundation-0a:verify") && packageJson.includes("foundation-0a:qa"));

const failed = checks.filter((item) => !item.ok);

for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`Foundation 0A static verification failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Foundation 0A static verification passed.");
