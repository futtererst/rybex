"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = { id: string; name: string };
type Site = Row & { accountId: string };
export type IdentityContext = {
  workId: string; recordVersion: number; accountId: string | null; siteId: string | null;
  linkedAt: string | null; accounts: Row[]; sites: Site[];
};
export type IdentityContextResult =
  | { status: "ok"; value: IdentityContext }
  | { status: "denied" | "unavailable" };
export type IdentityLinkResult =
  | { status: "linked"; workId: string; recordVersion: number; replayed: boolean }
  | { status: "denied" | "conflict" | "invalid" | "unavailable"; message: string }
  | { status: "unknown_outcome"; retrySameCommand: true };
type RpcResult = { data: unknown; error: { message: string } | null };

async function permitted(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized" && context.workspace?.id === workspaceId;
}

export async function loadDiscoverIdentityContext(workspaceId: string, workId: string): Promise<IdentityContextResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId) || !uuid.test(workId) || !(await permitted(workspaceId))) return { status: "denied" };
  try {
    const client = await createRybexSupabaseServerClient();
    const { data, error } = await (client.rpc.bind(client) as unknown as
      (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(
        "d5o_discover_trial_identity_context_v1", { p_workspace_id: workspaceId, p_work_id: workId });
    if (error) return /forbidden|unauthenticated|employee_verification_required|capture_permission_denied/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const raw = data as Partial<IdentityContext> | null;
    if (!raw || raw.workId !== workId || !Number.isInteger(raw.recordVersion)
      || !Array.isArray(raw.accounts) || !Array.isArray(raw.sites)
      || !raw.accounts.every(row => uuid.test(row.id) && typeof row.name === "string")
      || !raw.sites.every(row => uuid.test(row.id) && uuid.test(row.accountId) && typeof row.name === "string")
      || (raw.accountId !== null && (typeof raw.accountId !== "string" || !uuid.test(raw.accountId)))
      || (raw.siteId !== null && (typeof raw.siteId !== "string" || !uuid.test(raw.siteId)))) {
      return { status: "unavailable" };
    }
    return { status: "ok", value: raw as IdentityContext };
  } catch { return { status: "unavailable" }; }
}

export async function linkDiscoverIdentity(input: {
  workspaceId: string; workId: string; expectedVersion: number; commandId: string;
  accountId: string; siteId: string;
}): Promise<IdentityLinkResult> {
  assertDiscoverTrialEnvironment();
  if (!input || !uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !uuid.test(input.accountId) || !uuid.test(input.siteId)
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1
    || typeof input.commandId !== "string" || input.commandId.length < 8 || input.commandId.length > 200) {
    return { status: "invalid", message: "Select an account and one of its sites." };
  }
  if (!(await permitted(input.workspaceId))) return { status: "denied", message: "Your current identity cannot link this draft." };
  try {
    const client = await createRybexSupabaseServerClient();
    const { data, error } = await (client.rpc.bind(client) as unknown as
      (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(
        "d5o_link_discover_account_site_v1", {
          p_workspace_id: input.workspaceId, p_work_id: input.workId,
          p_expected_version: input.expectedVersion, p_command_id: input.commandId,
          p_account_id: input.accountId, p_site_id: input.siteId,
        });
    if (error) {
      if (/forbidden|unauthenticated|employee_verification_required|capture_permission_denied/.test(error.message))
        return { status: "denied", message: "Your current identity cannot link this draft." };
      if (/concurrency_conflict|idempotency_mismatch|already_linked|link_change_requires_review|draft_not_editable/.test(error.message))
        return { status: "conflict", message: "The draft or link changed. Reopen the Work record before deciding again." };
      if (/registry_link_invalid|invalid_command/.test(error.message))
        return { status: "invalid", message: "This account and site are not an active matching pair in your tenant." };
      if (/pinned_configuration_changed|configuration_mismatch|configuration_unavailable/.test(error.message))
        return { status: "unavailable", message: "The current Discover configuration is unavailable." };
      return { status: "unknown_outcome", retrySameCommand: true };
    }
    const receipt = data as { success?: boolean; workId?: string; recordVersion?: number;
      accountId?: string; siteId?: string; events?: { audit?: string; event?: string }; replayed?: boolean } | null;
    if (receipt?.success !== true || receipt.workId !== input.workId
      || receipt.accountId !== input.accountId || receipt.siteId !== input.siteId
      || !Number.isInteger(receipt.recordVersion) || !receipt.events?.audit || !receipt.events.event)
      return { status: "unknown_outcome", retrySameCommand: true };
    return { status: "linked", workId: input.workId, recordVersion: receipt.recordVersion as number,
      replayed: receipt.replayed === true };
  } catch { return { status: "unknown_outcome", retrySameCommand: true }; }
}
