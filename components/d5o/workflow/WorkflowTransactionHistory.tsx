import { dateLabel } from "@/lib/d5o/presentation";
import type { WorkflowTransactionResult } from "@/lib/d5o/workflow/transactions";

type WorkflowTransactionHistoryProps = {
  history: WorkflowTransactionResult[];
};

export function WorkflowTransactionHistory({ history }: WorkflowTransactionHistoryProps) {
  if (history.length === 0) {
    return null;
  }

  return (
    <details className="workflow-transaction-history">
      <summary>{history.length} local transaction{history.length === 1 ? "" : "s"}</summary>
      <ul className="plain-list">
        {history.slice(0, 4).map((item) => (
          <li key={item.id}>
            <strong>{item.label}</strong>
            <span>{dateLabel(item.createdAt)} · {item.success ? "completed" : "blocked"}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
