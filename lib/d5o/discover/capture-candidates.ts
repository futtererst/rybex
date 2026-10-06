import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

export type DiscoverCandidate = {
  workId: string;
  title: string;
  customerContext: string | null;
  siteContext: string | null;
  lifecycleState: string;
};

export type DiscoverCandidateResult =
  | { status: "ok"; candidates: DiscoverCandidate[]; legacyMatchPossible: boolean }
  | { status: "denied" | "unavailable" | "invalid" };

type RpcResult = { data: unknown; error: { message: string } | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const gatePattern = /^[a-z0-9][a-z0-9_-]*$/;

function validCandidate(value: unknown): value is DiscoverCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = ["workId", "title", "customerContext", "siteContext", "lifecycleState"];
  return Object.keys(candidate).length === keys.length
    && keys.every(key => Object.hasOwn(candidate, key))
    && typeof candidate.workId === "string" && uuidPattern.test(candidate.workId)
    && typeof candidate.title === "string" && candidate.title.length > 0
    && (candidate.customerContext === null || typeof candidate.customerContext === "string")
    && (candidate.siteContext === null || typeof candidate.siteContext === "string")
    && typeof candidate.lifecycleState === "string";
}

/** Trial-only adapter. Candidate SQL is unapplied in the normal migration chain. */
export async function findDiscoverCandidates(input: {
  workspaceId: string;
  configurationVersionId: string;
  gateKey: string;
  customerQuery: string;
  titleQuery?: string;
}): Promise<DiscoverCandidateResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuidPattern.test(input.workspaceId)
    || !uuidPattern.test(input.configurationVersionId)
    || !gatePattern.test(input.gateKey)
    || typeof input.customerQuery !== "string"
    || input.customerQuery.trim().length < 3 || input.customerQuery.trim().length > 120
    || (input.titleQuery !== undefined
      && (typeof input.titleQuery !== "string"
        || (input.titleQuery.trim().length > 0 && input.titleQuery.trim().length < 3)
        || input.titleQuery.trim().length > 240))) {
    return { status: "invalid" };
  }
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized"
    || context.workspace?.id !== input.workspaceId) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const call = client.rpc.bind(client) as unknown as (
      name: "d5o_find_discover_candidates_v1", args: Record<string, unknown>
    ) => Promise<RpcResult>;
    const { data, error } = await call("d5o_find_discover_candidates_v1", {
      p_workspace_id: input.workspaceId,
      p_configuration_version_id: input.configurationVersionId,
      p_gate_key: input.gateKey,
      p_customer_query: input.customerQuery.trim(),
      p_title_query: input.titleQuery?.trim() || null,
    });
    if (error) {
      if (/(^|\W)(forbidden|unauthenticated|employee_verification_required|candidate_permission_denied)(\W|$)/.test(error.message)) {
        return { status: "denied" };
      }
      return { status: "unavailable" };
    }
    const result = data as Record<string, unknown> | null;
    if (!result || Object.keys(result).length !== 2
      || !Array.isArray(result.items) || result.items.length > 10
      || !result.items.every(validCandidate)
      || typeof result.legacyMatchPossible !== "boolean") return { status: "unavailable" };
    return { status: "ok", candidates: result.items, legacyMatchPossible: result.legacyMatchPossible };
  } catch {
    return { status: "unavailable" };
  }
}

