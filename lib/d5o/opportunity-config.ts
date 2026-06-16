import type {
  D5OPhaseId,
  GoNoGoRecommendation,
  OpportunityProjectType,
  OpportunityRiskLevel,
  OpportunityServiceLine,
  OpportunityStatus,
  PursuitDecision
} from "./types";

export type OpportunityStatusConfig = {
  id: OpportunityStatus;
  label: string;
  description: string;
  tone: "success" | "warning" | "critical" | "info" | "neutral" | "blocked";
  d5oPhase: D5OPhaseId;
};

export const opportunityStatuses: OpportunityStatusConfig[] = [
  {
    id: "new_intake",
    label: "New Intake",
    description: "Opportunity received; intake facts and bid package need validation.",
    tone: "info",
    d5oPhase: "discover"
  },
  {
    id: "under_review",
    label: "Under Review",
    description: "Fit, risk, documents, schedule, and commercial posture are being reviewed.",
    tone: "info",
    d5oPhase: "discover"
  },
  {
    id: "awaiting_go_no_go",
    label: "Awaiting Go/No-Go",
    description: "D1 pursuit gate decision is required before estimating resources are committed.",
    tone: "warning",
    d5oPhase: "discover"
  },
  {
    id: "approved_to_bid",
    label: "Approved to Bid",
    description: "Pursuit is approved with required mitigations and review owners assigned.",
    tone: "success",
    d5oPhase: "discover"
  },
  {
    id: "estimating",
    label: "Estimating",
    description: "Estimating is underway after D1 approval and D2 definition work has started.",
    tone: "success",
    d5oPhase: "define"
  },
  {
    id: "submitted",
    label: "Submitted",
    description: "Proposal has been submitted; award, clarifications, or addenda are pending.",
    tone: "neutral",
    d5oPhase: "define"
  },
  {
    id: "won",
    label: "Won",
    description: "Rybex has been selected and project setup should begin.",
    tone: "success",
    d5oPhase: "define"
  },
  {
    id: "lost",
    label: "Lost",
    description: "Opportunity was bid but not awarded to Rybex.",
    tone: "neutral",
    d5oPhase: "optimize"
  },
  {
    id: "declined",
    label: "Declined",
    description: "Opportunity was declined after review due to fit, risk, or capacity.",
    tone: "critical",
    d5oPhase: "discover"
  },
  {
    id: "no_bid",
    label: "No Bid",
    description: "Rybex made a formal no-bid decision and should capture the reason.",
    tone: "blocked",
    d5oPhase: "discover"
  }
];

export const opportunityStatusMap = Object.fromEntries(
  opportunityStatuses.map((status) => [status.id, status])
) as Record<OpportunityStatus, OpportunityStatusConfig>;

export const activePipelineStatuses: OpportunityStatus[] = [
  "new_intake",
  "under_review",
  "awaiting_go_no_go",
  "approved_to_bid",
  "estimating",
  "submitted"
];

export const pipelineBoardStatuses: OpportunityStatus[] = [
  "new_intake",
  "under_review",
  "awaiting_go_no_go",
  "approved_to_bid",
  "estimating",
  "submitted"
];

export const projectTypeLabels: Record<OpportunityProjectType, string> = {
  telecom_carrier: "Telecom Carrier",
  data_center: "Data Center",
  broadband_expansion: "Broadband Expansion",
  long_haul_fiber: "Long-Haul Fiber",
  edge_facility: "Edge Facility",
  utility_civil: "Utility Civil",
  structured_cabling: "Structured Cabling",
  underground_infrastructure: "Underground Infrastructure"
};

export const serviceLineLabels: Record<OpportunityServiceLine, string> = {
  engineering: "Engineering",
  infrastructure: "Infrastructure",
  integration: "Integration",
  civil_support: "Civil Support",
  data_center_support: "Data Center Support",
  structured_cabling: "Structured Cabling",
  fiber_splicing_testing: "Fiber Splicing / Testing"
};

export const recommendationLabels: Record<GoNoGoRecommendation, string> = {
  pursue: "Pursue",
  pursue_with_mitigations: "Pursue with Mitigations",
  hold_for_clarification: "Hold for Clarification",
  decline: "Decline",
  no_bid: "No Bid"
};

export const recommendationTone: Record<GoNoGoRecommendation, string> = {
  pursue: "success",
  pursue_with_mitigations: "warning",
  hold_for_clarification: "blocked",
  decline: "critical",
  no_bid: "critical"
};

export const riskLevelLabels: Record<OpportunityRiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe"
};

export const riskLevelTone: Record<OpportunityRiskLevel, string> = {
  low: "success",
  moderate: "warning",
  high: "critical",
  severe: "blocked"
};

export const decisionLabels: Record<PursuitDecision, string> = {
  pending: "Pending",
  approve_to_bid: "Approve to Bid",
  hold_for_clarification: "Hold for Clarification",
  decline_no_bid: "Decline / No-Bid"
};
