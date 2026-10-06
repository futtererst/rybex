"use server";

import { saveDiscoverDraft, type DiscoverDraftFields } from "@/lib/d5o/discover/server";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";

type SaveOutcome =
  | { status: "saved"; commandId: string; workId: string; recordVersion: number; replayed: boolean }
  | { status: "conflict" | "denied" | "invalid" | "not_editable" | "configuration_unavailable"; commandId: string }
  | { status: "unknown_outcome"; commandId: string; retrySameCommand: true };

function field(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() || null : null;
}

function validDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A future test-only form must retain this command ID and payload on an unknown outcome. */
export async function saveDiscoverDraftAction(form: FormData): Promise<SaveOutcome> {
  assertProofEnvironment();
  const commandId = field(form, "commandId") ?? "";
  const workspaceId = field(form, "workspaceId") ?? "";
  const workId = field(form, "workId") ?? "";
  const expectedVersion = Number(field(form, "recordVersion"));
  const fields: DiscoverDraftFields = {
    customerContext: field(form, "customerContext"),
    siteContext: field(form, "siteContext"),
    needSummary: field(form, "needSummary"),
    sourceDescription: field(form, "sourceDescription"),
    dueOn: field(form, "dueOn"),
    knownRisk: field(form, "knownRisk"),
  };

  if (!workspaceId || !workId || !Number.isInteger(expectedVersion) || expectedVersion < 1
    || commandId.length < 8 || commandId.length > 200 || !validDate(fields.dueOn)) {
    return { status: "invalid", commandId };
  }
  try {
    const receipt = await saveDiscoverDraft({ workspaceId, workId, expectedVersion, commandId, fields });
    return { status: "saved", commandId, workId, recordVersion: receipt.recordVersion,
      replayed: receipt.replayed === true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "concurrency_conflict") return { status: "conflict", commandId };
    if (["forbidden", "wrong_authority", "unauthenticated"].includes(reason)) return { status: "denied", commandId };
    if (reason === "invalid_command") return { status: "invalid", commandId };
    if (reason === "draft_not_editable") return { status: "not_editable", commandId };
    if (["pinned_configuration_changed", "configuration_unavailable", "no_tenant_mapping",
      "ambiguous_tenant_mapping", "invalid_configuration_lineage"].includes(reason)) {
      return { status: "configuration_unavailable", commandId };
    }
    // A timeout or malformed response may follow a committed write. Never claim failure.
    return { status: "unknown_outcome", commandId, retrySameCommand: true };
  }
}
