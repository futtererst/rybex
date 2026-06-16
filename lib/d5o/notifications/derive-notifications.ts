import { demoUser } from "../demo-user";
import { deriveEvidenceRequirements } from "../evidence/derive-evidence";
import type { EvidenceRequirement } from "../evidence/types";
import type { UserRole } from "../types";
import { deriveOperatingWorkflows } from "../workflow/derive-workflows";
import type { OperatingWorkflow, WorkflowSeverity } from "../workflow/types";
import { escalationRules } from "./config";
import type {
  DerivedNotificationSummary,
  EscalationLevel,
  NotificationCategory,
  NotificationSeverity,
  OperatingNotification
} from "./types";

const operatingDate = "2026-06-11";
const roleOrder: UserRole[] = [
  "executive",
  "operations_leader",
  "project_manager",
  "estimator",
  "superintendent",
  "field_supervisor",
  "safety_manager",
  "quality_manager",
  "finance_admin",
  "admin"
];

export function deriveOperatingNotifications(currentRole: UserRole = demoUser.role): DerivedNotificationSummary {
  const workflowSummary = deriveOperatingWorkflows();
  const evidenceSummary = deriveEvidenceRequirements();
  const workflowNotifications = workflowSummary.allOperatingWorkflows
    .filter((workflow) => workflow.resolutionState !== "resolved")
    .map(notificationFromWorkflow);
  const evidenceNotifications = evidenceSummary.allEvidenceRequirements
    .filter((item) => item.required && ["missing", "pending", "rejected"].includes(item.status))
    .map(notificationFromEvidence);
  const allNotifications = sortNotifications([...workflowNotifications, ...evidenceNotifications]);
  const notificationsByRole = roleOrder.reduce((groups, role) => ({
    ...groups,
    [role]: allNotifications.filter((item) => item.audienceRoles.includes(role))
  }), {} as Record<UserRole, OperatingNotification[]>);

  return {
    allNotifications,
    notificationsByRole,
    criticalNotifications: allNotifications.filter((item) => item.severity === "critical"),
    overdueNotifications: allNotifications.filter((item) => daysUntil(item.dueDate) < 0),
    escalationQueue: allNotifications.filter((item) => item.escalationLevel !== "none" && item.severity !== "info").slice(0, 8),
    commandCenterNotifications: allNotifications.filter((item) => ["critical", "high"].includes(item.severity)).slice(0, 6),
    currentUserNotifications: notificationsByRole[currentRole]?.slice(0, 8) ?? []
  };
}

function notificationFromWorkflow(workflow: OperatingWorkflow): OperatingNotification {
  const category = categoryFromWorkflow(workflow);
  const rule = ruleForCategory(category);
  const severity = severityFromWorkflow(workflow);
  const dueDelta = daysUntil(workflow.dueDate);

  return {
    id: `notification-workflow-${workflow.id}`,
    category,
    severity,
    status: dueDelta < 0 || workflow.resolutionState === "blocked" ? "escalated" : "new",
    title: workflow.signal.title,
    summary: workflow.requiredDecision.question,
    businessImpact: workflow.businessImpact,
    consequenceIfMissed: workflow.consequenceIfMissed,
    requiredAction: workflow.requiredAction.title,
    owner: workflow.owner,
    audienceRoles: rule?.audienceRoles ?? audienceForCategory(category),
    dueDate: workflow.dueDate,
    escalationLevel: escalationLevelFor(severity, dueDelta, rule?.escalationLevel),
    sourceModule: workflow.sourceModule,
    sourceRecordType: workflow.sourceRecordType,
    sourceRecordId: workflow.sourceRecordId,
    workflowInstanceId: workflow.id,
    projectId: workflow.projectId,
    projectName: workflow.projectName,
    targetHref: workflow.targetHref,
    createdAt: workflow.createdAt
  };
}

function notificationFromEvidence(evidence: EvidenceRequirement): OperatingNotification {
  const category = daysUntil(evidence.dueDate ?? operatingDate) < 0 ? "evidence_overdue" : categoryFromEvidence(evidence);
  const severity = severityFromEvidence(evidence);
  const rule = ruleForCategory(category);

  return {
    id: `notification-evidence-${evidence.id}`,
    category,
    severity,
    status: daysUntil(evidence.dueDate ?? operatingDate) < 0 ? "escalated" : "new",
    title: evidence.title,
    summary: evidence.status === "rejected" ? "Evidence rejected." : "Required evidence is missing or pending.",
    businessImpact: impactFromEvidence(evidence),
    consequenceIfMissed: consequenceFromEvidence(evidence),
    requiredAction: evidence.nextAction,
    owner: evidence.owner,
    audienceRoles: rule?.audienceRoles ?? audienceForEvidence(evidence),
    dueDate: evidence.dueDate ?? operatingDate,
    escalationLevel: escalationLevelFor(severity, daysUntil(evidence.dueDate ?? operatingDate), rule?.escalationLevel),
    sourceModule: evidence.sourceModule,
    sourceRecordType: evidence.sourceRecordType,
    sourceRecordId: evidence.sourceRecordId,
    workflowInstanceId: evidence.workflowInstanceId,
    evidenceRequirementId: evidence.id,
    projectId: evidence.projectId,
    targetHref: hrefForModule(evidence.sourceModule),
    createdAt: operatingDate
  };
}

function categoryFromWorkflow(workflow: OperatingWorkflow): NotificationCategory {
  if (workflow.resolutionState === "needs_decision") return "decision_required";
  if (workflow.workflowType === "mobilization_readiness" && ["blocked", "overdue"].includes(workflow.resolutionState)) return "field_start_blocked";
  if (workflow.workflowType === "field_execution" && workflow.sourceRecordType.includes("daily")) return "daily_report_missing";
  if (workflow.workflowType === "information_control" && workflow.sourceRecordType.includes("rfi")) return "rfi_overdue";
  if (workflow.workflowType === "information_control" && workflow.sourceRecordType.includes("submittal")) return "submittal_overdue";
  if (workflow.workflowType === "change_recovery" && workflow.signal.title.toLowerCase().includes("notice")) return "notice_deadline_risk";
  if (workflow.workflowType === "change_recovery") return "change_backup_missing";
  if (workflow.workflowType === "billing_cash_control") return workflow.valueAtRisk ? "cash_at_risk" : "billing_backup_missing";
  if (workflow.workflowType === "safety_control") return "safety_action_overdue";
  if (workflow.workflowType === "quality_control") return "quality_deficiency_overdue";
  if (workflow.workflowType === "closeout_acceptance") return workflow.signal.title.toLowerCase().includes("retainage") ? "retainage_blocked" : "closeout_blocked";
  if (workflow.workflowType === "optimize_learning") return "optimization_action_overdue";
  if (workflow.workflowType === "system_readiness") return "system_readiness";
  return "gate_blocked";
}

function categoryFromEvidence(evidence: EvidenceRequirement): NotificationCategory {
  if (evidence.requiredForBilling) return "billing_backup_missing";
  if (evidence.requiredForCloseout) return evidence.category === "lien_waiver" ? "retainage_blocked" : "closeout_blocked";
  if (evidence.requiredForChangeRecovery) return "change_backup_missing";
  if (evidence.requiredForGate) return "evidence_missing";
  return "evidence_missing";
}

function severityFromWorkflow(workflow: OperatingWorkflow): NotificationSeverity {
  if (workflow.severity === "resolved") return "resolved";
  return workflow.severity === "critical" || daysUntil(workflow.dueDate) <= 1
    ? "critical"
    : workflow.severity === "high"
      ? "high"
      : workflow.severity === "watch"
        ? "watch"
        : "info";
}

function severityFromEvidence(evidence: EvidenceRequirement): NotificationSeverity {
  const dueDelta = daysUntil(evidence.dueDate ?? operatingDate);
  if (evidence.status === "rejected" || dueDelta < 0) return "critical";
  if (evidence.requiredForBilling || evidence.requiredForCloseout || evidence.requiredForGate) return dueDelta <= 2 ? "critical" : "high";
  return "watch";
}

function escalationLevelFor(severity: NotificationSeverity, dueDelta: number, fallback?: EscalationLevel): EscalationLevel {
  if (severity === "critical" && dueDelta < 0) return "executive";
  if (severity === "critical") return "leadership";
  if (severity === "high") return fallback ?? "manager";
  if (severity === "watch") return fallback ?? "owner";
  return "none";
}

function ruleForCategory(category: NotificationCategory) {
  return escalationRules.find((rule) => rule.category === category);
}

function audienceForCategory(category: NotificationCategory): UserRole[] {
  if (category.includes("billing") || category === "cash_at_risk" || category === "retainage_blocked") return ["finance_admin", "project_manager", "operations_leader"];
  if (category.includes("safety")) return ["safety_manager", "superintendent", "operations_leader"];
  if (category.includes("quality") || category === "closeout_blocked") return ["quality_manager", "project_manager", "operations_leader"];
  if (category.includes("rfi") || category.includes("submittal") || category.includes("change")) return ["project_manager", "operations_leader"];
  return ["operations_leader", "project_manager"];
}

function audienceForEvidence(evidence: EvidenceRequirement): UserRole[] {
  if (evidence.sourceModule === "billing") return ["finance_admin", "project_manager"];
  if (evidence.sourceModule === "safety") return ["safety_manager", "superintendent"];
  if (evidence.sourceModule === "quality") return ["quality_manager", "project_manager"];
  if (evidence.sourceModule === "closeout") return ["project_manager", "quality_manager", "finance_admin"];
  return ["project_manager", "operations_leader"];
}

function impactFromEvidence(evidence: EvidenceRequirement) {
  if (evidence.requiredForBilling) return "Billing or retainage support may be rejected.";
  if (evidence.requiredForCloseout) return "Acceptance or closeout readiness may be blocked.";
  if (evidence.requiredForGate) return "Gate movement may be held until proof is verified.";
  if (evidence.requiredForChangeRecovery) return "Change recovery may weaken without backup.";
  return "Operating record may remain incomplete.";
}

function consequenceFromEvidence(evidence: EvidenceRequirement) {
  if (evidence.requiredForBilling) return "Cash recovery may slip or be disputed.";
  if (evidence.requiredForCloseout) return "Final acceptance and archive handoff may be delayed.";
  if (evidence.requiredForGate) return "Work may move forward without required proof.";
  if (evidence.requiredForChangeRecovery) return "Notice, pricing, or entitlement support may be lost.";
  return "The workflow may stay unresolved.";
}

function hrefForModule(module: string) {
  const normalized = module.replaceAll("_", "-");
  if (normalized === "rfis-submittals") return "/rfis-submittals";
  if (normalized === "field-execution") return "/field-execution";
  return `/${normalized}`;
}

function daysUntil(date: string) {
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  const current = new Date(`${operatingDate}T00:00:00`);

  return Math.ceil((target.getTime() - current.getTime()) / 86_400_000);
}

function sortNotifications(notifications: OperatingNotification[]) {
  const severityRank: Record<NotificationSeverity, number> = {
    critical: 0,
    high: 1,
    watch: 2,
    info: 3,
    resolved: 4
  };

  return [...notifications].sort((a, b) => {
    const severity = severityRank[a.severity] - severityRank[b.severity];
    if (severity !== 0) return severity;

    return daysUntil(a.dueDate) - daysUntil(b.dueDate);
  });
}
