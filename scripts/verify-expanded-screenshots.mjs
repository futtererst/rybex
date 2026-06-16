import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const outputFolder = resolve(process.cwd(), "visual-qa-output", "expanded-details");

const expectedFiles = [
  "command-center-expanded.png",
  "pipeline-expanded.png",
  "projects-expanded.png",
  "mobilization-expanded.png",
  "field-execution-expanded.png",
  "rfis-submittals-expanded.png",
  "changes-expanded.png",
  "billing-expanded.png",
  "safety-expanded.png",
  "quality-expanded.png",
  "closeout-expanded.png",
  "reports-expanded.png",
  "admin-expanded.png"
];

const failures = [];

if (!existsSync(outputFolder)) {
  failures.push(`Missing expanded details output folder: ${outputFolder}`);
} else {
  for (const file of expectedFiles) {
    const filePath = join(outputFolder, file);
    if (!existsSync(filePath)) {
      failures.push(`Missing expanded screenshot: ${file}`);
      continue;
    }

    const size = statSync(filePath).size;
    if (size <= 0) {
      failures.push(`Expanded screenshot is empty: ${file}`);
    }
  }
}

const manifestPath = join(outputFolder, "manifest.json");
if (!existsSync(manifestPath)) {
  failures.push("Missing expanded details manifest.json.");
}

if (failures.length > 0) {
  console.error("Expanded screenshot verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Expanded screenshot verification passed.");
