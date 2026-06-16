import type {
  MobilizationDecision,
  MobilizationReadinessStatus,
  WorkPackageStatus
} from "./types";

export const mobilizationStatusLabels: Record<MobilizationReadinessStatus, string> = {
  not_started: "Not Started",
  planning: "Planning",
  awaiting_inputs: "Awaiting Inputs",
  blocked: "Blocked",
  ready_for_review: "Ready for Review",
  approved_for_field_start: "Approved for Field Start",
  field_started: "Field Started"
};

export const mobilizationStatusTone: Record<MobilizationReadinessStatus, string> = {
  not_started: "neutral",
  planning: "info",
  awaiting_inputs: "warning",
  blocked: "blocked",
  ready_for_review: "warning",
  approved_for_field_start: "success",
  field_started: "success"
};

export const mobilizationDecisionLabels: Record<MobilizationDecision, string> = {
  approve_field_start: "Approve Field Start",
  hold_for_safety: "Hold for Safety",
  hold_for_access_or_permits: "Hold for Access / Permits",
  hold_for_materials: "Hold for Materials",
  hold_for_crew_or_equipment: "Hold for Crew / Equipment",
  hold_for_work_packages: "Hold for Work Packages",
  hold_for_quality_requirements: "Hold for Quality Requirements",
  blocked: "Blocked"
};

export const mobilizationDecisionTone: Record<MobilizationDecision, string> = {
  approve_field_start: "success",
  hold_for_safety: "critical",
  hold_for_access_or_permits: "blocked",
  hold_for_materials: "warning",
  hold_for_crew_or_equipment: "warning",
  hold_for_work_packages: "warning",
  hold_for_quality_requirements: "warning",
  blocked: "blocked"
};

export const workPackageStatusLabels: Record<WorkPackageStatus, string> = {
  draft: "Draft",
  awaiting_inputs: "Awaiting Inputs",
  ready_for_field: "Ready for Field",
  in_progress: "In Progress",
  complete: "Complete",
  blocked: "Blocked"
};

export const workPackageStatusTone: Record<WorkPackageStatus, string> = {
  draft: "neutral",
  awaiting_inputs: "warning",
  ready_for_field: "success",
  in_progress: "info",
  complete: "success",
  blocked: "blocked"
};
