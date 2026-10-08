import type {
  BillingBackupPackage,
  BillingBlockerResolution,
  BillingOutcomeRecord
} from "./types";

export function formatBillingCurrency(amount: number, currency: string): string {
  if (currency === "USD") {
    return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
}

export function getBillingNextBusinessStep(): string {
  return "Open pay application review/submission readiness.";
}

export function getRemainingBillingBlockers(): string[] {
  return [];
}

export function generateBillingBlockerResolution(
  billingPackage: BillingBackupPackage,
  clearedBy: string,
  clearedAt: string
): BillingBlockerResolution {
  return {
    id: `${billingPackage.id}-resolution-001`,
    packageId: billingPackage.id,
    resolutionNote: billingPackage.resolutionNote ?? "",
    clearedBy,
    clearedAt,
    fromState: billingPackage.state,
    toState: "billing_blocker_cleared",
    remainingBlockers: getRemainingBillingBlockers()
  };
}

export function generateBillingOutcomeText(billingPackage: BillingBackupPackage): string {
  return `Billing backup blocker resolved. ${billingPackage.payApplicationLabel} is ready for commercial review. The ${formatBillingCurrency(
    billingPackage.blockedAmount,
    billingPackage.currency
  )} cash recovery path is no longer blocked by missing backup for this item.`;
}

export function generateBillingOutcomeRecord(
  billingPackage: BillingBackupPackage,
  completedBy: string,
  completedAt: string
): BillingOutcomeRecord {
  if (!billingPackage.reviewDecision) {
    throw new Error("Review decision is required before generating a Billing v2 outcome record.");
  }

  return {
    id: `${billingPackage.id}-outcome-001`,
    packageId: billingPackage.id,
    workflowName: billingPackage.workflowName,
    businessProcess: billingPackage.businessProcess,
    businessObject: billingPackage.payApplicationLabel,
    owner: billingPackage.owner,
    completedBy,
    completedAt,
    blockedAmount: billingPackage.blockedAmount,
    currency: billingPackage.currency,
    backupPackageStatus: billingPackage.state,
    evidenceCaptured: billingPackage.evidenceRequirements.map((requirement) => ({
      label: requirement.label,
      status: requirement.status,
      referenceText: requirement.reference?.referenceText,
      waiverReason: requirement.waiverReason
    })),
    reviewDecision: billingPackage.reviewDecision,
    approvalNote: billingPackage.reviewDecision.decisionNote,
    blockerCleared: true,
    remainingBlockers: getRemainingBillingBlockers(),
    nextBusinessStep: getBillingNextBusinessStep(),
    localDemoOnly: billingPackage.localDemoOnly,
    databaseBacked: billingPackage.databaseBacked,
    outcome: generateBillingOutcomeText(billingPackage)
  };
}
