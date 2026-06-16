import type { CompletionStateSnapshot } from "./completion-state-model";
import type { WorkflowCompletionHistoryEntry, WorkflowCompletionItem } from "./types";
import { normalizeSnapshot } from "./adapters/local-demo-completion-adapter";
import {
  getCompletionDemoItems,
  getCompletionWorkflowDefinition,
  getRegisteredCompletionWorkflowDefinitions
} from "./workflow-completion-registry";

export type LocalCompletionState = {
  updatesByItemId: Record<string, WorkflowCompletionItem>;
  historyByItemId: Record<string, WorkflowCompletionHistoryEntry[]>;
  notesByItemId?: Record<string, string>;
  savedFieldsByItemId?: Record<string, Record<string, string>>;
};

const storageKey = "rybexos.workflow-completion-demo-state.v1";

export function readLocalCompletionState(): LocalCompletionState {
  if (typeof window === "undefined") return emptyLocalState();

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return emptyLocalState();
    return snapshotToLegacyState(normalizeSnapshot(JSON.parse(stored) as CompletionStateSnapshot | LocalCompletionState));
  } catch {
    return emptyLocalState();
  }
}

export function applyCompletionOverlayFromState(
  item: WorkflowCompletionItem,
  state: LocalCompletionState
): WorkflowCompletionItem {
  return { ...item, ...(state.updatesByItemId[item.id] ?? {}) };
}

export function getInitialLocalCompletionItems() {
  return getCompletionDemoItems();
}

export function snapshotToLegacyState(snapshot: CompletionStateSnapshot): LocalCompletionState {
  const state = emptyLocalState();

  for (const definition of getRegisteredCompletionWorkflowDefinitions()) {
    const workflow = snapshot.workflows[definition.id];
    if (!workflow) continue;
    const itemId = getCompletionWorkflowDefinition(definition.id).demoSeedData.item.id;

    if (workflow.item) state.updatesByItemId[itemId] = workflow.item;
    if (workflow.history) state.historyByItemId[itemId] = workflow.history;
    if (workflow.savedFields) state.savedFieldsByItemId![itemId] = workflow.savedFields;
  }

  return state;
}

function emptyLocalState(): LocalCompletionState {
  return {
    updatesByItemId: {},
    historyByItemId: {},
    notesByItemId: {},
    savedFieldsByItemId: {}
  };
}
