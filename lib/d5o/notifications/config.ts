import type { EscalationRule, NotificationCategory, NotificationSeverity, NotificationStatus } from "./types";

export const notificationCategoryLabels: Record<NotificationCategory, string> = {
  decision_required: "Decision required",
  gate_blocked: "Gate blocked",
  evidence_missing: "Evidence missing",
  evidence_overdue: "Evidence overdue",
  field_start_blocked: "Field start blocked",
  daily_report_missing: "Daily report missing",
  rfi_overdue: "RFI overdue",
  submittal_overdue: "Submittal overdue",
  notice_deadline_risk: "Notice deadline risk",
  change_backup_missing: "Change backup missing",
  billing_backup_missing: "Billing backup missing",
  cash_at_risk: "Cash at risk",
  safety_action_overdue: "Safety action overdue",
  quality_deficiency_overdue: "Quality deficiency overdue",
  closeout_blocked: "Closeout blocked",
  retainage_blocked: "Retainage blocked",
  optimization_action_overdue: "Optimize action overdue",
  system_readiness: "System readiness"
};

export const notificationSeverityTones: Record<NotificationSeverity, "critical" | "warning" | "info" | "success" | "neutral"> = {
  critical: "critical",
  high: "warning",
  watch: "info",
  info: "info",
  resolved: "success"
};

export const notificationStatusLabels: Record<NotificationStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed"
};

export const escalationRules: EscalationRule[] = [
  rule("rfi-overdue-1", "rfi_overdue", "RFI overdue by 1 day", "high", ["project_manager", "operations_leader"], "manager", "rfis-submittals", "Escalate RFI response and document work impact."),
  rule("rfi-overdue-5", "rfi_overdue", "RFI overdue by 5 days and blocking work", "critical", ["operations_leader", "project_manager"], "leadership", "rfis-submittals", "Escalate GC response and protect schedule entitlement."),
  rule("change-notice-24h", "notice_deadline_risk", "Change notice deadline within 24 hours", "critical", ["project_manager", "operations_leader"], "leadership", "changes", "Submit notice or document commercial exception."),
  rule("d3-start-48h", "field_start_blocked", "D3 field start within 48 hours with readiness blocker", "critical", ["operations_leader", "superintendent", "project_manager"], "leadership", "mobilization", "Hold field start or clear safety/access/material blocker."),
  rule("daily-report-cutoff", "daily_report_missing", "Daily report missing after cutoff", "high", ["field_supervisor", "superintendent", "project_manager"], "owner", "field-execution", "Submit daily report before field proof is lost."),
  rule("billing-cycle-backup", "billing_backup_missing", "Billing backup missing inside pay app cycle", "high", ["finance_admin", "project_manager"], "manager", "billing", "Attach backup before pay app submission."),
  rule("approved-change-not-billed", "cash_at_risk", "Approved change not billed", "high", ["finance_admin", "project_manager", "operations_leader"], "manager", "billing", "Include approved change in next pay application."),
  rule("safety-overdue-field", "safety_action_overdue", "Safety corrective action overdue with field work affected", "critical", ["safety_manager", "operations_leader", "superintendent"], "leadership", "safety", "Verify corrective action before related work continues."),
  rule("quality-test-closeout", "quality_deficiency_overdue", "Quality test missing with closeout due within 7 days", "critical", ["quality_manager", "project_manager", "operations_leader"], "leadership", "quality", "Capture test result or hold closeout submission."),
  rule("closeout-target-missed", "closeout_blocked", "Closeout package blocked past target submission", "high", ["project_manager", "quality_manager", "finance_admin"], "manager", "closeout", "Clear acceptance blocker before final billing slips."),
  rule("retainage-waiver", "retainage_blocked", "Retainage release blocked by missing waiver", "high", ["finance_admin", "project_manager"], "manager", "billing", "Collect waiver and attach retainage support."),
  rule("lesson-overdue", "optimization_action_overdue", "Lessons learned action overdue after closeout", "watch", ["operations_leader", "project_manager"], "owner", "reports", "Publish lesson or update operating template.")
];

function rule(
  id: string,
  category: NotificationCategory,
  trigger: string,
  severity: NotificationSeverity,
  audienceRoles: EscalationRule["audienceRoles"],
  escalationLevel: EscalationRule["escalationLevel"],
  targetModule: string,
  recommendedAction: string
): EscalationRule {
  return {
    id,
    category,
    trigger,
    severity,
    audienceRoles,
    escalationLevel,
    targetModule,
    recommendedAction
  };
}
