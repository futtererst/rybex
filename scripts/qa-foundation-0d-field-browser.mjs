import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { commandId, createClients, ids, signIn, userIdFor } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = resolve(root, "visual-qa-output/foundation-0d-field");
const resultPath = join(artifactDir, "browser-result.json");
const fieldStorePath = process.env.RYBEXOS_FIELD_ISSUE_STORE_PATH ?? join(root, ".rybexos-local", "field-issue-escalation-store.json");

mkdirSync(artifactDir, { recursive: true });

const { service } = createClients();
const beforeLocalStat = safeStat(fieldStorePath);

const qaEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "demo",
  RYBEXOS_DATA_SOURCE: "database",
  RYBEXOS_BILLING_V2_PERSISTENCE: process.env.RYBEXOS_BILLING_V2_PERSISTENCE ?? "database",
  RYBEXOS_FIELD_ISSUE_PERSISTENCE: "database",
  RYBEXOS_FIELD_ISSUE_BROWSER_QA_SERVICE_CLIENT: "1"
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
  await waitForServer(`${baseUrl}/field-execution`, 90_000);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await seedBillingFixture();
  await seedFieldFixture();
  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await page.getByText("Escalate field issue", { exact: false }).first().waitFor({ timeout: 15_000 });
  screenshots.commandCenterUnresolved = join(artifactDir, "command-center-field-unresolved.png");
  await page.screenshot({ path: screenshots.commandCenterUnresolved, fullPage: true });

  await page.goto(`${baseUrl}/field-execution`, { waitUntil: "networkidle" });
  await page.getByText("Escalate field issue", { exact: false }).first().waitFor({ timeout: 15_000 });
  screenshots.fieldUnresolved = join(artifactDir, "field-execution-unresolved.png");
  await page.screenshot({ path: screenshots.fieldUnresolved, fullPage: true });

  await driveRfiPath();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Field issue escalated", { exact: false }).first().waitFor({ timeout: 15_000 });
  screenshots.fieldResolved = join(artifactDir, "field-execution-rfi-resolved.png");
  await page.screenshot({ path: screenshots.fieldResolved, fullPage: true });

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  const commandText = await page.locator("body").innerText();
  if (commandText.includes("Escalate field issue")) {
    throw new Error("Command Center still shows resolved Field Issue blocker in database mode.");
  }
  screenshots.commandCenterResolved = join(artifactDir, "command-center-field-resolved.png");
  await page.screenshot({ path: screenshots.commandCenterResolved, fullPage: true });

  await page.goto(`${baseUrl}/rfis-submittals`, { waitUntil: "networkidle" });
  await page.getByText("RFI-FI-001 created", { exact: false }).first().waitFor({ timeout: 15_000 });
  screenshots.rfiMobile = join(artifactDir, "rfi-created-mobile.png");
  await page.screenshot({ path: screenshots.rfiMobile, fullPage: true });

  await seedFieldFixture();
  await driveChangePath();
  await page.goto(`${baseUrl}/changes`, { waitUntil: "networkidle" });
  await page.getByText("CE-FI-001 created", { exact: false }).first().waitFor({ timeout: 15_000 });
  const changeText = await page.locator("body").innerText();
  if (changeText.includes("No linked RFI") && changeText.includes("RFI-FI-001")) {
    throw new Error("Changes page rendered contradictory linked-RFI source language.");
  }
  screenshots.changeMobile = join(artifactDir, "change-created-mobile.png");
  await page.screenshot({ path: screenshots.changeMobile, fullPage: true });

  const afterLocalStat = safeStat(fieldStorePath);
  if (beforeLocalStat && afterLocalStat && beforeLocalStat.mtimeMs !== afterLocalStat.mtimeMs) {
    throw new Error("Database Field browser QA modified the local Field Issue JSON store.");
  }

  writeFileSync(resultPath, `${JSON.stringify({
    runTimestamp: new Date().toISOString(),
    mode: "next build + next start",
    viewport: { width: 390, height: 844 },
    screenshots,
    localFieldJsonUnchanged: true,
    status: "pass"
  }, null, 2)}\n`);
  console.log("Foundation 0D Field browser QA passed.");
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

async function seedFieldFixture() {
  const seed = await service.rpc("field_issue_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success !== true) {
    throw new Error(`Field fixture seed failed: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
  }
}

async function seedBillingFixture() {
  const seed = await service.rpc("billing_v2_seed_fixture_v1", { p_reset: true });
  if (seed.error || seed.data?.success !== true) {
    throw new Error(`Billing fixture seed failed before Field browser QA: ${seed.error?.message ?? JSON.stringify(seed.data)}`);
  }
}

async function driveRfiPath() {
  const field = await signIn("field-a@foundation0a.local");
  let current = await getIssue(field);
  current = await rpcOk(field, "field_issue_start_escalation_v1", startArgs(current, "browser-rfi-start"));
  current = await saveAssessment(field, current, "browser-rfi-assessment");
  current = await attachEvidence(field, current, "browser-rfi-evidence");
  current = await rpcOk(field, "field_issue_select_path_v1", {
    ...baseArgs(current, "browser-rfi-path"),
    p_path: "rfi"
  });
  current = await rpcOk(field, "field_issue_create_rfi_v1", baseArgs(current, "browser-rfi-create"));
  await rpcOk(field, "field_issue_resolve_escalation_v1", {
    ...baseArgs(current, "browser-rfi-resolve"),
    p_resolution_note: "Browser QA created RFI path and cleared the original field blocker."
  });
}

async function driveChangePath() {
  const field = await signIn("field-a@foundation0a.local");
  let current = await getIssue(field);
  current = await rpcOk(field, "field_issue_start_escalation_v1", startArgs(current, "browser-change-start"));
  current = await saveAssessment(field, current, "browser-change-assessment");
  current = await attachEvidence(field, current, "browser-change-evidence");
  current = await rpcOk(field, "field_issue_select_path_v1", {
    ...baseArgs(current, "browser-change-path"),
    p_path: "change_event"
  });
  await rpcOk(field, "field_issue_create_change_event_v1", baseArgs(current, "browser-change-create"));
}

async function getIssue(client) {
  const { data, error } = await client.rpc("field_issue_get_state_v1", { p_stable_issue_key: "field-issue-lake-001" });
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

function startArgs(current, prefix) {
  return baseArgs(current, prefix);
}

function baseArgs(current, prefix) {
  return {
    p_stable_issue_key: "field-issue-lake-001",
    p_command_id: commandId(prefix),
    p_expected_version: current.issue.version,
    p_correlation_id: "foundation-0d-browser"
  };
}

async function saveAssessment(client, current, prefix) {
  return rpcOk(client, "field_issue_save_assessment_v1", {
    ...baseArgs(current, prefix),
    p_issue_type: "utility_conflict",
    p_impact_summary: "Utility locates and traffic-control release create held work, standby, and reroute exposure.",
    p_schedule_impact: true,
    p_schedule_days: 2,
    p_cost_exposure: 18500,
    p_safety_impact: false,
    p_quality_impact: false
  });
}

async function attachEvidence(client, current, prefix) {
  const evidenceId = await createUploadedEvidence(prefix);
  return rpcOk(client, "field_issue_attach_evidence_v1", {
    ...baseArgs(current, prefix),
    p_requirement_key: "field-daily-report-reference",
    p_evidence_id: evidenceId,
    p_reference_text: "Managed browser QA field evidence.",
    p_reference_type: "daily_report"
  });
}

async function createUploadedEvidence(label) {
  const actor = await userIdFor(service, "field-a@foundation0a.local");
  const id = crypto.randomUUID();
  const { error } = await service.from("evidence_objects").insert({
    id,
    workspace_id: ids.workspaceA,
    project_id: ids.projectA,
    object_path: `${ids.workspaceA}/${ids.projectA}/field-issue-browser/${id}.txt`,
    original_filename: `${label}.txt`,
    mime_type: "text/plain",
    size_bytes: 256,
    checksum_sha256: `foundation-0d-browser-${label}-${id}`,
    uploaded_by: actor,
    upload_status: "uploaded",
    scan_status: "not_configured",
    verification_status: "pending",
    uploaded_at: new Date().toISOString()
  });
  if (error) throw new Error(`browser evidence insert failed: ${error.message}`);
  return id;
}

async function rpcOk(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error || data?.success !== true) throw new Error(`${name} failed: ${error?.message ?? JSON.stringify(data)}`);
  return data;
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}
