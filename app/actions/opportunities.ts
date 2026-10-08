"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  attachBidApprovalEvidence,
  attachDecisionSupportEvidence,
  completePursuitContribution,
  createOpportunity,
  listDecisionOwnerOptions,
  recordDecisionAction,
  recordBidSubmissionAction,
  recordConfiguredBidSubmissionApproval,
  recordPursuitAuthorization,
  saveQualification,
  setDecisionAccountability,
  setSubmissionApprover,
  setPursuitAuthority,
  submitForDecision,
  updateOpportunity
} from "@/lib/d5o/opportunities/supabase-repository";
import { stageOpportunityEvidence } from "@/lib/d5o/opportunities/evidence-custody-service";
import { qualificationFromForm } from "@/lib/d5o/opportunities/qualification";
import type { BidSubmissionAction, CreateOpportunityInput, DuplicateCandidate, OpportunityDecisionAction, PursuitAuthorizationAction } from "@/lib/d5o/opportunities/types";

export async function createOpportunityAction(formData: FormData) {
  const input: CreateOpportunityInput = {
    name: String(formData.get("name") ?? ""),
    customerGc: String(formData.get("customerGc") ?? ""),
    projectType: String(formData.get("projectType") ?? ""),
    location: String(formData.get("location") ?? ""),
    scopeSummary: String(formData.get("scopeSummary") ?? ""),
    estimatedValue: String(formData.get("estimatedValue") ?? ""),
    anticipatedStart: String(formData.get("anticipatedStart") ?? ""),
    bidDueDate: String(formData.get("bidDueDate") ?? ""),
    duplicateConfirmed: formData.get("duplicateConfirmed") === "on",
    duplicateCandidateId: String(formData.get("duplicateCandidateId") ?? "")
  };

  const result = await createOpportunity(input, randomUUID());
  if ("error" in result) {
    if (result.error === "duplicate_warning_requires_confirmation") {
      redirect(`/pipeline/new?${buildDuplicateReviewQuery(input, result.duplicateCandidates)}`);
    }
    const reason = result.error === "duplicate_detected" ? "duplicate" : "failed";
    redirect(`/pipeline/new?error=${reason}`);
  }

  revalidatePath("/pipeline");
  redirect(`/pipeline/${result.opportunity.id}`);
}

export async function saveOpportunityIntakeAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const input: CreateOpportunityInput = {
    name: String(formData.get("name") ?? ""),
    customerGc: String(formData.get("customerGc") ?? ""),
    projectType: String(formData.get("projectType") ?? ""),
    location: String(formData.get("location") ?? ""),
    scopeSummary: String(formData.get("scopeSummary") ?? ""),
    estimatedValue: String(formData.get("estimatedValue") ?? ""),
    anticipatedStart: String(formData.get("anticipatedStart") ?? ""),
    bidDueDate: String(formData.get("bidDueDate") ?? "")
  };

  const result = await updateOpportunity(opportunityId, input, expectedVersion, randomUUID());
  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function saveOpportunityQualificationAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const result = await saveQualification(
    opportunityId,
    qualificationFromForm(formData),
    expectedVersion,
    randomUUID()
  );

  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function attachOpportunityDecisionSupportEvidenceAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const file = formData.get("decisionSupportDocument") as
    | (File & { arrayBuffer: () => Promise<ArrayBuffer>; name: string; type: string; size: number })
    | null;
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    redirect(`/pipeline/${opportunityId}?error=evidence_file_required`);
  }

  const staged = await stageOpportunityEvidence(opportunityId, expectedVersion, "decision_support", "qualification_decision_support", file);
  if (!staged.success) redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(staged.error)}`);
  const result = await attachDecisionSupportEvidence(opportunityId, {
    evidenceId: staged.evidenceId, expectedEvidenceVersion: staged.expectedEvidenceVersion
  }, expectedVersion, randomUUID());

  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function attachOpportunityBidApprovalEvidenceAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const file = formData.get("bidApprovalEvidenceDocument") as
    | (File & { arrayBuffer: () => Promise<ArrayBuffer>; name: string; type: string; size: number })
    | null;
  const relationshipType = String(formData.get("relationshipType") ?? "");
  if (!relationshipType) {
    redirect(`/pipeline/${opportunityId}?error=bid_evidence_requirement_required`);
  }
  if (!file || typeof file.arrayBuffer !== "function") redirect(`/pipeline/${opportunityId}?error=bid_evidence_file_required`);
  const staged = await stageOpportunityEvidence(opportunityId, expectedVersion, "bid_approval", relationshipType, file);
  if (!staged.success) redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(staged.error)}`);
  const result = await attachBidApprovalEvidence(opportunityId, {
    relationshipType, evidenceId: staged.evidenceId, expectedEvidenceVersion: staged.expectedEvidenceVersion
  }, expectedVersion, randomUUID());

  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function setOpportunityDecisionAccountabilityAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const result = await setDecisionAccountability(
    opportunityId,
    {
      decisionOwnerUserId: String(formData.get("decisionOwnerUserId") ?? ""),
      decisionDueAt: String(formData.get("decisionDueAt") ?? "")
    },
    expectedVersion,
    randomUUID()
  );

  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function submitOpportunityForDecisionAction(opportunityId: string, expectedVersion: number) {
  const result = await submitForDecision(opportunityId, expectedVersion, randomUUID());

  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function recordOpportunityDecisionAction(opportunityId: string, expectedVersion: number, action: OpportunityDecisionAction, formData: FormData) {
  const result = await recordDecisionAction(
    opportunityId,
    {
      action,
      reason: String(formData.get("decisionReason") ?? "")
    },
    expectedVersion,
    randomUUID()
  );

  if ("error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result.error))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function recordOpportunityPursuitAuthorizationAction(opportunityId: string, expectedVersion: number, action: PursuitAuthorizationAction, formData: FormData) {
  const result = await recordPursuitAuthorization(
    opportunityId,
    {
      action,
      reason: String(formData.get("pursuitReason") ?? "")
    },
    expectedVersion,
    randomUUID()
  );

  if ("error" in result) {
    const error = String(result.error);
    const mode = error === "concurrency_conflict"
      ? "stale-conflict"
      : error === "forbidden" || error === "pursuit_authority_required"
        ? "unavailable"
        : "action-failure";
    redirect(`/pipeline/${opportunityId}?pursuitState=${mode}&error=${encodeURIComponent(error)}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function recordOpportunityPursuitAuthorizationSelectedAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const action = String(formData.get("pursuitAction") ?? "") as PursuitAuthorizationAction;
  if (!["approve_pursuit", "hold_pending_evidence", "decline_pursuit"].includes(action)) {
    redirect(`/pipeline/${opportunityId}?pursuitState=action-failure&error=invalid_action`);
  }
  return recordOpportunityPursuitAuthorizationAction(opportunityId, expectedVersion, action, formData);
}

export async function completeOpportunityPursuitContributionAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const contributorUserId = String(formData.get("contributorUserId") ?? "");
  const result = await completePursuitContribution(opportunityId, contributorUserId, expectedVersion);
  if (!result || "error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result?.error ?? "persistence_failed"))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function setOpportunityPursuitAuthorityAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const pursuitAuthorityUserId = String(formData.get("pursuitAuthorityUserId") ?? "");
  const result = await setPursuitAuthority(opportunityId, pursuitAuthorityUserId, expectedVersion);
  if (!result || "error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result?.error ?? "persistence_failed"))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function assignOpportunityPursuitAuthorityAction(opportunityId: string, expectedVersion: number, pursuitAuthorityUserId: string) {
  const result = await setPursuitAuthority(opportunityId, pursuitAuthorityUserId, expectedVersion);
  if (!result || "error" in result) {
    redirect(`/pipeline/${opportunityId}?error=${encodeURIComponent(String(result?.error ?? "persistence_failed"))}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function recordOpportunityBidSubmissionAction(opportunityId: string, expectedVersion: number, action: BidSubmissionAction, formData: FormData) {
  const result = await recordBidSubmissionAction(
    opportunityId,
    {
      action,
      reason: String(formData.get("bidReason") ?? ""),
      recipient: String(formData.get("bidRecipient") ?? ""),
      channel: String(formData.get("bidChannel") ?? ""),
      confirmation: String(formData.get("bidConfirmation") ?? "")
    },
    expectedVersion,
    randomUUID()
  );

  if ("error" in result) {
    const error = String(result.error);
    const mode = error === "concurrency_conflict"
      ? "stale-conflict"
      : error === "forbidden" || error === "bid_submission_authority_required"
        ? "unavailable"
        : "action-failure";
    redirect(`/pipeline/${opportunityId}?bidState=${mode}&error=${encodeURIComponent(error)}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function assignOpportunitySubmissionApproverAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const profileId = String(formData.get("submissionApproverProfileId") ?? "");
  const result = await setSubmissionApprover(opportunityId, profileId, expectedVersion, randomUUID());

  if (!result || "error" in result) {
    const error = String(result?.error ?? "persistence_failed");
    redirect(`/pipeline/${opportunityId}?bidState=invalid-submission-approver&error=${encodeURIComponent(error)}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

export async function recordConfiguredBidSubmissionApprovalAction(opportunityId: string, expectedVersion: number, formData: FormData) {
  const result = await recordConfiguredBidSubmissionApproval(
    opportunityId,
    {
      outcomeKey: String(formData.get("bidApprovalOutcomeKey") ?? ""),
      reason: String(formData.get("bidApprovalReason") ?? "")
    },
    expectedVersion,
    randomUUID()
  );

  if ("error" in result) {
    const error = String(result.error);
    const mode = error === "concurrency_conflict"
      ? "stale-conflict"
      : error === "configuration_unavailable"
        ? "unavailable"
        : "action-failure";
    redirect(`/pipeline/${opportunityId}?bidState=${mode}&error=${encodeURIComponent(error)}`);
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  redirect(`/pipeline/${opportunityId}`);
}

function buildDuplicateReviewQuery(input: CreateOpportunityInput, candidates: unknown) {
  const params = new URLSearchParams();
  params.set("duplicate", "1");
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === false) continue;
    params.set(key, String(value));
  }

  const firstCandidate = Array.isArray(candidates) ? (candidates[0] as Partial<DuplicateCandidate>) : null;
  if (firstCandidate) {
    params.set("candidateId", String(firstCandidate.id ?? ""));
    params.set("candidateStableKey", String(firstCandidate.stableKey ?? ""));
    params.set("candidateName", String(firstCandidate.name ?? ""));
    params.set("candidateCustomerGc", String(firstCandidate.customerGc ?? ""));
    params.set("candidateLocation", String(firstCandidate.location ?? ""));
    params.set("candidateLifecycleStatus", String(firstCandidate.lifecycleStatus ?? ""));
  }

  return params.toString();
}
