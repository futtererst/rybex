"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const blockerKeys = new Set([
  "not_intake_draft", "account_site_link_required", "source_required",
  "source_reference_required", "work_type_required", "response_due_required",
  "customer_need_required", "triage_owner_required", "possible_existing_work",
  "independent_duplicate_disposition_not_commissioned", "independent_duplicate_review_required",
  "legacy_match_requires_source_review",
  "triage_owner_routing_not_commissioned", "triage_submission_not_commissioned",
]);
export type TriagePreflight = {
  workId: string; recordVersion: number; lifecycleState: string; checkedAt: string;
  facts: {
    identityLinked: boolean; identityCurrent: boolean; sourceRecorded: boolean;
    needRecorded: boolean; triageOwnerSelected: boolean; triageOwnerCurrent: boolean;
    possibleDuplicate: boolean; duplicateReviewCurrent: boolean; authorDisposition: string;
  };
  blockers: string[];
};
export type TriagePreflightResult =
  | { status: "ok"; value: TriagePreflight }
  | { status: "denied" | "unavailable" };
type RpcResult = { data: unknown; error: { message: string } | null };

export async function loadDiscoverTriagePreflight(workspaceId: string, workId: string): Promise<TriagePreflightResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return { status: "denied" };
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== workspaceId)
    return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const { data, error } = await (client.rpc.bind(client) as unknown as
      (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(
        "d5o_discover_trial_triage_preflight_v1", { p_workspace_id: workspaceId, p_work_id: workId });
    if (error) return /forbidden|unauthenticated|employee_verification_required|capture_permission_denied/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const value = data as Partial<TriagePreflight> | null;
    const facts = value?.facts;
    if (!value || value.workId !== workId || !Number.isInteger(value.recordVersion)
      || typeof value.lifecycleState !== "string" || typeof value.checkedAt !== "string"
      || !facts || typeof facts.identityLinked !== "boolean" || typeof facts.identityCurrent !== "boolean"
      || typeof facts.sourceRecorded !== "boolean" || typeof facts.needRecorded !== "boolean"
      || typeof facts.triageOwnerSelected !== "boolean" || typeof facts.triageOwnerCurrent !== "boolean"
      || typeof facts.possibleDuplicate !== "boolean" || typeof facts.duplicateReviewCurrent !== "boolean"
      || typeof facts.authorDisposition !== "string"
      || !Array.isArray(value.blockers) || !value.blockers.every(key => blockerKeys.has(key))) return { status: "unavailable" };
    return { status: "ok", value: value as TriagePreflight };
  } catch { return { status: "unavailable" }; }
}
