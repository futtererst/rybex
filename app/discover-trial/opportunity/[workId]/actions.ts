"use server";

import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { startG1Assessment } from "@/lib/d5o/discover/g1-start";
import { writeG1Assessment, type G1AssessmentPayload } from "@/lib/d5o/discover/g1-assessment";
import { decideG1, reopenG1Assessment } from "@/lib/d5o/discover/g1-decision";
import { requestSpend, decideSpend } from "@/lib/d5o/discover/spend";
import { submitD2Handoff, respondD2Handoff, type D2Brief } from "@/lib/d5o/discover/d2-handoff";

export async function startG1AssessmentAction(formData: FormData) {
  const workId = String(formData.get("workId") ?? "");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const commandId = String(formData.get("commandId") ?? "");
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  const result = workspaceId
    ? await startG1Assessment({ workspaceId, workId, expectedVersion, commandId })
    : { status: "denied" as const };
  redirect(`/discover-trial/opportunity/${encodeURIComponent(workId)}?g1=${result.status}`);
}

export async function writeG1AssessmentAction(input: {
  workId: string; instanceId: string; expectedRevision: number;
  commandId: string; mode: "save" | "submit"; payload: G1AssessmentPayload;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return writeG1Assessment({ workspaceId, ...input });
}

export async function decideG1Action(input: {
  workId: string; assessmentId: string; packageDigest: string; expectedWorkVersion: number;
  commandId: string; disposition: "return" | "qualify"; reason: string; conditions: string;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return decideG1({ workspaceId, ...input });
}

export async function reopenG1AssessmentAction(input: {
  workId: string; assessmentId: string; commandId: string;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return reopenG1Assessment({ workspaceId, ...input });
}

export async function requestSpendAction(input: { workId: string; g1DecisionId: string;
  expectedWorkVersion: number; commandId: string; amount: number;
  currency: "USD"; expiresOn: string; purpose: string;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return requestSpend({ workspaceId, ...input });
}

export async function decideSpendAction(input: { workId: string; requestId: string;
  requestDigest: string; commandId: string; disposition: "authorize" | "decline";
  reason: string;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return decideSpend({ workspaceId, ...input });
}

export async function submitD2HandoffAction(input: { workId: string;
  g1DecisionId: string; expectedWorkVersion: number; receiverProfileId: string;
  commandId: string; brief: D2Brief;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return submitD2Handoff({ workspaceId, ...input });
}

export async function respondD2HandoffAction(input: { workId: string;
  submissionId: string; briefDigest: string; commandId: string;
  disposition: "accepted" | "returned"; reason: string;
}) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return { status: "denied" as const };
  return respondD2Handoff({ workspaceId, ...input });
}
