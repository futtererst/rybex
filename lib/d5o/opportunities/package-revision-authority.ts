import type { BidSubmissionDecisionAuthority, BidSubmissionEvent, OpportunityAction } from "./types";

const completedStatuses = new Set(["submission_approval_held", "submission_approved_ready_to_send"]);
const completedActions = new Set(["approve_submission", "hold_submission_approval"]);

export function resolveBidSubmissionDecisionAuthority(
  opportunity: OpportunityAction,
  events: BidSubmissionEvent[],
): BidSubmissionDecisionAuthority | null {
  if (!completedStatuses.has(opportunity.bidSubmissionStatus)) return null;
  const event = events.find((candidate) => completedActions.has(candidate.bidAction));
  const packageReference = String(opportunity.bidPackageVersion ?? "").trim();
  if (!event
    || !packageReference
    || !Number.isInteger(event.packageVersion)
    || Number(event.packageVersion) < 1
    || event.packageVersion !== opportunity.version
    || event.auditAuthorityReconciled !== true
    || !event.configurationVersionId
    || event.configurationVersionId !== opportunity.bidSubmissionApprovalConfigurationVersionId
    || !event.configurationGateKey
    || event.configurationGateKey !== opportunity.bidSubmissionApprovalGateKey
    || !event.configurationOutcomeKey
    || event.configurationOutcomeKey !== opportunity.bidSubmissionApprovalOutcomeKey
    || event.metadata.configuredOutcomeKey !== event.configurationOutcomeKey
    || event.metadata.bidSubmissionRecorded !== false) return null;
  return {
    packageReference,
    revision: event.packageVersion,
    decisionAt: event.createdAt,
    auditAuthorityReconciled: true,
  };
}
