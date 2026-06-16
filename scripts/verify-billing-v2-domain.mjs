import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "lib/d5o/billing-v2/types.ts",
  "lib/d5o/billing-v2/demo-state.ts",
  "lib/d5o/billing-v2/billing-v2-events.ts",
  "lib/d5o/billing-v2/billing-v2-readiness.ts",
  "lib/d5o/billing-v2/billing-v2-outcomes.ts",
  "lib/d5o/billing-v2/billing-v2-history.ts",
  "lib/d5o/billing-v2/billing-v2-service.ts",
  "lib/d5o/billing-v2/index.ts",
  "scripts/qa-billing-v2-domain.mjs",
  "scripts/verify-billing-v2-domain.mjs"
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
  "reopened"
];

const requiredCommands = [
  "startBackupPackage",
  "saveBackupSummary",
  "saveRelatedSourceRecord",
  "saveAmountAffected",
  "saveReviewNote",
  "saveEvidenceReference",
  "waiveEvidenceRequirement",
  "validatePackageReadiness",
  "sendPackageToCommercialReview",
  "approveCommercialReview",
  "requestCommercialReviewChanges",
  "rejectCommercialReview",
  "saveResolutionNote",
  "clearBillingBlocker",
  "reopenBillingBlocker"
];

const requiredEvents = [
  "BillingBackupPackageStarted",
  "BillingBackupSummarySaved",
  "BillingSourceRecordSaved",
  "BillingAmountAffectedSaved",
  "BillingReviewNoteSaved",
  "BillingEvidenceReferenceSaved",
  "BillingEvidenceRequirementWaived",
  "BillingPackageReadinessValidated",
  "BillingCommercialReviewTaskCreated",
  "BillingCommercialReviewApproved",
  "BillingCommercialReviewChangesRequested",
  "BillingCommercialReviewRejected",
  "BillingResolutionNoteSaved",
  "BillingBlockerCleared",
  "BillingBlockerReopened",
  "BillingOutcomeRecordGenerated",
  "BillingHistoricalRecordGenerated"
];

const prohibitedChangedPathPrefixes = [
  "app/",
  "components/",
  "supabase/",
  "lib/d5o/auth/",
  "lib/d5o/security/",
  "lib/d5o/workflow-completion/",
  "lib/d5o/pilot/",
  "app/field-execution/",
  "app/closeout/"
];

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing required file: ${file}`);
  }
}

if (failures.length === 0) {
  const packageJson = JSON.parse(read("package.json"));
  if (packageJson.scripts["billing-v2:qa-domain"] !== "node scripts/qa-billing-v2-domain.mjs") {
    fail("package.json missing billing-v2:qa-domain script.");
  }
  if (packageJson.scripts["billing-v2:verify-domain"] !== "node scripts/verify-billing-v2-domain.mjs") {
    fail("package.json missing billing-v2:verify-domain script.");
  }

  const types = read("lib/d5o/billing-v2/types.ts");
  const index = read("lib/d5o/billing-v2/index.ts");
  const service = read("lib/d5o/billing-v2/billing-v2-service.ts");
  const readiness = read("lib/d5o/billing-v2/billing-v2-readiness.ts");
  const outcomes = read("lib/d5o/billing-v2/billing-v2-outcomes.ts");
  const history = read("lib/d5o/billing-v2/billing-v2-history.ts");
  const events = read("lib/d5o/billing-v2/billing-v2-events.ts");
  const demoState = read("lib/d5o/billing-v2/demo-state.ts");
  const qa = read("scripts/qa-billing-v2-domain.mjs");
  const developerNotes = read("docs/developer-notes.md");

  for (const state of requiredStates) {
    if (!types.includes(`"${state}"`)) {
      fail(`Domain state missing from types.ts: ${state}`);
    }
  }

  for (const command of requiredCommands) {
    if (!service.includes(`function ${command}`) && !service.includes(`const ${command}`)) {
      fail(`Domain command missing from billing-v2-service.ts: ${command}`);
    }

    if (!index.includes("billing-v2-service")) {
      fail("index.ts must export the service command API.");
      break;
    }
  }

  for (const event of requiredEvents) {
    if (!types.includes(event) || !events.includes(event)) {
      fail(`Domain event missing from types/events: ${event}`);
    }
  }

  const separationChecks = [
    [readiness, "evaluateBillingPackageReadiness", "readiness logic must exist outside service"],
    [readiness, "getBillingMissingReadinessItems", "missing item calculation must exist outside service"],
    [outcomes, "generateBillingOutcomeRecord", "outcome generation must exist outside service"],
    [outcomes, "generateBillingBlockerResolution", "blocker resolution generation must exist outside service"],
    [history, "generateBillingHistoricalRecord", "historical record generation must exist outside service"],
    [history, "appendBillingHistoryEntries", "history append logic must exist outside service"],
    [events, "createBillingEvent", "event creation must exist outside service"],
    [events, "billingV2EventMessages", "event messages must exist outside service"]
  ];

  for (const [contents, phrase, message] of separationChecks) {
    if (!contents.includes(phrase)) {
      fail(message);
    }
  }

  const monolithPatterns = [
    "function evaluateBillingPackageReadiness",
    "function generateBillingOutcomeRecord",
    "function generateBillingHistoricalRecord",
    "function appendBillingHistoryEntries",
    "function createBillingEvent"
  ];

  for (const pattern of monolithPatterns) {
    if (service.includes(pattern)) {
      fail(`billing-v2-service.ts is taking back helper responsibility: ${pattern}`);
    }
  }

  const requiredQaPhrases = [
    "missing backup summary",
    "missing source record",
    "missing or zero amount affected",
    "any required evidence missing",
    "waiver without reason",
    "review approval",
    "request changes",
    "reject",
    "clear before approval",
    "clear without resolution note",
    "clear if readiness no longer valid",
    "BillingOutcomeRecordGenerated",
    "BillingHistoricalRecordGenerated",
    "Pay App 101"
  ];

  const qaLower = qa.toLowerCase();
  for (const phrase of requiredQaPhrases) {
    if (!qaLower.includes(phrase.toLowerCase())) {
      fail(`Billing v2 domain QA missing coverage marker: ${phrase}`);
    }
  }

  if (!demoState.includes("Pay App 003") || !demoState.includes("84000")) {
    fail("Demo state must seed Pay App 003 and the $84,000 blocker.");
  }

  if (service.includes("Pay App 003")) {
    fail("Billing v2 service must not hardcode Pay App 003.");
  }

  if (!developerNotes.includes("Billing v2 Phase 1A Domain Layer")) {
    fail("Developer notes must document the Billing v2 Phase 1A domain layer.");
  }

  let gitStatus = "";
  try {
    gitStatus = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" });
  } catch {
    gitStatus = "";
  }

  if (gitStatus) {
    for (const rawLine of gitStatus.split(/\r?\n/).filter(Boolean)) {
      const changedPath = rawLine.slice(3).replaceAll("\\", "/");
      for (const prefix of prohibitedChangedPathPrefixes) {
        if (changedPath.startsWith(prefix)) {
          fail(`Prohibited path changed in domain-only pass: ${changedPath}`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Billing v2 domain verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Billing v2 domain verification passed.");
