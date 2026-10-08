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

const resultPath = process.env.FOUNDATION_0E_RESULTS_PATH;
const recorder = createRecorder(undefined, "foundation-0e-closeout-persistence");
const { service } = createClients();

const closeoutLead = await signIn("closeout-a@foundation0a.local");
const auditor = await signIn("auditor-a@foundation0a.local");
const billingLead = await signIn("billing-a@foundation0a.local");
const fieldSupervisor = await signIn("field-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");
const caseKey = "closeout-final-billing-lake-001";
let cachedCloseoutUserId;

await seedCloseoutFixture();

await recorder.record("Canonical Closeout fixture exists", "schema", async () => {
  const state = await getCloseout(closeoutLead);
  return pass(state.blocker?.id === caseKey && state.blocker?.state === "unresolved", JSON.stringify(state));
});

await recorder.record("Authorized project member can read Closeout release case", "rls", async () => {
  const { data, error } = await closeoutLead.from("closeout_release_cases").select("stable_case_key").eq("stable_case_key", caseKey);
  return pass(!error && data?.length === 1, error?.message ?? `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Cross-workspace user cannot read Workspace A Closeout case", "rls_isolation", async () => {
  const { data, error } = await userB.from("closeout_release_cases").select("id").eq("workspace_id", ids.workspaceA);
  return noRows(data, error);
});

await recorder.record("Workspace A user cannot read Workspace B Closeout rows", "rls_isolation", async () => {
  const { data, error } = await closeoutLead.from("closeout_release_cases").select("id").eq("workspace_id", ids.workspaceB);
  return noRows(data, error);
});

await recorder.record("Authenticated direct Closeout table update is denied", "rls_policy_denial", async () => {
  const before = await getCloseout(closeoutLead);
  const { error, count } = await closeoutLead
    .from("closeout_release_cases")
    .update({ status: "resolved" }, { count: "exact" })
    .eq("stable_case_key", caseKey);
  const after = await getCloseout(closeoutLead);
  return pass((Boolean(error) || count === 0) && after.blocker.state === before.blocker.state, error?.message ?? "no_rows_updated");
});

await recorder.record("Read-only auditor cannot start Closeout release", "role_denial", async () => {
  const before = await getCloseout(closeoutLead);
  const denied = await auditor.rpc("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-auditor-denied"),
    p_expected_version: before.blocker.version,
    p_correlation_id: "foundation-0e-auditor-denied"
  });
  const after = await getCloseout(closeoutLead);
  return pass(denied.data?.success === false && denied.data?.error === "forbidden" && after.blocker.state === before.blocker.state, denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Billing role cannot perform Closeout mutation", "role_denial", async () => {
  const before = await getCloseout(closeoutLead);
  const denied = await billingLead.rpc("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-billing-denied"),
    p_expected_version: before.blocker.version,
    p_correlation_id: "foundation-0e-billing-denied"
  });
  return pass(denied.data?.success === false && denied.data?.error === "forbidden", denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Field role cannot perform Closeout mutation", "role_denial", async () => {
  const before = await getCloseout(closeoutLead);
  const denied = await fieldSupervisor.rpc("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-field-denied"),
    p_expected_version: before.blocker.version,
    p_correlation_id: "foundation-0e-field-denied"
  });
  return pass(denied.data?.success === false && denied.data?.error === "forbidden", denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Stale expected version fails before command claim", "optimistic_concurrency", async () => {
  const before = await getCloseout(closeoutLead);
  const beforeCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  const stale = await closeoutLead.rpc("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-stale"),
    p_expected_version: before.blocker.version - 1,
    p_correlation_id: "foundation-0e-stale"
  });
  const afterCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  return pass(stale.data?.success === false && stale.data?.error === "concurrency_conflict" && afterCommands === beforeCommands, JSON.stringify(stale.data));
});

await recorder.record("Start release persists and replays idempotently", "idempotency", async () => {
  const before = await getCloseout(closeoutLead);
  const id = commandId("closeout-start");
  const first = await closeoutLead.rpc("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: id,
    p_expected_version: before.blocker.version,
    p_correlation_id: "foundation-0e-start"
  });
  const second = await closeoutLead.rpc("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: id,
    p_expected_version: before.blocker.version,
    p_correlation_id: "foundation-0e-start"
  });
  const after = await getCloseout(closeoutLead);
  return pass(first.data?.success === true && second.data?.replayed === true && after.blocker.state === "in_progress", first.error?.message ?? second.error?.message ?? JSON.stringify(second.data));
});

await recorder.record("Assessment persists and refresh returns it", "closeout_lifecycle", async () => {
  const current = await getCloseout(closeoutLead);
  const saved = await saveAssessment(current.blocker.version);
  const refreshed = await getCloseout(closeoutLead);
  return pass(saved.data?.success === true && refreshed.blocker.assessment?.assessmentSummary?.includes("release"), saved.error?.message ?? JSON.stringify(refreshed.blocker.assessment));
});

await recorder.record("Missing evidence blocks readiness validation", "closeout_lifecycle", async () => {
  const current = await getCloseout(closeoutLead);
  const blocked = await closeoutLead.rpc("closeout_validate_readiness_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-readiness-no-evidence"),
    p_expected_version: current.blocker.version,
    p_correlation_id: "foundation-0e-readiness-no-evidence"
  });
  return pass(blocked.data?.success === false && blocked.data?.error === "not_ready", JSON.stringify(blocked.data));
});

await recorder.record("Managed evidence fixture attaches to all Closeout requirements", "evidence", async () => {
  let current = await getCloseout(closeoutLead);
  for (const requirement of ["restoration-acceptance-photos", "final-unconditional-waiver", "retainage-release-request"]) {
    const evidenceId = await createUploadedEvidence(requirement);
    const attached = await closeoutLead.rpc("closeout_attach_evidence_v1", {
      p_stable_case_key: caseKey,
      p_command_id: commandId(`closeout-evidence-${requirement}`),
      p_expected_version: current.blocker.version,
      p_requirement_key: requirement,
      p_evidence_id: evidenceId,
      p_reference_text: `Managed ${requirement} evidence`,
      p_reference_type: "billing_reference",
      p_correlation_id: "foundation-0e-evidence"
    });
    if (attached.error || attached.data?.success !== true) return pass(false, attached.error?.message ?? JSON.stringify(attached.data));
    current = attached.data;
  }
  const links = await tableCount(service, "evidence_links", [["workspace_id", ids.workspaceA], ["entity_type", "closeout_requirement"]]);
  const references = await tableCount(service, "closeout_evidence_references", [["workspace_id", ids.workspaceA]]);
  return pass(links >= 3 && references >= 3 && current.blocker.evidenceRequirements.every((requirement) => requirement.status === "attached"), `links:${links} refs:${references} ${JSON.stringify(current.blocker.evidenceRequirements)}`);
});

await recorder.record("Arbitrary evidence object cannot satisfy Closeout evidence", "evidence_security", async () => {
  const current = await getCloseout(closeoutLead);
  const denied = await closeoutLead.rpc("closeout_attach_evidence_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-missing-evidence"),
    p_expected_version: current.blocker.version,
    p_requirement_key: "retainage-release-request",
    p_evidence_id: "99999999-0000-4000-8000-000000000099",
    p_reference_text: "Arbitrary evidence",
    p_reference_type: "billing_reference",
    p_correlation_id: "foundation-0e-arbitrary-evidence"
  });
  return pass(denied.data?.success === false && denied.data?.error === "evidence_required", JSON.stringify(denied.data));
});

await recorder.record("Readiness validation persists ready state", "closeout_lifecycle", async () => {
  const current = await getCloseout(closeoutLead);
  const ready = await closeoutLead.rpc("closeout_validate_readiness_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-readiness-ready"),
    p_expected_version: current.blocker.version,
    p_correlation_id: "foundation-0e-readiness-ready"
  });
  return pass(ready.data?.success === true && ready.data?.blocker?.state === "ready_for_review", ready.error?.message ?? JSON.stringify(ready.data));
});

await recorder.record("Review submission and rejection preserve unresolved case", "review_rejection", async () => {
  let current = await getCloseout(closeoutLead);
  current = await rpcOk("closeout_submit_review_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-submit-reject"),
    p_expected_version: current.blocker.version,
    p_assigned_role: "Closeout Finance Review",
    p_correlation_id: "foundation-0e-submit-reject"
  });
  const rejected = await closeoutLead.rpc("closeout_record_decision_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-reject"),
    p_expected_version: current.blocker.version,
    p_decision: "rejected",
    p_decision_note: "Reject once to prove terminal release requires approval.",
    p_correlation_id: "foundation-0e-reject"
  });
  return pass(rejected.data?.success === true && rejected.data?.blocker?.state === "rejected", rejected.error?.message ?? JSON.stringify(rejected.data));
});

await seedCloseoutFixture();
await driveReadyForReview();

await recorder.record("Approval and clearance atomically update Billing projection", "clearance_projection", async () => {
  let current = await getCloseout(closeoutLead);
  current = await rpcOk("closeout_submit_review_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-submit-approve"),
    p_expected_version: current.blocker.version,
    p_assigned_role: "Closeout Finance Review",
    p_correlation_id: "foundation-0e-submit-approve"
  });
  current = await rpcOk("closeout_record_decision_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-approve"),
    p_expected_version: current.blocker.version,
    p_decision: "approved",
    p_decision_note: "Approved for final billing and retainage processing.",
    p_correlation_id: "foundation-0e-approve"
  });
  const cleared = await closeoutLead.rpc("closeout_clear_blocker_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-clear"),
    p_expected_version: current.blocker.version,
    p_resolution_note: "Closeout approval clears the final billing and retainage restriction.",
    p_correlation_id: "foundation-0e-clear"
  });
  const projection = await service
    .from("final_billing_retainage_projections")
    .select("final_billing_status,retainage_status,payment_status,commercial_state,message")
    .eq("workspace_id", ids.workspaceA)
    .single();
  return pass(
    cleared.data?.success === true &&
      cleared.data?.blocker?.state === "resolved" &&
      projection.data?.final_billing_status === "ready_for_processing" &&
      projection.data?.retainage_status === "release_approved" &&
      projection.data?.payment_status === "not_recorded" &&
      projection.data?.commercial_state === "closeout_restriction_cleared" &&
      !/paid|cash received|recovered/i.test(projection.data?.message ?? ""),
    cleared.error?.message ?? projection.error?.message ?? JSON.stringify({ cleared: cleared.data, projection: projection.data })
  );
});

await recorder.record("Resolved database Closeout blocker disappears from Command Center impact", "command_center_projection", async () => {
  const state = await getCloseout(closeoutLead);
  return pass(state.impact?.openBlockerCount === 0 && state.impact?.samePrimaryBlockerResolved === true, JSON.stringify(state.impact));
});

await recorder.record("Audit and domain events were appended", "audit_events", async () => {
  const auditCount = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA], ["entity_type", "closeout_release_case"]]);
  const eventCount = await tableCount(service, "domain_events", [["workspace_id", ids.workspaceA], ["aggregate_type", "closeout_release_case"]]);
  return pass(auditCount >= 1 && eventCount >= 1, `audit:${auditCount} domain:${eventCount}`);
});

await recorder.record("Projection never records payment without payment event", "semantic_safety", async () => {
  const { data, error } = await service.from("final_billing_retainage_projections").select("payment_status,final_billing_status,retainage_status,commercial_state").eq("workspace_id", ids.workspaceA).single();
  return pass(!error && data.payment_status === "not_recorded" && data.final_billing_status === "ready_for_processing" && data.retainage_status === "release_approved" && data.commercial_state === "closeout_restriction_cleared", error?.message ?? JSON.stringify(data));
});

const suite = recorder.finalize({
  gate: "0E",
  verdict: recorder.tests.some((test) => test.status === "fail") ? "GATE_0E_BLOCKED" : "GATE_0E_BEHAVIORAL_QA_PASSED"
});

if (resultPath) {
  mergeSuiteResult(resultPath, "foundation-0e-closeout-persistence", suite);
}

if (suite.failedTests > 0) {
  console.error("Foundation 0E Closeout persistence QA failed.");
  process.exit(1);
}

console.log("Foundation 0E Closeout persistence QA passed.");

async function seedCloseoutFixture() {
  const seed = await service.rpc("closeout_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success !== true) {
    throw new Error(`Closeout fixture seed failed: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
  }
}

async function getCloseout(client) {
  const { data, error } = await client.rpc("closeout_get_state_v1", { p_stable_case_key: caseKey });
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

async function rpcOk(functionName, args) {
  const { data, error } = await closeoutLead.rpc(functionName, args);
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

async function saveAssessment(version) {
  return closeoutLead.rpc("closeout_save_assessment_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-assessment"),
    p_expected_version: version,
    p_acceptance_status: "accepted",
    p_punch_status: "accepted",
    p_test_evidence_status: "accepted",
    p_as_built_redline_status: "accepted",
    p_closeout_document_status: "accepted",
    p_final_billing_release_status: "ready",
    p_assessment_summary: "Acceptance, evidence, and final billing release requirements are ready for release review.",
    p_correlation_id: "foundation-0e-assessment"
  });
}

async function driveReadyForReview() {
  let current = await getCloseout(closeoutLead);
  current = await rpcOk("closeout_start_release_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-drive-start"),
    p_expected_version: current.blocker.version,
    p_correlation_id: "foundation-0e-drive-start"
  });
  const assessment = await saveAssessment(current.blocker.version);
  if (assessment.error || assessment.data?.success !== true) throw new Error(assessment.error?.message ?? JSON.stringify(assessment.data));
  current = assessment.data;
  for (const requirement of ["restoration-acceptance-photos", "final-unconditional-waiver", "retainage-release-request"]) {
    const evidenceId = await createUploadedEvidence(`drive-${requirement}`);
    current = await rpcOk("closeout_attach_evidence_v1", {
      p_stable_case_key: caseKey,
      p_command_id: commandId(`closeout-drive-evidence-${requirement}`),
      p_expected_version: current.blocker.version,
      p_requirement_key: requirement,
      p_evidence_id: evidenceId,
      p_reference_text: `Managed ${requirement} evidence`,
      p_reference_type: "billing_reference",
      p_correlation_id: "foundation-0e-drive-evidence"
    });
  }
  await rpcOk("closeout_validate_readiness_v1", {
    p_stable_case_key: caseKey,
    p_command_id: commandId("closeout-drive-readiness"),
    p_expected_version: current.blocker.version,
    p_correlation_id: "foundation-0e-drive-readiness"
  });
}

async function createUploadedEvidence(label) {
  // Reuse the byte-custody/receipt fixtures; only the scan verdict is synthetic.
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.RYBEXOS_RUNTIME_MODE !== "test" || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || endpoint.origin !== "http://127.0.0.1:61421") throw new Error("closeout_fixture_boundary_rejected");
  const context = { service, field: closeoutLead };
  const item = await uploadEvidenceFixture(context, label);
  const storage = service.storage.from(item.bucket);
  const before = await storage.info(item.objectPath);
  if (before.error || !before.data.version) throw new Error("fixture_storage_version_missing");
  const args = await evidenceReceiptArgs(context, item);
  if (args.p_requested_by !== await closeoutUserId()) throw new Error("fixture_actor_mismatch");
  const after = await storage.info(item.objectPath);
  if (after.error || before.data.id !== args.p_storage_object_id || before.data.version !== args.p_storage_version || before.data.lastModified !== args.p_storage_updated_at || after.data.id !== before.data.id || after.data.version !== before.data.version || after.data.lastModified !== before.data.lastModified) throw new Error("fixture_storage_version_changed");
  const receipt = await service.rpc("record_evidence_scan_receipt_v1", args);
  if (receipt.error || !receipt.data?.success) throw new Error(receipt.error?.message ?? JSON.stringify(receipt.data));
  const finalized = await closeoutLead.rpc("finalize_evidence_upload_v1", evidenceFinalizeArgs(item));
  if (finalized.error || !finalized.data?.success) throw new Error(finalized.error?.message ?? JSON.stringify(finalized.data));
  const state = await closeoutLead.from("evidence_objects").select("upload_status,scan_status,verification_status,version").eq("id", item.evidenceId).single();
  if (state.error || state.data.upload_status !== "uploaded" || state.data.scan_status !== "clean" || state.data.verification_status !== "pending" || state.data.version !== 2) throw new Error("fixture_finalization_state_mismatch");
  console.log(JSON.stringify({ fixture: "foundation0e", synthetic: true, label, evidenceId: item.evidenceId, sha256: item.checksum, sizeBytes: item.bytes.length, storageVersion: args.p_storage_version, receipt: receipt.data, finalization: finalized.data, state: state.data }));
  return item.evidenceId;
}

async function closeoutUserId() {
  if (cachedCloseoutUserId) return cachedCloseoutUserId;
  const listed = await service.auth.admin.listUsers();
  if (listed.error) throw new Error(`User lookup failed: ${listed.error.message}`);
  const user = listed.data.users.find((entry) => entry.email === "closeout-a@foundation0a.local");
  if (!user?.id) throw new Error("Missing closeout bootstrap user.");
  cachedCloseoutUserId = user.id;
  return cachedCloseoutUserId;
}
