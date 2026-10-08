import { NextRequest, NextResponse } from "next/server";
import { applyDeployCommand, deployCommandFingerprint, type DeployCommand } from "@/lib/d5o/prototype-work/deploy-command";
import { PrototypeWorkError } from "@/lib/d5o/prototype-work/store-error";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import type { SharedSchedule } from "@/components/d5o/platform/schedule-model";
import { hostedSyntheticInventory } from "@/lib/d5o/hosted/synthetic-inventory";
import { resolvePublishedPhaseConfiguration } from "@/components/d5o/platform/published-phase-configuration";
import { createRybexSupabaseAdminClient } from "@/lib/d5o/auth/supabase-server";
import { createHash, randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const bucket = "d5o-deploy-evidence";
const types = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const objectPath = (workspace: string, workId: string, id: string) => `${workspace}/${createHash("sha256").update(workId).digest("hex")}/${id}`;
export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_target" }, 400);
  const raw = await request.text(); if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
  try {
    const command = JSON.parse(raw) as DeployCommand;
    if (!command?.workId || !Number.isInteger(command.expectedRevision) || !command.commandId || !command.action) return reply({ error: "invalid_command" }, 400);
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    const loaded = await context.read("work");
    if (!loaded.state) return reply({ error: "work_unavailable" }, 404);
    const records = loaded.state.records;
    if (!Array.isArray(records)) return reply({ error: "work_unavailable" }, 404);
    const index = records.findIndex((item) => item && typeof item === "object" && (item as WorkRecord).id === command.workId && (item as WorkRecord).workspace === workspace);
    if (index < 0) return reply({ error: "work_unavailable" }, 404);
    const replay = (records[index] as WorkRecord).deploy?.events.find((event) => event.commandId === command.commandId);
    if (replay) {
      if (replay.actorId !== context.actor.id || replay.membershipId !== context.actor.membershipId || replay.fingerprint !== deployCommandFingerprint(command)) return reply({ error: "command_reuse_conflict" }, 409);
      return reply({ state: { ...loaded.state, revision: loaded.revision }, synthetic: true, replay: true });
    }
    if (loaded.revision !== command.expectedRevision) return reply({ error: "stale_state" }, 409);
    const schedule = (await context.read("schedule")).state as SharedSchedule | null;
    const actor = { ...context.actor, person: null }; // Hosted crew identity binding is not yet provisioned; field self-service remains blocked.
    const work = records[index] as WorkRecord;
    const config = resolvePublishedPhaseConfiguration(hostedSyntheticInventory(workspace as WorkRecord["workspace"]), work.workspace, work.type, work);
    if (work.phaseConfigurationVersionId && !config) return reply({ error: "deploy_policy_unavailable" }, 409);
    const next = applyDeployCommand(work, command, actor, schedule, undefined, config?.deployControls);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, revision: loaded.revision + 1, records: records.map((item, i) => i === index ? next : item) });
    return reply({ state: { ...saved.state, revision: saved.revision }, synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError || error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "deploy_command_unavailable" }, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_target" }, 400);
  let uploadedPath = "";
  let admin: ReturnType<typeof createRybexSupabaseAdminClient> | null = null;
  try {
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    admin = createRybexSupabaseAdminClient();
    const form = await request.formData(), file = form.get("file");
    const workId = String(form.get("workId") ?? ""), packageId = String(form.get("packageId") ?? ""), bookingId = String(form.get("bookingId") ?? "");
    const expectedRevision = Number(form.get("expectedRevision")), purpose = String(form.get("purpose") ?? "").trim(), caption = String(form.get("caption") ?? "").trim();
    if (!(file instanceof File) || !types.has(file.type) || file.size < 1 || file.size > 10_485_760 || !workId || !packageId || !purpose || !caption || !Number.isInteger(expectedRevision)) return reply({ error: "invalid_file" }, 400);
    const [loaded, scheduleResult] = await Promise.all([context.read("work"), context.read("schedule")]);
    const records = loaded.state?.records as WorkRecord[] | undefined;
    const index = records?.findIndex((item) => item.id === workId && item.workspace === workspace) ?? -1;
    if (index < 0 || !records) return reply({ error: "work_unavailable" }, 404);
    if (expectedRevision !== loaded.revision) return reply({ error: "stale_state" }, 409);
    const work = records[index], config = resolvePublishedPhaseConfiguration(hostedSyntheticInventory(workspace as WorkRecord["workspace"]), work.workspace, work.type, work);
    if (work.phaseConfigurationVersionId && !config) return reply({ error: "deploy_policy_unavailable" }, 409);
    const bytes = Buffer.from(await file.arrayBuffer()), id = randomUUID();
    uploadedPath = objectPath(workspace, workId, id);
    const uploaded = await admin.storage.from(bucket).upload(uploadedPath, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new HostedStateError("evidence_storage_unavailable", 503);
    const command: DeployCommand = { action: "attach-evidence", workId, packageId, bookingId, expectedRevision, commandId: randomUUID(), purpose, caption };
    const next = applyDeployCommand(work, command, { ...context.actor, person: null }, scheduleResult.state as SharedSchedule | null, { id, filename: file.name.slice(0, 200), mimeType: file.type, sizeBytes: bytes.length, checksumSha256: createHash("sha256").update(bytes).digest("hex") }, config?.deployControls);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, revision: loaded.revision + 1, records: records.map((item, i) => i === index ? next : item) });
    return reply({ evidenceId: id, state: { ...saved.state, revision: saved.revision }, synthetic: true });
  } catch (error) {
    if (uploadedPath && admin) await admin.storage.from(bucket).remove([uploadedPath]);
    if (error instanceof HostedStateError || error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "evidence_upload_unavailable" }, 503);
  }
}

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_target" }, 400);
  try {
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    const workId = request.nextUrl.searchParams.get("workId") ?? "", id = request.nextUrl.searchParams.get("evidenceId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "invalid_evidence" }, 400);
    const loaded = await context.read("work");
    const work = (loaded.state?.records as WorkRecord[] | undefined)?.find((item) => item.id === workId && item.workspace === workspace);
    const evidence = work?.deploy?.evidence.find((item) => item.id === id);
    if (!evidence) return reply({ error: "evidence_missing" }, 404);
    const file = await createRybexSupabaseAdminClient().storage.from(bucket).download(objectPath(workspace, workId, id));
    if (file.error || !file.data) return reply({ error: "evidence_unavailable" }, 503);
    const bytes = Buffer.from(await file.data.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== evidence.checksumSha256) return reply({ error: "integrity_failed" }, 409);
    return new Response(bytes, { headers: { "Content-Type": evidence.mimeType, "Content-Disposition": `inline; filename="${evidence.filename.replace(/[^\w. -]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof HostedStateError) return reply({ error: error.code }, error.status);
    return reply({ error: "evidence_unavailable" }, 503);
  }
}
