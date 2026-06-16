import type { ControlDiscipline, ControlPriority, RfiStatus, SubmittalStatus } from "./types";

type Tone = "success" | "warning" | "critical" | "info" | "neutral" | "blocked";

export const rfiStatusLabels: Record<RfiStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  answered: "Answered",
  overdue: "Overdue",
  closed: "Closed",
  void: "Void"
};

export const rfiStatusTone: Record<RfiStatus, Tone> = {
  draft: "neutral",
  submitted: "info",
  under_review: "warning",
  answered: "success",
  overdue: "critical",
  closed: "success",
  void: "neutral"
};

export const submittalStatusLabels: Record<SubmittalStatus, string> = {
  not_started: "Not Started",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  approved_as_noted: "Approved as Noted",
  revise_and_resubmit: "Revise and Resubmit",
  rejected: "Rejected",
  overdue: "Overdue",
  closed: "Closed"
};

export const submittalStatusTone: Record<SubmittalStatus, Tone> = {
  not_started: "neutral",
  draft: "neutral",
  submitted: "info",
  under_review: "warning",
  approved: "success",
  approved_as_noted: "success",
  revise_and_resubmit: "critical",
  rejected: "critical",
  overdue: "critical",
  closed: "success"
};

export const priorityLabels: Record<ControlPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical"
};

export const priorityTone: Record<ControlPriority, Tone> = {
  low: "info",
  normal: "neutral",
  high: "warning",
  critical: "critical"
};

export const disciplineLabels: Record<ControlDiscipline, string> = {
  civil: "Civil",
  underground: "Underground",
  fiber: "Fiber",
  structured_cabling: "Structured Cabling",
  data_center: "Data Center",
  telecom: "Telecom",
  safety: "Safety",
  quality: "Quality",
  commercial: "Commercial",
  schedule: "Schedule"
};

export const rfiHelperText =
  "RFIs should be created when field work needs formal clarification that affects scope, cost, schedule, access, or method of work.";

export const submittalHelperText =
  "Submittals control whether materials, methods, tests, and procedures are approved before they block field execution or closeout.";
