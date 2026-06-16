import type { RybexPermission } from "../rbac";
import type { WorkflowOutcomeDefinition } from "./business-outcome-types";
import type {
  WorkflowCompletionActionType,
  WorkflowCompletionLinkedOutput,
  WorkflowCompletionResolutionState,
  WorkflowCompletionStatus,
  WorkflowCompletionItem
} from "./types";

export type CompletionWorkflowId =
  | "billing-backup-cash-recovery"
  | "field-issue-escalation"
  | "closeout-requirement-final-billing-release";

export type CompletionStateDefinition = {
  state: WorkflowCompletionStatus;
  label: string;
  resolutionState: WorkflowCompletionResolutionState;
  terminal?: boolean;
};

export type CompletionEvidenceRequirementDefinition = {
  id: string;
  label: string;
  statusLabel: string;
  required: boolean;
  qaSelector?: string;
};

export type CompletionLinkedOutputDefinition = WorkflowCompletionLinkedOutput;

export type CompletionPermissionRule = {
  permissions: RybexPermission[];
  mode: "all" | "any";
};

export type CompletionNotificationRule = {
  onAction: WorkflowCompletionActionType;
  message: string;
  futurePersistence: boolean;
};

export type CompletionAuditRule = {
  writesHistory: boolean;
  auditLabel: string;
  futureDatabaseAudit: boolean;
};

export type CompletionTransitionDefinition = {
  fromStates: WorkflowCompletionStatus[];
  toState: WorkflowCompletionStatus;
  resolutionState: WorkflowCompletionResolutionState;
  nextStep: string;
};

export type CompletionActionDefinition = CompletionTransitionDefinition & {
  actionType: WorkflowCompletionActionType;
  label: string;
  description: string;
  requiredPermissions: RybexPermission[];
  requiresEvidence: boolean;
  requiresReason: boolean;
  createsLinkedOutput?: CompletionLinkedOutputDefinition;
  updatesEvidence?: "uploaded" | "verified" | "waived";
  updatesNotification?: string;
  writesHistory: boolean;
  resultMessage: string;
  blockedMessage: string;
  qaSelector: string;
  primary?: boolean;
};

export type CompletionQaContract = {
  workflowId: CompletionWorkflowId;
  startRoute: string;
  focusedTaskSelector: string;
  completionPanelSelector: string;
  orderedActionSelectors: string[];
  expectedStatesAfterEachAction: WorkflowCompletionStatus[];
  expectedResultBannerText: string[];
  expectedLinkedOutputBehavior:
    | "none"
    | "rfi"
    | "change_event"
    | "rfi_or_change_event"
    | "closeout_package_update"
    | "final_billing_release_note";
  expectedTerminalState: WorkflowCompletionStatus;
  localQaSupported?: boolean;
  databaseQaSupported?: boolean;
  databasePilotActionSelectors?: string[];
};

export type CompletionWorkflowDefinition = {
  id: CompletionWorkflowId;
  title: string;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  primaryUserRole: string;
  businessPurpose: string;
  outcomeDefinition: WorkflowOutcomeDefinition;
  startState: WorkflowCompletionStatus;
  terminalStates: WorkflowCompletionStatus[];
  states: CompletionStateDefinition[];
  actions: CompletionActionDefinition[];
  requiredEvidence: CompletionEvidenceRequirementDefinition[];
  linkedOutputTypes: Array<CompletionLinkedOutputDefinition["type"]>;
  permissionRequirements: CompletionPermissionRule[];
  notificationBehavior: CompletionNotificationRule[];
  auditBehavior: CompletionAuditRule[];
  routeTarget: string;
  focusKey: string;
  qaSelectors: {
    focusedTaskPanel: string;
    completionPanel: string;
    state: string;
    resultBanner: string;
    history: string;
    linkedOutput?: string;
  };
  qaContract: CompletionQaContract;
  demoSeedData: {
    item: WorkflowCompletionItem;
    evidence: CompletionEvidenceRequirementDefinition[];
  };
};
