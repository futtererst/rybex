import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { loadConfigurationInventory } from "@/lib/d5o/configuration/server";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { applyCommercialCommand, type CommercialCommand } from "@/lib/d5o/prototype-work/commercial-command";
import { mutatePrototypeWork, PrototypeWorkError } from "@/lib/d5o/prototype-work/store";
import type { WorkRecord } from "@/components/d5o/platform/work-types";

export const dynamic = "force-dynamic";
const editorRoles = new Set(["admin", "operations_leader", "project_manager", "field_supervisor"]);
const actions = new Set(["save-detailed-estimate", "submit-solution", "approve-solution", "return-solution", "submit-pricing", "approve-margin-exception", "approve-pricing", "return-pricing", "submit-proposal", "approve-proposal", "return-proposal", "record-customer-submission", "record-customer-response", "start-negotiated-revision", "submit-design-handoff", "accept-design-handoff", "return-design-handoff"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    assertProofEnvironment();
    const context = await getRequestContext();
    const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
      ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (!editorRoles.has(context.role ?? "") || !context.user?.id || !context.membership) return reply({ error: "forbidden" }, 403);
    if (await crewPersonForUser(workspace, context.user.id)) return reply({ error: "forbidden" }, 403);
    if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
    const raw = await request.text();
    if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
    const command = JSON.parse(raw) as CommercialCommand;
    if (!command || typeof command.workId !== "string" || !command.workId || !actions.has(command.action)
        || !Number.isInteger(command.expectedRevision) || !Number.isInteger(command.packageRevision)
        || [command.note, command.dueDate, command.recipient, command.method, command.responseStatus, command.receivedAt, command.nextAction, command.followUpDue].some((value) => value !== undefined && typeof value !== "string")
        || command.handoffRevision !== undefined && (!Number.isInteger(command.handoffRevision) || command.handoffRevision < 1)
        || command.action === "save-detailed-estimate" && (!command.pricingInput || typeof command.pricingInput !== "object" || Array.isArray(command.pricingInput)))
      return reply({ error: "invalid_command" }, 400);
    const inventory = await loadConfigurationInventory(context.workspace!.id);
    const actor = { id: context.user.id, name: context.profile?.displayName ?? context.user.name, membershipId: context.membership.id, role: context.membership.role };
    const state = await mutatePrototypeWork(workspace, command.expectedRevision, command.workId,
      (record, current) => applyCommercialCommand(record as WorkRecord, command, actor, inventory, current) as unknown as Record<string, unknown>);
    return reply({ state });
  } catch (error) {
    if (error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "command_unavailable" }, 500);
  }
}
