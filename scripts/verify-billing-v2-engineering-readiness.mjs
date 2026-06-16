import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "docs/adr/0001-billing-v2-local-demo-reference-first.md",
  "docs/adr/0002-billing-v2-domain-state-machine.md",
  "docs/adr/0003-billing-v2-commercial-review-simulation.md",
  "docs/adr/0004-billing-v2-evidence-reference-model.md",
  "docs/adr/0005-billing-v2-pilot-integration-boundary.md",
  "docs/billing-v2-state-transition-matrix.md",
  "docs/billing-v2-domain-command-contract.md",
  "docs/billing-v2-ui-wireframe-spec.md",
  "docs/billing-v2-domain-test-plan.md",
  "docs/billing-v2-phase-1a-domain-implementation-prompt.md",
];

const requiredStates = [
  "blocked",
  "backup_package_in_progress",
  "evidence_required",
  "package_ready_for_review",
  "commercial_review_pending",
  "commercial_review_approved",
  "commercial_review_changes_requested",
  "commercial_review_rejected",
  "billing_blocker_cleared",
  "reopened",
];

const requiredCommands = [
  "startBackupPackage",
  "saveBackupSummary",
  "saveRelatedSourceRecord",
  "saveAmountAffected",
  "saveEvidenceReference",
  "waiveEvidenceRequirement",
  "validatePackageReadiness",
  "sendPackageToCommercialReview",
  "approveCommercialReview",
  "requestCommercialReviewChanges",
  "rejectCommercialReview",
  "saveResolutionNote",
  "clearBillingBlocker",
  "reopenBillingBlocker",
];

const requiredTestPlanPhrases = [
  "readiness gating",
  "review approval gating",
  "Evidence Tests",
  "Blocker Clearance Tests",
];

const requiredPromptProhibitions = [
  "Do not implement UI components",
  "Do not change routes",
  "Do not change persistence",
  "Do not change auth",
  "Do not enable RLS",
  "Do not change Pilot Mode behavior",
];

const forbiddenImplementationClaims = [
  /\bBilling v2 has been implemented\b/i,
  /\bBilling v2 is implemented\b/i,
  /\bBilling v2 is production ready\b/i,
  /\bBilling v2 is demo ready\b/i,
  /\bBilling v2 is pilot ready\b/i,
];

const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

if (failures.length === 0) {
  const stateMatrix = read("docs/billing-v2-state-transition-matrix.md");
  for (const state of requiredStates) {
    if (!stateMatrix.includes(state)) {
      failures.push(`State matrix missing state: ${state}`);
    }
  }

  const commandContract = read("docs/billing-v2-domain-command-contract.md");
  for (const command of requiredCommands) {
    if (!commandContract.includes(command)) {
      failures.push(`Command contract missing command: ${command}`);
    }
  }

  const testPlan = read("docs/billing-v2-domain-test-plan.md");
  for (const phrase of requiredTestPlanPhrases) {
    if (!testPlan.includes(phrase)) {
      failures.push(`Domain test plan missing: ${phrase}`);
    }
  }

  const prompt = read("docs/billing-v2-phase-1a-domain-implementation-prompt.md");
  for (const phrase of requiredPromptProhibitions) {
    if (!prompt.includes(phrase)) {
      failures.push(`Phase 1A prompt missing prohibition: ${phrase}`);
    }
  }

  const developerNotes = read("docs/developer-notes.md");
  if (!developerNotes.includes("Billing v2 Engineering Readiness Guardrails")) {
    failures.push("developer-notes does not reference the engineering readiness package.");
  }

  for (const file of [
    ...requiredFiles,
    "docs/developer-notes.md",
    "docs/demo-readiness.md",
    "docs/controlled-pilot-launch-plan.md",
    "README.md",
  ]) {
    const text = read(file);
    for (const pattern of forbiddenImplementationClaims) {
      if (pattern.test(text)) {
        failures.push(`Forbidden implementation claim found in ${file}: ${pattern}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Billing v2 engineering readiness verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Billing v2 engineering readiness package verified.");
