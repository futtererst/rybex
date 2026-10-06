import {
  commandId,
  createClients,
  createRecorder,
  ids,
  mergeSuiteResult,
  noRows,
  pass,
  sha256,
  signIn,
  tableCount,
  userIdFor
} from "./foundation-0b-test-utils.mjs";

const resultPath = process.env.FOUNDATION_0B_RESULTS_PATH;
const recorder = createRecorder(undefined, "foundation-0b-evidence-security");
const { service } = createClients();
const admin = await signIn("admin-a@foundation0a.local");
const field = await signIn("field-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");
const nomember = await signIn("nomember-a@foundation0a.local");

const ownedFixtureEvidence = new Set();
let uploadedEvidence = null;
let uploadedBytes = Buffer.from("foundation-0b evidence custody proof\n", "utf8");
let uploadedChecksum = sha256(uploadedBytes);

await recorder.record("Evidence bucket exists and is private", "storage_custody", async () => {
  const { data, error } = await service.storage.getBucket("rybexos-evidence");
  return pass(!error && data?.public === false, error?.message ?? `public:${data?.public}`);
});

await recorder.record("Field user creates pending evidence upload intent", "evidence_intent", async () => {
  const result = await field.rpc("create_evidence_upload_intent_v1", {
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_project_id: ids.projectA,
    p_original_filename: "foundation-0b-note.txt",
    p_mime_type: "text/plain"
  });
  uploadedEvidence = result.data;
  if (result.data?.success === true) ownedFixtureEvidence.add(result.data.evidenceId);
  const row = uploadedEvidence?.evidenceId
    ? await evidenceById(uploadedEvidence.evidenceId)
    : null;
  return pass(!result.error && result.data?.success === true && row?.upload_status === "pending_upload", result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Pending evidence upload requires matching authenticated storage path", "storage_upload", async () => {
  const result = await field.storage.from("rybexos-evidence").upload(uploadedEvidence.objectPath, new Blob([uploadedBytes], { type: "text/plain" }), {
    contentType: "text/plain",
    upsert: false
  });
  return pass(!result.error, result.error?.message ?? uploadedEvidence.objectPath);
});

await recorder.record("Synthetic clean scan fixture verifies exact uploaded bytes", "scan_fixture", async () => {
  const receipt = await setSyntheticScan(uploadedEvidence, uploadedBytes, "clean");
  return pass(Boolean(receipt.receiptId) && (await evidenceById(uploadedEvidence.evidenceId)).scan_status === "not_configured", "synthetic only; no production scanning claim");
});

for (const scanStatus of ["not_configured", "pending", "failed"]) {
  await recorder.record(`Finalize rejects ${scanStatus} scan and rolls back`, "scan_denial", async () => {
    const evidence = await createUploadedEvidence(`scan-${scanStatus}`, false);
    if (scanStatus !== "not_configured") await setSyntheticScan(evidence, evidence.bytes, scanStatus);
    const before = await evidenceById(evidence.evidenceId);
    const command = commandId(`scan-denial-${scanStatus}`);
    const beforeLinks = await tableCount(service, "evidence_links", [["evidence_object_id", evidence.evidenceId]]);
    const result = await field.rpc("finalize_evidence_upload_v1", finalizeArgs(evidence, command, 1));
    const after = await evidenceById(evidence.evidenceId);
    const afterLinks = await tableCount(service, "evidence_links", [["evidence_object_id", evidence.evidenceId]]);
    const claims = await tableCount(service, "command_idempotency", [["command_id", command]]);
    return pass(result.error?.message === "evidence_scan_not_clean" && before.version === after.version && before.scan_status === after.scan_status && after.upload_status === "pending_upload" && beforeLinks === afterLinks && claims === 0, result.error?.message ?? JSON.stringify(result.data));
  });
}

await recorder.record("Evidence finalize records metadata, link, audit, and domain event", "evidence_finalize", async () => {
  const beforeLinks = await tableCount(service, "evidence_links", [["workspace_id", ids.workspaceA]]);
  const result = await field.rpc("finalize_evidence_upload_v1", {
    p_evidence_id: uploadedEvidence.evidenceId,
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_relationship_type: "supporting_evidence",
    p_size_bytes: uploadedBytes.length,
    p_checksum_sha256: uploadedChecksum,
    p_expected_version: 1,
    p_command_id: commandId("evidence-finalize"),
    p_correlation_id: "foundation-0b-evidence-finalize"
  });
  const row = await evidenceById(uploadedEvidence.evidenceId);
  const afterLinks = await tableCount(service, "evidence_links", [["workspace_id", ids.workspaceA]]);
  const auditCount = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA], ["entity_id", uploadedEvidence.evidenceId]]);
  const eventCount = await tableCount(service, "domain_events", [["workspace_id", ids.workspaceA], ["aggregate_id", uploadedEvidence.evidenceId]]);
  return pass(
    !result.error &&
      result.data?.success === true &&
      row.upload_status === "uploaded" &&
      row.checksum_sha256 === uploadedChecksum &&
      row.version === 2 &&
      afterLinks === beforeLinks + 1 &&
      auditCount === 1 &&
      eventCount === 1,
    result.error?.message ?? JSON.stringify({ result: result.data, row })
  );
});

await recorder.record("Evidence finalize replay returns same result without duplicate link", "evidence_idempotency", async () => {
  const evidence = await createUploadedEvidence("replay");
  const command = commandId("evidence-replay");
  const beforeLinks = await tableCount(service, "evidence_links", [["evidence_object_id", evidence.evidenceId]]);
  const first = await field.rpc("finalize_evidence_upload_v1", finalizeArgs(evidence, command, 1));
  const afterFirstLinks = await tableCount(service, "evidence_links", [["evidence_object_id", evidence.evidenceId]]);
  const second = await field.rpc("finalize_evidence_upload_v1", finalizeArgs(evidence, command, 1));
  const afterSecondLinks = await tableCount(service, "evidence_links", [["evidence_object_id", evidence.evidenceId]]);
  return pass(!first.error && !second.error && second.data?.replayed === true && afterFirstLinks === beforeLinks + 1 && afterSecondLinks === afterFirstLinks, second.error?.message ?? JSON.stringify(second.data));
});

await recorder.record("Evidence idempotency mismatch is rejected", "evidence_idempotency", async () => {
  const evidence = await createUploadedEvidence("mismatch");
  const command = commandId("evidence-mismatch");
  await field.rpc("finalize_evidence_upload_v1", finalizeArgs(evidence, command, 1));
  const mismatch = await field.rpc("finalize_evidence_upload_v1", {
    ...finalizeArgs(evidence, command, 1),
    p_checksum_sha256: sha256(Buffer.from("different"))
  });
  return pass(mismatch.data?.success === false && mismatch.data?.error === "idempotency_mismatch", mismatch.error?.message ?? JSON.stringify(mismatch.data));
});

await recorder.record("Stale evidence version fails without command claim", "evidence_concurrency", async () => {
  const evidence = await createUploadedEvidence("stale");
  await field.rpc("finalize_evidence_upload_v1", finalizeArgs(evidence, commandId("evidence-stale-first"), 1));
  const beforeCommands = await tableCount(service, "command_idempotency", [["entity_id", evidence.evidenceId]]);
  const staleCommand = commandId("evidence-stale");
  const stale = await field.rpc("finalize_evidence_upload_v1", finalizeArgs(evidence, staleCommand, 1));
  const afterCommands = await tableCount(service, "command_idempotency", [["entity_id", evidence.evidenceId]]);
  return pass(stale.data?.success === false && stale.data?.error === "concurrency_conflict" && beforeCommands === afterCommands, stale.error?.message ?? JSON.stringify(stale.data));
});

await recorder.record("Finalize refuses missing storage object", "evidence_storage_required", async () => {
  const result = await field.rpc("create_evidence_upload_intent_v1", {
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_project_id: ids.projectA,
    p_original_filename: "missing-storage.txt",
    p_mime_type: "text/plain"
  });
  const finalize = await field.rpc("finalize_evidence_upload_v1", {
    p_evidence_id: result.data.evidenceId,
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_relationship_type: "supporting_evidence",
    p_size_bytes: 10,
    p_checksum_sha256: sha256(Buffer.from("missing")),
    p_expected_version: 1,
    p_command_id: commandId("evidence-missing-storage"),
    p_correlation_id: "foundation-0b-missing-storage"
  });
  return pass(finalize.data?.success === false && finalize.data?.error === "missing_storage_object", finalize.error?.message ?? JSON.stringify(finalize.data));
});

await recorder.record("Unsupported MIME type is rejected before metadata creation", "evidence_validation", async () => {
  const before = await tableCount(service, "evidence_objects", [["workspace_id", ids.workspaceA]]);
  const result = await field.rpc("create_evidence_upload_intent_v1", {
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_project_id: ids.projectA,
    p_original_filename: "script.exe",
    p_mime_type: "application/x-msdownload"
  });
  const after = await tableCount(service, "evidence_objects", [["workspace_id", ids.workspaceA]]);
  return pass(result.data?.success === false && result.data?.error === "validation_failed" && before === after, result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Non-project member cannot create Project A evidence intent", "project_access_denial", async () => {
  const result = await nomember.rpc("create_evidence_upload_intent_v1", {
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_project_id: ids.projectA,
    p_original_filename: "nomember.txt",
    p_mime_type: "text/plain"
  });
  return pass(result.data?.success === false && result.data?.error === "forbidden", result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Workspace B user cannot see Workspace A evidence metadata", "rls_no_rows", async () => {
  const { data, error } = await userB.from("evidence_objects").select("id").eq("workspace_id", ids.workspaceA);
  return noRows(data, error);
});

await recorder.record("Workspace B user cannot create download grant for Workspace A evidence", "evidence_access_denial", async () => {
  const result = await userB.rpc("create_evidence_download_grant_v1", { p_evidence_id: uploadedEvidence.evidenceId });
  return pass(result.data?.success === false && ["not_found", "forbidden"].includes(result.data?.error), result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Download grant is issued for authorized uploaded evidence", "signed_access", async () => {
  const result = await field.rpc("create_evidence_download_grant_v1", { p_evidence_id: uploadedEvidence.evidenceId });
  return pass(!result.error && result.data?.success === true && result.data?.bucket === "rybexos-evidence" && result.data?.objectPath === uploadedEvidence.objectPath && result.data?.expiresIn === 60, result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Authorized signed URL can retrieve the uploaded object", "signed_access", async () => {
  const grant = await field.rpc("create_evidence_download_grant_v1", { p_evidence_id: uploadedEvidence.evidenceId });
  const signed = await field.storage.from(grant.data.bucket).createSignedUrl(grant.data.objectPath, grant.data.expiresIn);
  if (signed.error || !signed.data?.signedUrl) {
    return pass(false, signed.error?.message ?? "missing signed url");
  }
  const response = await fetch(signed.data.signedUrl);
  const body = await response.text();
  return pass(response.ok && body === uploadedBytes.toString("utf8"), `status:${response.status}`);
});

await recorder.record("Authenticated users cannot directly update evidence metadata", "rls_policy_denial", async () => {
  const { error, count } = await field.from("evidence_objects").update({ upload_status: "uploaded" }, { count: "exact" }).eq("id", uploadedEvidence.evidenceId);
  const row = await evidenceById(uploadedEvidence.evidenceId);
  return pass((Boolean(error) || count === 0) && row.upload_status === "uploaded" && row.checksum_sha256 === uploadedChecksum, error?.message ?? "no_rows_updated");
});

await recorder.record("Authenticated users cannot directly delete evidence metadata", "rls_policy_denial", async () => {
  const { error, count } = await field.from("evidence_objects").delete({ count: "exact" }).eq("id", uploadedEvidence.evidenceId);
  const row = await evidenceById(uploadedEvidence.evidenceId);
  return pass((Boolean(error) || count === 0) && Boolean(row.id), error?.message ?? "no_rows_deleted");
});

await recorder.record("Authenticated users cannot directly insert evidence links", "rls_policy_denial", async () => {
  const actor = await userIdFor(service, "field-a@foundation0a.local");
  const { error } = await field.from("evidence_links").insert({
    workspace_id: ids.workspaceA,
    project_id: ids.projectA,
    evidence_object_id: uploadedEvidence.evidenceId,
    entity_type: "field_issue",
    entity_id: ids.projectA,
    relationship_type: "direct_insert",
    created_by: actor
  });
  return pass(Boolean(error), error ? "policy_denial" : "unexpected_success");
});

await recorder.record("Arbitrary storage path upload is denied", "storage_policy_denial", async () => {
  const result = await field.storage.from("rybexos-evidence").upload(`${ids.workspaceA}/${ids.projectA}/arbitrary.txt`, new Blob(["denied"], { type: "text/plain" }), {
    contentType: "text/plain",
    upsert: false
  });
  return pass(Boolean(result.error), result.error?.message ?? "unexpected_success");
});

await recorder.record("Storage object cannot be overwritten by authenticated user", "storage_policy_denial", async () => {
  const result = await field.storage.from("rybexos-evidence").upload(uploadedEvidence.objectPath, new Blob(["overwrite"], { type: "text/plain" }), {
    contentType: "text/plain",
    upsert: true
  });
  return pass(Boolean(result.error), result.error?.message ?? "unexpected_success");
});

const suite = recorder.finalize();
const coverage = categories => {
  const cases = suite.tests.filter(test => categories.includes(test.category));
  return cases.length > 0 && cases.every(test => test.status === "pass") ? "pass" : "fail";
};
suite.evidenceCoverage = {
  privateBucket: coverage(["storage_custody"]),
  metadataCustody: coverage(["evidence_intent", "evidence_finalize"]),
  uploadFinalize: coverage(["storage_upload", "evidence_finalize", "evidence_idempotency", "evidence_concurrency"]),
  signedDownloadGrant: coverage(["signed_access"]),
  crossWorkspaceDenial: coverage(["rls_no_rows", "evidence_access_denial"]),
  directWriteDenial: coverage(["rls_policy_denial", "storage_policy_denial"]),
  syntheticScan: coverage(["scan_fixture", "scan_denial"])
};

if (resultPath) {
  mergeSuiteResult(resultPath, "evidence-security", suite);
}

if (suite.failedTests > 0) {
  throw new Error(`foundation-0b-evidence-security failed ${suite.failedTests} test(s).`);
}

console.log("Foundation 0B evidence/security QA passed.");

async function createUploadedEvidence(label, clean = true) {
  const bytes = Buffer.from(`foundation-0b ${label}\n`, "utf8");
  const checksum = sha256(bytes);
  const intent = await field.rpc("create_evidence_upload_intent_v1", {
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_project_id: ids.projectA,
    p_original_filename: `${label}.txt`,
    p_mime_type: "text/plain"
  });
  if (intent.error || intent.data?.success !== true) {
    throw new Error(intent.error?.message ?? JSON.stringify(intent.data));
  }
  const upload = await field.storage.from("rybexos-evidence").upload(intent.data.objectPath, new Blob([bytes], { type: "text/plain" }), {
    contentType: "text/plain",
    upsert: false
  });
  if (upload.error) throw new Error(upload.error.message);
  ownedFixtureEvidence.add(intent.data.evidenceId);
  if (clean) await setSyntheticScan(intent.data, bytes, "clean");
  return { evidenceId: intent.data.evidenceId, objectPath: intent.data.objectPath, bytes, checksum };
}

function finalizeArgs(evidence, command, expectedVersion) {
  return {
    p_evidence_id: evidence.evidenceId,
    p_entity_type: "field_issue",
    p_entity_id: ids.projectA,
    p_relationship_type: "supporting_evidence",
    p_size_bytes: evidence.bytes.length,
    p_checksum_sha256: evidence.checksum,
    p_expected_version: expectedVersion,
    p_command_id: command,
    p_correlation_id: "foundation-0b-finalize"
  };
}

async function evidenceById(id) {
  const { data, error } = await service.from("evidence_objects").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Missing evidence row");
  return data;
}

// Test-only synthetic scanner state; this is not a scanner implementation.
async function setSyntheticScan(evidence, bytes, scanStatus) {
  const project = process.env.RYBEX_QUALIFICATION_PROJECT_ID;
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.RYBEXOS_RUNTIME_MODE !== "test" || !((project === "rybex-cfg03-q-m1-s1-20260928" && endpoint.port === "60421") || (project === "rybex-cfg03-q-m1-s1-recovery-20260928" && endpoint.port === "61421")) || endpoint.hostname !== "127.0.0.1" || !["60421", "61421"].includes(endpoint.port) || !ownedFixtureEvidence.has(evidence.evidenceId) || !["clean", "pending", "failed"].includes(scanStatus)) throw new Error("synthetic_scan_fixture_boundary_rejected");
  const row = await evidenceById(evidence.evidenceId);
  if (row.workspace_id !== ids.workspaceA || row.project_id !== ids.projectA || row.object_path !== evidence.objectPath || row.upload_status !== "pending_upload") throw new Error("synthetic_scan_fixture_scope_mismatch");
  const download = await service.storage.from(row.bucket_id).download(row.object_path);
  if (download.error) throw new Error(download.error.message);
  const actual = Buffer.from(await download.data.arrayBuffer());
  if (actual.length !== bytes.length || sha256(actual) !== sha256(bytes)) throw new Error("synthetic_scan_fixture_bytes_mismatch");
  // Preserve negative scan states as synthetic metadata, never manufacture clean.
  if (scanStatus !== "clean") {
    const update = await service.from("evidence_objects").update({ scan_status: scanStatus }).eq("id", row.id).eq("workspace_id", ids.workspaceA).eq("upload_status", "pending_upload").select("id,scan_status").single();
    if (update.error || update.data?.scan_status !== scanStatus) throw new Error(update.error?.message ?? "negative_fixture_failed");
    return { receiptId: null };
  }
  const info = await service.storage.from(row.bucket_id).info(row.object_path);
  if (info.error || !info.data.version) throw new Error(info.error?.message ?? "storage_version_unavailable");
  const recorded = await service.rpc("record_evidence_scan_receipt_v1", {
    p_evidence_id:row.id,p_workspace_id:row.workspace_id,p_project_id:row.project_id,
    p_requested_by:await userIdFor(service,"field-a@foundation0a.local"),
    p_storage_object_id:info.data.id,p_bucket_id:row.bucket_id,p_object_path:row.object_path,
    p_storage_version:info.data.version,p_storage_updated_at:info.data.lastModified,
    p_sha256:sha256(actual),p_size_bytes:actual.length,p_scanner:"synthetic-byte-verified-foundation0b",
    p_result:"clean",p_scanned_at:new Date().toISOString(),p_expected_version:row.version,
    p_correlation_id:"foundation-0b-scan",p_receipt_key:commandId("scan-receipt")
  });
  if (recorded.error || !recorded.data?.success) throw new Error(recorded.error?.message ?? "receipt_rejected");
  return recorded.data;
}
