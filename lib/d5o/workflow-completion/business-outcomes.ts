import {
  getEditableFieldsForWorkflow
} from "./editable-field-contracts";
import type { CompletionWorkflowDefinition } from "./definition-types";
import type { WorkflowOutcomeRecord } from "./business-outcome-types";
import type {
  WorkflowCompletionHistoryEntry,
  WorkflowCompletionItem
} from "./types";

export function generateWorkflowOutcomeRecord({
  actor,
  completedAt,
  definition,
  history,
  item,
  previousItem,
  savedFields,
  mode
}: {
  actor: string;
  completedAt: string;
  definition: CompletionWorkflowDefinition;
  history: WorkflowCompletionHistoryEntry[];
  item: WorkflowCompletionItem;
  previousItem: WorkflowCompletionItem;
  savedFields: Record<string, string>;
  mode: "local" | "database";
}): WorkflowOutcomeRecord {
  const fields = getEditableFieldsForWorkflow(definition.id);
  const capturedInputs = fields
    .filter((field) => savedFields[field.fieldId]?.trim())
    .map((field) => ({
      fieldId: field.fieldId,
      label: field.label,
      value: savedFields[field.fieldId]
    }));

  const evidenceReferences = evidenceReferencesFor(definition, savedFields);
  const documentReferences = documentReferencesFor(definition, savedFields);
  const outcomeDefinition = definition.outcomeDefinition;
  const businessProcess = outcomeDefinition.businessProcess;
  const businessObject = outcomeDefinition.businessObject;

  return {
    id: `${definition.id}-outcome-${item.status}`,
    workflowId: definition.id,
    completionItemId: item.id,
    businessProcessName: businessProcess.name,
    businessObjectType: businessObject.type,
    businessObjectId: businessObject.id,
    businessObjectLabel: businessObject.label,
    projectName: item.projectName,
    owner: item.owner,
    completedBy: actor,
    completedAt,
    startingProblem: businessProcess.startingProblem,
    inputsCaptured: capturedInputs,
    evidenceReferences,
    documentReferences,
    linkedOutputs: item.linkedOutputRecords ?? [],
    stateChanges: [
      {
        from: previousItem.status,
        to: item.status,
        label: `${stateLabel(previousItem.status)} -> ${stateLabel(item.status)}`
      }
    ],
    businessOutcome: businessProcess.businessOutcome,
    businessImpact: {
      summary: businessProcess.businessImpact,
      commercialValue: item.blockedAmount,
      operationalImpact: item.businessImpact
    },
    remainingBlockers: remainingBlockersFor(definition, item),
    nextBusinessStep: businessProcess.nextBusinessStep,
    auditSummary: `${businessProcess.name} completed with ${capturedInputs.length} saved input(s), ${evidenceReferences.length + documentReferences.length} reference(s), and ${history.length} history event(s).`,
    historicalReferenceLabel: businessProcess.historicalReferenceLabel,
    historicalReference: {
      label: businessProcess.historicalReferenceLabel,
      storageMode: mode === "database" ? "database_pilot" : "local_demo",
      summary: `${businessProcess.historicalReferenceLabel} saved in ${mode === "database" ? "database pilot metadata" : "local demo history"}.`
    },
    localDemoOnly: mode !== "database",
    databaseBacked: mode === "database"
  };
}

function evidenceReferencesFor(definition: CompletionWorkflowDefinition, savedFields: Record<string, string>) {
  if (definition.id === "billing-backup-cash-recovery") {
    return [
      {
        label: "Product approval backup / billing support",
        value: savedFields.billing_evidence_reference ?? "Referenced in completion history.",
        sourceFieldId: "billing_evidence_reference"
      }
    ];
  }

  return [];
}

function documentReferencesFor(definition: CompletionWorkflowDefinition, savedFields: Record<string, string>) {
  if (definition.id === "closeout-requirement-final-billing-release") {
    return [
      {
        label: "Closeout package evidence reference",
        value: savedFields.closeout_evidence_reference ?? "Referenced in completion history.",
        sourceFieldId: "closeout_evidence_reference"
      }
    ];
  }

  if (definition.id === "field-issue-escalation") {
    const path = savedFields.field_control_path;
    if (path === "RFI") {
      return [
        {
          label: savedFields.rfi_draft_title ?? "RFI draft",
          value: savedFields.rfi_question ?? "RFI question captured in completion history.",
          sourceFieldId: "rfi_question"
        }
      ];
    }

    if (path === "Change event") {
      return [
        {
          label: savedFields.change_event_title ?? "Change event draft",
          value: savedFields.change_impact_note ?? "Change impact captured in completion history.",
          sourceFieldId: "change_impact_note"
        }
      ];
    }
  }

  return [];
}

function remainingBlockersFor(definition: CompletionWorkflowDefinition, item: WorkflowCompletionItem) {
  if (definition.id === "billing-backup-cash-recovery" && item.status === "resolved") {
    return [
      {
        label: "Resolved blocker",
        status: "none" as const,
        detail: "Missing backup is no longer the blocker for Pay App 003."
      },
      {
        label: "Outside this workflow",
        status: "open" as const,
        detail: "GC review comments, payment timing, contract compliance, lien waiver, retainage, or unrelated pay app issues remain outside this local/demo workflow."
      }
    ];
  }

  if (item.status === "resolved") {
    return [
      {
        label: "Remaining blockers",
        status: "none" as const,
        detail: "None for this workflow item."
      }
    ];
  }

  if (item.status === "waived") {
    return [
      {
        label: "Accepted risk",
        status: "accepted_risk" as const,
        detail: "Requirement was waived; commercial or acceptance risk should remain visible to the owner."
      }
    ];
  }

  return [
    {
      label: item.blocker,
      status: "open" as const,
      detail: item.nextStep
    }
  ];
}

function stateLabel(state: string) {
  return state.replaceAll("_", " ");
}
