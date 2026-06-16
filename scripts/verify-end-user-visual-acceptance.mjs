import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const reviewPath = path.join(root, "docs/end-user-visual-acceptance-review.md");
const backlogPath = path.join(root, "docs/end-user-subtraction-backlog.md");

const majorPages = [
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

function readRequired(filePath, label) {
  if (!existsSync(filePath)) {
    failures.push(`Missing ${label}.`);
    return "";
  }
  return readFileSync(filePath, "utf8");
}

const review = readRequired(reviewPath, "visual acceptance review");
const backlog = readRequired(backlogPath, "subtraction backlog");

for (const page of majorPages) {
  if (!review.includes(page)) {
    failures.push(`Visual acceptance review missing page: ${page}`);
  }
}

const scoreMatches = review.match(/Visual simplicity score:\s*[1-5]\/5/gi) ?? [];
if (scoreMatches.length < majorPages.length) {
  failures.push("Every major page must include a visual simplicity score.");
}

const primaryMatches = review.match(/Primary action clarity:\s*(pass|fail)/gi) ?? [];
if (primaryMatches.length < majorPages.length) {
  failures.push("Every major page must include primary action pass/fail.");
}

for (const phrase of [
  "Must Remove/Collapse Before Pilot",
  "Should Simplify Before Executive Demo",
  "Later"
]) {
  if (!backlog.includes(phrase)) {
    failures.push(`Subtraction backlog missing category: ${phrase}`);
  }
}

const mustSection = backlog.split("## Should Simplify Before Executive Demo")[0] ?? "";
if (!mustSection.includes("Completed") && !mustSection.includes("Deferred")) {
  failures.push("Must remove/collapse items must be marked completed or explicitly deferred.");
}

for (const forbidden of ["new product module", "new persistence", "enable RLS", "production-ready"]) {
  if (review.toLowerCase().includes(`added ${forbidden}`)) {
    failures.push(`Review appears to claim new product scope: ${forbidden}`);
  }
}

const docs = [
  "docs/end-user-simplification-pass.md",
  "docs/page-simplification-system.md",
  "docs/page-comprehension-qa-review.md",
  "docs/page-remediation-backlog.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/developer-notes.md"
];

for (const doc of docs) {
  const content = readRequired(path.join(root, doc), doc);
  if (content && !/visual acceptance|subtraction|action workspace/i.test(content)) {
    failures.push(`${doc} does not reference the end-user visual acceptance/subtraction pass.`);
  }
}

if (failures.length > 0) {
  console.error("End-user visual acceptance verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("End-user visual acceptance verification passed.");
