import { deriveEvidenceRequirements } from "../evidence";
import { deriveOperatingNotifications } from "../notifications";
import { deriveOperatingWorkflows } from "../workflow";
import type { OperatingWorkflowType } from "../workflow/types";

export type PageReadinessStatus = "ready" | "blocked" | "at_risk" | "complete";

export type PageReadinessItem = {
  id: string;
  label: string;
  status: "ready" | "blocking" | "pending";
  detail: string;
};

export function derivePageReadiness(workflowType?: OperatingWorkflowType) {
  const workflowSummary = deriveOperatingWorkflows();
  const evidenceSummary = deriveEvidenceRequirements();
  const notificationSummary = deriveOperatingNotifications();
  const workflows = workflowType
    ? workflowSummary.workflowsByType[workflowType] ?? []
    : workflowSummary.topLeadershipWorkflows;
  const activeWorkflows = workflows.filter((workflow) => workflow.resolutionState !== "resolved");
  const blockedCount = activeWorkflows.filter((workflow) => workflow.resolutionState === "blocked").length;
  const overdueCount = activeWorkflows.filter((workflow) => workflow.resolutionState === "overdue").length;
  const missingEvidence = evidenceSummary.missingEvidence.filter((item) =>
    workflowType ? activeWorkflows.some((workflow) => workflow.id === item.workflowInstanceId) : true
  );
  const criticalNotifications = notificationSummary.criticalNotifications.filter((notification) =>
    workflowType ? activeWorkflows.some((workflow) => workflow.id === notification.workflowInstanceId) : true
  );

  const status: PageReadinessStatus =
    blockedCount > 0 ? "blocked" : overdueCount > 0 || criticalNotifications.length > 0 ? "at_risk" : activeWorkflows.length === 0 ? "complete" : "ready";

  const readinessItems: PageReadinessItem[] = [
    {
      id: "workflow-blockers",
      label: "Blockers",
      status: blockedCount > 0 ? "blocking" : "ready",
      detail: blockedCount > 0 ? `${blockedCount} workflow blocker(s)` : "No blocked workflow actions"
    },
    {
      id: "due-actions",
      label: "Due actions",
      status: overdueCount > 0 ? "blocking" : activeWorkflows.length > 0 ? "pending" : "ready",
      detail: overdueCount > 0 ? `${overdueCount} overdue action(s)` : `${activeWorkflows.length} active action(s)`
    },
    {
      id: "evidence",
      label: "Evidence",
      status: missingEvidence.length > 0 ? "pending" : "ready",
      detail: missingEvidence.length > 0 ? `${missingEvidence.length} evidence item(s) missing` : "Required evidence is controlled"
    },
    {
      id: "escalations",
      label: "Escalations",
      status: criticalNotifications.length > 0 ? "blocking" : "ready",
      detail: criticalNotifications.length > 0 ? `${criticalNotifications.length} critical alert(s)` : "No critical escalations"
    }
  ];

  return {
    status,
    readinessItems,
    activeWorkflowCount: activeWorkflows.length,
    blockedCount,
    overdueCount,
    missingEvidenceCount: missingEvidence.length,
    criticalNotificationCount: criticalNotifications.length
  };
}
