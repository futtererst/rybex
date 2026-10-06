import "server-only";

import { getCloseoutFinalBillingPersistenceMode } from "./persistence-mode";
import * as databaseStore from "./database-store";
import * as localStore from "./persisted-store";

export {
  applyCloseoutFinalBillingToSeedData,
  canonicalCloseoutFinalBillingId,
  type CloseoutFinalBillingActionState,
  type CloseoutFinalBillingSeedOverlay
} from "./persisted-store";

function selectedStore() {
  return getCloseoutFinalBillingPersistenceMode() === "database" ? databaseStore : localStore;
}

export async function getCloseoutFinalBillingBlocker(...args: Parameters<typeof localStore.getCloseoutFinalBillingBlocker>) {
  return selectedStore().getCloseoutFinalBillingBlocker(...args);
}

export async function resetCloseoutFinalBillingStoreForTesting(...args: Parameters<typeof localStore.resetCloseoutFinalBillingStoreForTesting>) {
  return selectedStore().resetCloseoutFinalBillingStoreForTesting(...args);
}

export async function startCloseoutFinalBillingRelease(...args: Parameters<typeof localStore.startCloseoutFinalBillingRelease>) {
  return selectedStore().startCloseoutFinalBillingRelease(...args);
}

export async function saveCloseoutRequirementAssessment(...args: Parameters<typeof localStore.saveCloseoutRequirementAssessment>) {
  return selectedStore().saveCloseoutRequirementAssessment(...args);
}

export async function addCloseoutEvidenceReference(...args: Parameters<typeof localStore.addCloseoutEvidenceReference>) {
  return selectedStore().addCloseoutEvidenceReference(...args);
}

export async function validateCloseoutReleaseReadiness(...args: Parameters<typeof localStore.validateCloseoutReleaseReadiness>) {
  return selectedStore().validateCloseoutReleaseReadiness(...args);
}

export async function submitCloseoutReleaseForReview(...args: Parameters<typeof localStore.submitCloseoutReleaseForReview>) {
  return selectedStore().submitCloseoutReleaseForReview(...args);
}

export async function recordCloseoutReleaseDecision(...args: Parameters<typeof localStore.recordCloseoutReleaseDecision>) {
  return selectedStore().recordCloseoutReleaseDecision(...args);
}

export async function clearCloseoutFinalBillingBlocker(...args: Parameters<typeof localStore.clearCloseoutFinalBillingBlocker>) {
  return selectedStore().clearCloseoutFinalBillingBlocker(...args);
}

export async function listOpenCloseoutFinalBillingBlockers(...args: Parameters<typeof localStore.listOpenCloseoutFinalBillingBlockers>) {
  return selectedStore().listOpenCloseoutFinalBillingBlockers(...args);
}

export async function getCloseoutFinalBillingActionState(...args: Parameters<typeof localStore.getCloseoutFinalBillingActionState>) {
  return selectedStore().getCloseoutFinalBillingActionState(...args);
}

export async function getCloseoutFinalBillingSeedDataOverlay(...args: Parameters<typeof localStore.getCloseoutFinalBillingSeedDataOverlay>) {
  return selectedStore().getCloseoutFinalBillingSeedDataOverlay(...args);
}
