"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createWorkRecord } from "@/lib/d5o/work-record/server";

/** Starts one scoped Work Record through the existing server-owned command contract. */
export async function startWorkRecord(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  let destination = "/work?result=create_failed";
  try {
    const created = await createWorkRecord({
      workspaceId,
      commandId: randomUUID(),
      title,
      workTypeKey: String(form.get("workTypeKey") ?? ""),
      gateKey: String(form.get("gateKey") ?? ""),
      configurationVersionId: String(form.get("configurationVersionId") ?? "")
    });
    destination = `/work/${encodeURIComponent(workspaceId)}/${encodeURIComponent(created.workId)}`;
  } catch {
    destination = "/work?result=create_failed";
  }
  redirect(destination);
}
