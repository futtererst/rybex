"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";
import type { CompletionActionDefinition, CompletionWorkflowDefinition } from "@/lib/d5o/workflow-completion/definition-types";
import {
  getEditableFieldsForWorkflow,
  getRequiredFieldsForAction,
  type CompletionEditableField
} from "@/lib/d5o/workflow-completion/editable-field-contracts";
import type {
  WorkflowCompletionActionType,
  WorkflowCompletionHistoryEntry,
  WorkflowCompletionItem,
  WorkflowCompletionResult
} from "@/lib/d5o/workflow-completion/types";

type GuidedCompletionFlowProps = {
  definition: CompletionWorkflowDefinition;
  history: WorkflowCompletionHistoryEntry[];
  item: WorkflowCompletionItem;
  onReset?: () => void;
  onRun: (actionType: WorkflowCompletionActionType, note?: string) => void;
  onSaveField?: (field: CompletionEditableField, value: string) => void;
  pendingAction: WorkflowCompletionActionType | null;
  result: WorkflowCompletionResult | null;
  returnToPilot?: boolean;
  savedFields?: Record<string, string>;
};

export function GuidedCompletionFlow({
  definition,
  history,
  item,
  onReset,
  onRun,
  onSaveField,
  pendingAction,
  result,
  returnToPilot,
  savedFields = {}
}: GuidedCompletionFlowProps) {
  const fields = getEditableFieldsForWorkflow(definition.id);
  const actions = getGuidedActions(definition);
  const complete = definition.terminalStates.includes(item.status) || item.status === "resolved";
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrationMarker = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(hydrationMarker);
  }, []);

  return (
    <section className="guided-completion-flow" data-hydrated={hydrated ? "true" : "false"} data-qa="guided-completion-flow">
      <div className="guided-completion-hero">
        <div>
          <p className="eyebrow">Complete task</p>
          <h3>{guidedTitle(definition)}</h3>
          <p>{guidedInstruction(definition)}</p>
        </div>
        <span className={`chip chip-${complete ? "success" : "warning"}`} data-qa="guided-completion-state">
          {humanState(item.status, definition)}
        </span>
      </div>

      <GuidedSummary definition={definition} item={item} savedFields={savedFields} />

      {complete ? (
        <div className="completion-result completion-result-success" data-qa="guided-completion-complete">
          <strong>{result?.message ?? completeMessage(definition)}</strong>
          <span>{returnToPilot ? "Return to Pilot Mode to continue." : item.nextStep}</span>
          <div className="completion-action-row">
            {returnToPilot ? (
              <a className="button button-primary" data-qa="return-to-pilot-mode" href="/pilot?refresh=completion">
                Return to Pilot Mode
              </a>
            ) : null}
            {onReset ? (
              <button className="button button-secondary" data-qa="reset-current-pilot-task" onClick={onReset} type="button">
                Reset Pilot Demo State
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ol className="guided-step-list">
        {fields.map((field, index) => (
          <EditableFieldStep
            field={field}
            index={index + 1}
            key={`${field.fieldId}-${savedFields[field.fieldId] ?? ""}`}
            onSave={(value) => {
              onSaveField?.(field, value);
            }}
            savedValue={savedFields[field.fieldId] ?? ""}
          />
        ))}

        {actions.map((action, index) => (
          <GuidedActionStep
            action={action}
            complete={complete}
            fieldValues={savedFields}
            index={fields.length + index + 1}
            item={item}
            key={action.actionType}
            onRun={onRun}
            pendingAction={pendingAction}
            workflowId={definition.id}
          />
        ))}
      </ol>

      <SavedFieldsSummary fields={fields} savedFields={savedFields} />

      <div className="guided-completion-footer">
        <span>History</span>
        <strong>{history.length} event(s)</strong>
        <span>{history[0]?.label ?? "No actions completed yet."}</span>
      </div>
    </section>
  );
}

function EditableFieldStep({
  field,
  index,
  onSave,
  savedValue
}: {
  field: CompletionEditableField;
  index: number;
  onSave?: (value: string) => void;
  savedValue: string;
}) {
  const saved = savedValue.trim().length > 0;
  const [draftValue, setDraftValue] = useState(savedValue);

  return (
    <li
      className={`guided-step guided-step-${saved ? "done" : "active"}`}
      data-field-id={field.fieldId}
      data-qa="guided-editable-field-step"
    >
      <div>
        <span className="guided-step-number">{index}</span>
        <div>
          <strong>{field.label}</strong>
          <small data-qa={`guided-field-status-${field.qaSelector}`}>{saved ? "Done" : "Not done"}</small>
          <p>{field.helperText}</p>
          <label className="guided-note-field">
            <span>{field.label}</span>
            {field.inputType === "select" ? (
              <select
                data-qa={field.qaSelector}
                onChange={(event) => setDraftValue(event.currentTarget.value)}
                value={draftValue}
              >
                <option value="">{field.placeholder}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <textarea
                data-qa={field.qaSelector}
                onChange={(event) => setDraftValue(event.currentTarget.value)}
                placeholder={field.placeholder}
                rows={field.inputType === "text" ? 1 : 3}
                value={draftValue}
              />
            )}
          </label>
          <p className="guided-saved-note" data-qa={field.savedValueQaSelector}>
            {saved ? `${field.summaryLabel}: ${savedValue}` : `${field.summaryLabel}: not saved yet.`}
          </p>
        </div>
      </div>
      <button
        className="button button-primary"
        data-field-id={field.fieldId}
        data-field-label={field.label}
        data-field-summary-label={field.summaryLabel}
        data-field-save-action={field.saveActionType}
        data-qa={field.saveButtonQaSelector}
        onClick={() => {
          const fieldElement = document.querySelector(`[data-qa="${field.qaSelector}"]`) as
            | HTMLSelectElement
            | HTMLTextAreaElement
            | null;
          const nextValue = (draftValue || fieldElement?.value || "").trim();
          if (!nextValue) return;
          onSave?.(nextValue);
        }}
        type="button"
      >
        {saveLabelFor(field)}
      </button>
    </li>
  );
}

function SavedFieldsSummary({
  fields,
  savedFields
}: {
  fields: CompletionEditableField[];
  savedFields: Record<string, string>;
}) {
  const saved = fields.filter((field) => savedFields[field.fieldId]?.trim());
  if (saved.length === 0) return null;

  return (
    <section className="completion-saved-fields" data-qa="completion-saved-field-summary">
      <p className="eyebrow">Completion summary</p>
      <h4>Saved inputs</h4>
      <ul className="plain-list">
        {saved.map((field) => (
          <li key={field.fieldId}>
            <strong>{field.summaryLabel}</strong>
            <span>{savedFields[field.fieldId]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuidedSummary({
  definition,
  item,
  savedFields
}: {
  definition: CompletionWorkflowDefinition;
  item: WorkflowCompletionItem;
  savedFields: Record<string, string>;
}) {
  if (definition.id === "field-issue-escalation" && item.sourceIssue) {
    return (
      <dl className="completion-facts guided-summary" data-qa="field-issue-guided-summary">
        <div><dt>Field issue</dt><dd>{item.sourceIssue.title}</dd></div>
        <div><dt>Source report</dt><dd>{item.sourceIssue.sourceDailyReport}</dd></div>
        <div><dt>Location</dt><dd>{item.sourceIssue.location}</dd></div>
        <div><dt>Owner</dt><dd>{item.owner}</dd></div>
        <div><dt>Due</dt><dd>{item.dueDate}</dd></div>
        <div><dt>Impact</dt><dd>{item.businessImpact}</dd></div>
      </dl>
    );
  }

  if (definition.id === "closeout-requirement-final-billing-release") {
    return (
      <dl className="completion-facts guided-summary" data-qa="closeout-guided-summary">
        <div><dt>Requirement</dt><dd>{item.reason.replace("Missing ", "").replace(".", "")}</dd></div>
        <div><dt>Package</dt><dd>{item.displayFacts?.find((fact) => fact.label === "Package")?.value ?? item.projectName}</dd></div>
        <div><dt>Owner</dt><dd>{item.owner}</dd></div>
        <div><dt>Due</dt><dd>{item.dueDate}</dd></div>
        <div><dt>Evidence needed</dt><dd>As-built redline package</dd></div>
        <div><dt>Impact</dt><dd>{item.businessImpact}</dd></div>
      </dl>
    );
  }

  if (definition.id === "billing-backup-cash-recovery") {
    return (
      <>
        <dl className="completion-facts guided-summary" data-qa="billing-guided-summary">
          <div><dt>Pay app</dt><dd>{item.payApplicationNumber ?? "Pay App 003"}</dd></div>
          <div><dt>Backup package</dt><dd>Billing backup package for Pay App 003</dd></div>
          <div><dt>Cash blocked</dt><dd>{formatBlockedAmount(item.blockedAmount)}</dd></div>
          <div><dt>Owner</dt><dd>{item.owner}</dd></div>
          <div><dt>Due</dt><dd>{item.dueDate}</dd></div>
          <div><dt>Reviewer</dt><dd>Commercial reviewer / Operations leader</dd></div>
        </dl>
        <BillingBusinessProcessGuide savedFields={savedFields} />
      </>
    );
  }

  return null;
}

function BillingBusinessProcessGuide({ savedFields }: { savedFields: Record<string, string> }) {
  const backupNote = savedFields.backup_note?.trim();
  const evidenceReference = savedFields.billing_evidence_reference?.trim();
  const resolutionNote = savedFields.billing_resolution_note?.trim();

  return (
    <section className="completion-saved-fields" data-qa="billing-v2-business-process-guide">
      <p className="eyebrow">Business process</p>
      <h4>Billing Backup Blocker -&gt; Pay Application Review Readiness</h4>
      <p data-qa="billing-v2-business-problem">
        Pay App 003 is blocked because required backup documentation is missing or incomplete.
        The $84K cash recovery path cannot move to commercial review until the backup package is documented and referenced.
      </p>

      <dl className="completion-facts">
        <div>
          <dt>Business object moving</dt>
          <dd data-qa="billing-v2-business-object">Pay App 003 / billing backup package</dd>
        </div>
        <div>
          <dt>Evidence required</dt>
          <dd data-qa="billing-v2-evidence-required">
            Product approval backup or a traceable daily report, photo log, T&amp;M ticket, approval backup, or file/package reference.
          </dd>
        </div>
        <div>
          <dt>Who receives the handoff</dt>
          <dd data-qa="billing-v2-handoff-owner">
            Commercial reviewer / Operations leader reviews the backup note, evidence reference, related item, and any waiver risk.
          </dd>
        </div>
        <div>
          <dt>What changes after completion</dt>
          <dd data-qa="billing-v2-outcome-preview">
            Missing backup is no longer the blocker for this item, and Pay App 003 becomes ready for commercial review.
          </dd>
        </div>
      </dl>

      <ul className="plain-list" data-qa="billing-v2-readiness-checklist">
        <li>
          <strong>Backup note</strong>
          <span>{backupNote ? `Saved: ${backupNote}` : "Required before the backup can be marked attached."}</span>
        </li>
        <li>
          <strong>Evidence reference</strong>
          <span>{evidenceReference ? `Saved: ${evidenceReference}` : "Required before this item can move toward review."}</span>
        </li>
        <li>
          <strong>Resolution note</strong>
          <span>{resolutionNote ? `Saved: ${resolutionNote}` : "Required before clearing the billing blocker."}</span>
        </li>
      </ul>

      <p className="completion-mode-note" data-qa="billing-v2-local-demo-caveat">
        Local/demo record only: this does not submit Pay App 003, upload production documents, notify external reviewers, or create production persistence.
      </p>

      <p className="completion-mode-note" data-qa="billing-v2-historical-record-location">
        Historical record after completion: Pay App 003 billing backup readiness record. Next business step: open pay application review.
      </p>
    </section>
  );
}

function formatBlockedAmount(value?: number) {
  if (!value) return "$84K";
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
}

function GuidedActionStep({
  action,
  complete,
  fieldValues,
  index,
  item,
  onRun,
  pendingAction,
  workflowId
}: {
  action: CompletionActionDefinition;
  complete: boolean;
  fieldValues: Record<string, string>;
  index: number;
  item: WorkflowCompletionItem;
  onRun: (actionType: WorkflowCompletionActionType, note?: string) => void;
  pendingAction: WorkflowCompletionActionType | null;
  workflowId: CompletionWorkflowDefinition["id"];
}) {
  const done = complete || item.status === action.toState || isPastAction(action, item.status);
  const missing = missingFieldsForAction(workflowId, action.actionType, fieldValues);
  const enabled = !done && !complete && action.fromStates.includes(item.status) && pendingAction === null && missing.length === 0;
  const disabledReason = done
    ? "Done"
    : missing[0]?.validationMessage ?? action.blockedMessage;

  return (
    <li className={`guided-step guided-step-${done ? "done" : enabled ? "active" : "locked"}`} data-qa="guided-completion-step">
      <div>
        <span className="guided-step-number">{index}</span>
        <div>
          <strong>{action.label}</strong>
          <small data-qa={`guided-step-status-${action.qaSelector}`}>{done ? "Done" : "Not done"}</small>
          <p>{action.description}</p>
          {!enabled && !done ? <p data-qa={`disabled-reason-${action.qaSelector}`}>{disabledReason}</p> : null}
        </div>
      </div>
      <GuidedActionButton action={action} enabled={enabled} onRun={onRun} pendingAction={pendingAction} />
    </li>
  );
}

function GuidedActionButton({
  action,
  enabled,
  onRun,
  pendingAction
}: {
  action: CompletionActionDefinition;
  enabled: boolean;
  onRun: (actionType: WorkflowCompletionActionType, note?: string) => void;
  pendingAction?: WorkflowCompletionActionType | null;
}) {
  return (
    <button
      className={`button ${enabled ? "button-primary" : "button-secondary"}`}
      data-completion-action={action.actionType}
      data-qa={action.qaSelector}
      disabled={!enabled}
      onClick={() => onRun(action.actionType, defaultNoteFor(action.actionType))}
      type="button"
    >
      {pendingAction === action.actionType ? "Saving..." : action.label}
    </button>
  );
}

function missingFieldsForAction(
  workflowId: CompletionWorkflowDefinition["id"],
  actionType: WorkflowCompletionActionType,
  fieldValues: Record<string, string>
) {
  const required = getRequiredFieldsForAction(workflowId, actionType).filter((field) => {
    if (field.requiresFieldValue && fieldValues[field.requiresFieldValue.fieldId] !== field.requiresFieldValue.value) {
      return false;
    }

    return !fieldValues[field.fieldId]?.trim();
  });

  if (workflowId === "field-issue-escalation") {
    const path = fieldValues.field_control_path;
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

function saveLabelFor(field: CompletionEditableField) {
  const customLabels: Record<string, string> = {
    backup_note: "Save backup note",
    billing_evidence_reference: "Save evidence reference",
    billing_resolution_note: "Save resolution note",
    field_escalation_note: "Save escalation note",
    field_control_path: "Save control path",
    rfi_draft_title: "Save RFI draft title",
    rfi_question: "Save RFI question",
    change_event_title: "Save change event title",
    change_impact_note: "Save change impact note",
    field_control_reason: "Save control reason",
    field_resolution_note: "Save field resolution note",
    closeout_evidence_note: "Save closeout evidence note",
    closeout_evidence_reference: "Save closeout evidence reference",
    closeout_acceptance_note: "Save acceptance note"
  };

  return customLabels[field.fieldId] ?? `Save ${field.label.toLowerCase()}`;
}

function isPastAction(action: CompletionActionDefinition, status: string) {
  const pastStates: Record<string, string[]> = {
    mark_evidence_attached: ["evidence_attached", "ready_for_review", "resolved"],
    send_to_review: ["ready_for_review", "resolved"],
    resolve_workflow_blocker: ["resolved"],
    mark_closeout_evidence_attached: ["evidence_attached", "ready_for_review", "resolved"],
    send_closeout_item_to_review: ["ready_for_review", "resolved"],
    resolve_closeout_blocker: ["resolved"],
    create_rfi_from_field_issue: ["rfi_created", "controlled", "resolved"],
    create_change_event_from_field_issue: ["change_event_created", "controlled", "resolved"],
    mark_field_issue_controlled: ["controlled", "resolved"],
    resolve_field_issue: ["resolved"]
  };

  return pastStates[action.actionType]?.includes(status) ?? false;
}

function getGuidedActions(definition: CompletionWorkflowDefinition): CompletionActionDefinition[] {
  if (definition.id === "field-issue-escalation") {
    const order: WorkflowCompletionActionType[] = [
      "create_rfi_from_field_issue",
      "create_change_event_from_field_issue",
      "mark_field_issue_controlled",
      "resolve_field_issue"
    ];
    return order
      .map((actionType) => definition.actions.find((action) => action.actionType === actionType))
      .filter((action): action is CompletionActionDefinition => Boolean(action));
  }

  const selectors = definition.qaContract.orderedActionSelectors.map((selector) =>
    selector.replace('[data-qa="', "").replace('"]', "")
  );

  return selectors
    .map((selector) => definition.actions.find((action) => action.qaSelector === selector))
    .filter((action): action is CompletionActionDefinition => Boolean(action));
}

function guidedTitle(definition: CompletionWorkflowDefinition) {
  if (definition.id === "billing-backup-cash-recovery") return "Complete billing backup task";
  if (definition.id === "field-issue-escalation") return "Escalate field issue";
  if (definition.id === "closeout-requirement-final-billing-release") return "Complete closeout requirement";
  return definition.title;
}

function guidedInstruction(definition: CompletionWorkflowDefinition) {
  if (definition.id === "billing-backup-cash-recovery") return "Follow these steps to clear the billing blocker. Document the backup, reference the evidence, send the package to commercial review, and clear the Pay App 003 blocker.";
  if (definition.id === "field-issue-escalation") return "Choose the control path for this field issue.";
  if (definition.id === "closeout-requirement-final-billing-release") return "Satisfy this closeout item so acceptance and final billing can move.";
  return "Follow these steps to complete the workflow.";
}

function completeMessage(definition: CompletionWorkflowDefinition) {
  if (definition.id === "billing-backup-cash-recovery") return "Billing backup blocker resolved. Pay App 003 is ready for commercial review.";
  if (definition.id === "field-issue-escalation") return "Field issue resolved. Return to Pilot Mode to continue.";
  if (definition.id === "closeout-requirement-final-billing-release") return "Closeout blocker resolved. Return to Pilot Mode to continue.";
  return "Workflow complete.";
}

function humanState(status: string, definition: CompletionWorkflowDefinition) {
  if (definition.id === "billing-backup-cash-recovery") {
    const billingLabels: Record<string, string> = {
      waiting_on_evidence: "Waiting for backup",
      evidence_attached: "Backup attached",
      ready_for_review: "Ready for review",
      resolved: "Resolved"
    };
    return billingLabels[status] ?? status.replaceAll("_", " ");
  }

  const labels: Record<string, string> = {
    waiting_on_evidence: "Waiting on evidence",
    evidence_attached: "Evidence attached",
    ready_for_review: "Ready for review",
    resolved: "Resolved",
    open: "Open",
    rfi_created: "RFI created",
    change_event_created: "Change event created",
    controlled: "Controlled",
    waived: "Waived",
    reopened: "Reopened"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function defaultNoteFor(actionType: WorkflowCompletionActionType) {
  const notes: Partial<Record<WorkflowCompletionActionType, string>> = {
    mark_evidence_attached: "Backup attached in guided pilot flow.",
    send_to_review: "Backup sent to review in guided pilot flow.",
    resolve_workflow_blocker: "Billing blocker resolved in guided pilot flow.",
    create_rfi_from_field_issue: "RFI draft started from guided pilot flow.",
    create_change_event_from_field_issue: "Change event draft started from guided pilot flow.",
    mark_field_issue_controlled: "Field issue controlled in guided pilot flow.",
    resolve_field_issue: "Field issue resolved in guided pilot flow.",
    mark_closeout_evidence_attached: "Closeout evidence attached in guided pilot flow.",
    send_closeout_item_to_review: "Closeout item sent to review in guided pilot flow.",
    resolve_closeout_blocker: "Closeout blocker resolved in guided pilot flow."
  };

  return notes[actionType];
}
