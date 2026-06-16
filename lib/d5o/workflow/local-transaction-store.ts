"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OperatingWorkflow } from "./types";
import type { WorkflowTransactionResult, WorkflowTransactionState } from "./transactions";

const storageKey = "rybexos.workflow-transactions.v1";

const emptyState: WorkflowTransactionState = {
  transactions: [],
  updatedWorkflowsById: {}
};

export function useWorkflowTransactionStore() {
  const [state, setState] = useState<WorkflowTransactionState>(() => readStoredState());

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const applyTransaction = useCallback((result: WorkflowTransactionResult) => {
    setState((current) => ({
      transactions: [result, ...current.transactions],
      updatedWorkflowsById: {
        ...current.updatedWorkflowsById,
        [result.workflowId]: result.updatedWorkflow
      }
    }));
  }, []);

  const markWorkflowActionResolved = useCallback((workflow: OperatingWorkflow, result: WorkflowTransactionResult) => {
    setState((current) => ({
      transactions: [result, ...current.transactions],
      updatedWorkflowsById: {
        ...current.updatedWorkflowsById,
        [workflow.id]: result.updatedWorkflow
      }
    }));
  }, []);

  const resetDemoTransactions = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setState(emptyState);
  }, []);

  const getTransactionHistoryForWorkflow = useCallback(
    (workflowId: string) => state.transactions.filter((transaction) => transaction.workflowId === workflowId),
    [state.transactions]
  );

  return useMemo(
    () => ({
      state,
      completedTransactions: state.transactions,
      applyTransaction,
      markWorkflowActionResolved,
      getTransactionHistoryForWorkflow,
      resetDemoTransactions,
      applyLocalState: (workflows: OperatingWorkflow[]) => applyLocalTransactionsToWorkflows(workflows, state)
    }),
    [
      applyTransaction,
      getTransactionHistoryForWorkflow,
      markWorkflowActionResolved,
      resetDemoTransactions,
      state
    ]
  );
}

export function applyLocalTransactionsToWorkflows(
  workflows: OperatingWorkflow[],
  state: WorkflowTransactionState
) {
  return workflows.map((workflow) => state.updatedWorkflowsById[workflow.id] ?? workflow);
}

function readStoredState(): WorkflowTransactionState {
  if (typeof window === "undefined") {
    return emptyState;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return emptyState;
    }

    const parsed = JSON.parse(stored) as WorkflowTransactionState;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      updatedWorkflowsById: parsed.updatedWorkflowsById && typeof parsed.updatedWorkflowsById === "object"
        ? parsed.updatedWorkflowsById
        : {}
    };
  } catch {
    return emptyState;
  }
}
