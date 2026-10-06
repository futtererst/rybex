"use server";

import { captureDiscoverDraftAction, editDiscoverDraftAction } from "@/lib/d5o/discover/capture-action";
import { findDiscoverCandidates } from "@/lib/d5o/discover/capture-candidates";
import { listOwnDiscoverCaptures, type OwnDiscoverSort, type OwnDiscoverState } from "@/lib/d5o/discover/capture-list";
import { loadOwnDiscoverCapture } from "@/lib/d5o/discover/capture-read";
import type { CaptureDraft } from "@/lib/d5o/discover/capture-contract";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { linkDiscoverIdentity, loadDiscoverIdentityContext } from "@/lib/d5o/discover/identity-link";
import { loadDiscoverTriagePreflight } from "@/lib/d5o/discover/triage-preflight";
import { listDiscoverTriageOwners } from "@/lib/d5o/discover/triage-owners";
import { submitDiscoverTriage } from "@/lib/d5o/discover/triage-transfer";
import { listWorkspaceOpportunities } from "@/lib/d5o/discover/workspace-opportunities";

const trialConfig: Record<string, string> = {
  "a2000000-0000-4000-8000-000000000001": "a8000000-0000-4000-8000-000000000001",
  "a2000000-0000-4000-8000-000000000002": "a8000000-0000-4000-8000-000000000002",
};
const gateKey = "discover-intake";

export async function trialListDrafts(workspaceId: string, query: string,
  state: OwnDiscoverState = "all", sort: OwnDiscoverSort = "newest",
  cursor?: { updatedAt: string; workId: string }) {
  assertDiscoverTrialEnvironment();
  const configurationVersionId = trialConfig[workspaceId];
  if (!configurationVersionId) return { status: "denied" as const };
  return listOwnDiscoverCaptures({ workspaceId, configurationVersionId, gateKey, query, state, sort, cursor });
}

export async function trialListWorkspaceOpportunities(workspaceId: string, query: string,
  state: OwnDiscoverState = "all", sort: OwnDiscoverSort = "newest",
  cursor?: { updatedAt: string; workId: string }) {
  assertDiscoverTrialEnvironment();
  const configurationVersionId = trialConfig[workspaceId];
  if (!configurationVersionId) return { status: "denied" as const };
  return listWorkspaceOpportunities({ workspaceId, configurationVersionId, query, state, sort, cursor });
}

export async function trialLoadDraft(workspaceId: string, workId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialConfig[workspaceId]) return { status: "denied" as const };
  return loadOwnDiscoverCapture(workspaceId, workId);
}

export async function trialFindCandidates(workspaceId: string, customerContext: string, title: string) {
  assertDiscoverTrialEnvironment();
  const configurationVersionId = trialConfig[workspaceId];
  if (!configurationVersionId) return { status: "denied" as const };
  return findDiscoverCandidates({
    workspaceId, configurationVersionId, gateKey,
    customerQuery: customerContext, titleQuery: title,
  });
}

export async function trialCaptureDraft(workspaceId: string, commandId: string, draft: CaptureDraft) {
  assertDiscoverTrialEnvironment();
  const configurationVersionId = trialConfig[workspaceId];
  if (!configurationVersionId) {
    return { status: "denied" as const, message: "This trial workspace is unavailable." };
  }
  return captureDiscoverDraftAction({
    workspaceId, configurationVersionId, gateKey, commandId, draft,
  });
}

export async function trialEditDraft(workspaceId: string, workId: string,
  expectedVersion: number, commandId: string, draft: CaptureDraft) {
  assertDiscoverTrialEnvironment();
  if (!trialConfig[workspaceId]) {
    return { status: "denied" as const, message: "This trial workspace is unavailable." };
  }
  return editDiscoverDraftAction({ workspaceId, workId, expectedVersion, commandId, draft });
}

export async function trialLoadIdentity(workspaceId: string, workId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialConfig[workspaceId]) return { status: "denied" as const };
  return loadDiscoverIdentityContext(workspaceId, workId);
}

export async function trialLinkIdentity(workspaceId: string, input: {
  workId: string; expectedVersion: number; commandId: string; accountId: string; siteId: string;
}) {
  assertDiscoverTrialEnvironment();
  if (!trialConfig[workspaceId]) return { status: "denied" as const, message: "This trial workspace is unavailable." };
  return linkDiscoverIdentity({ workspaceId, ...input });
}

export async function trialTriagePreflight(workspaceId: string, workId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialConfig[workspaceId]) return { status: "denied" as const };
  return loadDiscoverTriagePreflight(workspaceId, workId);
}

export async function trialTriageOwners(workspaceId: string) {
  assertDiscoverTrialEnvironment();
  const configurationVersionId = trialConfig[workspaceId];
  if (!configurationVersionId) return { status: "denied" as const };
  return listDiscoverTriageOwners(workspaceId, configurationVersionId);
}

export async function trialSubmitTriage(workspaceId: string, workId: string,
  expectedVersion: number, commandId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialConfig[workspaceId]) return { status: "denied" as const, message: "This trial workspace is unavailable." };
  return submitDiscoverTriage({ workspaceId, workId, expectedVersion, commandId });
}
