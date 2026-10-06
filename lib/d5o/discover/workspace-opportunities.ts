import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import type { OwnDiscoverSort, OwnDiscoverState } from "@/lib/d5o/discover/capture-list";

export type WorkspaceOpportunity = {
  workId: string; title: string; state: string; recordVersion: number; updatedAt: string;
  customerName: string | null; siteName: string | null;
  identityStatus: "registered" | "provisional"; needSummary: string | null; authorName: string;
};
export type WorkspaceOpportunityPage =
  | { status: "ok"; items: WorkspaceOpportunity[]; nextCursor: { updatedAt: string; workId: string } | null }
  | { status: "denied" | "invalid" | "unavailable" };
export type WorkspaceOpportunityDetail =
  | { status: "ok"; item: WorkspaceOpportunity }
  | { status: "denied" | "invalid" | "unavailable" | "not_found" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult = { data: unknown; error: { message: string } | null };
function validItem(value: unknown): value is WorkspaceOpportunity {
  const x = value as Partial<WorkspaceOpportunity> | null;
  return !!x && uuid.test(x.workId ?? "") && typeof x.title === "string"
    && typeof x.state === "string" && Number.isInteger(x.recordVersion)
    && typeof x.updatedAt === "string" && Number.isFinite(Date.parse(x.updatedAt))
    && (x.customerName === null || typeof x.customerName === "string")
    && (x.siteName === null || typeof x.siteName === "string")
    && (x.needSummary === null || typeof x.needSummary === "string")
    && ["registered", "provisional"].includes(x.identityStatus ?? "")
    && typeof x.authorName === "string";
}

export async function listWorkspaceOpportunities(input: {
  workspaceId: string; configurationVersionId: string; query: string;
  state: OwnDiscoverState; sort: OwnDiscoverSort;
  cursor?: { updatedAt: string; workId: string };
}): Promise<WorkspaceOpportunityPage> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.configurationVersionId)
    || typeof input.query !== "string" || input.query.length > 120
    || !["all", "intake_draft", "pending_owner_acceptance", "triage_assigned", "duplicate_closed"].includes(input.state)
    || !["newest", "oldest"].includes(input.sort)
    || (input.cursor !== undefined && (!uuid.test(input.cursor.workId)
      || !Number.isFinite(Date.parse(input.cursor.updatedAt))))) return { status: "invalid" };
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized"
    || context.workspace?.id !== input.workspaceId) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_list_workspace_discover_opportunities_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_list_workspace_discover_opportunities_v1", {
      p_workspace_id: input.workspaceId, p_configuration_version_id: input.configurationVersionId,
      p_query: input.query, p_state: input.state, p_sort: input.sort,
      p_before_updated_at: input.cursor?.updatedAt ?? null,
      p_before_work_id: input.cursor?.workId ?? null,
    });
    if (error) return /forbidden|unauthenticated|employee_verification_required|opportunity_read_permission/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const raw = data as { items?: unknown; hasMore?: unknown; nextCursor?: unknown } | null;
    if (!raw || !Array.isArray(raw.items) || raw.items.length > 50
      || !raw.items.every(validItem) || typeof raw.hasMore !== "boolean") return { status: "unavailable" };
    const next = raw.nextCursor as { updatedAt?: unknown; workId?: unknown } | null;
    if (raw.hasMore && (!next || typeof next.workId !== "string" || !uuid.test(next.workId)
      || typeof next.updatedAt !== "string" || !Number.isFinite(Date.parse(next.updatedAt))
      || !raw.items.some(item => item.workId === next.workId))) return { status: "unavailable" };
    if (!raw.hasMore && next !== null) return { status: "unavailable" };
    return { status: "ok", items: raw.items,
      nextCursor: raw.hasMore ? next as { updatedAt: string; workId: string } : null };
  } catch { return { status: "unavailable" }; }
}

/** The detail route uses the same explicit read grant and safe projection as the index. */
export async function loadWorkspaceOpportunity(input: {
  workspaceId: string; configurationVersionId: string; workId: string;
}): Promise<WorkspaceOpportunityDetail> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.configurationVersionId)
    || !uuid.test(input.workId)) return { status: "invalid" };
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized"
    || context.workspace?.id !== input.workspaceId) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_get_workspace_discover_opportunity_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_get_workspace_discover_opportunity_v1", {
      p_workspace_id: input.workspaceId,
      p_configuration_version_id: input.configurationVersionId,
      p_work_id: input.workId,
    });
    if (error) return /forbidden|unauthenticated|employee_verification_required|opportunity_read_permission/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    if (data === null) return { status: "not_found" };
    return validItem(data) && data.workId === input.workId
      ? { status: "ok", item: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
