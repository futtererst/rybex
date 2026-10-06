import "server-only";

import { randomUUID } from "node:crypto";

import { getAuthMode } from "../auth/auth-mode";
import { createRybexSupabaseAdminClient, createRybexSupabaseServerClient } from "../auth/supabase-server";
import { assertLocalOrTestRuntime, isTestRuntime } from "../security/runtime-mode";
import { applyFieldIssueToSeedData, canonicalFieldIssueId, type FieldIssueActionState, type FieldIssueSeedOverlay } from "./persisted-store";
import type {
  FieldIssueCommandResult,
  FieldIssueEscalationPath,
  FieldIssueEvidenceReferenceType,
  FieldIssueImpactAssessment
} from "./types";

type RpcResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type FieldRpcPayload = FieldIssueCommandResult & FieldIssueActionState & {
  success: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
  resultingVersion?: number;
  replayed?: boolean;
};

type RpcClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse<FieldRpcPayload>>;
  from(table: string): {
    insert(values: Record<string, unknown> | Record<string, unknown>[]): {
      select(columns: string): {
        single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

type StartFieldIssueEscalationInput = {
  issueId?: string;
  actorId: string;
};

type SaveFieldIssueAssessmentInput = {
  issueId?: string;
  actorId: string;
  issueType: FieldIssueImpactAssessment["issueType"];
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

export async function getFieldIssueEscalation(issueId = canonicalFieldIssueId) {
  return (await getFieldIssueActionState(issueId)).issue;
}

export async function resetFieldIssueEscalationStoreForTesting() {
  assertLocalOrTestRuntime("Field Issue database fixture reset");
  const result = await callFieldRpc("field_issue_seed_fixture_v1", {
    p_reset: true
  }, { allowTestServiceClient: true });

  return result.issue;
}

export async function startFieldIssueEscalation(input: StartFieldIssueEscalationInput) {
  const state = await getFieldIssueActionState(input.issueId);
  return callFieldRpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-start"),
    p_expected_version: issueVersion(state),
    p_correlation_id: null
  });
}

export async function saveFieldIssueAssessment(input: SaveFieldIssueAssessmentInput) {
  const state = await getFieldIssueActionState(input.issueId);
  return callFieldRpc("field_issue_save_assessment_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-assessment"),
    p_expected_version: issueVersion(state),
    p_issue_type: input.issueType,
    p_impact_summary: input.impactSummary,
    p_schedule_impact: input.scheduleImpact,
    p_schedule_days: input.scheduleDays,
    p_cost_exposure: input.costExposure,
    p_safety_impact: input.safetyImpact,
    p_quality_impact: input.qualityImpact,
    p_correlation_id: null
  });
}

export async function addFieldIssueEvidenceReference(input: AddFieldIssueEvidenceInput) {
  const state = await getFieldIssueActionState(input.issueId);
  const evidenceId = uuidOrNull(input.referenceText) ?? await maybeCreateBrowserQaEvidence(input.referenceText, input.referenceType);

  return callFieldRpc("field_issue_attach_evidence_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-evidence"),
    p_expected_version: issueVersion(state),
    p_requirement_key: input.requirementId,
    p_evidence_id: evidenceId,
    p_reference_text: input.referenceText,
    p_reference_type: input.referenceType,
    p_correlation_id: null
  });
}

export async function selectFieldIssueEscalationPath(input: SelectFieldIssuePathInput) {
  const state = await getFieldIssueActionState(input.issueId);
  return callFieldRpc("field_issue_select_path_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-path"),
    p_expected_version: issueVersion(state),
    p_path: input.path,
    p_correlation_id: null
  });
}

export async function createRfiFromFieldIssue(input: StartFieldIssueEscalationInput) {
  const state = await getFieldIssueActionState(input.issueId);
  return callFieldRpc("field_issue_create_rfi_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-rfi"),
    p_expected_version: issueVersion(state),
    p_correlation_id: null
  });
}

export async function createChangeEventFromFieldIssue(input: StartFieldIssueEscalationInput) {
  const state = await getFieldIssueActionState(input.issueId);
  return callFieldRpc("field_issue_create_change_event_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-change"),
    p_expected_version: issueVersion(state),
    p_correlation_id: null
  });
}

export async function resolveFieldIssueEscalation(input: ResolveFieldIssueEscalationInput) {
  const state = await getFieldIssueActionState(input.issueId);
  return callFieldRpc("field_issue_resolve_escalation_v1", {
    p_stable_issue_key: input.issueId ?? canonicalFieldIssueId,
    p_command_id: commandId("field-resolve"),
    p_expected_version: issueVersion(state),
    p_resolution_note: input.resolutionNote,
    p_correlation_id: null
  });
}

export async function listOpenFieldIssues() {
  const issue = await getFieldIssueEscalation();
  return issue.state === "resolved" ? [] : [issue];
}

export async function getFieldIssueCommandCenterImpact() {
  return (await getFieldIssueActionState()).impact;
}

export async function getFieldIssueActionState(issueId = canonicalFieldIssueId): Promise<FieldIssueActionState> {
  const result = await callFieldRpc("field_issue_get_state_v1", {
    p_stable_issue_key: issueId
  }, { allowTestServiceClient: true });

  return {
    issue: result.issue,
    readiness: result.readiness,
    impact: result.impact,
    storageLabel: result.storageLabel
  };
}

export async function getFieldIssueSeedDataOverlay(): Promise<FieldIssueSeedOverlay> {
  return applyFieldIssueToSeedData(await getFieldIssueEscalation());
}

async function callFieldRpc(
  name: string,
  args: Record<string, unknown>,
  options: { allowTestServiceClient?: boolean } = {}
): Promise<FieldRpcPayload> {
  const supabase = await createFieldSupabaseClient(options);
  const result = await (supabase as unknown as RpcClient).rpc(name, args);

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error(`Field Issue database command ${name} returned no result.`);
  }

  if (result.data.success === false) {
    return {
      ...result.data,
      ok: false,
      message: result.data.message ?? result.data.error ?? "Field Issue database command failed.",
      events: result.data.events ?? []
    };
  }

  return result.data;
}

async function createFieldSupabaseClient(options: { allowTestServiceClient?: boolean }) {
  const browserQaServiceClient =
    process.env.RYBEXOS_FIELD_ISSUE_BROWSER_QA_SERVICE_CLIENT === "1" &&
    isTestRuntime() &&
    getAuthMode() === "demo";

  if ((options.allowTestServiceClient || browserQaServiceClient) && isTestRuntime() && getAuthMode() === "demo") {
    return createRybexSupabaseAdminClient();
  }

  return createRybexSupabaseServerClient();
}

async function maybeCreateBrowserQaEvidence(referenceText: string, referenceType: FieldIssueEvidenceReferenceType) {
  const browserQaServiceClient =
    process.env.RYBEXOS_FIELD_ISSUE_BROWSER_QA_SERVICE_CLIENT === "1" &&
    isTestRuntime() &&
    getAuthMode() === "demo";

  if (!browserQaServiceClient) return null;

  const supabase = createRybexSupabaseAdminClient() as unknown as RpcClient;
  const id = randomUUID();
  const objectPath = `10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/field-issue/${id}.txt`;
  const result = await supabase.from("evidence_objects").insert({
    id,
    workspace_id: "10000000-0000-4000-8000-000000000001",
    project_id: "30000000-0000-4000-8000-000000000001",
    object_path: objectPath,
    original_filename: `${referenceType}-${id}.txt`,
    mime_type: "text/plain",
    size_bytes: Buffer.byteLength(referenceText),
    checksum_sha256: "browser-qa-managed-evidence",
    uploaded_by: "00000000-0000-4000-8000-000000000001",
    upload_status: "uploaded",
    scan_status: "not_configured",
    verification_status: "pending",
    uploaded_at: new Date().toISOString()
  }).select("id").single();

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "Unable to create Field Issue browser QA evidence.");
  }

  return result.data.id;
}

function commandId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function issueVersion(state: FieldIssueActionState) {
  return (state.issue as FieldIssueActionState["issue"] & { version?: number }).version ?? 1;
}

function uuidOrNull(value?: string) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
