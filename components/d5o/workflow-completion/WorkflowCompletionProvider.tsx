"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from "react";
import {
  getPilotProgress as derivePilotProgress,
  getPilotWorkflows,
  type PilotWorkflowStatus
} from "@/lib/d5o/pilot/pilot-slice";
import { getWorkflowCompletionStoreMode } from "@/lib/d5o/workflow-completion/completion-store-mode";
import {
  createInitialWorkflowCompletionState,
  serializeWorkflowCompletionState,
  workflowCompletionReducer
} from "@/lib/d5o/workflow-completion/completion-reducer";
import type {
  SavedFieldState,
  WorkflowCompletionState
} from "@/lib/d5o/workflow-completion/completion-state-model";
import type { WorkflowOutcomeRecord } from "@/lib/d5o/workflow-completion/business-outcome-types";
import type { CompletionWorkflowId } from "@/lib/d5o/workflow-completion/definition-types";
import {
  getRequiredFieldsForAction,
  type CompletionEditableField
} from "@/lib/d5o/workflow-completion/editable-field-contracts";
import { localDemoCompletionAdapter } from "@/lib/d5o/workflow-completion/adapters/local-demo-completion-adapter";
import type {
  WorkflowCompletionActionType,
  WorkflowCompletionItem
} from "@/lib/d5o/workflow-completion/types";
import {
  getCompletionWorkflowDefinition,
  getRegisteredCompletionWorkflowDefinitions
} from "@/lib/d5o/workflow-completion/workflow-completion-registry";

type AvailableAction = {
  actionType: WorkflowCompletionActionType;
  enabled: boolean;
  disabledReason: string | null;
};

type WorkflowCompletionContextValue = {
  getCompletionItem: (workflowId: CompletionWorkflowId) => WorkflowCompletionItem;
  getSavedFields: (workflowId: CompletionWorkflowId) => SavedFieldState;
  getHistory: (workflowId: CompletionWorkflowId) => WorkflowCompletionState["workflows"][CompletionWorkflowId]["history"];
  getResult: (workflowId: CompletionWorkflowId) => WorkflowCompletionState["workflows"][CompletionWorkflowId]["result"];
  getOutcomeRecord: (workflowId: CompletionWorkflowId) => WorkflowOutcomeRecord | null;
  getAvailableActions: (workflowId: CompletionWorkflowId) => AvailableAction[];
  getPilotProgress: () => ReturnType<typeof derivePilotProgress>;
  getPilotWorkflowStatus: (workflowId: CompletionWorkflowId) => PilotWorkflowStatus;
  saveField: (workflowId: CompletionWorkflowId, field: CompletionEditableField, value: string) => void;
  applyAction: (workflowId: CompletionWorkflowId, actionType: WorkflowCompletionActionType, payload?: { note?: string }) => void;
  resetWorkflow: (workflowId: CompletionWorkflowId) => void;
  resetPilotWorkflows: () => void;
  hydrateFromAdapter: () => void;
  isHydrated: boolean;
  mode: "local" | "database";
};

const WorkflowCompletionContext = createContext<WorkflowCompletionContextValue | null>(null);

const pilotWorkflowIds = getPilotWorkflows().map((workflow) => workflow.workflowId as CompletionWorkflowId);

export function WorkflowCompletionProvider({ children }: { children: ReactNode }) {
  const mode = getWorkflowCompletionStoreMode();
  const [state, dispatch] = useReducer(
    workflowCompletionReducer,
    mode === "database" ? "database" : "local",
    createInitialWorkflowCompletionState
  );

  const hydrateFromAdapter = useCallback(() => {
    dispatch({
      type: "HYDRATE_COMPLETION_STATE",
      snapshot: localDemoCompletionAdapter.load()
    });
  }, []);

  useEffect(() => {
    hydrateFromAdapter();
  }, [hydrateFromAdapter]);

  useEffect(() => {
    if (!state.isHydrated || state.mode !== "local") return;
    localDemoCompletionAdapter.save(serializeWorkflowCompletionState(state));
  }, [state]);

  const value = useMemo<WorkflowCompletionContextValue>(() => {
    const demoItems = () =>
      getRegisteredCompletionWorkflowDefinitions().map((definition) => state.workflows[definition.id].item);

    return {
      getCompletionItem(workflowId) {
        return state.workflows[workflowId]?.item ?? getCompletionWorkflowDefinition(workflowId).demoSeedData.item;
      },
      getSavedFields(workflowId) {
        return state.workflows[workflowId]?.savedFields ?? {};
      },
      getHistory(workflowId) {
        return state.workflows[workflowId]?.history ?? [];
      },
      getResult(workflowId) {
        return state.workflows[workflowId]?.result ?? null;
      },
      getOutcomeRecord(workflowId) {
        return state.workflows[workflowId]?.outcomeRecord ?? null;
      },
      getAvailableActions(workflowId) {
        const item = state.workflows[workflowId]?.item ?? getCompletionWorkflowDefinition(workflowId).demoSeedData.item;
        const savedFields = state.workflows[workflowId]?.savedFields ?? {};
        return getCompletionWorkflowDefinition(workflowId).actions.map((action) => {
          const missing = missingFieldsForAction(workflowId, action.actionType, savedFields);
          const enabled = action.fromStates.includes(item.status) && missing.length === 0;
          return {
            actionType: action.actionType,
            enabled,
            disabledReason: enabled ? null : missing[0]?.validationMessage ?? action.blockedMessage
          };
        });
      },
      getPilotProgress() {
        return derivePilotProgress(demoItems());
      },
      getPilotWorkflowStatus(workflowId) {
        return derivePilotProgress(demoItems()).workflows.find((workflow) => workflow.workflowId === workflowId)?.status ?? "not_started";
      },
      saveField(workflowId, field, value) {
        dispatch({
          type: "SAVE_COMPLETION_FIELD",
          workflowId,
          fieldId: field.fieldId,
          actionType: field.saveActionType,
          label: field.label,
          summaryLabel: field.summaryLabel,
          value,
          actor: demoActorFor(workflowId),
          actorRole: getCompletionWorkflowDefinition(workflowId).primaryUserRole
        });
      },
      applyAction(workflowId, actionType, payload) {
        dispatch({
          type: "APPLY_COMPLETION_ACTION",
          workflowId,
          actionType,
          note: payload?.note,
          actor: demoActorFor(workflowId),
          actorRole: getCompletionWorkflowDefinition(workflowId).primaryUserRole
        });
      },
      resetWorkflow(workflowId) {
        dispatch({ type: "RESET_COMPLETION_WORKFLOW", workflowId });
      },
      resetPilotWorkflows() {
        localDemoCompletionAdapter.clearPilotWorkflows(pilotWorkflowIds);
        dispatch({ type: "RESET_PILOT_WORKFLOWS", workflowIds: pilotWorkflowIds });
      },
      hydrateFromAdapter,
      isHydrated: state.isHydrated,
      mode: state.mode
    };
  }, [hydrateFromAdapter, state]);

  return (
    <WorkflowCompletionContext.Provider value={value}>
      {children}
    </WorkflowCompletionContext.Provider>
  );
}

export function useWorkflowCompletion() {
  const context = useContext(WorkflowCompletionContext);
  if (!context) {
    throw new Error("useWorkflowCompletion must be used within WorkflowCompletionProvider.");
  }
  return context;
}

function missingFieldsForAction(
  workflowId: CompletionWorkflowId,
  actionType: WorkflowCompletionActionType,
  savedFields: Record<string, string>
) {
  const required = getRequiredFieldsForAction(workflowId, actionType).filter((field) => {
    if (field.requiresFieldValue && savedFields[field.requiresFieldValue.fieldId] !== field.requiresFieldValue.value) {
      return false;
    }

    return !savedFields[field.fieldId]?.trim();
  });

  if (workflowId === "field-issue-escalation") {
    const path = savedFields.field_control_path;
    const pathField = getRequiredFieldsForAction(workflowId, actionType).find((field) => field.fieldId === "field_control_path");
    if (pathField && actionType === "create_rfi_from_field_issue" && path && path !== "RFI") {
      return [{ ...pathField, validationMessage: "Save Recommended control path as RFI before creating an RFI." }, ...required];
    }
    if (pathField && actionType === "create_change_event_from_field_issue" && path && path !== "Change event") {
      return [{ ...pathField, validationMessage: "Save Recommended control path as Change event before creating a change event." }, ...required];
    }
  }

  return required;
}

function demoActorFor(workflowId: CompletionWorkflowId) {
  const definition = getCompletionWorkflowDefinition(workflowId);
  if (definition.primaryUserRole.includes("Field")) return "Demo field supervisor";
  if (definition.primaryUserRole.includes("Closeout") || definition.sourceModule === "closeout") return "Demo closeout owner";
  return "Demo finance user";
}
