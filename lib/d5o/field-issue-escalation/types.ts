export type FieldIssueEscalationPath = "rfi" | "change_event";

export type FieldIssueEscalationState =
  | "unresolved"
  | "in_progress"
  | "assessed"
  | "evidence_added"
  | "path_selected"
  | "downstream_created"
  | "resolved";

export type FieldIssueImpactAssessment = {
  issueType: "utility_conflict" | "access_constraint" | "safety_constraint" | "quality_constraint";
  impactSummary: string;
  scheduleImpact: boolean;
  scheduleDays: number;
  costExposure: number;
  safetyImpact: boolean;
  qualityImpact: boolean;
  assessedBy: string;
  assessedAt: string;
};

export type FieldIssueEvidenceReferenceType =
  | "daily_report"
  | "photo"
  | "field_note"
  | "external_reference";

export type FieldIssueEvidenceRequirement = {
  id: string;
  label: string;
  description: string;
  status: "missing" | "attached";
};

export type FieldIssueEvidenceReference = {
  id: string;
  requirementId: string;
  referenceType: FieldIssueEvidenceReferenceType;
  referenceText: string;
  actorId: string;
  createdAt: string;
};

export type FieldIssueDownstreamRecord = {
  id: string;
  recordType: FieldIssueEscalationPath;
  recordNumber: string;
  title: string;
  route: "/rfis-submittals" | "/changes";
  createdBy: string;
  createdAt: string;
};

export type FieldIssueHistoryEvent = {
  id: string;
  type:
    | "escalation_started"
    | "assessment_saved"
    | "evidence_added"
    | "path_selected"
    | "downstream_created"
    | "resolved";
  actorId: string;
  message: string;
  createdAt: string;
};

export type FieldIssueOutcomeRecord = {
  id: string;
  outcome: string;
  resolvedBy: string;
  resolvedAt: string;
  resolutionNote: string;
  downstreamRecordIds: string[];
};

export type FieldIssueEscalation = {
  id: string;
  projectId: string;
  projectName: string;
  dailyReportId: string;
  workPackageId: string;
  workPackageName: string;
  location: string;
  summary: string;
  issueType: "utility_conflict" | "access_constraint" | "safety_constraint" | "quality_constraint";
  reportedBy: string;
  reportedDate: string;
  owner: string;
  severity: "medium" | "high" | "critical";
  scheduleImpact: boolean;
  costExposure: number;
  evidenceRequirements: FieldIssueEvidenceRequirement[];
  evidenceReferences: FieldIssueEvidenceReference[];
  state: FieldIssueEscalationState;
  selectedEscalationPath?: FieldIssueEscalationPath;
  linkedDownstreamRecordIds: string[];
  downstreamRecords: FieldIssueDownstreamRecord[];
  assessment?: FieldIssueImpactAssessment;
  resolutionNote?: string;
  outcomeRecord?: FieldIssueOutcomeRecord;
  history: FieldIssueHistoryEvent[];
  createdAt: string;
  updatedAt: string;
};

export type FieldIssueReadiness = {
  assessmentComplete: boolean;
  evidenceComplete: boolean;
  escalationPathSelected: boolean;
  downstreamRecordCreated: boolean;
  resolutionReady: boolean;
  missing: string[];
};

export type FieldIssueCommandResult = {
  success: boolean;
  ok?: boolean;
  message: string;
  issue: FieldIssueEscalation;
  readiness?: FieldIssueReadiness;
  events?: FieldIssueHistoryEvent[];
  error?: string;
};
