export type WorkflowCompletionStoreMode = "local" | "database";

export function getWorkflowCompletionStoreMode(): WorkflowCompletionStoreMode {
  if (process.env.RYBEXOS_RUNTIME_MODE === "production") {
    return "database";
  }

  return process.env.RYBEXOS_WORKFLOW_COMPLETION_STORE === "database" ? "database" : "local";
}

export function isDatabaseWorkflowCompletionStoreEnabled() {
  return getWorkflowCompletionStoreMode() === "database";
}
