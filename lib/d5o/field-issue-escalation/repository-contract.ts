import "server-only";

import type { FieldIssueActionState, FieldIssueSeedOverlay } from "./persisted-store";
import type { FieldIssueEscalation } from "./types";

export type FieldIssueRepository = {
  getFieldIssueEscalation(issueId?: string): Promise<FieldIssueEscalation>;
  getFieldIssueActionState(issueId?: string): Promise<FieldIssueActionState>;
  getFieldIssueSeedDataOverlay(): Promise<FieldIssueSeedOverlay>;
  listOpenFieldIssues(): Promise<FieldIssueEscalation[]>;
};
