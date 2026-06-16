import { workflowTypeConfig } from "../workflow/config";
import { deriveOperatingWorkflows } from "../workflow/derive-workflows";
import type { OperatingWorkflowType, WorkflowSeverity } from "../workflow/types";

export type SimplifiedNextAction = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  whyItMatters: string;
  ctaLabel: string;
  href: string;
  severity: WorkflowSeverity;
};

export function deriveNextActions(workflowType?: OperatingWorkflowType, limit = 3): SimplifiedNextAction[] {
  const workflowSummary = deriveOperatingWorkflows();
  const workflows = workflowType
    ? workflowSummary.workflowsByType[workflowType] ?? []
    : workflowSummary.topLeadershipWorkflows;

  return workflows
    .filter((workflow) => workflow.resolutionState !== "resolved")
    .slice(0, limit)
    .map((workflow) => ({
      id: workflow.id,
      title: workflow.requiredAction.title,
      owner: workflow.owner,
      dueDate: workflow.dueDate,
      whyItMatters: workflow.businessImpact,
      ctaLabel: `Resolve in ${workflow.targetModule}`,
      href: workflow.targetHref,
      severity: workflow.severity
    }));
}

export function fallbackNextAction(workflowType?: OperatingWorkflowType): SimplifiedNextAction {
  const config = workflowType ? workflowTypeConfig[workflowType] : undefined;

  return {
    id: "fallback-next-action",
    title: config?.typicalActions[0] ?? "Review top operating priorities",
    owner: "Operations leader",
    dueDate: "Today",
    whyItMatters: config?.primaryQuestion ?? "Leadership needs a clear owner, action, evidence, and next movement.",
    ctaLabel: "Review required action",
    href: config?.targetHref ?? "/command-center",
    severity: "info"
  };
}
