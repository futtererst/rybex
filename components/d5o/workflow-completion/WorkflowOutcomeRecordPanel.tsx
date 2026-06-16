"use client";

import type { WorkflowOutcomeRecord } from "@/lib/d5o/workflow-completion/business-outcome-types";

type WorkflowOutcomeRecordPanelProps = {
  record: WorkflowOutcomeRecord;
};

export function WorkflowOutcomeRecordPanel({ record }: WorkflowOutcomeRecordPanelProps) {
  return (
    <section className="panel workflow-outcome-record" data-qa="workflow-outcome-record-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Outcome achieved</p>
          <h3 data-qa="workflow-outcome-business-process">{record.businessProcessName}</h3>
          <p data-qa="workflow-outcome-summary">{record.businessOutcome}</p>
        </div>
        <span className="chip chip-success">Complete</span>
      </div>

      <dl className="completion-facts">
        <div>
          <dt>Business object moved</dt>
          <dd data-qa="workflow-outcome-business-object">{record.businessObjectLabel}</dd>
        </div>
        <div>
          <dt>Business impact</dt>
          <dd data-qa="workflow-outcome-business-impact">{record.businessImpact.summary}</dd>
        </div>
        <div>
          <dt>Remaining blockers</dt>
          <dd data-qa="workflow-outcome-remaining-blockers">{record.remainingBlockers.map((blocker) => blocker.detail).join(" ")}</dd>
        </div>
        <div>
          <dt>Next business step</dt>
          <dd data-qa="workflow-outcome-next-step">{record.nextBusinessStep.label}</dd>
        </div>
      </dl>

      <section className="completion-saved-fields">
        <p className="eyebrow">Inputs captured</p>
        <ul className="plain-list" data-qa="workflow-outcome-inputs">
          {record.inputsCaptured.map((input) => (
            <li key={input.fieldId}>
              <strong>{input.label}</strong>
              <span>{input.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="completion-saved-fields">
        <p className="eyebrow">Evidence / documents referenced</p>
        <ul className="plain-list" data-qa="workflow-outcome-references">
          {[...record.evidenceReferences, ...record.documentReferences].map((reference) => (
            <li key={`${reference.label}-${reference.sourceFieldId ?? reference.value}`}>
              <strong>{reference.label}</strong>
              <span>{reference.value}</span>
            </li>
          ))}
          {record.evidenceReferences.length + record.documentReferences.length === 0 ? (
            <li>
              <strong>Linked output record</strong>
              <span>Reference is carried by the linked output below.</span>
            </li>
          ) : null}
        </ul>
      </section>

      {record.linkedOutputs.length > 0 ? (
        <section className="completion-saved-fields">
          <p className="eyebrow">Linked outputs</p>
          <ul className="plain-list" data-qa="workflow-outcome-linked-outputs">
            {record.linkedOutputs.map((output) => (
              <li key={output.id}>
                <strong>{output.title}</strong>
                <span>{output.summary ?? output.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="completion-action-row">
        <a className="button button-primary" data-qa="workflow-outcome-next-step-cta" href={record.nextBusinessStep.href}>
          {record.nextBusinessStep.ctaLabel}
        </a>
        <span className="muted" data-qa="workflow-outcome-historical-reference">
          {record.historicalReferenceLabel}
        </span>
      </div>
    </section>
  );
}

