"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type TriageOwnerOption = { profileId: string; label: string };
export type TriageOwnerOptionsResult =
  | { status: "ok"; items: TriageOwnerOption[] }
  | { status: "denied" | "unavailable" };

export async function listDiscoverTriageOwners(workspaceId: string,
  configurationVersionId: string): Promise<TriageOwnerOptionsResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(configurationVersionId)) return { status: "denied" };
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== workspaceId)
    return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const { data, error } = await (client.rpc.bind(client) as unknown as
      (name: string, args: Record<string, unknown>) => Promise<{
        data: unknown; error: { message: string } | null;
      }>)("d5o_list_discover_triage_owners_v1", {
        p_workspace_id: workspaceId,
        p_configuration_version_id: configurationVersionId,
      });
    if (error) return /forbidden|unauthenticated|employee_verification_required|capture_permission_denied/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const result = data as { items?: unknown; policyDigest?: unknown } | null;
    if (!result || typeof result.policyDigest !== "string" || !/^[0-9a-f]{64}$/.test(result.policyDigest)
      || !Array.isArray(result.items) || result.items.length > 30
      || !result.items.every((item: unknown) => {
        const x = item as Partial<TriageOwnerOption> | null;
        return !!x && typeof x.profileId === "string" && uuid.test(x.profileId)
          && typeof x.label === "string" && x.label.length > 0 && x.label.length <= 240;
      })) return { status: "unavailable" };
    return { status: "ok", items: result.items as TriageOwnerOption[] };
  } catch { return { status: "unavailable" }; }
}
