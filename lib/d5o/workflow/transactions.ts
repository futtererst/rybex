import type { AuditEvent } from "@/lib/d5o/audit";
import type { RybexPermission } from "@/lib/d5o/rbac";
import type { UserRole } from "@/lib/d5o/types";
import type { OperatingWorkflow, OperatingWorkflowType, WorkflowResolutionState } from "./types";

export type WorkflowTransactionType =
  | "approve_go_no_go"
  | "hold_go_no_go"
  | "approve_d2_gate"
  | "hold_d2_gate"
  | "approve_d3_field_start"
  | "hold_d3_field_start"
  | "submit_daily_report"
  | "create_rfi_from_signal"
  | "create_change_event_from_signal"
  | "resolve_workflow_action";

export type WorkflowTransactionInput = {
  transactionType: WorkflowTransactionType;
  workflowId: string;
  notes: string;
  decisionReason?: string;
  owner?: string;
  actorName: string;
  actorRole: UserRole;
  evidenceConfirmed: string[];
};

export type WorkflowTransactionOutcome = {
  resolutionState: WorkflowResolutionState;
  currentStatus: OperatingWorkflow["currentStatus"];
  severity: OperatingWorkflow["severity"];
  nextGateOrStatus: OperatingWorkflow["nextGateOrStatus"];
  targetHref?: string;
};

export type WorkflowTransactionResult = {
  id: string;
  workflowId: string;
  transactionType: WorkflowTransactionType;
  label: string;
  success: boolean;
  message: string;
  nextRecommendedStep: string;
  outcome: WorkflowTransactionOutcome;
  auditEvent: AuditEvent;
  createdAt: string;
  input: WorkflowTransactionInput;
  updatedWorkflow: OperatingWorkflow;
};

export type WorkflowTransactionState = {
  transactions: WorkflowTransactionResult[];
  updatedWorkflowsById: Record<string, OperatingWorkflow>;
};

export type WorkflowTransactionDefinition = {
  type: WorkflowTransactionType;
  label: string;
  shortLabel: string;
  description: string;
  workflowTypes: OperatingWorkflowType[];
  requiredInputs: string[];
  requiredEvidence: string[];
  resultingStatus: string;
  resultingGateMovement: string;
  auditAction: string;
  permissionRequired: RybexPermission;
  successMessage: string;
  failureMessage: string;
};

export const workflowTransactionDefinitions: Record<WorkflowTransactionType, WorkflowTransactionDefinition> = {
  approve_go_no_go: {
    type: "approve_go_no_go",
    label: "Approve Go/No-Go",
    shortLabel: "Approve",
    description: "Approve the D1 pursuit decision and move the opportunity toward D2 setup if awarded.",
    workflowTypes: ["pursuit_control"],
    requiredInputs: ["Decision reason", "Approver"],
    requiredEvidence: ["Go/no-go score", "Reviewer notes", "Risk mitigation notes"],
    resultingStatus: "approved_to_bid",
    resultingGateMovement: "D1 approved to bid; ready for D2 project setup if awarded.",
    auditAction: "go_no_go_approved",
    permissionRequired: "approve_go_no_go",
    successMessage: "Go/no-go approved. Pursuit can move into D2 project setup if awarded.",
    failureMessage: "Go/no-go approval needs decision notes and evidence."
  },
  hold_go_no_go: {
    type: "hold_go_no_go",
    label: "Hold Go/No-Go",
    shortLabel: "Hold",
    description: "Hold the D1 pursuit decision until clarifications, risk mitigations, or reviews are complete.",
    workflowTypes: ["pursuit_control"],
    requiredInputs: ["Hold reason", "Owner"],
    requiredEvidence: ["Clarification list", "Risk notes"],
    resultingStatus: "hold_for_clarification",
    resultingGateMovement: "D1 remains held until clarification is resolved.",
    auditAction: "go_no_go_held",
    permissionRequired: "approve_go_no_go",
    successMessage: "Go/no-go held. Clarification is required before estimating resources are committed.",
    failureMessage: "Hold decision needs a reason and assigned owner."
  },
  approve_d2_gate: {
    type: "approve_d2_gate",
    label: "Approve D2 Gate",
    shortLabel: "Approve D2",
    description: "Approve the contract baseline and move the project toward D3 mobilization planning.",
    workflowTypes: ["contract_baseline"],
    requiredInputs: ["Approval note", "Approver"],
    requiredEvidence: ["Contract baseline", "Scope matrix", "Budget baseline", "Schedule baseline", "Notice terms"],
    resultingStatus: "ready_for_mobilization_planning",
    resultingGateMovement: "D2 approved for D3 mobilization planning.",
    auditAction: "d2_gate_approved",
    permissionRequired: "approve_d2_gate",
    successMessage: "D2 gate approved. Project can move into mobilization planning.",
    failureMessage: "D2 approval needs baseline evidence and approval notes."
  },
  hold_d2_gate: {
    type: "hold_d2_gate",
    label: "Hold D2 Gate",
    shortLabel: "Hold D2",
    description: "Hold D2 until contract, scope, budget, schedule, or notice blockers are cleared.",
    workflowTypes: ["contract_baseline"],
    requiredInputs: ["Hold reason", "Blocker owner"],
    requiredEvidence: ["Baseline gap list", "Required artifact notes"],
    resultingStatus: "blocked",
    resultingGateMovement: "D2 remains held until baseline blockers are cleared.",
    auditAction: "d2_gate_held",
    permissionRequired: "approve_d2_gate",
    successMessage: "D2 gate held. Baseline blocker now has an assigned follow-up.",
    failureMessage: "D2 hold needs a blocker reason and owner."
  },
  approve_d3_field_start: {
    type: "approve_d3_field_start",
    label: "Approve Field Start",
    shortLabel: "Approve D3",
    description: "Approve field start once mobilization readiness evidence is complete.",
    workflowTypes: ["mobilization_readiness"],
    requiredInputs: ["Approval note", "Field start owner"],
    requiredEvidence: ["JHA", "Utility locates", "Access/permits", "Crew/equipment/material readiness", "Work package"],
    resultingStatus: "approved_for_field_start",
    resultingGateMovement: "D3 approved for D4 field execution.",
    auditAction: "d3_field_start_approved",
    permissionRequired: "approve_d3_gate",
    successMessage: "Field start approved. Mobilization can move into D4 field execution.",
    failureMessage: "Field start approval needs readiness evidence."
  },
  hold_d3_field_start: {
    type: "hold_d3_field_start",
    label: "Hold Field Start",
    shortLabel: "Hold D3",
    description: "Hold field start for safety, access, permit, material, crew, equipment, quality, or work-package gaps.",
    workflowTypes: ["mobilization_readiness"],
    requiredInputs: ["Hold category", "Owner"],
    requiredEvidence: ["Readiness blocker notes"],
    resultingStatus: "blocked",
    resultingGateMovement: "D3 remains held until readiness blockers are cleared.",
    auditAction: "d3_field_start_held",
    permissionRequired: "approve_d3_gate",
    successMessage: "Field start held. Readiness blocker must be cleared before D4 begins.",
    failureMessage: "Field-start hold needs a category and assigned owner."
  },
  submit_daily_report: {
    type: "submit_daily_report",
    label: "Submit Daily Report",
    shortLabel: "Submit Report",
    description: "Submit the daily report and move field evidence toward supervisor review or resolution.",
    workflowTypes: ["field_execution"],
    requiredInputs: ["Report note", "Supervisor"],
    requiredEvidence: ["Labor", "Equipment", "Installed quantities", "Photos/tests status", "Supervisor signoff"],
    resultingStatus: "submitted",
    resultingGateMovement: "D4 evidence captured; field workflow ready for supervisor review.",
    auditAction: "daily_report_submitted",
    permissionRequired: "submit_daily_report",
    successMessage: "Daily report submitted. D4 evidence is captured for production, billing, and closeout support.",
    failureMessage: "Daily report submission needs report notes and evidence confirmation."
  },
  create_rfi_from_signal: {
    type: "create_rfi_from_signal",
    label: "Create RFI",
    shortLabel: "Create RFI",
    description: "Create a local/demo RFI transaction from a field or information-control signal.",
    workflowTypes: ["field_execution", "information_control"],
    requiredInputs: ["RFI question", "Assignee", "Due date"],
    requiredEvidence: ["Field source", "Drawing/spec reference", "Photos or notes"],
    resultingStatus: "submitted",
    resultingGateMovement: "Field uncertainty moved into RFI/Submittal control.",
    auditAction: "rfi_created_from_signal",
    permissionRequired: "edit_rfis_submittals",
    successMessage: "RFI created from workflow signal. Clarification is now controlled.",
    failureMessage: "RFI creation needs a question, assignee, due date, and source evidence."
  },
  create_change_event_from_signal: {
    type: "create_change_event_from_signal",
    label: "Create Change Event",
    shortLabel: "Create Change",
    description: "Create a local/demo change event transaction from a field, RFI, delay, or commercial signal.",
    workflowTypes: ["field_execution", "information_control", "change_recovery"],
    requiredInputs: ["Change title", "Owner", "Notice note"],
    requiredEvidence: ["Daily report", "Photos", "RFI/GC direction", "Labor or equipment backup"],
    resultingStatus: "notice_required",
    resultingGateMovement: "Signal moved into change recovery for notice, backup, and pricing control.",
    auditAction: "change_event_created_from_signal",
    permissionRequired: "edit_changes",
    successMessage: "Change event created from workflow signal. Notice and backup workflow is now active.",
    failureMessage: "Change creation needs owner, source evidence, and notice notes."
  },
  resolve_workflow_action: {
    type: "resolve_workflow_action",
    label: "Resolve Workflow",
    shortLabel: "Resolve",
    description: "Mark the local/demo workflow action resolved after the decision, action, and evidence are complete.",
    workflowTypes: [
      "pursuit_control",
      "contract_baseline",
      "mobilization_readiness",
      "field_execution",
      "information_control",
      "change_recovery",
      "billing_cash_control",
      "safety_control",
      "quality_control",
      "closeout_acceptance",
      "optimize_learning",
      "system_readiness"
    ],
    requiredInputs: ["Resolution note"],
    requiredEvidence: ["Evidence checklist"],
    resultingStatus: "resolved",
    resultingGateMovement: "Workflow action resolved in local demo state.",
    auditAction: "workflow_action_resolved",
    permissionRequired: "view_command_center",
    successMessage: "Workflow action resolved in local demo state.",
    failureMessage: "Resolution needs a note and evidence confirmation."
  }
};

export function isWorkflowTransactionType(value: unknown): value is WorkflowTransactionType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(workflowTransactionDefinitions, value);
}

export function getWorkflowTransactionDefinition(
  transactionType: unknown,
  workflowType: OperatingWorkflowType
) {
  if (!isWorkflowTransactionType(transactionType)) {
    return undefined;
  }

  const definition = workflowTransactionDefinitions[transactionType];
  return definition.workflowTypes.includes(workflowType) ? definition : undefined;
}

export function getWorkflowTransactionDefinitions(workflow: OperatingWorkflow) {
  return Object.values(workflowTransactionDefinitions).filter((definition) =>
    definition.workflowTypes.includes(workflow.workflowType)
  );
}
