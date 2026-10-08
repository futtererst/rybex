import { NextRequest, NextResponse } from "next/server";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { hostedSyntheticInventory } from "@/lib/d5o/hosted/synthetic-inventory";
import { applyDefineCommand, defineCommandFingerprint, type DefineCommand } from "@/lib/d5o/prototype-work/define-command";
import { PrototypeWorkError } from "@/lib/d5o/prototype-work/store-error";
import type { WorkRecord, WorkspaceKey } from "@/components/d5o/platform/work-types";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_workspace" }, 400);
  try {
    const raw = await request.text();
    if (raw.length > 20000) return reply({ error: "command_too_large" }, 413);
    const command = JSON.parse(raw) as DefineCommand;
    if (!command?.workId || !command.action || !command.commandId || !Number.isInteger(command.expectedRevision)) return reply({ error: "invalid_command" }, 400);
    const context = await hostedPrototypeContext(workspace);
    const allowed = context.canEdit || (context.actor.role === "billing_commercial_lead" && command.action.endsWith("review") && command.role === "commercial");
    if (!allowed) return reply({ error: "workspace_forbidden" }, 403);
    const loaded = await context.read("work"), records = loaded.state?.records as WorkRecord[] | undefined;
    const index = records?.findIndex((item) => item.id === command.workId && item.workspace === workspace) ?? -1;
    if (!records || index < 0) return reply({ error: "work_unavailable" }, 404);
    const replay = records[index].definition?.decisions?.find((item) => item.commandId === command.commandId);
    if (replay) {
      if (replay.actorId !== context.actor.id || replay.membershipId !== context.actor.membershipId || replay.fingerprint !== defineCommandFingerprint(command))
        return reply({ error: "command_reuse_conflict" }, 409);
      return reply({ state: { ...loaded.state, revision: loaded.revision }, synthetic: true, replay: true });
    }
    if (loaded.revision !== command.expectedRevision) return reply({ error: "stale_state" }, 409);
    const next = records.map((item, i) => i === index ? applyDefineCommand(item, command, context.actor, hostedSyntheticInventory(workspace as WorkspaceKey)) : item);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, records: next, revision: loaded.revision + 1 });
    return reply({ state: { ...saved.state, revision: saved.revision }, synthetic: true });
  } catch (error) {
    if (error instanceof PrototypeWorkError || error instanceof HostedStateError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "define_command_unavailable" }, 503);
  }
}
