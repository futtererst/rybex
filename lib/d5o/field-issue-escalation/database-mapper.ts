import "server-only";

import type { FieldIssueActionState } from "./persisted-store";

export function assertDatabaseFieldIssueState(value: unknown): asserts value is FieldIssueActionState {
  if (!value || typeof value !== "object" || !("issue" in value)) {
    throw new Error("Field Issue database payload did not include a canonical issue.");
  }
}
