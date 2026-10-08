"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addCloseoutEvidenceReferenceAction,
  clearCloseoutFinalBillingBlockerAction,
  recordCloseoutReleaseDecisionAction,
  saveCloseoutRequirementAssessmentAction,
  startCloseoutFinalBillingReleaseAction,
  submitCloseoutReleaseForReviewAction,
  validateCloseoutReleaseReadinessAction
} from "@/app/actions/closeout-final-billing";
import type { CloseoutFinalBillingActionState } from "@/lib/d5o/closeout-final-billing/store";
import type { CloseoutEvidenceReference, CloseoutFinalBillingState } from "@/lib/d5o/closeout-final-billing/types";

type CloseoutFinalBillingWorkflowClientProps = {
  initialState: CloseoutFinalBillingActionState;
};

type CloseoutStepId =
  | "understand"
  | "assess"
  | "evidence"
  | "validate"
  | "review"
  | "decision"
  | "clear"
  | "outcome";

export function CloseoutFinalBillingWorkflowClient({
  initialState
}: CloseoutFinalBillingWorkflowClientProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState("");
  const [assessmentSummary, setAssessmentSummary] = useState(
    state.blocker.assessment?.assessmentSummary ??
      "Acceptance exception, restoration photo evidence, final waiver, and retainage release request need to be packaged for final billing release."
  );
  const [evidenceText, setEvidenceText] = useState("Accepted restoration photos, final unconditional waiver, and retainage release request packet");
  const [decisionNote, setDecisionNote] = useState("Closeout release package is approved for final billing and retainage release.");
  const [resolutionNote, setResolutionNote] = useState("Closeout release approved; final waiver and restoration evidence clear retainage release.");
  const [isPending, startTransition] = useTransition();
  const activeStep = useMemo(() => getCloseoutStep(state.blocker.state, state.readiness), [state.blocker.state, state.readiness]);
  const nextStep = useMemo(() => deriveNextStep(state), [state]);
  const requiredNow = useMemo(() => deriveRequiredNow(state), [state]);
  const completedNow = useMemo(() => deriveCompletedNow(state), [state]);
  const evidenceCompleteCount = state.blocker.evidenceRequirements.filter((item) => item.status === "attached").length;
  const resolved = state.blocker.state === "resolved";

  const run = (command: () => Promise<CloseoutFinalBillingActionState & { success: boolean; message: string; error?: string }>) => {
    startTransition(async () => {
      const result = await command();
      setState({
        blocker: result.blocker,
        readiness: result.readiness,
        impact: result.impact,
        storageLabel: result.storageLabel
      });
      setMessage(result.message || result.error || "Closeout final billing action complete.");
      router.refresh();
    });
  };

  return (
    <section className={`guided-work-surface closeout-workbench closeout-workbench-step-${activeStep}${resolved ? " closeout-workbench-resolved" : ""}`} data-qa="closeout-final-billing-workflow" id="closeout-final-billing">
      <div className="closeout-workflow-header" data-qa="closeout-final-billing-situation-header">
        <div>
          <p className="eyebrow">Closeout release</p>
          <h2>{resolved ? "Closeout blocker cleared" : "Clear the closeout blocker"}</h2>
          <p>
            {resolved
              ? "The closeout package is approved and the linked final billing item can continue processing."
              : "Approval and release evidence are needed before the linked billing item can move."}
          </p>
        </div>
        <span className={`chip ${resolved ? "chip-success" : "chip-critical"}`} data-qa="closeout-final-billing-state">{state.blocker.state.replaceAll("_", " ")}</span>
      </div>

      {!resolved ? (
        <div className="closeout-workflow-brief">
          <strong>Required now</strong>
          <span data-qa="closeout-final-billing-readiness">{nextStep}</span>
        </div>
      ) : null}

      {!resolved ? (
        <ol className="guided-step-summary" data-qa="closeout-final-billing-step-progress">
          {getCloseoutProgress(activeStep, state.blocker.state).map((step) => (
            <li className={`guided-step guided-step-${step.state}`} key={step.id}>
              <span>{step.state}</span>
              <strong>{step.label}</strong>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="guided-work-body closeout-guided-layout">
        <section className="guided-current-step closeout-current-step-card panel" data-qa="closeout-final-billing-current-step">
          {activeStep === "understand" ? (
            <div data-qa="closeout-final-billing-step-understand">
              <StepHeading eyebrow="Assess blocker" title="Assess closeout requirements" text="Confirm what acceptance, evidence, and approval are still required before final billing and retainage can be released." />
              <p className="closeout-mobile-path-line">The workflow will guide acceptance evidence, readiness validation, review, approval, and final release.</p>
              <p className="closeout-mobile-requirement-line">{state.blocker.requirementSummary}</p>
              <dl className="completion-facts">
                <div><dt>Owner</dt><dd>{state.blocker.owner}</dd></div>
                <div><dt>Finance owner</dt><dd>{state.blocker.financeOwner}</dd></div>
                <div><dt>Due</dt><dd>{state.blocker.dueDate}</dd></div>
              </dl>
              <button
                className="button button-primary"
                data-qa="closeout-final-billing-start"
                disabled={isPending || state.blocker.state !== "unresolved"}
                onClick={() => run(() => startCloseoutFinalBillingReleaseAction({ blockerId: state.blocker.id }))}
                type="button"
              >
                Assess closeout requirements
              </button>
            </div>
          ) : null}

          {activeStep === "assess" ? (
            <div data-qa="closeout-final-billing-step-assess">
              <StepHeading eyebrow="Assess requirements" title="Confirm the release conditions" text="Record the closeout position before collecting evidence for review." />
              <label className="form-field-wide">
                <span>Assessment summary</span>
                <textarea data-qa="closeout-final-billing-assessment-input" onChange={(event) => setAssessmentSummary(event.target.value)} rows={3} value={assessmentSummary} />
              </label>
              <button
                className="button button-primary"
                data-qa="closeout-final-billing-save-assessment"
                disabled={isPending || state.blocker.state !== "in_progress"}
                onClick={() => run(() => saveCloseoutRequirementAssessmentAction({
                  blockerId: state.blocker.id,
                  acceptanceStatus: "accepted",
                  punchStatus: "accepted",
                  testEvidenceStatus: "accepted",
                  asBuiltRedlineStatus: "accepted",
                  closeoutDocumentStatus: "accepted",
                  finalBillingReleaseStatus: "ready",
                  assessmentSummary
                }))}
                type="button"
              >
                Save assessment
              </button>
            </div>
          ) : null}

          {activeStep === "evidence" ? (
            <div data-qa="closeout-final-billing-step-evidence">
              <StepHeading eyebrow="Add evidence" title="Attach closeout release proof" text="Add each required reference so the reviewer can approve the final billing release package." />
              <label className="form-field-wide">
                <span>Evidence reference</span>
                <input data-qa="closeout-final-billing-evidence-input" onChange={(event) => setEvidenceText(event.target.value)} value={evidenceText} />
              </label>
              <div className="guided-button-list">
                {state.blocker.evidenceRequirements.map((requirement) => (
                  <button
                    className={requirement.status === "attached" ? "button button-secondary" : "button button-primary"}
                    data-qa={`closeout-final-billing-add-evidence-${requirement.id}`}
                    disabled={isPending || !state.readiness.assessmentComplete || state.blocker.state === "resolved" || requirement.status === "attached"}
                    key={requirement.id}
                    onClick={() => run(() => addCloseoutEvidenceReferenceAction({
                      blockerId: state.blocker.id,
                      requirementId: requirement.id,
                      referenceText: `${evidenceText} - ${requirement.label}`,
                      referenceType: referenceTypeForRequirement(requirement.id)
                    }))}
                    type="button"
                  >
                    {requirement.status === "attached" ? `${requirement.label} added` : `Add ${requirement.label}`}
                  </button>
                ))}
              </div>
              {!state.readiness.assessmentComplete ? <p className="missing-callout">Save the closeout assessment before adding evidence.</p> : null}
              <p className="muted">{evidenceCompleteCount} of {state.blocker.evidenceRequirements.length} evidence items added.</p>
            </div>
          ) : null}

          {activeStep === "validate" ? (
            <div data-qa="closeout-final-billing-step-validate">
              <StepHeading eyebrow="Validate readiness" title="Check whether the release package is ready" text="Validation confirms the closeout evidence is complete before review is requested." />
              {!state.readiness.evidenceComplete ? <p className="missing-callout">Add all required closeout evidence before validating release readiness.</p> : null}
              <button
                className="button button-primary"
                data-qa="closeout-final-billing-validate"
                disabled={isPending || !state.readiness.assessmentComplete || state.blocker.state === "resolved"}
                onClick={() => run(() => validateCloseoutReleaseReadinessAction({ blockerId: state.blocker.id }))}
                type="button"
              >
                Validate readiness
              </button>
            </div>
          ) : null}

          {activeStep === "review" ? (
            <div data-qa="closeout-final-billing-step-review">
              <StepHeading eyebrow="Request approval" title="Send the release package for review" text="Closeout Finance Review must approve the package before final billing can be cleared." />
              {!state.readiness.readyForReview ? <p className="missing-callout">Validate release readiness before requesting closeout approval.</p> : null}
              <button
                className="button button-primary"
                data-qa="closeout-final-billing-submit-review"
                disabled={isPending || !state.readiness.readyForReview || state.blocker.state !== "ready_for_review"}
                onClick={() => run(() => submitCloseoutReleaseForReviewAction({ blockerId: state.blocker.id, assignedRole: "Closeout Finance Review" }))}
                type="button"
              >
                Submit for review
              </button>
            </div>
          ) : null}

          {activeStep === "decision" ? (
            <div data-qa="closeout-final-billing-step-decision">
              <StepHeading eyebrow="Record approval" title="Record the review decision" text="Approval is required before the final billing blocker can be cleared." />
              <label className="form-field-wide">
                <span>Decision note</span>
                <textarea data-qa="closeout-final-billing-decision-note" onChange={(event) => setDecisionNote(event.target.value)} rows={3} value={decisionNote} />
              </label>
              {state.blocker.state !== "review_pending" ? <p className="missing-callout">Submit the release package for review before recording approval.</p> : null}
              <button
                className="button button-primary"
                data-qa="closeout-final-billing-approve"
                disabled={isPending || state.blocker.state !== "review_pending"}
                onClick={() => run(() => recordCloseoutReleaseDecisionAction({ blockerId: state.blocker.id, decision: "approve", decisionNote }))}
                type="button"
              >
                Record approval
              </button>
            </div>
          ) : null}

          {activeStep === "clear" ? (
            <div data-qa="closeout-final-billing-step-clear">
              <StepHeading eyebrow="Release blocker" title="Release final billing and retainage" text="Clear the blocker after approval and record why the linked billing item can move." />
              <label className="form-field-wide">
                <span>Resolution note</span>
                <textarea data-qa="closeout-final-billing-resolution-note" onChange={(event) => setResolutionNote(event.target.value)} rows={3} value={resolutionNote} />
              </label>
              {!state.readiness.resolutionReady ? <p className="missing-callout">Approval and a resolution note are required before clearing final billing.</p> : null}
              <button
                className="button button-primary"
                data-qa="closeout-final-billing-clear"
                disabled={isPending || !state.readiness.resolutionReady || state.blocker.state === "resolved"}
                onClick={() => run(() => clearCloseoutFinalBillingBlockerAction({ blockerId: state.blocker.id, resolutionNote }))}
                type="button"
              >
                Clear final billing blocker
              </button>
            </div>
          ) : null}

          {activeStep === "outcome" ? (
            <section data-qa="closeout-final-billing-outcome">
              <section
                className="closeout-resolved-next-action"
                data-closeout-resolved-primary-surface="next-action"
                data-qa="closeout-final-billing-next-action"
              >
                <div>
                  <p className="eyebrow">Next action</p>
                  <h3>Continue final billing processing</h3>
                  <p>
                    Use the approved closeout package for final billing and retainage processing. Payment has not yet been recorded.
                  </p>
                </div>
                <Link className="button button-primary" data-qa="closeout-final-billing-open-billing" href="/billing#details-records">
                  Open Billing
                </Link>
              </section>
            </section>
          ) : null}
        </section>

        {!resolved ? (
          <aside className="workbench-support-panel closeout-workflow-support" aria-label="Closeout release support">
            <section>
              <span>Required now</span>
              <strong>{requiredNow}</strong>
            </section>
            <section>
              <span>Complete</span>
              <strong>{completedNow}</strong>
            </section>
            <section>
              <span>Next</span>
              <strong>{nextStep}</strong>
            </section>
          </aside>
        ) : null}
      </div>

      {message && !resolved ? <p className="missing-callout" data-qa="closeout-final-billing-message">{message}</p> : null}

      {!resolved ? (
        <details className="guided-supporting-details">
          <summary>Supporting closeout release details</summary>
          <dl className="completion-facts">
            <div><dt>Package</dt><dd>{state.blocker.closeoutPackageNumber}</dd></div>
            <div><dt>Evidence</dt><dd>{evidenceCompleteCount} of {state.blocker.evidenceRequirements.length}</dd></div>
            <div><dt>Review</dt><dd>{state.blocker.review?.status ?? "Not requested"}</dd></div>
            <div><dt>History</dt><dd>{state.blocker.history.length} event(s)</dd></div>
          </dl>
        </details>
      ) : null}
    </section>
  );
}

function StepHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function getCloseoutStep(state: CloseoutFinalBillingState, readiness: CloseoutFinalBillingActionState["readiness"]): CloseoutStepId {
  if (state === "resolved") return "outcome";
  if (state === "approved") return "clear";
  if (state === "review_pending") return "decision";
  if (state === "ready_for_review") return "review";
  if (readiness.evidenceComplete && state === "evidence_added") return "validate";
  if (state === "assessed" || state === "evidence_added") return "evidence";
  if (state === "in_progress") return "assess";
  return "understand";
}

function getCloseoutProgress(activeStep: CloseoutStepId, state: CloseoutFinalBillingState) {
  const steps: Array<{ id: CloseoutStepId; label: string }> = [
    { id: "assess", label: "Assess" },
    { id: "evidence", label: "Evidence" },
    { id: "validate", label: "Validate" },
    { id: "review", label: "Review" },
    { id: "decision", label: "Approve" },
    { id: "clear", label: "Release" }
  ];
  const activeId = activeStep === "understand"
    ? "assess"
    : activeStep === "outcome"
      ? "clear"
      : activeStep;
  const activeIndex = steps.findIndex((step) => step.id === activeId);
  return steps.map((step, index) => ({
    ...step,
    state: state === "resolved" || index < activeIndex
      ? "done"
      : index === activeIndex
        ? "current"
        : "locked"
  }));
}

function deriveRequiredNow(state: CloseoutFinalBillingActionState) {
  if (state.blocker.state === "resolved") return "No blocker-clearance action required.";
  if (!state.readiness.assessmentComplete) return "Confirm acceptance, punch, tests, documents, and final billing release conditions.";
  if (!state.readiness.evidenceComplete) return "Add every required closeout evidence reference.";
  if (!state.readiness.readyForReview) return "Validate that the release package is ready for approval.";
  if (state.blocker.state === "ready_for_review") return "Send the release package to Closeout Finance Review.";
  if (state.blocker.state === "review_pending") return "Record the approval decision.";
  if (!state.readiness.resolutionReady) return "Add the resolution note required for release.";
  return "Clear the final billing blocker.";
}

function deriveCompletedNow(state: CloseoutFinalBillingActionState) {
  if (state.blocker.state === "resolved") return "Closeout blocker cleared and billing projection updated.";
  if (state.readiness.approvedForRelease) return "Approval recorded.";
  if (state.blocker.state === "review_pending") return "Release package sent for review.";
  if (state.readiness.readyForReview) return "Release readiness validated.";
  if (state.readiness.evidenceComplete) return "All required evidence references added.";
  if (state.readiness.assessmentComplete) return "Closeout release assessment saved.";
  return "The closeout blocker is identified.";
}

function deriveNextStep(state: CloseoutFinalBillingActionState) {
  if (state.blocker.state === "resolved") return "Resolved and recorded.";
  if (!state.readiness.assessmentComplete) return "Save the closeout assessment.";
  if (!state.readiness.evidenceComplete) return "Attach all required closeout evidence.";
  if (state.blocker.state !== "ready_for_review" && state.blocker.state !== "review_pending" && state.blocker.state !== "approved") return "Validate release readiness.";
  if (state.blocker.state === "ready_for_review") return "Submit the release package for review.";
  if (state.blocker.state === "review_pending") return "Record the closeout release decision.";
  if (!state.readiness.approvedForRelease) return "Approval is required before clearance.";
  return "Ready to clear final billing and retainage blocker.";
}

function referenceTypeForRequirement(requirementId: string): CloseoutEvidenceReference["referenceType"] {
  if (requirementId.includes("photos")) return "punch_photo";
  if (requirementId.includes("waiver")) return "lien_waiver";
  return "billing_reference";
}
