"use client";

import { useMemo, useState } from "react";
import type { BidSubmissionApprovalReadiness } from "@/lib/d5o/opportunities/types";

type BidApprovalOutcome = BidSubmissionApprovalReadiness["permittedOutcomes"][number];

type BidApprovalOutcomeSelectionClientProps = {
  outcomes: BidApprovalOutcome[];
  action: (formData: FormData) => void;
};

export function BidApprovalOutcomeSelectionClient({ outcomes, action }: BidApprovalOutcomeSelectionClientProps) {
  const [selectedOutcomeKey, setSelectedOutcomeKey] = useState("");
  const [reason, setReason] = useState("");
  const selectedOutcome = useMemo(
    () => outcomes.find((outcome) => outcome.outcomeKey === selectedOutcomeKey) ?? null,
    [outcomes, selectedOutcomeKey]
  );
  const requiresReason = Boolean(selectedOutcome?.requiresJustification || selectedOutcome?.requiresMitigation);
  const canSubmit = Boolean(selectedOutcome) && (!requiresReason || reason.trim().length > 0);

  return (
    <form action={action} className="pipeline-section pipeline-outcome-selection" data-bid-approval-outcome-form>
      <div className="pipeline-section-heading">
        <div>
          <h2>Select submission approval outcome</h2>
          <p>Select one configured outcome. No outcome is preselected.</p>
        </div>
      </div>
      <div className="pipeline-outcome-choice-list">
        {outcomes.map((outcome) => (
          <label className="pipeline-outcome-choice" key={outcome.outcomeKey}>
            <input
              name="bidApprovalOutcomeKey"
              type="radio"
              value={outcome.outcomeKey}
              required
              checked={selectedOutcomeKey === outcome.outcomeKey}
              onChange={() => setSelectedOutcomeKey(outcome.outcomeKey)}
              data-bid-approval-outcome-input
            />
            <span className="pipeline-outcome-choice-copy">
              <strong className="pipeline-outcome-choice-title">{outcome.label}</strong>
              <em className="pipeline-outcome-choice-requirement">{outcomeRequirementCopy(outcome)}</em>
              {outcome.requiresMitigation ? <small>Mitigation or escalation is required before this outcome is recorded.</small> : null}
            </span>
          </label>
        ))}
      </div>
      <label className="pipeline-wide-field">
        Rationale
        <textarea
          name="bidApprovalReason"
          rows={3}
          placeholder="Record the business rationale required by the selected configured outcome."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button className="button button-primary" type="submit" disabled={!canSubmit}>Record submission approval decision</button>
    </form>
  );
}

function outcomeRequirementCopy(outcome: BidApprovalOutcome) {
  if (outcome.requiresJustification && outcome.requiresMitigation) return "Rationale and mitigation required";
  if (outcome.requiresJustification) return "Rationale required";
  if (outcome.requiresMitigation) return "Mitigation required";
  return "No additional rationale required";
}
