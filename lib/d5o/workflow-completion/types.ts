import type { RybexPermission } from "../rbac";
import type { EvidenceRequirement } from "../evidence/types";

export type WorkflowCompletionStatus =
  | "open"
  | "in_progress"
  | "user_action_required"
  | "waiting_on_evidence"
  | "evidence_attached"
  | "ready_for_review"
  | "rfi_required"
  | "change_required"
  | "rfi_created"
  | "change_event_created"
  | "controlled"
  | "resolved"
  | "waived"
  | "blocked"
  | "reopened";

export type WorkflowCompletionResolutionState =
  | "not_started"
  | "user_action_required"
  | "evidence_required"
  | "review_required"
  | "complete"
  | "waived"
  | "cannot_complete";

export type WorkflowCompletionActionType =
  | "save_backup_note"
  | "save_evidence_reference"
  | "save_billing_resolution_note"
  | "save_billing_waiver_reason"
  | "save_escalation_note"
  | "save_control_path"
  | "save_rfi_draft_details"
  | "save_change_event_details"
  | "save_control_reason"
  | "save_field_resolution_note"
  | "save_closeout_evidence_note"
  | "save_closeout_evidence_reference"
  | "save_closeout_acceptance_note"
  | "save_closeout_waiver_reason"
  | "mark_evidence_attached"
  | "waive_evidence"
  | "send_to_review"
  | "resolve_workflow_blocker"
  | "reopen_workflow_blocker"
  | "create_rfi_from_field_issue"
  | "create_change_event_from_field_issue"
  | "mark_field_issue_controlled"
  | "resolve_field_issue"
  | "reopen_field_issue"
  | "mark_closeout_evidence_attached"
  | "waive_closeout_requirement"
  | "send_closeout_item_to_review"
  | "resolve_closeout_blocker"
  | "reopen_closeout_blocker";

export type WorkflowCompletionLinkedOutput = {
  id: string;
  type:
    | "rfi"
    | "change_event"
    | "field_control_note"
    | "closeout_package_update"
    | "final_billing_release_note"
    | "acceptance_readiness_update";
  title: string;
  status: "draft" | "open" | "controlled" | "resolved" | "ready_for_review" | "ready";
  sourceIssueId?: string;
  href?: string;
  summary?: string;
};

export type WorkflowCompletionSourceIssue = {
  title: string;
  sourceDailyReport: string;
  location: string;
  recommendedEscalationPath: string;
  relatedEvidence?: string[];
};

export type WorkflowCompletionItem = {
  id: string;
  completionWorkflowId:
    | "billing-backup-cash-recovery"
    | "field-issue-escalation"
    | "closeout-requirement-final-billing-release";
  workflowType: "billing_backup_blocker" | "field_issue_escalation" | "closeout_requirement_completion";
  completionCategory?: "cash_recovery" | "field_escalation" | "closeout_release";
  title: string;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  projectId: string;
  projectName: string;
  payApplicationId?: string;
  payApplicationNumber?: string;
  owner: string;
  dueDate: string;
  status: WorkflowCompletionStatus;
  resolutionState: WorkflowCompletionResolutionState;
  severity: "critical" | "high" | "watch" | "info";
  reason: string;
  businessImpact: string;
  blocker: string;
  blockedAmount?: number;
  requiredEvidenceIds: string[];
  relatedNotificationIds: string[];
  relatedLinks: Array<{
    label: string;
    href: string;
  }>;
  displayFacts?: Array<{
    label: string;
    value: string;
  }>;
  sourceIssue?: WorkflowCompletionSourceIssue;
  linkedOutputRecords?: WorkflowCompletionLinkedOutput[];
  requiredPermissions: RybexPermission[];
  nextStep: string;
  updatedAt: string;
  resolvedAt?: string;
};

export type WorkflowCompletionHistoryEntry = {
  id: string;
  itemId: string;
  actionType: WorkflowCompletionActionType;
  label: string;
  actor: string;
  actorRole: string;
  note: string;
  createdAt: string;
};

export type WorkflowCompletionActionInput = {
  actionType: WorkflowCompletionActionType;
  note?: string;
  savedFields?: Record<string, string>;
  actor?: string;
  actorRole?: string;
};

export type WorkflowCompletionResult = {
  success: boolean;
  item: WorkflowCompletionItem;
  historyEntry?: WorkflowCompletionHistoryEntry;
  message: string;
  nextStep: string;
  error?: string;
};

export type BillingBackupCompletionContext = {
  item: WorkflowCompletionItem;
  evidenceRequirements: EvidenceRequirement[];
};

export type WorkflowCompletionContext = BillingBackupCompletionContext;
