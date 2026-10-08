import { NextRequest, NextResponse } from "next/server";
import type { WorkspaceKey } from "@/components/d5o/platform/work-types";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import { applyCommercialCommand, type CommercialCommand } from "@/lib/d5o/prototype-work/commercial-command";
import { PrototypeWorkError } from "@/lib/d5o/prototype-work/store-error";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { hostedConfigurationInventory } from "@/lib/d5o/hosted/configuration-inventory";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";

export const dynamic = "force-dynamic";
const workspaces = new Set(["rybex", "rotork"]);
const actions = new Set(["save-detailed-estimate", "submit-solution", "approve-solution", "return-solution", "submit-pricing", "approve-margin-exception", "approve-pricing", "return-pricing",
  "submit-proposal", "approve-proposal", "return-proposal", "record-customer-submission",
  "record-customer-response", "start-negotiated-revision", "submit-design-handoff",
  "accept-design-handoff", "return-design-handoff"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!workspaces.has(workspace)) return reply({ error: "invalid_target" }, 400);
  const raw = await request.text();
  if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
  try {
    const command = JSON.parse(raw) as CommercialCommand;
    if (!command || typeof command.workId !== "string" || !command.workId
      || !actions.has(command.action) || !Number.isInteger(command.expectedRevision)
      || !Number.isInteger(command.packageRevision)
      || [command.note, command.dueDate, command.recipient, command.method,
        command.responseStatus, command.receivedAt, command.nextAction, command.followUpDue]
        .some((value) => value !== undefined && typeof value !== "string")
      || command.handoffRevision !== undefined
        && (!Number.isInteger(command.handoffRevision) || command.handoffRevision < 1)
      || command.action === "save-detailed-estimate" && (!command.pricingInput || typeof command.pricingInput !== "object" || Array.isArray(command.pricingInput)))
      return reply({ error: "invalid_command" }, 400);
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    const loaded = await context.read("work");
    if (loaded.revision !== command.expectedRevision) return reply({ error: "stale_state" }, 409);
    const state = loaded.state;
    const records = state?.records;
    if (!Array.isArray(records)) return reply({ error: "work_unavailable" }, 404);
    const index = records.findIndex((record) => record && typeof record === "object"
      && (record as WorkRecord).id === command.workId);
    if (index < 0) return reply({ error: "work_unavailable" }, 404);
    const current = records[index] as WorkRecord;
    if (current.workspace !== workspace) return reply({ error: "workspace_forbidden" }, 403);
    const next = applyCommercialCommand(current, command,
      { id: context.actor.id, name: context.actor.name,
        membershipId: context.actor.membershipId, role: context.actor.role },
      await hostedConfigurationInventory(workspace as WorkspaceKey), state as Record<string, unknown>);
    const nextState = { ...state, revision: loaded.revision + 1,
      records: records.map((record, position) => position === index ? next : record) };
    const saved = await context.save("work", loaded.revision, nextState);
    return reply({ state: { ...saved.state, revision: saved.revision }, synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError || error instanceof PrototypeWorkError)
      return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "command_unavailable" }, 503);
  }
}
