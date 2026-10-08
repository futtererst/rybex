export type BillingV2State =
  | "blocked"
  | "backup_package_in_progress"
  | "evidence_required"
  | "package_ready_for_review"
  | "commercial_review_pending"
  | "commercial_review_approved"
  | "commercial_review_changes_requested"
  | "commercial_review_rejected"
  | "billing_blocker_cleared"
  | "reopened";

export type BillingEvidenceStatus =
  | "missing"
  | "referenced"
  | "attached"
  | "verified"
  | "waived"
  | "not_required";

export type BillingEvidenceReferenceType =
  | "document_reference"
  | "daily_report"
  | "photo_log"
  | "supervisor_confirmation"
  | "product_approval"
  | "change_event"
  | "other";

export type BillingReviewStatus =
  | "not_created"
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected";

export type BillingReviewDecisionType = "approved" | "changes_requested" | "rejected";

export type BillingStorageMode = "local_demo" | "file_adapter" | "database_pilot" | "production_future";

export type BillingSourceRecord = {
  id?: string;
  label: string;
  type: string;
};

export type BillingEvidenceReference = {
  id: string;
  requirementId: string;
  referenceText: string;
  referenceType: BillingEvidenceReferenceType;
  linkedRecordId?: string;
  storagePointer?: string;
  savedBy: string;
  savedAt: string;
};

export type BillingEvidenceRequirement = {
  id: string;
  label: string;
  required: boolean;
  waiverAllowed: boolean;
  whyItMatters: string;
  status: BillingEvidenceStatus;
  reference?: BillingEvidenceReference;
  waiverReason?: string;
  updatedAt?: string;
};

export type BillingReviewPackageSummary = {
  packageId: string;
  payApplicationLabel: string;
  blockedAmount: number;
  currency: string;
  backupSummary: string;
  relatedSourceRecord: BillingSourceRecord;
  amountAffected: number;
  evidenceSummary: Array<{
    requirementId: string;
    label: string;
    status: BillingEvidenceStatus;
    referenceText?: string;
    waiverReason?: string;
  }>;
};

export type BillingReviewTask = {
  id: string;
  packageId: string;
  assignedRole: string;
  status: BillingReviewStatus;
  createdBy: string;
  createdAt: string;
  dueDate?: string;
  packageSummary: BillingReviewPackageSummary;
  decisionId?: string;
};

export type BillingReviewDecision = {
  id: string;
  reviewTaskId: string;
  decision: BillingReviewDecisionType;
  decisionNote: string;
  reviewerId: string;
  decidedAt: string;
};

export type BillingBlockerResolution = {
  id: string;
  packageId: string;
  resolutionNote: string;
  clearedBy: string;
  clearedAt: string;
  fromState: BillingV2State;
  toState: "billing_blocker_cleared";
  remainingBlockers: string[];
};

export type BillingOutcomeRecord = {
  id: string;
  packageId: string;
  workflowName: string;
  businessProcess: string;
  businessObject: string;
  owner: string;
  completedBy: string;
  completedAt: string;
  blockedAmount: number;
  currency: string;
  backupPackageStatus: BillingV2State;
  evidenceCaptured: Array<{
    label: string;
    status: BillingEvidenceStatus;
    referenceText?: string;
    waiverReason?: string;
  }>;
  reviewDecision: BillingReviewDecision;
  approvalNote: string;
  blockerCleared: boolean;
  remainingBlockers: string[];
  nextBusinessStep: string;
  localDemoOnly: boolean;
  databaseBacked: boolean;
  outcome: string;
};

export type BillingHistoricalRecord = {
  id: string;
  packageId: string;
  recordLabel: string;
  workflowName: string;
  businessProcess: string;
  businessObject: string;
  owner: string;
  userInputs: Array<{
    label: string;
    value: string;
  }>;
  evidenceReferences: Array<{
    label: string;
    status: BillingEvidenceStatus;
    value: string;
  }>;
  reviewTask: BillingReviewTask;
  reviewDecision: BillingReviewDecision;
  stateTransitions: Array<{
    from: BillingV2State;
    to: BillingV2State;
    label: string;
    occurredAt: string;
  }>;
  outcome: string;
  auditSummary: string;
  storageMode: BillingStorageMode;
  createdAt: string;
};

export type BillingV2EventType =
  | "BillingBackupPackageStarted"
  | "BillingBackupSummarySaved"
  | "BillingSourceRecordSaved"
  | "BillingAmountAffectedSaved"
  | "BillingReviewNoteSaved"
  | "BillingEvidenceReferenceSaved"
  | "BillingEvidenceRequirementWaived"
  | "BillingPackageReadinessValidated"
  | "BillingCommercialReviewTaskCreated"
  | "BillingCommercialReviewApproved"
  | "BillingCommercialReviewChangesRequested"
  | "BillingCommercialReviewRejected"
  | "BillingResolutionNoteSaved"
  | "BillingBlockerCleared"
  | "BillingBlockerReopened"
  | "BillingOutcomeRecordGenerated"
  | "BillingHistoricalRecordGenerated";

export type BillingV2Event = {
  id: string;
  type: BillingV2EventType;
  packageId: string;
  actorId: string;
  occurredAt: string;
  fromState?: BillingV2State;
  toState?: BillingV2State;
  message: string;
  payload?: Record<string, string | number | boolean | null | undefined>;
};

export type BillingHistoryEntry = {
  id: string;
  eventType: BillingV2EventType;
  actorId: string;
  occurredAt: string;
  label: string;
  note: string;
  fromState?: BillingV2State;
  toState?: BillingV2State;
};

export type BillingBackupPackage = {
  id: string;
  workflowName: string;
  businessProcess: string;
  projectId: string;
  projectName: string;
  payApplicationId: string;
  payApplicationLabel: string;
  title: string;
  blockerReason: string;
  owner: string;
  reviewerRole: string;
  state: BillingV2State;
  blockedAmount: number;
  currency: string;
  backupSummary?: string;
  relatedSourceRecord?: BillingSourceRecord;
  amountAffected?: number;
  reviewNote?: string;
  resolutionNote?: string;
  evidenceRequirements: BillingEvidenceRequirement[];
  reviewTask?: BillingReviewTask;
  reviewDecision?: BillingReviewDecision;
  blockerResolution?: BillingBlockerResolution;
  outcomeRecord?: BillingOutcomeRecord;
  historicalRecord?: BillingHistoricalRecord;
  events: BillingV2Event[];
  history: BillingHistoryEntry[];
  localDemoOnly: boolean;
  databaseBacked: boolean;
  storageMode?: BillingStorageMode;
  createdAt: string;
  updatedAt: string;
};

export type BillingPackageReadiness = {
  isReady: boolean;
  missingItems: string[];
  satisfiedEvidenceIds: string[];
  waivedEvidenceIds: string[];
};

export type BillingCommandContext = {
  actorId: string;
  occurredAt?: string;
};

export type BillingCommandResult = {
  success: boolean;
  package: BillingBackupPackage;
  events: BillingV2Event[];
  message: string;
  error?: string;
  readiness?: BillingPackageReadiness;
};

export type StartBackupPackageCommand = BillingCommandContext;

export type SaveBackupSummaryCommand = BillingCommandContext & {
  summary: string;
};

export type SaveRelatedSourceRecordCommand = BillingCommandContext & {
  sourceRecordId?: string;
  sourceRecordLabel: string;
  sourceRecordType: string;
};

export type SaveAmountAffectedCommand = BillingCommandContext & {
  amountAffected: number;
  currency?: string;
};

export type SaveReviewNoteCommand = BillingCommandContext & {
  reviewNote: string;
};

export type SaveEvidenceReferenceCommand = BillingCommandContext & {
  evidenceRequirementId: string;
  referenceText: string;
  referenceType: BillingEvidenceReferenceType;
  linkedRecordId?: string;
  storagePointer?: string;
};

export type WaiveEvidenceRequirementCommand = BillingCommandContext & {
  evidenceRequirementId: string;
  waiverReason: string;
};

export type ValidatePackageReadinessCommand = BillingCommandContext;

export type SendPackageToCommercialReviewCommand = BillingCommandContext & {
  assignedRole: string;
  dueDate?: string;
};

export type ReviewDecisionCommand = {
  reviewTaskId: string;
  reviewerId: string;
  decisionNote: string;
  occurredAt?: string;
};

export type SaveResolutionNoteCommand = BillingCommandContext & {
  resolutionNote: string;
};

export type ClearBillingBlockerCommand = BillingCommandContext;

export type ReopenBillingBlockerCommand = BillingCommandContext & {
  reopenReason: string;
};
