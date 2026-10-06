import type { OperatingSliceConformanceSummary } from "../operating-slices/types";
import { canonicalFieldIssueId } from "./demo-state";

export const fieldIssueOperatingSlice: OperatingSliceConformanceSummary = {
  sliceId: "field-issue-escalation",
  label: "Field Issue Escalation",
  canonicalEntityId: canonicalFieldIssueId,
  storeFilePath: ".rybexos-local/field-issue-escalation-store.json",
  schemaVersion: 1,
  resetHelperName: "resetFieldIssueEscalationStoreForTesting",
  persistedStorePath: "lib/d5o/field-issue-escalation/persisted-store.ts",
  domainServicePath: "lib/d5o/field-issue-escalation/field-issue-service.ts",
  serverActionPath: "app/actions/field-issue-escalation.ts",
  appStatePath: "lib/d5o/field-issue-escalation/app-state.ts",
  serverActions: [
    "startFieldIssueEscalationAction",
    "saveFieldIssueAssessmentAction",
    "addFieldIssueEvidenceReferenceAction",
    "selectFieldIssueEscalationPathAction",
    "createRfiFromFieldIssueAction",
    "createChangeEventFromFieldIssueAction",
    "resolveFieldIssueEscalationAction"
  ],
  domainCommands: [
    "startFieldIssueEscalation",
    "saveFieldIssueAssessment",
    "addFieldIssueEvidenceReference",
    "selectFieldIssueEscalationPath",
    "createRfiFromFieldIssue",
    "createChangeEventFromFieldIssue",
    "resolveFieldIssueEscalation"
  ],
  appStateOverlayFunction: "applyFieldIssueEscalationToWorkspaceSummary",
  seedOverlayFunction: "applyFieldIssueToSeedData",
  commandCenterDerivationHook: "deriveOperatingWorkflows(fieldIssueOverlay)",
  verifierCommand: "npm.cmd run field-issue:verify-persisted-slice",
  browserQaCommand: "npm.cmd run field-issue:qa",
  downstreamProjections: [
    "dailyReports",
    "rfis",
    "changeEvents"
  ]
};
