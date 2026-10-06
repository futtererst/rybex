import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
type RpcResult = { data: unknown; error: { message: string } | null };
export type G1DecisionContext = {
  status: "not_started" | "preparing" | "pending_decision" | "returned" | "qualified";
  canDecide: boolean; canReopen: boolean; canQualify?: boolean;
  strategyStatus?: "eligible" | "prohibited" | "reserved" | "unconfigured" | "stale"
    | "recorded" | "historical_unrecorded" | null;
  strategyReason?: string | null; strategyRuleDigest?: string | null;
  assessmentId?: string | null;
  assessmentRevision?: number | null; packageDigest?: string | null;
  recordVersion?: number; decisionId?: string | null;
  maximumProposedCapAmount?: number | null;
  decisionReason?: string | null; decisionConditions?: string | null;
  decisionByProfileId?: string | null; spendingAuthorized?: false;
};
export type G1DecisionReadResult =
  | { status: "ok"; context: G1DecisionContext }
  | { status: "denied" | "invalid" | "unavailable" };
export type G1DecisionWriteResult =
  | { status: "returned" | "qualified"; replayed: boolean }
  | { status: "denied" | "conflict" | "invalid" | "limit_exceeded" | "basis_changed" | "strategy_blocked" | "unavailable" };
export type G1ReopenResult =
  | { status: "opened"; assessmentRevision: number; replayed: boolean }
  | { status: "denied" | "conflict" | "invalid" | "unavailable" };

async function scoped(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}
function validContext(raw: unknown): raw is G1DecisionContext {
  if (!raw || typeof raw !== "object") return false;
  const x = raw as G1DecisionContext;
  if (!["not_started", "preparing", "pending_decision", "returned", "qualified"].includes(x.status)
    || typeof x.canDecide !== "boolean" || typeof x.canReopen !== "boolean") return false;
  if (x.status === "not_started") return !x.canDecide && !x.canReopen;
  return Number.isInteger(x.recordVersion) && (x.recordVersion ?? 0) > 0
    && (x.assessmentId == null || uuid.test(x.assessmentId))
    && (x.packageDigest == null || digest.test(x.packageDigest))
    && (x.decisionId == null || uuid.test(x.decisionId))
    && (x.maximumProposedCapAmount == null || typeof x.maximumProposedCapAmount === "number"
      && Number.isFinite(x.maximumProposedCapAmount) && x.maximumProposedCapAmount >= 0)
    && typeof x.canQualify === "boolean"
    && (x.strategyStatus == null || ["eligible", "prohibited", "reserved", "unconfigured", "stale",
      "recorded", "historical_unrecorded"].includes(x.strategyStatus))
    && (x.strategyReason == null || typeof x.strategyReason === "string")
    && (x.strategyRuleDigest == null || digest.test(x.strategyRuleDigest))
    && x.spendingAuthorized === false;
}
export async function loadG1Decision(workspaceId: string, workId: string): Promise<G1DecisionReadResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_get_discover_g1_decision_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_get_discover_g1_decision_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return /forbidden|unauthenticated|employee_verification_required|permission_denied/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    return validContext(data) ? { status: "ok", context: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function decideG1(input: { workspaceId: string; workId: string;
  assessmentId: string; packageDigest: string; expectedWorkVersion: number;
  commandId: string; disposition: "return" | "qualify"; reason: string; conditions: string;
}): Promise<G1DecisionWriteResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId) || !uuid.test(input.assessmentId)
    || !digest.test(input.packageDigest) || !Number.isInteger(input.expectedWorkVersion)
    || input.expectedWorkVersion < 1 || typeof input.commandId !== "string"
    || input.commandId.length < 8 || input.commandId.length > 200
    || !["return", "qualify"].includes(input.disposition)
    || typeof input.reason !== "string" || typeof input.conditions !== "string"
    || input.reason.trim().length < 20 || input.reason.trim().length > 1000
    || input.conditions.trim().length > 2000
    || (input.conditions.trim() !== "" && input.conditions.trim().length < 20)
    || (input.disposition === "return" && input.conditions.trim() !== "")) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_decide_discover_g1_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_decide_discover_g1_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_assessment_id: input.assessmentId, p_package_digest: input.packageDigest,
      p_expected_work_version: input.expectedWorkVersion, p_command_id: input.commandId,
      p_disposition: input.disposition, p_reason: input.reason.trim(),
      p_conditions: input.conditions.trim() || null,
    });
    if (error) {
      if (/g1_qualification_limit_exceeded/.test(error.message)) return { status: "limit_exceeded" };
      if (/g1_qualification_basis_changed/.test(error.message)) return { status: "basis_changed" };
      if (/g1_strategy_(unconfigured|prohibited|stale)|g1_reserved_matter_pending/.test(error.message)) return { status: "strategy_blocked" };
      if (/forbidden|unauthenticated|employee_verification_required|permission_denied|separation_of_duties/.test(error.message)) return { status: "denied" };
      if (/conflict|idempotency_mismatch|command_in_progress|pinned_configuration_changed/.test(error.message)) return { status: "conflict" };
      if (/invalid_command/.test(error.message)) return { status: "invalid" };
      return { status: "unavailable" };
    }
    const receipt = data as { success?: unknown; workId?: unknown; assessmentId?: unknown;
      packageDigest?: unknown; disposition?: unknown; spendingAuthorized?: unknown; replayed?: unknown } | null;
    if (receipt?.success !== true || receipt.workId !== input.workId
      || receipt.assessmentId !== input.assessmentId || receipt.packageDigest !== input.packageDigest
      || receipt.disposition !== input.disposition || receipt.spendingAuthorized !== false) return { status: "unavailable" };
    return { status: input.disposition === "return" ? "returned" : "qualified",
      replayed: receipt.replayed === true };
  } catch { return { status: "unavailable" }; }
}
export async function reopenG1Assessment(input: { workspaceId: string; workId: string;
  assessmentId: string; commandId: string;
}): Promise<G1ReopenResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId) || !uuid.test(input.assessmentId)
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200)
    return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_reopen_discover_g1_assessment_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_reopen_discover_g1_assessment_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_assessment_id: input.assessmentId, p_command_id: input.commandId,
    });
    if (error) {
      if (/forbidden|unauthenticated|employee_verification_required|permission_denied/.test(error.message)) return { status: "denied" };
      if (/conflict|idempotency_mismatch|command_in_progress/.test(error.message)) return { status: "conflict" };
      if (/invalid_command/.test(error.message)) return { status: "invalid" };
      return { status: "unavailable" };
    }
    const receipt = data as { success?: unknown; workId?: unknown; assessmentRevision?: unknown;
      spendingAuthorized?: unknown; replayed?: unknown } | null;
    if (receipt?.success !== true || receipt.workId !== input.workId
      || !Number.isInteger(receipt.assessmentRevision) || receipt.spendingAuthorized !== false)
      return { status: "unavailable" };
    return { status: "opened", assessmentRevision: receipt.assessmentRevision as number,
      replayed: receipt.replayed === true };
  } catch { return { status: "unavailable" }; }
}
