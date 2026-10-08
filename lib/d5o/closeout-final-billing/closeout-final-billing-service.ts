import type { OperatingSliceHistoryEvent } from "../operating-slices/types";
import type {
  CloseoutEvidenceReference,
  CloseoutEvidenceStatus,
  CloseoutFinalBillingBlocker,
  CloseoutFinalBillingCommandResult,
  CloseoutFinalBillingReadiness,
  CloseoutReleaseDecision
} from "./types";

type ActorInput = {
  actorId: string;
};

type AssessmentInput = ActorInput & {
  acceptanceStatus: CloseoutEvidenceStatus;
  punchStatus: CloseoutEvidenceStatus;
  testEvidenceStatus: CloseoutEvidenceStatus;
  asBuiltRedlineStatus: CloseoutEvidenceStatus;
  closeoutDocumentStatus: CloseoutEvidenceStatus;
  finalBillingReleaseStatus: "blocked" | "ready" | "released";
  assessmentSummary: string;
};

type EvidenceInput = ActorInput & {
  requirementId: string;
  referenceText: string;
  referenceType: CloseoutEvidenceReference["referenceType"];
};

type SubmitReviewInput = ActorInput & {
  assignedRole: string;
};

type ReviewDecisionInput = {
  reviewerId: string;
  decision: CloseoutReleaseDecision;
  decisionNote: string;
};

type ClearInput = ActorInput & {
  resolutionNote: string;
};

function now() {
  return new Date().toISOString();
}

function clone(blocker: CloseoutFinalBillingBlocker): CloseoutFinalBillingBlocker {
  return JSON.parse(JSON.stringify(blocker)) as CloseoutFinalBillingBlocker;
}

function event(type: string, actorId: string, message: string): OperatingSliceHistoryEvent {
  const createdAt = now();
  return {
    id: `${type}-${createdAt}`,
    type,
    actorId,
    message,
    createdAt
  };
}

function result(
  success: boolean,
  blocker: CloseoutFinalBillingBlocker,
  message: string,
  events: OperatingSliceHistoryEvent[] = []
): CloseoutFinalBillingCommandResult {
  return {
    success,
    ok: success,
    message,
    blocker,
    readiness: evaluateCloseoutReleaseReadiness(blocker),
    impact: {
      openBlockerCount: blocker.state === "resolved" ? 0 : 1,
      resolvedBlockerCount: blocker.state === "resolved" ? 1 : 0,
      retainageAtRisk: blocker.state === "resolved" ? 0 : blocker.retainageExposureAmount,
      samePrimaryBlockerResolved: blocker.state === "resolved",
      billingProjectionStatus: blocker.billingProjection.status
    },
    events,
    error: success ? undefined : message
  };
}

function fail(blocker: CloseoutFinalBillingBlocker, message: string) {
  return result(false, blocker, message);
}

function appendEvent(
  blocker: CloseoutFinalBillingBlocker,
  historyEvent: OperatingSliceHistoryEvent,
  state: CloseoutFinalBillingBlocker["state"]
) {
  return {
    ...blocker,
    state,
    history: [...blocker.history, historyEvent],
    updatedAt: historyEvent.createdAt
  };
}

function requireStarted(blocker: CloseoutFinalBillingBlocker) {
  if (blocker.state === "unresolved") return "Start closeout final billing release before completing this step.";
  if (blocker.state === "resolved") return "Closeout final billing release is already resolved.";
  return "";
}

export function evaluateCloseoutReleaseReadiness(blocker: CloseoutFinalBillingBlocker): CloseoutFinalBillingReadiness {
  const assessmentComplete = Boolean(blocker.assessment);
  const requiredEvidence = blocker.evidenceRequirements.filter((requirement) => requirement.required);
  const attachedRequirementIds = new Set(blocker.evidenceReferences.map((reference) => reference.requirementId));
  const evidenceComplete = requiredEvidence.every((requirement) => attachedRequirementIds.has(requirement.id));
  const approvedForRelease = blocker.review?.status === "approved";
  const missing = [
    !assessmentComplete ? "Closeout requirement assessment" : "",
    !evidenceComplete ? "Required closeout evidence" : "",
    blocker.review?.status === "rejected" ? "Approved closeout release review" : ""
  ].filter(Boolean);

  return {
    assessmentComplete,
    evidenceComplete,
    readyForReview: assessmentComplete && evidenceComplete && blocker.review?.status !== "rejected",
    approvedForRelease,
    resolutionReady: assessmentComplete && evidenceComplete && approvedForRelease && blocker.state !== "resolved",
    missing
  };
}

export function startCloseoutFinalBillingRelease(blocker: CloseoutFinalBillingBlocker, input: ActorInput) {
  const current = clone(blocker);
  if (current.state === "resolved") return fail(current, "Resolved closeout blockers cannot be restarted.");
  if (current.state !== "unresolved") {
    return result(true, current, "Closeout final billing release is already active.");
  }

  const historyEvent = event("closeout_release_started", input.actorId, "Closeout final billing release started.");
  return result(true, appendEvent(current, historyEvent, "in_progress"), "Closeout final billing release started.", [historyEvent]);
}

export function saveCloseoutRequirementAssessment(blocker: CloseoutFinalBillingBlocker, input: AssessmentInput) {
  const current = clone(blocker);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!input.assessmentSummary.trim()) return fail(current, "Assessment summary is required.");

  const createdAt = now();
  const historyEvent = event("closeout_assessment_saved", input.actorId, "Closeout final billing assessment saved.");
  return result(true, appendEvent({
    ...current,
    assessment: {
      acceptanceStatus: input.acceptanceStatus,
      punchStatus: input.punchStatus,
      testEvidenceStatus: input.testEvidenceStatus,
      asBuiltRedlineStatus: input.asBuiltRedlineStatus,
      closeoutDocumentStatus: input.closeoutDocumentStatus,
      finalBillingReleaseStatus: input.finalBillingReleaseStatus,
      assessmentSummary: input.assessmentSummary.trim(),
      assessedBy: input.actorId,
      assessedAt: createdAt
    }
  }, historyEvent, "assessed"), "Closeout requirement assessment saved.", [historyEvent]);
}

export function addCloseoutEvidenceReference(blocker: CloseoutFinalBillingBlocker, input: EvidenceInput) {
  const current = clone(blocker);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!current.assessment) return fail(current, "Save the closeout assessment before adding evidence.");
  const requirement = current.evidenceRequirements.find((item) => item.id === input.requirementId);
  if (!requirement) return fail(current, "Evidence requirement was not found.");
  if (!input.referenceText.trim()) return fail(current, "Evidence reference is required.");

  const createdAt = now();
  const reference: CloseoutEvidenceReference = {
    id: `closeout-evidence-${current.evidenceReferences.length + 1}`,
    requirementId: input.requirementId,
    referenceText: input.referenceText.trim(),
    referenceType: input.referenceType,
    actorId: input.actorId,
    createdAt
  };
  const historyEvent = event("closeout_evidence_added", input.actorId, `Evidence added: ${requirement.label}.`);

  return result(true, appendEvent({
    ...current,
    evidenceReferences: [...current.evidenceReferences, reference],
    evidenceRequirements: current.evidenceRequirements.map((item) =>
      item.id === input.requirementId ? { ...item, status: "attached" } : item
    )
  }, historyEvent, "evidence_added"), "Closeout evidence reference added.", [historyEvent]);
}

export function validateCloseoutReleaseReadiness(blocker: CloseoutFinalBillingBlocker, input: ActorInput) {
  const current = clone(blocker);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!current.assessment) return fail(current, "Cannot validate readiness before assessment is saved.");

  const readiness = evaluateCloseoutReleaseReadiness(current);
  if (!readiness.evidenceComplete) return fail(current, `Cannot validate release readiness until ${readiness.missing.join(", ")} is complete.`);

  const historyEvent = event("closeout_readiness_validated", input.actorId, "Closeout release readiness validated.");
  return result(true, appendEvent(current, historyEvent, "ready_for_review"), "Closeout release readiness validated.", [historyEvent]);
}

export function submitCloseoutReleaseForReview(blocker: CloseoutFinalBillingBlocker, input: SubmitReviewInput) {
  const current = clone(blocker);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (current.state !== "ready_for_review") return fail(current, "Validate release readiness before submitting for review.");

  const historyEvent = event("closeout_review_submitted", input.actorId, "Closeout release package submitted for review.");
  return result(true, appendEvent({
    ...current,
    review: {
      id: `closeout-review-${current.id}`,
      status: "pending",
      assignedRole: input.assignedRole,
      submittedBy: input.actorId,
      submittedAt: historyEvent.createdAt
    }
  }, historyEvent, "review_pending"), "Closeout release package submitted for review.", [historyEvent]);
}

export function recordCloseoutReleaseDecision(blocker: CloseoutFinalBillingBlocker, input: ReviewDecisionInput) {
  const current = clone(blocker);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!current.review || current.review.status !== "pending") return fail(current, "Submit the closeout release package before recording a decision.");
  if (!input.decisionNote.trim()) return fail(current, "Decision note is required.");

  const approved = input.decision === "approve";
  const historyEvent = event(
    approved ? "closeout_review_approved" : "closeout_review_rejected",
    input.reviewerId,
    approved ? "Closeout release approved." : "Closeout release rejected."
  );

  return result(true, appendEvent({
    ...current,
    review: {
      ...current.review,
      status: approved ? "approved" : "rejected",
      decidedBy: input.reviewerId,
      decidedAt: historyEvent.createdAt,
      decisionNote: input.decisionNote.trim()
    }
  }, historyEvent, approved ? "approved" : "rejected"), approved ? "Closeout release approved." : "Closeout release rejected.", [historyEvent]);
}

export function clearCloseoutFinalBillingBlocker(blocker: CloseoutFinalBillingBlocker, input: ClearInput) {
  const current = clone(blocker);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!input.resolutionNote.trim()) return fail(current, "Resolution note is required.");

  const readiness = evaluateCloseoutReleaseReadiness(current);
  if (!readiness.approvedForRelease) return fail(current, "Closeout release must be approved before final billing blocker can be cleared.");
  if (!readiness.resolutionReady) return fail(current, `Cannot clear closeout blocker until ${readiness.missing.join(", ")} is complete.`);

  const historyEvent = event("closeout_final_billing_cleared", input.actorId, "Closeout final billing blocker cleared.");
  const billingProjection = {
    ...current.billingProjection,
    status: "approved_for_processing" as const,
    message: "Final billing and retainage processing are unblocked by closeout approval; payment has not yet been recorded."
  };

  return result(true, appendEvent({
    ...current,
    resolutionNote: input.resolutionNote.trim(),
    billingProjection,
    outcomeRecord: {
      id: `closeout-outcome-${current.id}`,
      outcome: "Closeout final billing release approved; final billing and retainage blocker cleared.",
      resolvedBy: input.actorId,
      resolvedAt: historyEvent.createdAt,
      resolutionNote: input.resolutionNote.trim(),
      billingProjection
    }
  }, historyEvent, "resolved"), "Closeout final billing blocker cleared.", [historyEvent]);
}
