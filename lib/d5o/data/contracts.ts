import type { AuditEvent } from "../audit";
import type { ModuleImplementationStatus } from "../implementation-status";
import type { RybexPermission } from "../rbac";
import type { OperatingWorkflow, WorkflowResolutionState } from "../workflow/types";
import type {
  WorkflowTransactionInput,
  WorkflowTransactionResult,
  WorkflowTransactionType
} from "../workflow/transactions";
import type {
  ChangeEvent,
  ChangeEventStatus,
  CloseoutPackage,
  DailyReport,
  JhaRecord,
  MobilizationPlan,
  Opportunity,
  PayApplication,
  ProductionRateRecord,
  ProjectPerformanceScorecard,
  QualityDeficiency,
  QualityInspection,
  RFI,
  RybexProject,
  SafetyObservation,
  Submittal,
  UserRole
} from "../types";

export type RepositoryResult<T> = Promise<T> | T;

export type RepositoryOperationMeta = {
  organizationId?: string;
  workspaceId?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  projectId?: string;
  requiredPermission: RybexPermission;
  auditEventRequired: boolean;
};

export type CreateOpportunityInput = Partial<Opportunity>;
export type UpdateOpportunityInput = Partial<Opportunity>;
export type CreateProjectSetupInput = Partial<RybexProject>;
export type CreateMobilizationPlanInput = Partial<MobilizationPlan>;
export type CreateDailyReportInput = Partial<DailyReport>;
export type CreateRfiInput = Partial<RFI>;
export type CreateSubmittalInput = Partial<Submittal>;
export type CreateChangeEventInput = Partial<ChangeEvent>;
export type CreatePayApplicationInput = Partial<PayApplication>;
export type CreateSafetyRecordInput = Partial<SafetyObservation>;
export type CreateJhaRecordInput = Partial<JhaRecord>;
export type CreateInspectionInput = Partial<QualityInspection>;
export type CreateDeficiencyInput = Partial<QualityDeficiency>;
export type CreateCloseoutPackageInput = Partial<CloseoutPackage>;
export type CreateLessonsLearnedReviewInput = Partial<ProjectPerformanceScorecard>;
export type UpdateProductionRateInput = Partial<ProductionRateRecord>;

export type WorkflowInstanceRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  workflowType: OperatingWorkflow["workflowType"];
  d5oPhase: OperatingWorkflow["d5oPhase"];
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  entityName: string;
  title: string;
  description?: string;
  currentStatus: OperatingWorkflow["currentStatus"];
  resolutionState: WorkflowResolutionState;
  severity: OperatingWorkflow["severity"];
  ownerName?: string;
  ownerRole?: UserRole;
  dueDate?: string;
  businessImpact?: string;
  consequenceIfMissed?: string;
  targetModule?: string;
  targetHref?: string;
  nextGateOrStatus?: string;
  valueAtRisk?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSignalRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowInstanceId: string;
  signalType: string;
  summary: string;
  severity: OperatingWorkflow["severity"];
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type WorkflowTransactionRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  workflowInstanceId: string;
  transactionType: WorkflowTransactionType;
  transactionLabel: string;
  actorName?: string;
  actorRole?: UserRole;
  actorUserId?: string;
  decision?: string;
  decisionReason?: string;
  actionTaken: string;
  evidenceSummary?: string;
  resultingStatus?: string;
  resultingResolutionState?: WorkflowResolutionState;
  resultingGateMovement?: string;
  successMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type WorkflowEvidenceRequirementRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowInstanceId: string;
  requirementType: string;
  title: string;
  description?: string;
  status: "missing" | "partial" | "complete" | "verified" | string;
  sourceModule?: string;
  sourceRecordType?: string;
  sourceRecordId?: string;
  attachmentId?: string;
  requiredForGate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSourceLinkRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowInstanceId: string;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  linkType: "primary" | "evidence" | "created_record" | "related_record" | string;
  createdAt: string;
};

export type CreateWorkflowTransactionInput = {
  workflowInstanceId: string;
  workflow?: OperatingWorkflow;
  localTransaction: WorkflowTransactionInput;
  result?: WorkflowTransactionResult;
  meta: RepositoryOperationMeta;
};

export type CreateWorkflowTransactionOutput = {
  transactionId: string;
  workflowInstanceId: string;
  updatedWorkflowInstance?: WorkflowInstanceRecord;
  auditEventId?: string;
  statusHistoryId?: string;
  evidenceRequirementIds: string[];
  successMessage: string;
};

export type UpdateWorkflowResolutionStateInput = {
  resolutionState: WorkflowResolutionState;
  currentStatus?: OperatingWorkflow["currentStatus"];
  reason: string;
  meta: RepositoryOperationMeta;
};

export type CreateWorkflowEvidenceRequirementInput = Omit<
  WorkflowEvidenceRequirementRecord,
  "id" | "createdAt" | "updatedAt"
> & {
  meta: RepositoryOperationMeta;
};

export type LinkWorkflowSourceInput = Omit<WorkflowSourceLinkRecord, "id" | "createdAt"> & {
  meta: RepositoryOperationMeta;
};

export type AttachmentMetadataRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  storageProvider: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  version: number;
  status: string;
  isPrivate: boolean;
  virusScanStatus: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EntityAttachmentRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  attachmentId: string;
  relationshipType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateAttachmentMetadataInput = {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  evidenceRequirementId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  storageBucket: string;
  storagePath: string;
  uploadedBy?: string;
  relationshipType: string;
  meta: RepositoryOperationMeta;
};

export type LinkAttachmentToEntityInput = {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  attachmentId: string;
  relationshipType: string;
  meta: RepositoryOperationMeta;
};

export type AttachEvidenceToRequirementInput = {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  evidenceRequirementId: string;
  attachmentId: string;
  relationshipType: string;
  status: "uploaded" | "under_review" | "verified";
  meta: RepositoryOperationMeta;
};

export type EvidenceAttachmentRecord = {
  attachment: AttachmentMetadataRecord;
  link: EntityAttachmentRecord;
};

export interface CommandCenterRepository {
  getCommandCenterData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
}

export interface PipelineRepository {
  getPipelineData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  getOpportunityById(id: string): RepositoryResult<Opportunity | undefined>;
  createOpportunity(input: CreateOpportunityInput, meta: RepositoryOperationMeta): RepositoryResult<Opportunity>;
  updateOpportunity(id: string, input: UpdateOpportunityInput, meta: RepositoryOperationMeta): RepositoryResult<Opportunity>;
  evaluateGoNoGo(input: Opportunity): RepositoryResult<unknown>;
}

export interface ProjectsRepository {
  getProjectsData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  getProjectById(id: string): RepositoryResult<RybexProject | undefined>;
  createProjectSetup(input: CreateProjectSetupInput, meta: RepositoryOperationMeta): RepositoryResult<RybexProject>;
  evaluateD2Gate(projectId: string): RepositoryResult<unknown>;
}

export interface MobilizationRepository {
  getMobilizationData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  getMobilizationPlanById(id: string): RepositoryResult<MobilizationPlan | undefined>;
  createMobilizationPlan(input: CreateMobilizationPlanInput, meta: RepositoryOperationMeta): RepositoryResult<MobilizationPlan>;
  evaluateD3Gate(planId: string): RepositoryResult<unknown>;
}

export interface FieldExecutionRepository {
  getFieldExecutionData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  getDailyReportById(id: string): RepositoryResult<DailyReport | undefined>;
  createDailyReport(input: CreateDailyReportInput, meta: RepositoryOperationMeta): RepositoryResult<DailyReport>;
  evaluateD4Control(projectId: string): RepositoryResult<unknown>;
}

export interface RfiSubmittalRepository {
  getRfiSubmittalData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createRfi(input: CreateRfiInput, meta: RepositoryOperationMeta): RepositoryResult<RFI>;
  createSubmittal(input: CreateSubmittalInput, meta: RepositoryOperationMeta): RepositoryResult<Submittal>;
  linkRfiToChangeEvent(rfiId: string, changeEventId: string, meta: RepositoryOperationMeta): RepositoryResult<void>;
}

export interface ChangeControlRepository {
  getChangeControlData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createChangeEvent(input: CreateChangeEventInput, meta: RepositoryOperationMeta): RepositoryResult<ChangeEvent>;
  updateChangeEventStatus(id: string, status: ChangeEventStatus, meta: RepositoryOperationMeta): RepositoryResult<ChangeEvent>;
  evaluateCommercialControl(projectId: string): RepositoryResult<unknown>;
}

export interface BillingRepository {
  getBillingData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createPayApplication(input: CreatePayApplicationInput, meta: RepositoryOperationMeta): RepositoryResult<PayApplication>;
  evaluateBillingReadiness(projectId: string): RepositoryResult<unknown>;
}

export interface SafetyRepository {
  getSafetyData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createSafetyRecord(input: CreateSafetyRecordInput, meta: RepositoryOperationMeta): RepositoryResult<SafetyObservation>;
  createJhaRecord(input: CreateJhaRecordInput, meta: RepositoryOperationMeta): RepositoryResult<JhaRecord>;
  evaluateSafetyControl(projectId: string): RepositoryResult<unknown>;
}

export interface QualityRepository {
  getQualityData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createInspection(input: CreateInspectionInput, meta: RepositoryOperationMeta): RepositoryResult<QualityInspection>;
  createDeficiency(input: CreateDeficiencyInput, meta: RepositoryOperationMeta): RepositoryResult<QualityDeficiency>;
  evaluateQualityControl(projectId: string): RepositoryResult<unknown>;
}

export interface CloseoutRepository {
  getCloseoutData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createCloseoutPackage(input: CreateCloseoutPackageInput, meta: RepositoryOperationMeta): RepositoryResult<CloseoutPackage>;
  evaluateD5Gate(projectId: string): RepositoryResult<unknown>;
}

export interface OptimizeRepository {
  getOptimizeData(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<unknown>;
  createLessonsLearnedReview(input: CreateLessonsLearnedReviewInput, meta: RepositoryOperationMeta): RepositoryResult<ProjectPerformanceScorecard>;
  updateProductionRate(input: UpdateProductionRateInput, meta: RepositoryOperationMeta): RepositoryResult<ProductionRateRecord>;
  evaluateOptimizeControl(): RepositoryResult<unknown>;
}

export interface AdminRepository {
  getImplementationStatus(): RepositoryResult<ModuleImplementationStatus[]>;
  getSystemReadiness(): RepositoryResult<{
    implementationStatus: ModuleImplementationStatus[];
    auditEvents: AuditEvent[];
    dataSourceMode: string;
  }>;
}

export interface WorkflowTransactionRepository {
  getWorkflowInstances(meta?: Partial<RepositoryOperationMeta>): RepositoryResult<WorkflowInstanceRecord[]>;
  getWorkflowInstanceById(id: string, meta?: Partial<RepositoryOperationMeta>): RepositoryResult<WorkflowInstanceRecord | undefined>;
  getWorkflowTransactions(workflowInstanceId: string, meta?: Partial<RepositoryOperationMeta>): RepositoryResult<WorkflowTransactionRecord[]>;
  createWorkflowTransaction(input: CreateWorkflowTransactionInput): RepositoryResult<CreateWorkflowTransactionOutput>;
  updateWorkflowResolutionState(
    workflowInstanceId: string,
    input: UpdateWorkflowResolutionStateInput
  ): RepositoryResult<WorkflowInstanceRecord>;
  getWorkflowEvidenceRequirements(
    workflowInstanceId: string,
    meta?: Partial<RepositoryOperationMeta>
  ): RepositoryResult<WorkflowEvidenceRequirementRecord[]>;
  createWorkflowEvidenceRequirement(input: CreateWorkflowEvidenceRequirementInput): RepositoryResult<WorkflowEvidenceRequirementRecord>;
  linkWorkflowSource(input: LinkWorkflowSourceInput): RepositoryResult<WorkflowSourceLinkRecord>;
}

export interface EvidenceAttachmentRepository {
  createAttachmentMetadata(input: CreateAttachmentMetadataInput): RepositoryResult<AttachmentMetadataRecord>;
  linkAttachmentToEntity(input: LinkAttachmentToEntityInput): RepositoryResult<EntityAttachmentRecord>;
  attachEvidenceToRequirement(input: AttachEvidenceToRequirementInput): RepositoryResult<WorkflowEvidenceRequirementRecord>;
  getEvidenceAttachments(
    evidenceRequirementId: string,
    meta?: Partial<RepositoryOperationMeta>
  ): RepositoryResult<EvidenceAttachmentRecord[]>;
}

export interface RybexDataRepository {
  commandCenter: CommandCenterRepository;
  pipeline: PipelineRepository;
  projects: ProjectsRepository;
  mobilization: MobilizationRepository;
  fieldExecution: FieldExecutionRepository;
  rfiSubmittal: RfiSubmittalRepository;
  changeControl: ChangeControlRepository;
  billing: BillingRepository;
  safety: SafetyRepository;
  quality: QualityRepository;
  closeout: CloseoutRepository;
  optimize: OptimizeRepository;
  admin: AdminRepository;
  workflowTransactions: WorkflowTransactionRepository;
  evidenceAttachments: EvidenceAttachmentRepository;
}
