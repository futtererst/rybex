"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { saveRmJob, type RmJobPayload } from "@/lib/d5o/rm02-trial";

export async function saveJobAction(input: { workId: string;
  expectedRevision: number; commandId: string; mode: "save" | "ready";
  payload: RmJobPayload }) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  return workspaceId ? saveRmJob({ workspaceId, ...input }) : { status: "denied" as const };
}
