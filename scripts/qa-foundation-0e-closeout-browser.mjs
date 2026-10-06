import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { commandId, createClients, ids, sha256, signIn } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = resolve(root, "visual-qa-output/foundation-0e-closeout");
const resultPath = join(artifactDir, "browser-result.json");
const closeoutStorePath = process.env.RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH ?? join(root, ".rybexos-local", "closeout-final-billing-store.json");

mkdirSync(artifactDir, { recursive: true });

const { service } = createClients();
const beforeLocalStat = safeStat(closeoutStorePath);
let cachedCloseoutUserId;

const qaEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "demo",
  RYBEXOS_DATA_SOURCE: "database",
  RYBEXOS_BILLING_V2_PERSISTENCE: process.env.RYBEXOS_BILLING_V2_PERSISTENCE ?? "database",
  RYBEXOS_FIELD_ISSUE_PERSISTENCE: process.env.RYBEXOS_FIELD_ISSUE_PERSISTENCE ?? "database",
  RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "database",
  RYBEXOS_CLOSEOUT_BROWSER_QA_SERVICE_CLIENT: "1"
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
const screenshots = {};

try {
  await waitForServer(`${baseUrl}/closeout`, 90_000);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await seedBillingFixture();
  await seedFieldFixture();
  await seedCloseoutFixture();

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await page.getByText("Release final billing", { exact: false }).first().waitFor({ timeout: 15_000 });
  screenshots.commandCenterUnresolved = join(artifactDir, "command-center-closeout-unresolved.png");
  await page.screenshot({ path: screenshots.commandCenterUnresolved, fullPage: true });

  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle" });
  await page.locator('[data-qa="closeout-final-billing-start"]').waitFor({ timeout: 15_000 });
  screenshots.closeoutUnresolved = join(artifactDir, "closeout-unresolved.png");
  await page.screenshot({ path: screenshots.closeoutUnresolved, fullPage: true });

  await driveCloseoutViaRpc();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Closeout blocker cleared", { exact: false }).first().waitFor({ timeout: 15_000 });
  screenshots.closeoutResolved = join(artifactDir, "closeout-resolved.png");
  await page.screenshot({ path: screenshots.closeoutResolved, fullPage: true });

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle" });
  const billingText = await page.locator("body").innerText();
  if (!billingText.includes("Closeout release approved") || !billingText.includes("Payment") || !billingText.includes("Not recorded")) {
    throw new Error("Billing page did not render the semantically safe Closeout release projection.");
  }
  if (/Final billing paid|final billing paid|Payment complete|Cash received|Commercial exposure recovered/i.test(billingText)) {
    throw new Error("Billing page rendered stale paid/recovered language for Closeout projection.");
  }
  screenshots.billingProjection = join(artifactDir, "billing-closeout-projection.png");
  await page.screenshot({ path: screenshots.billingProjection, fullPage: true });

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  const commandText = await page.locator("body").innerText();
  if (commandText.includes("Release final billing")) {
    throw new Error("Command Center still shows resolved Closeout blocker in database mode.");
  }
  screenshots.commandCenterResolved = join(artifactDir, "command-center-closeout-resolved.png");
  await page.screenshot({ path: screenshots.commandCenterResolved, fullPage: true });

  const afterLocalStat = safeStat(closeoutStorePath);
  if (beforeLocalStat && afterLocalStat && beforeLocalStat.mtimeMs !== afterLocalStat.mtimeMs) {
    throw new Error("Database Closeout browser QA modified the local Closeout JSON store.");
  }

  writeFileSync(resultPath, `${JSON.stringify({
    runTimestamp: new Date().toISOString(),
    mode: "next build + next start",
    viewport: { width: 390, height: 844 },
    screenshots,
    localCloseoutJsonUnchanged: true,
    status: "pass"
  }, null, 2)}\n`);
  console.log("Foundation 0E Closeout browser QA passed.");
} catch (error) {
  writeFileSync(resultPath, `${JSON.stringify({
    runTimestamp: new Date().toISOString(),
    mode: "next build + next start",
    viewport: { width: 390, height: 844 },
    screenshots,
    status: "fail",
    error: error instanceof Error ? error.message : String(error),
    serverOutput: serverOutput.join("").slice(-4000)
  }, null, 2)}\n`);
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function driveCloseoutViaRpc() {
  const closeoutLead = await signIn("closeout-a@foundation0a.local");
  let current = await getCloseout(closeoutLead);
  current = await rpcOk(closeoutLead, "closeout_start_release_v1", baseArgs(current, "browser-closeout-start"));
  current = await rpcOk(closeoutLead, "closeout_save_assessment_v1", {
    ...baseArgs(current, "browser-closeout-assessment"),
    p_acceptance_status: "accepted",
    p_punch_status: "accepted",
    p_test_evidence_status: "accepted",
    p_as_built_redline_status: "accepted",
    p_closeout_document_status: "accepted",
    p_final_billing_release_status: "ready",
    p_assessment_summary: "Browser QA confirms acceptance, evidence, and approval are ready for final billing release processing."
  });
  for (const requirement of ["restoration-acceptance-photos", "final-unconditional-waiver", "retainage-release-request"]) {
    const evidenceId = await createUploadedEvidence(requirement);
    current = await rpcOk(closeoutLead, "closeout_attach_evidence_v1", {
      ...baseArgs(current, `browser-closeout-evidence-${requirement}`),
      p_requirement_key: requirement,
      p_evidence_id: evidenceId,
      p_reference_text: `Browser QA managed ${requirement} evidence`,
      p_reference_type: "billing_reference"
    });
  }
  current = await rpcOk(closeoutLead, "closeout_validate_readiness_v1", baseArgs(current, "browser-closeout-readiness"));
  current = await rpcOk(closeoutLead, "closeout_submit_review_v1", {
    ...baseArgs(current, "browser-closeout-submit"),
    p_assigned_role: "Closeout Finance Review"
  });
  current = await rpcOk(closeoutLead, "closeout_record_decision_v1", {
    ...baseArgs(current, "browser-closeout-approve"),
    p_decision: "approved",
    p_decision_note: "Browser QA approves the closeout package for processing."
  });
  await rpcOk(closeoutLead, "closeout_clear_blocker_v1", {
    ...baseArgs(current, "browser-closeout-clear"),
    p_resolution_note: "Browser QA clears the closeout restriction for final billing and retainage processing."
  });
}

async function getCloseout(client) {
  const { data, error } = await client.rpc("closeout_get_state_v1", { p_stable_case_key: "closeout-final-billing-lake-001" });
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

function baseArgs(current, prefix) {
  return {
    p_stable_case_key: "closeout-final-billing-lake-001",
    p_command_id: commandId(prefix),
    p_expected_version: current.blocker.version,
    p_correlation_id: "foundation-0e-browser"
  };
}

async function rpcOk(client, functionName, args) {
  const { data, error } = await client.rpc(functionName, args);
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

async function createUploadedEvidence(label) {
  const id = randomUUID();
  const bytes = Buffer.from(`Foundation 0E browser Closeout evidence ${label}`);
  const { error } = await service.from("evidence_objects").insert({
    id,
    workspace_id: ids.workspaceA,
    project_id: ids.projectA,
    object_path: `${ids.workspaceA}/${ids.projectA}/closeout/${id}.txt`,
    original_filename: `${label}.txt`,
    mime_type: "text/plain",
    size_bytes: bytes.byteLength,
    checksum_sha256: sha256(bytes),
    uploaded_by: await closeoutUserId(),
    upload_status: "uploaded",
    scan_status: "not_configured",
    verification_status: "pending",
    uploaded_at: new Date().toISOString()
  });
  if (error) throw new Error(`Browser evidence create failed: ${error.message}`);
  return id;
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

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const freePort = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(freePort));
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

async function seedCloseoutFixture() {
  const seed = await service.rpc("closeout_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success !== true) {
    throw new Error(`Closeout fixture seed failed: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
  }
}

async function seedBillingFixture() {
  const seed = await service.rpc("billing_v2_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success !== true) {
    throw new Error(`Billing fixture seed failed before Closeout browser QA: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
  }
}

async function seedFieldFixture() {
  const seed = await service.rpc("field_issue_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success !== true) {
    throw new Error(`Field fixture seed failed before Closeout browser QA: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
  }
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}
