import "server-only";

import { getBillingV2PersistenceMode } from "./persistence-mode";
import * as databaseStore from "./database-store";
import * as localStore from "./persisted-store";

export {
  applyBillingV2PackageToSeedData,
  canonicalBillingV2BackupItemId,
  canonicalBillingV2ExposureId,
  canonicalBillingV2PackageId,
  canonicalBillingV2PayApplicationId,
  type BillingCommandCenterImpact,
  type BillingV2ActionState,
  type BillingV2SeedOverlay
} from "./persisted-store";

function selectedStore() {
  return getBillingV2PersistenceMode() === "database" ? databaseStore : localStore;
}

export async function getBillingBackupPackage(...args: Parameters<typeof localStore.getBillingBackupPackage>) {
  return selectedStore().getBillingBackupPackage(...args);
}

export async function resetBillingV2PersistedStoreForTesting(...args: Parameters<typeof localStore.resetBillingV2PersistedStoreForTesting>) {
  return selectedStore().resetBillingV2PersistedStoreForTesting(...args);
}

export async function createOrStartBillingBackupPackage(...args: Parameters<typeof localStore.createOrStartBillingBackupPackage>) {
  return selectedStore().createOrStartBillingBackupPackage(...args);
}

export async function saveBillingBackupPackageDetails(...args: Parameters<typeof localStore.saveBillingBackupPackageDetails>) {
  return selectedStore().saveBillingBackupPackageDetails(...args);
}

export async function attachBillingBackupEvidence(...args: Parameters<typeof localStore.attachBillingBackupEvidence>) {
  return selectedStore().attachBillingBackupEvidence(...args);
}

export async function validateBillingBackupPackage(...args: Parameters<typeof localStore.validateBillingBackupPackage>) {
  return selectedStore().validateBillingBackupPackage(...args);
}

export async function sendBillingBackupToCommercialReview(...args: Parameters<typeof localStore.sendBillingBackupToCommercialReview>) {
  return selectedStore().sendBillingBackupToCommercialReview(...args);
}

export async function recordBillingCommercialReviewDecision(...args: Parameters<typeof localStore.recordBillingCommercialReviewDecision>) {
  return selectedStore().recordBillingCommercialReviewDecision(...args);
}

export async function clearBillingBlocker(...args: Parameters<typeof localStore.clearBillingBlocker>) {
  return selectedStore().clearBillingBlocker(...args);
}

export async function listOpenBillingBlockers(...args: Parameters<typeof localStore.listOpenBillingBlockers>) {
  return selectedStore().listOpenBillingBlockers(...args);
}

export async function getBillingCommandCenterImpact(...args: Parameters<typeof localStore.getBillingCommandCenterImpact>) {
  return selectedStore().getBillingCommandCenterImpact(...args);
}

export async function getBillingV2ActionState(...args: Parameters<typeof localStore.getBillingV2ActionState>) {
  return selectedStore().getBillingV2ActionState(...args);
}

export async function getBillingV2SeedDataOverlay(...args: Parameters<typeof localStore.getBillingV2SeedDataOverlay>) {
  return selectedStore().getBillingV2SeedDataOverlay(...args);
}
