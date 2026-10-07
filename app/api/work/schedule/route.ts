import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { loadSchedule, mutateSchedule, ScheduleError, type ScheduleMutation } from "@/lib/d5o/scheduling/store";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { deliverPublicationChanges, deliverySummary } from "@/lib/d5o/scheduling/notification-delivery";
import { loadPrototypeWork } from "@/lib/d5o/prototype-work/store";

export const dynamic = "force-dynamic";
const editorRoles = new Set(["admin", "operations_leader", "project_manager", "field_supervisor"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const safeDelivery = (workspace: WorkspaceKey) => deliverySummary(workspace).catch(() => ({ sent: 0, failed: 0, attempting: 0, unavailable: true }));

async function scope() {
  assertProofEnvironment();
  const context = await getRequestContext();
  const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
    ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
  return { context, workspace };
}

export async function GET() {
  try {
    const { context, workspace } = await scope();
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (context.user?.id && await crewPersonForUser(workspace, context.user.id)) return reply({ error: "forbidden" }, 403);
    return reply({ schedule: await loadSchedule(workspace), canEdit: editorRoles.has(context.role ?? ""), delivery: await safeDelivery(workspace) });
  } catch (error) { return reply({ error: error instanceof ScheduleError ? error.code : "schedule_unavailable" }, error instanceof ScheduleError ? error.status : 500); }
}

export async function POST(request: NextRequest) {
  try {
    const { context, workspace } = await scope();
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (!editorRoles.has(context.role ?? "") || !context.user?.id || !context.membership) return reply({ error: "forbidden" }, 403);
    if (!validLocalScheduleOrigin(request.headers))
      return reply({ error: "invalid_origin", message: "The schedule request did not come from this local workspace address. Reload the page and try again." }, 403);
    const input = await request.json() as ScheduleMutation;
    if (input.action === "save-demand") {
      const record = (await loadPrototypeWork(workspace)).records.find((item) => item.id === input.demand.workId);
      const discovery = record?.discovery as { pursuitControl?: unknown; outcome?: string; designHandoff?: { status?: string } } | undefined;
      if (discovery?.pursuitControl && (discovery.outcome !== "Won" || discovery.designHandoff?.status !== "accepted"))
        return reply({ error: "design_handoff_required", message: "Receive the awarded Develop handoff before setting Work Package crew demand." }, 409);
    }
    const before = await loadSchedule(workspace);
    const schedule = await mutateSchedule(workspace, { id: context.user.id, name: context.user.name, role: context.role ?? "" }, input);
    const previousIds = new Set(before.publications.map((item) => item.id));
    const publications = schedule.publications.filter((item) => !previousIds.has(item.id));
    let deliveryWarning = "";
    try { for (const publication of publications) await deliverPublicationChanges(schedule, publication); }
    catch { deliveryWarning = "The booking was shared in-app, but external delivery needs administrator review."; }
    return reply({ schedule, delivery: await safeDelivery(workspace), deliveryWarning });
  } catch (error) {
    if (error instanceof ScheduleError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "invalid_request" }, 400);
  }
}
