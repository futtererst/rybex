import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClients, signIn } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const outputPath = join(root, "visual-qa-output", "foundation-0f", "performance-result.json");
const { service } = createClients();
const measurements = [];
const budgetMs = 2500;

await seedFixtures();

const billingLead = await signIn("billing-a@foundation0a.local");
const fieldSupervisor = await signIn("field-a@foundation0a.local");
const closeoutLead = await signIn("closeout-a@foundation0a.local");

await measure("Command Center core reads", async () => Promise.all([
  billingLead.rpc("billing_v2_get_state_v1", { p_stable_package_key: "billing-v2-pa-001" }),
  fieldSupervisor.rpc("field_issue_get_state_v1", { p_stable_issue_key: "field-issue-lake-001" }),
  closeoutLead.rpc("closeout_get_state_v1", { p_stable_case_key: "closeout-final-billing-lake-001" })
]));
await measure("Billing page read", async () => billingLead.rpc("billing_v2_get_state_v1", { p_stable_package_key: "billing-v2-pa-001" }));
await measure("Field page read", async () => fieldSupervisor.rpc("field_issue_get_state_v1", { p_stable_issue_key: "field-issue-lake-001" }));
await measure("RFI page read", async () => service.from("rfis").select("id,stable_rfi_key,status").limit(10));
await measure("Changes page read", async () => service.from("change_events").select("id,stable_change_key,status").limit(10));
await measure("Closeout page read", async () => closeoutLead.rpc("closeout_get_state_v1", { p_stable_case_key: "closeout-final-billing-lake-001" }));

const payload = {
  runTimestamp: new Date().toISOString(),
  budgetMs,
  status: measurements.every((measurement) => measurement.status === "pass") ? "pass" : "fail",
  measurements
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

if (payload.status !== "pass") {
  console.error("Foundation 0F performance smoke failed.");
  process.exit(1);
}

console.log("Foundation 0F performance smoke passed.");

async function seedFixtures() {
  for (const rpc of ["billing_v2_seed_fixture_v1", "field_issue_seed_fixture_v1", "closeout_seed_fixture_v1"]) {
    const result = await service.rpc(rpc, { p_reset: true });
    if (result.error || result.data?.success !== true) throw new Error(`${rpc} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
  }
}

async function measure(name, fn) {
  const started = performance.now();
  try {
    await fn();
    const durationMs = Math.round(performance.now() - started);
    measurements.push({ name, durationMs, status: durationMs <= budgetMs ? "pass" : "fail" });
  } catch (error) {
    measurements.push({ name, durationMs: Math.round(performance.now() - started), status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}
