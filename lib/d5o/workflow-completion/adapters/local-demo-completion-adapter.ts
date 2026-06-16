import type { CompletionWorkflowId } from "../definition-types";
import type { CompletionStateSnapshot } from "../completion-state-model";
import type {
  WorkflowCompletionHistoryEntry,
  WorkflowCompletionItem
} from "../types";
import {
  getCompletionWorkflowDefinition,
  getRegisteredCompletionWorkflowDefinitions
} from "../workflow-completion-registry";

const storageKey = "rybexos.workflow-completion-demo-state.v1";

type LegacyLocalCompletionState = {
  updatesByItemId?: Record<string, WorkflowCompletionItem>;
  historyByItemId?: Record<string, WorkflowCompletionHistoryEntry[]>;
  savedFieldsByItemId?: Record<string, Record<string, string>>;
};

export const localDemoCompletionAdapter = {
  load(): CompletionStateSnapshot | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as CompletionStateSnapshot | LegacyLocalCompletionState;
      return normalizeSnapshot(parsed);
    } catch {
      return null;
    }
  },

  save(snapshot: CompletionStateSnapshot) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  },

  clearPilotWorkflows(workflowIds: CompletionWorkflowId[]) {
    if (typeof window === "undefined") return;
    const current = localDemoCompletionAdapter.load() ?? { workflows: {} };
    for (const workflowId of workflowIds) {
      delete current.workflows[workflowId];
    }
    window.localStorage.setItem(storageKey, JSON.stringify(current));
  }
};

export function normalizeSnapshot(input: CompletionStateSnapshot | LegacyLocalCompletionState): CompletionStateSnapshot {
  if ("workflows" in input && input.workflows) {
    return { workflows: input.workflows };
  }

  const legacy = input as LegacyLocalCompletionState;
  const workflows: CompletionStateSnapshot["workflows"] = {};
  for (const definition of getRegisteredCompletionWorkflowDefinitions()) {
    const itemId = definition.demoSeedData.item.id;
    const item = legacy.updatesByItemId?.[itemId];
    const history = legacy.historyByItemId?.[itemId];
    const savedFields = legacy.savedFieldsByItemId?.[itemId];

    if (item || history || savedFields) {
      workflows[definition.id] = {
        item: item ? { ...getCompletionWorkflowDefinition(definition.id).demoSeedData.item, ...item } : undefined,
        history,
        savedFields,
        result: null
      };
    }
  }

  return { workflows };
}
