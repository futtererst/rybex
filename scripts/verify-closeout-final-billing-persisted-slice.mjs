import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "rybexos-closeout-final-billing-"));
const outDir = join(tempRoot, "dist");
const storePath = join(tempRoot, "closeout-final-billing-store.json");
const tempTsconfig = join(tempRoot, "tsconfig.closeout-final-billing-verify.json");

process.env.RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH = storePath;

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
    join(repoRoot, "lib", "d5o", "closeout-final-billing", "app-state.ts"),
    join(repoRoot, "lib", "d5o", "closeout-final-billing", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "workflow", "derive-workflows.ts")
  ]
}, null, 2));

try {
  execFileSync(process.execPath, [
    join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
    "--project",
    tempTsconfig
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

const store = await import(pathToFileURL(join(outDir, "lib", "d5o", "closeout-final-billing", "persisted-store.js")).href);
const appState = await import(pathToFileURL(join(outDir, "lib", "d5o", "closeout-final-billing", "app-state.js")).href);
const workflow = await import(pathToFileURL(join(outDir, "lib", "d5o", "workflow", "derive-workflows.js")).href);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSuccess(result, message) {
  assert(result.success, `${message}: ${result.message ?? result.error ?? "unknown failure"}`);
}

function unresolvedCloseoutWorkflows(overlay) {
  return workflow.deriveOperatingWorkflows(overlay).allOperatingWorkflows.filter((item) =>
    item.workflowType === "closeout_acceptance" &&
    ["cop-bluegrass-001", "cor-blue-restoration", "cor-blue-waiver", "cor-blue-retainage"].includes(item.sourceRecordId) &&
    item.resolutionState !== "resolved"
  );
}

async function runHappyPath() {
  await store.resetCloseoutFinalBillingStoreForTesting();
  assertSuccess(await store.startCloseoutFinalBillingRelease({ actorId: "Verification user" }), "Starting closeout release should succeed");
  assertSuccess(await store.saveCloseoutRequirementAssessment({
    actorId: "Verification user",
    acceptanceStatus: "accepted",
    punchStatus: "accepted",
    testEvidenceStatus: "accepted",
    asBuiltRedlineStatus: "accepted",
    closeoutDocumentStatus: "accepted",
    finalBillingReleaseStatus: "ready",
    assessmentSummary: "Acceptance exceptions, punch proof, tests, as-builts, and final billing release are ready for review."
  }), "Saving closeout assessment should succeed");

  for (const requirementId of ["restoration-acceptance-photos", "final-unconditional-waiver", "retainage-release-request"]) {
    assertSuccess(await store.addCloseoutEvidenceReference({
      actorId: "Verification user",
      requirementId,
      referenceText: `Verified evidence reference for ${requirementId}.`,
      referenceType: requirementId.includes("waiver") ? "lien_waiver" : requirementId.includes("photos") ? "punch_photo" : "billing_reference"
    }), `Adding ${requirementId} evidence should succeed`);
  }

  const ready = await store.validateCloseoutReleaseReadiness(undefined, "Verification user");
  assertSuccess(ready, "Readiness validation should succeed after assessment and evidence");
  assert(ready.blocker.state === "ready_for_review", "Readiness validation should persist ready-for-review state.");

  const submitted = await store.submitCloseoutReleaseForReview({
    actorId: "Verification user",
    assignedRole: "Finance reviewer"
  });
assertSuccess(submitted, "Submitting closeout release for review should succeed");
assert(submitted.blocker.review?.status === "pending", "Submit should persist pending review.");

  return submitted;
}

let initial = await store.getCloseoutFinalBillingBlocker();
assert(initial.state === "unresolved", "Fresh persisted closeout blocker should start unresolved.");

writeFileSync(storePath, "{ corrupt json", "utf8");
const recovered = await store.getCloseoutFinalBillingBlocker();
assert(recovered.state === "unresolved", "Corrupt JSON should recover to deterministic unresolved closeout state.");

await store.resetCloseoutFinalBillingStoreForTesting();
assert((await store.listOpenCloseoutFinalBillingBlockers()).length === 1, "Reset should restore one canonical open closeout blocker.");
let overlay = await store.getCloseoutFinalBillingSeedDataOverlay();
assert(unresolvedCloseoutWorkflows(overlay).length > 0, "Reset command-center derivation should include unresolved closeout workflow.");

const clearBeforeStart = await store.clearCloseoutFinalBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying too early."
});
assert(!clearBeforeStart.success, "Clearing before workflow start should fail.");

const started = await store.startCloseoutFinalBillingRelease({ actorId: "Verification user" });
assertSuccess(started, "Starting closeout final billing release should succeed");
assert(started.blocker.state === "in_progress", "Start should persist in-progress state.");
assert((await store.getCloseoutFinalBillingBlocker()).state === "in_progress", "Started state should survive repository reload.");

const validateBeforeAssessment = await store.validateCloseoutReleaseReadiness(undefined, "Verification user");
assert(!validateBeforeAssessment.success, "Readiness validation before assessment should fail.");

const assessed = await store.saveCloseoutRequirementAssessment({
  actorId: "Verification user",
  acceptanceStatus: "accepted",
  punchStatus: "accepted",
  testEvidenceStatus: "accepted",
  asBuiltRedlineStatus: "accepted",
  closeoutDocumentStatus: "accepted",
  finalBillingReleaseStatus: "ready",
  assessmentSummary: "Bluegrass closeout release proof is aligned but evidence references must be attached."
});
assertSuccess(assessed, "Saving closeout requirement assessment should succeed");
assert(assessed.blocker.state === "assessed", "Assessment should persist assessed state.");
const reloadedAssessment = await store.getCloseoutFinalBillingBlocker();
assert(reloadedAssessment.assessment?.assessmentSummary.includes("Bluegrass closeout"), "Assessment should survive reload.");

const validateMissingEvidence = await store.validateCloseoutReleaseReadiness(undefined, "Verification user");
assert(!validateMissingEvidence.success, "Missing evidence should block readiness validation.");

const submitBeforeReadiness = await store.submitCloseoutReleaseForReview({
  actorId: "Verification user",
  assignedRole: "Finance reviewer"
});
assert(!submitBeforeReadiness.success, "Submit for review should require readiness.");

for (const requirementId of ["restoration-acceptance-photos", "final-unconditional-waiver", "retainage-release-request"]) {
  const evidence = await store.addCloseoutEvidenceReference({
    actorId: "Verification user",
    requirementId,
    referenceText: `Evidence reference for ${requirementId}.`,
    referenceType: requirementId.includes("waiver") ? "lien_waiver" : requirementId.includes("photos") ? "punch_photo" : "billing_reference"
  });
  assertSuccess(evidence, `Adding ${requirementId} should succeed`);
}
const withEvidence = await store.getCloseoutFinalBillingActionState();
assert(withEvidence.readiness.evidenceComplete === true, "Adding evidence should change readiness.");

const ready = await store.validateCloseoutReleaseReadiness(undefined, "Verification user");
assertSuccess(ready, "Readiness validation should persist after evidence");
assert(ready.blocker.state === "ready_for_review", "Validated state should be ready for review.");

const submitted = await store.submitCloseoutReleaseForReview({
  actorId: "Verification user",
  assignedRole: "Finance reviewer"
});
assertSuccess(submitted, "Submit for review should succeed after readiness.");

const clearBeforeApproval = await store.clearCloseoutFinalBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying before approval."
});
assert(!clearBeforeApproval.success, "Clearing before approval should fail.");

const rejected = await store.recordCloseoutReleaseDecision({
  reviewerId: "Verification reviewer",
  decision: "reject",
  decisionNote: "Rejected to prove clearance is blocked."
});
assertSuccess(rejected, "Rejection decision should persist");
assert(rejected.blocker.review?.status === "rejected", "Rejection should persist rejected review status.");
const clearAfterRejection = await store.clearCloseoutFinalBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Trying after rejection."
});
assert(!clearAfterRejection.success, "Rejection should prevent clearance.");

await runHappyPath();
const approved = await store.recordCloseoutReleaseDecision({
  reviewerId: "Verification reviewer",
  decision: "approve",
  decisionNote: "Approved for final billing and retainage release."
});
assertSuccess(approved, "Approval decision should persist");
assert(approved.blocker.review?.status === "approved", `Approval should persist approved review status; got ${approved.blocker.review?.status ?? "missing"}.`);

const clearWithoutNote = await store.clearCloseoutFinalBillingBlocker({
  actorId: "Verification user",
  resolutionNote: ""
});
assert(!clearWithoutNote.success, "Clearing should require a resolution note.");

const resolved = await store.clearCloseoutFinalBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Closeout release approved; final billing and retainage are cleared."
});
assertSuccess(resolved, "Clearing closeout final billing blocker should succeed after approval and note");
assert(resolved.blocker.state === "resolved", "Clearance should persist terminal state.");
assert(resolved.blocker.billingProjection.status === "approved_for_processing", "Clearance should approve downstream billing projection for processing without recording payment.");

const terminalHistoryCount = resolved.blocker.history.length;
const duplicateClear = await store.clearCloseoutFinalBillingBlocker({
  actorId: "Verification user",
  resolutionNote: "Second clear attempt."
});
assert(!duplicateClear.success, "Duplicate clear should fail.");
const reloadedTerminal = await store.getCloseoutFinalBillingBlocker();
assert(reloadedTerminal.state === "resolved", "Terminal state should survive reload.");
assert(reloadedTerminal.history.length === terminalHistoryCount, "Duplicate clear should not duplicate terminal history.");
assert((await store.listOpenCloseoutFinalBillingBlockers()).length === 0, "Canonical open closeout blocker list should be empty after resolution.");

overlay = await store.getCloseoutFinalBillingSeedDataOverlay();
assert(unresolvedCloseoutWorkflows(overlay).length === 0, "Command-center derivation should remove unresolved closeout workflow after canonical resolution.");
assert(overlay.closeoutPackages.find((item) => item.id === "cop-bluegrass-001")?.finalBillingStatus === "approved", "Closeout overlay should mark final billing approved for processing, not paid.");
assert(overlay.closeoutPackages.find((item) => item.id === "cop-bluegrass-001")?.retainageReleaseStatus === "submitted", "Closeout overlay should avoid implying retainage payment was completed.");
assert(overlay.payApplications.find((item) => item.id === "pay-bluegrass-final")?.status === "approved", "Billing projection should mark pay application approved for processing, not paid.");
assert(overlay.payApplications.find((item) => item.id === "pay-bluegrass-final")?.totalRetainageHeld === 58000, "Billing projection should not zero retained amount without a payment event.");
assert(overlay.payApplications.find((item) => item.id === "pay-bluegrass-final")?.amountPaidThisPeriod === 12000, "Billing projection should not overwrite prior paid amount without a new payment event.");
assert(overlay.payApplications.find((item) => item.id === "pay-bluegrass-final")?.paymentReceivedDate === "2026-06-07", "Billing projection should not create a new payment date from closeout clearance.");
assert(overlay.commercialExposureItems.find((item) => item.id === "cexp-007")?.status === "approved_not_billed", "Commercial exposure projection should be approved-not-billed, not recovered.");

const commandCenterSummary = appState.applyCloseoutFinalBillingToWorkspaceSummary({
  pageId: "command-center",
  stageLabel: "Command Center",
  purpose: "Priorities",
  status: "blocked",
  statusReason: "Closeout unresolved",
  d5oPhase: "O",
  primaryUserIntent: "Focus",
  primaryAction: {
    id: "closeout-final-billing-lake-001",
    title: "Release final billing and retainage",
    owner: "Finance Lead",
    dueDate: "2026-06-13",
    whyItMatters: "Closeout unresolved.",
    ctaLabel: "Release final billing",
    href: "/closeout?focus=closeout-final-billing-lake-001#closeout-final-billing",
    severity: "critical",
    taskOutcome: {
      focusId: "closeout-final-billing-lake-001",
      sourceModule: "closeout",
      targetRoute: "/closeout",
      targetHref: "/closeout?focus=closeout-final-billing-lake-001#closeout-final-billing",
      concreteCtaLabel: "Release final billing",
      expectedOutcome: "Resolve closeout final billing blocker.",
      targetSection: "Closeout final billing release",
      targetObjectTitle: "Bluegrass closeout",
      nextStepInstruction: "Assess closeout.",
      reason: "Closeout final billing is unresolved."
    }
  },
  secondaryActions: [],
  criticalBlockers: [{
    id: "closeout-final-billing-lake-001",
    title: "Final billing blocked",
    action: "Release",
    owner: "Finance Lead",
    dueDate: "2026-06-13",
    href: "/closeout"
  }],
  evidenceNeededNow: [],
  detailLabel: "Details"
}, reloadedTerminal);
assert(commandCenterSummary.primaryAction.id !== "closeout-final-billing-lake-001", "Command Center should not show the same unresolved closeout primary action after resolution.");

const finalReset = await store.resetCloseoutFinalBillingStoreForTesting();
assert(finalReset.state === "unresolved", "Final reset should restore unresolved closeout blocker for repeatable testing.");
assert((await store.listOpenCloseoutFinalBillingBlockers()).length === 1, "Final reset should restore canonical open closeout blocker list.");

console.log("Closeout final billing persisted vertical slice verified.");
console.log(JSON.stringify({
  storePath,
  terminalState: reloadedTerminal.state,
  openBlockerCountAfterResolution: 0,
  billingProjectionStatus: "approved_for_processing"
}, null, 2));
