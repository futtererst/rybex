import type {
  BackupStatus,
  BillingStatus,
  ChangeEventSource,
  ChangeEventStatus,
  ChangeType,
  PricingStatus
} from "./types";

type Tone = "success" | "warning" | "critical" | "info" | "neutral" | "blocked";

export const changeStatusLabels: Record<ChangeEventStatus, string> = {
  potential: "Potential",
  notice_required: "Notice Required",
  notice_submitted: "Notice Submitted",
  pricing_required: "Pricing Required",
  pricing_submitted: "Pricing Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  disputed: "Disputed",
  billed: "Billed",
  closed: "Closed"
};

export const changeStatusTone: Record<ChangeEventStatus, Tone> = {
  potential: "warning",
  notice_required: "critical",
  notice_submitted: "info",
  pricing_required: "warning",
  pricing_submitted: "info",
  under_review: "warning",
  approved: "success",
  rejected: "critical",
  disputed: "blocked",
  billed: "success",
  closed: "success"
};

export const sourceLabels: Record<ChangeEventSource, string> = {
  daily_report: "Daily Report",
  field_directive: "Field Directive",
  rfi_response: "RFI Response",
  changed_condition: "Changed Condition",
  owner_request: "Owner Request",
  gc_direction: "GC Direction",
  design_revision: "Design Revision",
  access_delay: "Access Delay",
  material_substitution: "Material Substitution",
  safety_requirement: "Safety Requirement",
  quality_correction: "Quality Correction",
  other: "Other"
};

export const changeTypeLabels: Record<ChangeType, string> = {
  scope_added: "Added Scope",
  changed_condition: "Changed Condition",
  delay: "Delay / Standby",
  acceleration: "Acceleration",
  rework: "Rework",
  substitution: "Substitution",
  allowance: "Allowance",
  documentation: "Documentation"
};

export const pricingStatusLabels: Record<PricingStatus, string> = {
  not_started: "Not Started",
  backup_needed: "Backup Needed",
  pricing_in_progress: "Pricing in Progress",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  disputed: "Disputed"
};

export const pricingStatusTone: Record<PricingStatus, Tone> = {
  not_started: "neutral",
  backup_needed: "critical",
  pricing_in_progress: "warning",
  submitted: "info",
  approved: "success",
  rejected: "critical",
  disputed: "blocked"
};

export const backupStatusLabels: Record<BackupStatus, string> = {
  missing: "Missing",
  partial: "Partial",
  complete: "Complete",
  verified: "Verified"
};

export const backupStatusTone: Record<BackupStatus, Tone> = {
  missing: "critical",
  partial: "warning",
  complete: "success",
  verified: "success"
};

export const billingStatusLabels: Record<BillingStatus, string> = {
  not_billable: "Not Billable",
  pending_approval: "Pending Approval",
  approved_not_billed: "Approved Not Billed",
  billed: "Billed",
  paid: "Paid",
  disputed: "Disputed"
};

export const billingStatusTone: Record<BillingStatus, Tone> = {
  not_billable: "neutral",
  pending_approval: "warning",
  approved_not_billed: "critical",
  billed: "info",
  paid: "success",
  disputed: "blocked"
};

export const changeCaptureHelperText =
  "Do not wait for final pricing to create a change event. Capture the event early so notice, backup, and entitlement are protected.";
