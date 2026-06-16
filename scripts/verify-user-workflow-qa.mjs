import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const reportPath = resolve(root, "docs/user-workflow-qa-report.md");
const backlogPath = resolve(root, "docs/user-workflow-remediation-backlog.md");

const scenarios = [
  "Executive priority review",
  "Pipeline go/no-go decision",
  "Project baseline clearance",
  "Mobilization field-start blocker",
  "Field execution daily report / issue escalation",
  "RFI/Submittal blocker",
  "Change recovery protection",
  "Billing cash blocker",
  "Safety action closure",
  "Quality deficiency/test blocker",
  "Closeout acceptance blocker",
  "Optimize learning loop",
  "Admin readiness review"
];

const pages = [
  "/command-center",
  "/pipeline",
  "/projects",
  "/mobilization",
  "/field-execution",
  "/rfis-submittals",
  "/changes",
  "/billing",
  "/safety",
  "/quality",
  "/closeout",
  "/reports",
  "/admin"
];

function readRequired(path, label) {
  if (!existsSync(path)) {
    failures.push(`Missing ${label}.`);
    return "";
  }
  return readFileSync(path, "utf8");
}

const report = readRequired(reportPath, "user workflow QA report");
const backlog = readRequired(backlogPath, "user workflow remediation backlog");

for (const scenario of scenarios) {
  if (!report.includes(scenario)) {
    failures.push(`QA report missing scenario: ${scenario}`);
  }
}

for (const page of pages) {
  if (!report.includes(`Route: \`${page}\``)) {
    failures.push(`QA report missing page route: ${page}`);
  }
}

for (const category of ["Must Fix Before Usability Review", "Should Fix Before Executive Demo", "Later"]) {
  if (!backlog.includes(category)) {
    failures.push(`Remediation backlog missing category: ${category}`);
  }
}

const reportFailRows = report
  .split("\n")
  .filter((line) => line.startsWith("|") && line.includes("| Fail |"));

for (const row of reportFailRows) {
  const label = row.split("|")[1]?.trim();
  if (label && label !== "No safe CTAs detected" && !backlog.includes(label)) {
    failures.push(`Failed CTA is missing from remediation backlog: ${label}`);
  }
}

const mustSection = backlog.split("## Should Fix Before Executive Demo")[0] ?? "";
const openMustItems = mustSection
  .split("\n")
  .filter((line) => line.startsWith("|") && line.includes("| Open |"));

if (openMustItems.length > 0) {
  failures.push("Must Fix category still has open same-page/no-change CTA failures.");
}

for (const doc of [
  "docs/developer-notes.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/end-user-visual-acceptance-review.md"
]) {
  const content = readRequired(resolve(root, doc), doc);
  if (content && !/user workflow QA|CTA|dead-end/i.test(content)) {
    failures.push(`${doc} does not mention user workflow QA / CTA review.`);
  }
}

if (failures.length > 0) {
  console.error("User workflow QA verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("User workflow QA verification passed.");
