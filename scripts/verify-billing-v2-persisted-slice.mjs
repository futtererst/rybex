import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "rybexos-billing-v2-"));
const outDir = join(tempRoot, "dist");
const storePath = join(tempRoot, "billing-v2-store.json");
const tempTsconfig = join(tempRoot, "tsconfig.billing-v2-verify.json");

process.env.RYBEXOS_BILLING_V2_STORE_PATH = storePath;

writeFileSync(tempTsconfig, JSON.stringify({
  extends: join(repoRoot, "tsconfig.json"),
  compilerOptions: {
    noEmit: false,
    outDir,
    rootDir: repoRoot,
    module: "CommonJS",
    moduleResolution: "Node",
    ignoreDeprecations: "6.0",
    declaration: false,
    sourceMap: false,
    incremental: false,
    tsBuildInfoFile: join(tempRoot, "tsconfig.tsbuildinfo")
  },
  files: [
    join(repoRoot, "lib", "d5o", "billing-v2", "app-state.ts"),
    join(repoRoot, "lib", "d5o", "billing-v2", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "workflow", "derive-workflows.ts")
  ]
}, null, 2));

const tscArgs = ["--project", tempTsconfig];
const tscBin = join(repoRoot, "node_modules", "typescript", "bin", "tsc");

try {
  execFileSync(process.execPath, [
    tscBin,
    ...tscArgs
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe"
  });
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout.toString());
  if (error.stderr) process.stderr.write(error.stderr.toString());
  throw error;
}

const store = await import(pathToFileURL(join(outDir, "lib", "d5o", "billing-v2", "persisted-store.js")).href);
const appState = await import(pathToFileURL(join(outDir, "lib", "d5o", "billing-v2", "app-state.js")).href);
const workflow = await import(pathToFileURL(join(outDir, "lib", "d5o", "workflow", "derive-workflows.js")).href);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSuccess(result, message) {
  assert(result.success, `${message}: ${result.message ?? result.error ?? "unknown failure"}`);
}

const initial = await store.getBillingBackupPackage();
assert(initial.state === "blocked", "Fresh persisted package should start blocked.");
assert(initial.localDemoOnly === false, "Persisted package should not be marked local demo only.");

writeFileSync(storePath, "{ corrupt json", "utf8");
const recoveredFromCorruptStore = await store.getBillingBackupPackage();
assert(recoveredFromCorruptStore.state === "blocked", "Corrupt JSON should recover to a deterministic blocked package.");

const resetBeforeFlow = await store.resetBillingV2PersistedStoreForTesting();
assert(resetBeforeFlow.state === "blocked", "Reset should return the canonical blocker to blocked state.");
const openBlockersAfterReset = await store.listOpenBillingBlockers();
assert(openBlockersAfterReset.length === 1, "Reset should restore one canonical open Billing V2 blocker.");
const resetOverlay = await store.getBillingV2SeedDataOverlay();
const resetWorkflowSummary = workflow.deriveOperatingWorkflows(resetOverlay);
const unresolvedAfterReset = resetWorkflowSummary.allOperatingWorkflows.filter((item) =>
  ["bb-lake-001", "cexp-008"].includes(item.sourceRecordId) &&
  item.resolutionState !== "resolved"
);
assert(unresolvedAfterReset.length > 0, "Reset command-center derivation should show the canonical blocker unresolved.");

const clearBeforePackageStart = await store.clearBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying to clear before package start."
});
assert(!clearBeforePackageStart.success, "Clearing before package start should fail.");

const started = await store.createOrStartBillingBackupPackage({ actorId: "Verification user" });
assertSuccess(started, "Starting package should succeed");
assert(started.package.state === "backup_package_in_progress", "Starting package should persist in-progress state.");

const reloadedAfterStart = await store.getBillingBackupPackage();
assert(reloadedAfterStart.state === "backup_package_in_progress", "Started state should survive repository reload.");

const clearBeforeEvidence = await store.clearBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying to clear before evidence."
});
assert(!clearBeforeEvidence.success, "Clearing before evidence and review should fail.");

const saved = await store.saveBillingBackupPackageDetails({
  actorId: "Verification user",
  backupSummary: "Stored material and product approval package for PA-001.",
  relatedSourceRecord: "bb-lake-001 / vault and handhole product approval",
  amountAffected: 38500
});
assertSuccess(saved, "Saving package details should succeed");

const reloadedAfterSave = await store.getBillingBackupPackage();
assert(reloadedAfterSave.backupSummary === "Stored material and product approval package for PA-001.", "Saved summary should survive repository reload.");
assert(reloadedAfterSave.amountAffected === 38500, "Saved amount should survive repository reload.");

const missingEvidenceValidation = await store.validateBillingBackupPackage(undefined, "Verification user");
assertSuccess(missingEvidenceValidation, "Validation command should return a readiness result");
assert(missingEvidenceValidation.readiness?.isReady === false, "Missing evidence should prevent readiness.");
assert(missingEvidenceValidation.package.state === "evidence_required", "Missing evidence should persist evidence_required state.");

const evidencePackage = await store.getBillingBackupPackage();
for (const requirement of evidencePackage.evidenceRequirements.filter((item) => item.required)) {
  const evidence = await store.attachBillingBackupEvidence({
    actorId: "Verification user",
    evidenceRequirementId: requirement.id,
    referenceText: `${requirement.label} verification reference`,
    referenceType: "document_reference"
  });
  assertSuccess(evidence, `Adding evidence for ${requirement.id} should succeed`);
}

const readyValidation = await store.validateBillingBackupPackage(undefined, "Verification user");
assertSuccess(readyValidation, "Readiness validation after evidence should succeed");
assert(readyValidation.readiness?.isReady === true, "Adding all required evidence should make the package ready.");
assert(readyValidation.package.state === "package_ready_for_review", "Ready validation should persist package_ready_for_review.");

const review = await store.sendBillingBackupToCommercialReview({
  actorId: "Verification user",
  assignedRole: "Commercial Review",
  dueDate: "2026-07-15"
});
assertSuccess(review, "Sending to commercial review should succeed");
assert(review.package.state === "commercial_review_pending", "Commercial review send should persist pending state.");

const earlyClear = await store.clearBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying to clear before approval."
});
assert(!earlyClear.success, "Clearing should require commercial review approval.");

const approved = await store.recordBillingCommercialReviewDecision({
  reviewerId: "Verification reviewer",
  decision: "approve",
  decisionNote: "Backup package supports the PA-001 stored material billing item."
});
assertSuccess(approved, "Approving commercial review should succeed");
assert(approved.package.reviewDecision?.decision === "approved", "Approval decision should persist.");

const clearWithoutNote = await store.clearBillingBlocker({
  actorId: "Verification user",
  resolutionNote: ""
});
assert(!clearWithoutNote.success, "Clearing should require a resolution note.");

const cleared = await store.clearBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Vault and handhole product approval backup is complete and commercially approved."
});
assertSuccess(cleared, "Clearing blocker should succeed after approval and resolution note");
assert(cleared.package.state === "billing_blocker_cleared", "Clearing should persist terminal state.");
assert(cleared.package.outcomeRecord?.blockerCleared === true, "Clearing should create an outcome record.");
assert(cleared.package.historicalRecord?.storageMode === "file_adapter", "Historical record should identify file adapter storage.");
const terminalHistoryCount = cleared.package.history.length;
const terminalEventCount = cleared.package.events.length;

const duplicateClear = await store.clearBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying to clear a second time."
});
assert(!duplicateClear.success, "Duplicate clear should fail instead of creating a second recovery record.");

const reloadedAfterClear = await store.getBillingBackupPackage();
assert(reloadedAfterClear.state === "billing_blocker_cleared", "Cleared state should survive repository reload.");
assert(reloadedAfterClear.history.length === terminalHistoryCount, "Duplicate clear should not add history entries.");
assert(reloadedAfterClear.events.length === terminalEventCount, "Duplicate clear should not add events.");

const openBlockers = await store.listOpenBillingBlockers();
assert(openBlockers.length === 0, "Canonical open blocker list should be empty after clearance.");

const impact = await store.getBillingCommandCenterImpact();
assert(impact.openBlockerCount === 0, "Command-center impact should show no open Billing V2 blocker.");
assert(impact.samePrimaryBlockerResolved === true, "Command-center impact should mark the same primary blocker resolved.");

const overlay = await store.getBillingV2SeedDataOverlay();
const backupItem = overlay.billingBackupItems.find((item) => item.id === store.canonicalBillingV2BackupItemId);
const exposureItem = overlay.commercialExposureItems.find((item) => item.id === store.canonicalBillingV2ExposureId);
const payApplication = overlay.payApplications.find((item) => item.id === store.canonicalBillingV2PayApplicationId);
assert(backupItem?.status === "verified", "Billing backup seed overlay should mark canonical backup verified.");
assert(exposureItem?.status === "recovered", "Commercial exposure seed overlay should remove canonical cash-at-risk item.");
assert(!payApplication?.missingBackupItems.some((item) => item.toLowerCase().includes("vault product")), "Pay application overlay should remove the cleared backup blocker.");

const workflowSummary = workflow.deriveOperatingWorkflows(overlay);
const unresolvedCanonicalWorkflows = workflowSummary.allOperatingWorkflows.filter((item) =>
  ["bb-lake-001", "cexp-008"].includes(item.sourceRecordId) &&
  item.resolutionState !== "resolved"
);
assert(unresolvedCanonicalWorkflows.length === 0, "Operating workflows should not show the cleared Billing V2 blocker as unresolved.");

const billingPrimaryAction = {
  id: "billing-billing-backup-cash-recovery",
  title: "Add missing billing backup",
  owner: "Mina Patel",
  dueDate: "2026-06-14",
  whyItMatters: "The cash recovery path cannot move until backup is complete.",
  ctaLabel: "Add missing billing backup",
  href: "/billing?focus=billing-billing-backup-cash-recovery#focused-task",
  severity: "high",
  taskOutcome: {
    focusId: "billing-billing-backup-cash-recovery",
    sourceModule: "billing",
    targetRoute: "/billing",
    targetHref: "/billing?focus=billing-billing-backup-cash-recovery#focused-task",
    concreteCtaLabel: "Add missing billing backup",
    expectedOutcome: "Billing v2 guided workflow opens.",
    targetSection: "Billing blocker",
    targetObjectTitle: "Add missing billing backup",
    nextStepInstruction: "Start the backup package.",
    reason: "Missing backup blocks cash recovery.",
    workflowCompletionRegistryId: "billing-backup-cash-recovery"
  }
};
const commandCenterSummary = appState.applyBillingV2CompletionToWorkspaceSummary({
  pageId: "command-center",
  status: "blocked",
  statusReason: "Add missing billing backup",
  primaryAction: billingPrimaryAction,
  criticalBlockers: [{ id: "billing", title: "Missing billing backup", severity: "high", detail: "Backup missing" }]
}, reloadedAfterClear);
const billingSummary = appState.applyBillingV2CompletionToWorkspaceSummary({
  pageId: "billing",
  status: "blocked",
  statusReason: "Add missing billing backup",
  primaryAction: billingPrimaryAction,
  criticalBlockers: [{ id: "billing", title: "Missing billing backup", severity: "high", detail: "Backup missing" }]
}, reloadedAfterClear);
assert(commandCenterSummary.primaryAction.id !== "billing-billing-backup-cash-recovery", "Command Center should not show the same unresolved billing primary action after clearance.");
assert(billingSummary.primaryAction.id !== "billing-billing-backup-cash-recovery", "Billing should not show the same unresolved billing primary action after clearance.");

const finalReset = await store.resetBillingV2PersistedStoreForTesting();
assert(finalReset.state === "blocked", "Final reset should restore the blocker for repeatable testing.");
assert((await store.listOpenBillingBlockers()).length === 1, "Final reset should restore the open blocker list.");

console.log("Billing V2 persisted vertical slice verified.");
console.log(JSON.stringify({
  storePath,
  packageState: reloadedAfterClear.state,
  openBlockerCount: impact.openBlockerCount,
  cashAtRisk: impact.cashAtRisk,
  workflowCount: workflowSummary.allOperatingWorkflows.length,
  resetState: finalReset.state
}, null, 2));
