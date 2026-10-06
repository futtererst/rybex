import {
  canonicalFieldIssueChangeEventId,
  canonicalFieldIssueRfiId
} from "./demo-state";
import type {
  FieldIssueCommandResult,
  FieldIssueDownstreamRecord,
  FieldIssueEscalation,
  FieldIssueEscalationPath,
  FieldIssueEvidenceReferenceType,
  FieldIssueHistoryEvent,
  FieldIssueImpactAssessment,
  FieldIssueReadiness
} from "./types";

type ActorInput = {
  actorId: string;
};

type SaveAssessmentInput = ActorInput & {
  issueType: FieldIssueImpactAssessment["issueType"];
  impactSummary: string;
  scheduleImpact: boolean;
  scheduleDays: number;
  costExposure: number;
  safetyImpact: boolean;
  qualityImpact: boolean;
};

type AddEvidenceInput = ActorInput & {
  requirementId: string;
  referenceText: string;
  referenceType: FieldIssueEvidenceReferenceType;
};

type SelectPathInput = ActorInput & {
  path: FieldIssueEscalationPath;
};

type ResolveInput = ActorInput & {
  resolutionNote: string;
};

function now() {
  return new Date().toISOString();
}

function clone(issue: FieldIssueEscalation): FieldIssueEscalation {
  return JSON.parse(JSON.stringify(issue)) as FieldIssueEscalation;
}

function event(
  type: FieldIssueHistoryEvent["type"],
  actorId: string,
  message: string
): FieldIssueHistoryEvent {
  const createdAt = now();
  return {
    id: `${type}-${createdAt}`,
    type,
    actorId,
    message,
    createdAt
  };
}

function withEvent(
  issue: FieldIssueEscalation,
  historyEvent: FieldIssueHistoryEvent,
  state?: FieldIssueEscalation["state"]
) {
  return {
    ...issue,
    state: state ?? issue.state,
    history: [...issue.history, historyEvent],
    updatedAt: historyEvent.createdAt
  };
}

function result(
  success: boolean,
  issue: FieldIssueEscalation,
  message: string,
  events: FieldIssueHistoryEvent[] = []
): FieldIssueCommandResult {
  return {
    success,
    ok: success,
    message,
    issue,
    readiness: evaluateFieldIssueReadiness(issue),
    events,
    error: success ? undefined : message
  };
}

function fail(issue: FieldIssueEscalation, message: string) {
  return result(false, issue, message);
}

function requireStarted(issue: FieldIssueEscalation) {
  if (issue.state === "unresolved") return "Start field issue escalation before completing this step.";
  if (issue.state === "resolved") return "Field issue escalation is already resolved.";
  return "";
}

export function evaluateFieldIssueReadiness(issue: FieldIssueEscalation): FieldIssueReadiness {
  const assessmentComplete = Boolean(issue.assessment);
  const evidenceComplete = issue.evidenceReferences.length > 0;
  const escalationPathSelected = Boolean(issue.selectedEscalationPath);
  const downstreamRecordCreated = issue.selectedEscalationPath
    ? issue.downstreamRecords.some((record) => record.recordType === issue.selectedEscalationPath)
    : false;
  const missing = [
    !assessmentComplete ? "Impact assessment" : "",
    !evidenceComplete ? "Evidence reference" : "",
    !escalationPathSelected ? "Escalation path" : "",
    !downstreamRecordCreated ? "Downstream RFI or change event" : ""
  ].filter(Boolean);

  return {
    assessmentComplete,
    evidenceComplete,
    escalationPathSelected,
    downstreamRecordCreated,
    resolutionReady: missing.length === 0 && issue.state !== "resolved",
    missing
  };
}

export function startFieldIssueEscalation(issue: FieldIssueEscalation, input: ActorInput) {
  const current = clone(issue);
  if (current.state === "resolved") return fail(current, "Resolved field issues cannot be restarted.");
  if (current.state !== "unresolved") {
    return result(true, current, "Field issue escalation is already active.");
  }

  const historyEvent = event("escalation_started", input.actorId, "Field issue escalation started.");
  const updated = withEvent(current, historyEvent, "in_progress");
  return result(true, updated, "Field issue escalation started.", [historyEvent]);
}

export function saveFieldIssueAssessment(issue: FieldIssueEscalation, input: SaveAssessmentInput) {
  const current = clone(issue);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!input.impactSummary.trim()) return fail(current, "Impact summary is required.");
  if (!Number.isFinite(input.scheduleDays) || input.scheduleDays < 0) {
    return fail(current, "Schedule impact days must be zero or greater.");
  }
  if (!Number.isFinite(input.costExposure) || input.costExposure < 0) {
    return fail(current, "Cost exposure must be zero or greater.");
  }

  const createdAt = now();
  const historyEvent = event("assessment_saved", input.actorId, "Field issue impact assessment saved.");
  const updated = withEvent({
    ...current,
    assessment: {
      issueType: input.issueType,
      impactSummary: input.impactSummary.trim(),
      scheduleImpact: input.scheduleImpact,
      scheduleDays: input.scheduleDays,
      costExposure: input.costExposure,
      safetyImpact: input.safetyImpact,
      qualityImpact: input.qualityImpact,
      assessedBy: input.actorId,
      assessedAt: createdAt
    },
    issueType: input.issueType,
    scheduleImpact: input.scheduleImpact,
    costExposure: input.costExposure
  }, historyEvent, "assessed");

  return result(true, updated, "Field issue assessment saved.", [historyEvent]);
}

export function addFieldIssueEvidenceReference(issue: FieldIssueEscalation, input: AddEvidenceInput) {
  const current = clone(issue);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!current.assessment) return fail(current, "Save an impact assessment before adding evidence.");
  const requirement = current.evidenceRequirements.find((item) => item.id === input.requirementId);
  if (!requirement) return fail(current, "Evidence requirement was not found.");
  if (!input.referenceText.trim()) return fail(current, "Evidence reference is required.");

  const createdAt = now();
  const reference = {
    id: `field-evidence-${current.evidenceReferences.length + 1}`,
    requirementId: input.requirementId,
    referenceText: input.referenceText.trim(),
    referenceType: input.referenceType,
    actorId: input.actorId,
    createdAt
  };
  const historyEvent = event("evidence_added", input.actorId, `Evidence added: ${requirement.label}.`);
  const updated = withEvent({
    ...current,
    evidenceReferences: [...current.evidenceReferences, reference],
    evidenceRequirements: current.evidenceRequirements.map((item) =>
      item.id === input.requirementId ? { ...item, status: "attached" } : item
    )
  }, historyEvent, "evidence_added");

  return result(true, updated, "Field issue evidence reference added.", [historyEvent]);
}

export function selectFieldIssueEscalationPath(issue: FieldIssueEscalation, input: SelectPathInput) {
  const current = clone(issue);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!current.assessment) return fail(current, "Save an impact assessment before selecting an escalation path.");
  if (current.evidenceReferences.length === 0) return fail(current, "Add evidence before selecting an escalation path.");

  const label = input.path === "rfi" ? "RFI" : "Change Event";
  const historyEvent = event("path_selected", input.actorId, `${label} escalation path selected.`);
  const updated = withEvent({
    ...current,
    selectedEscalationPath: input.path
  }, historyEvent, "path_selected");

  return result(true, updated, `${label} escalation path selected.`, [historyEvent]);
}

export function createRfiFromFieldIssue(issue: FieldIssueEscalation, input: ActorInput) {
  return createDownstreamRecord(issue, input, "rfi");
}

export function createChangeEventFromFieldIssue(issue: FieldIssueEscalation, input: ActorInput) {
  return createDownstreamRecord(issue, input, "change_event");
}

function createDownstreamRecord(
  issue: FieldIssueEscalation,
  input: ActorInput,
  path: FieldIssueEscalationPath
) {
  const current = clone(issue);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!current.selectedEscalationPath) return fail(current, "Select an escalation path before creating a downstream record.");
  if (current.selectedEscalationPath !== path) {
    return fail(current, `Selected escalation path is ${current.selectedEscalationPath}; create that downstream record first.`);
  }

  const existing = current.downstreamRecords.find((record) => record.recordType === path);
  if (existing) return result(true, current, `${existing.recordNumber} already exists for this field issue.`);

  const isRfi = path === "rfi";
  const downstreamRecord: FieldIssueDownstreamRecord = {
    id: isRfi ? canonicalFieldIssueRfiId : canonicalFieldIssueChangeEventId,
    recordType: path,
    recordNumber: isRfi ? "RFI-FI-001" : "CE-FI-001",
    title: isRfi
      ? "Field issue escalation: Lake Norman bore path locates"
      : "Field change event: Lake Norman bore path standby exposure",
    route: isRfi ? "/rfis-submittals" : "/changes",
    createdBy: input.actorId,
    createdAt: now()
  };
  const historyEvent = event("downstream_created", input.actorId, `${downstreamRecord.recordNumber} created from field issue.`);
  const updated = withEvent({
    ...current,
    downstreamRecords: [...current.downstreamRecords, downstreamRecord],
    linkedDownstreamRecordIds: Array.from(new Set([...current.linkedDownstreamRecordIds, downstreamRecord.id]))
  }, historyEvent, "downstream_created");

  return result(true, updated, `${downstreamRecord.recordNumber} created from field issue.`, [historyEvent]);
}

export function resolveFieldIssueEscalation(issue: FieldIssueEscalation, input: ResolveInput) {
  const current = clone(issue);
  const stateError = requireStarted(current);
  if (stateError) return fail(current, stateError);
  if (!input.resolutionNote.trim()) return fail(current, "Resolution note is required.");

  const readiness = evaluateFieldIssueReadiness(current);
  if (!readiness.resolutionReady) {
    return fail(current, `Cannot resolve field issue until ${readiness.missing.join(", ")} is complete.`);
  }

  const resolvedAt = now();
  const historyEvent = event("resolved", input.actorId, "Field issue escalation resolved.");
  const updated = withEvent({
    ...current,
    resolutionNote: input.resolutionNote.trim(),
    outcomeRecord: {
      id: `field-issue-outcome-${current.id}`,
      outcome: "Field issue escalated into downstream commercial/governance action and original blocker cleared.",
      resolvedBy: input.actorId,
      resolvedAt,
      resolutionNote: input.resolutionNote.trim(),
      downstreamRecordIds: current.downstreamRecords.map((record) => record.id)
    }
  }, historyEvent, "resolved");

  return result(true, updated, "Field issue escalation resolved.", [historyEvent]);
}
