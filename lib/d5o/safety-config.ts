import type { SafetyIncidentType, SafetyObservationType, SafetyQualityStatus, SafetySeverity } from "./types";

export const safetyStatusLabels: Record<SafetyQualityStatus, string> = {
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

export const safetyStatusTone: Record<SafetyQualityStatus, string> = {
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

export const safetySeverityLabels: Record<SafetySeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const safetySeverityTone: Record<SafetySeverity, string> = {
  low: "info",
  medium: "warning",
  high: "critical",
  critical: "critical"
};

export const safetyObservationTypeLabels: Record<SafetyObservationType, string> = {
  positive: "Positive Observation",
  at_risk_condition: "At-Risk Condition",
  at_risk_behavior: "At-Risk Behavior",
  near_miss: "Near Miss",
  incident: "Incident",
  stop_work: "Stop Work"
};

export const safetyIncidentTypeLabels: Record<SafetyIncidentType, string> = {
  near_miss: "Near Miss",
  first_aid: "First Aid",
  recordable: "Recordable",
  property_damage: "Property Damage",
  utility_strike: "Utility Strike",
  vehicle_equipment: "Vehicle / Equipment",
  environmental: "Environmental"
};

export const safetyHelperText = {
  jha:
    "JHAs and toolbox talks prove the crew reviewed hazards, controls, PPE, access, and emergency expectations before work starts.",
  correctiveAction:
    "Corrective actions must stay assigned and verified so safety risk does not move unresolved into the next shift.",
  closeout:
    "Safety records can affect final acceptance when unresolved incidents, stop-work actions, or required evidence remain open."
};
