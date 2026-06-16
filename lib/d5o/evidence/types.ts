export type EvidenceCategory =
  | "photo"
  | "daily_report"
  | "jha"
  | "safety_plan"
  | "utility_locate"
  | "rfi_attachment"
  | "submittal_package"
  | "change_backup"
  | "tm_ticket"
  | "pay_app_backup"
  | "lien_waiver"
  | "inspection_record"
  | "test_result"
  | "otdr_result"
  | "punch_verification"
  | "as_built"
  | "warranty"
  | "om_document"
  | "closeout_package"
  | "approval_record"
  | "other";

export type EvidenceStatus =
  | "missing"
  | "pending"
  | "uploaded"
  | "under_review"
  | "verified"
  | "rejected"
  | "waived"
  | "not_required";

export type EvidenceVerification = {
  status: "not_started" | "ready_for_review" | "verified" | "rejected" | "waived";
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
};

export type EvidenceSource = {
  module: string;
  recordType: string;
  recordId: string;
  label?: string;
};

export type EvidenceLink = {
  source: EvidenceSource;
  relationship: "primary" | "supporting" | "created_from" | "blocks" | "verifies";
};

export type EvidenceRequirement = {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  workflowInstanceId?: string;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  category: EvidenceCategory;
  title: string;
  description: string;
  required: boolean;
  status: EvidenceStatus;
  owner: string;
  dueDate?: string;
  requiredForGate: boolean;
  requiredForBilling: boolean;
  requiredForCloseout: boolean;
  requiredForChangeRecovery: boolean;
  linkedAttachmentIds: string[];
  verificationStatus: EvidenceVerification["status"];
  verifiedBy?: string;
  verifiedAt?: string;
  nextAction: string;
  links?: EvidenceLink[];
};

export type EvidenceItem = {
  id: string;
  requirementId: string;
  title: string;
  category: EvidenceCategory;
  status: EvidenceStatus;
  source: EvidenceSource;
  attachmentId?: string;
  demoOnly?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DerivedEvidenceSummary = {
  allEvidenceRequirements: EvidenceRequirement[];
  missingEvidence: EvidenceRequirement[];
  evidenceByProject: Record<string, EvidenceRequirement[]>;
  evidenceByWorkflow: Record<string, EvidenceRequirement[]>;
  evidenceByCategory: Record<EvidenceCategory, EvidenceRequirement[]>;
  evidenceBlockingGate: EvidenceRequirement[];
  evidenceBlockingBilling: EvidenceRequirement[];
  evidenceBlockingCloseout: EvidenceRequirement[];
  evidenceReadyForReview: EvidenceRequirement[];
};
