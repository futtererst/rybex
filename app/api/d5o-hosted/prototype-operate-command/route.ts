import { NextRequest, NextResponse } from "next/server";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { applyOperateCommand, operateCommandFingerprint, type OperateCommand } from "@/lib/d5o/prototype-work/operate-command";
import { PrototypeWorkError } from "@/lib/d5o/prototype-work/store-error";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import { hostedConfigurationInventory } from "@/lib/d5o/hosted/configuration-inventory";
import { resolvePublishedPhaseConfiguration } from "@/components/d5o/platform/published-phase-configuration";
import { createRybexSupabaseAdminClient } from "@/lib/d5o/auth/supabase-server";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!["rybex", "rotork"].includes(workspace)) return reply({ error: "invalid_workspace" }, 400);
  try {
    const raw = await request.text(); if (raw.length > 100_000) return reply({ error: "command_too_large" }, 413);
    const command = JSON.parse(raw) as OperateCommand;
    if (!command?.workId || !command.action || !command.commandId || !Number.isInteger(command.expectedRevision)) return reply({ error: "invalid_command" }, 400);
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit && !(command.action === "update-finance" && context.actor.role === "billing_commercial_lead"))
      return reply({ error: "workspace_forbidden" }, 403);
    const loaded = await context.read("work"), records = loaded.state?.records as WorkRecord[] | undefined;
    const index = records?.findIndex((item) => item.id === command.workId && item.workspace === workspace) ?? -1;
    if (!records || index < 0) return reply({ error: "work_unavailable" }, 404);
    const replay = records[index].operate?.events.find((item) => item.commandId === command.commandId);
    if (replay) {
      if (replay.actorId !== context.actor.id || replay.membershipId !== context.actor.membershipId || replay.fingerprint !== operateCommandFingerprint(command)) return reply({ error: "command_reuse_conflict" }, 409);
      return reply({ state: { ...loaded.state, revision: loaded.revision }, synthetic: true, replay: true });
    }
    if (loaded.revision !== command.expectedRevision) return reply({ error: "stale_state" }, 409);
    const config = resolvePublishedPhaseConfiguration(await hostedConfigurationInventory(workspace as WorkRecord["workspace"]), records[index].workspace, records[index].type, records[index]);
    if (records[index].phaseConfigurationVersionId && !config) return reply({ error: "operate_policy_unavailable", message: "The exact pinned Operate configuration is unavailable." }, 409);
    const changed = applyOperateCommand(records[index], records, command, context.actor, config?.operateControls, loaded.state ?? undefined);
    if (changed.related && records.some((item) => item.id === changed.related?.id)) return reply({ error: "related_work_conflict" }, 409);
    const relatedIndex = changed.updatedRelated ? records.findIndex((item) => item.id === changed.updatedRelated?.id) : -1;
    if (changed.updatedRelated && (relatedIndex < 0 || relatedIndex === index || changed.updatedRelated.workspace !== workspace || changed.updatedRelated.serviceSource?.parentWorkId !== command.workId || records[relatedIndex].serviceSource?.parentWorkId !== command.workId)) return reply({ error: "related_work_conflict" }, 409);
    const next = records.map((item, i) => i === index ? changed.work : item);
    if (changed.updatedRelated) next[relatedIndex] = changed.updatedRelated;
    if (process.env.D5O_ISOLATED_PILOT === "1" && changed.related) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(command.commandId)
        || !records[index].canonicalWorkId)
        return reply({ error: "canonical_parent_required" }, 409);
      const catalog = await context.read("catalog");
      const admin = createRybexSupabaseAdminClient();
      const call = admin.rpc.bind(admin) as unknown as (name: string, args: Record<string, unknown>) =>
        Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
      const created = await call("d5o_hosted_create_related_work_v1", {
        p_workspace_key: workspace, p_command_id: command.commandId,
        p_action: command.action, p_parent_presentation_id: command.workId,
        p_expected_work_revision: loaded.revision,
        p_expected_catalog_revision: catalog.revision,
        p_parent_after: changed.work, p_child: changed.related,
        p_actor_user_id: context.actor.id, p_membership_id: context.actor.membershipId
      });
      if (created.error) return reply({ error: created.error.message },
        created.error.code === "23505" ? 409 : created.error.code === "42501" ? 403 :
          created.error.code === "22023" ? 422 : 503);
      const saved = await context.read("work");
      return reply({ state: { ...saved.state, revision: saved.revision },
        relatedIdentity: created.data, synthetic: true });
    }
    if (changed.related) next.push(changed.related);
    const saved = await context.save("work", loaded.revision, { ...loaded.state, revision: loaded.revision + 1, records: next });
    return reply({ state: { ...saved.state, revision: saved.revision }, synthetic: true });
  } catch (error) {
    if (error instanceof PrototypeWorkError || error instanceof HostedStateError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "operate_command_unavailable" }, 503);
  }
}
