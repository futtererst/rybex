import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { loadPrototypeWork } from "@/lib/d5o/prototype-work/store";
import { loadWorkCatalog } from "@/lib/d5o/work-catalog/store";
import { loadConfigurationInventory } from "@/lib/d5o/configuration/server";
import { listPortfolioWork, listQueueWork, loadIndexedWork, searchWorkspaceWork, type PortfolioFilter, type QueueFilter, type QueueView, type SearchFilter } from "@/lib/d5o/work-search/index";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  try {
    assertProofEnvironment();
    const context = await getRequestContext();
    const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
      ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
    if (!workspace) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (context.user?.id && await crewPersonForUser(workspace, context.user.id)) return reply({ error: "forbidden" }, 403);

    const params = request.nextUrl.searchParams;
    const query = (params.get("q") ?? "").trim().toLocaleLowerCase();
    const filter = params.get("filter") ?? "all";
    const owner = params.get("owner") ?? "";
    const role = params.get("role") ?? "all";
    const cursor = params.get("cursor");
    const recordId = params.get("record");
    const view = params.get("view");
    const rawPosition = params.get("position");
    const position = rawPosition === null ? null : Number(rawPosition);
    if (query.length > 120 || owner.length > 120 || role.length > 120 || (cursor?.length ?? 0) > 500
        || (view === null && !["all", "mine", "attention"].includes(filter))
        || (recordId !== null && (recordId.length < 1 || recordId.length > 120))
        || (view !== null && !["portfolio", "actions", "decisions"].includes(view))
        || (view === "portfolio" && (!(["all", "blocked", "attention", "moving", "complete"].includes(filter))
          || (rawPosition !== null && (position === null || !Number.isInteger(position) || position < 0 || position > 30))))
        || (view === "actions" && !["all", "mine", "waiting", "pricing", "proposal", "definition"].includes(filter))
        || (view === "decisions" && !["all", "blocked", "actionable", "completed"].includes(filter)))
      return reply({ error: "invalid_search" }, 400);

    const [snapshot, catalog, inventory] = await Promise.all([loadPrototypeWork(workspace), loadWorkCatalog(workspace), loadConfigurationInventory(context.workspace!.id)]);
    if (recordId) {
      const record = await loadIndexedWork(workspace, snapshot, catalog, inventory, recordId);
      return record ? reply({ record }) : reply({ error: "record_unavailable" }, 404);
    }
    if (view === "portfolio") return reply(await listPortfolioWork({ workspace, snapshot, catalog, query,
      filter: filter as PortfolioFilter, position, cursor, inventory }));
    if (view === "actions" || view === "decisions") return reply(await listQueueWork({ workspace, snapshot, catalog, inventory,
      view: view as QueueView, filter: filter as QueueFilter, owner, role, cursor }));
    return reply(await searchWorkspaceWork({ workspace, snapshot, catalog, query, filter: filter as SearchFilter, owner, cursor, inventory }));
  } catch (error) {
    if (error instanceof Error && error.message === "search_changed") return reply({ error: "search_changed", message: "The work list changed. Search again." }, 409);
    if (error instanceof Error && error.message === "invalid_cursor") return reply({ error: "invalid_cursor" }, 400);
    return reply({ error: "search_unavailable" }, 500);
  }
}
