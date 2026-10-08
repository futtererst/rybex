import { PrototypeWorkError } from "./store-error";

// Legacy stage/progress are presentation observations. They cannot be used as
// substitute phase decisions through a general Work Record snapshot.
const protectedFields = ["workspace", "stage", "status", "progress", "phaseConfigurationVersionId",
  "prototypeDecisionRights", "heldFrom", "heldNextAction", "heldNextActionDue", "heldNextActionImpact"] as const;

export function assertSnapshotPositionIntegrity(previous: Record<string, unknown>[], next: Record<string, unknown>[]) {
  const byId = new Map(next.map((record) => [record.id, record]));
  for (const oldRecord of previous) {
    const newRecord = byId.get(oldRecord.id);
    if (!newRecord) throw new PrototypeWorkError("work_deletion_requires_command", 409, "Existing Work Records require a controlled removal.");
    if (protectedFields.some((field) => JSON.stringify(oldRecord[field]) !== JSON.stringify(newRecord[field])))
      throw new PrototypeWorkError("protected_position_changed", 409, "Use the applicable phase command to change work position or its pinned basis.");
  }
}
