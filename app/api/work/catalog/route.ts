import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { CatalogError, loadWorkCatalog, mutateWorkCatalog } from "@/lib/d5o/work-catalog/store";
import type { CatalogMutation } from "@/components/d5o/platform/work-catalog-model";
import { loadConfigurationInventory } from "@/lib/d5o/configuration/server";
import { publishedWorkTypePinIsValid } from "@/components/d5o/platform/published-phase-configuration";
import { loadPrototypeWork } from "@/lib/d5o/prototype-work/store";

export const dynamic = "force-dynamic";
const editorRoles = new Set(["admin", "operations_leader", "project_manager", "field_supervisor"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

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
    return reply({ catalog: await loadWorkCatalog(workspace), canEdit: editorRoles.has(context.role ?? "") });
  } catch (error) { return reply({ error: error instanceof CatalogError ? error.code : "catalog_unavailable" }, error instanceof CatalogError ? error.status : 500); }
}

export async function POST(request: NextRequest) {
  try {
    const { context, workspace } = await scope();
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (!editorRoles.has(context.role ?? "") || !context.user?.id || !context.membership) return reply({ error: "forbidden" }, 403);
    if (await crewPersonForUser(workspace, context.user.id)) return reply({ error: "forbidden" }, 403);
    if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
    const input = await request.json() as CatalogMutation;
    if (input.action === "create-package") {
      const candidate = (await loadPrototypeWork(workspace)).records.find((record) => record.id === input.workId);
      const discovery = candidate?.discovery as { pursuitControl?: unknown; outcome?: string; designHandoff?: { status?: string } } | undefined;
      if (discovery?.pursuitControl && discovery.outcome === "Won" && discovery.designHandoff?.status !== "accepted")
        return reply({ error: "design_handoff_required", message: "The awarded work requires an accepted Design handoff before package planning." }, 409);
    }
    if (input.action === "create-record" || (input.action === "register-record" && input.record?.phaseConfigurationVersionId)) {
      const inventory = await loadConfigurationInventory(context.workspace!.id);
      const versionId = input.action === "create-record" ? input.phaseConfigurationVersionId : input.record.phaseConfigurationVersionId;
      const workType = input.action === "create-record" ? input.type : input.record.type;
      if (!versionId || !publishedWorkTypePinIsValid(inventory, workspace, workType, versionId, input.action === "create-record"))
        return reply({ error: "configuration_changed", message: "The published Work Type or active configuration changed. Refresh and retry." }, 409);
    }
    const result = await mutateWorkCatalog(workspace, { id: context.user.id, name: context.user.name }, input);
    return reply(result);
  } catch (error) {
    if (error instanceof CatalogError) return reply({ error: error.code, message: error.message }, error.status);
    return reply({ error: "invalid_request" }, 400);
  }
}
