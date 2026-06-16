import type { WorkflowTransactionResult } from "./transactions";
import type { OperatingWorkflow } from "./types";

export type WorkflowPersistenceContext = {
  organizationId: string;
  workspaceId: string;
  actorUserId?: string | null;
};

export const defaultWorkflowPersistenceContext: WorkflowPersistenceContext = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  actorUserId: null
};

export function mapWorkflowToWorkflowInstanceInsert(
  workflow: OperatingWorkflow,
  context: WorkflowPersistenceContext = defaultWorkflowPersistenceContext
) {
  return {
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    project_id: workflow.projectId ?? null,
    workflow_type: workflow.workflowType,
    d5o_phase: workflow.d5oPhase,
    source_module: workflow.sourceModule,
    source_record_type: workflow.sourceRecordType,
    source_record_id: workflow.sourceRecordId,
    entity_name: workflow.entityName,
    title: workflow.title,
    description: workflow.description,
    current_status: workflow.currentStatus,
    resolution_state: workflow.resolutionState,
    severity: workflow.severity,
    owner_name: workflow.owner,
    owner_role: null,
    due_date: workflow.dueDate || null,
    business_impact: workflow.businessImpact,
    consequence_if_missed: workflow.consequenceIfMissed,
    target_module: workflow.targetModule,
    target_href: workflow.targetHref,
    next_gate_or_status: workflow.nextGateOrStatus.label,
    value_at_risk: workflow.valueAtRisk ?? null,
    metadata: {
      projectName: workflow.projectName,
      signal: workflow.signal,
      requiredDecision: workflow.requiredDecision,
      requiredAction: workflow.requiredAction,
      evidenceNeeded: workflow.evidenceNeeded,
      nextGateOrStatus: workflow.nextGateOrStatus
    }
  };
}

export function mapSignalToWorkflowSignalInsert(
  workflow: OperatingWorkflow,
  context: WorkflowPersistenceContext = defaultWorkflowPersistenceContext
) {
  return {
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    workflow_instance_id: workflow.id,
    signal_type: workflow.signal.title,
    summary: workflow.signal.detail,
    severity: workflow.severity,
    source_module: workflow.sourceModule,
    source_record_type: workflow.sourceRecordType,
    source_record_id: workflow.sourceRecordId,
    detected_at: workflow.createdAt,
    metadata: {
      workflowType: workflow.workflowType,
      businessImpact: workflow.businessImpact,
      consequenceIfMissed: workflow.consequenceIfMissed
    }
  };
}

export function mapTransactionResultToWorkflowTransactionInsert(
  result: WorkflowTransactionResult,
  context: WorkflowPersistenceContext = defaultWorkflowPersistenceContext
) {
  return {
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    project_id: result.updatedWorkflow.projectId ?? null,
    workflow_instance_id: result.workflowId,
    transaction_type: result.transactionType,
    transaction_label: result.label,
    actor_name: result.input.actorName,
    actor_role: result.input.actorRole,
    actor_user_id: context.actorUserId ?? null,
    decision: result.input.transactionType,
    decision_reason: result.input.decisionReason ?? null,
    action_taken: result.input.notes,
    evidence_summary: result.input.evidenceConfirmed.join("; "),
    resulting_status: result.outcome.currentStatus,
    resulting_resolution_state: result.outcome.resolutionState,
    resulting_gate_movement: result.outcome.nextGateOrStatus.label,
    success_message: result.message,
    metadata: {
      success: result.success,
      nextRecommendedStep: result.nextRecommendedStep,
      auditEvent: result.auditEvent,
      localTransactionId: result.id
    }
  };
}

export function mapEvidenceToWorkflowEvidenceRequirementInsert(
  workflow: OperatingWorkflow,
  context: WorkflowPersistenceContext = defaultWorkflowPersistenceContext
) {
  return workflow.evidenceNeeded.required.map((title) => ({
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    workflow_instance_id: workflow.id,
    requirement_type: workflow.workflowType,
    title,
    description: workflow.evidenceNeeded.currentState ?? null,
    status: "missing",
    source_module: workflow.sourceModule,
    source_record_type: workflow.sourceRecordType,
    source_record_id: workflow.sourceRecordId,
    attachment_id: null,
    required_for_gate: true
  }));
}

export function mapWorkflowSourceLinks(
  workflow: OperatingWorkflow,
  context: WorkflowPersistenceContext = defaultWorkflowPersistenceContext
) {
  return [
    {
      organization_id: context.organizationId,
      workspace_id: context.workspaceId,
      workflow_instance_id: workflow.id,
      source_module: workflow.sourceModule,
      source_record_type: workflow.sourceRecordType,
      source_record_id: workflow.sourceRecordId,
      link_type: "primary"
    }
  ];
}
