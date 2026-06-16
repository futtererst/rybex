import type { CompletionWorkflowId } from "./definition-types";
import type { WorkflowCompletionActionType } from "./types";

export type CompletionFieldValidationRule = {
  type: "required" | "required_when_field_equals";
  fieldId?: string;
  value?: string;
  message: string;
};

export type CompletionFieldSaveAction = {
  actionType: WorkflowCompletionActionType;
  label: string;
};

export type CompletionSavedFieldValue = {
  fieldId: string;
  value: string;
  savedAt: string;
};

export type CompletionEditableField = {
  fieldId: string;
  workflowId: CompletionWorkflowId;
  label: string;
  helperText: string;
  placeholder: string;
  inputType: "text" | "textarea" | "select" | "currency";
  options?: string[];
  required: boolean;
  requiredBeforeActionTypes: WorkflowCompletionActionType[];
  saveActionType: WorkflowCompletionActionType;
  historyMessageTemplate: string;
  summaryLabel: string;
  qaSelector: string;
  saveButtonQaSelector: string;
  savedValueQaSelector: string;
  validationMessage: string;
  requiresFieldValue?: {
    fieldId: string;
    value: string;
  };
};

export const completionEditableFieldContracts: Record<CompletionWorkflowId, CompletionEditableField[]> = {
  "billing-backup-cash-recovery": [
    {
      fieldId: "backup_note",
      workflowId: "billing-backup-cash-recovery",
      label: "Backup note",
      helperText: "Explain what backup supports Pay App 003 and the $84K blocked amount.",
      placeholder: "Signed T&M ticket and product approval backup are available for CE-004.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["mark_evidence_attached"],
      saveActionType: "save_backup_note",
      historyMessageTemplate: "Saved backup note",
      summaryLabel: "Saved backup note",
      qaSelector: "backup-note-input",
      saveButtonQaSelector: "save-backup-note",
      savedValueQaSelector: "saved-backup-note",
      validationMessage: "Save a backup note for Pay App 003 before marking the backup package attached."
    },
    {
      fieldId: "billing_evidence_reference",
      workflowId: "billing-backup-cash-recovery",
      label: "Evidence reference",
      helperText: "Point to the daily report, photo log, T&M ticket, approval backup, or file/package location the reviewer should inspect.",
      placeholder: "Daily Report 2026-06-24, Photo Log PL-18, and approval package in Billing/Pay App 003/CE-004.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["mark_evidence_attached"],
      saveActionType: "save_evidence_reference",
      historyMessageTemplate: "Saved evidence reference",
      summaryLabel: "Saved evidence reference",
      qaSelector: "billing-evidence-reference-input",
      saveButtonQaSelector: "save-billing-evidence-reference",
      savedValueQaSelector: "saved-billing-evidence-reference",
      validationMessage: "Save an evidence reference before this Pay App 003 item can move toward commercial review."
    },
    {
      fieldId: "billing_resolution_note",
      workflowId: "billing-backup-cash-recovery",
      label: "Resolution note",
      helperText: "State why the billing backup blocker can be cleared for this item.",
      placeholder: "Backup package documented and sent to commercial review for Pay App 003.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["resolve_workflow_blocker"],
      saveActionType: "save_billing_resolution_note",
      historyMessageTemplate: "Saved resolution note",
      summaryLabel: "Saved resolution note",
      qaSelector: "billing-resolution-note-input",
      saveButtonQaSelector: "save-billing-resolution-note",
      savedValueQaSelector: "saved-billing-resolution-note",
      validationMessage: "Save a resolution note before clearing the Pay App 003 billing blocker."
    }
  ],
  "field-issue-escalation": [
    {
      fieldId: "field_escalation_note",
      workflowId: "field-issue-escalation",
      label: "Escalation note",
      helperText: "Describe what needs clarification, cost protection, or owner direction.",
      placeholder: "Example: Conduit route in Zone B conflicts with marked utility path and requires owner direction before continuing.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["create_rfi_from_field_issue", "create_change_event_from_field_issue"],
      saveActionType: "save_escalation_note",
      historyMessageTemplate: "Saved escalation note",
      summaryLabel: "Saved escalation note",
      qaSelector: "field-escalation-note-input",
      saveButtonQaSelector: "save-field-escalation-note",
      savedValueQaSelector: "saved-field-escalation-note",
      validationMessage: "Save the escalation note before choosing a control path."
    },
    {
      fieldId: "field_control_path",
      workflowId: "field-issue-escalation",
      label: "Recommended control path",
      helperText: "Choose the path that controls this field issue.",
      placeholder: "Select control path",
      inputType: "select",
      options: ["RFI", "Change event"],
      required: true,
      requiredBeforeActionTypes: ["create_rfi_from_field_issue", "create_change_event_from_field_issue"],
      saveActionType: "save_control_path",
      historyMessageTemplate: "Saved control path",
      summaryLabel: "Saved control path",
      qaSelector: "field-control-path-input",
      saveButtonQaSelector: "save-field-control-path",
      savedValueQaSelector: "saved-field-control-path",
      validationMessage: "Save the recommended control path before creating an RFI or change event."
    },
    {
      fieldId: "rfi_draft_title",
      workflowId: "field-issue-escalation",
      label: "RFI draft title",
      helperText: "Name the RFI draft that will be created from this issue.",
      placeholder: "Example: RFI - Zone B conduit routing conflict",
      inputType: "text",
      required: true,
      requiredBeforeActionTypes: ["create_rfi_from_field_issue"],
      saveActionType: "save_rfi_draft_details",
      historyMessageTemplate: "Saved RFI draft title",
      summaryLabel: "Saved RFI draft title",
      qaSelector: "rfi-draft-title-input",
      saveButtonQaSelector: "save-rfi-draft-title",
      savedValueQaSelector: "saved-rfi-draft-title",
      validationMessage: "Save the RFI draft title before creating the RFI.",
      requiresFieldValue: { fieldId: "field_control_path", value: "RFI" }
    },
    {
      fieldId: "rfi_question",
      workflowId: "field-issue-escalation",
      label: "RFI question",
      helperText: "Write the question that needs owner direction.",
      placeholder: "Example: Confirm revised routing direction or approve field reroute around marked utility conflict.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["create_rfi_from_field_issue"],
      saveActionType: "save_rfi_draft_details",
      historyMessageTemplate: "Saved RFI question",
      summaryLabel: "Saved RFI question",
      qaSelector: "rfi-question-input",
      saveButtonQaSelector: "save-rfi-question",
      savedValueQaSelector: "saved-rfi-question",
      validationMessage: "Save the RFI question before creating the RFI.",
      requiresFieldValue: { fieldId: "field_control_path", value: "RFI" }
    },
    {
      fieldId: "change_event_title",
      workflowId: "field-issue-escalation",
      label: "Change event title",
      helperText: "Name the change event that will protect recovery.",
      placeholder: "Example: Change Event - Zone B conduit reroute due to utility conflict",
      inputType: "text",
      required: true,
      requiredBeforeActionTypes: ["create_change_event_from_field_issue"],
      saveActionType: "save_change_event_details",
      historyMessageTemplate: "Saved change event title",
      summaryLabel: "Saved change event title",
      qaSelector: "change-event-title-input",
      saveButtonQaSelector: "save-change-event-title",
      savedValueQaSelector: "saved-change-event-title",
      validationMessage: "Save the change event title before creating the change event.",
      requiresFieldValue: { fieldId: "field_control_path", value: "Change event" }
    },
    {
      fieldId: "change_impact_note",
      workflowId: "field-issue-escalation",
      label: "Change impact note",
      helperText: "Describe the scope, cost, or schedule impact.",
      placeholder: "Example: Potential added labor and schedule impact from reroute around marked utility conflict.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["create_change_event_from_field_issue"],
      saveActionType: "save_change_event_details",
      historyMessageTemplate: "Saved change impact note",
      summaryLabel: "Saved change impact note",
      qaSelector: "change-impact-note-input",
      saveButtonQaSelector: "save-change-impact-note",
      savedValueQaSelector: "saved-change-impact-note",
      validationMessage: "Save the change impact note before creating the change event.",
      requiresFieldValue: { fieldId: "field_control_path", value: "Change event" }
    },
    {
      fieldId: "field_control_reason",
      workflowId: "field-issue-escalation",
      label: "Control reason",
      helperText: "Explain why the issue is now under control.",
      placeholder: "Example: RFI draft created and linked to the field issue for owner response.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["mark_field_issue_controlled"],
      saveActionType: "save_control_reason",
      historyMessageTemplate: "Saved control reason",
      summaryLabel: "Saved control reason",
      qaSelector: "field-control-reason-input",
      saveButtonQaSelector: "save-field-control-reason",
      savedValueQaSelector: "saved-field-control-reason",
      validationMessage: "Save the control reason before marking the issue controlled."
    },
    {
      fieldId: "field_resolution_note",
      workflowId: "field-issue-escalation",
      label: "Resolution note",
      helperText: "Explain why the field issue can be resolved.",
      placeholder: "Example: Issue is controlled through RFI tracking and no longer unmanaged in the daily report.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["resolve_field_issue"],
      saveActionType: "save_field_resolution_note",
      historyMessageTemplate: "Saved field resolution note",
      summaryLabel: "Saved field resolution note",
      qaSelector: "field-resolution-note-input",
      saveButtonQaSelector: "save-field-resolution-note",
      savedValueQaSelector: "saved-field-resolution-note",
      validationMessage: "Save the field resolution note before resolving the issue."
    }
  ],
  "closeout-requirement-final-billing-release": [
    {
      fieldId: "closeout_evidence_note",
      workflowId: "closeout-requirement-final-billing-release",
      label: "Closeout evidence note",
      helperText: "Describe the closeout evidence provided.",
      placeholder: "Example: As-built redlines for Fiber Backbone Segment A are complete and included in the closeout package.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["mark_closeout_evidence_attached"],
      saveActionType: "save_closeout_evidence_note",
      historyMessageTemplate: "Saved closeout evidence note",
      summaryLabel: "Saved closeout evidence note",
      qaSelector: "closeout-evidence-note-input",
      saveButtonQaSelector: "save-closeout-evidence-note",
      savedValueQaSelector: "saved-closeout-evidence-note",
      validationMessage: "Save the closeout evidence note before marking evidence attached."
    },
    {
      fieldId: "closeout_evidence_reference",
      workflowId: "closeout-requirement-final-billing-release",
      label: "Evidence reference",
      helperText: "Point to the closeout package section, file, or record where the evidence is located.",
      placeholder: "Example: Closeout Package CP-001, Section 04 - As-builts, file ASB-FB-A-Rev2.pdf.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["mark_closeout_evidence_attached"],
      saveActionType: "save_closeout_evidence_reference",
      historyMessageTemplate: "Saved closeout evidence reference",
      summaryLabel: "Saved closeout evidence reference",
      qaSelector: "closeout-evidence-reference-input",
      saveButtonQaSelector: "save-closeout-evidence-reference",
      savedValueQaSelector: "saved-closeout-evidence-reference",
      validationMessage: "Save the closeout evidence reference before marking evidence attached."
    },
    {
      fieldId: "closeout_acceptance_note",
      workflowId: "closeout-requirement-final-billing-release",
      label: "Acceptance note",
      helperText: "Explain why this item can support acceptance, final billing, or retainage release.",
      placeholder: "Example: Required as-built documentation is complete and ready for final billing/acceptance review.",
      inputType: "textarea",
      required: true,
      requiredBeforeActionTypes: ["resolve_closeout_blocker"],
      saveActionType: "save_closeout_acceptance_note",
      historyMessageTemplate: "Saved acceptance note",
      summaryLabel: "Saved acceptance note",
      qaSelector: "closeout-acceptance-note-input",
      saveButtonQaSelector: "save-closeout-acceptance-note",
      savedValueQaSelector: "saved-closeout-acceptance-note",
      validationMessage: "Save the acceptance note before resolving the closeout blocker."
    }
  ]
};

export function getEditableFieldsForWorkflow(workflowId: CompletionWorkflowId) {
  return completionEditableFieldContracts[workflowId] ?? [];
}

export function getRequiredFieldsForAction(workflowId: CompletionWorkflowId, actionType: WorkflowCompletionActionType) {
  return getEditableFieldsForWorkflow(workflowId).filter((field) =>
    field.requiredBeforeActionTypes.includes(actionType)
  );
}
