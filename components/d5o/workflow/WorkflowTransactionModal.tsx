"use client";

import { useMemo, useState } from "react";
import type { OperatingWorkflow } from "@/lib/d5o/workflow";
import type { WorkflowTransactionDefinition } from "@/lib/d5o/workflow/transactions";

type WorkflowTransactionModalProps = {
  workflow: OperatingWorkflow;
  definition: WorkflowTransactionDefinition;
  onCancel: () => void;
  onConfirm: (input: {
    notes: string;
    decisionReason: string;
    owner: string;
    evidenceConfirmed: string[];
  }) => void | Promise<void>;
  errorMessage?: string;
  isSubmitting?: boolean;
  modeLabel?: string;
  roleLabel?: string;
};

export function WorkflowTransactionModal({
  workflow,
  definition,
  onCancel,
  onConfirm,
  errorMessage,
  isSubmitting = false,
  modeLabel = "Local demo transaction",
  roleLabel = "Demo role"
}: WorkflowTransactionModalProps) {
  const evidenceDefaults = useMemo(
    () => definition.requiredEvidence.length > 0 ? definition.requiredEvidence : workflow.evidenceNeeded.required,
    [definition.requiredEvidence, workflow.evidenceNeeded.required]
  );
  const [notes, setNotes] = useState(defaultNote(definition, workflow));
  const [decisionReason, setDecisionReason] = useState(workflow.requiredDecision.question);
  const [owner, setOwner] = useState(workflow.owner);
  const [evidenceConfirmed, setEvidenceConfirmed] = useState<string[]>(evidenceDefaults);

  function toggleEvidence(item: string) {
    setEvidenceConfirmed((current) =>
      current.includes(item)
        ? current.filter((candidate) => candidate !== item)
        : [...current, item]
    );
  }

  return (
    <div className="workflow-modal-backdrop" role="presentation">
      <section aria-modal="true" className="workflow-transaction-modal" role="dialog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Demo Transaction</p>
            <h2>{definition.label}</h2>
          </div>
          <button className="button button-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>

        <p className="muted">{definition.description}</p>
        <p className="transaction-mode-line">{modeLabel} - Current role: {roleLabel}</p>

        <div className="workflow-card-grid">
          <div>
            <span className="workflow-label">Signal</span>
            <strong>{workflow.signal.title}</strong>
            <p>{workflow.signal.detail}</p>
          </div>
          <div>
            <span className="workflow-label">Gate/status movement</span>
            <strong>{definition.resultingGateMovement}</strong>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field-wide">
            <span>Decision reason</span>
            <textarea
              onChange={(event) => setDecisionReason(event.target.value)}
              rows={3}
              value={decisionReason}
            />
          </label>
          <label>
            <span>Owner / actor</span>
            <input onChange={(event) => setOwner(event.target.value)} value={owner} />
          </label>
          <label className="form-field-wide">
            <span>Transaction notes</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              value={notes}
            />
          </label>
        </div>

        <div className="workflow-evidence-checklist">
          <span className="workflow-label">Evidence checklist</span>
          {evidenceDefaults.map((item) => (
            <label key={item}>
              <input
                checked={evidenceConfirmed.includes(item)}
                onChange={() => toggleEvidence(item)}
                type="checkbox"
              />
              <span>{item}</span>
            </label>
          ))}
          {evidenceDefaults.length === 0 ? <p className="muted">No evidence checklist is configured for this transaction.</p> : null}
        </div>

        <p className="muted">
          Evidence can remain pending in this MVP. Production file storage is not enabled; use notes to record what was reviewed or what still needs follow-up.
        </p>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <div className="button-row">
          <button
            className="button button-primary"
            disabled={isSubmitting}
            onClick={() => onConfirm({ notes, decisionReason, owner, evidenceConfirmed })}
            type="button"
          >
            {isSubmitting ? "Working..." : `Confirm ${definition.shortLabel}`}
          </button>
          <button className="button button-secondary" disabled={isSubmitting} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

function defaultNote(definition: WorkflowTransactionDefinition, workflow: OperatingWorkflow) {
  return `${definition.label} for ${workflow.entityName}. Evidence reviewed in local demo transaction.`;
}
