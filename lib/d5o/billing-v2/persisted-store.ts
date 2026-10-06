import {
  evaluateBillingControl,
  type BillingControlSummary
} from "../billing-control";
import {
  operatingSliceNow,
  readLocalOperatingSliceStore,
  resetLocalOperatingSliceStore,
  resolveOperatingSliceStorePath,
  writeLocalOperatingSliceStore
} from "../operating-slices/local-file-store";
import {
  billingBackupItems as seedBillingBackupItems,
  changeEvents as seedChangeEvents,
  commercialExposureItems as seedCommercialExposureItems,
  lienWaivers as seedLienWaivers,
  payApplications as seedPayApplications
} from "../seed-data";
import type {
  BillingBackupItem,
  CommercialExposureItem,
  PayApplication
} from "../types";
import {
  approveCommercialReview,
  clearBillingBlocker as clearBillingBlockerCommand,
  createBillingV2DemoPackage,
  evaluateBillingPackageReadiness,
  rejectCommercialReview,
  requestCommercialReviewChanges,
  saveAmountAffected,
  saveBackupSummary,
  saveEvidenceReference,
  saveRelatedSourceRecord,
  saveResolutionNote,
  sendPackageToCommercialReview,
  startBackupPackage,
  validatePackageReadiness,
  waiveEvidenceRequirement
} from "./index";
import type {
  BillingBackupPackage,
  BillingCommandResult,
  BillingEvidenceReferenceType,
  BillingPackageReadiness,
  BillingReviewDecisionType
} from "./types";

export const canonicalBillingV2PackageId = "billing-v2-package-bb-lake-001";
export const canonicalBillingV2BackupItemId = "bb-lake-001";
export const canonicalBillingV2ExposureId = "cexp-008";
export const canonicalBillingV2PayApplicationId = "pay-lake-001";

export const billingV2StoreSchemaVersion = 1;

export type BillingV2StoreFile = {
  version: 1;
  packages: Record<string, BillingBackupPackage>;
  updatedAt: string;
  recoveredFromCorruptStore?: boolean;
  schemaVersionMismatch?: boolean;
};

export type BillingV2ActionState = {
  package: BillingBackupPackage;
  readiness: BillingPackageReadiness;
  impact: BillingCommandCenterImpact;
  storageLabel: string;
};

export type BillingCommandCenterImpact = {
  openBlockerCount: number;
  resolvedBlockerCount: number;
  cashAtRisk: number;
  billingReadinessScore: number;
  packageState: BillingBackupPackage["state"];
  samePrimaryBlockerResolved: boolean;
};

export type BillingV2SeedOverlay = {
  payApplications: PayApplication[];
  billingBackupItems: BillingBackupItem[];
  commercialExposureItems: CommercialExposureItem[];
};

type StartBillingBackupPackageInput = {
  packageId?: string;
  actorId: string;
};

type SaveBillingBackupPackageDetailsInput = {
  packageId?: string;
  actorId: string;
  backupSummary: string;
  relatedSourceRecord: string;
  amountAffected: number;
};

type AttachBillingBackupEvidenceInput = {
  packageId?: string;
  actorId: string;
  evidenceRequirementId: string;
  referenceText?: string;
  referenceType?: BillingEvidenceReferenceType;
  linkedRecordId?: string;
  storagePointer?: string;
  waiverReason?: string;
};

type SendBillingBackupToCommercialReviewInput = {
  packageId?: string;
  actorId: string;
  assignedRole: string;
  dueDate?: string;
};

type RecordBillingCommercialReviewDecisionInput = {
  packageId?: string;
  reviewTaskId?: string;
  reviewerId: string;
  decision: "approve" | "changes" | "reject";
  decisionNote: string;
};

type ClearBillingBlockerInput = {
  packageId?: string;
  actorId: string;
  resolutionNote: string;
};

function now() {
  return operatingSliceNow();
}

function storePath() {
  return resolveOperatingSliceStorePath("RYBEXOS_BILLING_V2_STORE_PATH", "billing-v2-store.json");
}

function persistedDefaultPackage(): BillingBackupPackage {
  return {
    ...createBillingV2DemoPackage(),
    id: canonicalBillingV2PackageId,
    localDemoOnly: false,
    databaseBacked: false,
    storageMode: "file_adapter"
  };
}

function normalizePackage(billingPackage: BillingBackupPackage): BillingBackupPackage {
  return {
    ...billingPackage,
    localDemoOnly: false,
    databaseBacked: false,
    storageMode: "file_adapter"
  };
}

async function readStore(): Promise<BillingV2StoreFile> {
  return readLocalOperatingSliceStore({
    path: storePath(),
    schemaVersion: billingV2StoreSchemaVersion,
    createEmptyStore,
    normalizeStore: normalizeStoreFile
  });
}

async function writeStore(store: BillingV2StoreFile) {
  await writeLocalOperatingSliceStore(store, {
    path: storePath(),
    normalizeStore: normalizeStoreFile
  });
}

function createEmptyStore(input: { recoveredFromCorruptStore?: boolean; schemaVersionMismatch?: boolean }): BillingV2StoreFile {
  return {
    version: billingV2StoreSchemaVersion,
    packages: {},
    updatedAt: now(),
    recoveredFromCorruptStore: input.recoveredFromCorruptStore,
    schemaVersionMismatch: input.schemaVersionMismatch
  };
}

function normalizeStoreFile(store: Partial<BillingV2StoreFile>): BillingV2StoreFile {
  return {
    version: billingV2StoreSchemaVersion,
    packages: isPackageMap(store.packages) ? store.packages : {},
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : now(),
    recoveredFromCorruptStore: store.recoveredFromCorruptStore,
    schemaVersionMismatch: store.schemaVersionMismatch
  };
}

function isPackageMap(value: unknown): value is Record<string, BillingBackupPackage> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function persistPackage(billingPackage: BillingBackupPackage): Promise<BillingBackupPackage> {
  const normalized = normalizePackage(billingPackage);
  const store = await readStore();
  const updatedStore: BillingV2StoreFile = {
    version: 1,
    packages: {
      ...store.packages,
      [normalized.id]: normalized
    },
    updatedAt: now()
  };

  await writeStore(updatedStore);
  return normalized;
}

async function loadPackage(packageId = canonicalBillingV2PackageId) {
  const store = await readStore();
  const existing = store.packages[packageId];

  if (existing) return normalizePackage(existing);

  const created = persistedDefaultPackage();
  await persistPackage(created);
  return created;
}

async function applyAndPersist(result: BillingCommandResult): Promise<BillingCommandResult> {
  if (!result.success) return result;

  const persisted = await persistPackage(result.package);
  return {
    ...result,
    package: persisted
  };
}

export async function getBillingBackupPackage(packageId = canonicalBillingV2PackageId) {
  return loadPackage(packageId);
}

export async function resetBillingV2PersistedStoreForTesting() {
  const billingPackage = persistedDefaultPackage();
  await resetLocalOperatingSliceStore({
    version: billingV2StoreSchemaVersion,
    packages: {
      [billingPackage.id]: billingPackage
    },
    updatedAt: billingPackage.updatedAt
  }, {
    path: storePath(),
    normalizeStore: normalizeStoreFile
  });
  return billingPackage;
}

export async function createOrStartBillingBackupPackage(input: StartBillingBackupPackageInput) {
  const billingPackage = await loadPackage(input.packageId);
  if (!["blocked", "reopened"].includes(billingPackage.state)) {
    return billingCommandState({
      success: true,
      package: billingPackage,
      events: [],
      message: "Billing backup package is already active.",
      readiness: evaluateBillingPackageReadiness(billingPackage)
    });
  }

  return billingCommandState(await applyAndPersist(startBackupPackage(billingPackage, {
    actorId: input.actorId
  })));
}

export async function saveBillingBackupPackageDetails(input: SaveBillingBackupPackageDetailsInput) {
  let current = await loadPackage(input.packageId);

  const summaryResult = saveBackupSummary(current, { actorId: input.actorId, summary: input.backupSummary });
  if (!summaryResult.success) return billingCommandState(summaryResult);
  current = summaryResult.package;

  const sourceResult = saveRelatedSourceRecord(current, {
    actorId: input.actorId,
    sourceRecordId: canonicalBillingV2ExposureId,
    sourceRecordLabel: input.relatedSourceRecord,
    sourceRecordType: "billing backup / stored material support"
  });
  if (!sourceResult.success) return billingCommandState(sourceResult);
  current = sourceResult.package;

  const amountResult = saveAmountAffected(current, {
    actorId: input.actorId,
    amountAffected: input.amountAffected,
    currency: "USD"
  });
  if (!amountResult.success) return billingCommandState(amountResult);

  return billingCommandState(await applyAndPersist(amountResult));
}

export async function attachBillingBackupEvidence(input: AttachBillingBackupEvidenceInput) {
  const billingPackage = await loadPackage(input.packageId);
  const result = input.waiverReason
    ? waiveEvidenceRequirement(billingPackage, {
        actorId: input.actorId,
        evidenceRequirementId: input.evidenceRequirementId,
        waiverReason: input.waiverReason
      })
    : saveEvidenceReference(billingPackage, {
        actorId: input.actorId,
        evidenceRequirementId: input.evidenceRequirementId,
        referenceText: input.referenceText ?? "",
        referenceType: input.referenceType ?? "document_reference",
        linkedRecordId: input.linkedRecordId,
        storagePointer: input.storagePointer
      });

  return billingCommandState(await applyAndPersist(result));
}

export async function validateBillingBackupPackage(packageId = canonicalBillingV2PackageId, actorId = "Billing user") {
  const billingPackage = await loadPackage(packageId);
  return billingCommandState(await applyAndPersist(validatePackageReadiness(billingPackage, { actorId })));
}

export async function sendBillingBackupToCommercialReview(input: SendBillingBackupToCommercialReviewInput) {
  const billingPackage = await loadPackage(input.packageId);
  return billingCommandState(await applyAndPersist(sendPackageToCommercialReview(billingPackage, {
    actorId: input.actorId,
    assignedRole: input.assignedRole,
    dueDate: input.dueDate
  })));
}

export async function recordBillingCommercialReviewDecision(input: RecordBillingCommercialReviewDecisionInput) {
  const billingPackage = await loadPackage(input.packageId);
  const reviewTaskId = input.reviewTaskId ?? billingPackage.reviewTask?.id ?? "";
  const command = {
    reviewTaskId,
    reviewerId: input.reviewerId,
    decisionNote: input.decisionNote
  };
  const result = input.decision === "approve"
    ? approveCommercialReview(billingPackage, command)
    : input.decision === "changes"
      ? requestCommercialReviewChanges(billingPackage, command)
      : rejectCommercialReview(billingPackage, command);

  return billingCommandState(await applyAndPersist(result));
}

export async function clearBillingBlocker(input: ClearBillingBlockerInput) {
  const billingPackage = await loadPackage(input.packageId);
  const noteResult = saveResolutionNote(billingPackage, {
    actorId: input.actorId,
    resolutionNote: input.resolutionNote
  });

  if (!noteResult.success) return billingCommandState(noteResult);

  return billingCommandState(await applyAndPersist(clearBillingBlockerCommand(noteResult.package, {
    actorId: input.actorId
  })));
}

export async function listOpenBillingBlockers() {
  const billingPackage = await loadPackage();
  return billingPackage.state === "billing_blocker_cleared" ? [] : [billingPackage];
}

export async function getBillingCommandCenterImpact() {
  const billingPackage = await loadPackage();
  const overlay = applyBillingV2PackageToSeedData(billingPackage);
  const summary = evaluateBillingControl({
    payApplications: overlay.payApplications,
    backupItems: overlay.billingBackupItems,
    lienWaivers: seedLienWaivers,
    commercialExposure: overlay.commercialExposureItems,
    changeEvents: seedChangeEvents
  });

  return impactFromSummary(billingPackage, summary);
}

export async function getBillingV2ActionState(packageId = canonicalBillingV2PackageId): Promise<BillingV2ActionState> {
  const billingPackage = await loadPackage(packageId);

  return {
    package: billingPackage,
    readiness: evaluateBillingPackageReadiness(billingPackage),
    impact: await getBillingCommandCenterImpact(),
    storageLabel: storageLabelForPackage(billingPackage)
  };
}

export async function getBillingV2SeedDataOverlay(): Promise<BillingV2SeedOverlay> {
  return applyBillingV2PackageToSeedData(await loadPackage());
}

export function applyBillingV2PackageToSeedData(billingPackage: BillingBackupPackage): BillingV2SeedOverlay {
  const cleared = billingPackage.state === "billing_blocker_cleared";
  const sourceLabel = billingPackage.outcomeRecord?.id ?? billingPackage.id;

  return {
    billingBackupItems: seedBillingBackupItems.map((item) => {
      if (item.id !== canonicalBillingV2BackupItemId) return item;

      return cleared
        ? {
            ...item,
            status: "verified",
            linkedRecordIds: Array.from(new Set([...item.linkedRecordIds, sourceLabel])),
            notes: billingPackage.resolutionNote ?? "Billing V2 backup package cleared."
          }
        : {
            ...item,
            status: billingPackage.evidenceRequirements.some((requirement) => requirement.status !== "missing") ? "partial" : item.status,
            notes: billingPackage.backupSummary ?? item.notes
          };
    }),
    commercialExposureItems: seedCommercialExposureItems.map((item) => {
      if (item.id !== canonicalBillingV2ExposureId) return item;

      return cleared
        ? {
            ...item,
            status: "recovered",
            requiredAction: "Billing V2 backup package cleared; confirm pay application submission readiness.",
            businessImpact: billingPackage.outcomeRecord?.outcome ?? "Missing backup blocker cleared."
          }
        : item;
    }),
    payApplications: seedPayApplications.map((payApplication) => {
      if (payApplication.id !== canonicalBillingV2PayApplicationId) return payApplication;
      if (!cleared) return payApplication;

      const missingBackupItems = payApplication.missingBackupItems.filter((item) =>
        !item.toLowerCase().includes("vault product")
      );

      return {
        ...payApplication,
        backupStatus: missingBackupItems.length > 0 ? "partial" : "verified",
        missingBackupItems,
        nextAction: missingBackupItems.length > 0
          ? "Billing V2 backup package cleared; resolve remaining billing support before submission."
          : "Billing V2 backup package cleared; submit pay application for commercial review.",
        updatedAt: billingPackage.updatedAt
      };
    })
  };
}

function impactFromSummary(
  billingPackage: BillingBackupPackage,
  summary: BillingControlSummary
): BillingCommandCenterImpact {
  return {
    openBlockerCount: billingPackage.state === "billing_blocker_cleared" ? 0 : 1,
    resolvedBlockerCount: billingPackage.state === "billing_blocker_cleared" ? 1 : 0,
    cashAtRisk: summary.cashAtRisk,
    billingReadinessScore: summary.billingReadinessScore,
    packageState: billingPackage.state,
    samePrimaryBlockerResolved: billingPackage.state === "billing_blocker_cleared"
  };
}

function storageLabelForPackage(billingPackage: BillingBackupPackage) {
  if (billingPackage.databaseBacked) return "Database-backed";
  if (billingPackage.localDemoOnly) return "Fallback demo state";
  return "Persisted dev store";
}

async function billingCommandState(result: BillingCommandResult): Promise<BillingCommandResult & BillingV2ActionState> {
  const billingPackage = result.package;
  return {
    ...result,
    package: billingPackage,
    readiness: result.readiness ?? evaluateBillingPackageReadiness(billingPackage),
    impact: await getBillingCommandCenterImpact(),
    storageLabel: storageLabelForPackage(billingPackage)
  };
}
