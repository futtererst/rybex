import "server-only";

import { randomUUID } from "node:crypto";

import { getAuthMode } from "../auth/auth-mode";
import { createRybexSupabaseAdminClient, createRybexSupabaseServerClient } from "../auth/supabase-server";
import { assertLocalOrTestRuntime, isTestRuntime } from "../security/runtime-mode";
import {
  applyCloseoutFinalBillingToSeedData,
  canonicalCloseoutFinalBillingId,
  type CloseoutFinalBillingActionState,
  type CloseoutFinalBillingSeedOverlay
} from "./persisted-store";
import type {
  CloseoutEvidenceReference,
  CloseoutEvidenceStatus,
  CloseoutFinalBillingCommandResult,
  CloseoutReleaseDecision
} from "./types";

type RpcResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type CloseoutRpcPayload = CloseoutFinalBillingCommandResult & CloseoutFinalBillingActionState & {
  success: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
  resultingVersion?: number;
  replayed?: boolean;
};

type RpcClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse<CloseoutRpcPayload>>;
  from(table: string): {
    insert(values: Record<string, unknown> | Record<string, unknown>[]): {
      select(columns: string): {
        single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

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

export async function getCloseoutFinalBillingBlocker(blockerId = canonicalCloseoutFinalBillingId) {
  return (await getCloseoutFinalBillingActionState(blockerId)).blocker;
}

export async function resetCloseoutFinalBillingStoreForTesting() {
  assertLocalOrTestRuntime("Closeout database fixture reset");
  const result = await callCloseoutRpc("closeout_seed_fixture_v1", {
    p_reset: true
  }, { allowTestServiceClient: true });

  return result.blocker;
}

export async function startCloseoutFinalBillingRelease(input: StartInput) {
  const state = await getCloseoutFinalBillingActionState(input.blockerId);
  return callCloseoutRpc("closeout_start_release_v1", {
    p_stable_case_key: input.blockerId ?? canonicalCloseoutFinalBillingId,
    p_command_id: commandId("closeout-start"),
    p_expected_version: blockerVersion(state),
    p_correlation_id: null
  });
}

export async function saveCloseoutRequirementAssessment(input: AssessmentInput) {
  const state = await getCloseoutFinalBillingActionState(input.blockerId);
  return callCloseoutRpc("closeout_save_assessment_v1", {
    p_stable_case_key: input.blockerId ?? canonicalCloseoutFinalBillingId,
    p_command_id: commandId("closeout-assessment"),
    p_expected_version: blockerVersion(state),
    p_acceptance_status: input.acceptanceStatus,
    p_punch_status: input.punchStatus,
    p_test_evidence_status: input.testEvidenceStatus,
    p_as_built_redline_status: input.asBuiltRedlineStatus,
    p_closeout_document_status: input.closeoutDocumentStatus,
    p_final_billing_release_status: input.finalBillingReleaseStatus,
    p_assessment_summary: input.assessmentSummary,
    p_correlation_id: null
  });
}

export async function addCloseoutEvidenceReference(input: EvidenceInput) {
  const state = await getCloseoutFinalBillingActionState(input.blockerId);
  const evidenceId = uuidOrNull(input.referenceText) ?? await maybeCreateBrowserQaEvidence(input.referenceText, input.referenceType);

  return callCloseoutRpc("closeout_attach_evidence_v1", {
    p_stable_case_key: input.blockerId ?? canonicalCloseoutFinalBillingId,
    p_command_id: commandId("closeout-evidence"),
    p_expected_version: blockerVersion(state),
    p_requirement_key: input.requirementId,
    p_evidence_id: evidenceId,
    p_reference_text: input.referenceText,
    p_reference_type: input.referenceType,
    p_correlation_id: null
  });
}

export async function validateCloseoutReleaseReadiness(blockerId = canonicalCloseoutFinalBillingId, _actorId = "Closeout user") {
  const state = await getCloseoutFinalBillingActionState(blockerId);
  return callCloseoutRpc("closeout_validate_readiness_v1", {
    p_stable_case_key: blockerId,
    p_command_id: commandId("closeout-readiness"),
    p_expected_version: blockerVersion(state),
    p_correlation_id: null
  });
}

export async function submitCloseoutReleaseForReview(input: SubmitReviewInput) {
  const state = await getCloseoutFinalBillingActionState(input.blockerId);
  return callCloseoutRpc("closeout_submit_review_v1", {
    p_stable_case_key: input.blockerId ?? canonicalCloseoutFinalBillingId,
    p_command_id: commandId("closeout-submit-review"),
    p_expected_version: blockerVersion(state),
    p_assigned_role: input.assignedRole,
    p_correlation_id: null
  });
}

export async function recordCloseoutReleaseDecision(input: ReviewDecisionInput) {
  const state = await getCloseoutFinalBillingActionState(input.blockerId);
  return callCloseoutRpc("closeout_record_decision_v1", {
    p_stable_case_key: input.blockerId ?? canonicalCloseoutFinalBillingId,
    p_command_id: commandId("closeout-review-decision"),
    p_expected_version: blockerVersion(state),
    p_decision: input.decision === "approve" ? "approved" : "rejected",
    p_decision_note: input.decisionNote,
    p_correlation_id: null
  });
}

export async function clearCloseoutFinalBillingBlocker(input: ClearInput) {
  const state = await getCloseoutFinalBillingActionState(input.blockerId);
  return callCloseoutRpc("closeout_clear_blocker_v1", {
    p_stable_case_key: input.blockerId ?? canonicalCloseoutFinalBillingId,
    p_command_id: commandId("closeout-clear-blocker"),
    p_expected_version: blockerVersion(state),
    p_resolution_note: input.resolutionNote,
    p_correlation_id: null
  });
}

export async function listOpenCloseoutFinalBillingBlockers() {
  const blocker = await getCloseoutFinalBillingBlocker();
  return blocker.state === "resolved" ? [] : [blocker];
}

export async function getCloseoutFinalBillingActionState(blockerId = canonicalCloseoutFinalBillingId): Promise<CloseoutFinalBillingActionState> {
  const result = await callCloseoutRpc("closeout_get_state_v1", {
    p_stable_case_key: blockerId
  }, { allowTestServiceClient: true });

  return {
    blocker: result.blocker,
    readiness: result.readiness,
    impact: result.impact,
    storageLabel: result.storageLabel
  };
}

export async function getCloseoutFinalBillingSeedDataOverlay(base?: Partial<CloseoutFinalBillingSeedOverlay>): Promise<CloseoutFinalBillingSeedOverlay> {
  return applyCloseoutFinalBillingToSeedData(await getCloseoutFinalBillingBlocker(), base);
}

async function callCloseoutRpc(
  name: string,
  args: Record<string, unknown>,
  options: { allowTestServiceClient?: boolean } = {}
): Promise<CloseoutRpcPayload> {
  const supabase = await createCloseoutSupabaseClient(options);
  const result = await (supabase as unknown as RpcClient).rpc(name, args);

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error(`Closeout database command ${name} returned no result.`);
  }

  if (result.data.success === false) {
    return {
      ...result.data,
      ok: false,
      message: result.data.message ?? result.data.error ?? "Closeout database command failed.",
      events: result.data.events ?? []
    };
  }

  return result.data;
}

async function createCloseoutSupabaseClient(options: { allowTestServiceClient?: boolean }) {
  const browserQaServiceClient =
    process.env.RYBEXOS_CLOSEOUT_BROWSER_QA_SERVICE_CLIENT === "1" &&
    isTestRuntime() &&
    getAuthMode() === "demo";

  if ((options.allowTestServiceClient || browserQaServiceClient) && isTestRuntime() && getAuthMode() === "demo") {
    return createRybexSupabaseAdminClient();
  }

  return createRybexSupabaseServerClient();
}

async function maybeCreateBrowserQaEvidence(referenceText: string, referenceType: CloseoutEvidenceReference["referenceType"]) {
  const browserQaServiceClient =
    process.env.RYBEXOS_CLOSEOUT_BROWSER_QA_SERVICE_CLIENT === "1" &&
    isTestRuntime() &&
    getAuthMode() === "demo";

  if (!browserQaServiceClient) return null;

  const supabase = createRybexSupabaseAdminClient() as unknown as RpcClient;
  const id = randomUUID();
  const objectPath = `10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/closeout/${id}.txt`;
  const result = await supabase.from("evidence_objects").insert({
    id,
    workspace_id: "10000000-0000-4000-8000-000000000001",
    project_id: "30000000-0000-4000-8000-000000000001",
    object_path: objectPath,
    original_filename: `${referenceType}-${id}.txt`,
    mime_type: "text/plain",
    size_bytes: Buffer.byteLength(referenceText),
    checksum_sha256: "browser-qa-closeout-managed-evidence",
    uploaded_by: "00000000-0000-4000-8000-000000000001",
    upload_status: "uploaded",
    scan_status: "not_configured",
    verification_status: "pending",
    uploaded_at: new Date().toISOString()
  }).select("id").single();

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "Unable to create Closeout browser QA evidence.");
  }

  return result.data.id;
}

function commandId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function blockerVersion(state: CloseoutFinalBillingActionState) {
  return (state.blocker as CloseoutFinalBillingActionState["blocker"] & { version?: number }).version ?? 1;
}

function uuidOrNull(value?: string) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
