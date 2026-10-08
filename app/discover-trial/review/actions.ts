"use server";

import { decideDiscoverDistinct, decideDiscoverSameWork, listDiscoverDuplicateReviews, loadDiscoverDuplicateReview } from "@/lib/d5o/discover/duplicate-review";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const trialWorkspaces = new Set([
  "a2000000-0000-4000-8000-000000000001",
  "a2000000-0000-4000-8000-000000000002",
]);
export async function trialReviewQueue(workspaceId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialWorkspaces.has(workspaceId)) return { status: "denied" as const };
  return listDiscoverDuplicateReviews(workspaceId);
}
export async function trialReviewContext(workspaceId: string, workId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialWorkspaces.has(workspaceId)) return { status: "denied" as const };
  return loadDiscoverDuplicateReview(workspaceId, workId);
}
export async function trialRecordDistinct(workspaceId: string, input: {
  workId: string; expectedVersion: number; commandId: string; comparedWorkIds: string[]; reason: string;
}) {
  assertDiscoverTrialEnvironment();
  if (!trialWorkspaces.has(workspaceId)) return { status: "denied" as const, message: "This trial workspace is unavailable." };
  return decideDiscoverDistinct({ workspaceId, ...input });
}

export async function trialRecordSameWork(workspaceId: string, input: {
  workId: string; retainedWorkId: string; expectedVersion: number;
  expectedRetainedVersion: number; commandId: string; candidateWorkIds: string[]; reason: string;
}) {
  assertDiscoverTrialEnvironment();
  if (!trialWorkspaces.has(workspaceId)) return { status: "denied" as const, message: "This trial workspace is unavailable." };
  return decideDiscoverSameWork({ workspaceId, ...input });
}
