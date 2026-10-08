import type { OperatingSliceConformanceSummary } from "../operating-slices/types";
import { canonicalCloseoutFinalBillingId } from "./demo-state";

export const closeoutFinalBillingOperatingSlice: OperatingSliceConformanceSummary = {
  sliceId: "closeout-final-billing-release",
  label: "Closeout final billing release",
  canonicalEntityId: canonicalCloseoutFinalBillingId,
  storeFilePath: ".rybexos-local/closeout-final-billing-store.json",
  schemaVersion: 1,
  resetHelperName: "resetCloseoutFinalBillingStoreForTesting",
  persistedStorePath: "lib/d5o/closeout-final-billing/persisted-store.ts",
  domainServicePath: "lib/d5o/closeout-final-billing/closeout-final-billing-service.ts",
  serverActionPath: "app/actions/closeout-final-billing.ts",
  appStatePath: "lib/d5o/closeout-final-billing/app-state.ts",
  serverActions: [
    "startCloseoutFinalBillingReleaseAction",
    "saveCloseoutRequirementAssessmentAction",
    "addCloseoutEvidenceReferenceAction",
    "validateCloseoutReleaseReadinessAction",
    "submitCloseoutReleaseForReviewAction",
    "recordCloseoutReleaseDecisionAction",
    "clearCloseoutFinalBillingBlockerAction"
  ],
  domainCommands: [
    "startCloseoutFinalBillingRelease",
    "saveCloseoutRequirementAssessment",
    "addCloseoutEvidenceReference",
    "validateCloseoutReleaseReadiness",
    "submitCloseoutReleaseForReview",
    "recordCloseoutReleaseDecision",
    "clearCloseoutFinalBillingBlocker"
  ],
  appStateOverlayFunction: "applyCloseoutFinalBillingToWorkspaceSummary",
  seedOverlayFunction: "applyCloseoutFinalBillingToSeedData",
  commandCenterDerivationHook: "deriveOperatingWorkflows(closeoutFinalBillingOverlay)",
  verifierCommand: "npm.cmd run closeout-final-billing:verify-persisted-slice",
  browserQaCommand: "npm.cmd run closeout-final-billing:qa",
  downstreamProjections: [
    "closeoutPackages",
    "closeoutRequirements",
    "acceptanceRecords",
    "payApplications",
    "lienWaivers",
    "commercialExposureItems"
  ]
};
