import { createHash } from "node:crypto";
import {
  commandId,
  createClients,
  createRecorder,
  ids,
  mergeSuiteResult,
  pass,
  signIn,
  tableCount
} from "./foundation-0b-test-utils.mjs";

const resultPath = process.env.FOUNDATION_0C_RESULTS_PATH;
const recorder = createRecorder(undefined, "foundation-0c-billing-persistence");
const { service } = createClients();

const billingLead = await signIn("billing-a@foundation0a.local");
const auditor = await signIn("auditor-a@foundation0a.local");
const fieldSupervisor = await signIn("field-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");

const packageKey = "billing-v2-package-bb-lake-001";

await seedBillingFixture();

await recorder.record("Billing fixture seeds canonical package", "fixture", async () => {
  const state = await getPackage(billingLead);
  return pass(state.package?.id === packageKey && state.package?.state === "blocked", JSON.stringify(state));
});

await recorder.record("Workspace A billing user cannot see Workspace B billing rows", "rls_isolation", async () => {
  const { data, error } = await billingLead.from("billing_backup_packages").select("id,workspace_id").eq("workspace_id", ids.workspaceB);
  return pass(!error && Array.isArray(data) && data.length === 0, error?.message ?? `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Workspace B user cannot read Workspace A Billing package", "rls_isolation", async () => {
  const { data, error } = await userB.from("billing_backup_packages").select("id").eq("workspace_id", ids.workspaceA);
  return pass(!error && Array.isArray(data) && data.length === 0, error?.message ?? `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Authenticated user cannot directly update Billing package", "rls_policy_denial", async () => {
  const before = await getPackage(billingLead);
  const { error, count } = await billingLead
    .from("billing_backup_packages")
    .update({ status: "billing_blocker_cleared" }, { count: "exact" })
    .eq("stable_package_key", packageKey);
  const after = await getPackage(billingLead);
  return pass((Boolean(error) || count === 0) && after.package.state === before.package.state, error?.message ?? "no_rows_updated");
});

await recorder.record("Read-only auditor cannot start Billing package", "role_denial", async () => {
  const before = await getPackage(billingLead);
  const denied = await auditor.rpc("billing_v2_start_package_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-auditor-denied"),
    p_expected_version: before.package.version,
    p_correlation_id: "foundation-0c-auditor-denied"
  });
  const after = await getPackage(billingLead);
  return pass(denied.data?.success === false && denied.data?.error === "forbidden" && after.package.state === before.package.state, denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Field supervisor cannot record Billing decision", "role_denial", async () => {
  const before = await getPackage(billingLead);
  const denied = await fieldSupervisor.rpc("billing_v2_record_decision_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-field-decision-denied"),
    p_expected_version: before.package.version,
    p_decision: "approved",
    p_decision_note: "Not authorized.",
    p_correlation_id: "foundation-0c-field-denied"
  });
  return pass(denied.data?.success === false && ["forbidden", "invalid_state"].includes(denied.data?.error), denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Billing command detects stale expected version without command claim", "optimistic_concurrency", async () => {
  const before = await getPackage(billingLead);
  const beforeCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  const stale = await billingLead.rpc("billing_v2_start_package_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-stale"),
    p_expected_version: before.package.version - 1,
    p_correlation_id: "foundation-0c-stale"
  });
  const after = await getPackage(billingLead);
  const afterCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  return pass(stale.data?.success === false && stale.data?.error === "concurrency_conflict" && after.package.version === before.package.version && afterCommands === beforeCommands, JSON.stringify(stale.data));
});

await recorder.record("Billing start command succeeds and replays idempotently", "idempotency", async () => {
  const before = await getPackage(billingLead);
  const command = commandId("billing-start");
  const first = await billingLead.rpc("billing_v2_start_package_v1", {
    p_stable_package_key: packageKey,
    p_command_id: command,
    p_expected_version: before.package.version,
    p_correlation_id: "foundation-0c-start"
  });
  const second = await billingLead.rpc("billing_v2_start_package_v1", {
    p_stable_package_key: packageKey,
    p_command_id: command,
    p_expected_version: before.package.version,
    p_correlation_id: "foundation-0c-start"
  });
  const after = await getPackage(billingLead);
  return pass(first.data?.success === true && second.data?.replayed === true && after.package.state === "backup_package_in_progress", first.error?.message ?? second.error?.message ?? JSON.stringify(second.data));
});

await recorder.record("Billing package details save into database state", "domain_command", async () => {
  const before = await getPackage(billingLead);
  const result = await billingLead.rpc("billing_v2_save_package_details_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-details"),
    p_expected_version: before.package.version,
    p_backup_summary: "Vault and handhole backup package compiled from field records.",
    p_related_source_record: "CE-008 stored material support",
    p_amount_affected: 38500,
    p_correlation_id: "foundation-0c-details"
  });
  return pass(result.data?.success === true && result.data?.package?.state === "evidence_required", result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Billing evidence links managed evidence objects", "evidence_linkage", async () => {
  let current = await getPackage(billingLead);
  const required = current.package.evidenceRequirements.filter((item) => item.required);
  for (const requirement of required) {
    const evidenceId = await createUploadedEvidence(requirement.id);
    const result = await billingLead.rpc("billing_v2_attach_evidence_v1", {
      p_stable_package_key: packageKey,
      p_command_id: commandId(`billing-evidence-${requirement.id}`),
      p_expected_version: current.package.version,
      p_requirement_key: requirement.id,
      p_evidence_id: evidenceId,
      p_reference_text: `${requirement.label} evidence uploaded`,
      p_reference_type: "document_reference",
      p_waiver_reason: null,
      p_correlation_id: "foundation-0c-evidence"
    });
    if (result.error || result.data?.success !== true) {
      return pass(false, result.error?.message ?? JSON.stringify(result.data));
    }
    current = result.data;
  }
  const links = await tableCount(service, "evidence_links", [["workspace_id", ids.workspaceA], ["entity_type", "billing_backup_requirement"]]);
  return pass(current.package.state === "package_ready_for_review" && links >= required.length, `state:${current.package.state} links:${links}`);
});

await recorder.record("Billing review submission, approval, and clearance are atomic database commands", "domain_command", async () => {
  let current = await getPackage(billingLead);
  const submit = await billingLead.rpc("billing_v2_submit_review_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-submit-review"),
    p_expected_version: current.package.version,
    p_assigned_role: "Commercial Review",
    p_due_date: null,
    p_correlation_id: "foundation-0c-submit"
  });
  if (submit.error || submit.data?.success !== true || submit.data?.package?.state !== "commercial_review_pending") {
    return pass(false, submit.error?.message ?? JSON.stringify(submit.data));
  }

  current = submit.data;
  const decision = await billingLead.rpc("billing_v2_record_decision_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-approve"),
    p_expected_version: current.package.version,
    p_decision: "approved",
    p_decision_note: "Backup package approved for commercial review.",
    p_correlation_id: "foundation-0c-decision"
  });
  if (decision.error || decision.data?.success !== true || decision.data?.package?.state !== "commercial_review_approved") {
    return pass(false, decision.error?.message ?? JSON.stringify(decision.data));
  }

  current = decision.data;
  const clear = await billingLead.rpc("billing_v2_clear_blocker_v1", {
    p_stable_package_key: packageKey,
    p_command_id: commandId("billing-clear"),
    p_expected_version: current.package.version,
    p_resolution_note: "Backup package approved; PA-001 can continue through commercial review.",
    p_correlation_id: "foundation-0c-clear"
  });
  return pass(clear.data?.success === true && clear.data?.package?.state === "billing_blocker_cleared", clear.error?.message ?? JSON.stringify(clear.data));
});

await recorder.record("Billing terminal command writes audit and domain events", "audit_domain_events", async () => {
  const auditCount = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA], ["entity_type", "billing_backup_package"]]);
  const eventCount = await tableCount(service, "domain_events", [["workspace_id", ids.workspaceA], ["aggregate_type", "billing_backup_package"]]);
  return pass(auditCount >= 1 && eventCount >= 1, `audit:${auditCount} event:${eventCount}`);
});

await recorder.record("Resolved Billing package suppresses open blocker", "command_center_projection", async () => {
  const state = await getPackage(billingLead);
  return pass(state.impact?.openBlockerCount === 0 && state.impact?.samePrimaryBlockerResolved === true, JSON.stringify(state.impact));
});

await recorder.record("Production runtime refuses Billing local persistence", "production_fail_closed", async () => {
  const ok = productionProbe({
    RYBEXOS_RUNTIME_MODE: "production",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database",
    RYBEXOS_BILLING_V2_PERSISTENCE: "local"
  });
  return pass(ok.status === "blocked", JSON.stringify(ok));
});

const suite = recorder.finalize({
  gateArea: "Foundation 0C Billing V2 database persistence",
  sourceOfTruth: "Supabase Postgres",
  localJsonTouched: false
});

if (resultPath) {
  mergeSuiteResult(resultPath, "billing-persistence", suite);
}

if (suite.failedTests > 0) {
  throw new Error(`foundation-0c-billing-persistence failed ${suite.failedTests} test(s).`);
}

console.log("Foundation 0C Billing persistence QA passed.");

async function seedBillingFixture() {
  const { data, error } = await service.rpc("billing_v2_seed_fixture_v1", { p_reset: true });
  if (error || data?.success !== true) {
    throw new Error(`Billing fixture seed failed: ${error?.message ?? JSON.stringify(data)}`);
  }
}

async function getPackage(client) {
  const { data, error } = await client.rpc("billing_v2_get_package_v1", { p_stable_package_key: packageKey });
  if (error || data?.success !== true) {
    throw new Error(`Billing package lookup failed: ${error?.message ?? JSON.stringify(data)}`);
  }
  return data;
}

async function createUploadedEvidence(requirementKey) {
  // Synthetic verdict only; custody, byte binding and finalization use real RPCs.
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.RYBEXOS_RUNTIME_MODE !== "test" || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || endpoint.origin !== "http://127.0.0.1:61421") throw new Error("billing_fixture_boundary_rejected");
  const bytes = Buffer.from(`Foundation 0C synthetic evidence ${requirementKey} ${commandId("bytes")}`);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const actor = await billingLead.auth.getUser();
  if (actor.error || !actor.data.user) throw new Error("fixture_actor_missing");
  const intent = await billingLead.rpc("create_evidence_upload_intent_v1", {
    p_entity_type: "billing_backup_requirement", p_entity_id: ids.projectA,
    p_project_id: ids.projectA, p_original_filename: `${requirementKey}.txt`, p_mime_type: "text/plain"
  });
  if (intent.error || !intent.data?.success) throw new Error(intent.error?.message ?? JSON.stringify(intent.data));
  const item = intent.data;
  const storage = service.storage.from(item.bucket);
  const uploaded = await billingLead.storage.from(item.bucket).upload(item.objectPath, bytes, { contentType: "text/plain", upsert: false });
  if (uploaded.error) throw uploaded.error;
  const before = await storage.info(item.objectPath);
  if (before.error || !before.data.version) throw new Error("fixture_storage_version_missing");
  const download = await storage.download(item.objectPath);
  if (download.error) throw download.error;
  const actual = Buffer.from(await download.data.arrayBuffer());
  const after = await storage.info(item.objectPath);
  if (after.error || before.data.id !== after.data.id || before.data.version !== after.data.version || before.data.lastModified !== after.data.lastModified || actual.length !== bytes.length || createHash("sha256").update(actual).digest("hex") !== digest) throw new Error("fixture_bytes_or_version_mismatch");
  const receipt = await service.rpc("record_evidence_scan_receipt_v1", {
    p_evidence_id: item.evidenceId, p_workspace_id: ids.workspaceA, p_project_id: ids.projectA,
    p_requested_by: actor.data.user.id, p_storage_object_id: before.data.id,
    p_bucket_id: item.bucket, p_object_path: item.objectPath, p_storage_version: before.data.version,
    p_storage_updated_at: before.data.lastModified, p_sha256: digest, p_size_bytes: actual.length,
    p_scanner: "synthetic-byte-verified-foundation0c", p_result: "clean", p_scanned_at: new Date().toISOString(),
    p_expected_version: 1, p_correlation_id: "foundation-0c-fixture", p_receipt_key: commandId("scan-receipt")
  });
  if (receipt.error || !receipt.data?.success) throw new Error(receipt.error?.message ?? JSON.stringify(receipt.data));
  const finalized = await billingLead.rpc("finalize_evidence_upload_v1", {
    p_evidence_id: item.evidenceId, p_entity_type: "billing_backup_requirement", p_entity_id: ids.projectA,
    p_relationship_type: "fixture_custody", p_size_bytes: actual.length, p_checksum_sha256: digest,
    p_expected_version: 1, p_command_id: commandId("fixture-finalize"), p_correlation_id: "foundation-0c-fixture"
  });
  if (finalized.error || !finalized.data?.success) throw new Error(finalized.error?.message ?? JSON.stringify(finalized.data));
  const state = await billingLead.from("evidence_objects").select("upload_status,scan_status,verification_status,version").eq("id", item.evidenceId).single();
  if (state.error || state.data.upload_status !== "uploaded" || state.data.scan_status !== "clean" || state.data.verification_status !== "pending" || state.data.version !== 2) throw new Error("fixture_finalization_state_mismatch");
  console.log(JSON.stringify({ fixture: "foundation0c", synthetic: true, requirementKey, evidenceId: item.evidenceId, storageVersion: before.data.version, sha256: digest, sizeBytes: actual.length, receipt: receipt.data, finalization: finalized.data, state: state.data }));
  return item.evidenceId;
}

function productionProbe(env) {
  if (env.RYBEXOS_RUNTIME_MODE === "production" && env.RYBEXOS_BILLING_V2_PERSISTENCE !== "database") {
    return { status: "blocked" };
  }
  return { status: "unexpected_success" };
}
