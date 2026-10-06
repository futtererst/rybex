import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const day = /^20\d\d-\d\d-\d\d$/;
type RpcResult = { data: unknown; error: { message: string } | null };
export type D2Brief = { customerNeed: string; scopeBoundary: string;
  assumptions: string[]; unknowns: string[]; dueOn: string;
  actions: { text: string; ownerProfileId: string; dueOn: string }[] };
export type D2HandoffContext = {
  workId: string; recordVersion: number; g1DecisionId: string | null;
  status: "not_started" | "awaiting_receiver" | "returned" | "accepted";
  canSubmit: boolean; canRespond: boolean; submissionId: string | null;
  revision: number | null; receiverProfileId: string | null;
  brief: D2Brief | null; briefDigest: string | null; responseReason: string | null;
  history: { submissionId: string; revision: number; briefDigest: string;
    submittedAt: string; disposition: "returned" | "accepted" | null;
    reason: string | null; respondedAt: string | null }[];
};
export type D2ReadResult = { status: "ok"; context: D2HandoffContext } |
  { status: "denied" | "unavailable" | "invalid" };
export type D2WriteResult = { status: "submitted" | "accepted" | "returned";
  replayed: boolean; submissionId: string } |
  { status: "denied" | "conflict" | "invalid" | "unavailable" };

async function scoped(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized"
    && context.workspace?.id === workspaceId;
}
async function rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const client = await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as
    (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(name, args);
}
function validBrief(x: unknown): x is D2Brief {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const b = x as D2Brief;
  return typeof b.customerNeed === "string" && b.customerNeed.trim().length >= 20
    && typeof b.scopeBoundary === "string" && b.scopeBoundary.trim().length >= 20
    && Array.isArray(b.assumptions) && b.assumptions.every(y => typeof y === "string")
    && Array.isArray(b.unknowns) && b.unknowns.every(y => typeof y === "string")
    && day.test(b.dueOn) && Array.isArray(b.actions) && b.actions.length >= 1
    && b.actions.length <= 20 && b.actions.every(y => typeof y.text === "string"
      && y.text.trim().length >= 10 && uuid.test(y.ownerProfileId) && day.test(y.dueOn));
}
function validContext(raw: unknown): raw is D2HandoffContext {
  if (!raw || typeof raw !== "object") return false;
  const x = raw as D2HandoffContext;
  return uuid.test(x.workId) && Number.isInteger(x.recordVersion) && x.recordVersion > 0
    && ["not_started","awaiting_receiver","returned","accepted"].includes(x.status)
    && typeof x.canSubmit === "boolean" && typeof x.canRespond === "boolean"
    && (x.g1DecisionId === null || uuid.test(x.g1DecisionId))
    && (x.submissionId === null || uuid.test(x.submissionId))
    && (x.revision === null || Number.isInteger(x.revision) && x.revision > 0)
    && (x.receiverProfileId === null || uuid.test(x.receiverProfileId))
    && (x.brief === null || validBrief(x.brief))
    && (x.briefDigest === null || digest.test(x.briefDigest))
    && (x.responseReason === null || typeof x.responseReason === "string")
    && Array.isArray(x.history) && x.history.length <= 100;
}
function errorStatus(message: string): D2WriteResult {
  if (/forbidden|denied|unauthenticated|verification_required|permission_/.test(message))
    return { status: "denied" };
  if (/conflict|already_pending|already_pending_or_accepted|idempotency_mismatch|command_in_progress|strategy_changed|pinned_configuration_changed/.test(message))
    return { status: "conflict" };
  if (/invalid_command|invalid_d2_|d2_action_owner_invalid/.test(message)) return { status: "invalid" };
  return { status: "unavailable" };
}
export async function loadD2Handoff(workspaceId: string, workId: string): Promise<D2ReadResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_get_d2_handoff_v1", {
      p_workspace_id: workspaceId, p_work_id: workId });
    if (error) return /forbidden|denied|unauthenticated|permission_/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    return validContext(data) ? { status: "ok", context: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function submitD2Handoff(input: { workspaceId: string; workId: string;
  g1DecisionId: string; expectedWorkVersion: number; receiverProfileId: string;
  commandId: string; brief: D2Brief }): Promise<D2WriteResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.g1DecisionId) || !uuid.test(input.receiverProfileId)
    || !Number.isInteger(input.expectedWorkVersion) || input.expectedWorkVersion < 1
    || input.commandId.length < 8 || input.commandId.length > 200
    || !validBrief(input.brief)) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_submit_d2_handoff_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_g1_decision_id: input.g1DecisionId,
      p_expected_work_version: input.expectedWorkVersion,
      p_receiver_profile_id: input.receiverProfileId,
      p_command_id: input.commandId, p_brief: input.brief });
    if (error) return errorStatus(error.message);
    const row = data as { success?: unknown; workId?: unknown; submissionId?: unknown;
      receivingAccepted?: unknown; replayed?: unknown; events?: { audit?: unknown; event?: unknown } } | null;
    return row?.success === true && row.workId === input.workId
      && typeof row.submissionId === "string" && uuid.test(row.submissionId)
      && row.receivingAccepted === false && typeof row.events?.audit === "string"
      && typeof row.events?.event === "string"
      ? { status: "submitted", submissionId: row.submissionId, replayed: row.replayed === true }
      : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function respondD2Handoff(input: { workspaceId: string; workId: string;
  submissionId: string; briefDigest: string; commandId: string;
  disposition: "accepted" | "returned"; reason: string }): Promise<D2WriteResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.submissionId) || !digest.test(input.briefDigest)
    || input.commandId.length < 8 || input.commandId.length > 200
    || !["accepted","returned"].includes(input.disposition)
    || input.reason.trim().length < 20 || input.reason.trim().length > 1000)
    return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_respond_d2_handoff_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_submission_id: input.submissionId,p_brief_digest: input.briefDigest,
      p_command_id: input.commandId,p_disposition: input.disposition,
      p_reason: input.reason.trim() });
    if (error) return errorStatus(error.message);
    const row = data as { success?: unknown; workId?: unknown; submissionId?: unknown;
      disposition?: unknown; receivingAccepted?: unknown; replayed?: unknown;
      events?: { audit?: unknown; event?: unknown } } | null;
    return row?.success === true && row.workId === input.workId
      && row.submissionId === input.submissionId && row.disposition === input.disposition
      && row.receivingAccepted === (input.disposition === "accepted")
      && typeof row.events?.audit === "string" && typeof row.events?.event === "string"
      ? { status: input.disposition, submissionId: input.submissionId,
          replayed: row.replayed === true } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
