"use client";

import { compactCurrency } from "@/lib/d5o/presentation";
import {
  getAvailableCompletionActionDefinitions
} from "@/lib/d5o/workflow-completion/completion-service";
import { getEditableFieldsForWorkflow, getRequiredFieldsForAction, type CompletionEditableField } from "@/lib/d5o/workflow-completion/editable-field-contracts";
import type { CompletionWorkflowDefinition } from "@/lib/d5o/workflow-completion/definition-types";
import type {
  BillingBackupCompletionContext,
  WorkflowCompletionActionType,
  WorkflowCompletionItem
} from "@/lib/d5o/workflow-completion/types";
import { getCompletionDefinitionForItem } from "@/lib/d5o/workflow-completion/workflow-completion-registry";
import { CompletionProgressStepper } from "./CompletionProgressStepper";
import { CompletionResultBanner } from "./CompletionResultBanner";
import { GuidedCompletionFlow } from "./GuidedCompletionFlow";
import { WorkflowHistoricalRecordPanel } from "./WorkflowHistoricalRecordPanel";
import { WorkflowOutcomeRecordPanel } from "./WorkflowOutcomeRecordPanel";
import { useWorkflowCompletion } from "./WorkflowCompletionProvider";

type WorkflowCompletionPanelProps = {
  context: BillingBackupCompletionContext;
};

export function WorkflowCompletionPanel({ context }: WorkflowCompletionPanelProps) {
  const completion = useWorkflowCompletion();
  const returnToPilot = true;
  const definition = getCompletionDefinitionForItem(context.item);
  const item = completion.getCompletionItem(definition.id);
  const result = completion.getResult(definition.id);
  const outcomeRecord = completion.getOutcomeRecord(definition.id);
  const history = completion.getHistory(definition.id);
  const savedFields = completion.getSavedFields(definition.id);
  const actions = definition.actions.filter((action) =>
    action.actionType !== "reopen_workflow_blocker" &&
    action.actionType !== "reopen_field_issue" &&
    action.actionType !== "reopen_closeout_blocker"
  );
  const availableActionTypes = new Set(getAvailableCompletionActionDefinitions(item).map((action) => action.actionType));
  const linkedOutputs = item.linkedOutputRecords ?? [];
  const evidenceLabels = getEvidenceLabels(definition, context, item);

  function run(actionType: WorkflowCompletionActionType, note?: string) {
    completion.applyAction(definition.id, actionType, { note });
  }

  function saveField(field: CompletionEditableField, value: string) {
    completion.saveField(definition.id, field, value);
  }

  return (
    <section
      className="workflow-completion-panel"
      data-completion-item-id={item.id}
      data-completion-status={item.status}
      data-workflow-id={definition.id}
      data-workflow-type={item.workflowType}
      data-qa={definition.qaSelectors.completionPanel}
      data-ready="true"
    >
      <GuidedCompletionFlow
        definition={definition}
        history={history}
        item={item}
        onReset={() => {
          completion.resetWorkflow(definition.id);
        }}
        onRun={run}
        onSaveField={saveField}
        pendingAction={null}
        result={result}
        returnToPilot={returnToPilot}
        savedFields={savedFields}
      />

      {outcomeRecord ? (
        <>
          <WorkflowOutcomeRecordPanel record={outcomeRecord} />
          <WorkflowHistoricalRecordPanel
            history={history}
            record={outcomeRecord}
            workflowName={definition.title}
          />
        </>
      ) : null}

      <div className="completion-section-heading">
        <div>
          <p className="eyebrow">Workflow completion</p>
          <h3>{item.title}</h3>
          <p>{item.reason}</p>
        </div>
        <span className={`chip chip-${completionTone(item)}`} data-qa={definition.qaSelectors.state}>
          {stateLabel(definition, item)}
        </span>
      </div>

      <CompletionProgressStepper status={item.status} />

      <dl className="completion-facts">
        {completionFacts(item).map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {result ? (
        <CompletionResultBanner
          message={result.message}
          nextStep={result.nextStep}
          qaSelector={definition.qaSelectors.resultBanner}
          tone={result.success ? "success" : "error"}
        />
      ) : (
        <p className="completion-mode-note" data-qa={definition.qaSelectors.resultBanner}>Local demo completion: this updates browser state only.</p>
      )}

      {evidenceLabels.length > 0 ? (
        <section className="evidence-resolution-control" aria-label="Evidence requirements">
          <div className="completion-section-heading">
            <div>
              <p className="eyebrow">Evidence</p>
              <h3>Needed for completion</h3>
            </div>
          </div>
          <ul className="plain-list">
            {evidenceLabels.map((evidence) => (
              <li key={evidence.id}>
                <strong>{evidence.label}</strong>
                <span className="chip chip-warning" data-qa={evidence.qaSelector ?? "evidence-status"}>
                  {evidence.statusLabel}
                </span>
                <span className="chip chip-info" data-qa="evidence-completion-state">
                  {stateLabel(definition, item)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="completion-action-row">
        {actions.map((action) => (
          <button
            className={`button ${action.primary ? "button-primary" : "button-secondary"}`}
            data-completion-action={action.actionType}
            data-available={availableActionTypes.has(action.actionType) ? "true" : "future"}
            data-qa={action.qaSelector}
            disabled={missingFieldsForAction(definition.id, action.actionType, savedFields).length > 0}
            key={action.actionType}
            onClick={() => run(action.actionType, defaultNoteFor(action.actionType))}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>

      {definition.linkedOutputTypes.length > 0 ? (
        <section className="completion-linked-output" aria-label="Linked output records">
          <div className="completion-section-heading">
            <div>
              <p className="eyebrow">Linked output</p>
              <h3>{linkedOutputHeading(definition)}</h3>
            </div>
          </div>
          {linkedOutputs.length > 0 ? (
            <ul className="plain-list" data-qa="linked-output-list">
              {linkedOutputs.map((output) => (
                <li data-qa={definition.qaSelectors.linkedOutput ?? "linked-output-record"} key={output.id}>
                  <strong>{output.title}</strong>
                  <span> · {output.type.replace("_", " ")} · {output.status}</span>
                  {output.summary ? <p>{output.summary}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" data-qa={definition.qaSelectors.linkedOutput ?? "linked-output-record"}>No RFI or change event draft yet.</p>
          )}
        </section>
      ) : null}

      {item.relatedLinks.length > 0 ? (
        <div className="completion-related-links">
          {item.relatedLinks.map((link) => (
            <a className="quiet-link" href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      ) : null}

      <section className="completion-history" data-qa={definition.qaSelectors.history}>
        <div className="completion-section-heading">
          <div>
            <p className="eyebrow">Demo history</p>
            <h3>What changed</h3>
          </div>
          <span data-qa="completion-history-count">{history.length} event(s)</span>
        </div>
        {history.length > 0 ? (
          <ol data-qa="completion-history-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.label}</strong>
                <span>{entry.actor} · {new Date(entry.createdAt).toLocaleString()}</span>
                <p>{entry.note}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted" data-qa="completion-history-empty">No local completion actions yet.</p>
        )}
      </section>
    </section>
  );
}

function completionFacts(item: WorkflowCompletionItem) {
  if (item.displayFacts && item.displayFacts.length > 0) {
    return item.displayFacts;
  }

  if (item.sourceIssue) {
    return [
      { label: "Issue", value: item.sourceIssue?.title ?? item.title },
      { label: "Location", value: item.sourceIssue?.location ?? "Field area" },
      { label: "Source report", value: item.sourceIssue?.sourceDailyReport ?? "Daily report" },
      { label: "Recommended path", value: item.sourceIssue?.recommendedEscalationPath ?? item.nextStep }
    ];
  }

  return [
    { label: "Project", value: item.projectName },
    { label: "Pay app", value: item.payApplicationNumber ?? "Pay application" },
    { label: "Cash blocked", value: item.blockedAmount ? compactCurrency.format(item.blockedAmount) : "At risk" },
    { label: "Current blocker", value: item.blocker }
  ];
}

function linkedOutputHeading(definition: CompletionWorkflowDefinition) {
  if (definition.linkedOutputTypes.some((type) => type.startsWith("closeout") || type.includes("billing_release"))) {
    return "Closeout / final billing";
  }

  return "RFI / change control";
}

function completionTone(item: WorkflowCompletionItem) {
  if (item.status === "resolved" || item.status === "controlled") return "success";
  if (item.severity === "high") return "warning";
  return "info";
}

function stateLabel(definition: CompletionWorkflowDefinition, item: WorkflowCompletionItem) {
  return definition.states.find((state) => state.state === item.status)?.label ?? item.status.replaceAll("_", " ");
}

function getEvidenceLabels(
  definition: CompletionWorkflowDefinition,
  context: BillingBackupCompletionContext,
  item: WorkflowCompletionItem
) {
  const statusLabel = evidenceStatusForItem(item);
  const derivedEvidence = context.evidenceRequirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.title,
    statusLabel: statusLabel ?? requirement.status,
    qaSelector: "evidence-status"
  }));

  return derivedEvidence.length > 0
    ? derivedEvidence
    : definition.requiredEvidence.map((evidence) => ({
        ...evidence,
        statusLabel: statusLabel ?? evidence.statusLabel
      }));
}

function evidenceStatusForItem(item: WorkflowCompletionItem) {
  if (item.status === "resolved") return "verified";
  if (item.status === "waived") return "waived";
  if (["evidence_attached", "ready_for_review"].includes(item.status)) return "uploaded";
  return null;
}

function defaultNoteFor(actionType: WorkflowCompletionActionType) {
  const notes: Partial<Record<WorkflowCompletionActionType, string>> = {
    mark_evidence_attached: "Backup attached in local demo state.",
    waive_evidence: "Evidence waived for local demo review.",
    send_to_review: "Ready for review.",
    resolve_workflow_blocker: "Workflow blocker resolved in local demo state.",
    create_rfi_from_field_issue: "RFI draft started from Zone B field issue.",
    create_change_event_from_field_issue: "Change event draft started from Zone B field issue.",
    mark_field_issue_controlled: "Field issue is controlled through the selected path.",
    resolve_field_issue: "Field issue resolved in local demo state.",
    mark_closeout_evidence_attached: "Closeout evidence attached in local demo state.",
    waive_closeout_requirement: "Closeout requirement waived for local demo review.",
    send_closeout_item_to_review: "Closeout item ready for review.",
    resolve_closeout_blocker: "Closeout blocker resolved in local demo state.",
    reopen_closeout_blocker: "Closeout blocker reopened in local demo state."
  };

  return notes[actionType];
}

function missingFieldsForAction(
  workflowId: CompletionWorkflowDefinition["id"],
  actionType: WorkflowCompletionActionType,
  savedFields: Record<string, string>
) {
  const required = getRequiredFieldsForAction(workflowId, actionType).filter((field) => {
    if (field.requiresFieldValue && savedFields[field.requiresFieldValue.fieldId] !== field.requiresFieldValue.value) {
      return false;
    }

    return !savedFields[field.fieldId]?.trim();
  });

  if (workflowId === "field-issue-escalation") {
    const path = savedFields.field_control_path;
    const pathField = getEditableFieldsForWorkflow(workflowId).find((field) => field.fieldId === "field_control_path");
    if (pathField && actionType === "create_rfi_from_field_issue" && path && path !== "RFI") {
      return [{ ...pathField, validationMessage: "Save Recommended control path as RFI before creating an RFI." }, ...required];
    }
    if (pathField && actionType === "create_change_event_from_field_issue" && path && path !== "Change event") {
      return [{ ...pathField, validationMessage: "Save Recommended control path as Change event before creating a change event." }, ...required];
    }
  }

  return required;
}
