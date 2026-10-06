"use server";
import { redirect } from "next/navigation";
import { executeWorkCommand } from "@/lib/d5o/work-record/server";
import type { WorkCommand } from "@/lib/d5o/work-record/types";
export async function performProofAction(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const workId = String(form.get("workId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const destination = `/m1-proof?workspace=${encodeURIComponent(workspaceId)}&work=${encodeURIComponent(workId)}`;
  if (!["new_proof", "submit_proof", "decide"].includes(kind)) redirect(destination + "&result=invalid_command");
  let outcome = "recorded";
  try {
    await executeWorkCommand({ workspaceId, workId, expectedVersion: Number(form.get("recordVersion")),
      proofRevision: form.get("proofRevision") ? Number(form.get("proofRevision")) : null,
      commandId: String(form.get("commandId") ?? ""), kind: kind as WorkCommand["kind"],
      payload: kind === "decide" ? { rightKey: String(form.get("rightKey") ?? ""), reason: String(form.get("reason") ?? ""),
        ...(form.get("scopeKey") ? { scopeKey: String(form.get("scopeKey")), expiresAt: String(form.get("expiresAt")) } : {}) } : {}
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "command_failed";
    outcome = ["concurrency_conflict", "readiness_blocked", "wrong_authority", "forbidden", "proof_revision_stale", "invalid_proof_revision", "pinned_configuration_changed", "configuration_unavailable", "separation_of_duty"].includes(reason) ? reason : "command_failed";
  }
  redirect(destination + "&result=" + encodeURIComponent(outcome));
}
