import {
  canonicalCloseoutCommercialExposureId,
  canonicalCloseoutFinalBillingId,
  canonicalCloseoutLienWaiverIds,
  canonicalCloseoutPackageId,
  canonicalCloseoutPayApplicationId,
  canonicalCloseoutRequirementIds,
  createCloseoutFinalBillingDemoState
} from "./demo-state";
import {
  addCloseoutEvidenceReference as addCloseoutEvidenceReferenceCommand,
  clearCloseoutFinalBillingBlocker as clearCloseoutFinalBillingBlockerCommand,
  evaluateCloseoutReleaseReadiness,
  recordCloseoutReleaseDecision as recordCloseoutReleaseDecisionCommand,
  saveCloseoutRequirementAssessment as saveCloseoutRequirementAssessmentCommand,
  startCloseoutFinalBillingRelease as startCloseoutFinalBillingReleaseCommand,
  submitCloseoutReleaseForReview as submitCloseoutReleaseForReviewCommand,
  validateCloseoutReleaseReadiness as validateCloseoutReleaseReadinessCommand
} from "./closeout-final-billing-service";
import type {
  CloseoutEvidenceReference,
  CloseoutEvidenceStatus,
  CloseoutFinalBillingBlocker,
  CloseoutFinalBillingCommandResult,
  CloseoutFinalBillingImpact,
  CloseoutFinalBillingReadiness,
  CloseoutReleaseDecision
} from "./types";
import {
  operatingSliceNow,
  readLocalOperatingSliceStore,
  resetLocalOperatingSliceStore,
  resolveOperatingSliceStorePath,
  writeLocalOperatingSliceStore
} from "../operating-slices/local-file-store";
import {
  acceptanceRecords as seedAcceptanceRecords,
  closeoutPackages as seedCloseoutPackages,
  closeoutRequirements as seedCloseoutRequirements,
  commercialExposureItems as seedCommercialExposureItems,
  lienWaivers as seedLienWaivers,
  payApplications as seedPayApplications
} from "../seed-data";
import type {
  AcceptanceRecord,
  CloseoutPackage,
  CloseoutRequirement,
  CommercialExposureItem,
  LienWaiver,
  PayApplication
} from "../types";

export { canonicalCloseoutFinalBillingId } from "./demo-state";

export const closeoutFinalBillingStoreSchemaVersion = 1;

export type CloseoutFinalBillingStoreFile = {
  version: 1;
  blockers: Record<string, CloseoutFinalBillingBlocker>;
  updatedAt: string;
  recoveredFromCorruptStore?: boolean;
  schemaVersionMismatch?: boolean;
};

export type CloseoutFinalBillingActionState = {
  blocker: CloseoutFinalBillingBlocker;
  readiness: CloseoutFinalBillingReadiness;
  impact: CloseoutFinalBillingImpact;
  storageLabel: string;
};

export type CloseoutFinalBillingSeedOverlay = {
  closeoutPackages: CloseoutPackage[];
  closeoutRequirements: CloseoutRequirement[];
  acceptanceRecords: AcceptanceRecord[];
  payApplications: PayApplication[];
  lienWaivers: LienWaiver[];
  commercialExposureItems: CommercialExposureItem[];
};

type CloseoutOverlayBase = Partial<CloseoutFinalBillingSeedOverlay>;

type StartInput = {
  blockerId?: string;
  actorId: string;
};

type AssessmentInput = StartInput & {
  acceptanceStatus: CloseoutEvidenceStatus;
  punchStatus: CloseoutEvidenceStatus;
  testEvidenceStatus: CloseoutEvidenceStatus;
  asBuiltRedlineStatus: CloseoutEvidenceStatus;
  closeoutDocumentStatus: CloseoutEvidenceStatus;
  finalBillingReleaseStatus: "blocked" | "ready" | "released";
  assessmentSummary: string;
};

type EvidenceInput = StartInput & {
  requirementId: string;
  referenceText: string;
  referenceType: CloseoutEvidenceReference["referenceType"];
};

type SubmitReviewInput = StartInput & {
  assignedRole: string;
};

type ReviewDecisionInput = {
  blockerId?: string;
  reviewerId: string;
  decision: CloseoutReleaseDecision;
  decisionNote: string;
};

type ClearInput = StartInput & {
  resolutionNote: string;
};

function now() {
  return operatingSliceNow();
}

function storePath() {
  return resolveOperatingSliceStorePath("RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH", "closeout-final-billing-store.json");
}

function normalizeBlocker(blocker: CloseoutFinalBillingBlocker): CloseoutFinalBillingBlocker {
  return {
    ...blocker,
    id: canonicalCloseoutFinalBillingId
  };
}

function createEmptyStore(input: { recoveredFromCorruptStore?: boolean; schemaVersionMismatch?: boolean }): CloseoutFinalBillingStoreFile {
  return {
    version: closeoutFinalBillingStoreSchemaVersion,
    blockers: {},
    updatedAt: now(),
    recoveredFromCorruptStore: input.recoveredFromCorruptStore,
    schemaVersionMismatch: input.schemaVersionMismatch
  };
}

function normalizeStoreFile(store: Partial<CloseoutFinalBillingStoreFile>): CloseoutFinalBillingStoreFile {
  return {
    version: closeoutFinalBillingStoreSchemaVersion,
    blockers: isBlockerMap(store.blockers) ? store.blockers : {},
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : now(),
    recoveredFromCorruptStore: store.recoveredFromCorruptStore,
    schemaVersionMismatch: store.schemaVersionMismatch
  };
}

function isBlockerMap(value: unknown): value is Record<string, CloseoutFinalBillingBlocker> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readStore(): Promise<CloseoutFinalBillingStoreFile> {
  return readLocalOperatingSliceStore({
    path: storePath(),
    schemaVersion: closeoutFinalBillingStoreSchemaVersion,
    createEmptyStore,
    normalizeStore: normalizeStoreFile
  });
}

async function writeStore(store: CloseoutFinalBillingStoreFile) {
  await writeLocalOperatingSliceStore(store, {
    path: storePath(),
    normalizeStore: normalizeStoreFile
  });
}

async function persistBlocker(blocker: CloseoutFinalBillingBlocker) {
  const normalized = normalizeBlocker(blocker);
  const store = await readStore();
  await writeStore({
    version: closeoutFinalBillingStoreSchemaVersion,
    blockers: {
      ...store.blockers,
      [normalized.id]: normalized
    },
    updatedAt: now()
  });
  return normalized;
}

async function loadBlocker(blockerId = canonicalCloseoutFinalBillingId) {
  const store = await readStore();
  const existing = store.blockers[blockerId];
  if (existing) return normalizeBlocker(existing);

  const created = createCloseoutFinalBillingDemoState();
  await persistBlocker(created);
  return created;
}

async function applyAndPersist(result: CloseoutFinalBillingCommandResult): Promise<CloseoutFinalBillingCommandResult> {
  if (!result.success) return result;
  const persisted = await persistBlocker(result.blocker);
  return {
    ...result,
    blocker: persisted
  };
}

export async function getCloseoutFinalBillingBlocker(blockerId = canonicalCloseoutFinalBillingId) {
  return loadBlocker(blockerId);
}

export async function resetCloseoutFinalBillingStoreForTesting() {
  const blocker = createCloseoutFinalBillingDemoState();
  await resetLocalOperatingSliceStore({
    version: closeoutFinalBillingStoreSchemaVersion,
    blockers: {
      [blocker.id]: blocker
    },
    updatedAt: blocker.updatedAt
  }, {
    path: storePath(),
    normalizeStore: normalizeStoreFile
  });
  return blocker;
}

export async function startCloseoutFinalBillingRelease(input: StartInput) {
  const blocker = await loadBlocker(input.blockerId);
  return closeoutCommandState(await applyAndPersist(startCloseoutFinalBillingReleaseCommand(blocker, {
    actorId: input.actorId
  })));
}

export async function saveCloseoutRequirementAssessment(input: AssessmentInput) {
  const blocker = await loadBlocker(input.blockerId);
  return closeoutCommandState(await applyAndPersist(saveCloseoutRequirementAssessmentCommand(blocker, input)));
}

export async function addCloseoutEvidenceReference(input: EvidenceInput) {
  const blocker = await loadBlocker(input.blockerId);
  return closeoutCommandState(await applyAndPersist(addCloseoutEvidenceReferenceCommand(blocker, input)));
}

export async function validateCloseoutReleaseReadiness(blockerId = canonicalCloseoutFinalBillingId, actorId = "Closeout user") {
  const blocker = await loadBlocker(blockerId);
  return closeoutCommandState(await applyAndPersist(validateCloseoutReleaseReadinessCommand(blocker, { actorId })));
}

export async function submitCloseoutReleaseForReview(input: SubmitReviewInput) {
  const blocker = await loadBlocker(input.blockerId);
  return closeoutCommandState(await applyAndPersist(submitCloseoutReleaseForReviewCommand(blocker, input)));
}

export async function recordCloseoutReleaseDecision(input: ReviewDecisionInput) {
  const blocker = await loadBlocker(input.blockerId);
  return closeoutCommandState(await applyAndPersist(recordCloseoutReleaseDecisionCommand(blocker, input)));
}

export async function clearCloseoutFinalBillingBlocker(input: ClearInput) {
  const blocker = await loadBlocker(input.blockerId);
  return closeoutCommandState(await applyAndPersist(clearCloseoutFinalBillingBlockerCommand(blocker, input)));
}

export async function listOpenCloseoutFinalBillingBlockers() {
  const blocker = await loadBlocker();
  return blocker.state === "resolved" ? [] : [blocker];
}

export async function getCloseoutFinalBillingActionState(blockerId = canonicalCloseoutFinalBillingId): Promise<CloseoutFinalBillingActionState> {
  const blocker = await loadBlocker(blockerId);
  return {
    blocker,
    readiness: evaluateCloseoutReleaseReadiness(blocker),
    impact: impactForBlocker(blocker),
    storageLabel: "Persisted dev store"
  };
}

export async function getCloseoutFinalBillingSeedDataOverlay(base?: CloseoutOverlayBase): Promise<CloseoutFinalBillingSeedOverlay> {
  return applyCloseoutFinalBillingToSeedData(await loadBlocker(), base);
}

export function applyCloseoutFinalBillingToSeedData(
  blocker: CloseoutFinalBillingBlocker,
  base: CloseoutOverlayBase = {}
): CloseoutFinalBillingSeedOverlay {
  const resolved = blocker.state === "resolved";
  const evidenceReferences = blocker.evidenceReferences.map((reference) => reference.referenceText);
  const closeoutPackages = base.closeoutPackages ?? seedCloseoutPackages;
  const closeoutRequirements = base.closeoutRequirements ?? seedCloseoutRequirements;
  const acceptanceRecords = base.acceptanceRecords ?? seedAcceptanceRecords;
  const payApplications = base.payApplications ?? seedPayApplications;
  const lienWaivers = base.lienWaivers ?? seedLienWaivers;
  const commercialExposureItems = base.commercialExposureItems ?? seedCommercialExposureItems;

  return {
    closeoutPackages: closeoutPackages.map((item) => {
      if (item.id !== canonicalCloseoutPackageId) return item;
      return resolved
        ? {
            ...item,
            status: "closed",
            readinessScore: 100,
            acceptanceStatus: "closed",
            finalBillingStatus: "approved",
            retainageReleaseStatus: "submitted",
            photoEvidenceStatus: "accepted",
            punchClosureStatus: "accepted",
            billingClosureStatus: "accepted",
            blockers: item.blockers.filter((blockerText) =>
              !blockerText.toLowerCase().includes("waiver") &&
              !blockerText.toLowerCase().includes("restoration")
            ),
            warnings: [],
            nextAction: "Closeout release approved; continue final billing and retainage processing.",
            updatedAt: blocker.updatedAt
          }
        : item;
    }),
    closeoutRequirements: closeoutRequirements.map((item) => {
      if (!canonicalCloseoutRequirementIds.includes(item.id)) return item;
      return resolved
        ? {
            ...item,
            status: "accepted",
            attachments: Array.from(new Set([...item.attachments, ...evidenceReferences, blocker.outcomeRecord?.id ?? blocker.id].filter(Boolean))),
            nextAction: "Accepted for final billing and retainage release.",
            updatedAt: blocker.updatedAt
          }
        : item;
    }),
    acceptanceRecords: acceptanceRecords.map((item) => {
      if (item.packageId !== canonicalCloseoutPackageId) return item;
      return resolved
        ? {
            ...item,
            status: "closed",
            acceptedDate: blocker.outcomeRecord?.resolvedAt ?? blocker.updatedAt,
            exceptions: [],
            rejectionReasons: [],
            requiredCorrections: [],
            nextAction: "Acceptance exception closed; retainage release cleared.",
            updatedAt: blocker.updatedAt
          }
        : item;
    }),
    payApplications: payApplications.map((item) => {
      if (item.id !== canonicalCloseoutPayApplicationId) return item;
      return resolved
        ? {
            ...item,
            status: "approved",
            lienWaiverStatus: "accepted",
            backupStatus: "verified",
            missingBackupItems: item.missingBackupItems.filter((missing) =>
              !missing.toLowerCase().includes("waiver") &&
              !missing.toLowerCase().includes("restoration")
            ),
            rejectedLineItems: [],
            disputedItems: item.disputedItems.filter((itemText) => !itemText.toLowerCase().includes("retainage")),
            nextAction: "Closeout release approved; continue final billing and retainage processing. Payment has not yet been recorded.",
            updatedAt: blocker.updatedAt
          }
        : item;
    }),
    lienWaivers: lienWaivers.map((item) => {
      if (!canonicalCloseoutLienWaiverIds.includes(item.id)) return item;
      return resolved
        ? {
            ...item,
            status: "accepted",
            receivedDate: blocker.outcomeRecord?.resolvedAt?.slice(0, 10) ?? item.receivedDate,
            notes: "Accepted through closeout final billing release.",
            submittedDate: item.submittedDate ?? blocker.updatedAt.slice(0, 10)
          }
        : item;
    }),
    commercialExposureItems: commercialExposureItems.map((item) => {
      if (item.id !== canonicalCloseoutCommercialExposureId) return item;
      return resolved
        ? {
            ...item,
            status: "approved_not_billed",
            requiredAction: "Closeout restriction cleared; continue final billing and retainage processing.",
            businessImpact: "Closeout-linked commercial restriction is cleared, but payment has not yet been recorded."
          }
        : item;
    })
  };
}

function impactForBlocker(blocker: CloseoutFinalBillingBlocker): CloseoutFinalBillingImpact {
  return {
    openBlockerCount: blocker.state === "resolved" ? 0 : 1,
    resolvedBlockerCount: blocker.state === "resolved" ? 1 : 0,
    retainageAtRisk: blocker.state === "resolved" ? 0 : blocker.retainageExposureAmount,
    samePrimaryBlockerResolved: blocker.state === "resolved",
    billingProjectionStatus: blocker.billingProjection.status
  };
}

async function closeoutCommandState(result: CloseoutFinalBillingCommandResult): Promise<CloseoutFinalBillingCommandResult & CloseoutFinalBillingActionState> {
  const blocker = result.blocker;
  return {
    ...result,
    blocker,
    readiness: result.readiness ?? evaluateCloseoutReleaseReadiness(blocker),
    impact: result.impact ?? impactForBlocker(blocker),
    storageLabel: "Persisted dev store"
  };
}
