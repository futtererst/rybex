import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { normalizeCaptureDraft, type CaptureDraft } from "@/lib/d5o/discover/capture-contract";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

export type OwnCaptureView = {
  workId: string;
  recordVersion: number;
  lifecycleState: string;
  retainedWorkId: string | null;
  ownerProfileId: string;
  updatedAt: string;
  triageHistory: Array<{
    submissionId: string; submissionRevision: number; submittedAt: string;
    snapshotDigest: string; acceptBy: string | null; proposedOwnerProfileId: string;
    disposition: "accepted" | "returned" | null; reason: string | null;
    respondedAt: string | null; responderProfileId: string | null;
  }>;
  draft: CaptureDraft;
};
export type OwnCaptureResult =
  | { status: "ok"; view: OwnCaptureView }
  | { status: "denied" | "unavailable" };

type RpcResult = { data: unknown; error: { message: string } | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner-only trial read. The SQL candidate is intentionally unapplied. */
export async function loadOwnDiscoverCapture(workspaceId: string, workId: string): Promise<OwnCaptureResult> {
  assertDiscoverTrialEnvironment();
  if (!uuidPattern.test(workspaceId) || !uuidPattern.test(workId)) return { status: "denied" };
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== workspaceId) {
    return { status: "denied" };
  }
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_load_my_discover_draft_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_load_my_discover_draft_v1", {
      p_workspace_id: workspaceId, p_work_id: workId,
    });
    if (error) return /(^|\W)(forbidden|unauthenticated|employee_verification_required|capture_permission_denied)(\W|$)/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const raw = data as Partial<OwnCaptureView> & { title?: unknown; draft?: Record<string, unknown> };
    if (raw?.workId !== workId || !Number.isInteger(raw.recordVersion)
      || typeof raw.ownerProfileId !== "string" || !uuidPattern.test(raw.ownerProfileId)
      || !raw.draft || !Array.isArray(raw.triageHistory)
      || raw.triageHistory.length > 100
      || !raw.triageHistory.every(item => uuidPattern.test(item.submissionId)
        && Number.isInteger(item.submissionRevision)
        && typeof item.submittedAt === "string" && /^[0-9a-f]{64}$/.test(item.snapshotDigest)
        && uuidPattern.test(item.proposedOwnerProfileId)
        && (item.acceptBy === null || typeof item.acceptBy === "string")
        && (item.disposition === null || item.disposition === "accepted" || item.disposition === "returned")
        && (item.reason === null || typeof item.reason === "string")
        && (item.respondedAt === null || typeof item.respondedAt === "string")
        && (item.responderProfileId === null || uuidPattern.test(item.responderProfileId)))
      || typeof raw.lifecycleState !== "string" || typeof raw.updatedAt !== "string"
      || (raw.retainedWorkId !== null && raw.retainedWorkId !== undefined
        && (typeof raw.retainedWorkId !== "string" || !uuidPattern.test(raw.retainedWorkId)))) {
      return { status: "unavailable" };
    }
    const parsed = normalizeCaptureDraft({ ...raw.draft, title: raw.title });
    if (!parsed.ok) return { status: "unavailable" };
    return { status: "ok", view: {
      workId, recordVersion: raw.recordVersion as number,
      lifecycleState: raw.lifecycleState, ownerProfileId: raw.ownerProfileId,
      retainedWorkId: raw.retainedWorkId ?? null,
      updatedAt: raw.updatedAt, triageHistory: raw.triageHistory, draft: parsed.draft,
    } };
  } catch {
    return { status: "unavailable" };
  }
}

