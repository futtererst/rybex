"use server";

import {
  addCloseoutEvidenceReference,
  clearCloseoutFinalBillingBlocker,
  getCloseoutFinalBillingActionState,
  recordCloseoutReleaseDecision,
  saveCloseoutRequirementAssessment,
  startCloseoutFinalBillingRelease,
  submitCloseoutReleaseForReview,
  validateCloseoutReleaseReadiness
} from "@/lib/d5o/closeout-final-billing/store";
import { requireRequestContext } from "@/lib/d5o/auth/request-context";
import { isProductionRuntime } from "@/lib/d5o/security/runtime-mode";
import type {
  CloseoutEvidenceReference,
  CloseoutEvidenceStatus,
  CloseoutReleaseDecision
} from "@/lib/d5o/closeout-final-billing/types";

export type CloseoutFinalBillingServerActionResult = Awaited<ReturnType<typeof startCloseoutFinalBillingRelease>>;

export async function startCloseoutFinalBillingReleaseAction(input: { blockerId?: string }) {
  try {
    const actorId = await getCloseoutActorId("closeout.assess");
    return startCloseoutFinalBillingRelease({
      blockerId: cleanOptional(input.blockerId),
      actorId
    });
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

export async function saveCloseoutRequirementAssessmentAction(input: {
  blockerId?: string;
  acceptanceStatus: CloseoutEvidenceStatus;
  punchStatus: CloseoutEvidenceStatus;
  testEvidenceStatus: CloseoutEvidenceStatus;
  asBuiltRedlineStatus: CloseoutEvidenceStatus;
  closeoutDocumentStatus: CloseoutEvidenceStatus;
  finalBillingReleaseStatus: "blocked" | "ready" | "released";
  assessmentSummary: string;
}) {
  try {
    const actorId = await getCloseoutActorId("closeout.assess");
    return saveCloseoutRequirementAssessment({
      blockerId: cleanOptional(input.blockerId),
      actorId,
      acceptanceStatus: input.acceptanceStatus,
      punchStatus: input.punchStatus,
      testEvidenceStatus: input.testEvidenceStatus,
      asBuiltRedlineStatus: input.asBuiltRedlineStatus,
      closeoutDocumentStatus: input.closeoutDocumentStatus,
      finalBillingReleaseStatus: input.finalBillingReleaseStatus,
      assessmentSummary: cleanRequired(input.assessmentSummary, "Assessment summary is required.")
    });
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

export async function addCloseoutEvidenceReferenceAction(input: {
  blockerId?: string;
  requirementId: string;
  referenceText: string;
  referenceType?: CloseoutEvidenceReference["referenceType"];
}) {
  try {
    const actorId = await getCloseoutActorId("closeout.add_evidence");
    return addCloseoutEvidenceReference({
      blockerId: cleanOptional(input.blockerId),
      actorId,
      requirementId: cleanRequired(input.requirementId, "Evidence requirement is required."),
      referenceText: cleanRequired(input.referenceText, "Evidence reference is required."),
      referenceType: input.referenceType ?? "billing_reference"
    });
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

export async function validateCloseoutReleaseReadinessAction(input: { blockerId?: string }) {
  try {
    const actorId = await getCloseoutActorId("closeout.validate");
    return validateCloseoutReleaseReadiness(cleanOptional(input.blockerId), actorId);
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

export async function submitCloseoutReleaseForReviewAction(input: {
  blockerId?: string;
  assignedRole?: string;
}) {
  try {
    const actorId = await getCloseoutActorId("closeout.submit_review");
    return submitCloseoutReleaseForReview({
      blockerId: cleanOptional(input.blockerId),
      actorId,
      assignedRole: cleanOptional(input.assignedRole) ?? "Closeout Finance Review"
    });
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

export async function recordCloseoutReleaseDecisionAction(input: {
  blockerId?: string;
  decision: CloseoutReleaseDecision;
  decisionNote: string;
}) {
  try {
    const reviewerId = await getCloseoutActorId("closeout.record_decision");
    if (!["approve", "reject"].includes(input.decision)) throw new Error("Closeout review decision is invalid.");

    return recordCloseoutReleaseDecision({
      blockerId: cleanOptional(input.blockerId),
      reviewerId,
      decision: input.decision,
      decisionNote: cleanRequired(input.decisionNote, "Decision note is required.")
    });
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

export async function clearCloseoutFinalBillingBlockerAction(input: {
  blockerId?: string;
  resolutionNote: string;
}) {
  try {
    const actorId = await getCloseoutActorId("closeout.clear_blocker");
    return clearCloseoutFinalBillingBlocker({
      blockerId: cleanOptional(input.blockerId),
      actorId,
      resolutionNote: cleanRequired(input.resolutionNote, "Resolution note is required.")
    });
  } catch (error) {
    return actionError(error, input.blockerId);
  }
}

function cleanOptional(value: string | undefined) {
  const clean = value?.trim();
  return clean || undefined;
}

function cleanRequired(value: string | undefined, message: string) {
  const clean = cleanOptional(value);
  if (!clean) throw new Error(message);
  return clean;
}

async function getCloseoutActorId(permission: Parameters<typeof requireRequestContext>[0]) {
  const context = await requireRequestContext(permission);

  return context.user?.name ?? context.user?.id ?? "Authenticated closeout user";
}

async function actionError(error: unknown, blockerId?: string) {
  const message = error instanceof Error ? error.message : "Closeout final billing action failed.";
  if (isProductionRuntime()) {
    return {
      success: false,
      ok: false,
      message,
      error: message
    } as Awaited<ReturnType<typeof getCloseoutFinalBillingActionState>> & {
      success: false;
      ok: false;
      message: string;
      error: string;
    };
  }
  const state = await getCloseoutFinalBillingActionState(cleanOptional(blockerId));

  return {
    ...state,
    success: false,
    ok: false,
    message,
    error: message
  };
}
