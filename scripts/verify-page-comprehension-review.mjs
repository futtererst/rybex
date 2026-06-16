import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const reviewFile = resolve(root, "docs/page-comprehension-qa-review.md");
const backlogFile = resolve(root, "docs/page-remediation-backlog.md");

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

const failures = [];

if (!existsSync(reviewFile)) {
  failures.push("Missing docs/page-comprehension-qa-review.md");
}

if (!existsSync(backlogFile)) {
  failures.push("Missing docs/page-remediation-backlog.md");
}

if (existsSync(reviewFile)) {
  const review = readFileSync(reviewFile, "utf8");

  for (const page of pages) {
    const heading = `## ${page}`;
    if (!review.includes(heading)) {
      failures.push(`Review missing page heading: ${heading}`);
      continue;
    }

    const start = review.indexOf(heading);
    const next = review.indexOf("\n## ", start + heading.length);
    const section = review.slice(start, next === -1 ? undefined : next);

    if (!/Five-second clarity score:\s*[1-5]\/5/.test(section)) {
      failures.push(`${page} missing five-second clarity score.`);
    }

    if (!/Pass\/fail statement:\s*(Pass|Fail)/.test(section)) {
      failures.push(`${page} missing explicit pass/fail statement.`);
    }

    for (const phrase of ["What is clear:", "What is confusing:", "Primary action obvious:", "Owner/due/evidence visible:", "Recommended remediation:"]) {
      if (!section.includes(phrase)) {
        failures.push(`${page} missing review field: ${phrase}`);
      }
    }
  }
}

if (existsSync(backlogFile)) {
  const backlog = readFileSync(backlogFile, "utf8");
  for (const category of ["## Must Fix Before Pilot", "## Should Fix Before Executive Demo", "## Later"]) {
    if (!backlog.includes(category)) {
      failures.push(`Backlog missing category: ${category}`);
    }
  }

  for (const field of ["Page", "Issue", "User Impact", "Recommended Fix", "Priority", "Expected Outcome"]) {
    if (!backlog.includes(field)) {
      failures.push(`Backlog missing field: ${field}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Page comprehension review verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Page comprehension review verification passed.");
