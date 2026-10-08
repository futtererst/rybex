import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const textFields = ["strategicRationale", "customerRationale", "technicalAssessment", "technicalRisk",
  "capacityPosition", "commercialRisk", "pursuitPlan", "knownUnknowns"] as const;
type RpcResult = { data: unknown; error: { message: string } | null };
export type G1AssessmentPayload = Record<(typeof textFields)[number], string | null> & {
  proposedCapAmount: number | null; proposedCapCurrency: "USD" | "GBP" | "EUR" | null;
  nextOwnerProfileId: string | null;
};
export type G1AssessmentContext = {
  status: "not_started" | "empty" | "draft" | "draft_private" | "submitted";
  g1InstanceId?: string; assessmentRevision?: number; canEdit: boolean;
  payload?: G1AssessmentPayload | null; packageDigest?: string | null;
  nextOwnerName?: string | null;
  strategyResult?: { status: string; reason?: string; ruleDigest?: string } | null;
  spendingAuthorized?: false;
};
export type G1AssessmentReadResult =
  | { status: "ok"; context: G1AssessmentContext }
  | { status: "denied" | "invalid" | "unavailable" };
export type G1AssessmentWriteResult =
  | { status: "saved" | "submitted"; assessmentRevision: number; replayed: boolean }
  | { status: "incomplete"; missing: string[] }
  | { status: "denied" | "conflict" | "invalid" | "unavailable" };

async function scoped(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}
function validPayload(raw: unknown): raw is Partial<G1AssessmentPayload> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const x = raw as Record<string, unknown>;
  if (Object.keys(x).some(key => !([...textFields, "proposedCapAmount", "proposedCapCurrency", "nextOwnerProfileId"] as string[]).includes(key))) return false;
  return textFields.every(key => x[key] == null || typeof x[key] === "string" && x[key].length <= 2000)
    && (x.proposedCapAmount == null || typeof x.proposedCapAmount === "number"
      && Number.isFinite(x.proposedCapAmount) && x.proposedCapAmount >= 0 && x.proposedCapAmount <= 1_000_000_000)
    && (x.proposedCapCurrency == null || ["USD", "GBP", "EUR"].includes(String(x.proposedCapCurrency)))
    && (x.nextOwnerProfileId == null || typeof x.nextOwnerProfileId === "string" && uuid.test(x.nextOwnerProfileId));
}
function normalizedPayload(raw: Partial<G1AssessmentPayload>): G1AssessmentPayload {
  const text = Object.fromEntries(textFields.map(key => [key, raw[key] ?? null])) as
    Record<(typeof textFields)[number], string | null>;
  return { ...text, proposedCapAmount: raw.proposedCapAmount ?? null,
    proposedCapCurrency: raw.proposedCapCurrency ?? null,
    nextOwnerProfileId: raw.nextOwnerProfileId ?? null };
}
function validContext(raw: unknown): raw is G1AssessmentContext {
  if (!raw || typeof raw !== "object") return false;
  const x = raw as G1AssessmentContext;
  if (!["not_started", "empty", "draft", "draft_private", "submitted"].includes(x.status)
    || typeof x.canEdit !== "boolean") return false;
  if (x.status === "not_started") return !x.canEdit;
  return typeof x.g1InstanceId === "string" && uuid.test(x.g1InstanceId)
    && Number.isInteger(x.assessmentRevision) && (x.assessmentRevision ?? -1) >= 0
    && x.spendingAuthorized === false
    && (x.payload === null || validPayload(x.payload))
    && (x.nextOwnerName == null || typeof x.nextOwnerName === "string")
    && (x.strategyResult == null || typeof x.strategyResult === "object"
      && typeof x.strategyResult.status === "string"
      && (x.strategyResult.reason == null || typeof x.strategyResult.reason === "string")
      && (x.strategyResult.ruleDigest == null || /^[0-9a-f]{64}$/.test(x.strategyResult.ruleDigest)))
    && (x.status !== "draft_private" || x.payload === null);
}

export async function loadG1Assessment(workspaceId: string, workId: string): Promise<G1AssessmentReadResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_get_discover_g1_assessment_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_get_discover_g1_assessment_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return /forbidden|unauthenticated|employee_verification_required|opportunity_read_permission/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    return validContext(data) ? { status: "ok", context: {
      ...data, payload: data.payload ? normalizedPayload(data.payload) : null,
    } } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}

export async function writeG1Assessment(input: {
  workspaceId: string; workId: string; instanceId: string; expectedRevision: number;
  commandId: string; mode: "save" | "submit"; payload: G1AssessmentPayload;
}): Promise<G1AssessmentWriteResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId) || !uuid.test(input.instanceId)
    || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200
    || !["save", "submit"].includes(input.mode) || !validPayload(input.payload)
    || [...textFields, "proposedCapAmount", "proposedCapCurrency", "nextOwnerProfileId"]
      .some(key => !(key in input.payload))) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_write_discover_g1_assessment_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_write_discover_g1_assessment_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId, p_instance_id: input.instanceId,
      p_expected_revision: input.expectedRevision, p_command_id: input.commandId,
      p_mode: input.mode, p_payload: input.payload,
    });
    if (error) {
      const incomplete = /g1_assessment_incomplete: ([a-zA-Z,]+)/.exec(error.message);
      if (incomplete) return { status: "incomplete", missing: incomplete[1].split(",") };
      if (/forbidden|unauthenticated|employee_verification_required|permission_denied/.test(error.message)) return { status: "denied" };
      if (/conflict|not_eligible|source_changed|idempotency_mismatch|command_in_progress/.test(error.message)) return { status: "conflict" };
      if (/invalid_command|invalid_assessment_payload|identity_or_source_missing|next_owner_invalid/.test(error.message)) return { status: "invalid" };
      return { status: "unavailable" };
    }
    const receipt = data as { success?: unknown; workId?: unknown; g1InstanceId?: unknown;
      assessmentRevision?: unknown; assessmentStatus?: unknown; replayed?: unknown; spendingAuthorized?: unknown } | null;
    if (receipt?.success !== true || receipt.workId !== input.workId
      || receipt.g1InstanceId !== input.instanceId
      || !Number.isInteger(receipt.assessmentRevision)
      || receipt.assessmentRevision !== input.expectedRevision + 1
      || receipt.spendingAuthorized !== false
      || receipt.assessmentStatus !== (input.mode === "submit" ? "submitted" : "draft")) return { status: "unavailable" };
    return { status: input.mode === "submit" ? "submitted" : "saved",
      assessmentRevision: receipt.assessmentRevision as number, replayed: receipt.replayed === true };
  } catch { return { status: "unavailable" }; }
}
