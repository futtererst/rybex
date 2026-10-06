"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult = { data: unknown; error: { message: string } | null };
export type DuplicateReviewItem = {
  workId: string; title: string; customerContext: string | null; siteContext: string | null;
  recordVersion: number; reviewedVersion: number | null;
};
export type DuplicateReviewQueue =
  | { status: "ok"; items: DuplicateReviewItem[] }
  | { status: "denied" | "unavailable" };
export type DuplicateReviewContext = {
  workId: string; title: string; recordVersion: number;
  customerContext: string | null; siteContext: string | null;
  needSummary: string | null; workType: string | null;
  accountId: string; siteId: string; candidateIds: string[];
  legacyHold: boolean; tooManyCandidates: boolean; selfReview: boolean; reviewedVersion: number | null;
  reviewReason: string | null; reviewedCandidateIds: string[] | null; reviewedAt: string | null;
  candidates: (Pick<DuplicateReviewItem, "workId" | "recordVersion" | "title" | "customerContext" | "siteContext">
    & { needSummary: string | null; workType: string | null; accountId: string; siteId: string })[];
};
export type DuplicateReviewContextResult =
  | { status: "ok"; value: DuplicateReviewContext }
  | { status: "denied" | "unavailable" };
export type DuplicateDecisionResult =
  | { status: "saved"; workId: string; recordVersion: number; replayed: boolean }
  | { status: "denied" | "conflict" | "invalid" | "unavailable"; message: string }
  | { status: "unknown_outcome"; retrySameCommand: true };

async function permitted(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}
async function rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const client = await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as
    (rpcName: string, rpcArgs: Record<string, unknown>) => Promise<RpcResult>)(name, args);
}
function denied(message: string) {
  return /forbidden|unauthenticated|employee_verification_required|duplicate_permission_denied|separation_of_duties/.test(message);
}
function validItem(item: unknown): item is DuplicateReviewItem {
  const x = item as Partial<DuplicateReviewItem> | null;
  return !!x && uuid.test(x.workId ?? "") && typeof x.title === "string"
    && (x.customerContext === null || typeof x.customerContext === "string")
    && (x.siteContext === null || typeof x.siteContext === "string")
    && Number.isInteger(x.recordVersion)
    && (x.reviewedVersion === null || Number.isInteger(x.reviewedVersion));
}
function validComparisonDetails(value: unknown): boolean {
  const x = value as { needSummary?: unknown; workType?: unknown } | null;
  return !!x && (x.needSummary === null || typeof x.needSummary === "string")
    && (x.workType === null || typeof x.workType === "string");
}

export async function listDiscoverDuplicateReviews(workspaceId: string): Promise<DuplicateReviewQueue> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !(await permitted(workspaceId))) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_list_discover_duplicate_review_v1", { p_workspace_id: workspaceId });
    if (error) return { status: denied(error.message) ? "denied" : "unavailable" };
    const value = data as { items?: unknown } | null;
    if (!Array.isArray(value?.items) || value.items.length > 50 || !value.items.every(validItem))
      return { status: "unavailable" };
    return { status: "ok", items: value.items };
  } catch { return { status: "unavailable" }; }
}

export async function loadDiscoverDuplicateReview(workspaceId: string, workId: string): Promise<DuplicateReviewContextResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId) || !(await permitted(workspaceId))) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_discover_duplicate_review_context_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return { status: denied(error.message) ? "denied" : "unavailable" };
    const x = data as Partial<DuplicateReviewContext> | null;
    if (!x || x.workId !== workId || typeof x.title !== "string" || !Number.isInteger(x.recordVersion)
      || (x.customerContext !== null && typeof x.customerContext !== "string")
      || (x.siteContext !== null && typeof x.siteContext !== "string")
      || !validComparisonDetails(x)
      || !uuid.test(x.accountId ?? "") || !uuid.test(x.siteId ?? "")
      || !Array.isArray(x.candidateIds) || !x.candidateIds.every(id => uuid.test(id))
      || typeof x.legacyHold !== "boolean" || typeof x.tooManyCandidates !== "boolean"
      || typeof x.selfReview !== "boolean"
      || (x.reviewedVersion !== null && !Number.isInteger(x.reviewedVersion))
      || (x.reviewReason !== null && typeof x.reviewReason !== "string")
      || (x.reviewedCandidateIds !== null && (!Array.isArray(x.reviewedCandidateIds)
        || !x.reviewedCandidateIds.every(id => uuid.test(id))))
      || (x.reviewedAt !== null && typeof x.reviewedAt !== "string")
      || !Array.isArray(x.candidates)
      || !x.candidates.every(candidate => validItem({ ...candidate, reviewedVersion: null })
        && validComparisonDetails(candidate) && uuid.test(candidate.accountId)
        && uuid.test(candidate.siteId)))
      return { status: "unavailable" };
    return { status: "ok", value: x as DuplicateReviewContext };
  } catch { return { status: "unavailable" }; }
}

export async function decideDiscoverDistinct(input: {
  workspaceId: string; workId: string; expectedVersion: number; commandId: string;
  comparedWorkIds: string[]; reason: string;
}): Promise<DuplicateDecisionResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200
    || !Array.isArray(input.comparedWorkIds) || input.comparedWorkIds.length > 20
    || !input.comparedWorkIds.every(id => typeof id === "string" && uuid.test(id))
    || typeof input.reason !== "string" || input.reason.trim().length < 20 || input.reason.trim().length > 1000)
    return { status: "invalid", message: "Review every current candidate and give a reason of 20–1000 characters." };
  if (!(await permitted(input.workspaceId))) return { status: "denied", message: "This review is not available to your current identity." };
  try {
    const { data, error } = await rpc("d5o_review_discover_distinct_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_expected_version: input.expectedVersion, p_command_id: input.commandId,
      p_compared_work_ids: input.comparedWorkIds, p_reason: input.reason.trim(),
    });
    if (error) {
      if (denied(error.message)) return { status: "denied", message: "A separate authorized reviewer is required." };
      if (/concurrency_conflict|candidate_set_changed|idempotency_mismatch|command_in_progress/.test(error.message))
        return { status: "conflict", message: "The Work version or candidate set changed. Reopen the review before deciding." };
      if (/review_not_eligible|legacy_match_requires_source_review|too_many_candidates/.test(error.message))
        return { status: "conflict", message: "This draft needs another scoped review before a distinct ruling can be recorded." };
      if (/invalid_command/.test(error.message)) return { status: "invalid", message: "Review the reason and compared candidates." };
      return { status: "unknown_outcome", retrySameCommand: true };
    }
    const receipt = data as { success?: boolean; workId?: string; recordVersion?: number;
      disposition?: string; events?: { audit?: string; event?: string }; replayed?: boolean } | null;
    if (receipt?.success !== true || receipt.workId !== input.workId || receipt.disposition !== "distinct"
      || !Number.isInteger(receipt.recordVersion) || !receipt.events?.audit || !receipt.events.event)
      return { status: "unknown_outcome", retrySameCommand: true };
    return { status: "saved", workId: input.workId, recordVersion: receipt.recordVersion as number,
      replayed: receipt.replayed === true };
  } catch { return { status: "unknown_outcome", retrySameCommand: true }; }
}

export async function decideDiscoverSameWork(input: {
  workspaceId: string; workId: string; retainedWorkId: string;
  expectedVersion: number; expectedRetainedVersion: number;
  commandId: string; candidateWorkIds: string[]; reason: string;
}): Promise<DuplicateDecisionResult & { retainedWorkId?: string }> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.retainedWorkId) || input.retainedWorkId === input.workId
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
    || !Number.isInteger(input.expectedRetainedVersion) || input.expectedRetainedVersion < 1
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200
    || !Array.isArray(input.candidateWorkIds) || input.candidateWorkIds.length > 20
    || !input.candidateWorkIds.every(id => typeof id === "string" && uuid.test(id))
    || !input.candidateWorkIds.includes(input.retainedWorkId)
    || typeof input.reason !== "string" || input.reason.trim().length < 20 || input.reason.trim().length > 1000)
    return { status: "invalid", message: "Select the retained Work and give a reason of 20–1000 characters." };
  if (!(await permitted(input.workspaceId))) return { status: "denied", message: "This review is not available to your current identity." };
  try {
    const { data, error } = await rpc("d5o_review_discover_same_work_v1", {
      p_workspace_id: input.workspaceId, p_duplicate_work_id: input.workId,
      p_retained_work_id: input.retainedWorkId,
      p_expected_duplicate_version: input.expectedVersion,
      p_expected_retained_version: input.expectedRetainedVersion,
      p_command_id: input.commandId, p_candidate_work_ids: input.candidateWorkIds,
      p_reason: input.reason.trim(),
    });
    if (error) {
      if (denied(error.message)) return { status: "denied", message: "A separate authorized reviewer is required." };
      if (/concurrency_conflict|candidate_set_changed|idempotency_mismatch|command_in_progress/.test(error.message))
        return { status: "conflict", message: "The Work version or candidate set changed. Reopen the review before deciding." };
      if (/review_not_eligible|legacy_match_requires_source_review|too_many_candidates|lifecycle_policy_unavailable/.test(error.message))
        return { status: "conflict", message: "This draft needs another scoped review before it can be closed as same work." };
      if (/invalid_command/.test(error.message)) return { status: "invalid", message: "Review the retained Work and reason." };
      return { status: "unknown_outcome", retrySameCommand: true };
    }
    const receipt = data as { success?: boolean; workId?: string; retainedWorkId?: string;
      recordVersion?: number; disposition?: string; events?: { audit?: string; event?: string }; replayed?: boolean } | null;
    if (receipt?.success !== true || receipt.workId !== input.workId
      || receipt.retainedWorkId !== input.retainedWorkId || receipt.disposition !== "same_work"
      || !Number.isInteger(receipt.recordVersion) || !receipt.events?.audit || !receipt.events.event)
      return { status: "unknown_outcome", retrySameCommand: true };
    return { status: "saved", workId: input.workId, retainedWorkId: input.retainedWorkId,
      recordVersion: receipt.recordVersion as number, replayed: receipt.replayed === true };
  } catch { return { status: "unknown_outcome", retrySameCommand: true }; }
}
