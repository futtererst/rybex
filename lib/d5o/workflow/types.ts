import type { D5OPhaseId } from "../types";

export type OperatingWorkflowType =
  | "pursuit_control"
  | "contract_baseline"
  | "mobilization_readiness"
  | "field_execution"
  | "information_control"
  | "change_recovery"
  | "billing_cash_control"
  | "safety_control"
  | "quality_control"
  | "closeout_acceptance"
  | "optimize_learning"
  | "system_readiness";

export type WorkflowStatus =
  | "new"
  | "active"
  | "at_risk"
  | "blocked"
  | "overdue"
  | "ready_for_review"
  | "resolved";

export type WorkflowSeverity = "critical" | "high" | "watch" | "info" | "resolved";

export type WorkflowStage = "signal" | "decision" | "action" | "evidence" | "gate_movement";

export type WorkflowResolutionState =
  | "needs_decision"
  | "needs_action"
  | "blocked"
  | "overdue"
  | "in_progress"
  | "ready_for_review"
  | "resolved";

export type WorkflowSignal = {
  title: string;
  detail: string;
};

export type WorkflowDecision = {
  question: string;
  options?: string[];
};

export type WorkflowAction = {
  title: string;
  detail: string;
};

export type WorkflowEvidence = {
  required: string[];
  currentState?: string;
};

export type WorkflowGateMovement = {
  from?: string;
  to: string;
  label: string;
};

export type OperatingWorkflow = {
  id: string;
  workflowType: OperatingWorkflowType;
  title: string;
  description: string;
  d5oPhase: D5OPhaseId;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  projectId?: string;
  projectName?: string;
  entityName: string;
  signal: WorkflowSignal;
  requiredDecision: WorkflowDecision;
  requiredAction: WorkflowAction;
  evidenceNeeded: WorkflowEvidence;
  currentStatus: WorkflowStatus;
  resolutionState: WorkflowResolutionState;
  owner: string;
  dueDate: string;
  businessImpact: string;
  consequenceIfMissed: string;
  targetModule: string;
  targetHref: string;
  nextGateOrStatus: WorkflowGateMovement;
  valueAtRisk?: number;
  severity: WorkflowSeverity;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowTypeConfig = {
  label: string;
  shortLabel: string;
  purpose: string;
  primaryQuestion: string;
  typicalSignals: string[];
  typicalDecisions: string[];
  typicalActions: string[];
  typicalEvidence: string[];
  targetModule: string;
  targetHref: string;
  d5oPhase: D5OPhaseId;
  statusLanguage: Record<WorkflowResolutionState, string>;
  toneBySeverity: Record<WorkflowSeverity, "critical" | "warning" | "info" | "success" | "neutral" | "blocked">;
};

export type DerivedWorkflowSummary = {
  allOperatingWorkflows: OperatingWorkflow[];
  topLeadershipWorkflows: OperatingWorkflow[];
  workflowsByType: Record<OperatingWorkflowType, OperatingWorkflow[]>;
  workflowsByD5OPhase: Record<D5OPhaseId, OperatingWorkflow[]>;
  workflowsByOwner: Record<string, OperatingWorkflow[]>;
  overdueWorkflows: OperatingWorkflow[];
  blockedWorkflows: OperatingWorkflow[];
  commercialExposureWorkflows: OperatingWorkflow[];
  fieldReadinessWorkflows: OperatingWorkflow[];
  closeoutPaymentWorkflows: OperatingWorkflow[];
};
