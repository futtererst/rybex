import "server-only";

import { randomUUID } from "node:crypto";

import { createRybexSupabaseAdminClient, createRybexSupabaseServerClient } from "../auth/supabase-server";
import { getAuthMode } from "../auth/auth-mode";
import { isTestRuntime, assertLocalOrTestRuntime } from "../security/runtime-mode";
import {
  applyBillingV2PackageToSeedData,
  canonicalBillingV2PackageId,
  type BillingCommandCenterImpact,
  type BillingV2ActionState,
  type BillingV2SeedOverlay
} from "./persisted-store";
import type {
  BillingCommandResult,
  BillingEvidenceReferenceType
} from "./types";

type RpcResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type BillingRpcPayload = BillingCommandResult & BillingV2ActionState & {
  success: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
  resultingVersion?: number;
  replayed?: boolean;
};

type RpcClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse<BillingRpcPayload>>;
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

export async function getBillingBackupPackage(packageId = canonicalBillingV2PackageId) {
  return (await getBillingV2ActionState(packageId)).package;
}

export async function resetBillingV2PersistedStoreForTesting() {
  assertLocalOrTestRuntime("Billing V2 database fixture reset");
  const result = await callBillingRpc("billing_v2_seed_fixture_v1", {
    p_reset: true
  }, { allowTestServiceClient: true });

  return result.package;
}

export async function createOrStartBillingBackupPackage(input: StartBillingBackupPackageInput) {
  const state = await getBillingV2ActionState(input.packageId);
  return callBillingRpc("billing_v2_start_package_v1", {
    p_stable_package_key: input.packageId ?? canonicalBillingV2PackageId,
    p_command_id: commandId("billing-start"),
    p_expected_version: packageVersion(state.package),
    p_correlation_id: null
  });
}

export async function saveBillingBackupPackageDetails(input: SaveBillingBackupPackageDetailsInput) {
  const state = await getBillingV2ActionState(input.packageId);
  return callBillingRpc("billing_v2_save_package_details_v1", {
    p_stable_package_key: input.packageId ?? canonicalBillingV2PackageId,
    p_command_id: commandId("billing-details"),
    p_expected_version: packageVersion(state.package),
    p_backup_summary: input.backupSummary,
    p_related_source_record: input.relatedSourceRecord,
    p_amount_affected: input.amountAffected,
    p_correlation_id: null
  });
}

export async function attachBillingBackupEvidence(input: AttachBillingBackupEvidenceInput) {
  const state = await getBillingV2ActionState(input.packageId);
  return callBillingRpc("billing_v2_attach_evidence_v1", {
    p_stable_package_key: input.packageId ?? canonicalBillingV2PackageId,
    p_command_id: commandId("billing-evidence"),
    p_expected_version: packageVersion(state.package),
    p_requirement_key: input.evidenceRequirementId,
    p_evidence_id: uuidOrNull(input.storagePointer),
    p_reference_text: input.referenceText ?? null,
    p_reference_type: input.referenceType ?? "document_reference",
    p_waiver_reason: input.waiverReason ?? null,
    p_correlation_id: null
  });
}

export async function validateBillingBackupPackage(packageId = canonicalBillingV2PackageId) {
  const state = await getBillingV2ActionState(packageId);
  return callBillingRpc("billing_v2_validate_readiness_v1", {
    p_stable_package_key: packageId,
    p_command_id: commandId("billing-readiness"),
    p_expected_version: packageVersion(state.package),
    p_correlation_id: null
  });
}

export async function sendBillingBackupToCommercialReview(input: SendBillingBackupToCommercialReviewInput) {
  const state = await getBillingV2ActionState(input.packageId);
  return callBillingRpc("billing_v2_submit_review_v1", {
    p_stable_package_key: input.packageId ?? canonicalBillingV2PackageId,
    p_command_id: commandId("billing-submit-review"),
    p_expected_version: packageVersion(state.package),
    p_assigned_role: input.assignedRole,
    p_due_date: input.dueDate ?? null,
    p_correlation_id: null
  });
}

export async function recordBillingCommercialReviewDecision(input: RecordBillingCommercialReviewDecisionInput) {
  const state = await getBillingV2ActionState(input.packageId);
  return callBillingRpc("billing_v2_record_decision_v1", {
    p_stable_package_key: input.packageId ?? canonicalBillingV2PackageId,
    p_command_id: commandId("billing-review-decision"),
    p_expected_version: packageVersion(state.package),
    p_decision: normalizeReviewDecision(input.decision),
    p_decision_note: input.decisionNote,
    p_correlation_id: null
  });
}

export async function clearBillingBlocker(input: ClearBillingBlockerInput) {
  const state = await getBillingV2ActionState(input.packageId);
  return callBillingRpc("billing_v2_clear_blocker_v1", {
    p_stable_package_key: input.packageId ?? canonicalBillingV2PackageId,
    p_command_id: commandId("billing-clear-blocker"),
    p_expected_version: packageVersion(state.package),
    p_resolution_note: input.resolutionNote,
    p_correlation_id: null
  });
}

export async function listOpenBillingBlockers() {
  const billingPackage = await getBillingBackupPackage();
  return billingPackage.state === "billing_blocker_cleared" ? [] : [billingPackage];
}

export async function getBillingCommandCenterImpact(): Promise<BillingCommandCenterImpact> {
  return (await getBillingV2ActionState()).impact;
}

export async function getBillingV2ActionState(packageId = canonicalBillingV2PackageId): Promise<BillingV2ActionState> {
  const result = await callBillingRpc("billing_v2_get_package_v1", {
    p_stable_package_key: packageId
  }, { allowTestServiceClient: true });

  return {
    package: result.package,
    readiness: result.readiness,
    impact: result.impact,
    storageLabel: result.storageLabel
  };
}

export async function getBillingV2SeedDataOverlay(): Promise<BillingV2SeedOverlay> {
  return applyBillingV2PackageToSeedData(await getBillingBackupPackage());
}

async function callBillingRpc(
  name: string,
  args: Record<string, unknown>,
  options: { allowTestServiceClient?: boolean } = {}
): Promise<BillingRpcPayload> {
  const supabase = await createBillingSupabaseClient(options);
  const result = await (supabase as unknown as RpcClient).rpc(name, args);

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error(`Billing V2 database command ${name} returned no result.`);
  }

  if (result.data.success === false) {
    return {
      ...result.data,
      ok: false,
      message: result.data.message ?? result.data.error ?? "Billing V2 database command failed.",
      events: result.data.events ?? []
    };
  }

  return result.data;
}

async function createBillingSupabaseClient(options: { allowTestServiceClient?: boolean }) {
  const browserQaServiceClient =
    process.env.RYBEXOS_BILLING_V2_BROWSER_QA_SERVICE_CLIENT === "1" &&
    isTestRuntime() &&
    getAuthMode() === "demo";

  if ((options.allowTestServiceClient || browserQaServiceClient) && isTestRuntime() && getAuthMode() === "demo") {
    return createRybexSupabaseAdminClient();
  }

  return createRybexSupabaseServerClient();
}

function commandId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function packageVersion(billingPackage: BillingV2ActionState["package"]) {
  return (billingPackage as BillingV2ActionState["package"] & { version?: number }).version ?? 1;
}

function normalizeReviewDecision(decision: "approve" | "changes" | "reject") {
  if (decision === "approve") return "approved";
  if (decision === "changes") return "changes_requested";
  return "rejected";
}

function uuidOrNull(value?: string) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
