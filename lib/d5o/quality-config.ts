import type {
  QualityInspectionType,
  QualityPassFailResult,
  QualitySeverity,
  SafetyQualityStatus,
  TestRecordType
} from "./types";

export const qualityStatusLabels: Record<SafetyQualityStatus, string> = {
  not_started: "Not Started",
  draft: "Draft",
  scheduled: "Scheduled",
  open: "Open",
  in_progress: "In Progress",
  submitted: "Submitted",
  under_review: "Under Review",
  passed: "Passed",
  failed: "Failed",
  corrected: "Corrected",
  verified: "Verified",
  closed: "Closed",
  overdue: "Overdue",
  blocked: "Blocked"
};

export const qualityStatusTone: Record<SafetyQualityStatus, string> = {
  not_started: "neutral",
  draft: "info",
  scheduled: "info",
  open: "warning",
  in_progress: "warning",
  submitted: "info",
  under_review: "warning",
  passed: "success",
  failed: "critical",
  corrected: "warning",
  verified: "success",
  closed: "neutral",
  overdue: "critical",
  blocked: "blocked"
};

export const qualitySeverityLabels: Record<QualitySeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const qualitySeverityTone: Record<QualitySeverity, string> = {
  low: "info",
  medium: "warning",
  high: "critical",
  critical: "critical"
};

export const inspectionTypeLabels: Record<QualityInspectionType, string> = {
  conduit_depth: "Conduit Depth",
  fiber_test: "Fiber Test",
  rack_integration: "Rack Integration",
  structured_cabling: "Structured Cabling",
  grounding_bonding: "Grounding / Bonding",
  restoration: "Restoration",
  photo_documentation: "Photo Documentation",
  general: "General"
};

export const testTypeLabels: Record<TestRecordType, string> = {
  otdr: "OTDR",
  copper_certification: "Copper Certification",
  fiber_power_meter: "Fiber Power Meter",
  grounding: "Grounding",
  continuity: "Continuity",
  photo_evidence: "Photo Evidence",
  conduit_mandrel: "Conduit Mandrel",
  other: "Other"
};

export const passFailLabels: Record<QualityPassFailResult, string> = {
  not_recorded: "Not Recorded",
  pass: "Pass",
  pass_with_notes: "Pass with Notes",
  fail: "Fail"
};

export const qualityHelperText = {
  inspections:
    "Inspections and tests should happen while work is visible, before correction is expensive or closeout proof is missing.",
  deficiencies:
    "Deficiencies must be assigned, corrected, and verified so rework does not become acceptance, billing, or closeout risk.",
  closeout:
    "Test records, required photos, punch closure, and inspection results become the D5 acceptance evidence set."
};
