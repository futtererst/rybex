import { getWorkflowCompletionStoreMode } from "@/lib/d5o/workflow-completion/completion-store-mode";
import { getRegisteredCompletionWorkflowDefinitions } from "@/lib/d5o/workflow-completion/workflow-completion-registry";
import type { WorkflowCompletionItem } from "@/lib/d5o/workflow-completion/types";

export type PilotWorkflowStatus = "not_started" | "in_progress" | "complete";

export type PilotWorkflow = {
  workflowId: string;
  completionItemId: string;
  label: string;
  businessValue: string;
  targetRoute: string;
  traceHref: string;
  owner: string;
  dueDate: string;
  sourceModule: string;
};

const pilotWorkflowIds = [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release"
] as const;

const pilotWorkflowCopy: Record<(typeof pilotWorkflowIds)[number], Pick<PilotWorkflow, "label" | "businessValue" | "targetRoute" | "traceHref">> = {
  "billing-backup-cash-recovery": {
    label: "Add missing billing backup",
    businessValue: "Unblocks pay application and cash recovery.",
    targetRoute: "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
    traceHref: "#pilot-docs"
  },
  "field-issue-escalation": {
    label: "Escalate field issue",
    businessValue: "Moves field issue into RFI/change control.",
    targetRoute: "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
    traceHref: "#pilot-docs"
  },
  "closeout-requirement-final-billing-release": {
    label: "Complete closeout requirement",
    businessValue: "Supports acceptance, final billing, and retainage release.",
    targetRoute: "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task",
    traceHref: "#pilot-docs"
  }
};

export function getPilotWorkflows(): PilotWorkflow[] {
  const definitions = getRegisteredCompletionWorkflowDefinitions();

  return pilotWorkflowIds.map((workflowId) => {
    const definition = definitions.find((candidate) => candidate.id === workflowId);

    if (!definition) {
      throw new Error(`Pilot workflow is not registered: ${workflowId}`);
    }

    const item = definition.demoSeedData.item;

    return {
      workflowId,
      completionItemId: item.id,
      label: pilotWorkflowCopy[workflowId].label,
      businessValue: pilotWorkflowCopy[workflowId].businessValue,
      targetRoute: pilotWorkflowCopy[workflowId].targetRoute,
      traceHref: pilotWorkflowCopy[workflowId].traceHref,
      owner: item.owner,
      dueDate: item.dueDate,
      sourceModule: definition.sourceModule
    };
  });
}

export function getPilotProgress(items?: WorkflowCompletionItem[]) {
  const workflows = getPilotWorkflows();
  const itemById = new Map((items ?? getRegisteredCompletionWorkflowDefinitions().map((definition) => definition.demoSeedData.item)).map((item) => [item.id, item]));
  const workflowStatuses = workflows.map((workflow) => {
    const item = itemById.get(workflow.completionItemId);
    const state = item?.status ?? "not_started";

    return {
      ...workflow,
      currentState: state,
      status: classifyPilotWorkflowStatus(state),
      resolutionState: item?.resolutionState ?? "not_started"
    };
  });
  const completed = workflowStatuses.filter((workflow) => workflow.status === "complete").length;

  return {
    total: workflows.length,
    completed,
    inProgress: workflowStatuses.filter((workflow) => workflow.status === "in_progress").length,
    notStarted: workflowStatuses.filter((workflow) => workflow.status === "not_started").length,
    percentComplete: Math.round((completed / workflows.length) * 100),
    workflows: workflowStatuses
  };
}

export function formatPilotProgressTitle(progress: Pick<ReturnType<typeof getPilotProgress>, "completed" | "total">) {
  return `${progress.completed} of ${progress.total} workflows complete`;
}

export function getPilotModeStatus() {
  const storeMode = getWorkflowCompletionStoreMode();

  return {
    label: "Controlled internal pilot candidate — not production ready",
    completionStoreMode: storeMode,
    completionModeLabel: storeMode === "database" ? "database pilot" : "local/demo",
    databasePilotAvailable: storeMode === "database",
    productionReady: false
  };
}

export function getPilotGuardrails() {
  return [
    "Pilot Mode includes only the three verified completion workflows.",
    "Local/demo progress uses browser state and can be reset.",
    "Database completion persistence is opt-in and not production-ready.",
    "RLS, production auth, external notifications, and production file security are not enabled."
  ];
}

export function classifyPilotWorkflowStatus(state: string): PilotWorkflowStatus {
  if (state === "resolved") return "complete";
  if (["waiting_on_evidence", "open", "user_action_required"].includes(state)) return "not_started";
  return "in_progress";
}
