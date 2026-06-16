import { createDemoAuditEvent } from "@/lib/d5o/audit";
import type { AuditEvent } from "@/lib/d5o/audit";
import type { UserRole } from "@/lib/d5o/types";
import type { OperatingWorkflow } from "./types";
import {
  workflowTransactionDefinitions,
  type WorkflowTransactionInput,
  type WorkflowTransactionResult,
  type WorkflowTransactionType
} from "./transactions";

type ApplyWorkflowTransactionArgs = {
  workflow: OperatingWorkflow;
  transactionType: WorkflowTransactionType;
  input: Omit<WorkflowTransactionInput, "transactionType" | "workflowId" | "actorName" | "actorRole">;
  actorName: string;
  actorRole: UserRole;
  timestamp?: string;
};

export function applyWorkflowTransaction({
  workflow,
  transactionType,
  input,
  actorName,
  actorRole,
  timestamp = new Date().toISOString()
}: ApplyWorkflowTransactionArgs): WorkflowTransactionResult {
  const definition = workflowTransactionDefinitions[transactionType];
  const normalizedInput: WorkflowTransactionInput = {
    ...input,
    actorName,
    actorRole,
    transactionType,
    workflowId: workflow.id
  };
  const validationError = validateTransactionInput(definition.requiredInputs, normalizedInput);

  if (validationError) {
    const failedWorkflow = {
      ...workflow,
      updatedAt: timestamp
    };

    return {
      id: transactionId(workflow.id, transactionType, timestamp),
      workflowId: workflow.id,
      transactionType,
      label: definition.label,
      success: false,
      message: `${definition.failureMessage} ${validationError}`,
      nextRecommendedStep: "Complete the missing transaction inputs and evidence, then try again.",
      outcome: {
        resolutionState: workflow.resolutionState,
        currentStatus: workflow.currentStatus,
        severity: workflow.severity,
        nextGateOrStatus: workflow.nextGateOrStatus
      },
      auditEvent: buildAuditEvent(workflow, definition.auditAction, actorRole, actorName, timestamp, false),
      createdAt: timestamp,
      input: normalizedInput,
      updatedWorkflow: failedWorkflow
    };
  }

  const updatedWorkflow = updateWorkflowForTransaction(workflow, transactionType, timestamp);
  const auditEvent = buildAuditEvent(workflow, definition.auditAction, actorRole, actorName, timestamp, true, updatedWorkflow);

  return {
    id: transactionId(workflow.id, transactionType, timestamp),
    workflowId: workflow.id,
    transactionType,
    label: definition.label,
    success: true,
    message: definition.successMessage,
    nextRecommendedStep: nextStepForTransaction(transactionType, workflow),
    outcome: {
      resolutionState: updatedWorkflow.resolutionState,
      currentStatus: updatedWorkflow.currentStatus,
      severity: updatedWorkflow.severity,
      nextGateOrStatus: updatedWorkflow.nextGateOrStatus,
      targetHref: updatedWorkflow.targetHref
    },
    auditEvent,
    createdAt: timestamp,
    input: normalizedInput,
    updatedWorkflow
  };
}

function validateTransactionInput(requiredInputs: string[], input: WorkflowTransactionInput) {
  if (!input.notes.trim()) {
    return "A transaction note is required.";
  }

  if (requiredInputs.some((field) => field.toLowerCase().includes("owner")) && !input.owner?.trim()) {
    return "An owner is required.";
  }

  return "";
}

function updateWorkflowForTransaction(
  workflow: OperatingWorkflow,
  transactionType: WorkflowTransactionType,
  timestamp: string
): OperatingWorkflow {
  const definition = workflowTransactionDefinitions[transactionType];

  if (transactionType.startsWith("hold_")) {
    return {
      ...workflow,
      currentStatus: "blocked",
      resolutionState: "blocked",
      severity: workflow.severity === "critical" ? "critical" : "high",
      requiredAction: {
        title: "Hold reason recorded",
        detail: "A local demo hold transaction was recorded. Assigned owner must clear the blocker before gate movement."
      },
      nextGateOrStatus: {
        from: workflow.nextGateOrStatus.from,
        to: "held",
        label: definition.resultingGateMovement
      },
      updatedAt: timestamp
    };
  }

  if (transactionType === "create_rfi_from_signal") {
    return {
      ...workflow,
      currentStatus: "ready_for_review",
      resolutionState: "ready_for_review",
      severity: "watch",
      targetModule: "RFIs & Submittals",
      targetHref: "/rfis-submittals",
      nextGateOrStatus: {
        from: workflow.nextGateOrStatus.from,
        to: "rfi_control",
        label: definition.resultingGateMovement
      },
      updatedAt: timestamp
    };
  }

  if (transactionType === "create_change_event_from_signal") {
    return {
      ...workflow,
      currentStatus: "ready_for_review",
      resolutionState: "ready_for_review",
      severity: workflow.valueAtRisk ? "high" : "watch",
      targetModule: "Change Control",
      targetHref: "/changes",
      nextGateOrStatus: {
        from: workflow.nextGateOrStatus.from,
        to: "change_recovery",
        label: definition.resultingGateMovement
      },
      updatedAt: timestamp
    };
  }

  if (transactionType === "submit_daily_report") {
    return {
      ...workflow,
      currentStatus: "ready_for_review",
      resolutionState: "ready_for_review",
      severity: "watch",
      nextGateOrStatus: {
        from: workflow.nextGateOrStatus.from,
        to: "supervisor_review",
        label: definition.resultingGateMovement
      },
      updatedAt: timestamp
    };
  }

  return {
    ...workflow,
    currentStatus: "resolved",
    resolutionState: "resolved",
    severity: "resolved",
    nextGateOrStatus: {
      from: workflow.nextGateOrStatus.from,
      to: definition.resultingStatus,
      label: definition.resultingGateMovement
    },
    updatedAt: timestamp
  };
}

function nextStepForTransaction(transactionType: WorkflowTransactionType, workflow: OperatingWorkflow) {
  switch (transactionType) {
    case "approve_go_no_go":
      return "If awarded, start D2 project setup and preserve score detail as pursuit evidence.";
    case "hold_go_no_go":
      return "Resolve clarifications, then revisit the D1 pursuit decision.";
    case "approve_d2_gate":
      return "Move into D3 mobilization planning with baseline artifacts attached.";
    case "hold_d2_gate":
      return "Clear the baseline blocker before mobilization planning begins.";
    case "approve_d3_field_start":
      return "Start D4 field execution with daily reporting and work package controls.";
    case "hold_d3_field_start":
      return "Clear field-readiness blockers before crew mobilization.";
    case "submit_daily_report":
      return "Review supervisor signoff and create RFI/change prompts if cost, schedule, access, scope, or method changed.";
    case "create_rfi_from_signal":
      return "Track the RFI response date and link any cost/schedule impact to change control.";
    case "create_change_event_from_signal":
      return "Protect notice, assemble backup, and price the change event.";
    case "resolve_workflow_action":
      return `Workflow resolved locally. Review ${workflow.targetModule} if further evidence is needed.`;
  }
}

function buildAuditEvent(
  workflow: OperatingWorkflow,
  action: string,
  actorRole: UserRole,
  actorName: string,
  timestamp: string,
  success: boolean,
  updatedWorkflow?: OperatingWorkflow
): AuditEvent {
  return createDemoAuditEvent({
    id: `audit-${workflow.id}-${action}-${Date.parse(timestamp) || Date.now()}`,
    entityType: workflow.sourceRecordType,
    entityId: workflow.sourceRecordId,
    action,
    actorRole,
    actorName,
    timestamp,
    summary: success
      ? `${actorName} completed ${action.replaceAll("_", " ")} for ${workflow.title}.`
      : `${actorName} attempted ${action.replaceAll("_", " ")} for ${workflow.title}.`,
    beforeState: {
      resolutionState: workflow.resolutionState,
      currentStatus: workflow.currentStatus
    },
    afterState: updatedWorkflow
      ? {
          resolutionState: updatedWorkflow.resolutionState,
          currentStatus: updatedWorkflow.currentStatus
        }
      : undefined,
    projectId: workflow.projectId,
    severity: success ? "info" : "warning"
  });
}

function transactionId(workflowId: string, transactionType: WorkflowTransactionType, timestamp: string) {
  return `txn-${workflowId}-${transactionType}-${Date.parse(timestamp) || Date.now()}`;
}
