import type {
  OpportunityAction,
  OpportunityAssignment,
  OpportunityDetail,
  OpportunityEvidence,
  BidSubmissionEvent,
  PursuitAuthorizationEvent,
  OpportunityQualification,
  PricingReviewReadiness,
  PursuitAuthorizationReadiness,
  BidSubmissionApprovalReadiness
} from "./types";
import { resolveBidSubmissionDecisionAuthority } from "./package-revision-authority";

type OpportunityRow = Record<string, unknown>;

export function mapOpportunity(row: OpportunityRow): OpportunityAction {
  return {
    id: String(row.id),
    stableKey: String(row.stable_opportunity_key ?? ""),
    name: String(row.name ?? ""),
    customerGc: String(row.customer_gc ?? row.gc_client ?? ""),
    projectType: String(row.project_type ?? ""),
    location: String(row.opportunity_location ?? row.project_location ?? ""),
    scopeSummary: String(row.scope_summary ?? ""),
    estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? null : Number(row.estimated_value),
    anticipatedStart: row.anticipated_start ? String(row.anticipated_start) : null,
    bidDueDate: row.bid_due_date ? String(row.bid_due_date) : null,
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    lifecycleStatus: (row.lifecycle_status as OpportunityAction["lifecycleStatus"]) ?? "draft",
    intakeComplete: Boolean(row.intake_complete),
    qualificationComplete: Boolean(row.qualification_complete),
    decisionReadinessStatus: (row.decision_readiness_status as OpportunityAction["decisionReadinessStatus"]) ?? "not_ready",
    pursuitAuthorizationStatus: (row.pursuit_authorization_status as OpportunityAction["pursuitAuthorizationStatus"]) ?? "not_started",
    version: Number(row.version ?? 1),
    submittedForDecisionAt: row.submitted_for_decision_at ? String(row.submitted_for_decision_at) : null,
    decisionOwnerUserId: row.decision_owner_user_id ? String(row.decision_owner_user_id) : null,
    decisionDueAt: row.decision_due_at ? String(row.decision_due_at) : null,
    pursuitAuthorityUserId: row.pursuit_authority_user_id ? String(row.pursuit_authority_user_id) : null,
    pursuitAuthorizationDueAt: row.pursuit_authorization_due_at ? String(row.pursuit_authorization_due_at) : null,
    pursuitAuthorizedAt: row.pursuit_authorized_at ? String(row.pursuit_authorized_at) : null,
    pursuitAuthorizedBy: row.pursuit_authorized_by ? String(row.pursuit_authorized_by) : null,
    pursuitAuthorizationReason: row.pursuit_authorization_reason ? String(row.pursuit_authorization_reason) : null,
    bidSubmissionStatus: (row.bid_submission_status as OpportunityAction["bidSubmissionStatus"]) ?? "not_started",
    bidPackageVersion: row.bid_package_version ? String(row.bid_package_version) : null,
    approvedEstimateVersion: row.approved_estimate_version ? String(row.approved_estimate_version) : null,
    bidSubmissionPrice: row.bid_submission_price === null || row.bid_submission_price === undefined ? null : Number(row.bid_submission_price),
    bidPricingValidity: row.bid_pricing_validity ? String(row.bid_pricing_validity) : null,
    bidScheduleCommitment: row.bid_schedule_commitment ? String(row.bid_schedule_commitment) : null,
    bidRecipient: row.bid_recipient ? String(row.bid_recipient) : null,
    bidSubmissionChannel: row.bid_submission_channel ? String(row.bid_submission_channel) : null,
    bidSubmittedAt: row.bid_submitted_at ? String(row.bid_submitted_at) : null,
    bidSubmissionConfirmation: row.bid_submission_confirmation ? String(row.bid_submission_confirmation) : null,
    bidOutcomeReason: row.bid_outcome_reason ? String(row.bid_outcome_reason) : null,
    bidSelectedNotice: row.bid_selected_notice ? String(row.bid_selected_notice) : null,
    submissionApproverUserId: row.submission_approver_user_id ? String(row.submission_approver_user_id) : null,
    bidSubmissionApprovalConfigurationVersionId: row.bid_submission_approval_configuration_version_id ? String(row.bid_submission_approval_configuration_version_id) : null,
    bidSubmissionApprovalGateKey: row.bid_submission_approval_gate_key ? String(row.bid_submission_approval_gate_key) : null,
    bidSubmissionApprovalOutcomeKey: row.bid_submission_approval_outcome_key ? String(row.bid_submission_approval_outcome_key) : null
  };
}

export function mapAssignment(row: OpportunityRow): OpportunityAssignment {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ""),
    assignmentType: (row.assignment_type as OpportunityAssignment["assignmentType"]) ?? "contributor",
    status: String(row.status ?? "active")
  };
}

export function mapQualification(row: OpportunityRow | null | undefined): OpportunityQualification {
  if (!row || Object.keys(row).length === 0) return {};

  return {
    id: row.id ? String(row.id) : undefined,
    status: row.status as OpportunityQualification["status"],
    completenessResult: row.completeness_result as OpportunityQualification["completenessResult"],
    recommendation: row.recommendation as OpportunityQualification["recommendation"],
    riskSummary: row.risk_summary ? String(row.risk_summary) : "",
    assumptions: row.assumptions ? String(row.assumptions) : "",
    version: row.version ? Number(row.version) : undefined,
    criteria: {
      strategicFit: String(row.strategic_fit ?? ""),
      customerRelationship: String(row.customer_relationship ?? ""),
      geographyFit: String(row.geography_fit ?? ""),
      projectTypeFit: String(row.project_type_fit ?? ""),
      scopeClarity: String(row.scope_clarity ?? ""),
      designMaturity: String(row.design_maturity ?? ""),
      commercialTermsRisk: String(row.commercial_terms_risk ?? ""),
      scheduleFeasibility: String(row.schedule_feasibility ?? ""),
      crewCapacityFit: String(row.crew_capacity_fit ?? ""),
      materialLeadTimeRisk: String(row.material_lead_time_risk ?? ""),
      permitsAccessRisk: String(row.permits_access_risk ?? ""),
      safetyQualityComplexity: String(row.safety_quality_complexity ?? ""),
      subcontractorDependency: String(row.subcontractor_dependency ?? ""),
      cashFlowRisk: String(row.cash_flow_risk ?? ""),
      marginConfidence: String(row.margin_confidence ?? ""),
      contractualRisk: String(row.contractual_risk ?? "")
    }
  };
}

export function mapEvidence(row: OpportunityRow): OpportunityEvidence {
  return {
    id: String(row.id ?? ""),
    fileName: String(row.fileName ?? row.file_name ?? ""),
    mimeType: String(row.mimeType ?? row.mime_type ?? ""),
    sizeBytes: row.sizeBytes === null || row.sizeBytes === undefined ? null : Number(row.sizeBytes),
    checksumSha256: String(row.checksumSha256 ?? row.checksum_sha256 ?? ""),
    uploadStatus: String(row.uploadStatus ?? row.upload_status ?? ""),
    scanStatus: String(row.scanStatus ?? row.scan_status ?? ""),
    verificationStatus: String(row.verificationStatus ?? row.verification_status ?? ""),
    relationshipType: String(row.relationshipType ?? row.relationship_type ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? "")
  };
}

export function mapPursuitAuthorizationEvent(row: OpportunityRow): PursuitAuthorizationEvent {
  return {
    id: String(row.id ?? ""),
    eventType: String(row.eventType ?? row.event_type ?? ""),
    decisionAction: (row.decisionAction ?? row.decision_action ?? "system_note") as PursuitAuthorizationEvent["decisionAction"],
    fromStatus: (row.fromStatus ?? row.from_status ?? null) as PursuitAuthorizationEvent["fromStatus"],
    toStatus: (row.toStatus ?? row.to_status ?? null) as PursuitAuthorizationEvent["toStatus"],
    reason: row.reason ? String(row.reason) : null,
    actorUserId: row.actorUserId || row.actor_user_id ? String(row.actorUserId ?? row.actor_user_id) : null,
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    packageVersion: row.packageVersion ?? row.package_version ? Number(row.packageVersion ?? row.package_version) : null
  };
}

function mapBidSubmissionApprovalReadiness(value: unknown): BidSubmissionApprovalReadiness {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const mapRequirement = (entry: unknown) => {
    const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const rawEvidence = item.evidence && typeof item.evidence === "object"
      ? (item.evidence as Record<string, unknown>)
      : null;
    const fileName = rawEvidence ? String(rawEvidence.fileName ?? "").trim() : "";
    const mimeType = rawEvidence ? String(rawEvidence.mimeType ?? "").trim() : "";
    const sizeBytes = rawEvidence ? Number(rawEvidence.sizeBytes) : 0;
    const attachedAt = rawEvidence ? String(rawEvidence.attachedAt ?? "").trim() : "";
    const packageRevision = rawEvidence ? Number(rawEvidence.packageRevision) : 0;
    const bidPackageVersion = rawEvidence ? String(rawEvidence.bidPackageVersion ?? "").trim() : "";
    const evidence = rawEvidence
      && fileName.length > 0
      && mimeType.length > 0
      && Number.isInteger(sizeBytes)
      && sizeBytes > 0
      && attachedAt.length > 0
      && Number.isInteger(packageRevision)
      && packageRevision > 0
      && bidPackageVersion.length > 0
      && rawEvidence.verificationStatus === "accepted"
      ? {
          fileName,
          mimeType,
          sizeBytes,
          verificationStatus: "accepted" as const,
          attachedAt,
          packageRevision,
          bidPackageVersion
        }
      : null;
    return {
      requirementId: String(item.requirementId ?? ""),
      evidenceTypeId: String(item.evidenceTypeId ?? ""),
      evidenceTypeKey: String(item.evidenceTypeKey ?? ""),
      relationshipType: String(item.relationshipType ?? item.evidenceTypeKey ?? ""),
      label: String(item.label ?? "Required evidence"),
      required: item.required !== false,
      blocking: item.blocking !== false,
      satisfied: Boolean(item.satisfied) && evidence !== null,
      evidence
    };
  };
  const evidenceRequirements = Array.isArray(row.evidenceRequirements)
    ? row.evidenceRequirements.map(mapRequirement)
    : [];
  const missingEvidence = Array.isArray(row.missingEvidence)
    ? row.missingEvidence.map(mapRequirement).map((item) => ({ ...item, satisfied: false as const, evidence: null }))
    : evidenceRequirements.filter((item) => item.required && !item.satisfied);
  const accountability = row.submissionApproverAccountability && typeof row.submissionApproverAccountability === "object"
    ? (row.submissionApproverAccountability as Record<string, unknown>)
    : null;
  const permittedOutcomes = Array.isArray(row.permittedOutcomes)
    ? row.permittedOutcomes.map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return {
          outcomeKey: String(item.outcomeKey ?? ""),
          label: String(item.label ?? "Configured outcome"),
          outcomeType: String(item.outcomeType ?? ""),
          mapsToAction: String(item.mapsToAction ?? ""),
          requiresJustification: Boolean(item.requiresJustification),
          requiresMitigation: Boolean(item.requiresMitigation)
        };
      })
    : [];

  return {
    available: Boolean(row.available),
    ready: Boolean(row.ready),
    reason: row.reason ? String(row.reason) : null,
    deficiencies: Array.isArray(row.deficiencies) ? row.deficiencies.map((entry) => String(entry)) : [],
    evidenceRequirements,
    missingEvidence,
    submissionApproverAccountability: accountability
      ? {
          roleKey: String(accountability.roleKey ?? ""),
          label: String(accountability.label ?? "Submission Approver"),
          satisfied: Boolean(accountability.satisfied),
          profileId: accountability.profileId ? String(accountability.profileId) : null,
          name: accountability.name ? String(accountability.name) : null
        }
      : null,
    permittedOutcomes,
    provenanceLabel: row.provenanceLabel ? String(row.provenanceLabel) : null
  };
}

export function mapBidSubmissionEvent(row: OpportunityRow): BidSubmissionEvent {
  return {
    id: String(row.id ?? ""),
    eventType: String(row.eventType ?? row.event_type ?? ""),
    bidAction: (row.bidAction ?? row.bid_action ?? "system_note") as BidSubmissionEvent["bidAction"],
    fromStatus: (row.fromStatus ?? row.from_status ?? null) as BidSubmissionEvent["fromStatus"],
    toStatus: (row.toStatus ?? row.to_status ?? null) as BidSubmissionEvent["toStatus"],
    reason: row.reason ? String(row.reason) : null,
    actorUserId: row.actorUserId || row.actor_user_id ? String(row.actorUserId ?? row.actor_user_id) : null,
    actorProfileId: row.actorProfileId || row.actor_profile_id ? String(row.actorProfileId ?? row.actor_profile_id) : null,
    configurationVersionId: row.configurationVersionId || row.configuration_version_id ? String(row.configurationVersionId ?? row.configuration_version_id) : null,
    configurationGateKey: row.configurationGateKey || row.configuration_gate_key ? String(row.configurationGateKey ?? row.configuration_gate_key) : null,
    configurationOutcomeKey: row.configurationOutcomeKey || row.configuration_outcome_key ? String(row.configurationOutcomeKey ?? row.configuration_outcome_key) : null,
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    packageVersion: row.packageVersion ?? row.package_version ? Number(row.packageVersion ?? row.package_version) : null,
    commandId: row.commandId || row.command_id ? String(row.commandId ?? row.command_id) : null,
    auditAuthorityReconciled: row.auditAuthorityReconciled === true || row.audit_authority_reconciled === true,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {}
  };
}

function mapPersonSummary(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    userId: row.userId ? String(row.userId) : undefined,
    profileId: row.profileId ? String(row.profileId) : undefined,
    name: String(row.name ?? "Assigned user"),
    email: row.email ? String(row.email) : undefined,
    initials: String(row.initials ?? "AU")
  };
}

function mapCapabilities(value: unknown) {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    canSubmitForDecision: Boolean(row.canSubmitForDecision),
    canCompleteEstimatorContribution: Boolean(row.canCompleteEstimatorContribution),
    canApproveDecision: Boolean(row.canApproveDecision),
    canReturnDecision: Boolean(row.canReturnDecision),
    canDeclineDecision: Boolean(row.canDeclineDecision),
    canAttachOpportunityEvidence: Boolean(row.canAttachOpportunityEvidence),
    canEditQualification: Boolean(row.canEditQualification),
    canEditEstimatorContribution: Boolean(row.canEditEstimatorContribution),
    canApprovePursuit: Boolean(row.canApprovePursuit),
    canHoldPursuit: Boolean(row.canHoldPursuit),
    canDeclinePursuit: Boolean(row.canDeclinePursuit),
    canPrepareBidSubmission: Boolean(row.canPrepareBidSubmission),
    canMarkBidPackageReady: Boolean(row.canMarkBidPackageReady),
    canRequestBidEvidence: Boolean(row.canRequestBidEvidence),
    canApproveBidSubmission: Boolean(row.canApproveBidSubmission),
    canHoldBidSubmission: Boolean(row.canHoldBidSubmission),
    canRecordBidSubmission: Boolean(row.canRecordBidSubmission),
    canRecordBidOutcome: Boolean(row.canRecordBidOutcome)
  };
}

function mapPricingReviewReadiness(value: unknown): PricingReviewReadiness {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const evidenceRequirements = Array.isArray(row.evidenceRequirements)
    ? row.evidenceRequirements.map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return {
          evidenceTypeKey: String(item.evidenceTypeKey ?? ""),
          relationshipType: String(item.relationshipType ?? item.evidenceTypeKey ?? ""),
          label: String(item.label ?? "Required evidence"),
          required: item.required !== false,
          blocking: item.blocking !== false,
          satisfied: Boolean(item.satisfied)
        };
      })
    : [];
  const missingEvidence = Array.isArray(row.missingEvidence)
    ? row.missingEvidence.map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return {
          evidenceTypeKey: String(item.evidenceTypeKey ?? ""),
          relationshipType: String(item.relationshipType ?? item.evidenceTypeKey ?? ""),
          label: String(item.label ?? "Required evidence"),
          required: item.required !== false,
          blocking: item.blocking !== false,
          satisfied: Boolean(item.satisfied)
        };
      })
    : evidenceRequirements.filter((item) => item.required && !item.satisfied);
  const accountability = row.decisionOwnerAccountability && typeof row.decisionOwnerAccountability === "object"
    ? (row.decisionOwnerAccountability as Record<string, unknown>)
    : null;

  return {
    available: Boolean(row.available),
    ready: Boolean(row.ready),
    reason: row.reason ? String(row.reason) : null,
    deficiencies: Array.isArray(row.deficiencies) ? row.deficiencies.map((entry) => String(entry)) : [],
    evidenceRequirements,
    missingEvidence,
    decisionOwnerAccountability: accountability
      ? {
          roleKey: String(accountability.roleKey ?? ""),
          label: String(accountability.label ?? "Decision owner"),
          satisfied: Boolean(accountability.satisfied)
        }
      : null,
    provenanceLabel: row.provenanceLabel ? String(row.provenanceLabel) : null
  };
}

function mapRequirementList(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return {
          key: String(item.key ?? item.evidenceTypeKey ?? ""),
          label: String(item.label ?? "Required item"),
          satisfied: Boolean(item.satisfied),
          roleLabel: item.roleLabel ? String(item.roleLabel) : undefined
        };
      })
    : [];
}

function mapPursuitAuthorizationReadiness(value: unknown): PursuitAuthorizationReadiness {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const evidenceRequirements = Array.isArray(row.evidenceRequirements)
    ? row.evidenceRequirements.map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return {
          evidenceTypeKey: String(item.evidenceTypeKey ?? ""),
          relationshipType: String(item.relationshipType ?? item.evidenceTypeKey ?? ""),
          label: String(item.label ?? "Required evidence"),
          required: item.required !== false,
          blocking: item.blocking !== false,
          satisfied: Boolean(item.satisfied)
        };
      })
    : [];
  const missingEvidence = Array.isArray(row.missingEvidence)
    ? row.missingEvidence.map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return {
          evidenceTypeKey: String(item.evidenceTypeKey ?? ""),
          relationshipType: String(item.relationshipType ?? item.evidenceTypeKey ?? ""),
          label: String(item.label ?? "Required evidence"),
          required: item.required !== false,
          blocking: item.blocking !== false,
          satisfied: Boolean(item.satisfied)
        };
      })
    : evidenceRequirements.filter((item) => item.required && !item.satisfied);
  const accountability = row.decisionOwnerAccountability && typeof row.decisionOwnerAccountability === "object"
    ? (row.decisionOwnerAccountability as Record<string, unknown>)
    : null;
  const profitability = row.profitability && typeof row.profitability === "object"
    ? (row.profitability as Record<string, unknown>)
    : null;

  return {
    available: Boolean(row.available),
    ready: Boolean(row.ready),
    reason: row.reason ? String(row.reason) : null,
    deficiencies: Array.isArray(row.deficiencies) ? row.deficiencies.map((entry) => String(entry)) : [],
    entryRequirements: mapRequirementList(row.entryRequirements),
    evidenceRequirements,
    missingEvidence,
    contributionRequirements: mapRequirementList(row.contributionRequirements),
    profitability: profitability
      ? {
          metricKey: String(profitability.metricKey ?? ""),
          label: String(profitability.label ?? "Expected Gross Margin %"),
          displayValue: String(profitability.displayValue ?? "Not available"),
          satisfied: Boolean(profitability.satisfied)
        }
      : null,
    decisionOwnerAccountability: accountability
      ? {
          roleKey: String(accountability.roleKey ?? ""),
          label: String(accountability.label ?? "Decision Owner"),
          satisfied: Boolean(accountability.satisfied)
        }
      : null,
    permittedOutcomes: Array.isArray(row.permittedOutcomes)
      ? row.permittedOutcomes.map((entry) => {
          const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
          return {
            outcomeKey: String(item.outcomeKey ?? ""),
            label: String(item.label ?? "Decision outcome"),
            outcomeType: String(item.outcomeType ?? ""),
            mapsToAction: (item.mapsToAction ?? "approve_pursuit") as PursuitAuthorizationReadiness["permittedOutcomes"][number]["mapsToAction"],
            requiresJustification: Boolean(item.requiresJustification),
            requiresMitigation: Boolean(item.requiresMitigation)
          };
        })
      : [],
    recommendation: (row.recommendation as PursuitAuthorizationReadiness["recommendation"]) ?? "none",
    provenanceLabel: row.provenanceLabel ? String(row.provenanceLabel) : null
  };
}

export function mapDetail(payload: Record<string, unknown>): OpportunityDetail {
  const capabilities = mapCapabilities(payload.capabilities);
  const pricingReviewReadiness = mapPricingReviewReadiness(payload.pricingReviewReadiness);
  const pursuitAuthorizationReadiness = mapPursuitAuthorizationReadiness(payload.pursuitAuthorizationReadiness);
  const bidSubmissionApprovalReadiness = mapBidSubmissionApprovalReadiness(payload.bidSubmissionApprovalReadiness);
  const opportunity = mapOpportunity(payload.opportunity as OpportunityRow);
  const bidSubmissionEvents = Array.isArray(payload.bidSubmissionEvents)
    ? payload.bidSubmissionEvents.map((row) => mapBidSubmissionEvent(row as OpportunityRow))
    : [];
  if (!pricingReviewReadiness.available || !pricingReviewReadiness.ready) {
    capabilities.canSubmitForDecision = false;
  }
  if (!pursuitAuthorizationReadiness.available || !pursuitAuthorizationReadiness.ready) {
    capabilities.canApprovePursuit = false;
    capabilities.canHoldPursuit = false;
    capabilities.canDeclinePursuit = false;
  }
  if (!bidSubmissionApprovalReadiness.available || !bidSubmissionApprovalReadiness.ready) {
    capabilities.canApproveBidSubmission = false;
    capabilities.canHoldBidSubmission = false;
  }

  return {
    opportunity,
    assignments: Array.isArray(payload.assignments) ? payload.assignments.map((row) => mapAssignment(row as OpportunityRow)) : [],
    qualification: mapQualification(payload.qualification as OpportunityRow),
    evidence: Array.isArray(payload.evidence) ? payload.evidence.map((row) => mapEvidence(row as OpportunityRow)) : [],
    evidenceReady: Boolean(payload.evidenceReady),
    pursuitAuthorizationReady: Boolean(payload.pursuitAuthorizationReady),
    pursuitAuthorizationRecommendation: (payload.pursuitAuthorizationRecommendation as OpportunityDetail["pursuitAuthorizationRecommendation"]) ?? "none",
    pursuitAuthorizationState: String(payload.pursuitAuthorizationState ?? ""),
    pursuitAuthorizationEvents: Array.isArray(payload.pursuitAuthorizationEvents)
      ? payload.pursuitAuthorizationEvents.map((row) => mapPursuitAuthorizationEvent(row as OpportunityRow))
      : [],
    bidSubmissionState: String(payload.bidSubmissionState ?? ""),
    bidSubmissionEvents,
    bidSubmissionDecisionAuthority: resolveBidSubmissionDecisionAuthority(opportunity, bidSubmissionEvents),
    bidEvidenceReady: Boolean(payload.bidEvidenceReady),
    bidSubmissionReady: Boolean(payload.bidSubmissionReady),
    bidOutcomeReady: Boolean(payload.bidOutcomeReady),
    workspaceRole: String(payload.workspaceRole ?? ""),
    workspaceAccessRole: String(payload.workspaceAccessRole ?? payload.workspaceRole ?? ""),
    opportunityResponsibility: String(payload.opportunityResponsibility ?? payload.effectiveWorkContext ?? payload.workspaceRole ?? ""),
    effectiveWorkContext: String(payload.effectiveWorkContext ?? payload.workspaceRole ?? ""),
    accessMode: payload.accessMode === "read_only" ? "read_only" : "editable",
    bdOwner: mapPersonSummary(payload.bdOwner),
    decisionOwner: mapPersonSummary(payload.decisionOwner),
    pursuitAuthority: mapPersonSummary(payload.pursuitAuthority),
    submissionApprover: mapPersonSummary(payload.submissionApprover),
    decisionDueAt: payload.decisionDueAt ? String(payload.decisionDueAt) : null,
    capabilities,
    denialReason: payload.denialReason ? String(payload.denialReason) : null,
    pricingReviewReadiness,
    pursuitAuthorizationReadiness,
    bidSubmissionApprovalReadiness
  };
}
