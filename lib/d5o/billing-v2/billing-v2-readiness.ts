import type {
  BillingBackupPackage,
  BillingEvidenceRequirement,
  BillingPackageReadiness
} from "./types";

export const billingReadinessMessages = {
  sendToReviewBlocked: "Complete required evidence references before sending to commercial review.",
  readinessIncomplete: "Complete backup summary, source record, amount affected, and required evidence before review.",
  readinessPassed: "Package is ready for commercial review.",
  clearanceReadinessBlocked: "Complete required evidence references before clearing this blocker."
} as const;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export function isBillingEvidenceRequirementSatisfied(requirement: BillingEvidenceRequirement): boolean {
  if (!requirement.required) return true;

  if (["referenced", "attached", "verified"].includes(requirement.status)) {
    return Boolean(clean(requirement.reference?.referenceText));
  }

  if (requirement.status === "waived") {
    return Boolean(clean(requirement.waiverReason));
  }

  return false;
}

export function getBillingEvidenceRecordValue(requirement: BillingEvidenceRequirement): string {
  if (requirement.reference?.referenceText) return requirement.reference.referenceText;
  if (requirement.waiverReason) return `Waived: ${requirement.waiverReason}`;
  if (!requirement.required) return "Not required";
  return "Missing";
}

export function getBillingMissingReadinessItems(billingPackage: BillingBackupPackage): string[] {
  const missingItems: string[] = [];

  if (!clean(billingPackage.backupSummary)) {
    missingItems.push("Backup summary");
  }

  if (!clean(billingPackage.relatedSourceRecord?.label) || !clean(billingPackage.relatedSourceRecord?.type)) {
    missingItems.push("Related source record");
  }

  if (typeof billingPackage.amountAffected !== "number" || billingPackage.amountAffected <= 0) {
    missingItems.push("Amount affected");
  }

  for (const requirement of billingPackage.evidenceRequirements) {
    if (requirement.required && !isBillingEvidenceRequirementSatisfied(requirement)) {
      missingItems.push(requirement.label);
    }
  }

  return missingItems;
}

export function evaluateBillingPackageReadiness(billingPackage: BillingBackupPackage): BillingPackageReadiness {
  const missingItems = getBillingMissingReadinessItems(billingPackage);
  const satisfiedEvidenceIds: string[] = [];
  const waivedEvidenceIds: string[] = [];

  for (const requirement of billingPackage.evidenceRequirements) {
    if (isBillingEvidenceRequirementSatisfied(requirement)) {
      satisfiedEvidenceIds.push(requirement.id);
      if (requirement.status === "waived") waivedEvidenceIds.push(requirement.id);
    }
  }

  return {
    isReady: missingItems.length === 0,
    missingItems,
    satisfiedEvidenceIds,
    waivedEvidenceIds
  };
}
