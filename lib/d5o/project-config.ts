import type { BaselineStatus, ContractStatus, ProjectLaunchDecision } from "./types";

export const contractStatusLabels: Record<ContractStatus, string> = {
  not_started: "Not Started",
  draft_received: "Draft Received",
  under_review: "Under Review",
  redlines_required: "Redlines Required",
  approved: "Approved",
  executed: "Executed",
  blocked: "Blocked"
};

export const contractStatusTone: Record<ContractStatus, string> = {
  not_started: "neutral",
  draft_received: "info",
  under_review: "warning",
  redlines_required: "critical",
  approved: "success",
  executed: "success",
  blocked: "blocked"
};

export const baselineStatusLabels: Record<BaselineStatus, string> = {
  not_started: "Not Started",
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  blocked: "Blocked"
};

export const baselineStatusTone: Record<BaselineStatus, string> = {
  not_started: "neutral",
  draft: "info",
  under_review: "warning",
  approved: "success",
  blocked: "blocked"
};

export const launchDecisionLabels: Record<ProjectLaunchDecision, string> = {
  ready_for_mobilization_planning: "Ready for Mobilization Planning",
  hold_for_contract_review: "Hold for Contract Review",
  hold_for_scope_clarification: "Hold for Scope Clarification",
  hold_for_budget_baseline: "Hold for Budget Baseline",
  hold_for_schedule_alignment: "Hold for Schedule Alignment",
  blocked: "Blocked"
};

export const launchDecisionTone: Record<ProjectLaunchDecision, string> = {
  ready_for_mobilization_planning: "success",
  hold_for_contract_review: "critical",
  hold_for_scope_clarification: "warning",
  hold_for_budget_baseline: "warning",
  hold_for_schedule_alignment: "warning",
  blocked: "blocked"
};
