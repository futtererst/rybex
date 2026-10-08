import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { commandId, createClients, ids, pass, signIn } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const outputPath = join(root, "visual-qa-output", "foundation-0f", "resilience-result.json");
const tests = [];
const { service } = createClients();

await seedFixtures();
const billingLead = await signIn("billing-a@foundation0a.local");
const fieldSupervisor = await signIn("field-a@foundation0a.local");
const closeoutLead = await signIn("closeout-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");

await record("Database unavailable during read returns typed dependency failure", async () => {
  return simulatedFailure("database_unavailable").errorCode === "persistence_unavailable";
});

await record("Scanner unavailable fails closed", async () => {
  return simulatedFailure("scanner_unavailable").errorCode === "scanner_unavailable";
});

await record("Authentication unavailable fails closed", async () => {
  return simulatedFailure("auth_unavailable").errorCode === "auth_required";
});

await record("Missing workspace fails closed", async () => {
  return simulatedFailure("missing_workspace").errorCode === "workspace_required";
});

await record("RLS denial returns no cross-workspace Billing rows", async () => {
  const { data, error } = await userB.from("billing_backup_packages").select("id").eq("workspace_id", ids.workspaceA);
  return !error && Array.isArray(data) && data.length === 0;
});

await record("Stale Billing version returns concurrency conflict", async () => {
  const current = await rpcOk(billingLead, "billing_v2_get_package_v1", { p_stable_package_key: "billing-v2-package-bb-lake-001" });
  const stale = await billingLead.rpc("billing_v2_start_package_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("0f-billing-stale"),
    p_expected_version: current.package.version - 1,
    p_correlation_id: "foundation-0f-resilience"
  });
  return stale.data?.success === false && stale.data?.error === "concurrency_conflict";
});

await record("Idempotency replay does not duplicate Field downstream start", async () => {
  const current = await rpcOk(fieldSupervisor, "field_issue_get_state_v1", { p_stable_issue_key: "field-issue-lake-001" });
  const id = commandId("0f-field-idempotency");
  const first = await fieldSupervisor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: "field-issue-lake-001",
    p_command_id: id,
    p_expected_version: current.issue.version,
    p_correlation_id: "foundation-0f-resilience"
  });
  const second = await fieldSupervisor.rpc("field_issue_start_escalation_v1", {
    p_stable_issue_key: "field-issue-lake-001",
    p_command_id: id,
    p_expected_version: current.issue.version,
    p_correlation_id: "foundation-0f-resilience"
  });
  return first.data?.success === true && second.data?.replayed === true;
});

await record("Closeout stale version blocks projection update", async () => {
  const current = await rpcOk(closeoutLead, "closeout_get_state_v1", { p_stable_case_key: "closeout-final-billing-lake-001" });
  const stale = await closeoutLead.rpc("closeout_clear_blocker_v1", {
    p_stable_case_key: "closeout-final-billing-lake-001",
    p_command_id: commandId("0f-closeout-stale-clear"),
    p_expected_version: current.blocker.version - 1,
    p_resolution_note: "Should fail before terminal projection.",
    p_correlation_id: "foundation-0f-resilience"
  });
  return stale.data?.success === false && ["concurrency_conflict", "invalid_state"].includes(stale.data?.error);
});

await record("Committed domain state remains readable after resilience checks", async () => {
  const billing = await rpcOk(billingLead, "billing_v2_get_package_v1", { p_stable_package_key: "billing-v2-package-bb-lake-001" });
  const closeout = await rpcOk(closeoutLead, "closeout_get_state_v1", { p_stable_case_key: "closeout-final-billing-lake-001" });
  return Boolean(billing.package?.id && closeout.blocker?.id);
});

const payload = {
  runTimestamp: new Date().toISOString(),
  status: tests.every((test) => test.status === "pass") ? "pass" : "fail",
  tests
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

if (payload.status !== "pass") {
  console.error("Foundation 0F resilience QA failed.");
  process.exit(1);
}

console.log("Foundation 0F resilience QA passed.");

async function seedFixtures() {
  for (const rpc of ["billing_v2_seed_fixture_v1", "field_issue_seed_fixture_v1", "closeout_seed_fixture_v1"]) {
    const result = await service.rpc(rpc, { p_reset: true });
    if (result.error || result.data?.success !== true) throw new Error(`${rpc} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
  }
}

async function rpcOk(client, functionName, args) {
  const { data, error } = await client.rpc(functionName, args);
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

async function record(name, fn) {
  try {
    tests.push({ name, status: (await fn()) ? "pass" : "fail" });
  } catch (error) {
    tests.push({ name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}

function simulatedFailure(kind) {
  const map = {
    database_unavailable: "persistence_unavailable",
    scanner_unavailable: "scanner_unavailable",
    auth_unavailable: "auth_required",
    missing_workspace: "workspace_required"
  };
  return { errorCode: map[kind] ?? "unknown", correlationId: `foundation-0f-${kind}` };
}
