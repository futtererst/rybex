"use server";

import { redirect } from "next/navigation";
import { executeWorkCommand, executeWorkExtension, type WorkExtensionCommand } from "@/lib/d5o/work-record/server";
import type { WorkCommand } from "@/lib/d5o/work-record/types";

const expectedFailures = new Set(["concurrency_conflict", "readiness_blocked", "wrong_authority", "forbidden", "proof_revision_stale", "invalid_proof_revision", "pinned_configuration_changed", "configuration_unavailable", "separation_of_duty"]);

export async function performWorkspaceDecision(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const workId = String(form.get("workId") ?? "");
  const destination = `/work/${encodeURIComponent(workspaceId)}/${encodeURIComponent(workId)}`;
  const kind = String(form.get("kind") ?? "");
  const returnTo = form.get("returnTo") === "prepare-proof" ? "prepare-proof" : "take-action";
  if (!(["new_proof", "submit_proof", "decide"] as string[]).includes(kind)) redirect(`${destination}?result=invalid_command#${returnTo}`);
  let result = "recorded";

  try {
    await executeWorkCommand({
      workspaceId,
      workId,
      expectedVersion: Number(form.get("recordVersion")),
      proofRevision: form.get("proofRevision") ? Number(form.get("proofRevision")) : null,
      commandId: String(form.get("commandId") ?? ""),
      kind: kind as WorkCommand["kind"],
      payload: kind === "decide" ? {
        rightKey: String(form.get("rightKey") ?? ""),
        reason: String(form.get("reason") ?? ""),
        ...(form.get("scopeKey") ? { scopeKey: String(form.get("scopeKey")), expiresAt: String(form.get("expiresAt")) } : {})
      } : {}
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "command_failed";
    result = expectedFailures.has(message) ? message : "command_failed";
  }

  redirect(`${destination}?result=${encodeURIComponent(result)}#${returnTo}`);
}

export async function performWorkExtension(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const workId = String(form.get("workId") ?? "");
  const destination = `/work/${encodeURIComponent(workspaceId)}/${encodeURIComponent(workId)}`;
  const kind = String(form.get("kind") ?? "");
  const returnTo = kind === "plan_lifecycle_action" ? "handoff" : kind === "create_package" ? "plan" : "execution";
  if (!["create_package", "record_package_facts", "plan_lifecycle_action"].includes(kind)) redirect(`${destination}?result=invalid_command#${returnTo}`);
  let result = "recorded";
  try {
    const payload = kind === "create_package"
      ? { key: String(form.get("packageKey") ?? ""), name: String(form.get("name") ?? "") }
      : kind === "record_package_facts"
        ? { packageId: String(form.get("packageId") ?? ""), installed: Number(form.get("installed")), tested: Number(form.get("tested")) }
        : { action: String(form.get("action") ?? ""), dueAt: form.get("dueAt") ? `${String(form.get("dueAt"))}T12:00:00Z` : null };
    await executeWorkExtension({ workspaceId, workId, expectedVersion: Number(form.get("recordVersion")),
      commandId: String(form.get("commandId") ?? ""), kind: kind as WorkExtensionCommand["kind"], payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "command_failed";
    result = [...expectedFailures, "invalid_package_facts", "package_unavailable", "idempotency_mismatch", "work_closed", "proof_revision_required"].includes(message) ? message : "command_failed";
  }
  redirect(`${destination}?result=${encodeURIComponent(result)}#${returnTo}`);
}
