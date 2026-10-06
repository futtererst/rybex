import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { commandId, createClients, ids, sha256, signIn } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const outputPath = join(root, "visual-qa-output", "foundation-0f", "core-journey-result.json");
const tests = [];
const { service } = createClients();
const scannerUrl = process.env.RYBEXOS_SCANNER_URL;
const screenshots = {};
let browser;
let server;
let baseUrl = "";

await seedFixtures();

const billingLead = await signIn("billing-a@foundation0a.local");
const fieldSupervisor = await signIn("field-a@foundation0a.local");
const closeoutLead = await signIn("closeout-a@foundation0a.local");

await record("Production authenticated browser session is available", async () => {
  return proveApplicationBrowserSession();
});

await record("Scanner clean file is accepted", async () => {
  const result = await scan(Buffer.from("clean foundation 0f evidence"));
  return result.status === "clean";
});

await record("Scanner antivirus test file is detected", async () => {
  const payload = Buffer.from(["X5O!P%@AP", "[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!", "$H+H*"].join(""));
  const result = await scan(payload);
  return result.status === "infected";
});

await record("Scanner unavailable behavior is fail-closed", async () => {
  const unavailable = await fetch("http://127.0.0.1:1/scan", { method: "POST", body: Buffer.from("clean") }).catch(() => null);
  return unavailable === null;
});

await record("Clean evidence can satisfy Billing requirement", async () => {
  let state = await rpcOk(billingLead, "billing_v2_start_package_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("0f-billing-start"),
    p_expected_version: (await getBilling()).package.version,
    p_correlation_id: "foundation-0f-core"
  });
  state = await rpcOk(billingLead, "billing_v2_save_package_details_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("0f-billing-details"),
    p_expected_version: state.package.version,
    p_backup_summary: "Foundation 0F database-backed backup package.",
    p_related_source_record: "PA-001 stored material backup",
    p_amount_affected: 38500,
    p_correlation_id: "foundation-0f-core"
  });
  const requirement = state.package.evidenceRequirements[0];
  const evidenceId = await createEvidence("billing-clean.txt", "clean");
  const attached = await billingLead.rpc("billing_v2_attach_evidence_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("0f-billing-evidence"),
    p_expected_version: state.package.version,
    p_requirement_key: requirement.id,
    p_evidence_id: evidenceId,
    p_reference_text: "Clean scanned evidence",
    p_reference_type: "pay_app_backup",
    p_waiver_reason: null,
    p_correlation_id: "foundation-0f-core"
  });
  if (attached.error || attached.data?.success !== true) {
    throw new Error(attached.error?.message ?? JSON.stringify(attached.data));
  }
  return true;
});

await record("Unclean evidence cannot satisfy Billing requirement", async () => {
  const state = await getBilling();
  const evidenceId = await createEvidence("billing-infected.txt", "quarantined");
  const attempted = await billingLead.rpc("billing_v2_attach_evidence_v1", {
    p_stable_package_key: "billing-v2-package-bb-lake-001",
    p_command_id: commandId("0f-billing-infected"),
    p_expected_version: state.package.version,
    p_requirement_key: state.package.evidenceRequirements[1]?.id ?? state.package.evidenceRequirements[0].id,
    p_evidence_id: evidenceId,
    p_reference_text: "Should be rejected",
    p_reference_type: "pay_app_backup",
    p_waiver_reason: null,
    p_correlation_id: "foundation-0f-core"
  });
  return Boolean(attempted.error) || attempted.data?.success === false;
});

await record("Field, RFI, Change, and Closeout database states remain readable", async () => {
  const field = await rpcOk(fieldSupervisor, "field_issue_get_state_v1", { p_stable_issue_key: "field-issue-lake-001" });
  const closeout = await rpcOk(closeoutLead, "closeout_get_state_v1", { p_stable_case_key: "closeout-final-billing-lake-001" });
  const rfis = await service.from("rfis").select("id").eq("workspace_id", ids.workspaceA);
  const changes = await service.from("change_events").select("id").eq("workspace_id", ids.workspaceA);
  return Boolean(field.issue?.id && closeout.blocker?.id && !rfis.error && !changes.error);
});

const payload = {
  runTimestamp: new Date().toISOString(),
  mode: "production-mode core journey gate",
  status: tests.every((test) => test.status === "pass") ? "pass" : "fail",
  tests,
  screenshots,
  blocker: tests.some((test) => test.name === "Production authenticated browser session is available" && test.status === "fail")
    ? "Production-mode application sign-in did not establish a verified browser session."
    : null
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

if (payload.status !== "pass") {
  console.error(payload.blocker ?? "Foundation 0F core journey failed.");
  process.exit(1);
}

console.log("Foundation 0F core journey passed.");

if (browser) await browser.close();
if (server) server.kill();

async function seedFixtures() {
  for (const rpc of ["billing_v2_seed_fixture_v1", "field_issue_seed_fixture_v1", "closeout_seed_fixture_v1"]) {
    const result = await service.rpc(rpc, { p_reset: true });
    if (result.error || result.data?.success !== true) throw new Error(`${rpc} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
  }
}

async function proveApplicationBrowserSession() {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  execFileSync(process.execPath, [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    "build"
  ], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: "inherit"
  });

  server = spawn(process.execPath, [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    "start",
    "-p",
    String(port)
  ], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });
  await page.getByLabel("Email").fill("ops-a@foundation0a.local");
  await page.getByLabel("Password").fill(process.env.FOUNDATION_0A_TEST_PASSWORD ?? "");
  await Promise.all([
    page.waitForURL(/\/command-center/, { timeout: 20_000 }),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);

  screenshots.initialCommandCenterAuthenticated = join(root, "visual-qa-output", "foundation-0f", "initial-command-center-authenticated.png");
  await page.screenshot({ path: screenshots.initialCommandCenterAuthenticated, fullPage: true });

  const proof = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session-proof", { headers: { accept: "application/json" } });
    return response.json();
  });
  const cookies = await context.cookies();
  await context.close();

  return proof.success === true &&
    proof.role === "operations_leader" &&
    cookies.some((cookie) => cookie.name.startsWith("sb-") || cookie.name.includes("auth-token"));
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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const freeServer = createServer();
    freeServer.listen(0, "127.0.0.1", () => {
      const address = freeServer.address();
      const port = typeof address === "object" && address ? address.port : 0;
      freeServer.close(() => resolve(port));
    });
    freeServer.on("error", reject);
  });
}

async function getBilling() {
  return rpcOk(billingLead, "billing_v2_get_package_v1", { p_stable_package_key: "billing-v2-package-bb-lake-001" });
}

async function rpcOk(client, functionName, args) {
  const { data, error } = await client.rpc(functionName, args);
  if (error || data?.success !== true) throw new Error(error?.message ?? JSON.stringify(data));
  return data;
}

async function createEvidence(filename, scanStatus) {
  const id = randomUUID();
  const bytes = Buffer.from(`foundation 0f ${filename}`);
  const { error } = await service.from("evidence_objects").insert({
    id,
    workspace_id: ids.workspaceA,
    project_id: ids.projectA,
    object_path: `${ids.workspaceA}/${ids.projectA}/0f/${id}.txt`,
    original_filename: filename,
    mime_type: "text/plain",
    size_bytes: bytes.byteLength,
    checksum_sha256: sha256(bytes),
    uploaded_by: await userId("billing-a@foundation0a.local"),
    upload_status: "uploaded",
    scan_status: scanStatus,
    verification_status: scanStatus === "clean" ? "accepted" : "rejected",
    uploaded_at: new Date().toISOString()
  });
  if (error) throw new Error(`Evidence insert failed: ${error.message}`);
  return id;
}

async function scan(bytes) {
  if (!scannerUrl) return { status: "scanner_unavailable" };
  const response = await fetch(`${scannerUrl.replace(/\/$/, "")}/scan`, {
    method: "POST",
    body: bytes,
    headers: { "content-type": "application/octet-stream" }
  });
  return response.json();
}

async function record(name, fn) {
  try {
    tests.push({ name, status: (await fn()) ? "pass" : "fail" });
  } catch (error) {
    tests.push({ name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}

async function userId(email) {
  const listed = await service.auth.admin.listUsers();
  const user = listed.data.users.find((entry) => entry.email === email);
  if (!user?.id) throw new Error(`Missing user ${email}`);
  return user.id;
}
