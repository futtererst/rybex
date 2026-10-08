import "server-only";

/**
 * Local review catalog for the two sealed M1 synthetic scenarios.  It is not
 * a database index and it deliberately does not bypass workspace RLS.  Each
 * record is still loaded through d5o_load_work_record_v1 for the signed-in
 * user's active workspace.
 */
export const prototypeCatalog = [
  {
    workspaceId: "5488a1a7-d6eb-460c-88a4-4629d742d705",
    workId: "ef995191-a5d7-4f66-9320-1cd67076f447",
    organization: "Rybex",
    journey: "Technical delivery · certification and turnover",
    description: "A governed turnover package showing test facts, quality verification, evidence and owner acceptance."
  },
  {
    workspaceId: "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6",
    workId: "bef9715d-5156-4030-a088-756244d3b3ba",
    organization: "Rotork",
    journey: "Modernization service · pilot-to-rollout authorization",
    description: "A governed pilot review showing commercial readiness, proof, authority and rollout consequences."
  }
] as const;

export function prototypeRecordForWorkspace(workspaceId: string) {
  return prototypeCatalog.find((record) => record.workspaceId === workspaceId);
}

/** Presentation-only label for the local two-scenario workspace. It never changes
 * the underlying workspace name, membership, or workspace-resolution boundary. */
export function prototypeWorkspaceLabel(workspaceId: string, fallback: string | undefined) {
  const record = prototypeRecordForWorkspace(workspaceId);
  return record ? `${record.organization} workspace` : fallback || "Unnamed workspace";
}
