"use client";

import { useMemo, useState } from "react";
import type { PursuitAuthorizationOutcome } from "@/lib/d5o/opportunities/types";

type PursuitOutcomeSelectionClientProps = {
  outcomes: PursuitAuthorizationOutcome[];
  action: (formData: FormData) => void;
  attention: boolean;
  profitabilityLabel: string;
  profitabilityValue: string;
  recommendation: string;
};

export function PursuitOutcomeSelectionClient({
  outcomes,
  action,
  attention,
  profitabilityLabel,
  profitabilityValue,
  recommendation
}: PursuitOutcomeSelectionClientProps) {
  const [selectedAction, setSelectedAction] = useState("");
  const [reason, setReason] = useState("");
  const selectedOutcome = useMemo(
    () => outcomes.find((outcome) => outcome.mapsToAction === selectedAction) ?? null,
    [outcomes, selectedAction]
  );
  const requiresReason = Boolean(selectedOutcome?.requiresJustification || selectedOutcome?.requiresMitigation);
  const canSubmit = Boolean(selectedOutcome) && (!requiresReason || reason.trim().length > 0);

  return (
    <form action={action} className="pipeline-section pipeline-outcome-selection" data-pursuit-outcome-form>
      <div className="pipeline-section-heading">
        <div>
          <h2>{attention ? "Profitability and mitigation attention" : "Select Pursuit Authorization outcome"}</h2>
          <p>{attention ? "Review Expected Gross Margin % and record the configured mitigation or No-Pursue rationale." : "Select one configured outcome. No outcome is preselected."}</p>
        </div>
      </div>
      {attention ? (
        <div className="pipeline-profitability-attention-summary" data-profitability-attention-summary>
          <div>
            <span className="pipeline-field-label">{profitabilityLabel}</span>
            <strong data-profitability-margin-value>{profitabilityValue}</strong>
          </div>
          <div>
            <span className="pipeline-field-label">Attention status</span>
            <strong>Requires attention</strong>
          </div>
          <div>
            <span className="pipeline-field-label">Recommendation</span>
            <strong>{recommendation}</strong>
          </div>
        </div>
      ) : null}
      <div className="pipeline-outcome-choice-list">
        {outcomes.map((outcome) => (
          <label className="pipeline-outcome-choice" key={outcome.outcomeKey}>
            <input
              name="pursuitAction"
              type="radio"
              value={outcome.mapsToAction}
              required
              checked={selectedAction === outcome.mapsToAction}
              onChange={() => setSelectedAction(outcome.mapsToAction)}
              data-pursuit-outcome-input
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
        Justification or mitigation
        <textarea
          name="pursuitReason"
          rows={3}
          placeholder="Record the business justification required by the selected configured outcome."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button className="button button-primary" type="submit" disabled={!canSubmit}>Record pursuit decision</button>
    </form>
  );
}

function outcomeRequirementCopy(outcome: PursuitAuthorizationOutcome) {
  if (outcome.requiresJustification && outcome.requiresMitigation) return "Justification and mitigation required";
  if (outcome.requiresJustification) return "Justification required";
  if (outcome.requiresMitigation) return "Mitigation required";
  return "No additional justification required";
}
