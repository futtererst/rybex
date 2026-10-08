import type {
  OperatingSliceEvidenceReference,
  OperatingSliceHistoryEvent
} from "../operating-slices/types";

export type CloseoutFinalBillingState =
  | "unresolved"
  | "in_progress"
  | "assessed"
  | "evidence_added"
  | "ready_for_review"
  | "review_pending"
  | "approved"
  | "rejected"
  | "resolved";

export type CloseoutEvidenceStatus = "missing" | "in_progress" | "accepted";

export type CloseoutReleaseDecision = "approve" | "reject";

export type CloseoutRequirementAssessment = {
  acceptanceStatus: CloseoutEvidenceStatus;
  punchStatus: CloseoutEvidenceStatus;
  testEvidenceStatus: CloseoutEvidenceStatus;
  asBuiltRedlineStatus: CloseoutEvidenceStatus;
  closeoutDocumentStatus: CloseoutEvidenceStatus;
  finalBillingReleaseStatus: "blocked" | "ready" | "released";
  assessmentSummary: string;
  assessedBy: string;
  assessedAt: string;
};

export type CloseoutEvidenceRequirement = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  status: "missing" | "attached";
};

export type CloseoutEvidenceReference = OperatingSliceEvidenceReference & {
  referenceType: "acceptance_record" | "punch_photo" | "test_record" | "as_built" | "lien_waiver" | "billing_reference";
};

export type CloseoutReleaseReview = {
  id: string;
  status: "pending" | "approved" | "rejected";
  assignedRole: string;
  submittedBy: string;
  submittedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
};

export type CloseoutBillingProjection = {
  payApplicationId: string;
  lienWaiverIds: string[];
  commercialExposureId: string;
  retainageExposureAmount: number;
  status: "blocked" | "approved_for_processing";
  message: string;
};

export type CloseoutFinalBillingOutcomeRecord = {
  id: string;
  outcome: string;
  resolvedBy: string;
  resolvedAt: string;
  resolutionNote: string;
  billingProjection: CloseoutBillingProjection;
};

export type CloseoutFinalBillingBlocker = {
  id: string;
  projectId: string;
  projectName: string;
  closeoutPackageId: string;
  closeoutPackageNumber: string;
  linkedPayApplicationId: string;
  linkedRetainageItemId: string;
  linkedCommercialExposureId: string;
  requirementSummary: string;
  owner: string;
  financeOwner: string;
  dueDate: string;
  retainageExposureAmount: number;
  state: CloseoutFinalBillingState;
  assessment?: CloseoutRequirementAssessment;
  evidenceRequirements: CloseoutEvidenceRequirement[];
  evidenceReferences: CloseoutEvidenceReference[];
  review?: CloseoutReleaseReview;
  resolutionNote?: string;
  billingProjection: CloseoutBillingProjection;
  outcomeRecord?: CloseoutFinalBillingOutcomeRecord;
  history: OperatingSliceHistoryEvent[];
  createdAt: string;
  updatedAt: string;
};

export type CloseoutFinalBillingReadiness = {
  assessmentComplete: boolean;
  evidenceComplete: boolean;
  readyForReview: boolean;
  approvedForRelease: boolean;
  resolutionReady: boolean;
  missing: string[];
};

export type CloseoutFinalBillingImpact = {
  openBlockerCount: number;
  resolvedBlockerCount: number;
  retainageAtRisk: number;
  samePrimaryBlockerResolved: boolean;
  billingProjectionStatus: CloseoutBillingProjection["status"];
};

export type CloseoutFinalBillingCommandResult = {
  success: boolean;
  ok?: boolean;
  message: string;
  blocker: CloseoutFinalBillingBlocker;
  readiness?: CloseoutFinalBillingReadiness;
  impact?: CloseoutFinalBillingImpact;
  events?: OperatingSliceHistoryEvent[];
  error?: string;
};
