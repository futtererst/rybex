import { getDatabaseSafeActorUserId, type CurrentRybexUser } from "../auth/current-user";
import { insertSupabaseRow, readSupabaseTable, updateSupabaseRows } from "../data/database-client";
import { isDatabaseMode } from "../data/data-source";
import { defaultWorkflowPersistenceContext } from "../workflow/persistence-adapter";
import { applyWorkflowCompletionAction } from "./completion-service";
import type { CompletionActionDefinition, CompletionWorkflowDefinition, CompletionWorkflowId } from "./definition-types";
import type {
  WorkflowCompletionActionInput,
  WorkflowCompletionItem,
  WorkflowCompletionLinkedOutput,
  WorkflowCompletionResult,
  WorkflowCompletionStatus
} from "./types";
import { isDatabaseWorkflowCompletionStoreEnabled } from "./completion-store-mode";
import { getCompletionWorkflowDefinition } from "./workflow-completion-registry";

type WorkflowInstanceRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  current_status: WorkflowCompletionStatus;
  resolution_state: string;
  severity: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type WorkflowTransactionRow = {
  id: string;
  created_at: string;
};

type WorkflowEvidenceRequirementRow = {
  id: string;
  title: string;
  status: string;
};

type AuditEventRow = {
  id: string;
};

type StatusHistoryRow = {
  id: string;
};

export type PersistWorkflowCompletionInput = {
  workflowId: CompletionWorkflowId;
  completionItemId: string;
  action: WorkflowCompletionActionInput;
  actor: CurrentRybexUser;
  metadata?: Record<string, unknown>;
};

export type PersistWorkflowCompletionOutput = {
  ok: boolean;
  mode: "database";
  workflowInstanceId: string;
  transactionId: string;
  newState: WorkflowCompletionStatus;
  resultMessage: string;
  historyEntry: WorkflowCompletionResult["historyEntry"];
  linkedOutput?: WorkflowCompletionLinkedOutput;
  evidenceUpdate?: {
    status: string;
    requirementIds: string[];
    metadataOnly: boolean;
  };
  auditEventId?: string;
  statusHistoryId?: string;
  item: WorkflowCompletionItem;
};

export function canUseDatabaseCompletionStore() {
  return isDatabaseMode() && isDatabaseWorkflowCompletionStoreEnabled();
}

export async function loadDatabaseBackedCompletionItem(
  workflowId: CompletionWorkflowId,
  completionItemId: string
): Promise<WorkflowCompletionItem> {
  const definition = getCompletionWorkflowDefinition(workflowId);
  const baseItem = {
    ...definition.demoSeedData.item,
    id: completionItemId || definition.demoSeedData.item.id
  };
  const existing = await findWorkflowInstance(definition);

  if (!existing) return baseItem;

  const metadata = existing.metadata ?? {};
  const linkedOutputRecords = Array.isArray(metadata.linkedOutputRecords)
    ? metadata.linkedOutputRecords as WorkflowCompletionLinkedOutput[]
    : baseItem.linkedOutputRecords;

  return {
    ...baseItem,
    status: existing.current_status,
    resolutionState: existing.resolution_state as WorkflowCompletionItem["resolutionState"],
    linkedOutputRecords,
    nextStep: typeof metadata.nextStep === "string" ? metadata.nextStep : baseItem.nextStep,
    updatedAt: existing.updated_at
  };
}

export async function persistWorkflowCompletionAction(
  input: PersistWorkflowCompletionInput
): Promise<PersistWorkflowCompletionOutput> {
  if (!canUseDatabaseCompletionStore()) {
    throw new Error("Database completion pilot is not enabled. Set RYBEXOS_DATA_SOURCE=database and RYBEXOS_WORKFLOW_COMPLETION_STORE=database.");
  }

  const definition = getCompletionWorkflowDefinition(input.workflowId);
  const currentItem = await loadDatabaseBackedCompletionItem(input.workflowId, input.completionItemId);
  const actionDefinition = definition.actions.find((action) => action.actionType === input.action.actionType);

  if (!actionDefinition) {
    throw new Error(`Completion action is not registered for ${definition.id}: ${input.action.actionType}`);
  }

  const result = applyWorkflowCompletionAction(currentItem, {
    ...input.action,
    actor: input.actor.name,
    actorRole: input.actor.role ?? definition.primaryUserRole
  });

  if (!result.success) {
    throw new Error(result.message);
  }

  const timestamp = result.historyEntry?.createdAt ?? new Date().toISOString();
  const workflowInstance = await findOrCreateWorkflowInstance(definition, currentItem, input.actor);
  const previousStatus = workflowInstance.current_status;
  const previousResolution = workflowInstance.resolution_state;
  const linkedOutput = getCreatedLinkedOutput(currentItem, result.item);
  const evidenceUpdate = await updateEvidenceRequirements({
    definition,
    workflowInstanceId: workflowInstance.id,
    action: actionDefinition,
    timestamp
  });

  const transaction = await insertSupabaseRow<WorkflowTransactionRow>("workflow_transactions", {
    organization_id: workflowInstance.organization_id,
    workspace_id: workflowInstance.workspace_id,
    project_id: workflowInstance.project_id,
    workflow_instance_id: workflowInstance.id,
    transaction_type: input.action.actionType,
    transaction_label: actionDefinition.label,
    actor_name: input.actor.name,
    actor_role: input.actor.role ?? definition.primaryUserRole,
    actor_user_id: getDatabaseSafeActorUserId(input.actor),
    decision: input.action.actionType,
    decision_reason: input.action.note ?? null,
    action_taken: actionDefinition.label,
    evidence_summary: definition.requiredEvidence.map((item) => item.label).join("; "),
    resulting_status: result.item.status,
    resulting_resolution_state: result.item.resolutionState,
    resulting_gate_movement: result.item.nextStep,
    success_message: result.message,
    metadata: {
      rybexos_completion_pilot: true,
      completionWorkflowId: definition.id,
      completionItemId: input.completionItemId,
      actionType: input.action.actionType,
      historyEntry: result.historyEntry,
      linkedOutput,
      evidenceUpdate,
      notificationMessage: definition.notificationBehavior.find((rule) => rule.onAction === input.action.actionType)?.message,
      inputMetadata: input.metadata ?? {}
    },
    created_at: timestamp
  });

  await updateSupabaseRows<WorkflowInstanceRow>(
    "workflow_instances",
    { id: `eq.${workflowInstance.id}` },
    {
      current_status: result.item.status,
      resolution_state: result.item.resolutionState,
      severity: result.item.severity,
      next_gate_or_status: result.item.nextStep,
      updated_by: getDatabaseSafeActorUserId(input.actor),
      updated_at: timestamp,
      metadata: {
        ...(workflowInstance.metadata ?? {}),
        rybexos_completion_pilot: true,
        completionWorkflowId: definition.id,
        completionItemId: input.completionItemId,
        lastCompletionTransactionId: transaction.id,
        lastCompletionActionType: input.action.actionType,
        lastCompletionMessage: result.message,
        linkedOutputRecords: result.item.linkedOutputRecords ?? [],
        nextStep: result.item.nextStep
      }
    }
  );

  const auditEvent = await insertSupabaseRow<AuditEventRow>("audit_events", {
    organization_id: workflowInstance.organization_id,
    workspace_id: workflowInstance.workspace_id,
    project_id: workflowInstance.project_id,
    entity_type: "workflow_completion_item",
    entity_id: workflowInstance.id,
    action: input.action.actionType,
    actor_user_id: getDatabaseSafeActorUserId(input.actor),
    actor_name: input.actor.name,
    actor_role: input.actor.role ?? definition.primaryUserRole,
    summary: result.message,
    before_state: {
      status: previousStatus,
      resolutionState: previousResolution
    },
    after_state: {
      status: result.item.status,
      resolutionState: result.item.resolutionState,
      linkedOutput,
      evidenceUpdate
    },
    severity: result.item.severity,
    metadata: {
      rybexos_completion_pilot: true,
      workflowTransactionId: transaction.id,
      completionWorkflowId: definition.id,
      completionItemId: input.completionItemId
    },
    created_at: timestamp
  });

  const statusHistory = previousStatus !== result.item.status || previousResolution !== result.item.resolutionState
    ? await insertSupabaseRow<StatusHistoryRow>("status_history", {
        organization_id: workflowInstance.organization_id,
        workspace_id: workflowInstance.workspace_id,
        project_id: workflowInstance.project_id,
        entity_type: "workflow_completion_item",
        entity_id: workflowInstance.id,
        from_status: `${previousStatus}/${previousResolution}`,
        to_status: `${result.item.status}/${result.item.resolutionState}`,
        changed_by: getDatabaseSafeActorUserId(input.actor),
        changed_at: timestamp,
        reason: result.message,
        related_audit_event_id: auditEvent.id,
        metadata: {
          rybexos_completion_pilot: true,
          workflowTransactionId: transaction.id,
          completionWorkflowId: definition.id,
          completionItemId: input.completionItemId
        }
      })
    : undefined;

  return {
    ok: true,
    mode: "database",
    workflowInstanceId: workflowInstance.id,
    transactionId: transaction.id,
    newState: result.item.status,
    resultMessage: result.message,
    historyEntry: result.historyEntry,
    linkedOutput,
    evidenceUpdate,
    auditEventId: auditEvent.id,
    statusHistoryId: statusHistory?.id,
    item: result.item
  };
}

async function findOrCreateWorkflowInstance(
  definition: CompletionWorkflowDefinition,
  item: WorkflowCompletionItem,
  actor: CurrentRybexUser
) {
  const existing = await findWorkflowInstance(definition);

  if (existing) return existing;

  return insertSupabaseRow<WorkflowInstanceRow>("workflow_instances", {
    organization_id: defaultWorkflowPersistenceContext.organizationId,
    workspace_id: defaultWorkflowPersistenceContext.workspaceId,
    project_id: isUuid(item.projectId) ? item.projectId : null,
    workflow_type: item.workflowType,
    d5o_phase: d5oPhaseFor(item.sourceModule),
    source_module: definition.sourceModule,
    source_record_type: definition.sourceRecordType,
    source_record_id: definition.sourceRecordId,
    entity_name: item.title,
    title: item.title,
    description: definition.businessPurpose,
    current_status: item.status,
    resolution_state: item.resolutionState,
    severity: item.severity,
    owner_name: item.owner,
    owner_role: definition.primaryUserRole,
    due_date: item.dueDate || null,
    business_impact: item.businessImpact,
    consequence_if_missed: item.blocker,
    target_module: item.sourceModule,
    target_href: definition.routeTarget,
    next_gate_or_status: item.nextStep,
    value_at_risk: item.blockedAmount ?? null,
    metadata: {
      rybexos_completion_pilot: true,
      completionWorkflowId: definition.id,
      completionItemId: item.id,
      focusKey: definition.focusKey,
      linkedOutputRecords: item.linkedOutputRecords ?? [],
      nextStep: item.nextStep
    },
    created_by: getDatabaseSafeActorUserId(actor),
    updated_by: getDatabaseSafeActorUserId(actor)
  });
}

async function findWorkflowInstance(definition: CompletionWorkflowDefinition) {
  const [row] = await readSupabaseTable<WorkflowInstanceRow>("workflow_instances", {
    filters: {
      source_module: `eq.${definition.sourceModule}`,
      source_record_type: `eq.${definition.sourceRecordType}`,
      source_record_id: `eq.${definition.sourceRecordId}`
    },
    limit: 1
  });

  return row;
}

async function ensureEvidenceRequirements(definition: CompletionWorkflowDefinition, workflowInstanceId: string) {
  if (definition.requiredEvidence.length === 0) return [];

  const existing = await readSupabaseTable<WorkflowEvidenceRequirementRow>("workflow_evidence_requirements", {
    filters: { workflow_instance_id: `eq.${workflowInstanceId}` },
    limit: 100
  });
  const existingTitles = new Set(existing.map((item) => item.title.trim().toLowerCase()));
  const missing = definition.requiredEvidence.filter((item) => !existingTitles.has(item.label.trim().toLowerCase()));

  for (const item of missing) {
    await insertSupabaseRow<WorkflowEvidenceRequirementRow>("workflow_evidence_requirements", {
      organization_id: defaultWorkflowPersistenceContext.organizationId,
      workspace_id: defaultWorkflowPersistenceContext.workspaceId,
      workflow_instance_id: workflowInstanceId,
      requirement_type: definition.sourceRecordType,
      title: item.label,
      description: definition.businessPurpose,
      status: item.statusLabel,
      source_module: definition.sourceModule,
      source_record_type: definition.sourceRecordType,
      source_record_id: definition.sourceRecordId,
      attachment_id: null,
      required_for_gate: item.required
    });
  }

  return readSupabaseTable<WorkflowEvidenceRequirementRow>("workflow_evidence_requirements", {
    filters: { workflow_instance_id: `eq.${workflowInstanceId}` },
    limit: 100
  });
}

async function updateEvidenceRequirements({
  definition,
  workflowInstanceId,
  action,
  timestamp
}: {
  definition: CompletionWorkflowDefinition;
  workflowInstanceId: string;
  action: CompletionActionDefinition;
  timestamp: string;
}) {
  if (!action.updatesEvidence) return undefined;

  const requirements = await ensureEvidenceRequirements(definition, workflowInstanceId);

  if (requirements.length === 0) {
    return {
      status: action.updatesEvidence,
      requirementIds: [],
      metadataOnly: true
    };
  }

  const updated = await Promise.all(
    requirements.map((requirement) =>
      updateSupabaseRows<WorkflowEvidenceRequirementRow>(
        "workflow_evidence_requirements",
        { id: `eq.${requirement.id}` },
        {
          status: action.updatesEvidence,
          updated_at: timestamp
        }
      )
    )
  );

  return {
    status: action.updatesEvidence,
    requirementIds: updated.flat().map((item) => item.id),
    metadataOnly: false
  };
}

function getCreatedLinkedOutput(before: WorkflowCompletionItem, after: WorkflowCompletionItem) {
  const beforeIds = new Set((before.linkedOutputRecords ?? []).map((item) => item.id));

  return (after.linkedOutputRecords ?? []).find((item) => !beforeIds.has(item.id));
}

function d5oPhaseFor(sourceModule: string) {
  if (sourceModule === "billing") return "D4";
  if (sourceModule === "field_execution") return "D4";
  if (sourceModule === "closeout") return "D5";
  return "D5O";
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
