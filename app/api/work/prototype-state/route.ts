import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { loadPrototypeWork, PrototypeWorkError, savePrototypeWork, validatePrototypeRecords } from "@/lib/d5o/prototype-work/store";
import { mutatePrototypePricing } from "@/lib/d5o/prototype-work/store";
import { applyPricingPolicyCommand, type PricingPolicyCommand } from "@/lib/d5o/prototype-work/pricing-policy-command";

export const dynamic = "force-dynamic";
const editorRoles = new Set(["admin", "operations_leader", "project_manager", "field_supervisor"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function scope() {
  assertProofEnvironment();
  const context = await getRequestContext();
  const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
    ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
  return { context, workspace };
}

export async function GET(request: NextRequest) {
  try {
    const { context, workspace } = await scope();
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (context.user?.id && await crewPersonForUser(workspace, context.user.id)) return reply({ error: "forbidden" }, 403);
    const state = await loadPrototypeWork(workspace);
    if (request.nextUrl.searchParams.get("pricing") === "1") return reply({ revision: state.revision, policies: state.pricingPolicies ?? [], active: state.activePricingPolicy ?? null, history: context.role === "admin" ? state.pricingPolicyHistory ?? [] : [], canAdmin: context.role === "admin" });
    return reply({ state, canEdit: editorRoles.has(context.role ?? "") });
  } catch (error) {
    return reply({ error: error instanceof PrototypeWorkError ? error.code : "state_unavailable" }, error instanceof PrototypeWorkError ? error.status : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, workspace } = await scope();
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (!editorRoles.has(context.role ?? "") || !context.user?.id || !context.membership) return reply({ error: "forbidden" }, 403);
    if (await crewPersonForUser(workspace, context.user.id)) return reply({ error: "forbidden" }, 403);
    if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
    const text = await request.text();
    if (request.nextUrl.searchParams.get("pricing") === "1") {
      if (text.length > 100_000) return reply({ error: "policy_too_large" }, 413);
      const command = JSON.parse(text) as PricingPolicyCommand;
      if (!command || !["save-draft", "publish", "activate"].includes(command.action) || !Number.isInteger(command.expectedRevision)) return reply({ error: "invalid_command" }, 400);
      const state = await mutatePrototypePricing(workspace, command.expectedRevision, (current) => applyPricingPolicyCommand(current, workspace, { id: context.user!.id, role: context.membership!.role }, command));
      return reply({ revision: state.revision, policies: state.pricingPolicies, active: state.activePricingPolicy, history: state.pricingPolicyHistory });
    }
    if (text.length > 2_000_000) return reply({ error: "snapshot_too_large" }, 413);
    const input = JSON.parse(text) as { expectedRevision?: number; records?: unknown };
    const records = validatePrototypeRecords(workspace, input.records);
    const state = await savePrototypeWork(workspace, Number(input.expectedRevision), records);
    return reply({ state });
  } catch (error) {
    if (error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "invalid_request" }, 400);
  }
}
