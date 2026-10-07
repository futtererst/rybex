import { NextRequest, NextResponse } from "next/server";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import type { SharedWorkCatalog } from "@/components/d5o/platform/work-catalog-model";
import { applyScheduleMutation, initialHostedSchedule, ScheduleError,
  type ScheduleMutation } from "@/lib/d5o/scheduling/store";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";

export const dynamic = "force-dynamic";
const workspaces = new Set(["rybex", "rotork"]);
const delivery = { sent: 0, failed: 0, attempting: 0, unavailable: true };
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!workspaces.has(workspace)) return reply({ error: "invalid_target" }, 400);
  try {
    const context = await hostedPrototypeContext(workspace);
    const loaded = await context.read("schedule");
    const schedule = loaded.state
      ? { ...loaded.state, revision: loaded.revision }
      : initialHostedSchedule(workspace as WorkspaceKey);
    return reply({ schedule, canEdit: context.canEdit, delivery, synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError) return reply({ error: error.code }, error.status);
    return reply({ error: "schedule_unavailable" }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!workspaces.has(workspace)) return reply({ error: "invalid_target" }, 400);
  const body = await request.text();
  if (body.length > 1_000_000) return reply({ error: "command_too_large" }, 413);
  try {
    const input = JSON.parse(body) as ScheduleMutation;
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    const loaded = await context.read("schedule");
    const schedule = loaded.state
      ? { ...loaded.state, revision: loaded.revision } as ReturnType<typeof initialHostedSchedule>
      : initialHostedSchedule(workspace as WorkspaceKey);
    const catalogResult = await context.read("catalog");
    const catalog = catalogResult.state as SharedWorkCatalog | null;
    const changed = await applyScheduleMutation(schedule, workspace as WorkspaceKey,
      context.actor, input,
      async (workId, packageId) => Boolean(catalog?.packages.some((item) =>
        item.workId === workId && item.id === packageId)));
    if (!changed) return reply({ schedule, delivery, synthetic: true });
    const saved = await context.save("schedule", loaded.revision,
      schedule as unknown as Record<string, unknown>);
    return reply({ schedule: { ...saved.state, revision: saved.revision }, delivery,
      deliveryWarning: "The booking is shared in-app. External notification is not configured for this hosted prototype.",
      synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError || error instanceof ScheduleError)
      return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "invalid_request" }, 400);
  }
}
