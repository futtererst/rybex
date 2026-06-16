import type {
  AcceptanceStatus,
  CloseoutDecision,
  CloseoutRequirementCategory,
  CloseoutRequirementStatus,
  CloseoutSourceModule,
  CloseoutStatus,
  RetainageReleaseStatus
} from "./types";

export const closeoutStatusLabels: Record<CloseoutStatus, string> = {
  not_started: "Not Started",
  assembling: "Assembling",
  missing_requirements: "Missing Requirements",
  ready_for_review: "Ready for Review",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  closed: "Closed",
  archived: "Archived"
};

export const closeoutStatusTone: Record<CloseoutStatus, string> = {
  not_started: "neutral",
  assembling: "info",
  missing_requirements: "critical",
  ready_for_review: "success",
  submitted: "info",
  accepted: "success",
  rejected: "critical",
  closed: "neutral",
  archived: "neutral"
};

export const acceptanceStatusLabels: Record<AcceptanceStatus, string> = {
  not_submitted: "Not Submitted",
  submitted: "Submitted",
  under_review: "Under Review",
  accepted: "Accepted",
  accepted_with_exceptions: "Accepted with Exceptions",
  rejected: "Rejected",
  closed: "Closed"
};

export const acceptanceStatusTone: Record<AcceptanceStatus, string> = {
  not_submitted: "warning",
  submitted: "info",
  under_review: "warning",
  accepted: "success",
  accepted_with_exceptions: "warning",
  rejected: "critical",
  closed: "neutral"
};

export const retainageReleaseStatusLabels: Record<RetainageReleaseStatus, string> = {
  not_ready: "Not Ready",
  blocked: "Blocked",
  pending_final_billing: "Pending Final Billing",
  pending_waiver: "Pending Waiver",
  submitted: "Submitted",
  released: "Released",
  disputed: "Disputed"
};

export const retainageReleaseStatusTone: Record<RetainageReleaseStatus, string> = {
  not_ready: "warning",
  blocked: "critical",
  pending_final_billing: "warning",
  pending_waiver: "warning",
  submitted: "info",
  released: "success",
  disputed: "critical"
};

export const closeoutRequirementStatusLabels: Record<CloseoutRequirementStatus, string> = {
  not_started: "Not Started",
  missing: "Missing",
  in_progress: "In Progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  waived: "Waived",
  blocked: "Blocked",
  archived: "Archived"
};

export const closeoutRequirementStatusTone: Record<CloseoutRequirementStatus, string> = {
  not_started: "neutral",
  missing: "critical",
  in_progress: "warning",
  submitted: "info",
  accepted: "success",
  rejected: "critical",
  waived: "neutral",
  blocked: "blocked",
  archived: "neutral"
};

export const closeoutRequirementCategoryLabels: Record<CloseoutRequirementCategory, string> = {
  as_built: "As-built",
  redline: "Redline",
  test_record: "Test Record",
  inspection: "Inspection",
  photo_evidence: "Photo Evidence",
  warranty: "Warranty",
  om_document: "O&M Document",
  certification: "Certification",
  submittal_closeout: "Submittal Closeout",
  rfi_closure: "RFI Closure",
  change_closure: "Change Closure",
  punch_item: "Punch Item",
  safety_record: "Safety Record",
  quality_record: "Quality Record",
  final_billing: "Final Billing",
  lien_waiver: "Lien Waiver",
  retainage_release: "Retainage Release",
  acceptance: "Acceptance",
  archive: "Archive"
};

export const closeoutSourceModuleLabels: Record<CloseoutSourceModule, string> = {
  projects: "Projects",
  field_execution: "Field Execution",
  safety: "Safety",
  quality: "Quality",
  rfis_submittals: "RFIs / Submittals",
  changes: "Changes",
  billing: "Billing",
  closeout: "Closeout"
};

export const closeoutDecisionLabels: Record<CloseoutDecision, string> = {
  continue_assembling: "Continue Assembling",
  hold_for_missing_documents: "Hold for Missing Documents",
  hold_for_punch_resolution: "Hold for Punch Resolution",
  hold_for_test_records: "Hold for Test Records",
  hold_for_as_builts: "Hold for As-builts",
  hold_for_change_closure: "Hold for Change Closure",
  hold_for_final_billing: "Hold for Final Billing",
  hold_for_retainage_requirements: "Hold for Retainage Requirements",
  submit_for_acceptance: "Submit for Acceptance",
  accepted_ready_to_archive: "Accepted / Ready to Archive"
};

export const closeoutHelperText = {
  evidence:
    "Closeout evidence should be captured during D4 field execution, not reconstructed after the crew has left.",
  commercial:
    "Approved but unbilled changes should be resolved before final billing and retainage release.",
  asBuilts:
    "As-builts and test records are acceptance evidence, not optional archive documents."
};
