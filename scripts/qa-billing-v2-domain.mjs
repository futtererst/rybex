import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const requireFromScript = createRequire(import.meta.url);
const moduleCache = new Map();

function resolveTsModule(fromFile, specifier) {
  if (!specifier.startsWith(".")) return specifier;

  const resolved = path.resolve(path.dirname(fromFile), specifier);
  return path.extname(resolved) ? resolved : `${resolved}.ts`;
}

function loadTsModule(relativePathOrAbsolutePath) {
  const absolutePath = path.isAbsolute(relativePathOrAbsolutePath)
    ? relativePathOrAbsolutePath
    : path.join(root, relativePathOrAbsolutePath);

  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath).exports;

  const source = readFileSync(absolutePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    },
    fileName: absolutePath
  }).outputText;

  const loadedModule = { exports: {} };
  moduleCache.set(absolutePath, loadedModule);

  const localRequire = (specifier) => {
    const resolved = resolveTsModule(absolutePath, specifier);
    if (path.isAbsolute(resolved)) return loadTsModule(resolved);
    return requireFromScript(resolved);
  };

  vm.runInNewContext(transpiled, {
    exports: loadedModule.exports,
    module: loadedModule,
    require: localRequire,
    __dirname: path.dirname(absolutePath),
    __filename: absolutePath
  }, { filename: absolutePath });

  return loadedModule.exports;
}

const { createBillingV2DemoPackage } = loadTsModule("lib/d5o/billing-v2/demo-state.ts");
const service = loadTsModule("lib/d5o/billing-v2/billing-v2-service.ts");

function expectSuccess(result, label) {
  assert.equal(result.success, true, `${label}: ${result.error ?? result.message}`);
  return result.package;
}

function expectFailure(result, expectedMessage, label) {
  assert.equal(result.success, false, `${label}: command should fail`);
  assert.equal(result.message, expectedMessage, `${label}: unexpected failure message`);
  return result.package;
}

function startPackage() {
  let billingPackage = createBillingV2DemoPackage();
  billingPackage = expectSuccess(service.startBackupPackage(billingPackage, { actorId: "billing-user" }), "start package");
  return billingPackage;
}

function satisfyRequiredEvidence(seedPackage) {
  let billingPackage = seedPackage;

  for (const requirement of billingPackage.evidenceRequirements) {
    if (!requirement.required) continue;

    if (requirement.id === "supervisor-confirmation") {
      billingPackage = expectSuccess(service.waiveEvidenceRequirement(billingPackage, {
        actorId: "billing-user",
        evidenceRequirementId: requirement.id,
        waiverReason: "Supervisor confirmation is represented by the signed daily report for this local/demo package."
      }), "waive supervisor confirmation");
    } else {
      billingPackage = expectSuccess(service.saveEvidenceReference(billingPackage, {
        actorId: "billing-user",
        evidenceRequirementId: requirement.id,
        referenceText: `${requirement.label} reference for ${billingPackage.payApplicationLabel}`,
        referenceType: requirement.id === "daily-report-reference"
          ? "daily_report"
          : requirement.id === "photo-log-reference"
            ? "photo_log"
            : requirement.id === "product-approval-backup"
              ? "product_approval"
              : "document_reference"
      }), `save ${requirement.label}`);
    }
  }

  return billingPackage;
}

function completeReadyPackage(seedPackage = startPackage()) {
  let billingPackage = seedPackage;
  billingPackage = expectSuccess(service.saveBackupSummary(billingPackage, {
    actorId: "billing-user",
    summary: "Backup package for stored material support tied to CE-004."
  }), "save backup summary");
  billingPackage = expectSuccess(service.saveRelatedSourceRecord(billingPackage, {
    actorId: "billing-user",
    sourceRecordId: "ce-004",
    sourceRecordLabel: "CE-004 / stored material support",
    sourceRecordType: "change_event"
  }), "save source record");
  billingPackage = expectSuccess(service.saveAmountAffected(billingPackage, {
    actorId: "billing-user",
    amountAffected: billingPackage.blockedAmount,
    currency: billingPackage.currency
  }), "save amount affected");
  billingPackage = expectSuccess(service.saveReviewNote(billingPackage, {
    actorId: "billing-user",
    reviewNote: "Please review this backup package for commercial readiness."
  }), "save review note");
  billingPackage = satisfyRequiredEvidence(billingPackage);

  billingPackage = expectSuccess(service.validatePackageReadiness(billingPackage, {
    actorId: "billing-user"
  }), "validate package readiness");
  assert.equal(billingPackage.state, "package_ready_for_review");
  return billingPackage;
}

function assertCannotSendToReview(seedPackage, label) {
  const result = service.validatePackageReadiness(seedPackage, { actorId: "billing-user" });
  const billingPackage = expectSuccess(result, `${label}: validate incomplete package`);
  assert.equal(result.readiness?.isReady, false, `${label}: readiness should be false`);
  expectFailure(
    service.sendPackageToCommercialReview(billingPackage, {
      actorId: "billing-user",
      assignedRole: "Commercial reviewer / Finance/Admin"
    }),
    "Complete required evidence references before sending to commercial review.",
    `${label}: send to review should stay blocked`
  );
}

function sendToReview(seedPackage = completeReadyPackage()) {
  const result = service.sendPackageToCommercialReview(seedPackage, {
    actorId: "billing-user",
    assignedRole: "Commercial reviewer / Finance/Admin",
    dueDate: "2026-06-18"
  });
  const billingPackage = expectSuccess(result, "send to review");
  assert.equal(billingPackage.state, "commercial_review_pending");
  assert.equal(billingPackage.reviewTask?.status, "pending");
  assert.equal(result.events[0].type, "BillingCommercialReviewTaskCreated");
  return billingPackage;
}

function testStateMachineAndReadiness() {
  const initial = createBillingV2DemoPackage();
  assert.equal(initial.state, "blocked");
  assert.equal(service.evaluatePackageReadiness(initial).isReady, false);

  let billingPackage = startPackage();
  assert.equal(billingPackage.state, "backup_package_in_progress");

  let result = service.validatePackageReadiness(billingPackage, { actorId: "billing-user" });
  billingPackage = expectSuccess(result, "readiness fails into evidence required");
  assert.equal(billingPackage.state, "evidence_required");
  assert.equal(result.readiness?.isReady, false);

  expectFailure(
    service.sendPackageToCommercialReview(billingPackage, {
      actorId: "billing-user",
      assignedRole: "Commercial reviewer / Finance/Admin"
    }),
    "Complete required evidence references before sending to commercial review.",
    "send before readiness"
  );
}

function testReadinessNegativePaths() {
  let missingSummary = startPackage();
  missingSummary = expectSuccess(service.saveRelatedSourceRecord(missingSummary, {
    actorId: "billing-user",
    sourceRecordId: "ce-004",
    sourceRecordLabel: "CE-004 / stored material support",
    sourceRecordType: "change_event"
  }), "missing summary source");
  missingSummary = expectSuccess(service.saveAmountAffected(missingSummary, {
    actorId: "billing-user",
    amountAffected: 84000,
    currency: "USD"
  }), "missing summary amount");
  missingSummary = satisfyRequiredEvidence(missingSummary);
  assertCannotSendToReview(missingSummary, "missing backup summary");

  let missingSource = startPackage();
  missingSource = expectSuccess(service.saveBackupSummary(missingSource, {
    actorId: "billing-user",
    summary: "Backup package summary exists."
  }), "missing source summary");
  missingSource = expectSuccess(service.saveAmountAffected(missingSource, {
    actorId: "billing-user",
    amountAffected: 84000,
    currency: "USD"
  }), "missing source amount");
  missingSource = satisfyRequiredEvidence(missingSource);
  assertCannotSendToReview(missingSource, "missing source record");

  let missingAmount = startPackage();
  missingAmount = expectSuccess(service.saveBackupSummary(missingAmount, {
    actorId: "billing-user",
    summary: "Backup package summary exists."
  }), "missing amount summary");
  missingAmount = expectSuccess(service.saveRelatedSourceRecord(missingAmount, {
    actorId: "billing-user",
    sourceRecordId: "ce-004",
    sourceRecordLabel: "CE-004 / stored material support",
    sourceRecordType: "change_event"
  }), "missing amount source");
  expectFailure(
    service.saveAmountAffected(missingAmount, {
      actorId: "billing-user",
      amountAffected: 0,
      currency: "USD"
    }),
    "Enter the amount affected before saving.",
    "zero amount rejected"
  );
  missingAmount = satisfyRequiredEvidence(missingAmount);
  assertCannotSendToReview(missingAmount, "missing or zero amount affected");

  let missingEvidence = startPackage();
  missingEvidence = expectSuccess(service.saveBackupSummary(missingEvidence, {
    actorId: "billing-user",
    summary: "Backup package summary exists."
  }), "missing evidence summary");
  missingEvidence = expectSuccess(service.saveRelatedSourceRecord(missingEvidence, {
    actorId: "billing-user",
    sourceRecordId: "ce-004",
    sourceRecordLabel: "CE-004 / stored material support",
    sourceRecordType: "change_event"
  }), "missing evidence source");
  missingEvidence = expectSuccess(service.saveAmountAffected(missingEvidence, {
    actorId: "billing-user",
    amountAffected: 84000,
    currency: "USD"
  }), "missing evidence amount");
  missingEvidence = expectSuccess(service.saveEvidenceReference(missingEvidence, {
    actorId: "billing-user",
    evidenceRequirementId: "daily-report-reference",
    referenceText: "DR-2026-0612",
    referenceType: "daily_report"
  }), "partial evidence reference");
  assertCannotSendToReview(missingEvidence, "any required evidence missing");
}

function testEvidenceRules() {
  let billingPackage = startPackage();
  expectFailure(
    service.waiveEvidenceRequirement(billingPackage, {
      actorId: "billing-user",
      evidenceRequirementId: "signed-tm-ticket",
      waiverReason: ""
    }),
    "Waiver reason is required before this evidence requirement can be waived.",
    "waiver without reason"
  );

  billingPackage = expectSuccess(service.saveEvidenceReference(billingPackage, {
    actorId: "billing-user",
    evidenceRequirementId: "daily-report-reference",
    referenceText: "DR-2026-0612",
    referenceType: "daily_report"
  }), "save evidence reference");

  const evidence = billingPackage.evidenceRequirements.find((item) => item.id === "daily-report-reference");
  assert.equal(evidence?.status, "referenced");
  assert.equal(evidence?.reference?.referenceText, "DR-2026-0612");
}

function testApprovalAndClearance() {
  let billingPackage = sendToReview();

  // Review approval gating: blocker clearance stays locked until approval and resolution note.
  expectFailure(
    service.clearBillingBlocker(billingPackage, { actorId: "billing-user" }),
    "Commercial review must be approved before the billing blocker can be cleared.",
    "clear before approval"
  );

  expectFailure(
    service.approveCommercialReview(billingPackage, {
      reviewTaskId: billingPackage.reviewTask?.id ?? "",
      reviewerId: "commercial-reviewer",
      decisionNote: ""
    }),
    "Enter a commercial review decision note before approving.",
    "approve without note"
  );

  billingPackage = expectSuccess(service.approveCommercialReview(billingPackage, {
    reviewTaskId: billingPackage.reviewTask?.id ?? "",
    reviewerId: "commercial-reviewer",
    decisionNote: "Backup package is sufficient for commercial review."
  }), "approve review");
  assert.equal(billingPackage.state, "commercial_review_approved");

  expectFailure(
    service.clearBillingBlocker(billingPackage, { actorId: "billing-user" }),
    "Enter a resolution note before clearing this blocker.",
    "clear without resolution note"
  );

  billingPackage = expectSuccess(service.saveResolutionNote(billingPackage, {
    actorId: "billing-user",
    resolutionNote: "Commercial review approved the backup package and the item can move into pay app review."
  }), "save resolution note");

  const result = service.clearBillingBlocker(billingPackage, { actorId: "billing-user" });
  billingPackage = expectSuccess(result, "clear blocker");
  assert.equal(billingPackage.state, "billing_blocker_cleared");
  assert.equal(billingPackage.blockerResolution?.remainingBlockers.length, 0);
  assert.equal(billingPackage.outcomeRecord?.blockerCleared, true);
  assert.equal(billingPackage.outcomeRecord?.businessObject, "Pay App 003");
  assert.equal(billingPackage.outcomeRecord?.blockedAmount, 84000);
  assert.ok((billingPackage.outcomeRecord?.evidenceCaptured.length ?? 0) >= 5);
  assert.equal(billingPackage.outcomeRecord?.reviewDecision.decision, "approved");
  assert.equal(billingPackage.outcomeRecord?.nextBusinessStep, "Open pay application review/submission readiness.");
  assert.equal(billingPackage.historicalRecord?.businessObject, "Pay App 003");
  assert.ok((billingPackage.historicalRecord?.userInputs.length ?? 0) >= 5);
  assert.ok((billingPackage.historicalRecord?.evidenceReferences.length ?? 0) >= 5);
  assert.equal(billingPackage.historicalRecord?.reviewDecision.decision, "approved");
  assert.ok((billingPackage.historicalRecord?.stateTransitions.length ?? 0) >= 4);
  assert.ok(billingPackage.historicalRecord?.outcome.includes("Billing backup blocker resolved."));
  assert.ok(result.events.some((event) => event.type === "BillingOutcomeRecordGenerated"));
  assert.ok(result.events.some((event) => event.type === "BillingHistoricalRecordGenerated"));
  assert.ok(billingPackage.outcomeRecord?.outcome.includes("$84,000"));
  assert.notEqual(billingPackage.outcomeRecord?.outcome, "resolved");
}

function testClearanceReadinessRegression() {
  let billingPackage = sendToReview();
  billingPackage = expectSuccess(service.approveCommercialReview(billingPackage, {
    reviewTaskId: billingPackage.reviewTask?.id ?? "",
    reviewerId: "commercial-reviewer",
    decisionNote: "Backup package is sufficient for commercial review."
  }), "approve before readiness regression");
  billingPackage = expectSuccess(service.saveResolutionNote(billingPackage, {
    actorId: "billing-user",
    resolutionNote: "Approved package should clear only while readiness remains valid."
  }), "save resolution before readiness regression");

  billingPackage.evidenceRequirements = billingPackage.evidenceRequirements.map((requirement) =>
    requirement.id === "product-approval-backup"
      ? { ...requirement, status: "missing", reference: undefined }
      : requirement
  );

  expectFailure(
    service.clearBillingBlocker(billingPackage, { actorId: "billing-user" }),
    "Complete required evidence references before clearing this blocker.",
    "clear if readiness no longer valid"
  );
}

function testRequestChangesAndRejection() {
  let changesPackage = sendToReview();
  changesPackage = expectSuccess(service.requestCommercialReviewChanges(changesPackage, {
    reviewTaskId: changesPackage.reviewTask?.id ?? "",
    reviewerId: "commercial-reviewer",
    decisionNote: "Add the signed T&M ticket reference before approval."
  }), "request changes");
  assert.equal(changesPackage.state, "commercial_review_changes_requested");
  expectFailure(
    service.clearBillingBlocker(changesPackage, { actorId: "billing-user" }),
    "Commercial review must be approved before the billing blocker can be cleared.",
    "clear after request changes"
  );
  changesPackage = expectSuccess(service.reopenBillingBlocker(changesPackage, {
    actorId: "billing-user",
    reopenReason: "Rework package after commercial review request."
  }), "reopen after request changes");
  assert.equal(changesPackage.state, "reopened");

  let rejectedPackage = sendToReview();
  rejectedPackage = expectSuccess(service.rejectCommercialReview(rejectedPackage, {
    reviewTaskId: rejectedPackage.reviewTask?.id ?? "",
    reviewerId: "commercial-reviewer",
    decisionNote: "Backup does not support this billing item."
  }), "reject package");
  assert.equal(rejectedPackage.state, "commercial_review_rejected");
  expectFailure(
    service.clearBillingBlocker(rejectedPackage, { actorId: "billing-user" }),
    "Rejected billing packages cannot clear the blocker. Reopen the package to continue.",
    "clear after rejection"
  );
}

function testReusableDomainModel() {
  let customPackage = createBillingV2DemoPackage();
  customPackage = {
    ...customPackage,
    id: "billing-v2-package-pay-app-101",
    payApplicationId: "pay-app-101",
    payApplicationLabel: "Pay App 101",
    blockedAmount: 1250,
    title: "Pay App 101 backup package",
    events: [],
    history: []
  };

  customPackage = completeReadyPackage(expectSuccess(service.startBackupPackage(customPackage, {
    actorId: "billing-user"
  }), "start custom package"));
  customPackage = sendToReview(customPackage);
  customPackage = expectSuccess(service.approveCommercialReview(customPackage, {
    reviewTaskId: customPackage.reviewTask?.id ?? "",
    reviewerId: "commercial-reviewer",
    decisionNote: "Approved for custom pay app."
  }), "approve custom package");
  customPackage = expectSuccess(service.saveResolutionNote(customPackage, {
    actorId: "billing-user",
    resolutionNote: "Custom package approved for blocker clearance."
  }), "save custom resolution");
  customPackage = expectSuccess(service.clearBillingBlocker(customPackage, {
    actorId: "billing-user"
  }), "clear custom package");

  assert.ok(customPackage.outcomeRecord?.outcome.includes("Pay App 101"));
  assert.ok(customPackage.outcomeRecord?.outcome.includes("$1,250"));
  assert.equal(customPackage.outcomeRecord?.outcome.includes("Pay App 003"), false);
}

function testUserFacingLabels() {
  assert.equal(service.getBillingV2StateDisplayLabel("package_ready_for_review"), "Ready for commercial review");
  assert.equal(service.getBillingV2StateDisplayLabel("billing_blocker_cleared"), "Billing blocker cleared");
}

function testReusableServiceDoesNotHardcodeDemoPayApp() {
  const serviceSource = readFileSync(path.join(root, "lib/d5o/billing-v2/billing-v2-service.ts"), "utf8");
  assert.equal(serviceSource.includes("Pay App 003"), false);
}

testStateMachineAndReadiness();
testReadinessNegativePaths();
testEvidenceRules();
testApprovalAndClearance();
testClearanceReadinessRegression();
testRequestChangesAndRejection();
testReusableDomainModel();
testUserFacingLabels();
testReusableServiceDoesNotHardcodeDemoPayApp();

console.log("Billing v2 domain QA passed.");
