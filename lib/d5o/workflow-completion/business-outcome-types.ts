import type { CompletionWorkflowId } from "./definition-types";
import type {
  WorkflowCompletionLinkedOutput,
  WorkflowCompletionStatus
} from "./types";

export type WorkflowBusinessProcess = {
  name: string;
  startingProblem: string;
  businessOutcome: string;
  businessImpact: string;
  nextBusinessStep: WorkflowNextBusinessStep;
  historicalReferenceLabel: string;
  requiredCapturedInputLabels: string[];
  evidenceReferenceLabels: string[];
  documentReferenceLabels: string[];
};

export type WorkflowBusinessObject = {
  type: string;
  id: string;
  label: string;
};

export type WorkflowOutcomeImpact = {
  summary: string;
  commercialValue?: number;
  scheduleImpact?: string;
  operationalImpact?: string;
};

export type WorkflowCapturedInput = {
  fieldId: string;
  label: string;
  value: string;
};

export type WorkflowEvidenceReference = {
  label: string;
  value: string;
  sourceFieldId?: string;
};

export type WorkflowDocumentReference = {
  label: string;
  value: string;
  sourceFieldId?: string;
};

export type WorkflowHistoricalReference = {
  label: string;
  storageMode: "local_demo" | "database_pilot";
  summary: string;
};

export type WorkflowRemainingBlocker = {
  label: string;
  status: "none" | "open" | "accepted_risk";
  detail: string;
};

export type WorkflowNextBusinessStep = {
  label: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export type WorkflowStateChange = {
  from: WorkflowCompletionStatus;
  to: WorkflowCompletionStatus;
  label: string;
};

export type WorkflowOutcomeDefinition = {
  businessProcess: WorkflowBusinessProcess;
  businessObject: WorkflowBusinessObject;
};

export type WorkflowOutcomeRecord = {
  id: string;
  workflowId: CompletionWorkflowId;
  completionItemId: string;
  businessProcessName: string;
  businessObjectType: string;
  businessObjectId: string;
  businessObjectLabel: string;
  projectName: string;
  owner: string;
  completedBy: string;
  completedAt: string;
  startingProblem: string;
  inputsCaptured: WorkflowCapturedInput[];
  evidenceReferences: WorkflowEvidenceReference[];
  documentReferences: WorkflowDocumentReference[];
  linkedOutputs: WorkflowCompletionLinkedOutput[];
  stateChanges: WorkflowStateChange[];
  businessOutcome: string;
  businessImpact: WorkflowOutcomeImpact;
  remainingBlockers: WorkflowRemainingBlocker[];
  nextBusinessStep: WorkflowNextBusinessStep;
  auditSummary: string;
  historicalReferenceLabel: string;
  historicalReference: WorkflowHistoricalReference;
  localDemoOnly: boolean;
  databaseBacked: boolean;
};

