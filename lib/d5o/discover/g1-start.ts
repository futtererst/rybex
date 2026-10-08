import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

type RpcResult = { data: unknown; error: { message: string } | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type G1StartContext = {
  workId: string; recordVersion: number; g1Status: string;
  g1InstanceId: string | null; canStart: boolean; spendingAuthorized: false;
};
export type G1StartContextResult =
  | { status: "ok"; context: G1StartContext }
  | { status: "denied" | "invalid" | "unavailable" };
export type G1StartResult =
  | { status: "started"; workId: string; g1InstanceId: string; replayed: boolean }
  | { status: "denied" | "conflict" | "invalid" | "unavailable" };

async function scoped(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}
function validContext(x: unknown): x is G1StartContext {
  const v = x as Partial<G1StartContext> | null;
  return !!v && typeof v.workId === "string" && uuid.test(v.workId)
    && Number.isInteger(v.recordVersion) && (v.recordVersion ?? 0) > 0
    && typeof v.g1Status === "string"
    && (v.g1InstanceId === null || typeof v.g1InstanceId === "string" && uuid.test(v.g1InstanceId))
    && typeof v.canStart === "boolean" && v.spendingAuthorized === false;
}

export async function loadG1StartContext(workspaceId: string, workId: string): Promise<G1StartContextResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_get_discover_g1_start_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_get_discover_g1_start_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return /forbidden|unauthenticated|employee_verification_required|opportunity_read_permission/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    return validContext(data) && data.workId === workId
      ? { status: "ok", context: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}

export async function startG1Assessment(input: {
  workspaceId: string; workId: string; expectedVersion: number; commandId: string;
}): Promise<G1StartResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
    || input.commandId.length < 8 || input.commandId.length > 200) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_start_discover_g1_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_start_discover_g1_v1", {
      p_workspace_id: input.workspaceId, p_work_id: input.workId,
      p_expected_version: input.expectedVersion, p_command_id: input.commandId,
    });
    if (error) {
      if (/forbidden|unauthenticated|employee_verification_required|permission_denied/.test(error.message)) return { status: "denied" };
      if (/not_eligible|concurrency_conflict|idempotency_mismatch|command_in_progress/.test(error.message)) return { status: "conflict" };
      if (/invalid_command/.test(error.message)) return { status: "invalid" };
      return { status: "unavailable" };
    }
    const receipt = data as { success?: unknown; workId?: unknown; g1InstanceId?: unknown; replayed?: unknown } | null;
    return receipt?.success === true && receipt.workId === input.workId
      && typeof receipt.g1InstanceId === "string" && uuid.test(receipt.g1InstanceId)
      ? { status: "started", workId: input.workId, g1InstanceId: receipt.g1InstanceId,
        replayed: receipt.replayed === true } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
