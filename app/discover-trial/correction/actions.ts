"use server";

import { correctDiscoverSameWork, loadDiscoverDuplicateCorrection } from "@/lib/d5o/discover/duplicate-correction";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const trialWorkspaces = new Set([
  "a2000000-0000-4000-8000-000000000001",
  "a2000000-0000-4000-8000-000000000002",
]);
export async function trialCorrectionContext(workspaceId: string, workId: string) {
  assertDiscoverTrialEnvironment();
  if (!trialWorkspaces.has(workspaceId)) return { status: "denied" as const };
  return loadDiscoverDuplicateCorrection(workspaceId, workId);
}
export async function trialCorrectSameWork(workspaceId: string, input: {
  workId: string; retainedWorkId: string; expectedVersion: number;
  expectedRetainedVersion: number; expectedPriorReviewVersion: number;
  commandId: string; candidateWorkIds: string[]; reason: string;
}) {
  assertDiscoverTrialEnvironment();
  if (!trialWorkspaces.has(workspaceId)) return { status: "denied" as const, message: "Trial workspace unavailable." };
  return correctDiscoverSameWork({ workspaceId, ...input });
}
