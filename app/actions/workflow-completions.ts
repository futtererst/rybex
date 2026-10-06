"use server";

import { getCurrentRybexUser } from "@/lib/d5o/auth/current-user";
import { isDatabaseMode } from "@/lib/d5o/data/data-source";
import { hasPermission } from "@/lib/d5o/rbac";
import { isProductionRuntime, productionLocalAdapterError } from "@/lib/d5o/security/runtime-mode";
import {
  canUseDatabaseCompletionStore,
  persistWorkflowCompletionAction
} from "@/lib/d5o/workflow-completion/database-completion-store";
import type { CompletionWorkflowId } from "@/lib/d5o/workflow-completion/definition-types";
import type { WorkflowCompletionActionType } from "@/lib/d5o/workflow-completion/types";
import { isDatabaseWorkflowCompletionStoreEnabled } from "@/lib/d5o/workflow-completion/completion-store-mode";
import { getCompletionWorkflowDefinition } from "@/lib/d5o/workflow-completion/workflow-completion-registry";

export type CommitWorkflowCompletionInput = {
  workflowId: CompletionWorkflowId;
  completionItemId: string;
  actionType: WorkflowCompletionActionType;
  reason?: string;
  evidenceId?: string;
  linkedOutputType?: string;
  metadata?: Record<string, unknown>;
};

export type CommitWorkflowCompletionResult = {
  ok: boolean;
  mode: "local" | "database";
  newState?: string;
  resultMessage: string;
  historyEntry?: unknown;
  linkedOutput?: unknown;
  evidenceUpdate?: unknown;
  auditEventId?: string;
  statusHistoryId?: string;
  transactionId?: string;
  workflowInstanceId?: string;
  error?: string;
  useLocalFallback?: boolean;
};

export async function commitWorkflowCompletion(
  request: CommitWorkflowCompletionInput
): Promise<CommitWorkflowCompletionResult> {
  const validationError = validateRequest(request);

  if (validationError) {
    return {
      ok: false,
      mode: "local",
      resultMessage: validationError,
      error: "invalid_request"
    };
  }

  const definition = getCompletionWorkflowDefinition(request.workflowId);
  const action = definition.actions.find((candidate) => candidate.actionType === request.actionType);

  if (!action) {
    return {
      ok: false,
      mode: "local",
      resultMessage: `Completion action is not registered for ${definition.id}.`,
      error: "action_not_registered"
    };
  }

  const currentUser = await getCurrentRybexUser();
  const databaseStoreEnabled = isDatabaseMode() && isDatabaseWorkflowCompletionStoreEnabled();

  if (!currentUser.authenticated || !currentUser.role) {
    return {
      ok: false,
      mode: databaseStoreEnabled ? "database" : "local",
      resultMessage: currentUser.message,
      error: "unauthenticated"
    };
  }

  const allowed = action.requiredPermissions.length === 0 ||
    action.requiredPermissions.some((permission) => hasPermission(currentUser.role!, permission)) ||
    hasPermission(currentUser.role, "manage_admin");

  if (!allowed) {
    return {
      ok: false,
      mode: databaseStoreEnabled ? "database" : "local",
      resultMessage: `Permission required: ${action.requiredPermissions.join(" or ")}.`,
      error: "permission_denied"
    };
  }

  if (isProductionRuntime() && !databaseStoreEnabled) {
    return {
      ok: false,
      mode: "database",
      resultMessage: productionLocalAdapterError("Workflow completions"),
      error: "production_local_adapter_blocked"
    };
  }

  if (!databaseStoreEnabled) {
    return {
      ok: false,
      mode: "local",
      resultMessage: "Local demo completion mode is active.",
      useLocalFallback: true
    };
  }

  if (!canUseDatabaseCompletionStore()) {
    return {
      ok: false,
      mode: "database",
      resultMessage: "Database completion pilot is not configured. Local demo mode remains available.",
      error: "database_completion_not_configured"
    };
  }

  try {
    const result = await persistWorkflowCompletionAction({
      workflowId: request.workflowId,
      completionItemId: request.completionItemId,
      action: {
        actionType: request.actionType,
        note: request.reason
      },
      actor: currentUser,
      metadata: {
        evidenceId: request.evidenceId,
        linkedOutputType: request.linkedOutputType,
        ...(request.metadata ?? {})
      }
    });

    return {
      ok: true,
      mode: "database",
      newState: result.newState,
      resultMessage: result.resultMessage,
      historyEntry: result.historyEntry,
      linkedOutput: result.linkedOutput,
      evidenceUpdate: result.evidenceUpdate,
      auditEventId: result.auditEventId,
      statusHistoryId: result.statusHistoryId,
      transactionId: result.transactionId,
      workflowInstanceId: result.workflowInstanceId
    };
  } catch (error) {
    return {
      ok: false,
      mode: "database",
      resultMessage: error instanceof Error ? error.message : "Database completion pilot write failed.",
      error: "database_completion_write_failed"
    };
  }
}

function validateRequest(request: CommitWorkflowCompletionInput) {
  if (!request.workflowId) return "Workflow completion requires a workflow id.";
  if (!request.completionItemId) return "Workflow completion requires a completion item id.";
  if (!request.actionType) return "Workflow completion requires an action type.";

  try {
    getCompletionWorkflowDefinition(request.workflowId);
  } catch {
    return `Workflow completion is not registered: ${request.workflowId}.`;
  }

  return "";
}
