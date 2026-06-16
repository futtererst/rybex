import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const files = {
  readiness: join(root, "docs", "billing-v2-implementation-readiness-review.md"),
  buildPlan: join(root, "docs", "billing-v2-implementation-build-plan.md"),
  dataMapping: join(root, "docs", "billing-v2-data-model-mapping.md"),
  qaPlan: join(root, "docs", "billing-v2-qa-acceptance-plan.md"),
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

const readiness = readRequired("Billing v2 implementation readiness review", files.readiness);
const buildPlan = readRequired("Billing v2 implementation build plan", files.buildPlan);
const dataMapping = readRequired("Billing v2 data model mapping", files.dataMapping);
const qaPlan = readRequired("Billing v2 QA acceptance plan", files.qaPlan);
const developerNotes = readRequired("Developer notes", files.developerNotes);
const demoReadiness = readRequired("Demo readiness", files.demoReadiness);
const pilotPlan = readRequired("Controlled pilot launch plan", files.pilotPlan);
const readme = readRequired("README", files.readme);
const packageJson = readRequired("package.json", files.packageJson);

const readinessSections = [
  "## 1. Executive Summary",
  "## 2. Business-Process Clarity Review",
  "## 3. Business Object Completeness Review",
  "## 4. State Lifecycle Review",
  "## 5. Evidence/Document Readiness Review",
  "## 6. Commercial Review Readiness Review",
  "## 7. UX Readiness Review",
  "## 8. Copy/Readability Review",
  "## 9. QA Readiness Review",
  "## 10. Implementation Risk Review",
  "## 11. Go/No-Go Recommendation"
];

for (const section of readinessSections) {
  if (!readiness.includes(section)) {
    fail(`Readiness review missing section: ${section}`);
  }
}

if (!/(Ready to implement|Ready with conditions|Not ready)/.test(readiness)) {
  fail("Readiness review must include a go/no-go recommendation.");
}

for (const phrase of [
  "Business problem",
  "BillingBackupPackage",
  "commercial_review_pending",
  "Evidence",
  "Commercial review",
  "Outcome Record",
  "Historical Record",
  "Ready with conditions",
  "No Billing v2 implementation occurred"
]) {
  if (!readiness.includes(phrase)) {
    fail(`Readiness review missing required phrase: ${phrase}`);
  }
}

for (const section of [
  "## 1. Build Objective",
  "## 2. Implementation Phases",
  "### Phase 1",
  "### Phase 2",
  "### Phase 3",
  "### Phase 4",
  "### Phase 5",
  "## 3. Files Likely To Change",
  "## 4. Non-Goals"
]) {
  if (!buildPlan.includes(section)) {
    fail(`Build plan missing phased implementation section: ${section}`);
  }
}

const conceptualObjects = [
  "BillingBackupPackage",
  "BillingEvidenceRequirement",
  "BillingEvidenceReference",
  "BillingReviewTask",
  "BillingReviewDecision",
  "BillingBlockerResolution",
  "BillingOutcomeRecord",
  "BillingHistoricalRecord"
];

for (const objectName of conceptualObjects) {
  if (!dataMapping.includes(objectName)) {
    fail(`Data mapping missing conceptual object: ${objectName}`);
  }
}

for (const phrase of [
  "Current Existing Table/Type If Available",
  "Future Table/Type If Needed",
  "Local/Demo Representation",
  "Supabase Pilot Representation",
  "Production Representation",
  "Implementation Recommendation"
]) {
  if (!dataMapping.includes(phrase)) {
    fail(`Data mapping missing required column/phrase: ${phrase}`);
  }
}

for (const phrase of [
  "## Automated QA",
  "## Manual QA",
  "Pay App 003 blocker visible",
  "$84K impact visible",
  "cannot send to review until readiness complete",
  "cannot clear blocker until review approved",
  "approval/request changes/reject paths work",
  "outcome record generated",
  "historical record generated",
  "no hydration/runtime issues",
  "business problem understandable",
  "historical record referenceable"
]) {
  if (!qaPlan.includes(phrase)) {
    fail(`QA acceptance plan missing required phrase: ${phrase}`);
  }
}

const docsToScan = [
  ["readiness review", readiness],
  ["build plan", buildPlan],
  ["data mapping", dataMapping],
  ["QA acceptance plan", qaPlan],
  ["developer-notes", developerNotes],
  ["demo-readiness", demoReadiness],
  ["controlled-pilot-launch-plan", pilotPlan],
  ["README", readme]
];

const requiredDocReferences = [
  "docs/billing-v2-implementation-readiness-review.md",
  "docs/billing-v2-implementation-build-plan.md",
  "docs/billing-v2-data-model-mapping.md",
  "docs/billing-v2-qa-acceptance-plan.md"
];

for (const [label, contents] of docsToScan.slice(4)) {
  for (const docPath of requiredDocReferences) {
    if (!contents.includes(docPath)) {
      fail(`${label} must reference ${docPath}.`);
    }
  }

  if (!/No implementation occurred|no implementation occurred|specification-only|documentation-only/i.test(contents)) {
    fail(`${label} must state no implementation occurred.`);
  }
}

if (!developerNotes.includes("Billing v2 implementation readiness review completed")) {
  fail("Developer notes must reference readiness review completion.");
}

if (!packageJson.includes('"billing-v2:verify-readiness"')) {
  fail("package.json missing billing-v2:verify-readiness script.");
}

const forbiddenImplementationClaims = [
  /\bBilling v2 (?:has been )?implemented\b/i,
  /\bBilling v2 (?:UI|workflow|page|process) is live\b/i,
  /\bBilling v2 is demo ready\b/i,
  /\bBilling v2 is pilot ready\b/i,
  /\bBilling v2 is production ready\b/i,
  /\bBilling v2 has shipped\b/i,
  /\bBilling v2 implementation completed\b/i
];

for (const [label, contents] of docsToScan) {
  for (const pattern of forbiddenImplementationClaims) {
    if (pattern.test(contents)) {
      fail(`${label} appears to claim Billing v2 implementation occurred: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Billing v2 implementation readiness verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Billing v2 implementation readiness verification passed.");
