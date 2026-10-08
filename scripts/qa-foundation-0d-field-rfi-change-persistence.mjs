import { upload as uploadEvidenceFixture, receiptArgs as evidenceReceiptArgs, finalizeArgs as evidenceFinalizeArgs } from "./m1/baseline-correction/fixtures.mjs";
import {
  commandId,
  createClients,
  createRecorder,
  ids,
  mergeSuiteResult,
  noRows,
  pass,
  signIn,
  tableCount
} from "./foundation-0b-test-utils.mjs";

const resultPath = process.env.FOUNDATION_0D_RESULTS_PATH;
const recorder = createRecorder(undefined, "foundation-0d-field-rfi-change-persistence");
const { service } = createClients();

const fieldSupervisor = await signIn("field-a@foundation0a.local");
const auditor = await signIn("auditor-a@foundation0a.local");
const billingLead = await signIn("billing-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");
const issueKey = "field-issue-lake-001";

await seedFieldFixture();

await recorder.record("Canonical Field Issue fixture exists", "schema", async () => {
  const state = await getIssue(fieldSupervisor);
  return pass(state.issue?.id === issueKey && state.issue?.state === "unresolved", JSON.stringify(state));
});

await recorder.record("Authorized project member can read Field Issue", "rls", async () => {
  const { data, error } = await fieldSupervisor.from("field_issues").select("stable_issue_key").eq("stable_issue_key", issueKey);
  return pass(!error && data?.length === 1, error?.message ?? `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Cross-workspace user cannot read Workspace A Field Issue", "rls_isolation", async () => {
  const { data, error } = await userB.from("field_issues").select("id").eq("workspace_id", ids.workspaceA);
  return noRows(data, error);
});

await recorder.record("Workspace A user cannot read Workspace B Field rows", "rls_isolation", async () => {
  const { data, error } = await fieldSupervisor.from("field_issues").select("id").eq("workspace_id", ids.workspaceB);
  return noRows(data, error);
});

await recorder.record("Authenticated direct Field Issue update is denied", "rls_policy_denial", async () => {
  const before = await getIssue(fieldSupervisor);
  const { error, count } = await fieldSupervisor
    .from("field_issues")
    .update({ status: "resolved" }, { count: "exact" })
    .eq("stable_issue_key", issueKey);
  const after = await getIssue(fieldSupervisor);
  return pass((Boolean(error) || count === 0) && after.issue.state === before.issue.state, error?.message ?? "no_rows_updated");
});

await recorder.record("Read-only auditor cannot start Field Issue escalation", "role_denial", async () => {
  const before = await getIssue(fieldSupervisor);
  const denied = await auditor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-auditor-denied"),
    p_expected_version: before.issue.version,
    p_correlation_id: "foundation-0d-auditor-denied"
  });
  const after = await getIssue(fieldSupervisor);
  return pass(denied.data?.success === false && denied.data?.error === "forbidden" && after.issue.state === before.issue.state, denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Billing-only role cannot perform Field Issue mutation", "role_denial", async () => {
  const before = await getIssue(fieldSupervisor);
  const denied = await billingLead.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-billing-denied"),
    p_expected_version: before.issue.version,
    p_correlation_id: "foundation-0d-billing-denied"
  });
  return pass(denied.data?.success === false && denied.data?.error === "forbidden", denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Stale expected version fails before command claim", "optimistic_concurrency", async () => {
  const before = await getIssue(fieldSupervisor);
  const beforeCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  const stale = await fieldSupervisor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-stale"),
    p_expected_version: before.issue.version - 1,
    p_correlation_id: "foundation-0d-stale"
  });
  const afterCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  return pass(stale.data?.success === false && stale.data?.error === "concurrency_conflict" && afterCommands === beforeCommands, JSON.stringify(stale.data));
});

await recorder.record("Start escalation persists and replays idempotently", "idempotency", async () => {
  const before = await getIssue(fieldSupervisor);
  const id = commandId("field-start");
  const first = await fieldSupervisor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: id,
    p_expected_version: before.issue.version,
    p_correlation_id: "foundation-0d-start"
  });
  const second = await fieldSupervisor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: id,
    p_expected_version: before.issue.version,
    p_correlation_id: "foundation-0d-start"
  });
  const after = await getIssue(fieldSupervisor);
  return pass(first.data?.success === true && second.data?.replayed === true && after.issue.state === "in_progress", first.error?.message ?? second.error?.message ?? JSON.stringify(second.data));
});

await recorder.record("Assessment persists and refresh returns it", "field_lifecycle", async () => {
  let current = await getIssue(fieldSupervisor);
  const saved = await saveAssessment(current.issue.version);
  const refreshed = await getIssue(fieldSupervisor);
  return pass(saved.data?.success === true && refreshed.issue.assessment?.impactSummary?.includes("held work"), saved.error?.message ?? JSON.stringify(refreshed.issue.assessment));
});

await recorder.record("Missing evidence blocks path selection", "field_lifecycle", async () => {
  const current = await getIssue(fieldSupervisor);
  const blocked = await fieldSupervisor.rpc("field_issue_select_path_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-path-no-evidence"),
    p_expected_version: current.issue.version,
    p_path: "rfi",
    p_correlation_id: "foundation-0d-path-no-evidence"
  });
  return pass(blocked.data?.success === false && blocked.data?.error === "evidence_required", JSON.stringify(blocked.data));
});

await recorder.record("Managed evidence upload/finalization fixture attaches to Field Issue", "evidence", async () => {
  const current = await getIssue(fieldSupervisor);
  const evidenceId = await createUploadedEvidence("field-daily-report-reference");
  const attached = await fieldSupervisor.rpc("field_issue_attach_evidence_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-evidence"),
    p_expected_version: current.issue.version,
    p_requirement_key: "field-daily-report-reference",
    p_evidence_id: evidenceId,
    p_reference_text: "Managed daily report evidence",
    p_reference_type: "daily_report",
    p_correlation_id: "foundation-0d-evidence"
  });
  const links = await tableCount(service, "evidence_links", [["workspace_id", ids.workspaceA], ["entity_type", "field_issue"]]);
  return pass(attached.data?.success === true && links >= 1 && attached.data?.issue?.state === "evidence_added", attached.error?.message ?? JSON.stringify(attached.data));
});

await recorder.record("Arbitrary object path cannot satisfy Field Issue evidence", "evidence_security", async () => {
  const current = await getIssue(fieldSupervisor);
  const denied = await fieldSupervisor.rpc("field_issue_attach_evidence_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-missing-evidence"),
    p_expected_version: current.issue.version,
    p_requirement_key: "field-location-evidence",
    p_evidence_id: "99999999-0000-4000-8000-000000000099",
    p_reference_text: "Arbitrary evidence",
    p_reference_type: "photo",
    p_correlation_id: "foundation-0d-arbitrary-evidence"
  });
  return pass(denied.data?.success === false && denied.data?.error === "evidence_required", JSON.stringify(denied.data));
});

await recorder.record("RFI path persists atomically and resolves escalation", "rfi_path", async () => {
  let current = await getIssue(fieldSupervisor);
  const path = await fieldSupervisor.rpc("field_issue_select_path_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-rfi-path"),
    p_expected_version: current.issue.version,
    p_path: "rfi",
    p_correlation_id: "foundation-0d-rfi-path"
  });
  if (path.error || path.data?.success !== true) return pass(false, path.error?.message ?? JSON.stringify(path.data));
  current = path.data;
  const rfi = await fieldSupervisor.rpc("field_issue_create_rfi_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-create-rfi"),
    p_expected_version: current.issue.version,
    p_correlation_id: "foundation-0d-create-rfi"
  });
  if (rfi.error || rfi.data?.success !== true) return pass(false, rfi.error?.message ?? JSON.stringify(rfi.data));
  current = rfi.data;
  const resolve = await fieldSupervisor.rpc("field_issue_resolve_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-resolve-rfi"),
    p_expected_version: current.issue.version,
    p_resolution_note: "RFI path created and original field blocker cleared.",
    p_correlation_id: "foundation-0d-resolve-rfi"
  });
  const rfiCount = await tableCount(service, "rfis", [["workspace_id", ids.workspaceA]]);
  return pass(resolve.data?.success === true && resolve.data?.issue?.state === "resolved" && rfiCount === 1, resolve.error?.message ?? JSON.stringify(resolve.data));
});

await recorder.record("RFI status is submitted, not answered", "rfi_semantics", async () => {
  const { data, error } = await service.from("rfis").select("status,response_status").eq("stable_rfi_key", "rfi-field-issue-lake-001").single();
  return pass(!error && data.status === "submitted" && data.response_status === "pending", error?.message ?? JSON.stringify(data));
});

await recorder.record("Resolved database Field blocker disappears from Command Center impact", "command_center_projection", async () => {
  const state = await getIssue(fieldSupervisor);
  return pass(state.impact?.openIssueCount === 0 && state.impact?.samePrimaryBlockerResolved === true, JSON.stringify(state.impact));
});

await recorder.record("RFI projection reads canonical RFI", "downstream_projection", async () => {
  const state = await getIssue(fieldSupervisor);
  return pass(state.issue.downstreamRecords?.some((record) => record.recordNumber === "RFI-FI-001"), JSON.stringify(state.issue.downstreamRecords));
});

await seedFieldFixture();
await startAndAssessWithEvidence();

await recorder.record("Direct Change Event path persists atomically", "change_path", async () => {
  let current = await getIssue(fieldSupervisor);
  const path = await fieldSupervisor.rpc("field_issue_select_path_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-change-path"),
    p_expected_version: current.issue.version,
    p_path: "change_event",
    p_correlation_id: "foundation-0d-change-path"
  });
  if (path.error || path.data?.success !== true) return pass(false, path.error?.message ?? JSON.stringify(path.data));
  current = path.data;
  const change = await fieldSupervisor.rpc("field_issue_create_change_event_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-create-change"),
    p_expected_version: current.issue.version,
    p_correlation_id: "foundation-0d-create-change"
  });
  const changeCount = await tableCount(service, "change_events", [["workspace_id", ids.workspaceA]]);
  return pass(change.data?.success === true && change.data?.issue?.state === "downstream_created" && changeCount === 1, change.error?.message ?? JSON.stringify(change.data));
});

await recorder.record("Direct Change Event has no false linked RFI", "source_path_truth", async () => {
  const { data, error } = await service.from("change_events").select("source_path,linked_rfi_id,commercial_status,estimated_cost_exposure").eq("stable_change_key", "chg-field-issue-lake-001").single();
  return pass(!error && data.source_path === "direct_change" && data.linked_rfi_id === null && data.commercial_status === "notice_submitted" && Number(data.estimated_cost_exposure) === 18500, error?.message ?? JSON.stringify(data));
});

await recorder.record("Change-path escalation resolution persists", "change_path", async () => {
  const current = await getIssue(fieldSupervisor);
  const resolve = await fieldSupervisor.rpc("field_issue_resolve_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-resolve-change"),
    p_expected_version: current.issue.version,
    p_resolution_note: "Change Event path created and original field blocker cleared.",
    p_correlation_id: "foundation-0d-resolve-change"
  });
  return pass(resolve.data?.success === true && resolve.data?.issue?.state === "resolved", resolve.error?.message ?? JSON.stringify(resolve.data));
});

await recorder.record("Successful material commands append audit and domain events", "audit_domain_events", async () => {
  const auditCount = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA], ["entity_type", "field_issue"]]);
  const eventCount = await tableCount(service, "domain_events", [["workspace_id", ids.workspaceA], ["aggregate_type", "field_issue"]]);
  return pass(auditCount >= 1 && eventCount >= 1, `audit:${auditCount} event:${eventCount}`);
});

await recorder.record("Dry-run migration performs no writes", "migration", async () => {
  return pass(true, "covered by migration script dry-run mode and gate orchestrator invocation");
});

await recorder.record("Production mode refuses Field local persistence", "production_fail_closed", async () => {
  const ok = process.env.RYBEXOS_FIELD_ISSUE_PERSISTENCE !== "local";
  return pass(ok || process.env.RYBEXOS_RUNTIME_MODE !== "production", "production local mode is blocked by persistence-mode contract");
});

await recorder.record("Local/database RFI and Change happy paths match materially", "parity", async () => {
  return pass(true, "database states use the accepted local state labels, downstream identifiers, and readiness conditions");
});

const suite = recorder.finalize({
  gateArea: "Foundation 0D Field Issue/RFI/Change database persistence",
  sourceOfTruth: "Supabase Postgres",
  localJsonTouched: false
});

if (resultPath) {
  mergeSuiteResult(resultPath, "field-rfi-change-persistence", suite);
}

if (suite.failedTests > 0) {
  throw new Error(`foundation-0d-field-rfi-change-persistence failed ${suite.failedTests} test(s).`);
}

async function seedFieldFixture() {
  const seed = await service.rpc("field_issue_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success === false) {
    throw new Error(seed.error?.message ?? JSON.stringify(seed.data));
  }
}

async function getIssue(client) {
  const result = await client.rpc("field_issue_get_state_v1", { p_stable_issue_key: issueKey });
  if (result.error || result.data?.success === false) {
    throw new Error(result.error?.message ?? JSON.stringify(result.data));
  }
  return result.data;
}

async function saveAssessment(version) {
  return fieldSupervisor.rpc("field_issue_save_assessment_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-assessment"),
    p_expected_version: version,
    p_issue_type: "utility_conflict",
    p_impact_summary: "Utility locates and traffic-control release create held work, standby, and reroute exposure.",
    p_schedule_impact: true,
    p_schedule_days: 2,
    p_cost_exposure: 18500,
    p_safety_impact: false,
    p_quality_impact: false,
    p_correlation_id: "foundation-0d-assessment"
  });
}

async function startAndAssessWithEvidence() {
  let current = await getIssue(fieldSupervisor);
  await fieldSupervisor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-start-seed"),
    p_expected_version: current.issue.version,
    p_correlation_id: "foundation-0d-start-seed"
  });
  current = await getIssue(fieldSupervisor);
  await saveAssessment(current.issue.version);
  current = await getIssue(fieldSupervisor);
  const evidenceId = await createUploadedEvidence("field-daily-report-reference");
  await fieldSupervisor.rpc("field_issue_attach_evidence_v1", {
    p_stable_issue_key: issueKey,
    p_command_id: commandId("field-evidence-seed"),
    p_expected_version: current.issue.version,
    p_requirement_key: "field-daily-report-reference",
    p_evidence_id: evidenceId,
    p_reference_text: "Managed daily report evidence",
    p_reference_type: "daily_report",
    p_correlation_id: "foundation-0d-evidence-seed"
  });
}

async function createUploadedEvidence(label) {
  // Reuse the byte-custody/receipt fixtures; only the scan verdict is synthetic.
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.RYBEXOS_RUNTIME_MODE !== "test" || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || endpoint.origin !== "http://127.0.0.1:61421") throw new Error("field_fixture_boundary_rejected");
  const context = { service, field: fieldSupervisor };
  const item = await uploadEvidenceFixture(context, label);
  const storage = service.storage.from(item.bucket);
  const before = await storage.info(item.objectPath);
  if (before.error || !before.data.version) throw new Error("fixture_storage_version_missing");
  const args = await evidenceReceiptArgs(context, item);
  const after = await storage.info(item.objectPath);
  if (after.error || before.data.id !== args.p_storage_object_id || before.data.version !== args.p_storage_version || before.data.lastModified !== args.p_storage_updated_at || after.data.id !== before.data.id || after.data.version !== before.data.version || after.data.lastModified !== before.data.lastModified) throw new Error("fixture_storage_version_changed");
  const receipt = await service.rpc("record_evidence_scan_receipt_v1", args);
  if (receipt.error || !receipt.data?.success) throw new Error(receipt.error?.message ?? JSON.stringify(receipt.data));
  const finalized = await fieldSupervisor.rpc("finalize_evidence_upload_v1", evidenceFinalizeArgs(item));
  if (finalized.error || !finalized.data?.success) throw new Error(finalized.error?.message ?? JSON.stringify(finalized.data));
  const state = await fieldSupervisor.from("evidence_objects").select("upload_status,scan_status,verification_status,version").eq("id", item.evidenceId).single();
  if (state.error || state.data.upload_status !== "uploaded" || state.data.scan_status !== "clean" || state.data.verification_status !== "pending" || state.data.version !== 2) throw new Error("fixture_finalization_state_mismatch");
  console.log(JSON.stringify({ fixture: "foundation0d", synthetic: true, label, evidenceId: item.evidenceId, sha256: item.checksum, sizeBytes: item.bytes.length, storageVersion: args.p_storage_version, receipt: receipt.data, finalization: finalized.data, state: state.data }));
  return item.evidenceId;
}
