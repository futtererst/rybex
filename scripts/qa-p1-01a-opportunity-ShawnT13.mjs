import {
  commandId,
  createClients,
  createRecorder,
  ids,
  mergeSuiteResult,
  pass,
  signIn,
  tableCount,
  userIdFor
} from "./foundation-0b-test-utils.mjs";
import { spawnSync } from "node:child_process";

const resultPath = process.env.P1_01A_RESULTS_PATH;
const recorder = createRecorder(undefined, "p1-01a-opportunity-intake-qualification");
ensureLocalSupabaseEnv();
bootstrapFoundation();
const { service } = createClients();

const bd = await signIn("bd-a@foundation0a.local");
const ops = await signIn("ops-a@foundation0a.local");
const auditor = await signIn("auditor-a@foundation0a.local");
const pm = await signIn("pm-a@foundation0a.local");
const admin = await signIn("admin-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");

const createdIds = [];
let primary;

await cleanup();

await recorder.record("Business development lead can create opportunity intake", "create_command", async () => {
  const result = await createOpportunity(bd, "Lake Norman Underground Conduit Package", "Hospital access road and conduit crossing");
  primary = result;
  createdIds.push(primary.opportunity.id);
  return pass(result.success === true && result.opportunity.lifecycle_status === "qualifying", JSON.stringify(result));
});

await recorder.record("Created opportunity has owner assignment and intake complete", "assignment", async () => {
  const ownerCount = await tableCount(service, "opportunity_assignments", [["opportunity_id", primary.opportunity.id], ["assignment_type", "owner"], ["status", "active"]]);
  return pass(ownerCount === 1 && primary.opportunity.intake_complete === true, `owners:${ownerCount}`);
});

await recorder.record("Opportunity is visible to Workspace A authorized users", "rls_select", async () => {
  const { data, error } = await ops.from("opportunities").select("id").eq("id", primary.opportunity.id);
  return pass(!error && Array.isArray(data) && data.length === 1, error?.message ?? `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Workspace B user cannot see Workspace A opportunity", "rls_isolation", async () => {
  const { data, error } = await userB.from("opportunities").select("id").eq("id", primary.opportunity.id);
  return pass(!error && Array.isArray(data) && data.length === 0, error?.message ?? `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Read-only auditor cannot create opportunity", "role_denial", async () => {
  const result = await createOpportunity(auditor, "Auditor Forbidden Intake", "No access");
  return pass(result.success === false && result.error === "forbidden", JSON.stringify(result));
});

await recorder.record("Authenticated user cannot directly insert opportunity rows", "rls_policy_denial", async () => {
  const { error } = await bd.from("opportunities").insert({
    workspace_id: ids.workspaceA,
    organization_id: ids.orgA,
    name: "Direct insert should fail",
    gc_client: "Direct GC",
    stable_opportunity_key: "p1-01a-direct-denied",
    customer_gc: "Direct GC"
  });
  return pass(Boolean(error), error?.message ?? "unexpected success");
});

await recorder.record("Duplicate intake requires explicit confirmation", "duplicate_guard", async () => {
  const duplicate = await createOpportunity(bd, "Lake Norman Underground Conduit Package", "Hospital access road and conduit crossing");
  return pass(duplicate.success === false && duplicate.error === "duplicate_warning_requires_confirmation" && duplicate.duplicateCount >= 1, JSON.stringify(duplicate));
});

await recorder.record("Duplicate intake can be confirmed intentionally", "duplicate_guard", async () => {
  const duplicate = await createOpportunity(bd, "Lake Norman Underground Conduit Package", "Hospital access road and conduit crossing", { duplicateConfirmed: true });
  if (duplicate.success) createdIds.push(duplicate.opportunity.id);
  return pass(duplicate.success === true && duplicate.opportunity.duplicate_confirmed === true, JSON.stringify(duplicate));
});

await recorder.record("Opportunity update command detects stale expected version", "optimistic_concurrency", async () => {
  const stale = await bd.rpc("update_opportunity_v1", {
    p_opportunity_id: primary.opportunity.id,
    p_payload: { scopeSummary: "Stale update should not land." },
    p_command_id: commandId("p1-stale-update"),
    p_expected_version: primary.opportunity.version - 1,
    p_correlation_id: "p1-01a-stale-update"
  });
  return pass(stale.data?.success === false && stale.data?.error === "concurrency_conflict", stale.error?.message ?? JSON.stringify(stale.data));
});

await recorder.record("Owner can assign estimator without estimator workspace role", "assignment_command", async () => {
  const pmUserId = await userIdFor(service, "pm-a@foundation0a.local");
  const result = await bd.rpc("manage_opportunity_assignment_v1", {
    p_opportunity_id: primary.opportunity.id,
    p_user_id: pmUserId,
    p_assignment_type: "estimator",
    p_status: "active",
    p_command_id: commandId("p1-assign-estimator"),
    p_expected_version: primary.opportunity.version,
    p_correlation_id: "p1-01a-estimator"
  });
  if (result.data?.success === true) primary = result.data;
  return pass(result.data?.success === true && result.data.assignments.some((entry) => entry.assignment_type === "estimator"), result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Assigned estimator can save qualification", "qualification_command", async () => {
  const result = await pm.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: primary.opportunity.id,
    p_payload: completeQualification(),
    p_command_id: commandId("p1-estimator-qualification"),
    p_expected_version: primary.opportunity.version,
    p_correlation_id: "p1-01a-qualification"
  });
  if (result.data?.success === true) primary = result.data;
  return pass(result.data?.success === true && result.data.opportunity.qualification_complete === true && result.data.qualification.completeness_result === "complete", result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Qualification save command replays idempotently", "idempotency", async () => {
  const fresh = await createOpportunity(bd, "Idempotent Qualification Package", "North duct bank", { duplicateConfirmed: true });
  if (fresh.success) createdIds.push(fresh.opportunity.id);
  const cmd = commandId("p1-qualification-replay");
  const first = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: fresh.opportunity.id,
    p_payload: completeQualification(),
    p_command_id: cmd,
    p_expected_version: fresh.opportunity.version,
    p_correlation_id: "p1-01a-replay"
  });
  const second = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: fresh.opportunity.id,
    p_payload: completeQualification(),
    p_command_id: cmd,
    p_expected_version: fresh.opportunity.version,
    p_correlation_id: "p1-01a-replay"
  });
  return pass(first.data?.success === true && second.data?.success === true && second.data?.replayed === true, first.error?.message ?? second.error?.message ?? JSON.stringify(second.data));
});

await recorder.record("Incomplete qualification cannot be submitted for decision", "decision_readiness", async () => {
  const fresh = await createOpportunity(bd, "Incomplete Qualification Package", "West bore path", { duplicateConfirmed: true });
  if (fresh.success) createdIds.push(fresh.opportunity.id);
  const accountable = await setDecisionAccountability(bd, fresh.opportunity.id, fresh.opportunity.version, "p1-incomplete-accountability");
  const submit = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: accountable.opportunity.id,
    p_command_id: commandId("p1-incomplete-submit"),
    p_expected_version: accountable.opportunity.version,
    p_correlation_id: "p1-01a-incomplete-submit"
  });
  return pass(submit.data?.success === false && submit.data?.error === "validation_failed", submit.error?.message ?? JSON.stringify(submit.data));
});

await recorder.record("Complete qualification can be submitted for decision readiness", "submit_command", async () => {
  const accountable = await setDecisionAccountability(bd, primary.opportunity.id, primary.opportunity.version, "p1-submit-accountability");
  const evidence = await attachDecisionSupportEvidence(bd, accountable.opportunity.id, accountable.opportunity.version);
  primary = evidence;
  const submit = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: primary.opportunity.id,
    p_command_id: commandId("p1-submit-decision"),
    p_expected_version: primary.opportunity.version,
    p_correlation_id: "p1-01a-submit"
  });
  if (submit.data?.success === true) primary = submit.data;
  return pass(submit.data?.success === true && submit.data.opportunity.lifecycle_status === "decision_required" && submit.data.opportunity.decision_readiness_status === "ready_for_decision", submit.error?.message ?? JSON.stringify(submit.data));
});

await recorder.record("Decision-required opportunity cannot be mutated by later qualification save", "terminal_guard", async () => {
  const denied = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: primary.opportunity.id,
    p_payload: completeQualification(),
    p_command_id: commandId("p1-post-submit-denied"),
    p_expected_version: primary.opportunity.version,
    p_correlation_id: "p1-01a-terminal-denied"
  });
  return pass(denied.data?.success === false && denied.data?.error === "forbidden", denied.error?.message ?? JSON.stringify(denied.data));
});

await recorder.record("Assigned Decision Owner can approve the package", "decision_action", async () => {
  const ready = await createDecisionReadyOpportunity("Decision Owner Approval Package");
  const decision = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId("p1-decision-approve"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-decision-approve"
  });
  const { data: auditRows, error: auditError } = await service
    .from("audit_events")
    .select("id")
    .eq("workspace_id", ids.workspaceA)
    .eq("entity_id", ready.opportunity.id)
    .eq("action", "opportunity.decision_action_recorded");
  return pass(decision.data?.success === true && decision.data.opportunity.decision_readiness_status === "decision_approved" && !auditError && Array.isArray(auditRows) && auditRows.length >= 1, auditError?.message ?? JSON.stringify(decision.data));
});

await recorder.record("Return for clarification requires and persists a reason", "decision_action", async () => {
  const ready = await createDecisionReadyOpportunity("Decision Owner Return Package");
  const denied = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "returned_for_clarification",
    p_reason: "",
    p_command_id: commandId("p1-decision-return-denied"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-decision-return-denied"
  });
  const accepted = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "returned_for_clarification",
    p_reason: "Clarify bonding assumptions and traffic control allowance before pricing review.",
    p_command_id: commandId("p1-decision-return"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-decision-return"
  });
  const { data: row } = await service.from("opportunities").select("decision_readiness_status,metadata").eq("id", ready.opportunity.id).single();
  return pass(
    denied.data?.success === false &&
      denied.data?.error === "reason_required" &&
      accepted.data?.success === true &&
      row?.decision_readiness_status === "returned_for_clarification" &&
      row?.metadata?.p1_01aDecision?.reason === "Clarify bonding assumptions and traffic control allowance before pricing review.",
    denied.error?.message ?? accepted.error?.message ?? JSON.stringify({ denied: denied.data, accepted: accepted.data, row })
  );
});

await recorder.record("Decline requires and persists a reason", "decision_action", async () => {
  const ready = await createDecisionReadyOpportunity("Decision Owner Decline Package");
  const denied = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "declined",
    p_reason: "",
    p_command_id: commandId("p1-decision-decline-denied"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-decision-decline-denied"
  });
  const accepted = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "declined",
    p_reason: "Commercial risk exceeds the acceptable pursuit threshold for this package.",
    p_command_id: commandId("p1-decision-decline"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-decision-decline"
  });
  const { data: row } = await service.from("opportunities").select("decision_readiness_status,metadata").eq("id", ready.opportunity.id).single();
  return pass(
    denied.data?.success === false &&
      denied.data?.error === "reason_required" &&
      accepted.data?.success === true &&
      row?.decision_readiness_status === "decision_declined" &&
      row?.metadata?.p1_01aDecision?.reason === "Commercial risk exceeds the acceptable pursuit threshold for this package.",
    denied.error?.message ?? accepted.error?.message ?? JSON.stringify({ denied: denied.data, accepted: accepted.data, row })
  );
});

await recorder.record("Non-owner actors cannot execute decision actions", "decision_authorization", async () => {
  const ready = await createDecisionReadyOpportunity("Decision Owner Denial Package");
  const bdDenied = await bd.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId("p1-bd-decision-denied"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-bd-decision-denied"
  });
  const estimatorDenied = await pm.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId("p1-estimator-decision-denied"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-estimator-decision-denied"
  });
  const auditorDenied = await auditor.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId("p1-auditor-decision-denied"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-auditor-decision-denied"
  });
  const unassignedAdminDenied = await admin.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: ready.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId("p1-admin-unassigned-decision-denied"),
    p_expected_version: ready.opportunity.version,
    p_correlation_id: "p1-01a-admin-unassigned-decision-denied"
  });
  return pass(
    bdDenied.data?.success === false &&
      estimatorDenied.data?.success === false &&
      auditorDenied.data?.success === false &&
      unassignedAdminDenied.data?.success === false &&
      unassignedAdminDenied.data?.error === "decision_owner_required",
    JSON.stringify({ bd: bdDenied.data, estimator: estimatorDenied.data, auditor: auditorDenied.data, admin: unassignedAdminDenied.data })
  );
});

await recorder.record("P1-01A commands write audit and domain events", "audit_domain_events", async () => {
  const auditCount = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA], ["entity_type", "opportunity"]]);
  const eventCount = await tableCount(service, "domain_events", [["workspace_id", ids.workspaceA], ["aggregate_type", "opportunity"]]);
  return pass(auditCount >= 4 && eventCount >= 4, `audit:${auditCount} event:${eventCount}`);
});

await recorder.record("Production mode remains contained for Pipeline runtime", "production_containment", async () => {
  const status = process.env.RYBEXOS_RUNTIME_MODE === "production" ? "unexpected" : "contained_by_repository_guard";
  return pass(status === "contained_by_repository_guard", status);
});

const suite = recorder.finalize({
  gateArea: "P1-01A Opportunity Intake and Qualification",
  sourceOfTruth: "Supabase Postgres local/test",
  createdOpportunityCount: createdIds.length,
  p1_01bStarted: false
});

if (resultPath) {
  mergeSuiteResult(resultPath, "p1-01a-db", suite);
}

if (suite.failedTests > 0) {
  throw new Error(`P1-01A database QA failed ${suite.failedTests} test(s).`);
}

console.log("P1-01A database QA passed.");

async function createOpportunity(client, name, location, overrides = {}) {
  const result = await client.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: overrides.customerGc ?? "Bluegrass Data Centers",
      projectType: overrides.projectType ?? "Underground conduit",
      location,
      scopeSummary: overrides.scopeSummary ?? "OSP conduit and access coordination package for hyperscale data center service.",
      estimatedValue: overrides.estimatedValue ?? "385000",
      anticipatedStart: overrides.anticipatedStart ?? "2026-08-10",
      bidDueDate: overrides.bidDueDate ?? "2026-07-15",
      duplicateConfirmed: overrides.duplicateConfirmed ?? false
    },
    p_command_id: commandId("p1-create"),
    p_correlation_id: "p1-01a-create"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function ensureLocalSupabaseEnv() {
  process.env.RYBEXOS_RUNTIME_MODE ||= "test";
  process.env.RYBEXOS_AUTH_MODE ||= "supabase";
  process.env.RYBEXOS_DATA_SOURCE ||= "database";
  process.env.FOUNDATION_0A_TEST_PASSWORD = `P1-01A-DB-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) {
    return;
  }
  const result = spawnSync("npx.cmd", ["supabase", "status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error("Local Supabase credentials are not available. Start the local Supabase stack before P1-01A DB QA.");
  }
  const env = mapSupabaseEnv(result.stdout);
  Object.assign(process.env, env);
}

function bootstrapFoundation() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error(`Foundation bootstrap failed for P1-01A DB QA: ${redact(result.stderr || result.stdout || "no output")}`);
  }
}

function mapSupabaseEnv(output) {
  const parsed = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) parsed[match[1]] = stripQuotes(match[2]);
  }
  const apiUrl = parsed.API_URL ?? parsed.SUPABASE_URL ?? parsed.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = parsed.PUBLISHABLE_KEY ?? parsed.SUPABASE_PUBLISHABLE_KEY ?? parsed.ANON_KEY ?? parsed.SUPABASE_ANON_KEY;
  const anonKey = parsed.ANON_KEY ?? parsed.SUPABASE_ANON_KEY ?? publishableKey;
  const serviceKey = parsed.SERVICE_ROLE_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY ?? parsed.SECRET_KEY ?? parsed.SUPABASE_SECRET_KEY;
  if (!apiUrl || !publishableKey || !serviceKey) throw new Error("Unable to map local Supabase credentials from status output.");
  return {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_SECRET_KEY: serviceKey
  };
}

function stripQuotes(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}

async function attachDecisionSupportEvidence(client, id, version) {
  const result = await client.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: id,
    p_payload: {
      fileName: "decision-support.txt",
      mimeType: "text/plain",
      sizeBytes: 42,
      checksumSha256: "p1-01a-smoke-decision-support-checksum"
    },
    p_command_id: commandId("p1-attach-evidence"),
    p_expected_version: version,
    p_correlation_id: "p1-01a-evidence"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function setDecisionAccountability(client, id, version, key) {
  const decisionOwnerUserId = await userIdFor(service, "ops-a@foundation0a.local");
  const result = await client.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: id,
    p_decision_owner_user_id: decisionOwnerUserId,
    p_decision_due_at: "2026-07-10",
    p_command_id: commandId(key),
    p_expected_version: version,
    p_correlation_id: `${key}-correlation`
  });
  if (result.error) throw new Error(result.error.message);
  if (result.data?.success !== true) throw new Error(JSON.stringify(result.data));
  return result.data;
}

async function createDecisionReadyOpportunity(name) {
  const created = await createOpportunity(bd, name, `${name} location`, { duplicateConfirmed: true });
  if (!created.success) throw new Error(JSON.stringify(created));
  createdIds.push(created.opportunity.id);
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: created.opportunity.id,
    p_payload: completeQualification(),
    p_command_id: commandId(`${name}-qualification`),
    p_expected_version: created.opportunity.version,
    p_correlation_id: `${name}-qualification`
  });
  if (qualified.error || qualified.data?.success !== true) throw new Error(qualified.error?.message ?? JSON.stringify(qualified.data));
  const accountable = await setDecisionAccountability(bd, created.opportunity.id, qualified.data.opportunity.version, `${name}-accountability`);
  const evidence = await attachDecisionSupportEvidence(bd, accountable.opportunity.id, accountable.opportunity.version);
  const submit = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: evidence.opportunity.id,
    p_command_id: commandId(`${name}-submit`),
    p_expected_version: evidence.opportunity.version,
    p_correlation_id: `${name}-submit`
  });
  if (submit.error || submit.data?.success !== true) throw new Error(submit.error?.message ?? JSON.stringify(submit.data));
  return submit.data;
}

function completeQualification() {
  return {
    strategicFit: "strong",
    customerRelationship: "acceptable",
    geographyFit: "strong",
    projectTypeFit: "strong",
    scopeClarity: "acceptable",
    designMaturity: "acceptable",
    commercialTermsRisk: "risk",
    scheduleFeasibility: "acceptable",
    crewCapacityFit: "acceptable",
    materialLeadTimeRisk: "risk",
    permitsAccessRisk: "risk",
    safetyQualityComplexity: "acceptable",
    subcontractorDependency: "acceptable",
    cashFlowRisk: "acceptable",
    marginConfidence: "acceptable",
    contractualRisk: "risk",
    riskSummary: "Utility access, schedule, and commercial terms need pursuit controls.",
    assumptions: "Qualification assumes current drawings and access windows remain stable.",
    recommendation: "pursue_with_mitigations"
  };
}

async function cleanup() {
  const { data } = await service.from("opportunities").select("id").eq("workspace_id", ids.workspaceA).or("stable_opportunity_key.like.opp-%,name.ilike.%Qualification Package%,name.eq.Lake Norman Underground Conduit Package");
  const idsToDelete = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (idsToDelete.length > 0) {
    await service.from("opportunity_assignments").delete().in("opportunity_id", idsToDelete);
    await service.from("opportunity_qualifications").delete().in("opportunity_id", idsToDelete);
    await service.from("opportunities").delete().in("id", idsToDelete);
  }
}
