import type { CompletionWorkflowId } from "./definition-types";
import type { WorkflowOutcomeRecord } from "./business-outcome-types";
import type {
  WorkflowCompletionActionType,
  WorkflowCompletionHistoryEntry,
  WorkflowCompletionItem,
  WorkflowCompletionResult
} from "./types";

export type SavedFieldState = Record<string, string>;

export type WorkflowCompletionItemState = {
  item: WorkflowCompletionItem;
  savedFields: SavedFieldState;
  history: WorkflowCompletionHistoryEntry[];
  result: WorkflowCompletionResult | null;
  outcomeRecord: WorkflowOutcomeRecord | null;
};

export type WorkflowCompletionState = {
  mode: "local" | "database";
  isHydrated: boolean;
  workflows: Record<CompletionWorkflowId, WorkflowCompletionItemState>;
};

export type CompletionStateSnapshot = {
  workflows: Record<string, {
    item?: WorkflowCompletionItem;
    savedFields?: SavedFieldState;
    history?: WorkflowCompletionHistoryEntry[];
    result?: WorkflowCompletionResult | null;
    outcomeRecord?: WorkflowOutcomeRecord | null;
  }>;
};

export type CompletionActionResult = WorkflowCompletionResult;

export type CompletionStateAdapter = {
  load: () => CompletionStateSnapshot | null;
  save: (snapshot: CompletionStateSnapshot) => void;
  clearPilotWorkflows: (workflowIds: CompletionWorkflowId[]) => void;
};

export type CompletionReducerAction =
  | {
      type: "HYDRATE_COMPLETION_STATE";
      snapshot: CompletionStateSnapshot | null;
    }
  | {
      type: "SAVE_COMPLETION_FIELD";
      workflowId: CompletionWorkflowId;
      fieldId: string;
      actionType: WorkflowCompletionActionType;
      label: string;
      summaryLabel: string;
      value: string;
      actor: string;
      actorRole: string;
    }
  | {
      type: "APPLY_COMPLETION_ACTION";
      workflowId: CompletionWorkflowId;
      actionType: WorkflowCompletionActionType;
      note?: string;
      actor: string;
      actorRole: string;
    }
  | {
      type: "RESET_COMPLETION_WORKFLOW";
      workflowId: CompletionWorkflowId;
    }
  | {
      type: "RESET_PILOT_WORKFLOWS";
      workflowIds: CompletionWorkflowId[];
    }
  | {
      type: "SET_COMPLETION_RESULT";
      workflowId: CompletionWorkflowId;
      result: WorkflowCompletionResult | null;
    }
  | {
      type: "CLEAR_COMPLETION_RESULT";
      workflowId: CompletionWorkflowId;
    };
