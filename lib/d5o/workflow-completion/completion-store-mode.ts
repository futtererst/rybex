export type WorkflowCompletionStoreMode = "local" | "database";

export function getWorkflowCompletionStoreMode(): WorkflowCompletionStoreMode {
  return process.env.RYBEXOS_WORKFLOW_COMPLETION_STORE === "database" ? "database" : "local";
}

export function isDatabaseWorkflowCompletionStoreEnabled() {
  return getWorkflowCompletionStoreMode() === "database";
}
