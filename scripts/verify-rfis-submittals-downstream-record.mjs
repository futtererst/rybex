import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const page = read("app/rfis-submittals/page.tsx");
const rendered = bodyOf(page);
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(page.includes("data-qa=\"rfi-situation-hero\""), "RFIs/Submittals must include an RFI situation hero.");
assert(page.includes("Manage field-driven RFI"), "RFIs/Submittals hero must use the field-driven RFI title.");
assert(page.includes("fieldIssueRfi.rfiNumber"), "RFIs/Submittals must surface the RFI number from the Field Issue overlay.");
assert(page.includes("rfi-field-issue-lake-001"), "RFIs/Submittals must use the persisted field issue RFI id.");
assert(page.includes("Field Issue Escalation"), "RFIs/Submittals must show source field issue context.");
assert(page.includes("source field issue"), "Featured RFI card must name the source field issue.");
assert(page.includes("rfiImpactLabel"), "RFIs/Submittals must show business impact from the RFI record.");
assert(page.includes("Next owner action"), "Featured RFI must show next owner action.");
assert(page.includes("Review RFI status"), "Featured RFI must provide a clear status action.");
assert(page.includes("View source field issue"), "Featured RFI must link back to Field Execution.");
assert(page.includes("Check change exposure"), "Featured RFI must link to Changes when exposure exists.");
assert(page.includes("data-qa=\"rfi-source-record-trace\""), "RFIs/Submittals must include a source-to-record trace.");
assert(page.includes("No field-driven RFI has been created yet."), "RFIs/Submittals must provide a useful no-RFI state.");
assert(page.includes("Escalate field issue"), "No-RFI state must route the user back to Field Execution.");
assert(page.includes("Supporting RFI and submittal details"), "Supporting registers must be clearly labeled.");

assert(before(rendered, "rfi-situation-hero", "downstream-rfi-record"), "Situation hero must appear before the featured RFI.");
assert(before(rendered, "downstream-rfi-record", "rfi-source-record-trace"), "Featured RFI must appear before the source trace.");
assert(before(rendered, "rfi-source-record-trace", "CollapsedDetails"), "Source trace must appear before supporting registers.");
assert(before(rendered, "downstream-rfi-record", "CollapsedDetails"), "Featured RFI must appear before supporting registers.");
assert(before(rendered, "CollapsedDetails", "RfiSubmittalDashboard"), "Generic RFI/Submittal dashboard must stay inside supporting details.");
assert(before(rendered, "CollapsedDetails", "RfiSubmittalDashboard"), "Generic RFI/Submittal content must stay below the downstream RFI journey.");

for (const className of [
  ".rfi-situation-hero",
  ".featured-rfi-card",
  ".featured-rfi-next",
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
  assert(!visibleText(page).includes(term), `RFIs/Submittals should not show internal architecture language: ${term}.`);
}

assert(packageJson.scripts?.["rfis-submittals:verify-downstream"], "package.json must expose rfis-submittals:verify-downstream.");
assert(packageJson.scripts?.["field-issue:qa"], "Field Issue browser QA command must remain available.");

if (failures.length > 0) {
  console.error("RFIs/Submittals downstream record verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RFIs/Submittals downstream record checks passed.");
console.log(JSON.stringify({
  page: "/rfis-submittals",
  featuredRecord: "RFI-FI-001",
  source: "Field Issue Escalation",
  supportingRegisters: "below featured downstream record",
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
    .filter((line) => !/\.slice\(/.test(line))
    .join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
