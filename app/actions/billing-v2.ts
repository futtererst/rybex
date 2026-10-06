"use server";

import {
  attachBillingBackupEvidence,
  clearBillingBlocker,
  createOrStartBillingBackupPackage,
  getBillingV2ActionState,
  recordBillingCommercialReviewDecision,
  saveBillingBackupPackageDetails,
  sendBillingBackupToCommercialReview,
  validateBillingBackupPackage
} from "@/lib/d5o/billing-v2/store";
import { requireRequestContext } from "@/lib/d5o/auth/request-context";
import { isProductionRuntime } from "@/lib/d5o/security/runtime-mode";
import type { BillingEvidenceReferenceType } from "@/lib/d5o/billing-v2/types";

export type BillingV2ServerActionResult = Awaited<ReturnType<typeof createOrStartBillingBackupPackage>>;

export async function startBillingBackupPackageAction(input: { packageId?: string }) {
  try {
    const actorId = await getBillingActorId("billing.edit");
    return createOrStartBillingBackupPackage({
      packageId: cleanOptional(input.packageId),
      actorId
    });
  } catch (error) {
    return actionError(error, input.packageId);
  }
}

export async function saveBillingBackupPackageDetailsAction(input: {
  packageId?: string;
  backupSummary: string;
  relatedSourceRecord: string;
  amountAffected: number;
}) {
  try {
    const actorId = await getBillingActorId("billing.edit");
    const backupSummary = cleanRequired(input.backupSummary, "Backup summary is required.");
    const relatedSourceRecord = cleanRequired(input.relatedSourceRecord, "Related source record is required.");

    if (!Number.isFinite(input.amountAffected) || input.amountAffected <= 0) {
      throw new Error("Amount affected must be greater than zero.");
    }

    return saveBillingBackupPackageDetails({
      packageId: cleanOptional(input.packageId),
      actorId,
      backupSummary,
      relatedSourceRecord,
      amountAffected: input.amountAffected
    });
  } catch (error) {
    return actionError(error, input.packageId);
  }
}

export async function attachBillingBackupEvidenceAction(input: {
  packageId?: string;
  evidenceRequirementId: string;
  referenceText?: string;
  referenceType?: BillingEvidenceReferenceType;
  linkedRecordId?: string;
  storagePointer?: string;
  waiverReason?: string;
}) {
  try {
    const actorId = await getBillingActorId("billing.edit");
    const evidenceRequirementId = cleanRequired(input.evidenceRequirementId, "Evidence requirement is required.");
    const referenceText = cleanOptional(input.referenceText);
    const waiverReason = cleanOptional(input.waiverReason);

    if (!referenceText && !waiverReason) {
      throw new Error("Evidence reference or waiver reason is required.");
    }

    return attachBillingBackupEvidence({
      packageId: cleanOptional(input.packageId),
      actorId,
      evidenceRequirementId,
      referenceText,
      referenceType: input.referenceType,
      linkedRecordId: cleanOptional(input.linkedRecordId),
      storagePointer: cleanOptional(input.storagePointer),
      waiverReason
    });
  } catch (error) {
    return actionError(error, input.packageId);
  }
}

export async function validateBillingBackupPackageAction(input: { packageId?: string }) {
  try {
    const actorId = await getBillingActorId("billing.edit");
    return validateBillingBackupPackage(cleanOptional(input.packageId), actorId);
  } catch (error) {
    return actionError(error, input.packageId);
  }
}

export async function sendBillingBackupToCommercialReviewAction(input: {
  packageId?: string;
  assignedRole?: string;
  dueDate?: string;
}) {
  try {
    const actorId = await getBillingActorId("billing.submit_review");
    return sendBillingBackupToCommercialReview({
      packageId: cleanOptional(input.packageId),
      actorId,
      assignedRole: cleanOptional(input.assignedRole) ?? "Commercial Review",
      dueDate: cleanOptional(input.dueDate)
    });
  } catch (error) {
    return actionError(error, input.packageId);
  }
}

export async function recordBillingCommercialReviewDecisionAction(input: {
  packageId?: string;
  reviewTaskId?: string;
  decision: "approve" | "changes" | "reject";
  decisionNote: string;
}) {
  try {
    const reviewerId = await getBillingActorId("billing.record_decision");
    const decisionNote = cleanRequired(input.decisionNote, "Decision note is required.");

    return recordBillingCommercialReviewDecision({
      packageId: cleanOptional(input.packageId),
      reviewTaskId: cleanOptional(input.reviewTaskId),
      reviewerId,
      decision: input.decision,
      decisionNote
    });
  } catch (error) {
    return actionError(error, input.packageId);
  }
}

export async function clearBillingBlockerAction(input: {
  packageId?: string;
  resolutionNote: string;
}) {
  try {
    const actorId = await getBillingActorId("billing.clear_blocker");
    return clearBillingBlocker({
      packageId: cleanOptional(input.packageId),
      actorId,
      resolutionNote: cleanRequired(input.resolutionNote, "Resolution note is required.")
    });
  } catch (error) {
    return actionError(error, input.packageId);
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

async function getBillingActorId(permission: Parameters<typeof requireRequestContext>[0]) {
  const context = await requireRequestContext(permission);

  return context.user?.name ?? context.user?.id ?? "Authenticated billing user";
}

async function actionError(error: unknown, packageId?: string) {
  const message = error instanceof Error ? error.message : "Billing V2 action failed.";
  if (isProductionRuntime()) {
    return {
      success: false,
      ok: false,
      message,
      error: message
    } as Awaited<ReturnType<typeof getBillingV2ActionState>> & {
      success: false;
      ok: false;
      message: string;
      error: string;
    };
  }
  const state = await getBillingV2ActionState(cleanOptional(packageId));

  return {
    ...state,
    success: false,
    ok: false,
    message,
    error: message
  };
}
