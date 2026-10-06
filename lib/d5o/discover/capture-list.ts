import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

export type OwnDiscoverCard = {
  workId: string;
  recordVersion: number;
  title: string;
  lifecycleState: string;
  customerContext: string | null;
  siteContext: string | null;
  source: string | null;
  needSummary: string | null;
  valueBand: string;
  currency: string | null;
  responseDueOn: string | null;
  triageOwnerProfileId: string | null;
  nextAction: string | null;
  updatedAt: string;
};

export type OwnDiscoverPage =
  | { status: "ok"; items: OwnDiscoverCard[]; nextCursor: { updatedAt: string; workId: string } | null }
  | { status: "denied" | "unavailable" | "invalid" };

type RpcResult = { data: unknown; error: { message: string } | null };
export type OwnDiscoverState = "all" | "intake_draft" | "pending_owner_acceptance" | "triage_assigned" | "duplicate_closed";
export type OwnDiscoverSort = "newest" | "oldest";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validCard(value: unknown): value is OwnDiscoverCard {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.workId === "string" && uuidPattern.test(v.workId)
    && Number.isInteger(v.recordVersion) && (v.recordVersion as number) > 0
    && typeof v.title === "string" && v.title.length > 0
    && typeof v.lifecycleState === "string"
    && typeof v.updatedAt === "string" && Number.isFinite(Date.parse(v.updatedAt))
    && ["customerContext", "siteContext", "source", "needSummary", "currency",
      "responseDueOn", "triageOwnerProfileId", "nextAction"].every(
      key => v[key] === null || typeof v[key] === "string")
    && typeof v.valueBand === "string";
}

/** Synthetic trial only. This is an author-owned collection, not a CRM-wide read grant. */
export async function listOwnDiscoverCaptures(input: {
  workspaceId: string;
  configurationVersionId: string;
  gateKey: string;
  query?: string;
  state?: OwnDiscoverState;
  sort?: OwnDiscoverSort;
  cursor?: { updatedAt: string; workId: string };
}): Promise<OwnDiscoverPage> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuidPattern.test(input.workspaceId)
    || !uuidPattern.test(input.configurationVersionId)
    || !/^[a-z0-9][a-z0-9_-]*$/.test(input.gateKey)
    || typeof (input.query ?? "") !== "string" || (input.query ?? "").length > 120
    || !["all", "intake_draft", "pending_owner_acceptance", "triage_assigned", "duplicate_closed"].includes(input.state ?? "all")
    || !["newest", "oldest"].includes(input.sort ?? "newest")
    || (input.cursor !== undefined && (!input.cursor
      || typeof input.cursor.workId !== "string" || !uuidPattern.test(input.cursor.workId)
      || typeof input.cursor.updatedAt !== "string"
      || !Number.isFinite(Date.parse(input.cursor.updatedAt))))) {
    return { status: "invalid" };
  }
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized"
    || context.workspace?.id !== input.workspaceId) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_list_my_discover_drafts_v2", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_list_my_discover_drafts_v2", {
      p_workspace_id: input.workspaceId,
      p_configuration_version_id: input.configurationVersionId,
      p_gate_key: input.gateKey,
      p_query: input.query ?? "",
      p_state: input.state ?? "all",
      p_sort: input.sort ?? "newest",
      p_before_updated_at: input.cursor?.updatedAt ?? null,
      p_before_work_id: input.cursor?.workId ?? null,
    });
    if (error) return /(^|\W)(forbidden|unauthenticated|employee_verification_required|capture_permission_denied)(\W|$)/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const raw = data as { items?: unknown; hasMore?: unknown; nextCursor?: unknown } | null;
    if (!raw || !Array.isArray(raw.items) || raw.items.length > 50
      || !raw.items.every(validCard) || typeof raw.hasMore !== "boolean") {
      return { status: "unavailable" };
    }
    const next = raw.nextCursor as { updatedAt?: unknown; workId?: unknown } | null;
    if (raw.hasMore && (!next || typeof next.updatedAt !== "string"
      || !Number.isFinite(Date.parse(next.updatedAt))
      || typeof next.workId !== "string" || !uuidPattern.test(next.workId)
      || !raw.items.some(item => item.workId === next.workId))) {
      return { status: "unavailable" };
    }
    if (!raw.hasMore && next !== null) return { status: "unavailable" };
    return { status: "ok", items: raw.items,
      nextCursor: raw.hasMore ? next as { updatedAt: string; workId: string } : null };
  } catch {
    return { status: "unavailable" };
  }
}

