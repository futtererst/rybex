export type OpportunityLifecycleStatus = "draft" | "qualifying" | "decision_required";

export type OpportunityDecisionAction = "approved" | "returned_for_clarification" | "declined";
export type PursuitAuthorizationAction = "approve_pursuit" | "hold_pending_evidence" | "decline_pursuit";
export type PursuitAuthorizationStatus = "not_started" | "ready_for_authorization" | "hold_pending_evidence" | "approved" | "declined";
export type BidSubmissionAction =
  | "mark_package_ready"
  | "request_missing_evidence"
  | "approve_submission"
  | "hold_submission_approval"
  | "record_submission"
  | "record_clarification_request"
  | "record_revision_bafo_request"
  | "record_revised_submission"
  | "record_lost_not_selected"
  | "record_withdrawn_no_submit"
  | "record_selected_handoff";
export type BidSubmissionStatus =
  | "not_started"
  | "submission_preparation"
  | "submission_blocked"
  | "ready_for_submission_approval"
  | "submission_approval_held"
  | "submission_approved_ready_to_send"
  | "submitted_pending_outcome"
  | "clarification_requested"
  | "revision_bafo_required"
  | "revised_submission_recorded"
  | "lost_not_selected"
  | "withdrawn_no_submit"
  | "selected_intent_to_award";

export type OpportunityAssignmentType = "owner" | "contributor" | "estimator";

export type OpportunityAction = {
  id: string;
  stableKey: string;
  name: string;
  customerGc: string;
  projectType: string;
  location: string;
  scopeSummary: string;
  estimatedValue: number | null;
  anticipatedStart: string | null;
  bidDueDate: string | null;
  ownerUserId: string | null;
  lifecycleStatus: OpportunityLifecycleStatus;
  intakeComplete: boolean;
  qualificationComplete: boolean;
  decisionReadinessStatus: "not_ready" | "ready_for_decision" | "decision_approved" | "returned_for_clarification" | "decision_declined";
  pursuitAuthorizationStatus: PursuitAuthorizationStatus;
  version: number;
  submittedForDecisionAt: string | null;
  decisionOwnerUserId?: string | null;
  decisionDueAt?: string | null;
  pursuitAuthorityUserId?: string | null;
  pursuitAuthorizationDueAt?: string | null;
  pursuitAuthorizedAt?: string | null;
  pursuitAuthorizedBy?: string | null;
  pursuitAuthorizationReason?: string | null;
  bidSubmissionStatus: BidSubmissionStatus;
  bidPackageVersion?: string | null;
  approvedEstimateVersion?: string | null;
  bidSubmissionPrice?: number | null;
  bidPricingValidity?: string | null;
  bidScheduleCommitment?: string | null;
  bidRecipient?: string | null;
  bidSubmissionChannel?: string | null;
  bidSubmittedAt?: string | null;
  bidSubmissionConfirmation?: string | null;
  bidOutcomeReason?: string | null;
  bidSelectedNotice?: string | null;
  submissionApproverUserId?: string | null;
  bidSubmissionApprovalConfigurationVersionId?: string | null;
  bidSubmissionApprovalGateKey?: string | null;
  bidSubmissionApprovalOutcomeKey?: string | null;
};

export type OpportunityAssignment = {
  id: string;
  userId: string;
  assignmentType: OpportunityAssignmentType;
  status: string;
};

export type OpportunityQualification = {
  id?: string;
  status?: "in_progress" | "complete";
  completenessResult?: "incomplete" | "complete";
  recommendation?: "pursue" | "pursue_with_mitigations" | "hold_for_clarification" | "decline" | "no_bid";
  riskSummary?: string;
  assumptions?: string;
  version?: number;
  criteria?: Record<string, string>;
};

export type OpportunityEvidence = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  checksumSha256: string;
  uploadStatus: string;
  scanStatus: string;
  verificationStatus: string;
  relationshipType: string;
  createdAt: string;
};

export type PursuitAuthorizationEvent = {
  id: string;
  eventType: string;
  decisionAction: PursuitAuthorizationAction | "system_note";
  fromStatus: PursuitAuthorizationStatus | null;
  toStatus: PursuitAuthorizationStatus | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
  packageVersion: number | null;
};

export type BidSubmissionEvent = {
  id: string;
  eventType: string;
  bidAction: BidSubmissionAction | "system_note";
  fromStatus: BidSubmissionStatus | null;
  toStatus: BidSubmissionStatus | null;
  reason: string | null;
  actorUserId: string | null;
  actorProfileId?: string | null;
  configurationVersionId?: string | null;
  configurationGateKey?: string | null;
  configurationOutcomeKey?: string | null;
  createdAt: string;
  packageVersion: number | null;
  commandId?: string | null;
  auditAuthorityReconciled?: boolean;
  metadata: Record<string, unknown>;
};

export type BidSubmissionDecisionAuthority = {
  packageReference: string;
  revision: number;
  decisionAt: string;
  auditAuthorityReconciled: true;
};

export type BidSubmissionApprovalReadiness = {
  available: boolean;
  ready: boolean;
  reason: string | null;
  deficiencies: string[];
  evidenceRequirements: Array<{
    requirementId: string;
    evidenceTypeId: string;
    evidenceTypeKey: string;
    relationshipType: string;
    label: string;
    required: boolean;
    blocking: boolean;
    satisfied: boolean;
    evidence: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      verificationStatus: "accepted";
      attachedAt: string;
      packageRevision: number;
      bidPackageVersion: string;
    } | null;
  }>;
  missingEvidence: Array<{
    requirementId: string;
    evidenceTypeId: string;
    evidenceTypeKey: string;
    relationshipType: string;
    label: string;
    required: boolean;
    blocking: boolean;
    satisfied: boolean;
    evidence: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      verificationStatus: "accepted";
      attachedAt: string;
      packageRevision: number;
      bidPackageVersion: string;
    } | null;
  }>;
  submissionApproverAccountability: {
    roleKey: string;
    label: string;
    satisfied: boolean;
    profileId?: string | null;
    name?: string | null;
  } | null;
  permittedOutcomes: Array<{
    outcomeKey: string;
    label: string;
    outcomeType: string;
    mapsToAction: string;
    requiresJustification: boolean;
    requiresMitigation: boolean;
  }>;
  provenanceLabel: string | null;
};

export type OpportunityPersonSummary = {
  userId?: string;
  profileId?: string;
  name: string;
  email?: string;
  initials: string;
};

export type OpportunityCapabilities = {
  canSubmitForDecision: boolean;
  canCompleteEstimatorContribution: boolean;
  canApproveDecision: boolean;
  canReturnDecision: boolean;
  canDeclineDecision: boolean;
  canAttachOpportunityEvidence: boolean;
  canEditQualification: boolean;
  canEditEstimatorContribution: boolean;
  canApprovePursuit: boolean;
  canHoldPursuit: boolean;
  canDeclinePursuit: boolean;
  canPrepareBidSubmission: boolean;
  canMarkBidPackageReady: boolean;
  canRequestBidEvidence: boolean;
  canApproveBidSubmission: boolean;
  canHoldBidSubmission: boolean;
  canRecordBidSubmission: boolean;
  canRecordBidOutcome: boolean;
};

export type PricingReviewEvidenceRequirement = {
  evidenceTypeKey: string;
  relationshipType: string;
  label: string;
  required: boolean;
  blocking: boolean;
  satisfied: boolean;
};

export type PricingReviewDecisionOwnerAccountability = {
  roleKey: string;
  label: string;
  satisfied: boolean;
};

export type PricingReviewReadiness = {
  available: boolean;
  ready: boolean;
  reason: string | null;
  deficiencies: string[];
  evidenceRequirements: PricingReviewEvidenceRequirement[];
  missingEvidence: PricingReviewEvidenceRequirement[];
  decisionOwnerAccountability: PricingReviewDecisionOwnerAccountability | null;
  provenanceLabel: string | null;
};

export type PursuitAuthorizationRequirement = {
  key: string;
  label: string;
  satisfied: boolean;
  roleLabel?: string;
};

export type PursuitAuthorizationEvidenceRequirement = PricingReviewEvidenceRequirement;

export type PursuitAuthorizationOutcome = {
  outcomeKey: string;
  label: string;
  outcomeType: string;
  mapsToAction: PursuitAuthorizationAction;
  requiresJustification: boolean;
  requiresMitigation: boolean;
};

export type PursuitAuthorizationReadiness = {
  available: boolean;
  ready: boolean;
  reason: string | null;
  deficiencies: string[];
  entryRequirements: PursuitAuthorizationRequirement[];
  evidenceRequirements: PursuitAuthorizationEvidenceRequirement[];
  missingEvidence: PursuitAuthorizationEvidenceRequirement[];
  contributionRequirements: PursuitAuthorizationRequirement[];
  profitability: {
    metricKey: string;
    label: string;
    displayValue: string;
    satisfied: boolean;
  } | null;
  decisionOwnerAccountability: PricingReviewDecisionOwnerAccountability | null;
  permittedOutcomes: PursuitAuthorizationOutcome[];
  recommendation: "approve" | "hold" | "decline" | "none";
  provenanceLabel: string | null;
};

export type OpportunityDetail = {
  opportunity: OpportunityAction;
  assignments: OpportunityAssignment[];
  qualification: OpportunityQualification;
  evidence: OpportunityEvidence[];
  evidenceReady: boolean;
  pursuitAuthorizationReady: boolean;
  pursuitAuthorizationRecommendation: "approve" | "hold" | "decline" | "none";
  pursuitAuthorizationState: string;
  pursuitAuthorizationEvents: PursuitAuthorizationEvent[];
  bidSubmissionState: string;
  bidSubmissionEvents: BidSubmissionEvent[];
  bidSubmissionDecisionAuthority?: BidSubmissionDecisionAuthority | null;
  bidEvidenceReady: boolean;
  bidSubmissionReady: boolean;
  bidOutcomeReady: boolean;
  workspaceRole: string;
  workspaceAccessRole: string;
  opportunityResponsibility: string;
  effectiveWorkContext: string;
  accessMode: "editable" | "read_only";
  bdOwner: OpportunityPersonSummary | null;
  decisionOwner: OpportunityPersonSummary | null;
  pursuitAuthority: OpportunityPersonSummary | null;
  submissionApprover: OpportunityPersonSummary | null;
  decisionDueAt: string | null;
  capabilities: OpportunityCapabilities;
  denialReason: string | null;
  pricingReviewReadiness: PricingReviewReadiness;
  pursuitAuthorizationReadiness: PursuitAuthorizationReadiness;
  bidSubmissionApprovalReadiness: BidSubmissionApprovalReadiness;
};

export type OpportunityCommandResult =
  | {
      success: true;
      opportunity?: unknown;
      assignments?: unknown;
      qualification?: unknown;
      replayed?: boolean;
    }
  | {
      success: false;
      error: string;
      message?: string;
      duplicateCount?: number;
      duplicateCandidates?: DuplicateCandidate[];
      currentVersion?: number;
    };

export type DuplicateCandidate = {
  id: string;
  stableKey: string;
  name: string;
  customerGc: string;
  location: string;
  lifecycleStatus: OpportunityLifecycleStatus;
};

export type CreateOpportunityInput = {
  name: string;
  customerGc: string;
  projectType: string;
  location: string;
  scopeSummary: string;
  estimatedValue?: string;
  anticipatedStart?: string;
  bidDueDate?: string;
  ownerUserId?: string;
  duplicateConfirmed?: boolean;
  duplicateCandidateId?: string;
};

export type AttachDecisionSupportEvidenceInput = {
  evidenceId?: string;
  expectedEvidenceVersion?: number;
  /** Legacy inputs remain representable for preserved callers, but the RPC rejects metadata-only requests. */
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
};

export type AttachBidApprovalEvidenceInput = AttachDecisionSupportEvidenceInput & {
  relationshipType: string;
};

export type DecisionAccountabilityInput = {
  decisionOwnerUserId: string;
  decisionDueAt: string;
};

export type DecisionActionInput = {
  action: OpportunityDecisionAction;
  reason?: string;
};

export type PursuitAuthorizationInput = {
  action: PursuitAuthorizationAction;
  reason?: string;
};

export type BidSubmissionInput = {
  action: BidSubmissionAction;
  reason?: string;
  recipient?: string;
  channel?: string;
  confirmation?: string;
};

export type BidSubmissionApprovalInput = {
  outcomeKey: string;
  reason?: string;
};

export type DecisionOwnerOption = OpportunityPersonSummary & {
  membershipId?: string;
  role: string;
};

export type QualificationInput = {
  strategicFit: string;
  customerRelationship: string;
  geographyFit: string;
  projectTypeFit: string;
  scopeClarity: string;
  designMaturity: string;
  commercialTermsRisk: string;
  scheduleFeasibility: string;
  crewCapacityFit: string;
  materialLeadTimeRisk: string;
  permitsAccessRisk: string;
  safetyQualityComplexity: string;
  subcontractorDependency: string;
  cashFlowRisk: string;
  marginConfidence: string;
  contractualRisk: string;
  riskSummary: string;
  assumptions: string;
  recommendation: string;
};
