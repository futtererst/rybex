import { NextRequest, NextResponse } from "next/server";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { hostedD5OTargetReady } from "@/lib/d5o/auth/hosted-target";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { applyPricingPolicyCommand, type PricingPolicyCommand } from "@/lib/d5o/prototype-work/pricing-policy-command";
import { assertSnapshotCommercialIntegrity } from "@/lib/d5o/prototype-work/commercial-command";
import { assertSnapshotDefineIntegrity } from "@/lib/d5o/prototype-work/define-command";
import { assertSnapshotDesignIntegrity } from "@/lib/d5o/prototype-work/design-command";
import { assertSnapshotDeployIntegrity } from "@/lib/d5o/prototype-work/deploy-command";
import { assertSnapshotOperateIntegrity } from "@/lib/d5o/prototype-work/operate-command";

export const dynamic = "force-dynamic";

type StateKey = "work" | "catalog" | "schedule";
type RpcError = { code?: string; message: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcName = "d5o_hosted_actor_v1" | "d5o_hosted_prototype_read_v1" |
  "d5o_hosted_prototype_save_v1";
type PrototypeResult = { revision: number; state: Record<string, unknown> | null };
const editors = new Set(["admin", "operations_leader", "project_manager", "field_supervisor"]);
const workspacePattern = /^[a-z][a-z0-9_-]{1,63}$/;
const stateKeys = new Set<StateKey>(["work", "catalog", "schedule"]);

const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

function errorReply(error: RpcError | null) {
  if (error?.code === "42501") return reply({ error: "workspace_forbidden" }, 403);
  if (error?.code === "23505") return reply({ error: "stale_state" }, 409);
  if (error?.code === "22023" || error?.code === "23514") return reply({ error: "invalid_state" }, 422);
  return reply({ error: "state_unavailable" }, 503);
}

async function scoped(workspace: string) {
  if (!hostedD5OTargetReady()) return { error: "hosted_unavailable", status: 503 as const };
  const client = await createRybexSupabaseServerClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { error: "unauthenticated", status: 401 as const };
  const call = client.rpc.bind(client) as unknown as
    (name: RpcName, args: Record<string, unknown>) => Promise<RpcResult>;
  const actor = await call("d5o_hosted_actor_v1", { p_workspace_key: workspace });
  if (actor.error || !actor.data || typeof actor.data !== "object")
    return { error: "workspace_forbidden", status: 403 as const };
  const role = (actor.data as { role?: string }).role ?? "";
  return { call, canEdit: editors.has(role), status: 200 as const };
}

function keyFrom(value: string | null): StateKey | null {
  return value && stateKeys.has(value as StateKey) ? value as StateKey : null;
}

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  const key = keyFrom(request.nextUrl.searchParams.get("key"));
  if (!workspacePattern.test(workspace) || !key) return reply({ error: "invalid_target" }, 400);
  if (key === "work" && request.nextUrl.searchParams.get("pricing") === "1") {
    try {
      const context = await hostedPrototypeContext(workspace);
      const loaded = await context.read("work");
      return reply({ revision: loaded.revision, policies: loaded.state?.pricingPolicies ?? [], active: loaded.state?.activePricingPolicy ?? null, history: context.actor.role === "admin" ? loaded.state?.pricingPolicyHistory ?? [] : [], canAdmin: context.actor.role === "admin", synthetic: true });
    } catch { return reply({ error: "policy_unavailable" }, 503); }
  }
  const scope = await scoped(workspace);
  if (!scope.call) return reply({ error: scope.error }, scope.status);
  const result = await scope.call("d5o_hosted_prototype_read_v1", {
    p_workspace_key: workspace, p_state_key: key
  });
  if (result.error) return errorReply(result.error);
  const read = result.data as PrototypeResult | null;
  if (!read || !Number.isInteger(read.revision)) return reply({ error: "invalid_response" }, 502);
  return reply({ state: read.state ? { ...read.state, revision: read.revision } : null,
    revision: read.revision, canEdit: scope.canEdit, synthetic: true });
}

export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const text = await request.text();
  if (request.nextUrl.searchParams.get("pricing") === "1") {
    if (text.length > 100_000) return reply({ error: "policy_too_large" }, 413);
    try {
      const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
      if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_target" }, 400);
      const command = JSON.parse(text) as PricingPolicyCommand;
      if (!command || !["save-draft", "publish", "activate"].includes(command.action) || !Number.isInteger(command.expectedRevision)) return reply({ error: "invalid_command" }, 400);
      const context = await hostedPrototypeContext(workspace);
      if (context.actor.role !== "admin") return reply({ error: "pricing_config_forbidden" }, 403);
      const loaded = await context.read("work");
      if (loaded.revision !== command.expectedRevision || !loaded.state) return reply({ error: "stale_state" }, 409);
      const next = applyPricingPolicyCommand(loaded.state, workspace as "rybex" | "rotork", context.actor, command);
      const saved = await context.save("work", loaded.revision, { ...next, revision: loaded.revision + 1 });
      return reply({ revision: saved.revision, policies: saved.state?.pricingPolicies, active: saved.state?.activePricingPolicy, history: saved.state?.pricingPolicyHistory, synthetic: true });
    } catch (error) { return reply({ error: error instanceof Error && "code" in error ? error.code : "policy_unavailable", message: error instanceof Error ? error.message : undefined }, error instanceof Error && "status" in error ? Number(error.status) : 503); }
  }
  if (text.length > 2_100_000) return reply({ error: "state_too_large" }, 413);
  let input: Record<string, unknown>;
  try { input = JSON.parse(text) as Record<string, unknown>; }
  catch { return reply({ error: "invalid_request" }, 400); }
  const workspace = input.workspace;
  const key = keyFrom(typeof input.key === "string" ? input.key : null);
  if (typeof workspace !== "string" || !workspacePattern.test(workspace) || !key
    || !Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0
    || !input.state || typeof input.state !== "object" || Array.isArray(input.state))
    return reply({ error: "invalid_request" }, 400);
  if (key !== "work") return reply({ error: "command_only_state" }, 403);
  if (key === "work" && (!Array.isArray((input.state as Record<string, unknown>).records) ||
      ((input.state as Record<string, unknown>).records as unknown[]).some((record) =>
        !record || typeof record !== "object" || Array.isArray(record) ||
        (record as Record<string, unknown>).workspace !== workspace)))
    return reply({ error: "workspace_mismatch" }, 400);
  const scope = await scoped(workspace);
  if (!scope.call) return reply({ error: scope.error }, scope.status);
  if (!scope.canEdit) return reply({ error: "workspace_forbidden" }, 403);
  const prior = key === "work" ? await scope.call("d5o_hosted_prototype_read_v1", { p_workspace_key: workspace, p_state_key: "work" }) : null;
  if (prior?.error) return errorReply(prior.error);
  const preserved = (prior?.data as PrototypeResult | null)?.state;
  if (key === "work" && Array.isArray(preserved?.records)) {
    try { assertSnapshotCommercialIntegrity(preserved.records, (input.state as { records: Record<string, unknown>[] }).records); assertSnapshotDefineIntegrity(preserved.records, (input.state as { records: Record<string, unknown>[] }).records); assertSnapshotDesignIntegrity(preserved.records, (input.state as { records: Record<string, unknown>[] }).records); assertSnapshotDeployIntegrity(preserved.records, (input.state as { records: Record<string, unknown>[] }).records); assertSnapshotOperateIntegrity(preserved.records, (input.state as { records: Record<string, unknown>[] }).records); }
    catch (error) { return reply({ error: error instanceof Error && "code" in error ? error.code : "protected_state_changed", message: error instanceof Error ? error.message : undefined }, error instanceof Error && "status" in error ? Number(error.status) : 409); }
  }
  const state = key === "work" ? { ...(input.state as Record<string, unknown>), pricingPolicies: preserved?.pricingPolicies ?? [], activePricingPolicy: preserved?.activePricingPolicy ?? null, pricingPolicyHistory: preserved?.pricingPolicyHistory ?? [] } : input.state;
  const result = await scope.call("d5o_hosted_prototype_save_v1", {
    p_workspace_key: workspace, p_state_key: key,
    p_expected_revision: input.expectedRevision, p_state: state
  });
  if (result.error) return errorReply(result.error);
  const saved = result.data as PrototypeResult | null;
  if (!saved || !Number.isInteger(saved.revision) || !saved.state)
    return reply({ error: "invalid_response" }, 502);
  return reply({ state: { ...saved.state, revision: saved.revision },
    revision: saved.revision, canEdit: true, synthetic: true });
}
