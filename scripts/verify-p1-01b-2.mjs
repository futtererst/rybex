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

const migrationPath = "supabase/migrations/0016_p1_01b_2_bid_submission_outcome.sql";
const pagePath = "app/pipeline/[opportunityId]/page.tsx";
const actionsPath = "app/actions/opportunities.ts";
const repoPath = "lib/d5o/opportunities/supabase-repository.ts";
const typesPath = "lib/d5o/opportunities/types.ts";
const mapperPath = "lib/d5o/opportunities/database-mapper.ts";
const cssPath = "app/globals.css";
const mappingPath = "docs/product-experience/p1-01b/p1-01b-2/p1-01b-2-implementation-mapping.md";

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

check("P1-01B.2 migration extends opportunities", /alter table opportunities[\s\S]*bid_submission_status/i.test(migration));
check("P1-01B.2 history table exists", /create table if not exists opportunity_bid_submission_events/i.test(migration));
check("P1-01B.2 RPC exists", /record_opportunity_bid_submission_action_v1/i.test(migration));
check("RPC enforces record-scoped submission authority", /p1_01b_2_is_submission_authority/i.test(migration) && /bid_submission_authority_required/i.test(migration));
check("RPC enforces optimistic concurrency", /p_expected_version/i.test(migration) && /concurrency_conflict/i.test(migration));
check("RPC appends audit and domain events", /append_audit_event/i.test(migration) && /append_domain_event/i.test(migration));
check("RLS enabled on P1-01B.2 event table", /alter table opportunity_bid_submission_events enable row level security/i.test(migration));
check("Direct event mutation is blocked", /with check \(false\)/i.test(migration) && /for delete[\s\S]*using \(false\)/i.test(migration));
check("No P1-01B.3/project/mobilization tables are created", !/create table (if not exists )?(awards|award_validation|projects|project_readiness|mobilization|billing|closeout)/i.test(migration));
check("Selected handoff remains handoff-only", /awardValidationStarted', false/i.test(migration) && /handoffOnly/i.test(migration));

check("Server action wrapper exists", /recordOpportunityBidSubmissionAction/i.test(actions));
check("Repository calls bounded RPC", /recordBidSubmissionAction/i.test(repo) && /record_opportunity_bid_submission_action_v1/i.test(repo));
check("Types include bid submission states and actions", /BidSubmissionStatus/i.test(types) && /record_selected_handoff/i.test(types));
check("Mapper includes bid submission read-model fields", /bidSubmissionEvents/i.test(mapper) && /bidSubmissionState/i.test(mapper));

for (const state of [
  "submission-preparation",
  "submission-blocked",
  "ready-for-submission-approval",
  "submission-approval-held",
  "submission-approved-ready-to-send",
  "submitted-pending-outcome",
  "clarification-requested",
  "revision-bafo-required",
  "revised-submission-recorded",
  "lost-not-selected",
  "withdrawn-no-submit",
  "selected-intent-to-award",
  "auditor-read-only",
  "stale-conflict",
  "unavailable",
  "action-failure"
]) {
  check(`UI represents ${state}`, page.includes(state));
}

for (const action of [
  "mark_package_ready",
  "request_missing_evidence",
  "approve_submission",
  "hold_submission_approval",
  "record_submission",
  "record_clarification_request",
  "record_revision_bafo_request",
  "record_revised_submission",
  "record_lost_not_selected",
  "record_withdrawn_no_submit",
  "record_selected_handoff"
]) {
  check(`Action represented ${action}`, page.includes(action) && migration.includes(action));
}

check("UI states bid submission business questions", /What exactly will be submitted, who approves it/.test(page));
check("Selected handoff copy says award validation has not started", /Award validation has not started/.test(page));
check("Lost and withdrawn/no-submit are terminal", /Lost is terminal/.test(page) && /Withdrawn is terminal/.test(page));
check("Scoped bid submission CSS exists", /\.bid-submission-workbench/.test(css));
check("User-facing page avoids internal labels", !/P1-01B\.2|P1-01B\.3/.test(page));
check("Recommended next keeps demo No-Go", /Demo readiness remains No-Go/i.test(recommended));
check("Recommended next keeps production No-Go", /Production readiness remains No-Go/i.test(recommended));

const failed = checks.filter((item) => !item.passed);
for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`P1-01B.2 verification failed ${failed.length} check(s).`);
  process.exit(1);
}

console.log("P1-01B.2 static verification passed.");
