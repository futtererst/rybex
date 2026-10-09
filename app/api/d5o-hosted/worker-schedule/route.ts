import { NextRequest, NextResponse } from "next/server";
import { hostedWorkerContext } from "@/lib/d5o/hosted/worker-context";
import { HostedStateError } from "@/lib/d5o/hosted/prototype-context";
import { applyCrewResponse, type CrewResponseMutation, ScheduleError } from "@/lib/d5o/scheduling/store";
import { scheduleBookingContext, type SharedSchedule } from "@/components/d5o/platform/schedule-model";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";

export const dynamic = "force-dynamic";
const workspace = "rybex";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function view(state: SharedSchedule, person: string) {
  const latest = new Map<number, typeof state.publications[number]>();
  state.publications.forEach((item) => latest.set(item.week, item));
  return { workspace, person, revision: state.revision, bookings: [...latest.values()].flatMap((publication) => publication.assignments
    .filter((assignment) => assignment.people.includes(person))
    .map((assignment) => ({ publicationId: publication.id, publishedAt: publication.publishedAt,
      assignmentId: assignment.id, crew: assignment.crew, date: assignment.date, shift: assignment.shift,
      ...scheduleBookingContext(assignment), workId: assignment.workId, packageId: assignment.packageId,
      response: state.receipts.find((receipt) => receipt.publicationId === publication.id && receipt.assignmentId === assignment.id && receipt.recipient === person) ?? null }))) };
}
export async function GET() {
  try {
    if (process.env.D5O_ISOLATED_PILOT === "1") {
      const client = await createRybexSupabaseServerClient();
      const call = client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => Promise<{
        data: unknown; error: { code?: string; message: string } | null
      }>;
      const { data, error } = await call("d5o_hosted_worker_schedule_read_v1", { p_workspace_key: workspace });
      const scoped = data as { person?: string; state?: SharedSchedule; revision?: number } | null;
      if (error || !scoped?.person || !scoped.state) return reply({ error: "worker_schedule_unavailable" }, error?.code === "42501" ? 403 : 503);
      return reply(view({ ...scoped.state, revision: scoped.revision ?? 0 }, scoped.person));
    }
    const context = await hostedWorkerContext(workspace);
    const loaded = await context.read("schedule");
    if (!loaded.state) return reply({ error: "schedule_unavailable" }, 404);
    return reply(view({ ...loaded.state, revision: loaded.revision } as SharedSchedule, context.person));
  } catch (error) {
    if (error instanceof HostedStateError) return reply({ error: error.code }, error.status);
    return reply({ error: "schedule_unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  try {
    if (process.env.D5O_ISOLATED_PILOT === "1") {
      const input = await request.json() as CrewResponseMutation & { commandId?: string };
      if (!input.commandId || !Number.isInteger(input.expectedRevision)) return reply({ error: "command_identity_required" }, 400);
      const client = await createRybexSupabaseServerClient();
      const call = client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => Promise<{
        data: unknown; error: { code?: string; message: string } | null
      }>;
      const { data, error } = await call("d5o_hosted_crew_command_v1", {
        p_workspace_key: workspace, p_action: "respond-booking",
        p_input: { publicationId: input.publicationId,
          assignmentId: input.assignmentId, response: input.response },
        p_command_id: input.commandId, p_expected_revision: input.expectedRevision
      });
      const scoped = data as { person?: string; state?: SharedSchedule; revision?: number } | null;
      if (error || !scoped?.person || !scoped.state) return reply({ error: error?.message ?? "worker_response_unavailable" }, error?.code === "42501" ? 403 : error?.code === "23505" || error?.code === "23514" ? 409 : 503);
      return reply(view({ ...scoped.state, revision: scoped.revision ?? 0 }, scoped.person));
    }
    const context = await hostedWorkerContext(workspace);
    const input = await request.json() as CrewResponseMutation;
    const loaded = await context.read("schedule");
    if (!loaded.state) return reply({ error: "schedule_unavailable" }, 404);
    const schedule = { ...loaded.state, revision: loaded.revision } as SharedSchedule;
    applyCrewResponse(schedule, context.actor, context.person, input);
    const saved = await context.save("schedule", loaded.revision, schedule as unknown as Record<string, unknown>);
    return reply(view({ ...saved.state, revision: saved.revision } as SharedSchedule, context.person));
  } catch (error) {
    if (error instanceof HostedStateError || error instanceof ScheduleError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "invalid_request" }, 400);
  }
}
