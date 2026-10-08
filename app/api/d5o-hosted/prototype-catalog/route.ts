import { NextRequest, NextResponse } from "next/server";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import type { CatalogMutation, SharedWorkCatalog } from "@/components/d5o/platform/work-catalog-model";
import { applyCatalogMutation, CatalogError, initialHostedCatalog } from "@/lib/d5o/work-catalog/store";
import { HostedStateError, hostedPrototypeContext } from "@/lib/d5o/hosted/prototype-context";
import { hostedSyntheticInventory } from "@/lib/d5o/hosted/synthetic-inventory";
import { publishedWorkTypePinIsValid } from "@/components/d5o/platform/published-phase-configuration";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";

export const dynamic = "force-dynamic";
const workspaces = new Set(["rybex", "rotork"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!workspaces.has(workspace)) return reply({ error: "invalid_target" }, 400);
  try {
    const context = await hostedPrototypeContext(workspace);
    const result = await context.read("catalog");
    const catalog = result.state
      ? { ...result.state, revision: result.revision } as SharedWorkCatalog
      : initialHostedCatalog(workspace as WorkspaceKey);
    return reply({ catalog, canEdit: context.canEdit, synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError) return reply({ error: error.code }, error.status);
    return reply({ error: "catalog_unavailable" }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  const workspace = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!workspaces.has(workspace)) return reply({ error: "invalid_target" }, 400);
  const body = await request.text();
  if (body.length > 20000) return reply({ error: "command_too_large" }, 413);
  try {
    const input = JSON.parse(body) as CatalogMutation;
    const context = await hostedPrototypeContext(workspace);
    if (!context.canEdit) return reply({ error: "workspace_forbidden" }, 403);
    if (input.action === "create-record" || input.action === "register-record") {
      const candidate = input.action === "create-record" ? input : input.record;
      const inventory = hostedSyntheticInventory(workspace as WorkspaceKey);
      if (!candidate.phaseConfigurationVersionId ||
        !publishedWorkTypePinIsValid(inventory, workspace as WorkspaceKey,
          candidate.type, candidate.phaseConfigurationVersionId, true))
        return reply({ error: "configuration_changed",
          message: "Select a Work Type from the active synthetic prototype configuration." }, 409);
    }
    if (input.action === "create-package") {
      const workState = await context.read("work");
      const candidate = (workState.state?.records as Array<Record<string, unknown>> | undefined)
        ?.find((record) => record.id === input.workId);
      const discovery = candidate?.discovery as { pursuitControl?: unknown; outcome?: string;
        designHandoff?: { status?: string } } | undefined;
      if (discovery?.pursuitControl && (discovery.outcome !== "Won"
        || discovery.designHandoff?.status !== "accepted"))
        return reply({ error: "design_handoff_required" }, 409);
    }
    const loaded = await context.read("catalog");
    const catalog = loaded.state
      ? { ...loaded.state, revision: loaded.revision } as SharedWorkCatalog
      : initialHostedCatalog(workspace as WorkspaceKey);
    const { created, changed } = applyCatalogMutation(workspace as WorkspaceKey,
      context.actor, catalog, input);
    if (!changed) return reply({ catalog, created, synthetic: true });
    const saved = await context.save("catalog", loaded.revision, catalog as unknown as Record<string, unknown>);
    return reply({ catalog: { ...saved.state, revision: saved.revision }, created, synthetic: true });
  } catch (error) {
    if (error instanceof HostedStateError || error instanceof CatalogError)
      return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "invalid_request" }, 400);
  }
}
