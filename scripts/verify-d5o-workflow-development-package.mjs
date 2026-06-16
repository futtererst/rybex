import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const files = {
  packageDoc: join(root, "docs", "d5o-true-workflow-management-development-package.md"),
  billingSpec: join(root, "docs", "billing-v2-enterprise-workflow-implementation-spec.md"),
  developerNotes: join(root, "docs", "developer-notes.md"),
  demoReadiness: join(root, "docs", "demo-readiness.md"),
  pilotPlan: join(root, "docs", "controlled-pilot-launch-plan.md"),
  readme: join(root, "README.md"),
  packageJson: join(root, "package.json")
};

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

const packageDoc = readRequired("D5O workflow development package", files.packageDoc);
const billingSpec = readRequired("Billing v2 implementation spec", files.billingSpec);
const developerNotes = readRequired("Developer notes", files.developerNotes);
const demoReadiness = readRequired("Demo readiness", files.demoReadiness);
const pilotPlan = readRequired("Controlled pilot launch plan", files.pilotPlan);
const readme = readRequired("README", files.readme);
const packageJson = readRequired("package.json", files.packageJson);

const packageSections = [
  "## 1. Executive Summary",
  "## 2. What D5O Means For RybexOS",
  "## 3. RybexOS Business Purpose",
  "## 4. Definition Of True Workflow Management",
  "## 5. Enterprise Workflow Architecture",
  "## 6. D5O Workflow Catalogue",
  "## 7. System Capabilities Required",
  "## 8. Required Data Model Package",
  "## 9. UX Requirements For True Workflow Management",
  "## 10. Development Roadmap",
  "## 11. Non-Negotiable Rule"
];

for (const section of packageSections) {
  if (!packageDoc.includes(section)) {
    fail(`D5O workflow development package missing section: ${section}`);
  }
}

const packagePhrases = [
  "Business trigger",
  "Business process",
  "Business object",
  "Evidence/documents",
  "Review/handoff",
  "Historical record",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "Optimize",
  "workflow_definitions",
  "workflow_instances",
  "review_decisions",
  "Do not build any new workflow unless it satisfies"
];

for (const phrase of packagePhrases) {
  if (!packageDoc.includes(phrase)) {
    fail(`D5O workflow development package missing required phrase: ${phrase}`);
  }
}

const billingSpecSections = [
  "## 1. Executive Summary",
  "## 2. Business Problem",
  "## 3. Business Object Model",
  "## 4. State Lifecycle",
  "## 5. Required User Flow",
  "## 6. Required Fields",
  "## 7. Evidence/Document Requirements",
  "## 8. Package Readiness Rules",
  "## 9. Commercial Review Task",
  "## 10. Review Decision Model",
  "## 11. Blocker Clearance Rules",
  "## 12. Outcome Record",
  "## 13. Historical Record",
  "## 14. Required UI Structure",
  "## 15. Exact User-Facing Copy",
  "## 16. Data And Persistence Strategy",
  "## 17. QA Requirements",
  "## 18. Non-Goals",
  "## 19. Implementation File Map",
  "## 20. Acceptance Criteria"
];

for (const section of billingSpecSections) {
  if (!billingSpec.includes(section)) {
    fail(`Billing v2 implementation spec missing section: ${section}`);
  }
}

const requiredBillingSpecPhrases = [
  "BillingBackupPackage",
  "BillingEvidenceRequirement",
  "BillingEvidenceReference",
  "BillingReviewTask",
  "BillingReviewDecision",
  "BillingBlockerResolution",
  "BillingOutcomeRecord",
  "BillingHistoricalRecord",
  "blocked",
  "commercial_review_pending",
  "commercial_review_approved",
  "billing_blocker_cleared",
  "Signed T&M ticket",
  "Daily report reference",
  "Product approval backup",
  "Commercial reviewer / Finance/Admin",
  "Approve Package",
  "Request Changes",
  "Reject Package",
  "commercial review approved",
  "Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84,000 cash recovery path is no longer blocked by missing backup for this item.",
  "no production pay app submission",
  "no Field/Closeout refactor yet",
  "manual acceptance passes"
];

for (const phrase of requiredBillingSpecPhrases) {
  if (!billingSpec.includes(phrase)) {
    fail(`Billing v2 implementation spec missing required phrase: ${phrase}`);
  }
}

const specOnlyPatterns = [
  /specification only/i,
  /does not implement/i,
  /No Billing v2 implementation has occurred/i,
  /No implementation occurred/i,
  /manual review .* before code/i
];

if (!specOnlyPatterns[0].test(packageDoc) || !specOnlyPatterns[1].test(packageDoc)) {
  fail("D5O workflow development package must state it is specification only and does not implement behavior.");
}

if (!specOnlyPatterns[0].test(billingSpec) || !specOnlyPatterns[1].test(billingSpec)) {
  fail("Billing v2 implementation spec must state it is specification only and does not implement behavior.");
}

const docsToScan = [
  ["developer-notes", developerNotes],
  ["demo-readiness", demoReadiness],
  ["controlled-pilot-launch-plan", pilotPlan],
  ["README", readme]
];

for (const [label, contents] of docsToScan) {
  for (const path of [
    "docs/d5o-true-workflow-management-development-package.md",
    "docs/billing-v2-enterprise-workflow-implementation-spec.md"
  ]) {
    if (!contents.includes(path)) {
      fail(`${label} must reference ${path}.`);
    }
  }

  if (!/No implementation occurred|no implementation occurred|specification only/i.test(contents)) {
    fail(`${label} must state this is specification only and no implementation occurred.`);
  }

  if (!/manual review .* before code|manual review .* before code is written|review .* before code/i.test(contents)) {
    fail(`${label} must state manual review is the next step before code.`);
  }
}

if (!developerNotes.includes("D5O True Workflow Management Development Package")) {
  fail("Developer notes must name the D5O True Workflow Management Development Package.");
}

if (!developerNotes.includes("Billing v2 Enterprise Workflow Implementation Specification")) {
  fail("Developer notes must name the Billing v2 Enterprise Workflow Implementation Specification.");
}

if (!packageJson.includes('"d5o-workflow-package:verify"')) {
  fail("package.json missing d5o-workflow-package:verify script.");
}

const forbiddenImplementationClaims = [
  /\bBilling v2 (?:has been )?implemented\b/i,
  /\bBilling v2 (?:UI|workflow|page|process) is live\b/i,
  /\bBilling v2 is ready\b/i,
  /\bBilling v2 is demo ready\b/i,
  /\bBilling v2 is pilot ready\b/i,
  /\bBilling v2 has shipped\b/i,
  /\bD5O true workflow package has been implemented\b/i
];

for (const [label, contents] of [
  ["D5O workflow development package", packageDoc],
  ["Billing v2 implementation spec", billingSpec],
  ...docsToScan
]) {
  for (const pattern of forbiddenImplementationClaims) {
    if (pattern.test(contents)) {
      fail(`${label} appears to claim implementation occurred: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("D5O workflow development package verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("D5O workflow development package verification passed.");
