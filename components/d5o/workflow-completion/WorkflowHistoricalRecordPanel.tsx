"use client";

import type { WorkflowOutcomeRecord } from "@/lib/d5o/workflow-completion/business-outcome-types";
import type { WorkflowCompletionHistoryEntry } from "@/lib/d5o/workflow-completion/types";

type WorkflowHistoricalRecordPanelProps = {
  history: WorkflowCompletionHistoryEntry[];
  record: WorkflowOutcomeRecord;
  workflowName: string;
};

export function WorkflowHistoricalRecordPanel({
  history,
  record,
  workflowName
}: WorkflowHistoricalRecordPanelProps) {
  return (
    <section className="panel workflow-historical-record" data-qa="workflow-historical-record-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Historical record</p>
          <h3>{record.historicalReferenceLabel}</h3>
          <p data-qa="workflow-historical-record-summary">{record.historicalReference.summary}</p>
        </div>
        <span className="chip chip-info">{record.localDemoOnly ? "local/demo" : "database pilot"}</span>
      </div>

      <dl className="completion-facts">
        <div>
          <dt>Workflow</dt>
          <dd>{workflowName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{record.stateChanges.at(-1)?.to.replaceAll("_", " ") ?? "complete"}</dd>
        </div>
        <div>
          <dt>Business object</dt>
          <dd>{record.businessObjectLabel}</dd>
        </div>
        <div>
          <dt>Next business step</dt>
          <dd>{record.nextBusinessStep.label}</dd>
        </div>
        <div>
          <dt>Completed by</dt>
          <dd>{record.completedBy}</dd>
        </div>
        <div>
          <dt>Completed at</dt>
          <dd>{record.completedAt}</dd>
        </div>
      </dl>

      <section className="completion-saved-fields">
        <p className="eyebrow">Record contents</p>
        <h3>Inputs and evidence</h3>
        <ul className="plain-list" data-qa="workflow-historical-record-contents">
          {record.inputsCaptured.map((input) => (
            <li key={input.fieldId}>
              <strong>{input.label}</strong>
              <span>{input.value}</span>
            </li>
          ))}
          {[...record.evidenceReferences, ...record.documentReferences].map((reference) => (
            <li key={`${reference.label}-${reference.sourceFieldId ?? reference.value}`}>
              <strong>{reference.label}</strong>
              <span>{reference.value}</span>
            </li>
          ))}
          <li>
            <strong>Remaining blockers</strong>
            <span>{record.remainingBlockers.map((blocker) => blocker.detail).join(" ")}</span>
          </li>
        </ul>
      </section>

      <section className="completion-history">
        <div className="completion-section-heading">
          <div>
            <p className="eyebrow">Trace</p>
            <h3>What was captured</h3>
          </div>
          <span>{history.length} event(s)</span>
        </div>
        <ol data-qa="workflow-historical-record-history">
          {history.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label}</strong>
              <span>{entry.actor} · {entry.createdAt}</span>
              <p>{entry.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="completion-mode-note">
        {record.localDemoOnly
          ? "This record is saved in local/demo completion history only."
          : "This record is available through database pilot metadata."}
      </p>
    </section>
  );
}
