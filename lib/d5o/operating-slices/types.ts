export type OperatingSliceId =
  | "billing-v2-backup-cash-recovery"
  | "field-issue-escalation"
  | "closeout-final-billing-release"
  | (string & {});

export type OperatingSliceStatus =
  | "unresolved"
  | "blocked"
  | "in_progress"
  | "evidence_required"
  | "ready_for_review"
  | "review_pending"
  | "downstream_created"
  | "resolved"
  | "reopened";

export type OperatingSliceHistoryEvent = {
  id: string;
  type: string;
  actorId: string;
  message: string;
  createdAt: string;
};

export type OperatingSliceEvidenceReference = {
  id: string;
  requirementId: string;
  referenceText: string;
  referenceType: string;
  actorId?: string;
  createdAt?: string;
};

export type OperatingSliceDownstreamRecord = {
  id: string;
  recordType: string;
  recordNumber?: string;
  title: string;
  route: string;
  createdBy?: string;
  createdAt?: string;
};

export type OperatingSliceImpactSummary = {
  openBlockerCount: number;
  resolvedBlockerCount: number;
  valueAtRisk?: number;
  readinessScore?: number;
  samePrimaryBlockerResolved: boolean;
};

export type OperatingSliceCommandResult<TEntity = unknown, TReadiness = unknown, TImpact = OperatingSliceImpactSummary> = {
  success: boolean;
  ok?: boolean;
  message: string;
  entity: TEntity;
  readiness?: TReadiness;
  impact?: TImpact;
  events?: OperatingSliceHistoryEvent[];
  error?: string;
};

export type OperatingSliceStoreEnvelope<TPayload extends object = Record<string, unknown>> = {
  version: number;
  updatedAt: string;
  recoveredFromCorruptStore?: boolean;
  schemaVersionMismatch?: boolean;
} & TPayload;

export type OperatingSliceConformanceSummary = {
  sliceId: OperatingSliceId;
  label: string;
  canonicalEntityId: string;
  storeFilePath: string;
  schemaVersion: number;
  resetHelperName: string;
  persistedStorePath: string;
  domainServicePath: string;
  serverActionPath: string;
  appStatePath: string;
  serverActions: string[];
  domainCommands: string[];
  appStateOverlayFunction: string;
  seedOverlayFunction: string;
  commandCenterDerivationHook: string;
  verifierCommand: string;
  browserQaCommand: string;
  downstreamProjections: string[];
};
