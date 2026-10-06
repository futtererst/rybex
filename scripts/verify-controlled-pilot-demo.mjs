import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "rybexos-controlled-pilot-verify-"));
const outDir = join(tempRoot, "dist");
const tempTsconfig = join(tempRoot, "tsconfig.controlled-pilot-verify.json");
const billingStorePath = join(tempRoot, "billing-v2-store.json");
const fieldIssueStorePath = join(tempRoot, "field-issue-escalation-store.json");
const closeoutStorePath = join(tempRoot, "closeout-final-billing-store.json");

process.env.RYBEXOS_BILLING_V2_STORE_PATH = billingStorePath;
process.env.RYBEXOS_FIELD_ISSUE_STORE_PATH = fieldIssueStorePath;
process.env.RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH = closeoutStorePath;

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
    join(repoRoot, "lib", "d5o", "operating-slices", "registry.ts"),
    join(repoRoot, "lib", "d5o", "billing-v2", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "field-issue-escalation", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "closeout-final-billing", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "workflow", "derive-workflows.ts")
  ]
}, null, 2));

compile(tempTsconfig);

const registry = await import(pathToFileURL(join(outDir, "lib", "d5o", "operating-slices", "registry.js")).href);
const billing = await import(pathToFileURL(join(outDir, "lib", "d5o", "billing-v2", "persisted-store.js")).href);
const fieldIssue = await import(pathToFileURL(join(outDir, "lib", "d5o", "field-issue-escalation", "persisted-store.js")).href);
const closeout = await import(pathToFileURL(join(outDir, "lib", "d5o", "closeout-final-billing", "persisted-store.js")).href);
const workflow = await import(pathToFileURL(join(outDir, "lib", "d5o", "workflow", "derive-workflows.js")).href);

const packageJson = JSON.parse(readFile("package.json"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSuccess(result, message) {
  assert(result.success, `${message}: ${result.message ?? result.error ?? "unknown failure"}`);
}

const registeredIds = registry.listOperatingSlices().map((slice) => slice.sliceId);
for (const sliceId of ["billing-v2-backup-cash-recovery", "field-issue-escalation", "closeout-final-billing-release"]) {
  assert(registeredIds.includes(sliceId), `${sliceId} must be registered.`);
}

assert(packageJson.scripts?.["billing-v2:qa"], "Billing V2 browser QA command must exist.");
assert(packageJson.scripts?.["field-issue:qa"], "Field Issue browser QA command must exist.");
assert(packageJson.scripts?.["closeout-final-billing:qa"], "Closeout Final Billing browser QA command must exist.");
assert(packageJson.scripts?.["controlled-pilot:reset"], "controlled-pilot:reset command must exist.");
assert(packageJson.scripts?.["controlled-pilot:verify"], "controlled-pilot:verify command must exist.");

await resetAll();
assert((await billing.listOpenBillingBlockers()).length === 1, "Billing V2 reset should restore one open blocker.");
assert((await fieldIssue.listOpenFieldIssues()).length === 1, "Field Issue reset should restore one open issue.");
assert((await closeout.listOpenCloseoutFinalBillingBlockers()).length === 1, "Closeout reset should restore one open blocker.");

let overlay = await composePilotOverlay();
assert(hasBillingBlocker(overlay), "Command Center derivation should initially include the Billing V2 blocker.");
assert(hasFieldIssueBlocker(overlay), "Command Center derivation should initially include the Field Issue blocker.");
assert(hasCloseoutBlocker(overlay), "Command Center derivation should initially include the Closeout Final Billing blocker.");

await completeFieldIssueFlow();
overlay = await composePilotOverlay();
assert(!hasFieldIssueBlocker(overlay), "Completing Field Issue should remove the field blocker from Command Center derivation.");
assert(hasBillingBlocker(overlay), "Completing Field Issue should not clear Billing V2.");
assert(hasCloseoutBlocker(overlay), "Completing Field Issue should not clear Closeout.");
assert(overlay.rfis.some((rfi) => rfi.id === "rfi-field-issue-lake-001"), "Field Issue completion should project a downstream RFI.");

await completeBillingFlow();
overlay = await composePilotOverlay();
assert(!hasBillingBlocker(overlay), "Completing Billing V2 should remove the billing blocker from Command Center derivation.");
assert(overlay.commercialExposureItems.find((item) => item.id === "cexp-008")?.status === "recovered", "Billing V2 completion should recover the canonical cash exposure.");

await completeCloseoutFlow();
overlay = await composePilotOverlay();
assert(!hasCloseoutBlocker(overlay), "Completing Closeout should remove the closeout blocker from Command Center derivation.");
assert(!hasBillingBlocker(overlay), "Billing V2 blocker should remain resolved after Closeout completion.");
assert(!hasFieldIssueBlocker(overlay), "Field Issue blocker should remain resolved after Closeout completion.");
assert(overlay.payApplications.find((item) => item.id === "pay-bluegrass-final")?.totalRetainageHeld === 0, "Closeout completion should release the linked retainage projection.");
assert(overlay.commercialExposureItems.find((item) => item.id === "cexp-007")?.status === "recovered", "Closeout completion should recover the linked retainage exposure.");

assertWorkflowClientIsRepositoryBacked("components/d5o/billing-v2/BillingV2WorkflowClient.tsx", {
  requiredActionImport: "@/app/actions/billing-v2",
  forbiddenFactories: ["createBillingV2DemoPackage", "localStorage"]
});
assertWorkflowClientIsRepositoryBacked("components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx", {
  requiredActionImport: "@/app/actions/field-issue-escalation",
  forbiddenFactories: ["createFieldIssueDemoState", "localStorage"]
});
assertWorkflowClientIsRepositoryBacked("components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx", {
  requiredActionImport: "@/app/actions/closeout-final-billing",
  forbiddenFactories: ["createCloseoutFinalBillingDemoState", "localStorage"]
});

await resetAll();

console.log("Controlled pilot demo verified.");
console.log(JSON.stringify({
  registeredSlices: registeredIds,
  resetStates: {
    billing: (await billing.getBillingBackupPackage()).state,
    fieldIssue: (await fieldIssue.getFieldIssueEscalation()).state,
    closeout: (await closeout.getCloseoutFinalBillingBlocker()).state
  },
  browserQaCommandsCallable: [
    "billing-v2:qa",
    "field-issue:qa",
    "closeout-final-billing:qa"
  ],
  isolatedStores: {
    billingStorePath,
    fieldIssueStorePath,
    closeoutStorePath
  }
}, null, 2));

async function resetAll() {
  await billing.resetBillingV2PersistedStoreForTesting();
  await fieldIssue.resetFieldIssueEscalationStoreForTesting();
  await closeout.resetCloseoutFinalBillingStoreForTesting();
}

async function composePilotOverlay() {
  const billingOverlay = await billing.getBillingV2SeedDataOverlay();
  const fieldOverlay = await fieldIssue.getFieldIssueSeedDataOverlay();
  const closeoutOverlay = await closeout.getCloseoutFinalBillingSeedDataOverlay({
    payApplications: billingOverlay.payApplications,
    commercialExposureItems: billingOverlay.commercialExposureItems
  });

  return {
    ...billingOverlay,
    ...fieldOverlay,
    ...closeoutOverlay
  };
}

function workflowsFor(overlay) {
  return workflow.deriveOperatingWorkflows(overlay).allOperatingWorkflows;
}

function hasBillingBlocker(overlay) {
  return workflowsFor(overlay).some((item) =>
    ["bb-lake-001", "cexp-008"].includes(item.sourceRecordId) &&
    item.workflowType === "billing_cash_control" &&
    item.resolutionState !== "resolved"
  );
}

function hasFieldIssueBlocker(overlay) {
  return workflowsFor(overlay).some((item) =>
    item.sourceRecordId === "dr-lake-bore-0610" &&
    item.workflowType === "field_execution" &&
    item.resolutionState !== "resolved"
  );
}

function hasCloseoutBlocker(overlay) {
  return workflowsFor(overlay).some((item) =>
    ["cop-bluegrass-001", "cor-blue-restoration", "cor-blue-waiver", "cor-blue-retainage"].includes(item.sourceRecordId) &&
    item.workflowType === "closeout_acceptance" &&
    item.resolutionState !== "resolved"
  );
}

async function completeBillingFlow() {
  assertSuccess(await billing.createOrStartBillingBackupPackage({ actorId: "Controlled pilot verifier" }), "Billing start should succeed");
  assertSuccess(await billing.saveBillingBackupPackageDetails({
    actorId: "Controlled pilot verifier",
    backupSummary: "Stored material and product approval package for controlled pilot PA-001.",
    relatedSourceRecord: "bb-lake-001 / vault and handhole product approval",
    amountAffected: 38500
  }), "Billing details save should succeed");

  const billingPackage = await billing.getBillingBackupPackage();
  for (const requirement of billingPackage.evidenceRequirements.filter((item) => item.required)) {
    assertSuccess(await billing.attachBillingBackupEvidence({
      actorId: "Controlled pilot verifier",
      evidenceRequirementId: requirement.id,
      referenceText: `${requirement.label} controlled pilot reference`,
      referenceType: "document_reference"
    }), `Billing evidence ${requirement.id} should save`);
  }

  assertSuccess(await billing.validateBillingBackupPackage(undefined, "Controlled pilot verifier"), "Billing readiness should validate");
  assertSuccess(await billing.sendBillingBackupToCommercialReview({
    actorId: "Controlled pilot verifier",
    assignedRole: "Commercial Review",
    dueDate: "2026-07-15"
  }), "Billing commercial review submit should succeed");
  assertSuccess(await billing.recordBillingCommercialReviewDecision({
    reviewerId: "Controlled pilot reviewer",
    decision: "approve",
    decisionNote: "Controlled pilot backup package approved."
  }), "Billing commercial review approval should succeed");
  assertSuccess(await billing.clearBillingBlocker({
    actorId: "Controlled pilot verifier",
    resolutionNote: "Controlled pilot Billing V2 blocker cleared."
  }), "Billing blocker clearance should succeed");
}

async function completeFieldIssueFlow() {
  assertSuccess(await fieldIssue.startFieldIssueEscalation({ actorId: "Controlled pilot verifier" }), "Field Issue start should succeed");
  assertSuccess(await fieldIssue.saveFieldIssueAssessment({
    actorId: "Controlled pilot verifier",
    issueType: "utility_conflict",
    impactSummary: "Utility locate and traffic-control release gap holds the bore crew and creates standby exposure.",
    scheduleImpact: true,
    scheduleDays: 2,
    costExposure: 18500,
    safetyImpact: true,
    qualityImpact: false
  }), "Field Issue assessment should save");
  assertSuccess(await fieldIssue.addFieldIssueEvidenceReference({
    actorId: "Controlled pilot verifier",
    requirementId: "field-daily-report-reference",
    referenceText: "DR dr-lake-bore-0610 plus locate sketch and standby note",
    referenceType: "daily_report"
  }), "Field Issue evidence should save");
  assertSuccess(await fieldIssue.selectFieldIssueEscalationPath({
    actorId: "Controlled pilot verifier",
    path: "rfi"
  }), "Field Issue RFI path should save");
  assertSuccess(await fieldIssue.createRfiFromFieldIssue({ actorId: "Controlled pilot verifier" }), "Field Issue downstream RFI should be created");
  assertSuccess(await fieldIssue.resolveFieldIssueEscalation({
    actorId: "Controlled pilot verifier",
    resolutionNote: "Controlled pilot RFI created and field blocker cleared."
  }), "Field Issue should resolve");
}

async function completeCloseoutFlow() {
  assertSuccess(await closeout.startCloseoutFinalBillingRelease({ actorId: "Controlled pilot verifier" }), "Closeout start should succeed");
  assertSuccess(await closeout.saveCloseoutRequirementAssessment({
    actorId: "Controlled pilot verifier",
    acceptanceStatus: "accepted",
    punchStatus: "accepted",
    testEvidenceStatus: "accepted",
    asBuiltRedlineStatus: "accepted",
    closeoutDocumentStatus: "accepted",
    finalBillingReleaseStatus: "ready",
    assessmentSummary: "Acceptance exceptions, punch proof, tests, as-builts, and final billing release are ready for review."
  }), "Closeout assessment should save");

  for (const requirementId of ["restoration-acceptance-photos", "final-unconditional-waiver", "retainage-release-request"]) {
    assertSuccess(await closeout.addCloseoutEvidenceReference({
      actorId: "Controlled pilot verifier",
      requirementId,
      referenceText: `Controlled pilot evidence reference for ${requirementId}.`,
      referenceType: requirementId.includes("waiver") ? "lien_waiver" : requirementId.includes("photos") ? "punch_photo" : "billing_reference"
    }), `Closeout evidence ${requirementId} should save`);
  }

  assertSuccess(await closeout.validateCloseoutReleaseReadiness(undefined, "Controlled pilot verifier"), "Closeout readiness should validate");
  assertSuccess(await closeout.submitCloseoutReleaseForReview({
    actorId: "Controlled pilot verifier",
    assignedRole: "Closeout Finance Review"
  }), "Closeout review submit should succeed");
  assertSuccess(await closeout.recordCloseoutReleaseDecision({
    reviewerId: "Controlled pilot reviewer",
    decision: "approve",
    decisionNote: "Controlled pilot closeout release approved."
  }), "Closeout approval should succeed");
  assertSuccess(await closeout.clearCloseoutFinalBillingBlocker({
    actorId: "Controlled pilot verifier",
    resolutionNote: "Controlled pilot final billing and retainage release cleared."
  }), "Closeout blocker clearance should succeed");
}

function assertWorkflowClientIsRepositoryBacked(filePath, input) {
  assert(existsSync(join(repoRoot, filePath)), `${filePath} must exist.`);
  const content = readFile(filePath);
  assert(content.includes(input.requiredActionImport), `${filePath} must import repository-backed server actions.`);
  assert(content.includes("initialState") || content.includes("initialPackage"), `${filePath} must accept initial canonical state.`);
  for (const forbidden of input.forbiddenFactories) {
    assert(!content.includes(forbidden), `${filePath} must not depend on ${forbidden}.`);
  }
}

function compile(tsconfigPath) {
  try {
    execFileSync(process.execPath, [
      join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "--project",
      tsconfigPath
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
}

function readFile(filePath) {
  return readFileSync(join(repoRoot, filePath), "utf8");
}
