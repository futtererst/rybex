import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { applyOperateCommand, operateCommandFingerprint, type OperateCommand } from "@/lib/d5o/prototype-work/operate-command";
import { loadPrototypeWork, mutatePrototypeWorkWithRelated, PrototypeWorkError } from "@/lib/d5o/prototype-work/store";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import { loadConfigurationInventory } from "@/lib/d5o/configuration/server";
import { resolvePublishedPhaseConfiguration } from "@/components/d5o/platform/published-phase-configuration";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  try {
    assertProofEnvironment();
    if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
    const context = await getRequestContext();
    const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active" ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
    if (!workspace || !context.user?.id || !context.membership) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    const raw = await request.text(); if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
    const command = JSON.parse(raw) as OperateCommand;
    if (!command?.workId || !command.action || !command.commandId || !Number.isInteger(command.expectedRevision)) return reply({ error: "invalid_command" }, 400);
    const actor = { id: context.user.id, membershipId: context.membership.id, name: context.profile?.displayName ?? context.user.name, role: context.membership.role };
    const prior = await loadPrototypeWork(workspace), work = prior.records.find((item) => item.id === command.workId) as WorkRecord | undefined;
    if (!work) return reply({ error: "work_unavailable" }, 404);
    const replay = work.operate?.events.find((item) => item.commandId === command.commandId);
    if (replay) {
      if (replay.actorId !== actor.id || replay.membershipId !== actor.membershipId || replay.fingerprint !== operateCommandFingerprint(command)) return reply({ error: "command_reuse_conflict" }, 409);
      return reply({ state: prior, synthetic: true, replay: true });
    }
    const inventory = await loadConfigurationInventory(context.workspace!.id);
    const config = resolvePublishedPhaseConfiguration(inventory, workspace, work.type, work);
    if (work.phaseConfigurationVersionId && !config) return reply({ error: "operate_policy_unavailable", message: "The exact pinned Operate configuration is unavailable." }, 409);
    const state = await mutatePrototypeWorkWithRelated(workspace, command.expectedRevision, command.workId, (record, records) => applyOperateCommand(record as WorkRecord, records as WorkRecord[], command, actor, config?.operateControls, prior));
    return reply({ state, synthetic: true });
  } catch (error) {
    if (error instanceof PrototypeWorkError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "operate_command_unavailable" }, 503);
  }
}
