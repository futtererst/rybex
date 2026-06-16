import type {
  BillingBackupType,
  CommercialExposureStatus,
  LienWaiverStatus,
  LienWaiverType,
  PayApplicationStatus
} from "./types";

type Tone = "success" | "warning" | "critical" | "info" | "neutral" | "blocked";

export const payApplicationStatusLabels: Record<PayApplicationStatus, string> = {
  draft: "Draft",
  ready_for_review: "Ready for Review",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  partially_paid: "Partially Paid",
  aging: "Aging",
  disputed: "Disputed",
  closed: "Closed"
};

export const payApplicationStatusTone: Record<PayApplicationStatus, Tone> = {
  draft: "neutral",
  ready_for_review: "info",
  submitted: "warning",
  approved: "success",
  rejected: "critical",
  paid: "success",
  partially_paid: "warning",
  aging: "critical",
  disputed: "blocked",
  closed: "success"
};

export const lienWaiverStatusLabels: Record<LienWaiverStatus, string> = {
  not_required: "Not Required",
  required: "Required",
  pending: "Pending",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  missing: "Missing"
};

export const lienWaiverStatusTone: Record<LienWaiverStatus, Tone> = {
  not_required: "neutral",
  required: "warning",
  pending: "warning",
  submitted: "info",
  accepted: "success",
  rejected: "critical",
  missing: "critical"
};

export const waiverTypeLabels: Record<LienWaiverType, string> = {
  conditional_progress: "Conditional Progress",
  unconditional_progress: "Unconditional Progress",
  conditional_final: "Conditional Final",
  unconditional_final: "Unconditional Final"
};

export const commercialExposureStatusLabels: Record<CommercialExposureStatus, string> = {
  open: "Open",
  notice_at_risk: "Notice at Risk",
  backup_missing: "Backup Missing",
  pricing_pending: "Pricing Pending",
  approval_pending: "Approval Pending",
  approved_not_billed: "Approved Not Billed",
  disputed: "Disputed",
  rejected: "Rejected",
  recovered: "Recovered",
  written_off: "Written Off"
};

export const commercialExposureStatusTone: Record<CommercialExposureStatus, Tone> = {
  open: "warning",
  notice_at_risk: "critical",
  backup_missing: "critical",
  pricing_pending: "warning",
  approval_pending: "warning",
  approved_not_billed: "critical",
  disputed: "blocked",
  rejected: "critical",
  recovered: "success",
  written_off: "neutral"
};

export const billingBackupTypeLabels: Record<BillingBackupType, string> = {
  daily_report: "Daily Report",
  quantity_record: "Quantity Record",
  photo: "Photo Evidence",
  test_report: "Test Report",
  approved_change: "Approved Change",
  tm_ticket: "T&M Ticket",
  submittal_approval: "Submittal Approval",
  gc_direction: "GC Direction",
  rfi_response: "RFI Response",
  lien_waiver: "Lien Waiver",
  closeout_evidence: "Closeout Evidence"
};

export const billingBackupStatusLabels = {
  missing: "Missing",
  partial: "Partial",
  complete: "Complete",
  verified: "Verified"
} as const;

export const billingBackupStatusTone = {
  missing: "critical",
  partial: "warning",
  complete: "success",
  verified: "success"
} as const;

export const billingHelperText =
  "Approved changes should be included in the next eligible pay application so recovered margin does not sit unbilled.";
