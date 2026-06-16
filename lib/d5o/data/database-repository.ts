import { demoAuditEvents } from "../audit";
import { moduleImplementationStatuses } from "../implementation-status";
import type {
  ChangeEventStatus,
  Opportunity,
  ProjectPerformanceScorecard,
  RybexProject
} from "../types";
import { getDatabaseClient, insertSupabaseRow, readSupabaseTable, requireDatabaseClient, updateSupabaseRows } from "./database-client";
import { getDatabaseReadinessStatus } from "./database-diagnostics";
import { persistWorkflowTransaction } from "./workflow-transaction-writes";
import type {
  CreateChangeEventInput,
  CreateCloseoutPackageInput,
  CreateDailyReportInput,
  CreateDeficiencyInput,
  CreateInspectionInput,
  CreateJhaRecordInput,
  CreateMobilizationPlanInput,
  CreateOpportunityInput,
  CreatePayApplicationInput,
  CreateProjectSetupInput,
  CreateRfiInput,
  CreateSafetyRecordInput,
  CreateSubmittalInput,
  CreateWorkflowEvidenceRequirementInput,
  CreateWorkflowTransactionInput,
  CreateAttachmentMetadataInput,
  LinkAttachmentToEntityInput,
  AttachEvidenceToRequirementInput,
  AttachmentMetadataRecord,
  EntityAttachmentRecord,
  EvidenceAttachmentRecord,
  LinkWorkflowSourceInput,
  RybexDataRepository,
  UpdateWorkflowResolutionStateInput,
  UpdateOpportunityInput,
  UpdateProductionRateInput,
  WorkflowEvidenceRequirementRecord,
  WorkflowInstanceRecord,
  WorkflowTransactionRecord
} from "./contracts";
import { getDataSourceMode } from "./data-source";

function databaseNotImplemented(method: string): never {
  requireDatabaseClient();
  throw new Error(`Database repository is scaffolded but not implemented for ${method}.`);
}

type WorkflowInstanceRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  workflow_type: WorkflowInstanceRecord["workflowType"];
  d5o_phase: WorkflowInstanceRecord["d5oPhase"];
  source_module: string;
  source_record_type: string;
  source_record_id: string;
  entity_name: string;
  title: string;
  description: string | null;
  current_status: WorkflowInstanceRecord["currentStatus"];
  resolution_state: WorkflowInstanceRecord["resolutionState"];
  severity: WorkflowInstanceRecord["severity"];
  owner_name: string | null;
  owner_role: WorkflowInstanceRecord["ownerRole"] | null;
  due_date: string | null;
  business_impact: string | null;
  consequence_if_missed: string | null;
  target_module: string | null;
  target_href: string | null;
  next_gate_or_status: string | null;
  value_at_risk: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type OpportunityRow = {
  id: string;
  name: string;
  gc_client: string;
  owner_or_prime: string | null;
  project_location: string | null;
  project_type: string | null;
  status: string;
  d5o_phase: string;
  estimated_value: number | null;
  bid_due_date: string | null;
  received_date: string | null;
  risk_level: string | null;
  decision: string | null;
  next_action: string | null;
  scope_summary: string | null;
  metadata: Record<string, unknown> | null;
};

type ProjectRow = {
  id: string;
  source_opportunity_id: string | null;
  project_number: string | null;
  name: string;
  gc_client: string;
  owner_or_prime: string | null;
  location: string | null;
  project_type: string | null;
  d5o_phase: string;
  health_status: string;
  contract_status: string | null;
  contract_value: number | null;
  next_milestone: string | null;
  next_action: string | null;
  metadata: Record<string, unknown> | null;
};

type D5OGateRow = {
  id: string;
  project_id: string;
  phase_id: string;
  gate_name: string;
  status: string;
  readiness_percent: number;
  next_action: string | null;
};

type GoNoGoScoreRow = {
  id: string;
  opportunity_id: string;
  total_score: number;
  recommendation: string;
  risk_level: string;
  decision: string | null;
};

type WorkflowTransactionRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  workflow_instance_id: string;
  transaction_type: WorkflowTransactionRecord["transactionType"];
  transaction_label: string;
  actor_name: string | null;
  actor_role: WorkflowTransactionRecord["actorRole"] | null;
  actor_user_id: string | null;
  decision: string | null;
  decision_reason: string | null;
  action_taken: string;
  evidence_summary: string | null;
  resulting_status: string | null;
  resulting_resolution_state: WorkflowTransactionRecord["resultingResolutionState"] | null;
  resulting_gate_movement: string | null;
  success_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type WorkflowEvidenceRequirementRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  workflow_instance_id: string;
  requirement_type: string;
  title: string;
  description: string | null;
  status: string;
  source_module: string | null;
  source_record_type: string | null;
  source_record_id: string | null;
  attachment_id: string | null;
  required_for_gate: boolean;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  storage_provider: string;
  bucket: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  version: number;
  status: string;
  is_private: boolean;
  virus_scan_status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type EntityAttachmentRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  entity_type: string;
  entity_id: string;
  attachment_id: string;
  relationship_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

async function databaseReadPilot(method: "getPipelineData" | "getProjectsData" | "getCommandCenterData") {
  const client = requireDatabaseClient();
  const diagnostics = getDatabaseReadinessStatus();

  if (method === "getPipelineData") {
    const [opportunities, scores] = await Promise.all([
      readSupabaseTable<OpportunityRow>("opportunities", { order: "bid_due_date.asc.nullslast", limit: 100 }),
      readSupabaseTable<GoNoGoScoreRow>("go_no_go_scores", { limit: 100 })
    ]);

    return {
      dataSourceMode: "database",
      repositoryStatus: "read_only_pilot",
      method,
      connectionConfigured: Boolean(client.supabaseUrl),
      diagnostics,
      opportunities: opportunities.map(mapOpportunityRow),
      goNoGoScores: scores,
      note: "Read-only Supabase pilot. Writes, auth, and RLS are not enabled."
    };
  }

  if (method === "getProjectsData") {
    const [projects, gates] = await Promise.all([
      readSupabaseTable<ProjectRow>("projects", { order: "created_at.desc", limit: 100 }),
      readSupabaseTable<D5OGateRow>("d5o_gates", { limit: 200 })
    ]);

    return {
      dataSourceMode: "database",
      repositoryStatus: "read_only_pilot",
      method,
      connectionConfigured: Boolean(client.supabaseUrl),
      diagnostics,
      projects: projects.map(mapProjectRow),
      gates,
      note: "Read-only Supabase pilot. Writes, auth, and RLS are not enabled."
    };
  }

  const [workflowInstances, opportunities, projects, gates] = await Promise.all([
    readSupabaseTable<WorkflowInstanceRow>("workflow_instances", { order: "due_date.asc.nullslast", limit: 100 }),
    readSupabaseTable<OpportunityRow>("opportunities", { limit: 100 }),
    readSupabaseTable<ProjectRow>("projects", { limit: 100 }),
    readSupabaseTable<D5OGateRow>("d5o_gates", { limit: 200 })
  ]);

  return {
    dataSourceMode: "database",
    repositoryStatus: "read_only_pilot",
    method,
    connectionConfigured: Boolean(client.supabaseUrl),
    diagnostics,
    workflowInstances: workflowInstances.map(mapWorkflowInstanceRow),
    counts: {
      workflowInstances: workflowInstances.length,
      opportunities: opportunities.length,
      projects: projects.length,
      gates: gates.length
    },
    note: "Read-only Supabase pilot for Admin/Command Center diagnostics. Writes, auth, and RLS are not enabled."
  };
}

export const databaseRepository: RybexDataRepository = {
  commandCenter: {
    getCommandCenterData: () => databaseReadPilot("getCommandCenterData")
  },
  pipeline: {
    getPipelineData: () => databaseReadPilot("getPipelineData"),
    getOpportunityById: (_id: string) => {
      requireDatabaseClient();
      return undefined;
    },
    createOpportunity: (_input: CreateOpportunityInput) => databaseNotImplemented("createOpportunity"),
    updateOpportunity: (_id: string, _input: UpdateOpportunityInput) => databaseNotImplemented("updateOpportunity"),
    evaluateGoNoGo: (_input: Opportunity) => databaseNotImplemented("evaluateGoNoGo")
  },
  projects: {
    getProjectsData: () => databaseReadPilot("getProjectsData"),
    getProjectById: (_id: string) => {
      requireDatabaseClient();
      return undefined;
    },
    createProjectSetup: (_input: CreateProjectSetupInput) => databaseNotImplemented("createProjectSetup"),
    evaluateD2Gate: (_projectId: string) => databaseNotImplemented("evaluateD2Gate")
  },
  mobilization: {
    getMobilizationData: () => databaseNotImplemented("getMobilizationData"),
    getMobilizationPlanById: (_id: string) => databaseNotImplemented("getMobilizationPlanById"),
    createMobilizationPlan: (_input: CreateMobilizationPlanInput) => databaseNotImplemented("createMobilizationPlan"),
    evaluateD3Gate: (_planId: string) => databaseNotImplemented("evaluateD3Gate")
  },
  fieldExecution: {
    getFieldExecutionData: () => databaseNotImplemented("getFieldExecutionData"),
    getDailyReportById: (_id: string) => databaseNotImplemented("getDailyReportById"),
    createDailyReport: (_input: CreateDailyReportInput) => databaseNotImplemented("createDailyReport"),
    evaluateD4Control: (_projectId: string) => databaseNotImplemented("evaluateD4Control")
  },
  rfiSubmittal: {
    getRfiSubmittalData: () => databaseNotImplemented("getRfiSubmittalData"),
    createRfi: (_input: CreateRfiInput) => databaseNotImplemented("createRfi"),
    createSubmittal: (_input: CreateSubmittalInput) => databaseNotImplemented("createSubmittal"),
    linkRfiToChangeEvent: (_rfiId: string, _changeEventId: string) => databaseNotImplemented("linkRfiToChangeEvent")
  },
  changeControl: {
    getChangeControlData: () => databaseNotImplemented("getChangeControlData"),
    createChangeEvent: (_input: CreateChangeEventInput) => databaseNotImplemented("createChangeEvent"),
    updateChangeEventStatus: (_id: string, _status: ChangeEventStatus) => databaseNotImplemented("updateChangeEventStatus"),
    evaluateCommercialControl: (_projectId: string) => databaseNotImplemented("evaluateCommercialControl")
  },
  billing: {
    getBillingData: () => databaseNotImplemented("getBillingData"),
    createPayApplication: (_input: CreatePayApplicationInput) => databaseNotImplemented("createPayApplication"),
    evaluateBillingReadiness: (_projectId: string) => databaseNotImplemented("evaluateBillingReadiness")
  },
  safety: {
    getSafetyData: () => databaseNotImplemented("getSafetyData"),
    createSafetyRecord: (_input: CreateSafetyRecordInput) => databaseNotImplemented("createSafetyRecord"),
    createJhaRecord: (_input: CreateJhaRecordInput) => databaseNotImplemented("createJhaRecord"),
    evaluateSafetyControl: (_projectId: string) => databaseNotImplemented("evaluateSafetyControl")
  },
  quality: {
    getQualityData: () => databaseNotImplemented("getQualityData"),
    createInspection: (_input: CreateInspectionInput) => databaseNotImplemented("createInspection"),
    createDeficiency: (_input: CreateDeficiencyInput) => databaseNotImplemented("createDeficiency"),
    evaluateQualityControl: (_projectId: string) => databaseNotImplemented("evaluateQualityControl")
  },
  closeout: {
    getCloseoutData: () => databaseNotImplemented("getCloseoutData"),
    createCloseoutPackage: (_input: CreateCloseoutPackageInput) => databaseNotImplemented("createCloseoutPackage"),
    evaluateD5Gate: (_projectId: string) => databaseNotImplemented("evaluateD5Gate")
  },
  optimize: {
    getOptimizeData: () => databaseNotImplemented("getOptimizeData"),
    createLessonsLearnedReview: (_input: Partial<ProjectPerformanceScorecard>) => databaseNotImplemented("createLessonsLearnedReview"),
    updateProductionRate: (_input: UpdateProductionRateInput) => databaseNotImplemented("updateProductionRate"),
    evaluateOptimizeControl: () => databaseNotImplemented("evaluateOptimizeControl")
  },
  admin: {
    getImplementationStatus: () => {
      if (getDataSourceMode() === "database") {
        return databaseNotImplemented("getImplementationStatus");
      }

      return moduleImplementationStatuses;
    },
    getSystemReadiness: () => ({
      implementationStatus: moduleImplementationStatuses,
      auditEvents: demoAuditEvents,
      dataSourceMode: getDataSourceMode()
    })
  },
  workflowTransactions: {
    getWorkflowInstances: async () =>
      (await readSupabaseTable<WorkflowInstanceRow>("workflow_instances", {
        order: "due_date.asc.nullslast",
        limit: 200
      })).map(mapWorkflowInstanceRow),
    getWorkflowInstanceById: async (id: string) =>
      (await readSupabaseTable<WorkflowInstanceRow>("workflow_instances", {
        select: "*",
        limit: 200
      }))
        .map(mapWorkflowInstanceRow)
        .find((workflow) => workflow.id === id),
    getWorkflowTransactions: async (workflowInstanceId: string) =>
      (await readSupabaseTable<WorkflowTransactionRow>("workflow_transactions", {
        select: "*",
        order: "created_at.desc",
        limit: 100
      }))
        .filter((transaction) => transaction.workflow_instance_id === workflowInstanceId)
        .map(mapWorkflowTransactionRow),
    createWorkflowTransaction: async (input: CreateWorkflowTransactionInput) => {
      if (!input.result || !input.workflow) {
        return databaseNotImplemented("createWorkflowTransaction without workflow/result");
      }

      const persisted = await persistWorkflowTransaction({
        workflow: input.workflow,
        result: input.result,
        actorUserId: input.meta.actorId ?? null
      });

      return {
        transactionId: persisted.transactionId,
        workflowInstanceId: persisted.workflowInstanceId,
        updatedWorkflowInstance: mapWorkflowInstanceRow(persisted.updatedWorkflowInstance as WorkflowInstanceRow),
        auditEventId: persisted.auditEventId,
        statusHistoryId: persisted.statusHistoryId,
        evidenceRequirementIds: persisted.evidenceRequirementIds,
        successMessage: persisted.successMessage
      };
    },
    updateWorkflowResolutionState: (_workflowInstanceId: string, _input: UpdateWorkflowResolutionStateInput) =>
      databaseNotImplemented("updateWorkflowResolutionState"),
    getWorkflowEvidenceRequirements: async (workflowInstanceId: string) =>
      (await readSupabaseTable<WorkflowEvidenceRequirementRow>("workflow_evidence_requirements", {
        select: "*",
        limit: 200
      }))
        .filter((requirement) => requirement.workflow_instance_id === workflowInstanceId)
        .map(mapWorkflowEvidenceRequirementRow),
    createWorkflowEvidenceRequirement: (_input: CreateWorkflowEvidenceRequirementInput) =>
      databaseNotImplemented("createWorkflowEvidenceRequirement"),
    linkWorkflowSource: (_input: LinkWorkflowSourceInput) => databaseNotImplemented("linkWorkflowSource")
  },
  evidenceAttachments: {
    createAttachmentMetadata: async (input: CreateAttachmentMetadataInput) => {
      const row = await insertSupabaseRow<AttachmentRow>("attachments", {
        organization_id: input.organizationId,
        workspace_id: input.workspaceId,
        project_id: input.projectId ?? null,
        storage_provider: "supabase_storage",
        bucket: input.storageBucket,
        storage_path: input.storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        file_size_bytes: input.fileSizeBytes,
        status: "active",
        is_private: true,
        virus_scan_status: "not_scanned",
        metadata: {
          evidenceRequirementId: input.evidenceRequirementId,
          fileType: input.fileType,
          uploadedBy: input.uploadedBy,
          relationshipType: input.relationshipType,
          pilot: true
        },
        created_by: input.meta.actorId ?? null,
        updated_by: input.meta.actorId ?? null
      });

      return mapAttachmentRow(row);
    },
    linkAttachmentToEntity: async (input: LinkAttachmentToEntityInput) => {
      const row = await insertSupabaseRow<EntityAttachmentRow>("entity_attachments", {
        organization_id: input.organizationId,
        workspace_id: input.workspaceId,
        project_id: input.projectId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        attachment_id: input.attachmentId,
        relationship_type: input.relationshipType,
        metadata: {
          pilot: true
        },
        created_by: input.meta.actorId ?? null,
        updated_by: input.meta.actorId ?? null
      });

      return mapEntityAttachmentRow(row);
    },
    attachEvidenceToRequirement: async (input: AttachEvidenceToRequirementInput) => {
      const links = await databaseRepository.evidenceAttachments.linkAttachmentToEntity({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        entityType: "workflow_evidence_requirement",
        entityId: input.evidenceRequirementId,
        attachmentId: input.attachmentId,
        relationshipType: input.relationshipType,
        meta: input.meta
      });

      void links;

      const [updated] = await updateSupabaseRows<WorkflowEvidenceRequirementRow>(
        "workflow_evidence_requirements",
        { id: `eq.${input.evidenceRequirementId}` },
        {
          status: input.status,
          attachment_id: input.attachmentId,
          updated_at: new Date().toISOString()
        }
      );

      if (!updated) {
        throw new Error("Evidence requirement update did not return a row.");
      }

      return mapWorkflowEvidenceRequirementRow(updated);
    },
    getEvidenceAttachments: async (evidenceRequirementId: string) => {
      const links = (await readSupabaseTable<EntityAttachmentRow>("entity_attachments", {
        filters: {
          entity_type: "eq.workflow_evidence_requirement",
          entity_id: `eq.${evidenceRequirementId}`
        },
        limit: 100
      })).map(mapEntityAttachmentRow);
      const attachments = await Promise.all(
        links.map(async (link) =>
          (await readSupabaseTable<AttachmentRow>("attachments", {
            filters: { id: `eq.${link.attachmentId}` },
            limit: 1
          })).map(mapAttachmentRow)[0]
        )
      );

      return links
        .map((link, index) => {
          const attachment = attachments[index];

          return attachment ? { attachment, link } satisfies EvidenceAttachmentRecord : undefined;
        })
        .filter((item): item is EvidenceAttachmentRecord => Boolean(item));
    }
  }
};

export function assertDatabaseRepositoryNotRuntimeEnabled() {
  if (getDataSourceMode() === "database") {
    getDatabaseClient();
  }
}

function mapWorkflowInstanceRow(row: WorkflowInstanceRow): WorkflowInstanceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    workflowType: row.workflow_type,
    d5oPhase: row.d5o_phase,
    sourceModule: row.source_module,
    sourceRecordType: row.source_record_type,
    sourceRecordId: row.source_record_id,
    entityName: row.entity_name,
    title: row.title,
    description: row.description ?? undefined,
    currentStatus: row.current_status,
    resolutionState: row.resolution_state,
    severity: row.severity,
    ownerName: row.owner_name ?? undefined,
    ownerRole: row.owner_role ?? undefined,
    dueDate: row.due_date ?? undefined,
    businessImpact: row.business_impact ?? undefined,
    consequenceIfMissed: row.consequence_if_missed ?? undefined,
    targetModule: row.target_module ?? undefined,
    targetHref: row.target_href ?? undefined,
    nextGateOrStatus: row.next_gate_or_status ?? undefined,
    valueAtRisk: row.value_at_risk ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOpportunityRow(row: OpportunityRow): Partial<Opportunity> {
  return {
    id: row.id,
    name: row.name,
    gcClient: row.gc_client,
    ownerOrPrime: row.owner_or_prime ?? "",
    projectLocation: row.project_location ?? "",
    projectType: row.project_type as Opportunity["projectType"],
    status: row.status as Opportunity["status"],
    d5oPhase: row.d5o_phase as Opportunity["d5oPhase"],
    estimatedValue: row.estimated_value ?? 0,
    bidDueDate: row.bid_due_date ?? "",
    receivedDate: row.received_date ?? "",
    riskLevel: (row.risk_level ?? "moderate") as Opportunity["riskLevel"],
    decision: row.decision as Opportunity["decision"],
    nextAction: row.next_action ?? "",
    scopeSummary: row.scope_summary ?? ""
  };
}

function mapProjectRow(row: ProjectRow): Partial<RybexProject> {
  return {
    id: row.id,
    sourceOpportunityId: row.source_opportunity_id ?? "",
    projectNumber: row.project_number ?? "",
    name: row.name,
    gcClient: row.gc_client,
    ownerOrPrime: row.owner_or_prime ?? "",
    location: row.location ?? "",
    projectType: row.project_type as RybexProject["projectType"],
    d5oPhase: row.d5o_phase as RybexProject["d5oPhase"],
    healthStatus: row.health_status as RybexProject["healthStatus"],
    contractStatus: row.contract_status as RybexProject["contractStatus"],
    contractValue: row.contract_value ?? 0,
    nextMilestone: row.next_milestone ?? "",
    nextAction: row.next_action ?? ""
  };
}

function mapWorkflowTransactionRow(row: WorkflowTransactionRow): WorkflowTransactionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    workflowInstanceId: row.workflow_instance_id,
    transactionType: row.transaction_type,
    transactionLabel: row.transaction_label,
    actorName: row.actor_name ?? undefined,
    actorRole: row.actor_role ?? undefined,
    actorUserId: row.actor_user_id ?? undefined,
    decision: row.decision ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
    actionTaken: row.action_taken,
    evidenceSummary: row.evidence_summary ?? undefined,
    resultingStatus: row.resulting_status ?? undefined,
    resultingResolutionState: row.resulting_resolution_state ?? undefined,
    resultingGateMovement: row.resulting_gate_movement ?? undefined,
    successMessage: row.success_message ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at
  };
}

function mapWorkflowEvidenceRequirementRow(row: WorkflowEvidenceRequirementRow): WorkflowEvidenceRequirementRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    workflowInstanceId: row.workflow_instance_id,
    requirementType: row.requirement_type,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    sourceModule: row.source_module ?? undefined,
    sourceRecordType: row.source_record_type ?? undefined,
    sourceRecordId: row.source_record_id ?? undefined,
    attachmentId: row.attachment_id ?? undefined,
    requiredForGate: row.required_for_gate,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAttachmentRow(row: AttachmentRow): AttachmentMetadataRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    storageProvider: row.storage_provider,
    bucket: row.bucket ?? "",
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    version: row.version,
    status: row.status,
    isPrivate: row.is_private,
    virusScanStatus: row.virus_scan_status,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEntityAttachmentRow(row: EntityAttachmentRow): EntityAttachmentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id,
    attachmentId: row.attachment_id,
    relationshipType: row.relationship_type,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
