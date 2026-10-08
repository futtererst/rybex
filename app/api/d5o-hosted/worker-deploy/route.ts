import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import type { SharedSchedule } from "@/components/d5o/platform/schedule-model";
import { applyDeployCommand, deployCommandFingerprint, type DeployCommand } from "@/lib/d5o/prototype-work/deploy-command";
import { deployWorkerProjection } from "@/lib/d5o/prototype-work/deploy-worker-projection";
import { PrototypeWorkError } from "@/lib/d5o/prototype-work/store-error";
import { HostedStateError } from "@/lib/d5o/hosted/prototype-context";
import { hostedWorkerContext } from "@/lib/d5o/hosted/worker-context";
import { hostedSyntheticInventory } from "@/lib/d5o/hosted/synthetic-inventory";
import { resolvePublishedPhaseConfiguration } from "@/components/d5o/platform/published-phase-configuration";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";

export const dynamic = "force-dynamic";
const workspace = "rybex";
const bucket = "d5o-deploy-evidence";
const types = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const objectPath = (workId: string, id: string) => `${workspace}/${createHash("sha256").update(workId).digest("hex")}/${id}`;

function assigned(schedule: SharedSchedule, person: string, workId: string, packageId: string, bookingId: string, publicationId?: string) {
  const publication = schedule.publications.findLast((item) => item.id === publicationId || (!publicationId && item.assignments.some((assignment) => assignment.id === bookingId)));
  const booking = publication?.assignments.find((item) => item.id === bookingId && item.workId === workId && item.packageId === packageId && item.people.includes(person));
  const latest = publication && schedule.publications.filter((item) => item.week === publication.week).at(-1);
  return booking && latest?.id === publication?.id ? booking : null;
}
function scoped(work: WorkRecord, packageId: string, bookingId: string, actorId: string, revision: number) {
  return { state: { revision, records: [deployWorkerProjection(work, packageId, bookingId, actorId)] }, synthetic: true };
}
function failure(error: unknown) {
  if (error instanceof HostedStateError || error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
  return reply({ error: "worker_deploy_unavailable" }, 503);
}

export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  try {
    const raw = await request.text(); if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
    const command = JSON.parse(raw) as DeployCommand;
    if (!command?.workId || !command.packageId || !command.bookingId || !Number.isInteger(command.expectedRevision) || !command.commandId || command.action === "attach-evidence") return reply({ error: "invalid_command" }, 400);
    const context = await hostedWorkerContext(workspace);
    const [loaded, scheduleResult] = await Promise.all([context.read("work"), context.read("schedule")]);
    const records = loaded.state?.records as WorkRecord[] | undefined;
    const schedule = scheduleResult.state ? { ...scheduleResult.state, revision: scheduleResult.revision } as SharedSchedule : null;
    const index = records?.findIndex((item) => item.id === command.workId && item.workspace === workspace) ?? -1;
    if (index < 0 || !records || !schedule || !assigned(schedule, context.person, command.workId, command.packageId, command.bookingId, command.publicationId)) return reply({ error: "assignment_required" }, 403);
    const work = records[index], replay = work.deploy?.events.find((event) => event.commandId === command.commandId);
    if (replay) {
      if (replay.actorId !== context.actor.id || replay.membershipId !== context.actor.membershipId || replay.fingerprint !== deployCommandFingerprint(command)) return reply({ error: "command_reuse_conflict" }, 409);
      return reply({ ...scoped(work, command.packageId, command.bookingId, context.actor.id, loaded.revision), replay: true });
    }
    if (loaded.revision !== command.expectedRevision) return reply({ error: "stale_state" }, 409);
    const config = resolvePublishedPhaseConfiguration(hostedSyntheticInventory(workspace), workspace, work.type, work);
    if (work.phaseConfigurationVersionId && !config) return reply({ error: "deploy_policy_unavailable" }, 409);
    const next = applyDeployCommand(work, command, context.actor, schedule, undefined, config?.deployControls, records);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, revision: loaded.revision + 1, records: records.map((item, i) => i === index ? next : item) });
    return reply(scoped(next, command.packageId, command.bookingId, context.actor.id, saved.revision));
  } catch (error) { return failure(error); }
}

export async function PUT(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  let uploadedPath = "";
  let context: Awaited<ReturnType<typeof hostedWorkerContext>> | null = null;
  try {
    context = await hostedWorkerContext(workspace);
    const form = await request.formData(), file = form.get("file");
    const workId = String(form.get("workId") ?? ""), packageId = String(form.get("packageId") ?? ""), bookingId = String(form.get("bookingId") ?? "");
    const expectedRevision = Number(form.get("expectedRevision")), purpose = String(form.get("purpose") ?? "").trim(), caption = String(form.get("caption") ?? "").trim();
    if (!(file instanceof File) || !types.has(file.type) || file.size < 1 || file.size > 10_485_760 || !workId || !packageId || !bookingId || !purpose || !caption || !Number.isInteger(expectedRevision)) return reply({ error: "invalid_file" }, 400);
    const [loaded, scheduleResult] = await Promise.all([context.read("work"), context.read("schedule")]);
    const records = loaded.state?.records as WorkRecord[] | undefined;
    const schedule = scheduleResult.state ? { ...scheduleResult.state, revision: scheduleResult.revision } as SharedSchedule : null;
    const index = records?.findIndex((item) => item.id === workId && item.workspace === workspace) ?? -1;
    if (index < 0 || !records || !schedule || !assigned(schedule, context.person, workId, packageId, bookingId)) return reply({ error: "assignment_required" }, 403);
    if (expectedRevision !== loaded.revision) return reply({ error: "stale_state" }, 409);
    const work = records[index], config = resolvePublishedPhaseConfiguration(hostedSyntheticInventory(workspace), workspace, work.type, work);
    if (work.phaseConfigurationVersionId && !config) return reply({ error: "deploy_policy_unavailable" }, 409);
    const bytes = Buffer.from(await file.arrayBuffer()), id = randomUUID();
    uploadedPath = objectPath(workId, id);
    const uploaded = await context.admin.storage.from(bucket).upload(uploadedPath, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new HostedStateError("evidence_storage_unavailable", 503);
    const command: DeployCommand = { action: "attach-evidence", workId, packageId, bookingId, expectedRevision, commandId: randomUUID(), purpose, caption };
    const next = applyDeployCommand(work, command, context.actor, schedule, { id, filename: file.name.slice(0, 200), mimeType: file.type, sizeBytes: bytes.length, checksumSha256: createHash("sha256").update(bytes).digest("hex") }, config?.deployControls, records);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, revision: loaded.revision + 1, records: records.map((item, i) => i === index ? next : item) });
    return reply({ evidenceId: id, ...scoped(next, packageId, bookingId, context.actor.id, saved.revision) });
  } catch (error) {
    if (uploadedPath && context) await context.admin.storage.from(bucket).remove([uploadedPath]);
    return failure(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await hostedWorkerContext(workspace);
    const workId = request.nextUrl.searchParams.get("workId") ?? "", id = request.nextUrl.searchParams.get("evidenceId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "invalid_evidence" }, 400);
    const [loaded, scheduleResult] = await Promise.all([context.read("work"), context.read("schedule")]);
    const work = (loaded.state?.records as WorkRecord[] | undefined)?.find((item) => item.id === workId && item.workspace === workspace);
    const evidence = work?.deploy?.evidence.find((item) => item.id === id && item.uploaderId === context.actor.id);
    const schedule = scheduleResult.state as SharedSchedule | null;
    if (!evidence || !schedule || !schedule.publications.some((item) => item.assignments.some((booking) => booking.workId === workId && booking.packageId === evidence.packageId && booking.people.includes(context.person)))) return reply({ error: "evidence_missing" }, 404);
    const file = await context.admin.storage.from(bucket).download(objectPath(workId, id));
    if (file.error || !file.data) return reply({ error: "evidence_unavailable" }, 503);
    const bytes = Buffer.from(await file.data.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== evidence.checksumSha256) return reply({ error: "integrity_failed" }, 409);
    return new Response(bytes, { headers: { "Content-Type": evidence.mimeType, "Content-Disposition": `inline; filename="${evidence.filename.replace(/[^\w. -]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failure(error); }
}
