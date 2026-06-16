import type { BillingBackupPackage, BillingEvidenceRequirement } from "./types";

export const billingV2DemoTimestamp = "2026-06-16T09:00:00.000Z";

export const billingV2DemoEvidenceRequirements: BillingEvidenceRequirement[] = [
  {
    id: "signed-tm-ticket",
    label: "Signed T&M ticket",
    required: true,
    waiverAllowed: true,
    whyItMatters: "Confirms the billed work was authorized by the field and client-side signoff path.",
    status: "missing"
  },
  {
    id: "daily-report-reference",
    label: "Daily report reference",
    required: true,
    waiverAllowed: false,
    whyItMatters: "Ties the billing backup to the field record that proves work occurred.",
    status: "missing"
  },
  {
    id: "photo-log-reference",
    label: "Photo log reference",
    required: true,
    waiverAllowed: true,
    whyItMatters: "Provides visual support for stored material or installed work.",
    status: "missing"
  },
  {
    id: "supervisor-confirmation",
    label: "Supervisor confirmation",
    required: true,
    waiverAllowed: true,
    whyItMatters: "Confirms the field owner agrees the backup package supports the billing item.",
    status: "missing"
  },
  {
    id: "product-approval-backup",
    label: "Product approval backup",
    required: true,
    waiverAllowed: false,
    whyItMatters: "Proves the product or stored material is approved for billing support.",
    status: "missing"
  },
  {
    id: "related-change-event",
    label: "Related change event if applicable",
    required: false,
    waiverAllowed: false,
    whyItMatters: "Connects the package to commercial recovery when the backup relates to a changed condition.",
    status: "not_required"
  }
];

export function createBillingV2DemoPackage(): BillingBackupPackage {
  return {
    id: "billing-v2-package-pay-app-003",
    workflowName: "Billing Backup Package -> Commercial Review -> Billing Blocker Cleared",
    businessProcess: "Billing backup completion and pay application review readiness",
    projectId: "project-lake-fiber",
    projectName: "Lake Street Fiber Backbone",
    payApplicationId: "pay-app-003",
    payApplicationLabel: "Pay App 003",
    title: "Pay App 003 backup package",
    blockerReason: "Pay App 003 is blocked because required backup documentation is missing or incomplete.",
    owner: "Billing / Commercial user",
    reviewerRole: "Commercial reviewer / Finance/Admin",
    state: "blocked",
    blockedAmount: 84000,
    currency: "USD",
    evidenceRequirements: billingV2DemoEvidenceRequirements.map((requirement) => ({ ...requirement })),
    events: [],
    history: [],
    localDemoOnly: true,
    databaseBacked: false,
    createdAt: billingV2DemoTimestamp,
    updatedAt: billingV2DemoTimestamp
  };
}
