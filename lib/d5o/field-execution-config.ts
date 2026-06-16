import type {
  DailyReportStatus,
  FieldExecutionDecision,
  ProductionStatus
} from "./types";

type Tone = "success" | "warning" | "critical" | "info" | "neutral" | "blocked";

export const dailyReportStatusLabels: Record<DailyReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  supervisor_review: "Supervisor Review",
  approved: "Approved",
  rejected: "Rejected",
  missing: "Missing",
  late: "Late"
};

export const dailyReportStatusTone: Record<DailyReportStatus, Tone> = {
  draft: "neutral",
  submitted: "info",
  supervisor_review: "warning",
  approved: "success",
  rejected: "critical",
  missing: "critical",
  late: "critical"
};

export const productionStatusLabels: Record<ProductionStatus, string> = {
  ahead: "Ahead",
  on_plan: "On Plan",
  behind: "Behind",
  blocked: "Blocked",
  not_started: "Not Started",
  complete: "Complete"
};

export const productionStatusTone: Record<ProductionStatus, Tone> = {
  ahead: "success",
  on_plan: "success",
  behind: "warning",
  blocked: "blocked",
  not_started: "neutral",
  complete: "success"
};

export const fieldDecisionLabels: Record<FieldExecutionDecision, string> = {
  continue_work: "Continue Work",
  escalate_issue: "Escalate Issue",
  create_rfi: "Create RFI",
  create_change_event: "Create Change Event",
  create_safety_action: "Create Safety Action",
  create_quality_action: "Create Quality Action",
  hold_work: "Hold Work",
  ready_for_closeout_review: "Ready for Closeout Review"
};

export const fieldDecisionTone: Record<FieldExecutionDecision, Tone> = {
  continue_work: "success",
  escalate_issue: "warning",
  create_rfi: "warning",
  create_change_event: "critical",
  create_safety_action: "critical",
  create_quality_action: "critical",
  hold_work: "blocked",
  ready_for_closeout_review: "info"
};
