import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
type RpcResult = { data: unknown; error: { message: string } | null };

export type SpendContext = {
  status: "not_qualified" | "historical_qualification" | "ready_to_request" |
    "pending_decision" | "expired_pending" | "authorized" | "declined" | "expired";
  canRequest: boolean; canDecide: boolean; spendingAuthorized: boolean;
  g1DecisionId?: string | null; recordVersion?: number;
  requestId?: string | null; requestDigest?: string | null;
  amount?: number | null; currency?: string | null; expiresOn?: string | null;
  purpose?: string | null; requestedAt?: string | null;
  decisionId?: string | null; decisionReason?: string | null;
  maximumRequestAmount?: number | null; maximumDecisionAmount?: number | null;
};
export type SpendReadResult = { status: "ok"; context: SpendContext } |
  { status: "denied" | "invalid" | "unavailable" };
export type SpendWriteResult = { status: "requested" | "authorized" | "declined"; replayed: boolean } |
  { status: "denied" | "conflict" | "limit_exceeded" | "invalid" | "unavailable" };

async function scoped(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}
function validContext(raw: unknown): raw is SpendContext {
  if (!raw || typeof raw !== "object") return false;
  const x = raw as SpendContext;
  return ["not_qualified", "historical_qualification", "ready_to_request", "pending_decision",
    "expired_pending", "authorized", "declined", "expired"].includes(x.status)
    && typeof x.canRequest === "boolean" && typeof x.canDecide === "boolean"
    && typeof x.spendingAuthorized === "boolean"
    && (x.spendingAuthorized === (x.status === "authorized"))
    && (x.g1DecisionId == null || uuid.test(x.g1DecisionId))
    && (x.requestId == null || uuid.test(x.requestId))
    && (x.requestDigest == null || digest.test(x.requestDigest))
    && (x.recordVersion == null || Number.isInteger(x.recordVersion) && x.recordVersion > 0)
    && (x.amount == null || typeof x.amount === "number" && Number.isFinite(x.amount) && x.amount > 0)
    && (x.expiresOn == null || date.test(x.expiresOn));
}
export async function loadSpend(workspaceId: string, workId: string): Promise<SpendReadResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_get_discover_spend_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_get_discover_spend_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return /forbidden|unauthenticated|employee_verification_required|permission_denied/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    return validContext(data) ? { status: "ok", context: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function requestSpend(input: { workspaceId: string; workId: string;
  g1DecisionId: string; expectedWorkVersion: number; commandId: string;
  amount: number; currency: "USD"; expiresOn: string; purpose: string;
}): Promise<SpendWriteResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.g1DecisionId) || !Number.isInteger(input.expectedWorkVersion)
    || input.expectedWorkVersion < 1 || typeof input.commandId !== "string"
    || input.commandId.length < 8 || input.commandId.length > 200
    || !Number.isFinite(input.amount) || input.amount <= 0 || Math.round(input.amount * 100) !== input.amount * 100
    || input.currency !== "USD" || typeof input.expiresOn !== "string" || !date.test(input.expiresOn)
    || typeof input.purpose !== "string"
    || input.purpose.trim().length < 20 || input.purpose.trim().length > 1000) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_request_discover_spend_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_request_discover_spend_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_g1_decision_id: input.g1DecisionId, p_expected_work_version: input.expectedWorkVersion,
      p_command_id: input.commandId, p_amount: input.amount, p_currency: input.currency,
      p_expires_on: input.expiresOn, p_purpose: input.purpose.trim(),
    });
    if (error) {
      if (/limit_exceeded/.test(error.message)) return { status: "limit_exceeded" };
      if (/forbidden|unauthenticated|verification_required|permission_denied|author_denied/.test(error.message)) return { status: "denied" };
      if (/conflict|idempotency_mismatch|command_in_progress|pinned_configuration_changed/.test(error.message)) return { status: "conflict" };
      if (/invalid_command/.test(error.message)) return { status: "invalid" };
      return { status: "unavailable" };
    }
    const x = data as { success?: unknown; workId?: unknown; requestId?: unknown;
      spendingAuthorized?: unknown; replayed?: unknown } | null;
    return x?.success === true && x.workId === input.workId && typeof x.requestId === "string"
      && uuid.test(x.requestId) && x.spendingAuthorized === false
      ? { status: "requested", replayed: x.replayed === true } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function decideSpend(input: { workspaceId: string; workId: string;
  requestId: string; requestDigest: string; commandId: string;
  disposition: "authorize" | "decline"; reason: string;
}): Promise<SpendWriteResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.requestId) || !digest.test(input.requestDigest)
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200
    || !["authorize", "decline"].includes(input.disposition)
    || typeof input.reason !== "string"
    || input.reason.trim().length < 20 || input.reason.trim().length > 1000) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_decide_discover_spend_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_decide_discover_spend_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_request_id: input.requestId, p_request_digest: input.requestDigest,
      p_command_id: input.commandId, p_disposition: input.disposition,
      p_reason: input.reason.trim(),
    });
    if (error) {
      if (/limit_exceeded/.test(error.message)) return { status: "limit_exceeded" };
      if (/forbidden|unauthenticated|verification_required|permission_denied/.test(error.message)) return { status: "denied" };
      if (/conflict|idempotency_mismatch|command_in_progress|pinned_configuration_changed/.test(error.message)) return { status: "conflict" };
      if (/invalid_command/.test(error.message)) return { status: "invalid" };
      return { status: "unavailable" };
    }
    const x = data as { success?: unknown; workId?: unknown; requestId?: unknown;
      disposition?: unknown; spendingAuthorized?: unknown; replayed?: unknown } | null;
    return x?.success === true && x.workId === input.workId && x.requestId === input.requestId
      && x.disposition === input.disposition && x.spendingAuthorized === (input.disposition === "authorize")
      ? { status: input.disposition === "authorize" ? "authorized" : "declined", replayed: x.replayed === true }
      : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
