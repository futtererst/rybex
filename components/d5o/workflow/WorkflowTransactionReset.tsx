"use client";

import { useWorkflowTransactionStore } from "@/lib/d5o/workflow/local-transaction-store";

export function WorkflowTransactionReset() {
  const store = useWorkflowTransactionStore();

  return (
    <div className="workflow-reset-control">
      <div>
        <span className="workflow-label">Local demo transactions</span>
        <p className="muted">{store.completedTransactions.length} transaction{store.completedTransactions.length === 1 ? "" : "s"} recorded in this browser.</p>
      </div>
      <button className="button button-secondary" onClick={store.resetDemoTransactions} type="button">
        Reset Demo Workflow Transactions
      </button>
    </div>
  );
}
