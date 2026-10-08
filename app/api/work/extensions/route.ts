import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { assertProofEnvironment, executeWorkExtension, loadWorkExtensions, type WorkExtensionCommand } from "@/lib/d5o/work-record/server";
import type { JsonObject } from "@/lib/d5o/work-record/types";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds = new Set<WorkExtensionCommand["kind"]>(["create_package", "record_package_facts", "plan_lifecycle_action"]);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function authorizedWorkspace(workspaceId: string) {
  assertProofEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) return { status: 401 as const };
  if (context.status !== "authorized" || context.workspace?.id !== workspaceId || context.membership?.status !== "active") return { status: 403 as const };
  return { status: 200 as const };
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? "";
  const workId = request.nextUrl.searchParams.get("workId") ?? "";
  if (!uuid.test(workspaceId) || !uuid.test(workId)) return reply({ error: "invalid_target" }, 400);
  const scope = await authorizedWorkspace(workspaceId);
  if (scope.status !== 200) return reply({ error: "work_unavailable" }, scope.status);
  try { return reply({ extensions: await loadWorkExtensions(workspaceId, workId) }); }
  catch { return reply({ error: "work_unavailable" }, 404); }
}

export async function POST(request: NextRequest) {
  if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
  let raw: Record<string, unknown>;
  try { raw = await request.json() as Record<string, unknown>; }
  catch { return reply({ error: "invalid_command" }, 400); }
  const workspaceId = raw.workspaceId;
  const workId = raw.workId;
  if (typeof workspaceId !== "string" || !uuid.test(workspaceId) || typeof workId !== "string" || !uuid.test(workId)
      || !Number.isInteger(raw.expectedVersion) || typeof raw.commandId !== "string" || raw.commandId.length < 8
      || typeof raw.kind !== "string" || !kinds.has(raw.kind as WorkExtensionCommand["kind"])
      || typeof raw.payload !== "object" || raw.payload === null || Array.isArray(raw.payload)) return reply({ error: "invalid_command" }, 400);
  const scope = await authorizedWorkspace(workspaceId);
  if (scope.status !== 200) return reply({ error: "work_unavailable" }, scope.status);
  try {
    const result = await executeWorkExtension({ workspaceId, workId, expectedVersion: raw.expectedVersion as number,
      commandId: raw.commandId, kind: raw.kind as WorkExtensionCommand["kind"], payload: raw.payload as JsonObject });
    return reply({ result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "command_failed";
    if (code === "concurrency_conflict") return reply({ error: code }, 409);
    if (["wrong_authority", "forbidden"].includes(code)) return reply({ error: "forbidden" }, 403);
    if (["invalid_command", "invalid_package_facts", "package_unavailable", "unknown_command", "idempotency_mismatch", "pinned_configuration_changed"].includes(code)) return reply({ error: code }, 400);
    return reply({ error: "command_failed" }, 500);
  }
}
