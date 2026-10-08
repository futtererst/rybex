import type { OperatingSliceConformanceSummary } from "../operating-slices/types";

export const billingV2OperatingSlice: OperatingSliceConformanceSummary = {
  sliceId: "billing-v2-backup-cash-recovery",
  label: "Billing V2 backup cash recovery",
  canonicalEntityId: "billing-v2-package-bb-lake-001",
  storeFilePath: ".rybexos-local/billing-v2-store.json",
  schemaVersion: 1,
  resetHelperName: "resetBillingV2PersistedStoreForTesting",
  persistedStorePath: "lib/d5o/billing-v2/persisted-store.ts",
  domainServicePath: "lib/d5o/billing-v2/billing-v2-service.ts",
  serverActionPath: "app/actions/billing-v2.ts",
  appStatePath: "lib/d5o/billing-v2/app-state.ts",
  serverActions: [
    "startBillingBackupPackageAction",
    "saveBillingBackupPackageDetailsAction",
    "attachBillingBackupEvidenceAction",
    "validateBillingBackupPackageAction",
    "sendBillingBackupToCommercialReviewAction",
    "recordBillingCommercialReviewDecisionAction",
    "clearBillingBlockerAction"
  ],
  domainCommands: [
    "startBackupPackage",
    "saveBackupSummary",
    "saveRelatedSourceRecord",
    "saveAmountAffected",
    "saveEvidenceReference",
    "validatePackageReadiness",
    "sendPackageToCommercialReview",
    "approveCommercialReview",
    "requestCommercialReviewChanges",
    "rejectCommercialReview",
    "clearBillingBlocker"
  ],
  appStateOverlayFunction: "applyBillingV2CompletionToWorkspaceSummary",
  seedOverlayFunction: "applyBillingV2PackageToSeedData",
  commandCenterDerivationHook: "deriveOperatingWorkflows(billingOverlay)",
  verifierCommand: "npm.cmd run billing-v2:verify-persisted-slice",
  browserQaCommand: "npm.cmd run billing-v2:qa",
  downstreamProjections: [
    "billingBackupItems",
    "commercialExposureItems",
    "payApplications"
  ]
};
