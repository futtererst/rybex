import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const pages = [
  "app/billing/page.tsx",
  "app/closeout/page.tsx",
  "app/reports/page.tsx"
];

for (const page of pages) {
  const absolute = resolve(root, page);
  if (!existsSync(absolute)) {
    failures.push(`Missing page: ${page}`);
    continue;
  }

  const source = readFileSync(absolute, "utf8");
  if (!source.includes("PageOperatingLayout") && !source.includes("ActionWorkspaceLayout")) {
    failures.push(`${page} must retain the simplified operating summary or action workspace.`);
  }
  if (!source.includes("ProgressiveDetailsSection") && !source.includes("CollapsedDetails")) {
    failures.push(`${page} must move dense records into progressive disclosure.`);
  }
  if (!source.includes("detail-contained")) {
    failures.push(`${page} must contain dense/wide dashboard content.`);
  }
}

const cssFile = resolve(root, "app/globals.css");
if (existsSync(cssFile)) {
  const css = readFileSync(cssFile, "utf8");
  for (const selector of [".detail-contained", ".detail-metrics-grid", ".progressive-details-body"]) {
    if (!css.includes(selector)) {
      failures.push(`Missing overflow/detail containment CSS: ${selector}`);
    }
  }
}

const backlogFile = resolve(root, "docs/page-remediation-backlog.md");
if (existsSync(backlogFile)) {
  const backlog = readFileSync(backlogFile, "utf8");
  for (const phrase of ["Status: Completed", "Completed:", "Partially deferred", "Must Fix Before Pilot", "Should Fix Before Executive Demo", "Later"]) {
    if (!backlog.includes(phrase)) {
      failures.push(`Remediation backlog missing status/category phrase: ${phrase}`);
    }
  }
} else {
  failures.push("Missing docs/page-remediation-backlog.md");
}

const reviewFile = resolve(root, "docs/page-comprehension-qa-review.md");
if (existsSync(reviewFile)) {
  const review = readFileSync(reviewFile, "utf8");
  for (const phrase of ["Pass after pilot remediation", "Billing", "Closeout", "Optimize", "progressive details", "overflow containment"]) {
    if (!review.includes(phrase)) {
      failures.push(`Comprehension review missing remediation phrase: ${phrase}`);
    }
  }
} else {
  failures.push("Missing docs/page-comprehension-qa-review.md");
}

if (failures.length > 0) {
  console.error("Page remediation verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Page remediation verification passed.");
