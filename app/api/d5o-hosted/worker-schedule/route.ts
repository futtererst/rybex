import { NextRequest, NextResponse } from "next/server";
import { hostedWorkerContext } from "@/lib/d5o/hosted/worker-context";
import { HostedStateError } from "@/lib/d5o/hosted/prototype-context";
import { applyCrewResponse, type CrewResponseMutation, ScheduleError } from "@/lib/d5o/scheduling/store";
import { scheduleBookingContext, type SharedSchedule } from "@/components/d5o/platform/schedule-model";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";

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
