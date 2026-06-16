import type {
  BillingBackupPackage,
  BillingReviewPackageSummary,
  BillingV2Event,
  BillingV2EventType,
  BillingV2State
} from "./types";

export const billingV2StateLabels: Record<BillingV2State, string> = {
  blocked: "Blocked",
  backup_package_in_progress: "Backup package in progress",
  evidence_required: "Evidence required",
  package_ready_for_review: "Ready for commercial review",
  commercial_review_pending: "Commercial review pending",
  commercial_review_approved: "Commercial review approved",
  commercial_review_changes_requested: "Changes requested",
  commercial_review_rejected: "Commercial review rejected",
  billing_blocker_cleared: "Billing blocker cleared",
  reopened: "Reopened"
};

export const billingV2EventMessages: Record<BillingV2EventType, string> = {
  BillingBackupPackageStarted: "Billing backup package started.",
  BillingBackupSummarySaved: "Backup summary saved.",
  BillingSourceRecordSaved: "Source record linked.",
  BillingAmountAffectedSaved: "Amount affected saved.",
  BillingReviewNoteSaved: "Review note saved.",
  BillingEvidenceReferenceSaved: "Evidence reference saved.",
  BillingEvidenceRequirementWaived: "Evidence requirement waived with reason.",
  BillingPackageReadinessValidated: "Package readiness validated.",
  BillingCommercialReviewTaskCreated: "Commercial review task created.",
  BillingCommercialReviewApproved: "Commercial review approved.",
  BillingCommercialReviewChangesRequested: "Changes requested. Update the package before resubmitting.",
  BillingCommercialReviewRejected: "Commercial review rejected.",
  BillingResolutionNoteSaved: "Resolution note saved.",
  BillingBlockerCleared: "Billing blocker cleared.",
  BillingBlockerReopened: "Billing backup package reopened.",
  BillingOutcomeRecordGenerated: "Billing outcome record generated.",
  BillingHistoricalRecordGenerated: "Billing historical record generated."
};

export function getBillingV2StateDisplayLabel(state: BillingV2State): string {
  return billingV2StateLabels[state];
}

export function getBillingTimestamp(commandTime: string | undefined, billingPackage: BillingBackupPackage): string {
  return commandTime ?? billingPackage.updatedAt;
}

export function getNextBillingSequenceId(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

export function createBillingEvent(
  billingPackage: BillingBackupPackage,
  type: BillingV2EventType,
  actorId: string,
  occurredAt: string,
  fromState?: BillingV2State,
  toState?: BillingV2State,
  payload?: BillingV2Event["payload"],
  message = billingV2EventMessages[type]
): BillingV2Event {
  return {
    id: getNextBillingSequenceId(`${billingPackage.id}-event`, billingPackage.events.length),
    type,
    packageId: billingPackage.id,
    actorId,
    occurredAt,
    fromState,
    toState,
    message,
    payload
  };
}

export function createBillingReviewPackageSummary(billingPackage: BillingBackupPackage): BillingReviewPackageSummary {
  if (!billingPackage.relatedSourceRecord) {
    throw new Error("Related source record is required before review summary can be created.");
  }

  return {
    packageId: billingPackage.id,
    payApplicationLabel: billingPackage.payApplicationLabel,
    blockedAmount: billingPackage.blockedAmount,
    currency: billingPackage.currency,
    backupSummary: billingPackage.backupSummary ?? "",
    relatedSourceRecord: billingPackage.relatedSourceRecord,
    amountAffected: billingPackage.amountAffected ?? 0,
    evidenceSummary: billingPackage.evidenceRequirements.map((requirement) => ({
      requirementId: requirement.id,
      label: requirement.label,
      status: requirement.status,
      referenceText: requirement.reference?.referenceText,
      waiverReason: requirement.waiverReason
    }))
  };
}
