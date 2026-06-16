import { deriveEvidenceRequirements } from "../evidence";
import type { EvidenceRequirement } from "../evidence/types";
import { billingBackupItems, commercialExposureItems, payApplications } from "../seed-data";
import type { SimplifiedNextAction } from "../simplification/derive-next-actions";
import type {
  BillingBackupCompletionContext,
  WorkflowCompletionActionInput,
  WorkflowCompletionActionType,
  WorkflowCompletionItem,
  WorkflowCompletionResult
} from "./types";
import { getRequiredFieldsForAction } from "./editable-field-contracts";
import {
  getCompletionDefinitionForItem,
  getCompletionWorkflowDefinition,
  getRegisteredCompletionWorkflowDefinitions
} from "./workflow-completion-registry";

const proofBackupId = "bb-lake-001";

export function getBillingBackupProofFocusId() {
  return getCompletionWorkflowDefinition("billing-backup-cash-recovery").focusKey;
}

export function getFieldIssueProofFocusId() {
  return getCompletionWorkflowDefinition("field-issue-escalation").focusKey;
}

export function getCloseoutProofFocusId() {
  return getCompletionWorkflowDefinition("closeout-requirement-final-billing-release").focusKey;
}

export function getBillingBackupCompletionContext(): BillingBackupCompletionContext | null {
  const backup = billingBackupItems.find((item) => item.id === proofBackupId)
    ?? billingBackupItems.find((item) => item.requiredForBilling && ["missing", "partial"].includes(item.status));

  if (!backup) return null;

  const payApplication = payApplications.find((item) => item.id === backup.payApplicationId);
  const exposure = commercialExposureItems.find((item) => item.sourceType === "billing_backup" && item.sourceId === backup.id);
  const evidenceSummary = deriveEvidenceRequirements();
  const evidenceRequirements = evidenceSummary.allEvidenceRequirements.filter((item) =>
    item.sourceModule === "billing" &&
    item.sourceRecordType === "billing_backup_item" &&
    item.sourceRecordId === backup.id
  );

  const item: WorkflowCompletionItem = {
    ...getCompletionWorkflowDefinition("billing-backup-cash-recovery").demoSeedData.item,
    id: getBillingBackupProofFocusId(),
    completionWorkflowId: "billing-backup-cash-recovery",
    workflowType: "billing_backup_blocker",
    completionCategory: "cash_recovery",
    title: "Add missing billing backup",
    sourceModule: "billing",
    sourceRecordType: "billing_backup_item",
    sourceRecordId: backup.id,
    projectId: backup.projectId,
    projectName: payApplication?.projectName ?? "Billing project",
    payApplicationId: backup.payApplicationId,
    payApplicationNumber: payApplication?.payApplicationNumber ?? "Pay application",
    owner: backup.owner,
    dueDate: backup.dueDate,
    status: "waiting_on_evidence",
    resolutionState: "evidence_required",
    severity: exposure?.estimatedValue ? "high" : "watch",
    reason: "Pay App 003 is blocked because required backup documentation is missing or incomplete.",
    businessImpact: "The $84K cash recovery path cannot move to commercial review until the backup package is documented and referenced.",
    blocker: backup.title,
    blockedAmount: exposure?.estimatedValue,
    requiredEvidenceIds: evidenceRequirements.map((requirement) => requirement.id),
    relatedNotificationIds: evidenceRequirements.map((requirement) => `notification-evidence-${requirement.id}`),
    relatedLinks: [
      { label: "Open pay application", href: "/billing/pay-application/new" },
      { label: "Review change exposure", href: "/changes?focus=changes-commercial-recovery#focused-task" },
      { label: "Review field support", href: "/field-execution?focus=field-execution-field-issue#focused-task" }
    ],
    requiredPermissions: ["edit_billing", "review_billing_backup"],
    nextStep: "Document the backup support, reference evidence, and send the package to commercial review.",
    updatedAt: "2026-06-12T00:00:00.000Z"
  };

  return {
    item,
    evidenceRequirements
  };
}

export function getFieldIssueCompletionContext(): BillingBackupCompletionContext {
  const item = getCompletionWorkflowDefinition("field-issue-escalation").demoSeedData.item;

  return {
    item,
    evidenceRequirements: []
  };
}

export function getCloseoutCompletionContext(): BillingBackupCompletionContext {
  const definition = getCompletionWorkflowDefinition("closeout-requirement-final-billing-release");

  return {
    item: definition.demoSeedData.item,
    evidenceRequirements: []
  };
}

export function getBillingBackupProofAction(): SimplifiedNextAction | null {
  const context = getBillingBackupCompletionContext();

  if (!context) return null;

  return {
    id: context.item.id,
    title: context.item.title,
    owner: context.item.owner,
    dueDate: context.item.dueDate,
    whyItMatters: context.item.businessImpact,
    ctaLabel: "Add missing billing backup",
    href: "/billing",
    severity: context.item.severity
  };
}

export function getFieldIssueProofAction(): SimplifiedNextAction {
  const context = getFieldIssueCompletionContext();

  return {
    id: context.item.id,
    title: context.item.title,
    owner: context.item.owner,
    dueDate: context.item.dueDate,
    whyItMatters: context.item.businessImpact,
    ctaLabel: "Escalate field issue",
    href: "/field-execution",
    severity: context.item.severity
  };
}

export function getCloseoutProofAction(): SimplifiedNextAction {
  const context = getCloseoutCompletionContext();

  return {
    id: context.item.id,
    title: context.item.title,
    owner: context.item.owner,
    dueDate: context.item.dueDate,
    whyItMatters: context.item.businessImpact,
    ctaLabel: "Complete closeout requirement",
    href: "/closeout",
    severity: context.item.severity
  };
}

export function getAvailableCompletionActions(item: WorkflowCompletionItem): WorkflowCompletionActionType[] {
  return getAvailableCompletionActionDefinitions(item).map((action) => action.actionType);
}

export function getAvailableCompletionActionDefinitions(item: WorkflowCompletionItem) {
  const definition = getCompletionDefinitionForItem(item);
  return definition.actions.filter((action) => action.fromStates.includes(item.status));
}

export function getRegisteredCompletionWorkflowIds() {
  return getRegisteredCompletionWorkflowDefinitions().map((definition) => definition.id);
}

export function applyWorkflowCompletionAction(
  item: WorkflowCompletionItem,
  input: WorkflowCompletionActionInput
): WorkflowCompletionResult {
  const now = new Date().toISOString();
  const actor = input.actor ?? "Demo user";
  const actorRole = input.actorRole ?? "Finance / PM";
  const note = input.note?.trim() ?? "";
  const definition = getCompletionDefinitionForItem(item);
  const action = definition.actions.find((candidate) => candidate.actionType === input.actionType);

  if (!action || !action.fromStates.includes(item.status)) {
    return {
      success: false,
      item,
      message: action?.blockedMessage ?? "Action is not available for the current completion state.",
      nextStep: item.nextStep,
      error: "action_not_available"
    };
  }

  if (action.requiresReason && note.length < 4) {
    return {
      success: false,
      item,
      message: action.blockedMessage,
      nextStep: "Enter a short reason.",
      error: "reason_required"
    };
  }

  const savedFields = input.savedFields ?? {};
  const requiredFields = getRequiredFieldsForAction(definition.id, input.actionType);
  const wrongFieldPath =
    definition.id === "field-issue-escalation" &&
    input.actionType === "create_rfi_from_field_issue" &&
    savedFields.field_control_path &&
    savedFields.field_control_path !== "RFI"
      ? "Save Recommended control path as RFI before creating an RFI."
      : definition.id === "field-issue-escalation" &&
          input.actionType === "create_change_event_from_field_issue" &&
          savedFields.field_control_path &&
          savedFields.field_control_path !== "Change event"
        ? "Save Recommended control path as Change event before creating a change event."
        : null;

  if (wrongFieldPath) {
    return {
      success: false,
      item,
      message: wrongFieldPath,
      nextStep: "Save the matching control path first.",
      error: "required_field_missing"
    };
  }

  const missingField = requiredFields.find((field) => {
    if (field.requiresFieldValue && savedFields[field.requiresFieldValue.fieldId] !== field.requiresFieldValue.value) {
      return false;
    }

    return !savedFields[field.fieldId]?.trim();
  });

  if (missingField) {
    return {
      success: false,
      item,
      message: missingField.validationMessage,
      nextStep: `Save ${missingField.label.toLowerCase()} first.`,
      error: "required_field_missing"
    };
  }

  const linkedOutputRecords = action.createsLinkedOutput
    ? appendLinkedOutput(item.linkedOutputRecords ?? [], action.createsLinkedOutput)
    : item.linkedOutputRecords;

  const updatedItem: WorkflowCompletionItem = {
    ...item,
    status: action.toState,
    resolutionState: action.resolutionState,
    linkedOutputRecords,
    nextStep: action.nextStep,
    updatedAt: now,
    resolvedAt: definition.terminalStates.includes(action.toState) ? now : item.resolvedAt
  };

  return {
    success: true,
    item: updatedItem,
    historyEntry: {
      id: `${item.id}-${input.actionType}-${updatedItem.status}`,
      itemId: item.id,
      actionType: input.actionType,
      label: action.label,
      actor,
      actorRole,
      note: note || action.resultMessage,
      createdAt: now
    },
    message: action.resultMessage,
    nextStep: updatedItem.nextStep
  };
}

function appendLinkedOutput(
  current: WorkflowCompletionItem["linkedOutputRecords"] = [],
  output: NonNullable<WorkflowCompletionItem["linkedOutputRecords"]>[number]
) {
  if (current.some((item) => item.id === output.id)) return current;
  return [...current, output];
}
