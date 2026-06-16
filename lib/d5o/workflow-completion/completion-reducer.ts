import { applyWorkflowCompletionAction } from "./completion-service";
import { generateWorkflowOutcomeRecord } from "./business-outcomes";
import type { CompletionWorkflowId } from "./definition-types";
import type {
  CompletionReducerAction,
  CompletionStateSnapshot,
  WorkflowCompletionState
} from "./completion-state-model";
import type { WorkflowCompletionHistoryEntry } from "./types";
import {
  getCompletionWorkflowDefinition,
  getRegisteredCompletionWorkflowDefinitions
} from "./workflow-completion-registry";

export function createInitialWorkflowCompletionState(mode: "local" | "database" = "local"): WorkflowCompletionState {
  const workflows = {} as WorkflowCompletionState["workflows"];
  for (const definition of getRegisteredCompletionWorkflowDefinitions()) {
    workflows[definition.id] = {
      item: definition.demoSeedData.item,
      savedFields: {},
      history: [],
      result: null,
      outcomeRecord: null
    };
  }

  return {
    mode,
    isHydrated: false,
    workflows
  };
}

export function workflowCompletionReducer(
  state: WorkflowCompletionState,
  action: CompletionReducerAction
): WorkflowCompletionState {
  switch (action.type) {
    case "HYDRATE_COMPLETION_STATE":
      return hydrateState(state, action.snapshot);

    case "SAVE_COMPLETION_FIELD": {
      const current = state.workflows[action.workflowId];
      if (!current) return state;
      const trimmed = action.value.trim();
      if (!trimmed) return state;

      const entry: WorkflowCompletionHistoryEntry = {
        id: stableHistoryId(action.workflowId, action.fieldId, current.history.length + 1),
        itemId: current.item.id,
        actionType: action.actionType,
        label: `Save ${action.label.toLowerCase()}`,
        actor: action.actor,
        actorRole: action.actorRole,
        note: `${action.summaryLabel}: ${trimmed}`,
        createdAt: deterministicDemoTimestamp(current.history.length + 1)
      };

      return updateWorkflow(state, action.workflowId, {
        savedFields: {
          ...current.savedFields,
          [action.fieldId]: trimmed
        },
        history: [entry, ...current.history],
        result: null
      });
    }

    case "APPLY_COMPLETION_ACTION": {
      const current = state.workflows[action.workflowId];
      if (!current) return state;
      const result = applyWorkflowCompletionAction(current.item, {
        actionType: action.actionType,
        actor: action.actor,
        actorRole: action.actorRole,
        note: action.note,
        savedFields: current.savedFields
      });

      const historyEntry = result.historyEntry
        ? {
            ...result.historyEntry,
            id: stableHistoryId(action.workflowId, action.actionType, current.history.length + 1),
            createdAt: deterministicDemoTimestamp(current.history.length + 1)
          }
        : undefined;
      const nextHistory = result.success && historyEntry ? [historyEntry, ...current.history] : current.history;
      const definition = getCompletionWorkflowDefinition(action.workflowId);
      const outcomeRecord =
        result.success && definition.terminalStates.includes(result.item.status)
          ? generateWorkflowOutcomeRecord({
              actor: action.actor,
              completedAt: historyEntry?.createdAt ?? deterministicDemoTimestamp(current.history.length + 1),
              definition,
              history: nextHistory,
              item: result.item,
              previousItem: current.item,
              savedFields: current.savedFields,
              mode: state.mode
            })
          : result.success
            ? null
            : current.outcomeRecord;

      return updateWorkflow(state, action.workflowId, {
        item: result.success ? result.item : current.item,
        history: nextHistory,
        result,
        outcomeRecord
      });
    }

    case "RESET_COMPLETION_WORKFLOW":
      return updateWorkflow(state, action.workflowId, seedWorkflowState(action.workflowId));

    case "RESET_PILOT_WORKFLOWS": {
      return {
        ...state,
        workflows: action.workflowIds.reduce((next, workflowId) => {
          next[workflowId] = seedWorkflowState(workflowId);
          return next;
        }, { ...state.workflows })
      };
    }

    case "SET_COMPLETION_RESULT":
      return updateWorkflow(state, action.workflowId, { result: action.result });

    case "CLEAR_COMPLETION_RESULT":
      return updateWorkflow(state, action.workflowId, { result: null });

    default:
      return state;
  }
}

export function serializeWorkflowCompletionState(state: WorkflowCompletionState): CompletionStateSnapshot {
  return {
    workflows: Object.fromEntries(
      Object.entries(state.workflows).map(([workflowId, workflow]) => [
        workflowId,
        {
          item: workflow.item,
          savedFields: workflow.savedFields,
          history: workflow.history,
          result: workflow.result,
          outcomeRecord: workflow.outcomeRecord
        }
      ])
    )
  };
}

function hydrateState(state: WorkflowCompletionState, snapshot: CompletionStateSnapshot | null): WorkflowCompletionState {
  if (!snapshot) return { ...state, isHydrated: true };

  const workflows = { ...state.workflows };
  for (const definition of getRegisteredCompletionWorkflowDefinitions()) {
    const overlay = snapshot.workflows[definition.id];
    if (!overlay) continue;
    const current = workflows[definition.id];
    workflows[definition.id] = {
      item: overlay.item ? { ...definition.demoSeedData.item, ...overlay.item } : current.item,
      savedFields: overlay.savedFields ?? current.savedFields,
      history: overlay.history ?? current.history,
      result: overlay.result ?? current.result,
      outcomeRecord: overlay.outcomeRecord ?? current.outcomeRecord
    };
  }

  return {
    ...state,
    workflows,
    isHydrated: true
  };
}

function updateWorkflow(
  state: WorkflowCompletionState,
  workflowId: CompletionWorkflowId,
  partial: Partial<WorkflowCompletionState["workflows"][CompletionWorkflowId]>
): WorkflowCompletionState {
  const current = state.workflows[workflowId];
  if (!current) return state;

  return {
    ...state,
    workflows: {
      ...state.workflows,
      [workflowId]: {
        ...current,
        ...partial
      }
    }
  };
}

function seedWorkflowState(workflowId: CompletionWorkflowId) {
  const definition = getCompletionWorkflowDefinition(workflowId);
  return {
    item: definition.demoSeedData.item,
    savedFields: {},
    history: [],
    result: null,
    outcomeRecord: null
  };
}

function stableHistoryId(workflowId: CompletionWorkflowId, key: string, sequence: number) {
  return `${workflowId}-${key}-${sequence}`;
}

function deterministicDemoTimestamp(sequence: number) {
  const minute = String(sequence % 60).padStart(2, "0");
  return `2026-06-15T12:${minute}:00.000Z`;
}
