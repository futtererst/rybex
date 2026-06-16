import type { CompletionWorkflowId } from "./definition-types";
import {
  getCompletionWorkflowDefinition,
  getRegisteredCompletionWorkflowDefinitions
} from "./workflow-completion-registry";

export function getCompletionQaContract(workflowId: CompletionWorkflowId) {
  return getCompletionWorkflowDefinition(workflowId).qaContract;
}

export function getAllCompletionQaContracts() {
  return getRegisteredCompletionWorkflowDefinitions().map((definition) => definition.qaContract);
}
