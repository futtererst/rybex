import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf8");
}

function check(name, ok, detail = "") {
  checks.push({ name, status: ok ? "pass" : "fail", detail });
}

const migrationPath = "supabase/migrations/0011_p1_01a_opportunity_intake_qualification.sql";
const remediationMigrationPath = "supabase/migrations/0012_p1_01a_acceptance_remediation.sql";
const roleMigrationPath = "supabase/migrations/0013_p1_01a_role_accountability_read_model.sql";
const decisionActionMigrationPath = "supabase/migrations/0014_p1_01a_decision_owner_actions.sql";
const migration = `${read(migrationPath)}\n${read(remediationMigrationPath)}\n${read(roleMigrationPath)}\n${read(decisionActionMigrationPath)}`;
const rbac = read("lib/d5o/rbac.ts");
const roles = read("lib/d5o/auth/roles.ts");
const types = read("lib/d5o/types.ts");
const pipeline = read("app/pipeline/page.tsx");
const newPage = read("app/pipeline/new/page.tsx");
const detailPage = read("app/pipeline/[opportunityId]/page.tsx");
const actions = read("app/actions/opportunities.ts");
const repo = read("lib/d5o/opportunities/supabase-repository.ts");
const bootstrap = read("scripts/bootstrap-foundation-0a-local.mjs");
const packageJson = JSON.parse(read("package.json"));

check("Migration 0011 exists", Boolean(migration), migrationPath);
check("Migration 0012 remediation exists", Boolean(read(remediationMigrationPath)), remediationMigrationPath);
check("Migration 0013 role/accountability exists", Boolean(read(roleMigrationPath)), roleMigrationPath);
check("Migration 0014 decision actions exists", Boolean(read(decisionActionMigrationPath)), decisionActionMigrationPath);
check("Migration extends existing opportunities table", /alter table opportunities/i.test(migration), "No parallel opportunity root should be created.");
check("Migration does not create projects root", !/create table (if not exists )?projects/i.test(migration), "P1-01A must not create or alter project root beyond existing boundary.");
check("Lifecycle states limited to P1-01A", /draft','qualifying','decision_required/.test(migration) && !/awarded|converted|bid_submitted/.test(migration), "Only draft, qualifying, decision_required are allowed.");
check("Assignment table includes estimator assignment type", /opportunity_assignments/.test(migration) && /estimator/.test(migration), "Estimator must be assignment-scoped.");
check("Qualification table includes all required criteria", [
  "strategic_fit",
  "customer_relationship",
  "geography_fit",
  "project_type_fit",
  "scope_clarity",
  "design_maturity",
  "commercial_terms_risk",
  "schedule_feasibility",
  "crew_capacity_fit",
  "material_lead_time_risk",
  "permits_access_risk",
  "safety_quality_complexity",
  "subcontractor_dependency",
  "cash_flow_risk",
  "margin_confidence",
  "contractual_risk"
].every((column) => migration.includes(column)), "All 16 criteria must be explicit columns.");
check("Required RPC commands exist", [
  "create_opportunity_v1",
  "update_opportunity_v1",
  "manage_opportunity_assignment_v1",
  "save_opportunity_qualification_v1",
  "submit_opportunity_for_decision_v1"
].every((fn) => migration.includes(fn)), "Missing one or more approved P1-01A commands.");
check("RLS enabled on P1-01A tables", [
  "alter table opportunities enable row level security",
  "alter table opportunity_assignments enable row level security",
  "alter table opportunity_qualifications enable row level security"
].every((needle) => migration.toLowerCase().includes(needle)), "RLS must be enabled.");
check("No broad authenticated USING true policies", !/to authenticated[\s\S]{0,180}using\s*\(\s*true\s*\)/i.test(migration), "Authenticated business access must not use USING true.");
check("Business development lead is canonical role", /business_development_lead/.test(rbac) && /business_development_lead/.test(roles) && /business_development_lead/.test(types), "Role is missing from canonical model.");
check("Estimator is not a workspace role", !/\"estimator\"/.test(roles) && !/estimator:\s*\"project_manager\"/.test(roles), "Estimator must remain assignment-scoped.");
check("Opportunity permissions are centralized", [
  "opportunity.view",
  "opportunity.create",
  "opportunity.qualify",
  "opportunity.submit_decision",
  "opportunity.assignment_manage"
].every((permission) => rbac.includes(permission)), "Missing opportunity permission map.");
check("Only approved Pipeline routes are implemented", existsSync(join(root, "app/pipeline/page.tsx")) && existsSync(join(root, "app/pipeline/new/page.tsx")) && existsSync(join(root, "app/pipeline/[opportunityId]/page.tsx")) && !existsSync(join(root, "app/pipeline/decision")) && !existsSync(join(root, "app/pipeline/award")), "Unexpected P1 routes.");
check("Pipeline page no longer imports seed opportunities", !/seed-data|OpportunityTable|OpportunityCard|go-no-go/i.test(pipeline), "Pipeline must not render the old seed-backed dashboard.");
check("New page uses approved intake command", /createOpportunityAction/.test(newPage) && /Create opportunity/.test(newPage), "Intake page must create only opportunity intake.");
check("Detail page handles qualification and decision readiness", /Decision package/.test(detailPage) && /Submit to/.test(detailPage) && !/P1-01B/.test(detailPage), "Detail page must render the decision package without internal milestone copy.");
check("Server actions use approved repository commands", /createOpportunity/.test(actions) && /saveQualification/.test(actions) && /submitForDecision/.test(actions), "Server actions missing.");
check("Repository uses Supabase RPCs", /rpc\(supabase,\s*\"create_opportunity_v1\"/.test(repo) && /rpc\(supabase,\s*\"save_opportunity_qualification_v1\"/.test(repo), "Repository must call RPC commands.");
check("P1-01A evidence gate is enforced", /p1_01a_valid_qualification_evidence/.test(migration) && /attach_opportunity_decision_support_evidence_v1/.test(migration), "Decision-support evidence remediation is missing.");
check("Decision Owner actions are persisted server-side", /record_opportunity_decision_action_v1/.test(migration) && /reason_required/.test(migration) && /opportunity\.decision_action_recorded/.test(migration), "Decision actions must not be inert UI controls.");
check("Production Pipeline remains contained", /getRuntimeMode\(\) !== \"production\"/.test(repo), "P1-01A must not enable production Pipeline runtime.");
check("Bootstrap includes BD lead fixture", /bd-a@foundation0a\.local/.test(bootstrap), "Local test bootstrap needs business development lead.");
check("Package scripts exist", ["p1-01a:verify", "p1-01a:qa-db", "p1-01a:qa-browser", "p1-01a:gate-local"].every((script) => packageJson.scripts?.[script]), "Missing package script.");
check("package-output is not referenced", ![
  migration,
  rbac,
  roles,
  pipeline,
  newPage,
  detailPage,
  actions,
  repo
].join("\n").includes("package-output/rybexos-demo-package"), "Historical package output must be ignored.");

const failed = checks.filter((entry) => entry.status === "fail");
for (const entry of checks) {
  console.log(`${entry.status === "pass" ? "PASS" : "FAIL"} ${entry.name}${entry.detail ? ` - ${entry.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`P1-01A static verification failed ${failed.length} check(s).`);
  process.exit(1);
}

console.log("P1-01A static verification passed.");
