export type WorkflowTransactionStoreMode = "local" | "database";

const allowedStoreModes: WorkflowTransactionStoreMode[] = ["local", "database"];

export function getWorkflowTransactionStoreMode(): WorkflowTransactionStoreMode {
  const configuredMode = process.env.RYBEXOS_WORKFLOW_TRANSACTION_STORE;

  if (configuredMode && allowedStoreModes.includes(configuredMode as WorkflowTransactionStoreMode)) {
    return configuredMode as WorkflowTransactionStoreMode;
  }

  if (process.env.RYBEXOS_RUNTIME_MODE === "production") {
    return "database";
  }

  return "local";
}

export function isLocalWorkflowTransactionStore() {
  return getWorkflowTransactionStoreMode() === "local";
}

export function isDatabaseWorkflowTransactionStore() {
  return getWorkflowTransactionStoreMode() === "database";
}
