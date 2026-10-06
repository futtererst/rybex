import "server-only";

import { getFieldIssuePersistenceMode } from "./persistence-mode";
import * as databaseStore from "./database-store";
import * as localStore from "./persisted-store";

export {
  applyFieldIssueToSeedData,
  canonicalFieldIssueId,
  type FieldIssueActionState,
  type FieldIssueCommandCenterImpact,
  type FieldIssueSeedOverlay
} from "./persisted-store";

function selectedStore() {
  return getFieldIssuePersistenceMode() === "database" ? databaseStore : localStore;
}

export async function getFieldIssueEscalation(...args: Parameters<typeof localStore.getFieldIssueEscalation>) {
  return selectedStore().getFieldIssueEscalation(...args);
}

export async function resetFieldIssueEscalationStoreForTesting(...args: Parameters<typeof localStore.resetFieldIssueEscalationStoreForTesting>) {
  return selectedStore().resetFieldIssueEscalationStoreForTesting(...args);
}

export async function startFieldIssueEscalation(...args: Parameters<typeof localStore.startFieldIssueEscalation>) {
  return selectedStore().startFieldIssueEscalation(...args);
}

export async function saveFieldIssueAssessment(...args: Parameters<typeof localStore.saveFieldIssueAssessment>) {
  return selectedStore().saveFieldIssueAssessment(...args);
}

export async function addFieldIssueEvidenceReference(...args: Parameters<typeof localStore.addFieldIssueEvidenceReference>) {
  return selectedStore().addFieldIssueEvidenceReference(...args);
}

export async function selectFieldIssueEscalationPath(...args: Parameters<typeof localStore.selectFieldIssueEscalationPath>) {
  return selectedStore().selectFieldIssueEscalationPath(...args);
}

export async function createRfiFromFieldIssue(...args: Parameters<typeof localStore.createRfiFromFieldIssue>) {
  return selectedStore().createRfiFromFieldIssue(...args);
}

export async function createChangeEventFromFieldIssue(...args: Parameters<typeof localStore.createChangeEventFromFieldIssue>) {
  return selectedStore().createChangeEventFromFieldIssue(...args);
}

export async function resolveFieldIssueEscalation(...args: Parameters<typeof localStore.resolveFieldIssueEscalation>) {
  return selectedStore().resolveFieldIssueEscalation(...args);
}

export async function listOpenFieldIssues(...args: Parameters<typeof localStore.listOpenFieldIssues>) {
  return selectedStore().listOpenFieldIssues(...args);
}

export async function getFieldIssueCommandCenterImpact(...args: Parameters<typeof localStore.getFieldIssueCommandCenterImpact>) {
  return selectedStore().getFieldIssueCommandCenterImpact(...args);
}

export async function getFieldIssueActionState(...args: Parameters<typeof localStore.getFieldIssueActionState>) {
  return selectedStore().getFieldIssueActionState(...args);
}

export async function getFieldIssueSeedDataOverlay(...args: Parameters<typeof localStore.getFieldIssueSeedDataOverlay>) {
  return selectedStore().getFieldIssueSeedDataOverlay(...args);
}
