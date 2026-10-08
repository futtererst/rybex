"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  attachBillingBackupEvidenceAction,
  clearBillingBlockerAction,
  recordBillingCommercialReviewDecisionAction,
  saveBillingBackupPackageDetailsAction,
  sendBillingBackupToCommercialReviewAction,
  startBillingBackupPackageAction,
  validateBillingBackupPackageAction
} from "@/app/actions/billing-v2";
import { useWorkflowCompletion } from "@/components/d5o/workflow-completion/WorkflowCompletionProvider";
import { getEditableFieldsForWorkflow } from "@/lib/d5o/workflow-completion/editable-field-contracts";
import {
  evaluateBillingPackageReadiness,
  formatBillingCurrency,
  type BillingBackupPackage,
  type BillingEvidenceReferenceType,
  type BillingPackageReadiness
} from "@/lib/d5o/billing-v2";
import { BillingV2ActiveStepWorkspace } from "./BillingV2ActiveStepWorkspace";
import { BillingV2StepAddProof } from "./BillingV2StepAddProof";
import { BillingV2StepBuildPackage } from "./BillingV2StepBuildPackage";
import { BillingV2StepClearBlocker } from "./BillingV2StepClearBlocker";
import { BillingV2StepCommercialReview } from "./BillingV2StepCommercialReview";
import { BillingV2StepOutcomeRecord } from "./BillingV2StepOutcomeRecord";
import { BillingV2StepReviewDecision } from "./BillingV2StepReviewDecision";
import { BillingV2StepUnderstandBlocker } from "./BillingV2StepUnderstandBlocker";

type BillingV2StepId =
  | "understand"
  | "build-package"
  | "add-proof"
  | "commercial-review"
  | "review-decision"
  | "clear-blocker"
  | "outcome";

type BillingV2WorkflowClientProps = {
  cameFromPilot: boolean;
  initialPackage: BillingBackupPackage;
  storageLabel: string;
};

type LocalDemoAttachment = {
  fileName: string;
  fileSize: number;
  fileType: string;
};

function referenceTypeFor(requirementId: string): BillingEvidenceReferenceType {
  if (requirementId.includes("daily-report")) return "daily_report";
  if (requirementId.includes("photo-log")) return "photo_log";
  if (requirementId.includes("supervisor")) return "supervisor_confirmation";
  if (requirementId.includes("product-approval")) return "product_approval";
  return "document_reference";
}

function initialStepForPackage(billingPackage: BillingBackupPackage): BillingV2StepId {
  if (billingPackage.state === "billing_blocker_cleared") return "outcome";
  if (billingPackage.state === "commercial_review_approved") return "clear-blocker";
  if (billingPackage.state === "commercial_review_pending") return "review-decision";
  if (billingPackage.state === "package_ready_for_review") return "commercial-review";
  if (billingPackage.state === "evidence_required" || billingPackage.evidenceRequirements.some((item) => item.status !== "missing" && item.status !== "not_required")) return "add-proof";
  if (billingPackage.state === "backup_package_in_progress" || billingPackage.backupSummary || billingPackage.amountAffected) return "build-package";
  return "understand";
}

type ActionResult = {
  success?: boolean;
  package?: BillingBackupPackage;
  message?: string;
  error?: string;
  readiness?: BillingPackageReadiness;
};

export function BillingV2WorkflowClient({ cameFromPilot, initialPackage }: BillingV2WorkflowClientProps) {
  const completion = useWorkflowCompletion();
  const [billingPackage, setBillingPackage] = useState<BillingBackupPackage>(() => initialPackage);
  const [activeStep, setActiveStep] = useState<BillingV2StepId>(() => initialStepForPackage(initialPackage));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const [backupSummary, setBackupSummary] = useState(initialPackage.backupSummary ?? "");
  const [relatedSourceRecord, setRelatedSourceRecord] = useState(initialPackage.relatedSourceRecord?.label ?? "bb-lake-001 / vault and handhole product approval");
  const [amountAffected, setAmountAffected] = useState(String(initialPackage.amountAffected ?? initialPackage.blockedAmount));
  const [referenceDrafts, setReferenceDrafts] = useState<Record<string, string>>({});
  const [waiverDrafts, setWaiverDrafts] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Record<string, LocalDemoAttachment>>({});
  const [decisionNote, setDecisionNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const readiness = useMemo(() => evaluateBillingPackageReadiness(billingPackage), [billingPackage]);
  const nextUnlock = getNextUnlock(activeStep, billingPackage, readiness);
  const requiredEvidence = billingPackage.evidenceRequirements.filter((item) => item.required);
  const completedEvidenceCount = requiredEvidence.filter((item) => readiness.satisfiedEvidenceIds.includes(item.id)).length;
  const isRecovered = Boolean(billingPackage.blockerResolution);

  useEffect(() => {
    panelRef.current?.setAttribute("data-billing-v2-hydrated", "true");
  }, []);

  async function run(action: Promise<ActionResult>, nextStep?: BillingV2StepId) {
    setIsSaving(true);
    try {
      const result = await action;
      if (result.package) setBillingPackage(result.package);
      setFeedback(result.message ?? result.error ?? "Billing V2 action completed.");
      if (result.success && nextStep) setActiveStep(nextStep);
      return Boolean(result.success);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStart() {
    await run(startBillingBackupPackageAction({ packageId: billingPackage.id }), "build-package");
  }

  async function handleSavePackage() {
    const parsedAmount = Number(amountAffected.replaceAll(",", ""));
    await run(saveBillingBackupPackageDetailsAction({
      packageId: billingPackage.id,
      backupSummary,
      relatedSourceRecord,
      amountAffected: parsedAmount
    }), "add-proof");
  }

  async function handleSaveReference(requirementId: string, referenceOverride?: string) {
    const referenceText = referenceOverride ?? referenceDrafts[requirementId] ?? "";
    await run(attachBillingBackupEvidenceAction({
      packageId: billingPackage.id,
      evidenceRequirementId: requirementId,
      referenceText,
      referenceType: referenceTypeFor(requirementId)
    }));
  }

  function handleAttachLocalFile(requirementId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const attachment = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    };
    setAttachments((current) => ({
      ...current,
      [requirementId]: attachment
    }));
    void handleSaveReference(
      requirementId,
      `File reference captured: ${attachment.fileName} (${attachment.fileType || "unknown type"}, ${attachment.fileSize} bytes)`
    );
    event.target.value = "";
  }

  async function handleWaive(requirementId: string) {
    await run(attachBillingBackupEvidenceAction({
      packageId: billingPackage.id,
      evidenceRequirementId: requirementId,
      waiverReason: waiverDrafts[requirementId] ?? ""
    }));
  }

  async function handleValidateReadiness() {
    const result: ActionResult = await validateBillingBackupPackageAction({ packageId: billingPackage.id });
    const success = await run(Promise.resolve(result), result.success && result.readiness?.isReady ? "commercial-review" : undefined);
    if (!success || !result.readiness?.isReady) {
      setFeedback(result.readiness?.missingItems.length
        ? `Still missing: ${result.readiness.missingItems.join(", ")}.`
        : result.message ?? result.error ?? "Package readiness is incomplete.");
    }
  }

  async function handleSendToReview() {
    await run(sendBillingBackupToCommercialReviewAction({
      packageId: billingPackage.id,
      assignedRole: "Commercial Review",
      dueDate: "2026-07-15"
    }), "review-decision");
  }

  async function handleReviewDecision(kind: "approve" | "changes" | "reject") {
    const reviewTaskId = billingPackage.reviewTask?.id ?? "";
    const nextStep = kind === "approve" ? "clear-blocker" : undefined;
    await run(recordBillingCommercialReviewDecisionAction({
      packageId: billingPackage.id,
      reviewTaskId,
      decision: kind,
      decisionNote
    }), nextStep);
  }

  async function handleClearBlocker() {
    const result: ActionResult = await clearBillingBlockerAction({
      packageId: billingPackage.id,
      resolutionNote
    });
    const success = await run(Promise.resolve(result), "outcome");
    if (success && result.package) syncPilotCompletion(result.package);
  }

  function syncPilotCompletion(finalPackage: BillingBackupPackage) {
    const fields = getEditableFieldsForWorkflow("billing-backup-cash-recovery");
    const byId = Object.fromEntries(fields.map((field) => [field.fieldId, field]));
    if (byId.backup_note) {
      completion.saveField("billing-backup-cash-recovery", byId.backup_note, finalPackage.backupSummary ?? `Billing backup package created for ${finalPackage.payApplicationLabel}.`);
    }
    if (byId.billing_evidence_reference) {
      completion.saveField(
        "billing-backup-cash-recovery",
        byId.billing_evidence_reference,
        finalPackage.evidenceRequirements
          .filter((item) => item.required)
          .map((item) => `${item.label}: ${item.reference?.referenceText ?? item.waiverReason ?? item.status}`)
          .join(" | ")
      );
    }
    completion.applyAction("billing-backup-cash-recovery", "mark_evidence_attached", {
      note: "Billing v2 backup package completed through guided workflow."
    });
    completion.applyAction("billing-backup-cash-recovery", "send_to_review", {
      note: "Commercial Review task created from Billing v2 guided workflow."
    });
    if (byId.billing_resolution_note) {
      completion.saveField("billing-backup-cash-recovery", byId.billing_resolution_note, finalPackage.resolutionNote ?? resolutionNote);
    }
    completion.applyAction("billing-backup-cash-recovery", "resolve_workflow_blocker", {
      note: finalPackage.outcomeRecord?.outcome ?? `${finalPackage.payApplicationLabel} ready for commercial review.`
    });
  }

  return (
    <article
      className={`focused-task-panel billing-workbench billing-workbench-step-${activeStep}${isRecovered ? " billing-workbench-recovered" : ""}`}
      data-billing-v2-hydrated="false"
      data-qa="focused-task-panel"
      id="focused-task"
      ref={panelRef}
      tabIndex={-1}
    >
      <section
        aria-label="Billing backup workflow"
        data-qa="billing-v2-guided-workflow"
      >
        <div className="billing-workflow-header" data-qa="billing-v2-header">
          <div>
            <p className="eyebrow">Active billing recovery</p>
            <h2>{isRecovered ? "Billing blocker cleared" : `Clear the blocker on ${billingPackage.payApplicationLabel}`}</h2>
            <p>
              {isRecovered
                ? "The backup package has been reviewed and the pay application is ready for the commercial review path."
                : `${formatBillingCurrency(billingPackage.blockedAmount, billingPackage.currency)} cash at risk is still blocked until backup, proof, review, and clearance are complete.`}
            </p>
          </div>
          <span className={`chip ${isRecovered ? "chip-success" : "chip-critical"}`}>
            {isRecovered ? "cash unblocked" : "cash blocked"}
          </span>
        </div>

        {!isRecovered ? (
          <ol className="guided-step-summary" data-qa="billing-v2-step-progress">
            {getBillingProgress(activeStep, billingPackage).map((step) => (
              <li className={`guided-step guided-step-${step.state}`} key={step.id}>
                <span>{step.state}</span>
                <strong>{step.label}</strong>
              </li>
            ))}
          </ol>
        ) : null}

        {!isRecovered ? (
          <div className="billing-workflow-brief" data-qa="billing-v2-situation-header">
            <strong>Required now</strong>
            <span>{readiness.missingItems[0] ?? nextUnlock}</span>
          </div>
        ) : null}

        <div className="guided-work-body billing-guided-layout">
          <BillingV2ActiveStepWorkspace>
            {activeStep === "understand" ? (
              <BillingV2StepUnderstandBlocker
                billingPackage={billingPackage}
                completedEvidenceCount={completedEvidenceCount}
                feedback={feedback}
                onStart={handleStart}
                totalEvidenceCount={requiredEvidence.length}
              />
            ) : null}
            {activeStep === "build-package" ? (
              <BillingV2StepBuildPackage
                amountAffected={amountAffected}
                backupSummary={backupSummary}
                feedback={feedback}
                relatedSourceRecord={relatedSourceRecord}
                savedAmountAffected={billingPackage.amountAffected}
                savedBackupSummary={billingPackage.backupSummary}
                savedRelatedSourceRecord={billingPackage.relatedSourceRecord?.label}
                onAmountAffectedChange={setAmountAffected}
                onBackupSummaryChange={setBackupSummary}
                onRelatedSourceRecordChange={setRelatedSourceRecord}
                onSaveAndContinue={handleSavePackage}
              />
            ) : null}
            {activeStep === "add-proof" ? (
              <BillingV2StepAddProof
                attachments={attachments}
                billingPackage={billingPackage}
                feedback={feedback}
                referenceDrafts={referenceDrafts}
                waiverDrafts={waiverDrafts}
                onAttachLocalFile={handleAttachLocalFile}
                onReferenceDraftChange={(requirementId, value) => setReferenceDrafts((current) => ({ ...current, [requirementId]: value }))}
                onSaveReference={handleSaveReference}
                onValidateReadiness={handleValidateReadiness}
                onWaive={handleWaive}
                onWaiverDraftChange={(requirementId, value) => setWaiverDrafts((current) => ({ ...current, [requirementId]: value }))}
              />
            ) : null}
            {activeStep === "commercial-review" ? (
              <BillingV2StepCommercialReview
                billingPackage={billingPackage}
                feedback={feedback}
                readiness={readiness}
                onSendToReview={handleSendToReview}
              />
            ) : null}
            {activeStep === "review-decision" ? (
              <BillingV2StepReviewDecision
                billingPackage={billingPackage}
                decisionNote={decisionNote}
                feedback={feedback}
                onApprove={() => handleReviewDecision("approve")}
                onDecisionNoteChange={setDecisionNote}
                onReject={() => handleReviewDecision("reject")}
                onRequestChanges={() => handleReviewDecision("changes")}
              />
            ) : null}
            {activeStep === "clear-blocker" ? (
              <BillingV2StepClearBlocker
                billingPackage={billingPackage}
                feedback={feedback}
                readiness={readiness}
                resolutionNote={resolutionNote}
                onClearBlocker={handleClearBlocker}
                onResolutionNoteChange={setResolutionNote}
              />
            ) : null}
            {activeStep === "outcome" ? (
              <BillingV2StepOutcomeRecord billingPackage={billingPackage} cameFromPilot={cameFromPilot} />
            ) : null}
          </BillingV2ActiveStepWorkspace>
          {!isRecovered ? (
            <aside className="workbench-support-panel billing-workflow-support" aria-label="Billing workflow support">
              <section>
                <span>Required now</span>
                <strong>{readiness.missingItems[0] ?? nextUnlock}</strong>
              </section>
              <section>
                <span>Complete</span>
                <strong>{completedEvidenceCount} of {requiredEvidence.length} proof items complete</strong>
              </section>
              <section>
                <span>Next</span>
                <strong>{nextUnlock}</strong>
              </section>
            </aside>
          ) : null}
        </div>
        {isSaving ? <p className="muted">Saving billing changes...</p> : null}
        {!isRecovered ? (
          <details className="guided-supporting-details">
            <summary>Supporting billing details</summary>
            <dl className="completion-facts">
              <div>
                <dt>Evidence complete</dt>
                <dd>{completedEvidenceCount} of {requiredEvidence.length}</dd>
              </div>
              <div>
                <dt>Pay application</dt>
                <dd>{billingPackage.payApplicationLabel}</dd>
              </div>
              <div>
                <dt>Review status</dt>
                <dd>{billingPackage.reviewTask?.status.replaceAll("_", " ") ?? "Not requested"}</dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd>{billingPackage.reviewDecision?.decision ?? "Not recorded"}</dd>
              </div>
            </dl>
          </details>
        ) : null}
      </section>
    </article>
  );
}

function getBillingProgress(activeStep: BillingV2StepId, billingPackage: BillingBackupPackage) {
  const steps: Array<{ id: BillingV2StepId; label: string }> = [
    { id: "understand", label: "Understand" },
    { id: "build-package", label: "Package" },
    { id: "add-proof", label: "Add proof" },
    { id: "commercial-review", label: "Review" },
    { id: "review-decision", label: "Decision" },
    { id: "clear-blocker", label: "Clear" },
    { id: "outcome", label: "Cleared" }
  ];
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  return steps.map((step, index) => ({
    ...step,
    state: billingPackage.state === "billing_blocker_cleared" || index < activeIndex
      ? "done"
      : index === activeIndex
        ? "current"
        : "locked"
  }));
}

function getNextUnlock(
  activeStep: BillingV2StepId,
  billingPackage: BillingBackupPackage,
  readiness: BillingPackageReadiness
): string {
  if (activeStep === "understand") return "Start the backup package.";
  if (activeStep === "build-package") return "Required proof package.";
  if (activeStep === "add-proof") return readiness.isReady ? "Commercial review handoff." : "Complete missing evidence.";
  if (activeStep === "commercial-review") return "Commercial Review task.";
  if (activeStep === "review-decision") return "Approved review unlocks blocker clearance.";
  if (activeStep === "clear-blocker") return billingPackage.resolutionNote ? "Outcome and historical record." : "Save the resolution note.";
  return "Open pay application review/submission readiness.";
}
