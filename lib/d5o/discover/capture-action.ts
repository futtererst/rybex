"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { normalizeCaptureDraft, type CaptureDraft } from "@/lib/d5o/discover/capture-contract";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

export type CaptureCommandInput = {
  workspaceId: string;
  configurationVersionId: string;
  gateKey: string;
  commandId: string;
  draft: CaptureDraft;
};
export type EditCaptureCommandInput = {
  workspaceId: string;
  workId: string;
  expectedVersion: number;
  commandId: string;
  draft: CaptureDraft;
};

export type CaptureCommandOutcome =
  | { status: "saved"; workId: string; recordVersion: number; replayed: boolean }
  | { status: "conflict" | "denied" | "invalid" | "configuration_unavailable"; message: string }
  | { status: "unknown_outcome"; retrySameCommand: true };

type RpcResult = { data: unknown; error: { message: string } | null };
type Receipt = {
  success: true;
  workId: string;
  recordVersion: number;
  events: { audit: string; event: string };
  replayed?: boolean;
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recognizedError(message: string): Exclude<CaptureCommandOutcome, { status: "saved" | "unknown_outcome" }> | null {
  if (/(^|\W)(possible_duplicate|use_existing_work)(\W|$)/.test(message)) {
    return { status: "conflict", message: "Existing work may match. A scoped review is required before another Work ID can be made." };
  }
  if (/(^|\W)(idempotency_mismatch|command_in_progress|concurrency_conflict)(\W|$)/.test(message)) {
    return { status: "conflict", message: "This command conflicts with another save. Your changes remain here; copy anything needed, then close and reopen the current Work record." };
  }
  if (/(^|\W)draft_not_editable(\W|$)/.test(message)) {
    return { status: "conflict", message: "This intake draft is no longer editable. Reopen the current Work record." };
  }
  if (/(^|\W)(forbidden|unauthenticated|employee_verification_required|capture_permission_denied)(\W|$)/.test(message)) {
    return { status: "denied", message: "Capture is not available for this identity and scope." };
  }
  if (/(^|\W)(invalid_command|invalid_triage_owner)(\W|$)/.test(message)) {
    return { status: "invalid", message: "Review the capture fields and selected triage owner." };
  }
  if (/(^|\W)(configuration_mismatch|configuration_unavailable|no_tenant_mapping|ambiguous_tenant_mapping|invalid_configuration_lineage|pinned_configuration_changed|capture_permission_unavailable)(\W|$)/.test(message)) {
    return { status: "configuration_unavailable", message: "The Discover configuration or tenant binding is unavailable." };
  }
  return null;
}

async function invokeCaptureRpc(
  name: "d5o_capture_discover_draft_v1" | "d5o_edit_my_discover_draft_v1",
  args: Record<string, unknown>, expectedWorkId?: string,
): Promise<CaptureCommandOutcome> {
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      rpcName: typeof name, rpcArgs: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call(name, args);
    if (error) return recognizedError(error.message) ?? { status: "unknown_outcome", retrySameCommand: true };
    const receipt = data as Receipt | null;
    if (receipt?.success !== true || !uuidPattern.test(receipt.workId)
      || (expectedWorkId && receipt.workId !== expectedWorkId)
      || !Number.isInteger(receipt.recordVersion) || receipt.recordVersion < 1
      || !receipt.events?.audit || !receipt.events.event) {
      return { status: "unknown_outcome", retrySameCommand: true };
    }
    return { status: "saved", workId: receipt.workId,
      recordVersion: receipt.recordVersion, replayed: receipt.replayed === true };
  } catch (error) {
    const known = error instanceof Error ? recognizedError(error.message) : null;
    return known ?? { status: "unknown_outcome", retrySameCommand: true };
  }
}

/** Test-environment only. The SQL candidate is not yet an applied RPC. */
export async function captureDiscoverDraftAction(input: CaptureCommandInput): Promise<CaptureCommandOutcome> {
  assertDiscoverTrialEnvironment();
  if (!input || typeof input !== "object" || typeof input.workspaceId !== "string"
      || typeof input.configurationVersionId !== "string" || typeof input.gateKey !== "string"
      || typeof input.commandId !== "string" || !input.draft || typeof input.draft !== "object") {
    return { status: "invalid", message: "Review the capture fields and command context." };
  }
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== input.workspaceId) {
    return { status: "denied", message: "Capture is not available for this identity and scope." };
  }
  const parsed = normalizeCaptureDraft({ ...input.draft });
  if (!parsed.ok || !uuidPattern.test(input.configurationVersionId)
      || !/^[a-z0-9][a-z0-9_-]*$/.test(input.gateKey)
      || input.commandId.length < 8 || input.commandId.length > 200) {
    return { status: "invalid", message: "Review the capture fields and command context." };
  }
  return invokeCaptureRpc("d5o_capture_discover_draft_v1", {
    p_workspace_id: input.workspaceId,
    p_configuration_version_id: input.configurationVersionId,
    p_gate_key: input.gateKey,
    p_command_id: input.commandId,
    p_payload: parsed.draft,
  });
}

/** Test-environment only. Saves a new version of an owned, unsubmitted intake draft. */
export async function editDiscoverDraftAction(input: EditCaptureCommandInput): Promise<CaptureCommandOutcome> {
  assertDiscoverTrialEnvironment();
  if (!input || typeof input !== "object" || typeof input.workspaceId !== "string"
      || typeof input.workId !== "string" || typeof input.commandId !== "string"
      || !input.draft || typeof input.draft !== "object"
      || !uuidPattern.test(input.workId)
      || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
      || input.commandId.length < 8 || input.commandId.length > 200) {
    return { status: "invalid", message: "Review the capture fields and command context." };
  }
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== input.workspaceId) {
    return { status: "denied", message: "Capture is not available for this identity and scope." };
  }
  const parsed = normalizeCaptureDraft({ ...input.draft });
  if (!parsed.ok) return { status: "invalid", message: "Review the capture fields and selected triage owner." };
  return invokeCaptureRpc("d5o_edit_my_discover_draft_v1", {
    p_workspace_id: input.workspaceId,
    p_work_id: input.workId,
    p_expected_version: input.expectedVersion,
    p_command_id: input.commandId,
    p_payload: parsed.draft,
  }, input.workId);
}

