import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { commandId, createClients, signIn } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = resolve(root, "visual-qa-output/foundation-0c-billing");
const screenshotPath = join(artifactDir, "billing-database-mode.png");
const browserResultPath = join(artifactDir, "browser-result.json");
const requiredEvidenceIds = [
  "daily-report-reference",
  "photo-log-reference",
  "product-approval-backup",
  "signed-tm-ticket",
  "supervisor-confirmation"
];

mkdirSync(artifactDir, { recursive: true });

const { service } = createClients();
const seed = await service.rpc("billing_v2_seed_fixture_v1", { p_reset: true });
if (seed.error || seed.data?.success !== true) {
  throw new Error(`Billing fixture seed failed before browser QA: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
}

const qaEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "demo",
  RYBEXOS_DATA_SOURCE: "database",
  RYBEXOS_BILLING_V2_PERSISTENCE: "database",
  RYBEXOS_BILLING_V2_BROWSER_QA_SERVICE_CLIENT: "1"
};

execFileSync(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "build"
], {
  cwd: root,
  env: qaEnv,
  stdio: "inherit"
});

const server = spawn(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "start",
  "-p",
  String(port)
], {
  cwd: root,
  env: qaEnv,
  stdio: ["ignore", "pipe", "pipe"]
});

const serverOutput = [];
server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

let browser;

try {
  await waitForServer(`${baseUrl}/billing`, 90_000);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle" });
  await page.getByText("Recover blocked billing", { exact: false }).first().waitFor({ timeout: 15_000 });
  await page.getByText("$38,500", { exact: false }).first().waitFor({ timeout: 15_000 });

  await driveBillingToResolvedWithAuthenticatedRpc();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Billing blocker cleared", { exact: false }).first().waitFor({ timeout: 15_000 });
  const resolvedBodyText = await page.locator("body").innerText();
  if (!resolvedBodyText.includes("Payment has not yet been recorded")) {
    throw new Error("Resolved Billing page did not communicate that payment has not yet been recorded.");
  }
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  const commandText = await page.locator("body").innerText();
  if (commandText.includes("Recover blocked billing")) {
    throw new Error("Command Center still shows the resolved Billing blocker in database mode.");
  }

  writeFileSync(browserResultPath, `${JSON.stringify({
    runTimestamp: new Date().toISOString(),
    mode: "next build + next start",
    viewport: { width: 390, height: 844 },
    screenshotPath,
    status: "pass"
  }, null, 2)}\n`);
  console.log("Foundation 0C Billing browser QA passed.");
} catch (error) {
  writeFileSync(browserResultPath, `${JSON.stringify({
    runTimestamp: new Date().toISOString(),
    mode: "next build + next start",
    viewport: { width: 390, height: 844 },
    status: "fail",
    error: error instanceof Error ? error.message : String(error),
    serverOutput: serverOutput.join("").slice(-4000)
  }, null, 2)}\n`);
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}. ${serverOutput.join("").slice(-2000)}`);
}

async function driveBillingToResolvedWithAuthenticatedRpc() {
  const billingLead = await signIn("billing-a@foundation0a.local");
  let current = await getPackage(billingLead);
  current = await rpcOk(billingLead, "billing_v2_start_package_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("browser-start"),
    p_expected_version: current.package.version,
    p_correlation_id: "foundation-0c-browser"
  });
  current = await rpcOk(billingLead, "billing_v2_save_package_details_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("browser-details"),
    p_expected_version: current.package.version,
    p_backup_summary: "Database browser QA backup package.",
    p_related_source_record: "CE-008 stored material support",
    p_amount_affected: 38500,
    p_correlation_id: "foundation-0c-browser"
  });

  for (const evidenceId of requiredEvidenceIds) {
    current = await rpcOk(billingLead, "billing_v2_attach_evidence_v1", {
      p_stable_package_key: "billing-v2-package-bb-lake-001",
      p_command_id: commandId(`browser-evidence-${evidenceId}`),
      p_expected_version: current.package.version,
      p_requirement_key: evidenceId,
      p_evidence_id: null,
      p_reference_text: `Rendered browser reference for ${evidenceId}.`,
      p_reference_type: "document_reference",
      p_waiver_reason: null,
      p_correlation_id: "foundation-0c-browser"
    });
  }

  current = await rpcOk(billingLead, "billing_v2_submit_review_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("browser-submit"),
    p_expected_version: current.package.version,
    p_assigned_role: "Commercial Review",
    p_due_date: null,
    p_correlation_id: "foundation-0c-browser"
  });
  current = await rpcOk(billingLead, "billing_v2_record_decision_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("browser-decision"),
    p_expected_version: current.package.version,
    p_decision: "approved",
    p_decision_note: "Browser QA approval.",
    p_correlation_id: "foundation-0c-browser"
  });
  await rpcOk(billingLead, "billing_v2_clear_blocker_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("browser-clear"),
    p_expected_version: current.package.version,
    p_resolution_note: "Browser QA cleared the Billing blocker.",
    p_correlation_id: "foundation-0c-browser"
  });
}

async function getPackage(client) {
  const { data, error } = await client.rpc("billing_v2_get_package_v1", { p_stable_package_key: "billing-v2-package-bb-lake-001" });
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

async function rpcOk(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error || data?.success !== true) throw new Error(`${name} failed: ${error?.message ?? JSON.stringify(data)}`);
  return data;
}
