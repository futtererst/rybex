"use client";

import { useId, useState, type ReactNode } from "react";

export function ProofDecisionPanel({ options }: { options: { id: string; label: string; content: ReactNode }[] }) {
  const id = useId();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const choice = options.find(option => option.id === selected);
  return <div className="d5o-decision-picker" aria-labelledby={id}>
    <div className="d5o-decision-picker-heading">
      <p className="d5o-eyebrow">Your decision</p>
      <h3 id={id}>Choose the outcome you can stand behind</h3>
      <p>Selecting an outcome only shows its consequence. Nothing is recorded until you give a reason and submit.</p>
    </div>
    <div className="d5o-decision-options" role="radiogroup" aria-label="Available decisions">
      {options.map(option => <button key={option.id} type="button" role="radio" aria-checked={selected === option.id} className={`d5o-decision-option${selected === option.id ? " is-selected" : ""}`} onClick={() => setSelected(option.id)}>
        <span className="d5o-decision-option-dot" aria-hidden="true" />
        <span>{option.label}</span>
      </button>)}
    </div>
    {choice ? <div className="d5o-decision-detail">{choice.content}</div> : null}
  </div>;
}
