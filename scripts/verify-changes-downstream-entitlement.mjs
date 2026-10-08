import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const page = read("app/changes/page.tsx");
const rendered = bodyOf(page);
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(page.includes("data-qa=\"change-entitlement-hero\""), "Changes must include a change exposure situation hero.");
assert(page.includes("Protect change entitlement"), "Changes hero must use the downstream entitlement title.");
assert(page.includes("This page carries field and RFI impacts into the commercial change path"), "Changes hero must explain the commercial consequence.");
assert(page.includes("chg-field-issue-lake-001"), "Changes must use the persisted field issue change-event id.");
assert(page.includes("CE-FI-001") || page.includes("fieldIssueChange.changeNumber"), "Changes must surface the field-driven change event number when present.");
assert(page.includes("rfi-field-issue-lake-001"), "Changes must inspect the linked field-driven RFI id.");
assert(page.includes("fieldIssueRfi.rfiNumber"), "Changes must show linked RFI context when RFI-FI-001 exists.");
assert(page.includes("Source field issue"), "Featured change card must show source field issue context.");
assert(page.includes("Linked RFI"), "Featured change card must show linked RFI context.");
assert(page.includes("Direct change path"), "Changes must identify a direct change path when no RFI is linked.");
assert(page.includes("Estimated impact"), "Featured change card must show estimated impact.");
assert(page.includes("Notice"), "Featured change card must show notice context.");
assert(page.includes("Backup"), "Featured change card must show backup context.");
assert(page.includes("Next owner action"), "Featured change card must show next owner action.");
assert(page.includes("Review change exposure"), "Featured change card must provide clear action language.");
assert(page.includes("Build change backup"), "Featured change card must provide backup action language.");
assert(page.includes("View source field issue"), "Featured change card must link back to Field Execution.");
assert(page.includes("View linked RFI"), "Featured change card must link to RFIs/Submittals when linked RFI exists.");
assert(page.includes("data-qa=\"change-source-entitlement-trace\""), "Changes must include a source-to-entitlement trace.");
assert(!page.includes("No linked RFI"), "Changes must not show the trust-breaking 'No linked RFI' message in created change state.");
assert(!page.includes("?? \"RFI review\""), "Changes trace must not imply RFI review when no RFI is linked.");
assert(page.includes("No field-driven change event has been created yet."), "Changes must provide a useful no-change-event state.");
assert(page.includes("Review the linked RFI"), "Empty state must guide the user through linked RFI exposure review.");
assert(page.includes("Supporting change records"), "Supporting change registers must be clearly labeled.");

assert(before(rendered, "change-entitlement-hero", "downstream-change-record"), "Situation hero must appear before the featured change exposure.");
assert(before(rendered, "change-entitlement-hero", "change-empty-state"), "Situation hero must appear before the empty change state.");
assert(before(rendered, "downstream-change-record", "change-source-entitlement-trace"), "Featured change exposure must appear before the source trace.");
assert(before(rendered, "change-empty-state", "CollapsedDetails"), "Empty state must appear before supporting change records.");
assert(before(rendered, "change-source-entitlement-trace", "CollapsedDetails"), "Source trace must appear before supporting change records.");
assert(before(rendered, "CollapsedDetails", "ChangeControlDashboard"), "Generic change dashboard must stay inside supporting details.");

for (const className of [
  ".change-entitlement-hero",
  ".change-entitlement-facts",
  ".featured-change-card",
  ".featured-change-next",
  ".source-record-trace"
]) {
  assert(css.includes(className), `CSS must include ${className}.`);
}

for (const term of [
  "slice",
  "canonical",
  "overlay",
  "local store",
  "adapter",
  "registry",
  "persisted",
  "seed",
  "QA",
  "workflow engine"
]) {
  assert(!visibleText(page).includes(term), `Changes should not show internal architecture language: ${term}.`);
}

assert(packageJson.scripts?.["changes:verify-downstream"], "package.json must expose changes:verify-downstream.");
assert(packageJson.scripts?.["rfis-submittals:verify-downstream"], "RFIs/Submittals downstream verifier must remain available.");
assert(packageJson.scripts?.["field-issue:qa"], "Field Issue browser QA command must remain available.");

if (failures.length > 0) {
  console.error("Changes downstream entitlement verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Changes downstream entitlement checks passed.");
console.log(JSON.stringify({
  page: "/changes",
  featuredExposure: "CE-FI-001 when created",
  linkedRfi: "RFI-FI-001 when created",
  source: "Field Issue Escalation",
  supportingRecords: "below featured downstream exposure",
  humanReviewStillRequired: true
}, null, 2));

function read(filePath) {
  const fullPath = join(root, filePath);
  assert(existsSync(fullPath), `${filePath} must exist.`);
  return readFileSync(fullPath, "utf8");
}

function before(content, first, second) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function bodyOf(content) {
  const bodyStart = content.indexOf("return (");
  return bodyStart >= 0 ? content.slice(bodyStart) : content;
}

function visibleText(content) {
  return content
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => !/from\s+["']/.test(line))
    .filter((line) => !/className=/.test(line))
    .filter((line) => !/data-qa=/.test(line))
    .filter((line) => !/getFieldIssueSeedDataOverlay/.test(line))
    .join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
