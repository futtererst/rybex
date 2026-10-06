import {
  canonicalFieldIssueChangeEventId,
  canonicalFieldIssueDailyReportId,
  canonicalFieldIssueId,
  canonicalFieldIssueRfiId,
  canonicalFieldIssueWorkPackageId,
  createFieldIssueDemoState
} from "./demo-state";
import {
  addFieldIssueEvidenceReference as addFieldIssueEvidenceReferenceCommand,
  createChangeEventFromFieldIssue as createChangeEventFromFieldIssueCommand,
  createRfiFromFieldIssue as createRfiFromFieldIssueCommand,
  evaluateFieldIssueReadiness,
  resolveFieldIssueEscalation as resolveFieldIssueEscalationCommand,
  saveFieldIssueAssessment as saveFieldIssueAssessmentCommand,
  selectFieldIssueEscalationPath as selectFieldIssueEscalationPathCommand,
  startFieldIssueEscalation as startFieldIssueEscalationCommand
} from "./field-issue-service";
import {
  changeEvents as seedChangeEvents,
  dailyReports as seedDailyReports,
  rfis as seedRfis
} from "../seed-data";
import {
  operatingSliceNow,
  readLocalOperatingSliceStore,
  resetLocalOperatingSliceStore,
  resolveOperatingSliceStorePath,
  writeLocalOperatingSliceStore
} from "../operating-slices/local-file-store";
import type { ChangeEvent, DailyReport, RFI } from "../types";
import type {
  FieldIssueCommandResult,
  FieldIssueEscalation,
  FieldIssueEscalationPath,
  FieldIssueEvidenceReferenceType,
  FieldIssueReadiness
} from "./types";

export { canonicalFieldIssueId } from "./demo-state";

export const fieldIssueStoreSchemaVersion = 1;

export type FieldIssueStoreFile = {
  version: 1;
  issues: Record<string, FieldIssueEscalation>;
  updatedAt: string;
  recoveredFromCorruptStore?: boolean;
  schemaVersionMismatch?: boolean;
};

export type FieldIssueCommandCenterImpact = {
  openIssueCount: number;
  resolvedIssueCount: number;
  costExposure: number;
  issueState: FieldIssueEscalation["state"];
  samePrimaryBlockerResolved: boolean;
};

export type FieldIssueActionState = {
  issue: FieldIssueEscalation;
  readiness: FieldIssueReadiness;
  impact: FieldIssueCommandCenterImpact;
  storageLabel: string;
};

export type FieldIssueSeedOverlay = {
  dailyReports: DailyReport[];
  rfis: RFI[];
  changeEvents: ChangeEvent[];
};

type StartFieldIssueEscalationInput = {
  issueId?: string;
  actorId: string;
};

type SaveFieldIssueAssessmentInput = {
  issueId?: string;
  actorId: string;
  issueType: "utility_conflict" | "access_constraint" | "safety_constraint" | "quality_constraint";
  impactSummary: string;
  scheduleImpact: boolean;
  scheduleDays: number;
  costExposure: number;
  safetyImpact: boolean;
  qualityImpact: boolean;
};

type AddFieldIssueEvidenceInput = {
  issueId?: string;
  actorId: string;
  requirementId: string;
  referenceText: string;
  referenceType: FieldIssueEvidenceReferenceType;
};

type SelectFieldIssuePathInput = {
  issueId?: string;
  actorId: string;
  path: FieldIssueEscalationPath;
};

type ResolveFieldIssueEscalationInput = {
  issueId?: string;
  actorId: string;
  resolutionNote: string;
};

function now() {
  return operatingSliceNow();
}

function storePath() {
  return resolveOperatingSliceStorePath("RYBEXOS_FIELD_ISSUE_STORE_PATH", "field-issue-escalation-store.json");
}

function normalizeIssue(issue: FieldIssueEscalation): FieldIssueEscalation {
  return {
    ...issue,
    id: canonicalFieldIssueId
  };
}

async function readStore(): Promise<FieldIssueStoreFile> {
  return readLocalOperatingSliceStore({
    path: storePath(),
    schemaVersion: fieldIssueStoreSchemaVersion,
    createEmptyStore,
    normalizeStore: normalizeStoreFile
  });
}

async function writeStore(store: FieldIssueStoreFile) {
  await writeLocalOperatingSliceStore(store, {
    path: storePath(),
    normalizeStore: normalizeStoreFile
  });
}

function createEmptyStore(input: { recoveredFromCorruptStore?: boolean; schemaVersionMismatch?: boolean }): FieldIssueStoreFile {
  return {
    version: fieldIssueStoreSchemaVersion,
    issues: {},
    updatedAt: now(),
    recoveredFromCorruptStore: input.recoveredFromCorruptStore,
    schemaVersionMismatch: input.schemaVersionMismatch
  };
}

function normalizeStoreFile(store: Partial<FieldIssueStoreFile>): FieldIssueStoreFile {
  return {
    version: fieldIssueStoreSchemaVersion,
    issues: isIssueMap(store.issues) ? store.issues : {},
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : now(),
    recoveredFromCorruptStore: store.recoveredFromCorruptStore,
    schemaVersionMismatch: store.schemaVersionMismatch
  };
}

function isIssueMap(value: unknown): value is Record<string, FieldIssueEscalation> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function persistIssue(issue: FieldIssueEscalation): Promise<FieldIssueEscalation> {
  const normalized = normalizeIssue(issue);
  const store = await readStore();
  await writeStore({
    version: fieldIssueStoreSchemaVersion,
    issues: {
      ...store.issues,
      [normalized.id]: normalized
    },
    updatedAt: now()
  });
  return normalized;
}

async function loadIssue(issueId = canonicalFieldIssueId) {
  const store = await readStore();
  const existing = store.issues[issueId];
  if (existing) return normalizeIssue(existing);

  const created = createFieldIssueDemoState();
  await persistIssue(created);
  return created;
}

async function applyAndPersist(result: FieldIssueCommandResult): Promise<FieldIssueCommandResult> {
  if (!result.success) return result;

  const persisted = await persistIssue(result.issue);
  return {
    ...result,
    issue: persisted
  };
}

export async function getFieldIssueEscalation(issueId = canonicalFieldIssueId) {
  return loadIssue(issueId);
}

export async function resetFieldIssueEscalationStoreForTesting() {
  const issue = createFieldIssueDemoState();
  await resetLocalOperatingSliceStore({
    version: fieldIssueStoreSchemaVersion,
    issues: {
      [issue.id]: issue
    },
    updatedAt: issue.updatedAt
  }, {
    path: storePath(),
    normalizeStore: normalizeStoreFile
  });
  return issue;
}

export async function startFieldIssueEscalation(input: StartFieldIssueEscalationInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(startFieldIssueEscalationCommand(issue, {
    actorId: input.actorId
  })));
}

export async function saveFieldIssueAssessment(input: SaveFieldIssueAssessmentInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(saveFieldIssueAssessmentCommand(issue, input)));
}

export async function addFieldIssueEvidenceReference(input: AddFieldIssueEvidenceInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(addFieldIssueEvidenceReferenceCommand(issue, input)));
}

export async function selectFieldIssueEscalationPath(input: SelectFieldIssuePathInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(selectFieldIssueEscalationPathCommand(issue, input)));
}

export async function createRfiFromFieldIssue(input: StartFieldIssueEscalationInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(createRfiFromFieldIssueCommand(issue, {
    actorId: input.actorId
  })));
}

export async function createChangeEventFromFieldIssue(input: StartFieldIssueEscalationInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(createChangeEventFromFieldIssueCommand(issue, {
    actorId: input.actorId
  })));
}

export async function resolveFieldIssueEscalation(input: ResolveFieldIssueEscalationInput) {
  const issue = await loadIssue(input.issueId);
  return fieldIssueCommandState(await applyAndPersist(resolveFieldIssueEscalationCommand(issue, {
    actorId: input.actorId,
    resolutionNote: input.resolutionNote
  })));
}

export async function listOpenFieldIssues() {
  const issue = await loadIssue();
  return issue.state === "resolved" ? [] : [issue];
}

export async function getFieldIssueCommandCenterImpact() {
  const issue = await loadIssue();
  return impactForIssue(issue);
}

export async function getFieldIssueActionState(issueId = canonicalFieldIssueId): Promise<FieldIssueActionState> {
  const issue = await loadIssue(issueId);

  return {
    issue,
    readiness: evaluateFieldIssueReadiness(issue),
    impact: impactForIssue(issue),
    storageLabel: "Persisted dev store"
  };
}

export async function getFieldIssueSeedDataOverlay(): Promise<FieldIssueSeedOverlay> {
  return applyFieldIssueToSeedData(await loadIssue());
}

export function applyFieldIssueToSeedData(issue: FieldIssueEscalation): FieldIssueSeedOverlay {
  const resolved = issue.state === "resolved";
  const downstreamRfi = issue.downstreamRecords.find((record) => record.recordType === "rfi");
  const downstreamChange = issue.downstreamRecords.find((record) => record.recordType === "change_event");

  return {
    dailyReports: seedDailyReports.map((report) => {
      if (report.id !== canonicalFieldIssueDailyReportId) return report;

      const blockers = report.blockers.filter((blocker) =>
        ![canonicalFieldIssueId, "block-lake-locates"].includes(blocker.id)
      );

      return resolved
        ? {
            ...report,
            reportStatus: "approved",
            blockers,
            delays: [],
            requiredPhotosComplete: true,
            rfiNeeded: false,
            changeEventNeeded: false,
            productionStatus: "on_plan",
            supervisorSignoff: {
              status: "signed",
              signedBy: issue.owner,
              signedAt: issue.outcomeRecord?.resolvedAt ?? issue.updatedAt,
              notes: issue.resolutionNote ?? "Field issue escalation resolved."
            },
            gcCoordinationNotes: issue.outcomeRecord?.outcome ?? report.gcCoordinationNotes,
            updatedAt: issue.updatedAt
          }
        : {
            ...report,
            blockers: [
              {
                id: canonicalFieldIssueId,
                title: "Utility locates not confirmed",
                severity: issue.severity,
                owner: issue.owner,
                businessImpact: "Underground crew cannot start safely and outage window may be lost.",
                requiredAction: "Assess the field issue and create the downstream RFI or change event before release."
              },
              ...blockers
            ],
            changeEventNeeded: true,
            productionStatus: "blocked",
            updatedAt: issue.updatedAt
          };
    }),
    rfis: downstreamRfi
      ? upsertRfi(seedRfis, issue)
      : seedRfis,
    changeEvents: downstreamChange
      ? upsertChangeEvent(seedChangeEvents, issue)
      : seedChangeEvents
  };
}

function upsertRfi(rfis: RFI[], issue: FieldIssueEscalation): RFI[] {
  const existing = rfis.filter((rfi) => rfi.id !== canonicalFieldIssueRfiId);
  return [
    ...existing,
    {
      id: canonicalFieldIssueRfiId,
      projectId: issue.projectId,
      projectName: issue.projectName,
      rfiNumber: "RFI-FI-001",
      title: "Field issue escalation: Lake Norman bore path locates",
      question: "Confirm whether Rybex should proceed, standby, or reroute around the unresolved utility locate and traffic-control condition.",
      status: "submitted",
      priority: "critical",
      discipline: "underground",
      specificationReference: "33 05 23 - Utility Boring",
      drawingReference: "U-204 hospital access road",
      location: issue.location,
      submittedBy: issue.owner,
      assignedTo: "Harborline Builders",
      dueDate: "2026-06-12",
      submittedDate: "2026-06-11",
      scheduleImpact: true,
      costImpact: true,
      linkedDailyReportIds: [canonicalFieldIssueDailyReportId],
      linkedWorkPackageIds: [canonicalFieldIssueWorkPackageId],
      linkedChangeEventIds: [],
      attachments: issue.evidenceReferences.map((reference) => reference.referenceText),
      requiredDecision: "Provide written direction and confirm compensability for standby or reroute impacts.",
      nextAction: issue.state === "resolved" ? "Track RFI response from downstream record." : "Escalate RFI response before releasing bore crew.",
      createdAt: issue.downstreamRecords.find((record) => record.recordType === "rfi")?.createdAt ?? issue.updatedAt,
      updatedAt: issue.updatedAt,
      owner: issue.owner,
      businessImpact: issue.assessment?.impactSummary ?? issue.summary
    }
  ];
}

function upsertChangeEvent(changeEvents: ChangeEvent[], issue: FieldIssueEscalation): ChangeEvent[] {
  const existing = changeEvents.filter((event) => event.id !== canonicalFieldIssueChangeEventId);
  return [
    ...existing,
    {
      id: canonicalFieldIssueChangeEventId,
      projectId: issue.projectId,
      projectName: issue.projectName,
      changeNumber: "CE-FI-001",
      title: "Field issue escalation: bore crew standby exposure",
      description: issue.assessment?.impactSummary ?? issue.summary,
      status: "notice_submitted",
      source: "daily_report",
      sourceRecordIds: [canonicalFieldIssueDailyReportId],
      changeType: "delay",
      noticeRequired: true,
      noticeDeadline: "2026-06-12",
      noticeStatus: "submitted",
      pricingStatus: "backup_needed",
      backupStatus: issue.evidenceReferences.length > 0 ? "partial" : "missing",
      scheduleImpact: true,
      costImpactEstimate: issue.costExposure,
      submittedAmount: 0,
      approvedAmount: 0,
      rejectedAmount: 0,
      disputedAmount: 0,
      billingStatus: "not_billable",
      owner: issue.owner,
      gcContact: "Harborline Builders",
      requiredAction: "Price standby exposure after GC direction is received.",
      linkedRfiIds: issue.linkedDownstreamRecordIds.includes(canonicalFieldIssueRfiId) ? [canonicalFieldIssueRfiId] : [],
      linkedDailyReportIds: [canonicalFieldIssueDailyReportId],
      linkedWorkPackageIds: [canonicalFieldIssueWorkPackageId],
      attachments: issue.evidenceReferences.map((reference) => reference.referenceText),
      createdAt: issue.downstreamRecords.find((record) => record.recordType === "change_event")?.createdAt ?? issue.updatedAt,
      updatedAt: issue.updatedAt,
      valueEstimate: issue.costExposure,
      noticeDueDate: "2026-06-12",
      businessImpact: "Field issue has been escalated into change recovery so standby exposure is not lost."
    }
  ];
}

function impactForIssue(issue: FieldIssueEscalation): FieldIssueCommandCenterImpact {
  return {
    openIssueCount: issue.state === "resolved" ? 0 : 1,
    resolvedIssueCount: issue.state === "resolved" ? 1 : 0,
    costExposure: issue.state === "resolved" ? 0 : issue.costExposure,
    issueState: issue.state,
    samePrimaryBlockerResolved: issue.state === "resolved"
  };
}

async function fieldIssueCommandState(result: FieldIssueCommandResult): Promise<FieldIssueCommandResult & FieldIssueActionState> {
  const issue = result.issue;
  return {
    ...result,
    issue,
    readiness: result.readiness ?? evaluateFieldIssueReadiness(issue),
    impact: impactForIssue(issue),
    storageLabel: "Persisted dev store"
  };
}
