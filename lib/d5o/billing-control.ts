import type {
  BillingBackupItem,
  ChangeEvent,
  CommercialExposureItem,
  LienWaiver,
  PayApplication
} from "./types";

const operatingDate = "2026-06-10";

export type BillingControlSummary = {
  billingReadinessScore: number;
  cashAtRisk: number;
  unbilledApprovedChangeValue: number;
  pendingChangeExposure: number;
  disputedChangeValue: number;
  retainageHeld: number;
  missingBackupItems: BillingBackupItem[];
  lienWaiverIssues: LienWaiver[];
  agingPayApplications: PayApplication[];
  rejectedOrDisputedItems: Array<PayApplication | CommercialExposureItem>;
  requiredActions: string[];
  nextActions: string[];
};

export function evaluateBillingControl({
  payApplications,
  backupItems,
  lienWaivers,
  commercialExposure,
  changeEvents
}: {
  payApplications: PayApplication[];
  backupItems: BillingBackupItem[];
  lienWaivers: LienWaiver[];
  commercialExposure: CommercialExposureItem[];
  changeEvents: ChangeEvent[];
}): BillingControlSummary {
  const duePayApps = payApplications.filter((payApp) =>
    ["draft", "ready_for_review"].includes(payApp.status) && payApp.paymentDueDate <= "2026-06-17"
  );
  const agingPayApplications = payApplications.filter((payApp) =>
    payApp.status === "aging" ||
    (payApp.status === "submitted" && daysSince(payApp.paymentDueDate) > 0)
  );
  const rejectedOrDisputedPayApps = payApplications.filter((payApp) =>
    ["rejected", "disputed"].includes(payApp.status)
  );
  const missingBackupItems = backupItems.filter(
    (item) => item.requiredForBilling && ["missing", "partial"].includes(item.status)
  );
  const lienWaiverIssues = lienWaivers.filter((waiver) =>
    ["required", "pending", "rejected", "missing"].includes(waiver.status)
  );
  const unbilledApprovedChangeValue = changeEvents
    .filter((event) => event.billingStatus === "approved_not_billed")
    .reduce((total, event) => total + event.approvedAmount, 0);
  const pendingChangeExposure = changeEvents
    .filter((event) =>
      ["pending_approval", "not_billable"].includes(event.billingStatus) &&
      !["rejected", "disputed"].includes(event.pricingStatus)
    )
    .reduce((total, event) => total + event.costImpactEstimate, 0);
  const disputedChangeValue = changeEvents.reduce(
    (total, event) => total + event.disputedAmount + event.rejectedAmount,
    0
  );
  const retainageHeld = payApplications.reduce(
    (total, payApp) => total + payApp.totalRetainageHeld,
    0
  );
  const exposureAtRisk = commercialExposure
    .filter((item) => !["recovered", "written_off"].includes(item.status))
    .reduce((total, item) => total + item.estimatedValue, 0);
  const cashAtRisk =
    unbilledApprovedChangeValue +
    pendingChangeExposure +
    disputedChangeValue +
    retainageHeld +
    exposureAtRisk;

  const checks = [
    duePayApps.length === 0,
    agingPayApplications.length === 0,
    rejectedOrDisputedPayApps.length === 0,
    missingBackupItems.length === 0,
    lienWaiverIssues.length === 0,
    unbilledApprovedChangeValue === 0,
    disputedChangeValue === 0
  ];

  return {
    billingReadinessScore: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    cashAtRisk,
    unbilledApprovedChangeValue,
    pendingChangeExposure,
    disputedChangeValue,
    retainageHeld,
    missingBackupItems,
    lienWaiverIssues,
    agingPayApplications,
    rejectedOrDisputedItems: [
      ...rejectedOrDisputedPayApps,
      ...commercialExposure.filter((item) => ["disputed", "rejected"].includes(item.status))
    ],
    requiredActions: [
      ...duePayApps.map((payApp) => `Prepare ${payApp.payApplicationNumber} for submission.`),
      ...agingPayApplications.map((payApp) => `Follow up on aging ${payApp.payApplicationNumber}.`),
      ...missingBackupItems.map((item) => `Complete billing backup: ${item.title}.`),
      ...lienWaiverIssues.map((waiver) => `Resolve lien waiver issue for ${waiver.payApplicationId}.`),
      ...(unbilledApprovedChangeValue > 0 ? ["Include approved changes in the next eligible pay application."] : [])
    ],
    nextActions: [
      ...payApplications.map((payApp) => payApp.nextAction),
      ...commercialExposure.map((item) => item.requiredAction)
    ].filter(Boolean)
  };
}

function daysSince(date: string) {
  const now = new Date(`${operatingDate}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);

  return Math.floor((now.getTime() - target.getTime()) / 86400000);
}
