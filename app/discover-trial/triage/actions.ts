"use server";
import { listMyDiscoverTriage, respondDiscoverTriage } from "@/lib/d5o/discover/triage-transfer";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const workspaces = new Set(["a2000000-0000-4000-8000-000000000001", "a2000000-0000-4000-8000-000000000002"]);
export async function trialMyTriage(workspaceId: string) {
  assertDiscoverTrialEnvironment();
  if (!workspaces.has(workspaceId)) return { status: "denied" as const };
  return listMyDiscoverTriage(workspaceId);
}
export async function trialRespondTriage(input: Parameters<typeof respondDiscoverTriage>[0]) {
  assertDiscoverTrialEnvironment();
  if (!workspaces.has(input.workspaceId)) return { status: "denied" as const, message: "This trial workspace is unavailable." };
  return respondDiscoverTriage(input);
}
