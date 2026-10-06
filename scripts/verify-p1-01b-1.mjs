import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function check(name, condition, detail = "") {
  checks.push({ name, passed: Boolean(condition), detail });
}

const migrationPath = "supabase/migrations/0015_p1_01b_1_pursuit_authorization.sql";
const pagePath = "app/pipeline/[opportunityId]/page.tsx";
const actionsPath = "app/actions/opportunities.ts";
const repoPath = "lib/d5o/opportunities/supabase-repository.ts";
const typesPath = "lib/d5o/opportunities/types.ts";
const mapperPath = "lib/d5o/opportunities/database-mapper.ts";
const cssPath = "app/globals.css";
const mappingPath = "docs/product-experience/p1-01b/p1-01b-1/p1-01b-1-implementation-mapping.md";

for (const path of [migrationPath, pagePath, actionsPath, repoPath, typesPath, mapperPath, cssPath, mappingPath]) {
  check(`${path} exists`, existsSync(join(root, path)));
}

const migration = read(migrationPath);
const page = read(pagePath);
const actions = read(actionsPath);
const repo = read(repoPath);
const types = read(typesPath);
const mapper = read(mapperPath);
const css = read(cssPath);
const recommended = read("docs/recommended-next-implementation.md");

check("P1-01B.1 migration extends opportunities", /alter table opportunities[\s\S]*pursuit_authorization_status/i.test(migration));
check("P1-01B.1 history table exists", /create table if not exists opportunity_pursuit_authorization_events/i.test(migration));
check("P1-01B.1 RPC exists", /record_opportunity_pursuit_authorization_v1/i.test(migration));
check("RPC enforces assigned pursuit authority", /p1_01b_1_is_pursuit_authority/i.test(migration) && /pursuit_authority_required/i.test(migration));
check("RPC enforces optimistic concurrency", /p_expected_version/i.test(migration) && /concurrency_conflict/i.test(migration));
check("RPC appends audit and domain events", /append_audit_event/i.test(migration) && /append_domain_event/i.test(migration));
check("RLS enabled on P1-01B.1 event table", /alter table opportunity_pursuit_authorization_events enable row level security/i.test(migration));
check("Direct event mutation is blocked", /with check \(false\)/i.test(migration) && /for delete[\s\S]*using \(false\)/i.test(migration));
check("No bid/award/project tables are created", !/create table (if not exists )?(bids|bid_submissions|awards|projects|work_packages)/i.test(migration));
check("No P1-01B.2/P1-01B.3 transition is created", !/bid_submitted|award_ready|project_ready|mobilization_ready/i.test(migration));

check("Server action wrapper exists", /recordOpportunityPursuitAuthorizationAction/i.test(actions));
check("Repository calls bounded RPC", /recordPursuitAuthorization/i.test(repo) && /record_opportunity_pursuit_authorization_v1/i.test(repo));
check("Types include pursuit authorization status and actions", /PursuitAuthorizationStatus/i.test(types) && /approve_pursuit/i.test(types) && /hold_pending_evidence/i.test(types) && /decline_pursuit/i.test(types));
check("Mapper includes pursuit read-model fields", /pursuitAuthorizationEvents/i.test(mapper) && /pursuitAuthorizationRecommendation/i.test(mapper));

for (const state of [
  "decision-ready",
  "hold-pending-evidence",
  "decline-recommended",
  "authorized-outcome",
  "hold-outcome",
  "declined-outcome",
  "auditor-read-only",
  "stale-conflict",
  "unavailable",
  "loading",
  "empty",
  "action-failure"
]) {
  check(`UI represents ${state}`, page.includes(state));
}

check("UI states the business question", page.includes("Should Rybex pursue this qualified opportunity now?"));
check("UI states no bid/award/project scope", /No bid submission, award, project conversion, mobilization, field execution, billing, or closeout action/.test(page));
check("Scoped pursuit CSS exists", /\.pursuit-auth-workbench/.test(css) && /\.pursuit-action-panel/.test(css));
check("Recommended next keeps demo No-Go", /Demo readiness remains No-Go/i.test(recommended));
check("Recommended next keeps production No-Go", /Production readiness remains No-Go/i.test(recommended));

const failed = checks.filter((item) => !item.passed);
for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`P1-01B.1 verification failed ${failed.length} check(s).`);
  process.exit(1);
}

console.log("P1-01B.1 static verification passed.");
