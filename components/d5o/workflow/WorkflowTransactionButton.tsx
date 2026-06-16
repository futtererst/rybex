"use client";

import type { WorkflowTransactionDefinition } from "@/lib/d5o/workflow/transactions";

type WorkflowTransactionButtonProps = {
  definition: WorkflowTransactionDefinition;
  disabled?: boolean;
  onSelect: (definition: WorkflowTransactionDefinition) => void;
};

export function WorkflowTransactionButton({
  definition,
  disabled = false,
  onSelect
}: WorkflowTransactionButtonProps) {
  return (
    <button
      className="button button-secondary workflow-transaction-button"
      disabled={disabled}
      onClick={() => onSelect(definition)}
      type="button"
    >
      {definition.shortLabel}
    </button>
  );
}
