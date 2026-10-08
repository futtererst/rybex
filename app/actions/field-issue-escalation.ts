"use server";

import {
  addFieldIssueEvidenceReference,
  createChangeEventFromFieldIssue,
  createRfiFromFieldIssue,
  getFieldIssueActionState,
  resolveFieldIssueEscalation,
  saveFieldIssueAssessment,
  selectFieldIssueEscalationPath,
  startFieldIssueEscalation
} from "@/lib/d5o/field-issue-escalation/store";
import { requireRequestContext } from "@/lib/d5o/auth/request-context";
import { isProductionRuntime } from "@/lib/d5o/security/runtime-mode";
import type {
  FieldIssueEscalationPath,
  FieldIssueEvidenceReferenceType,
  FieldIssueImpactAssessment
} from "@/lib/d5o/field-issue-escalation/types";

export type FieldIssueServerActionResult = Awaited<ReturnType<typeof startFieldIssueEscalation>>;

export async function startFieldIssueEscalationAction(input: { issueId?: string }) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.assess");
    return startFieldIssueEscalation({
      issueId: cleanOptional(input.issueId),
      actorId
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

export async function saveFieldIssueAssessmentAction(input: {
  issueId?: string;
  issueType: FieldIssueImpactAssessment["issueType"];
  impactSummary: string;
  scheduleImpact: boolean;
  scheduleDays: number;
  costExposure: number;
  safetyImpact: boolean;
  qualityImpact: boolean;
}) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.assess");
    const impactSummary = cleanRequired(input.impactSummary, "Impact summary is required.");
    if (!Number.isFinite(input.scheduleDays) || input.scheduleDays < 0) {
      throw new Error("Schedule impact days must be zero or greater.");
    }
    if (!Number.isFinite(input.costExposure) || input.costExposure < 0) {
      throw new Error("Cost exposure must be zero or greater.");
    }

    return saveFieldIssueAssessment({
      issueId: cleanOptional(input.issueId),
      actorId,
      issueType: input.issueType,
      impactSummary,
      scheduleImpact: Boolean(input.scheduleImpact),
      scheduleDays: input.scheduleDays,
      costExposure: input.costExposure,
      safetyImpact: Boolean(input.safetyImpact),
      qualityImpact: Boolean(input.qualityImpact)
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

export async function addFieldIssueEvidenceReferenceAction(input: {
  issueId?: string;
  requirementId: string;
  referenceText: string;
  referenceType?: FieldIssueEvidenceReferenceType;
}) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.add_evidence");
    return addFieldIssueEvidenceReference({
      issueId: cleanOptional(input.issueId),
      actorId,
      requirementId: cleanRequired(input.requirementId, "Evidence requirement is required."),
      referenceText: cleanRequired(input.referenceText, "Evidence reference is required."),
      referenceType: input.referenceType ?? "field_note"
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

export async function selectFieldIssueEscalationPathAction(input: {
  issueId?: string;
  path: FieldIssueEscalationPath;
}) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.choose_path");
    if (!["rfi", "change_event"].includes(input.path)) throw new Error("Escalation path is invalid.");

    return selectFieldIssueEscalationPath({
      issueId: cleanOptional(input.issueId),
      actorId,
      path: input.path
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

export async function createRfiFromFieldIssueAction(input: { issueId?: string }) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.create_rfi");
    return createRfiFromFieldIssue({
      issueId: cleanOptional(input.issueId),
      actorId
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

export async function createChangeEventFromFieldIssueAction(input: { issueId?: string }) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.create_change");
    return createChangeEventFromFieldIssue({
      issueId: cleanOptional(input.issueId),
      actorId
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

export async function resolveFieldIssueEscalationAction(input: {
  issueId?: string;
  resolutionNote: string;
}) {
  try {
    const actorId = await getFieldIssueActorId("field_issue.resolve");
    return resolveFieldIssueEscalation({
      issueId: cleanOptional(input.issueId),
      actorId,
      resolutionNote: cleanRequired(input.resolutionNote, "Resolution note is required.")
    });
  } catch (error) {
    return actionError(error, input.issueId);
  }
}

function cleanOptional(value: string | undefined) {
  const clean = value?.trim();
  return clean || undefined;
}

function cleanRequired(value: string | undefined, message: string) {
  const clean = cleanOptional(value);
  if (!clean) throw new Error(message);
  return clean;
}

async function getFieldIssueActorId(permission: Parameters<typeof requireRequestContext>[0]) {
  const context = await requireRequestContext(permission);

  return context.user?.name ?? context.user?.id ?? "Authenticated field user";
}

async function actionError(error: unknown, issueId?: string) {
  const message = error instanceof Error ? error.message : "Field issue action failed.";
  if (isProductionRuntime()) {
    return {
      success: false,
      ok: false,
      message,
      error: message
    } as Awaited<ReturnType<typeof getFieldIssueActionState>> & {
      success: false;
      ok: false;
      message: string;
      error: string;
    };
  }
  const state = await getFieldIssueActionState(cleanOptional(issueId));

  return {
    ...state,
    success: false,
    ok: false,
    message,
    error: message
  };
}
