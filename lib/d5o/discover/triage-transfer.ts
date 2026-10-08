"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult = { data: unknown; error: { message: string } | null };
export type TriageCommandResult =
  | { status: "completed"; workId: string; recordVersion: number; lifecycleState: string; replayed: boolean }
  | { status: "denied" | "conflict" | "invalid" | "unavailable"; message: string }
  | { status: "unknown_outcome"; retrySameCommand: true };
export type TriageQueueItem = {
  workId: string; recordVersion: number; submissionId: string; submissionRevision: number;
  title: string; customerContext: string; siteContext: string; needSummary: string;
  source: string; sourceReference: string; workType: string; responseDueOn: string;
  submittedAt: string; acceptBy: string | null; overdue: boolean; snapshotDigest: string;
};
export type TriageQueueResult =
  | { status: "ok"; items: TriageQueueItem[] }
  | { status: "denied" | "unavailable" };

async function permitted(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}
async function rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const client = await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(name, args);
}
function commandError(message: string): TriageCommandResult {
  if (/forbidden|denied|unauthenticated|employee_verification_required|permission_denied/.test(message))
    return { status: "denied", message: "Your current identity cannot make this triage decision." };
  if (/invalid_command/.test(message)) return { status: "invalid", message: "Check the decision details and try again." };
  if (/concurrency_conflict|idempotency_mismatch|not_ready|review_required|not_eligible|basis_changed|draft_not_editable|legacy_match/.test(message))
    return { status: "conflict", message: "This Work or its reviewed basis changed. Reopen it before deciding again." };
  if (/configuration|policy_unavailable|permission_unavailable/.test(message))
    return { status: "unavailable", message: "Current trial configuration is unavailable. No decision was made." };
  return { status: "unknown_outcome", retrySameCommand: true };
}
function receipt(data: unknown, workId: string): TriageCommandResult {
  const row = data as { success?: unknown; workId?: unknown; recordVersion?: unknown;
    lifecycleState?: unknown; replayed?: unknown; events?: { audit?: unknown; event?: unknown } } | null;
  if (row?.success !== true || row.workId !== workId || !Number.isInteger(row.recordVersion)
    || typeof row.lifecycleState !== "string" || typeof row.events?.audit !== "string"
    || typeof row.events?.event !== "string") return { status: "unknown_outcome", retrySameCommand: true };
  return { status: "completed", workId, recordVersion: row.recordVersion as number,
    lifecycleState: row.lifecycleState, replayed: row.replayed === true };
}

export async function submitDiscoverTriage(input: { workspaceId: string; workId: string;
  expectedVersion: number; commandId: string }): Promise<TriageCommandResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200)
    return { status: "invalid", message: "The Work version or command is invalid." };
  if (!(await permitted(input.workspaceId))) return { status: "denied", message: "This workspace is unavailable to you." };
  try {
    const { data, error } = await rpc("d5o_submit_discover_triage_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_expected_version: input.expectedVersion, p_command_id: input.commandId,
    });
    return error ? commandError(error.message) : receipt(data, input.workId);
  } catch { return { status: "unknown_outcome", retrySameCommand: true }; }
}

export async function listMyDiscoverTriage(workspaceId: string): Promise<TriageQueueResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !(await permitted(workspaceId))) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_list_my_discover_triage_v1", { p_workspace_id: workspaceId });
    if (error) return /forbidden|denied|unauthenticated/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const row = data as { items?: unknown } | null;
    if (!row || !Array.isArray(row.items) || row.items.length > 50
      || !row.items.every((x: unknown) => {
        const item = x as Partial<TriageQueueItem>;
        return uuid.test(item.workId || "") && uuid.test(item.submissionId || "")
          && Number.isInteger(item.recordVersion) && Number.isInteger(item.submissionRevision)
          && typeof item.title === "string" && typeof item.snapshotDigest === "string"
          && /^[0-9a-f]{64}$/.test(item.snapshotDigest) && typeof item.overdue === "boolean";
      })) return { status: "unavailable" };
    return { status: "ok", items: row.items as TriageQueueItem[] };
  } catch { return { status: "unavailable" }; }
}

export async function respondDiscoverTriage(input: { workspaceId: string; workId: string;
  submissionId: string; expectedVersion: number; commandId: string;
  disposition: "accepted" | "returned"; reason: string }): Promise<TriageCommandResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || !uuid.test(input.workId) || !uuid.test(input.submissionId)
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200
    || !["accepted", "returned"].includes(input.disposition)
    || typeof input.reason !== "string" || input.reason.trim().length < 20 || input.reason.trim().length > 1000)
    return { status: "invalid", message: "Record a reason of 20–1000 characters for this decision." };
  if (!(await permitted(input.workspaceId))) return { status: "denied", message: "This workspace is unavailable to you." };
  try {
    const { data, error } = await rpc("d5o_respond_discover_triage_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_submission_id: input.submissionId, p_expected_version: input.expectedVersion,
      p_command_id: input.commandId, p_disposition: input.disposition, p_reason: input.reason.trim(),
    });
    return error ? commandError(error.message) : receipt(data, input.workId);
  } catch { return { status: "unknown_outcome", retrySameCommand: true }; }
}
