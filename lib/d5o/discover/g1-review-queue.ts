import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
export type G1ReviewQueueItem = {
  work_id: string; title: string; record_version: number;
  assessment_id: string; assessment_revision: number; package_digest: string;
  submitted_at: string; account_name: string | null; site_name: string | null;
};
export type G1ReviewQueueResult =
  | { status: "ok"; items: G1ReviewQueueItem[] }
  | { status: "denied" | "invalid" | "unavailable" };

function validItem(raw: unknown): raw is G1ReviewQueueItem {
  const x = raw as Partial<G1ReviewQueueItem> | null;
  return !!x && uuid.test(x.work_id ?? "") && typeof x.title === "string"
    && Number.isInteger(x.record_version) && (x.record_version ?? 0) > 0
    && uuid.test(x.assessment_id ?? "") && Number.isInteger(x.assessment_revision)
    && (x.assessment_revision ?? 0) > 0 && digest.test(x.package_digest ?? "")
    && typeof x.submitted_at === "string" && Number.isFinite(Date.parse(x.submitted_at))
    && (x.account_name === null || typeof x.account_name === "string")
    && (x.site_name === null || typeof x.site_name === "string");
}
export async function loadG1ReviewQueue(workspaceId: string): Promise<G1ReviewQueueResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId)) return { status: "invalid" };
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== workspaceId)
    return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_list_discover_g1_review_queue_v1", args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await call("d5o_list_discover_g1_review_queue_v1", { p_workspace_id: workspaceId });
    if (error) return /forbidden|unauthenticated|employee_verification_required|permission_denied/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const raw = data as { items?: unknown; count?: unknown } | null;
    if (!raw || !Array.isArray(raw.items) || raw.items.length > 50
      || raw.count !== raw.items.length || !raw.items.every(validItem)) return { status: "unavailable" };
    return { status: "ok", items: raw.items };
  } catch { return { status: "unavailable" }; }
}
