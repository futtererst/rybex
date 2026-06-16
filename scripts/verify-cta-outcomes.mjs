import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const reportPath = resolve(root, "docs/cta-outcome-clarity-qa-report.md");
const backlogPath = resolve(root, "docs/cta-outcome-remediation-backlog.md");

const priorityRoutes = [
  "/command-center",
  "/billing",
  "/closeout",
  "/field-execution",
  "/changes",
  "/rfis-submittals",
  "/pipeline",
  "/projects",
  "/mobilization",
  "/safety",
  "/quality",
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

const report = readRequired(reportPath, "CTA outcome clarity QA report");
const backlog = readRequired(backlogPath, "CTA outcome remediation backlog");

for (const route of priorityRoutes) {
  if (!report.includes(`Route: \`${route}\``)) {
    failures.push(`CTA outcome report missing route: ${route}`);
  }
}

const primaryRows = report
  .split("\n")
  .filter((line) => line.startsWith("|") && line.includes("| yes |"));

if (primaryRows.length < priorityRoutes.length - 1) {
  failures.push("Every major cockpit route must include a primary cockpit CTA outcome clarity score.");
}

const scoreMatches = report.match(/\| [1-5]\/5 \|/g) ?? [];
if (scoreMatches.length < priorityRoutes.length) {
  failures.push("CTA outcome report must include clarity scores.");
}

for (const category of ["Must Fix Before Founder Review", "Should Fix Before Executive Demo", "Later"]) {
  if (!backlog.includes(category)) {
    failures.push(`CTA outcome backlog missing category: ${category}`);
  }
}

const mustSection = backlog.split("## Should Fix Before Executive Demo")[0] ?? "";
if (mustSection.includes("| Open |") && !mustSection.includes("Deferred")) {
  failures.push("Must Fix CTA outcome items remain open without documented reason.");
}

for (const doc of [
  "docs/user-workflow-qa-report.md",
  "docs/user-workflow-remediation-backlog.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/developer-notes.md"
]) {
  const content = readRequired(resolve(root, doc), doc);
  if (content && !/CTA outcome|outcome clarity|highlight/i.test(content)) {
    failures.push(`${doc} does not mention CTA outcome clarity QA.`);
  }
}

if (failures.length > 0) {
  console.error("CTA outcome verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("CTA outcome verification passed.");
