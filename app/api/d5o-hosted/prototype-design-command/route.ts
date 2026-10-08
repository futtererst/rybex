import { NextRequest, NextResponse } from "next/server";
import { applyDesignCommand, type DesignCommand } from "@/lib/d5o/prototype-work/design-command";
import { PrototypeWorkError } from "@/lib/d5o/prototype-work/store-error";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import type { SharedSchedule } from "@/components/d5o/platform/schedule-model";
import { hostedSyntheticInventory } from "@/lib/d5o/hosted/synthetic-inventory";
import { resolvePublishedPhaseConfiguration } from "@/components/d5o/platform/published-phase-configuration";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_target" }, 400);
  const raw = await request.text(); if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
  try {
    const command = JSON.parse(raw) as DesignCommand;
    if (!command || !command.workId || !Number.isInteger(command.expectedRevision) || !command.commandId || !command.action) return reply({ error: "invalid_command" }, 400);
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    const loaded = await context.read("work");
    if (loaded.revision !== command.expectedRevision || !loaded.state) return reply({ error: "stale_state" }, 409);
    const records = loaded.state.records;
    if (!Array.isArray(records)) return reply({ error: "work_unavailable" }, 404);
    const index = records.findIndex((item) => item && typeof item === "object" && (item as WorkRecord).id === command.workId && (item as WorkRecord).workspace === workspace);
    if (index < 0) return reply({ error: "work_unavailable" }, 404);
    const schedule = command.action === "release-package" || command.action === "release-set" ? (await context.read("schedule")).state as SharedSchedule | null : null;
    const crewDemand = schedule?.packageDemands.find((item) => item.packageId === command.packageId && item.workId === command.workId) ?? null;
    const work = records[index] as WorkRecord;
    const config = resolvePublishedPhaseConfiguration(hostedSyntheticInventory(workspace as WorkRecord["workspace"]), work.workspace, work.type, work);
    if (work.discovery?.pursuitControl && !config) return reply({ error: "design_policy_unavailable" }, 409);
    const next = applyDesignCommand(work, command, context.actor, crewDemand, config?.designControls, schedule?.packageDemands ?? [], records as WorkRecord[]);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, revision: loaded.revision + 1, records: records.map((item, i) => i === index ? next : item) });
    return reply({ state: { ...saved.state, revision: saved.revision }, synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError || error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "design_command_unavailable" }, 503);
  }
}
