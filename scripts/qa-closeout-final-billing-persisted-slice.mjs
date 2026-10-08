import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-closeout-final-billing-browser-"));
const closeoutStorePath = join(tempRoot, "closeout-final-billing-store.json");
const billingStorePath = join(tempRoot, "billing-v2-store.json");
const fieldIssueStorePath = join(tempRoot, "field-issue-store.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = resolve(root, "visual-qa-output/closeout-final-billing");
const evidenceRequirementIds = [
  "restoration-acceptance-photos",
  "final-unconditional-waiver",
  "retainage-release-request"
];

mkdirSync(artifactDir, { recursive: true });

execFileSync(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "build"
], {
  cwd: root,
  env: {
    ...process.env,
    RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH: closeoutStorePath,
    RYBEXOS_BILLING_V2_STORE_PATH: billingStorePath,
    RYBEXOS_FIELD_ISSUE_STORE_PATH: fieldIssueStorePath,
    NEXT_TELEMETRY_DISABLED: "1"
  },
  stdio: "inherit"
});

const server = spawn(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "start",
  "-p",
  String(port)
], {
  cwd: root,
  env: {
    ...process.env,
    RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH: closeoutStorePath,
    RYBEXOS_BILLING_V2_STORE_PATH: billingStorePath,
    RYBEXOS_FIELD_ISSUE_STORE_PATH: fieldIssueStorePath,
    NEXT_TELEMETRY_DISABLED: "1"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

const serverOutput = [];
server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

let browser;
let consoleIssues = [];

try {
  await waitForServer(`${baseUrl}/command-center`, 90_000);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  page.on("console", (message) => {
    if (message.type() === "error") consoleIssues.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await expectCommandTriageContains(page, "Release final billing");
  await page.locator('[data-qa="command-center-visual-triage"]').getByRole("link", { name: "Release final billing" }).first().click();
  await page.waitForURL((url) => url.pathname === "/closeout", { timeout: 15_000 });

  await page.waitForSelector('[data-qa="closeout-final-billing-workflow"]', { state: "visible", timeout: 15_000 });
  await page.locator('[data-qa="closeout-final-billing-workflow"]').getByText("Final billing and retainage release", { exact: false }).first().waitFor({ timeout: 5_000 });
  await expectState(page, "unresolved");

  await clickAndWaitForState(page, '[data-qa="closeout-final-billing-start"]', "in progress");
  await page.locator('[data-qa="closeout-final-billing-assessment-input"]').fill("Acceptance exceptions are closed, punch proof is aligned, and final billing release is ready once evidence is attached.");
  await clickAndWaitForState(page, '[data-qa="closeout-final-billing-save-assessment"]', "assessed");

  await page.locator('[data-qa="closeout-final-billing-evidence-input"]').fill("Bluegrass final waiver package, restoration photos, and retainage release backup");
  for (const requirementId of evidenceRequirementIds) {
    await clickAndWaitForDisabled(page, `[data-qa="closeout-final-billing-add-evidence-${requirementId}"]`);
  }
  await page.locator('[data-qa="closeout-final-billing-readiness"]').getByText("Validate release readiness", { exact: false }).waitFor({ timeout: 5_000 });

  await clickAndWaitForState(page, '[data-qa="closeout-final-billing-validate"]', "ready for review");
  await clickAndWaitForState(page, '[data-qa="closeout-final-billing-submit-review"]', "review pending");

  await page.locator('[data-qa="closeout-final-billing-decision-note"]').fill("Approved for final billing and retainage release.");
  await clickAndWaitForState(page, '[data-qa="closeout-final-billing-approve"]', "approved");

  await page.locator('[data-qa="closeout-final-billing-resolution-note"]').fill("Closeout release approved; final billing and retainage can be released.");
  await clickAndWaitForState(page, '[data-qa="closeout-final-billing-clear"]', "resolved");
  await page.locator('[data-qa="closeout-final-billing-outcome"]').getByText("Continue final billing processing", { exact: false }).waitFor({ timeout: 5_000 });

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await expectCommandTriageNotContains(page, "Release final billing");
  await page.reload({ waitUntil: "networkidle" });
  await expectCommandTriageNotContains(page, "Release final billing");

  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle" });
  await expectState(page, "resolved");
  await page.locator('[data-qa="closeout-final-billing-outcome"]').getByText("Open Billing", { exact: false }).first().waitFor({ timeout: 5_000 });

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle" });
  await page.locator('[data-qa="details-toggle"]').first().click();
  await page.getByText("Regional Broadband Restoration Package", { exact: false }).first().waitFor({ timeout: 5_000 });
  await page.getByText("final billing unblocked | retainage release approved", { exact: false }).first().waitFor({ timeout: 5_000 });
  await page.getByText("Closeout release approved; continue final billing and retainage processing.", { exact: false }).first().waitFor({ timeout: 5_000 });

  await page.screenshot({ fullPage: true, path: join(artifactDir, "closeout-final-billing-persisted-browser-flow.png") });

  if (consoleIssues.length > 0) {
    throw new Error(`Closeout final billing browser flow produced console/runtime issues:\n${consoleIssues.join("\n")}`);
  }

  console.log("Closeout final billing browser acceptance passed.");
  console.log(JSON.stringify({
    baseUrl,
    closeoutStorePath,
    screenshot: join(artifactDir, "closeout-final-billing-persisted-browser-flow.png")
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function clickAndWaitForState(page, selector, expectedText) {
  const control = page.locator(selector).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await control.click();
    try {
      await expectState(page, expectedText);
      return;
    } catch (error) {
      if (attempt === 2) {
        const bodyText = await page.locator("body").innerText().catch(() => "body unavailable");
        throw new Error(`Click ${selector} did not reach state ${expectedText}.\nConsole issues:\n${consoleIssues.join("\n") || "none"}\nPage text excerpt:\n${bodyText.slice(0, 3000)}\nCause: ${error instanceof Error ? error.message : String(error)}`);
      }
      await page.waitForTimeout(750);
    }
  }
}

async function clickAndWaitForDisabled(page, selector) {
  const control = page.locator(selector).first();
  await control.click();
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    if (await control.count().then((count) => count === 0).catch(() => true)) return;
    if (await control.isDisabled().catch(() => false)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`Click ${selector} did not persist evidence and disable the control.`);
}

async function expectState(page, expectedText) {
  await page.locator('[data-qa="closeout-final-billing-state"]').getByText(expectedText, { exact: false }).waitFor({ timeout: 10_000 });
}

async function expectCommandTriageContains(page, text) {
  const triage = page.locator('[data-qa="command-center-visual-triage"]').first();
  await triage.waitFor({ state: "visible", timeout: 10_000 });
  const content = await triage.innerText();
  if (!content.includes(text)) {
    throw new Error(`Expected Command Center triage to contain "${text}". Actual: ${content}`);
  }
}

async function expectCommandTriageNotContains(page, text) {
  const triage = page.locator('[data-qa="command-center-visual-triage"]').first();
  await triage.waitFor({ state: "visible", timeout: 10_000 });
  const content = await triage.innerText();
  if (content.includes(text)) {
    throw new Error(`Expected Command Center triage not to contain "${text}" after closeout clearance. Actual: ${content}`);
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited early.\n${serverOutput.join("")}`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
    }
  }

  throw new Error(`Timed out waiting for ${url}.\n${serverOutput.join("")}`);
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const serverForPort = createServer();
    serverForPort.on("error", rejectPort);
    serverForPort.listen(0, "127.0.0.1", () => {
      const address = serverForPort.address();
      const selectedPort = typeof address === "object" && address ? address.port : undefined;
      serverForPort.close(() => {
        if (selectedPort) resolvePort(selectedPort);
        else rejectPort(new Error("Could not allocate a free port."));
      });
    });
  });
}
