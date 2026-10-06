import type { SharedWorkCatalog } from "./work-catalog-model";
import type { SharedSchedule, WorkspaceKey } from "./schedule-model";

type SourceRecord = { id: string; workspace: WorkspaceKey };

/** A portable snapshot of presentation state, never an authoritative proof package. */
export async function downloadPrototypeSnapshot<T extends SourceRecord>(
  workspace: WorkspaceKey,
  records: T[],
  catalog: SharedWorkCatalog,
  schedule: SharedSchedule,
  prototypeConfiguration: { workTypes: string[]; accent: string; foundation: string }
) {
  const selected = records.filter((record) => record.workspace === workspace);
  if (!selected.length || selected.some((record) => !record.id)) throw new Error("Workspace records are unavailable for export.");
  if (catalog.workspace !== workspace) throw new Error("Work catalog workspace mismatch.");
  if (schedule.workspace !== workspace) throw new Error("Schedule workspace mismatch.");
  if (!Array.isArray(prototypeConfiguration.workTypes) || !prototypeConfiguration.workTypes.every((item) => typeof item === "string")) throw new Error("Prototype Work Type settings are unavailable.");

  const payload = {
    format: "d5o-prototype-source-snapshot-v1",
    exportedAt: new Date().toISOString(),
    browserOrigin: window.location.origin,
    workspace,
    authority: "presentation-state-only",
    prototypeConfiguration,
    records: selected.map((record) => ({
      source: { system: "d5o-local-prototype", type: "work_record", key: record.id },
      canonicalWorkId: null,
      presentation: record
    })),
    sharedCatalog: {
      workspace: catalog.workspace,
      revision: catalog.revision,
      records: catalog.records,
      packages: catalog.packages
    },
    scheduleReferences: {
      workspace: schedule.workspace,
      revision: schedule.revision,
      anchorDate: schedule.anchorDate,
      assignments: schedule.assignments,
      packageDemands: schedule.packageDemands
    }
  };
  const content = JSON.stringify(payload);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const output = new Blob([JSON.stringify({ payload, payloadSha256: sha256 }, null, 2)], { type: "application/json" });
  const address = URL.createObjectURL(output);
  const link = document.createElement("a");
  link.href = address;
  link.download = `d5o-${workspace}-prototype-source-${window.location.port}-${payload.exportedAt.replace(/[:.]/g, "-")}.json`;
  document.body.append(link);
  try { link.click(); }
  finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(address), 1000); }
  return { recordCount: selected.length, sha256 };
}
