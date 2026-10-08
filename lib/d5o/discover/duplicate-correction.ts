"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult = { data: unknown; error: { message: string } | null };
export type CorrectionCandidate = {
  workId: string; recordVersion: number; title: string;
  customerContext: string | null; siteContext: string | null; needSummary: string | null;
  accountId: string; siteId: string; lifecycleState: string; eligibleRetained: boolean;
};
export type CorrectionContext = {
  workId: string; title: string; recordVersion: number;
  customerContext: string | null; siteContext: string | null; needSummary: string | null;
  accountId: string; siteId: string; priorReviewedVersion: number; priorReason: string;
  returnedSubmissionCount: number;
  candidateIds: string[]; tooManyCandidates: boolean; candidates: CorrectionCandidate[];
};
export type CorrectionContextResult =
  | { status: "ok"; value: CorrectionContext }
  | { status: "denied" | "unavailable" };
export type CorrectionResult =
  | { status: "saved"; workId: string; retainedWorkId: string; recordVersion: number; replayed: boolean }
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
  return /forbidden|unauthenticated|employee_verification_required|correction_permission_denied|correction_permission_unavailable|separation_of_duties/.test(message);
}
function validCandidate(value: unknown): value is CorrectionCandidate {
  const x = value as Partial<CorrectionCandidate> | null;
  return !!x && uuid.test(x.workId ?? "") && Number.isInteger(x.recordVersion)
    && typeof x.title === "string" && (x.customerContext === null || typeof x.customerContext === "string")
    && (x.siteContext === null || typeof x.siteContext === "string")
    && (x.needSummary === null || typeof x.needSummary === "string")
    && uuid.test(x.accountId ?? "") && uuid.test(x.siteId ?? "")
    && typeof x.lifecycleState === "string" && typeof x.eligibleRetained === "boolean";
}

export async function loadDiscoverDuplicateCorrection(workspaceId: string, workId: string): Promise<CorrectionContextResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "denied" };
  if (!(await permitted(workspaceId))) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_discover_duplicate_correction_context_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return { status: denied(error.message) ? "denied" : "unavailable" };
    const x = data as Partial<CorrectionContext> | null;
    if (!x || x.workId !== workId || typeof x.title !== "string" || !Number.isInteger(x.recordVersion)
      || (x.customerContext !== null && typeof x.customerContext !== "string")
      || (x.siteContext !== null && typeof x.siteContext !== "string")
      || (x.needSummary !== null && typeof x.needSummary !== "string")
      || !uuid.test(x.accountId ?? "") || !uuid.test(x.siteId ?? "")
      || !Number.isInteger(x.priorReviewedVersion) || typeof x.priorReason !== "string"
      || !Number.isInteger(x.returnedSubmissionCount) || (x.returnedSubmissionCount ?? -1) < 0
      || !Array.isArray(x.candidateIds) || !x.candidateIds.every(id => uuid.test(id))
      || typeof x.tooManyCandidates !== "boolean"
      || !Array.isArray(x.candidates) || !x.candidates.every(validCandidate))
      return { status: "unavailable" };
    return { status: "ok", value: x as CorrectionContext };
  } catch { return { status: "unavailable" }; }
}

export async function correctDiscoverSameWork(input: {
  workspaceId: string; workId: string; retainedWorkId: string;
  expectedVersion: number; expectedRetainedVersion: number; expectedPriorReviewVersion: number;
  commandId: string; candidateWorkIds: string[]; reason: string;
}): Promise<CorrectionResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.retainedWorkId) || input.workId === input.retainedWorkId
    || !Number.isInteger(input.expectedVersion) || !Number.isInteger(input.expectedRetainedVersion)
    || !Number.isInteger(input.expectedPriorReviewVersion)
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200
    || !Array.isArray(input.candidateWorkIds) || input.candidateWorkIds.length > 20
    || !input.candidateWorkIds.every(id => uuid.test(id))
    || typeof input.reason !== "string" || input.reason.trim().length < 20 || input.reason.trim().length > 1000)
    return { status: "invalid", message: "Select one eligible retained Work and explain the correction in 20–1000 characters." };
  if (!(await permitted(input.workspaceId))) return { status: "denied", message: "Correction is unavailable to this identity." };
  try {
    const { data, error } = await rpc("d5o_correct_discover_same_work_v1", {
      p_workspace_id: input.workspaceId, p_duplicate_work_id: input.workId,
      p_retained_work_id: input.retainedWorkId,
      p_expected_duplicate_version: input.expectedVersion,
      p_expected_retained_version: input.expectedRetainedVersion,
      p_expected_prior_review_version: input.expectedPriorReviewVersion,
      p_command_id: input.commandId, p_candidate_work_ids: input.candidateWorkIds,
      p_reason: input.reason.trim(),
    });
    if (error) {
      if (denied(error.message)) return { status: "denied", message: "A separate verified reviewer with an explicit correction grant is required." };
      if (/concurrency_conflict|candidate_set_changed|idempotency_mismatch|command_in_progress/.test(error.message))
        return { status: "conflict", message: "The Work, earlier ruling, or candidates changed. Reopen the correction before deciding." };
      if (/correction_not_eligible|legacy_match_requires_source_review|too_many_candidates|lifecycle_policy_unavailable/.test(error.message))
        return { status: "conflict", message: "This Work has an unresolved lifecycle or source condition. The correction was not recorded." };
      if (/invalid_command/.test(error.message)) return { status: "invalid", message: "Review the retained Work and correction reason." };
      return { status: "unknown_outcome", retrySameCommand: true };
    }
    const receipt = data as { success?: boolean; disposition?: string; workId?: string;
      retainedWorkId?: string; recordVersion?: number; events?: { audit?: string; event?: string }; replayed?: boolean } | null;
    if (receipt?.success !== true || receipt.disposition !== "corrected_same_work"
      || receipt.workId !== input.workId || receipt.retainedWorkId !== input.retainedWorkId
      || !Number.isInteger(receipt.recordVersion) || !receipt.events?.audit || !receipt.events.event)
      return { status: "unknown_outcome", retrySameCommand: true };
    return { status: "saved", workId: input.workId, retainedWorkId: input.retainedWorkId,
      recordVersion: receipt.recordVersion as number, replayed: receipt.replayed === true };
  } catch { return { status: "unknown_outcome", retrySameCommand: true }; }
}
