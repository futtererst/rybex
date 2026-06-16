import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = {
  blueprint: join(root, "docs", "billing-v2-gold-standard-workflow-blueprint.md"),
  developerNotes: join(root, "docs", "developer-notes.md"),
  demoReadiness: join(root, "docs", "demo-readiness.md"),
  pilotPlan: join(root, "docs", "controlled-pilot-launch-plan.md"),
};

const failures = [];

function fail(message) {
  failures.push(message);
}

function readRequired(label, filePath) {
  if (!existsSync(filePath)) {
    fail(`${label} is missing: ${filePath}`);
    return "";
  }

  return readFileSync(filePath, "utf8");
}

const blueprint = readRequired("Billing v2 blueprint", requiredFiles.blueprint);
const developerNotes = readRequired("Developer notes", requiredFiles.developerNotes);
const demoReadiness = readRequired("Demo readiness", requiredFiles.demoReadiness);
const pilotPlan = readRequired("Controlled pilot launch plan", requiredFiles.pilotPlan);

const requiredSections = [
  "## 1. Executive Summary",
  "## 2. Business Context",
  "## 3. Current-State Problem",
  "## 4. Future-State Workflow Promise",
  "## 5. Business Object Definition",
  "## 6. Workflow Stages",
  "## 7. Required Editable Fields",
  "## 8. Evidence And Document Handling",
  "## 9. Handoff Model",
  "## 10. Business Outcome Model",
  "## 11. Historical Record Model",
  "## 12. Required UI Structure",
  "## 13. Exact User-Facing Copy",
  "## 14. Acceptance Criteria",
  "## 15. Non-Goals",
  "## 16. Build Sequence Recommendation",
];

for (const section of requiredSections) {
  if (!blueprint.includes(section)) {
    fail(`Blueprint is missing required section: ${section}`);
  }
}

const requiredStageLabels = [
  "### A. Understand The Billing Blocker",
  "### B. Document Backup Support",
  "### C. Reference Evidence/Documents",
  "### D. Confirm Backup Readiness",
  "### E. Send To Commercial Review",
  "### F. Clear Billing Blocker",
  "### G. Review Outcome And Historical Record",
];

for (const stage of requiredStageLabels) {
  if (!blueprint.includes(stage)) {
    fail(`Blueprint is missing required workflow stage: ${stage}`);
  }
}

const requiredBlueprintPhrases = [
  "Pay App 003",
  "$84K",
  "Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84K cash recovery path is no longer blocked by missing backup for this item.",
  "This blueprint is documentation only.",
  "No Billing v2 implementation has occurred",
];

for (const phrase of requiredBlueprintPhrases) {
  if (!blueprint.includes(phrase)) {
    fail(`Blueprint is missing required phrase: ${phrase}`);
  }
}

if (!/## 14\. Acceptance Criteria[\s\S]*User understands Pay App 003 is the business object/.test(blueprint)) {
  fail("Acceptance criteria section does not include the Pay App 003 business-object criterion.");
}

if (!/## 15\. Non-Goals[\s\S]*No production pay app submission/.test(blueprint)) {
  fail("Non-goals section does not include the production pay app submission boundary.");
}

if (!developerNotes.includes("docs/billing-v2-gold-standard-workflow-blueprint.md")) {
  fail("Developer notes must reference docs/billing-v2-gold-standard-workflow-blueprint.md.");
}

const docsToScan = [
  ["blueprint", blueprint],
  ["developer-notes", developerNotes],
  ["demo-readiness", demoReadiness],
  ["controlled-pilot-launch-plan", pilotPlan],
];

const forbiddenImplementationClaims = [
  /\bBilling v2 (?:has been )?implemented\b/i,
  /\bBilling v2 (?:UI|workflow|page|process) is live\b/i,
  /\bBilling v2 is ready\b/i,
  /\bBilling v2 is demo ready\b/i,
  /\bBilling v2 is pilot ready\b/i,
  /\bBilling v2 has shipped\b/i,
];

for (const [label, contents] of docsToScan) {
  for (const pattern of forbiddenImplementationClaims) {
    if (pattern.test(contents)) {
      fail(`${label} appears to claim Billing v2 has been implemented: ${pattern}`);
    }
  }
}

for (const [label, contents] of docsToScan.slice(1)) {
  if (!/Billing v2 blueprint/i.test(contents)) {
    fail(`${label} must reference the Billing v2 blueprint.`);
  }

  if (!/no (?:Billing v2 )?implementation has occurred yet|No Billing v2 implementation has occurred/i.test(contents)) {
    fail(`${label} must state that no Billing v2 implementation has occurred yet.`);
  }
}

if (failures.length > 0) {
  console.error("Billing v2 blueprint verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Billing v2 blueprint verification passed.");
