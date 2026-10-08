import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-field-issue-browser-"));
const fieldIssueStorePath = join(tempRoot, "field-issue-store.json");
const billingStorePath = join(tempRoot, "billing-v2-store.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = resolve(root, "visual-qa-output/field-issue-escalation");

mkdirSync(artifactDir, { recursive: true });

execFileSync(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "build"
], {
  cwd: root,
  env: {
    ...process.env,
    RYBEXOS_FIELD_ISSUE_STORE_PATH: fieldIssueStorePath,
    RYBEXOS_BILLING_V2_STORE_PATH: billingStorePath,
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
    RYBEXOS_FIELD_ISSUE_STORE_PATH: fieldIssueStorePath,
    RYBEXOS_BILLING_V2_STORE_PATH: billingStorePath,
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
  await expectCommandTriageContains(page, "Escalate field issue");
  await page.locator('[data-qa="command-center-visual-triage"]').getByRole("link", { name: "Escalate field issue" }).click();
  await page.waitForURL((url) => url.pathname === "/field-execution", { timeout: 15_000 });

  await page.waitForSelector('[data-qa="field-issue-escalation-workflow"]', { state: "visible", timeout: 15_000 });
  await page.getByText("Lake Norman field issue", { exact: false }).first().waitFor({ timeout: 5_000 });
  await expectState(page, "unresolved");

  await clickAndWaitForState(page, '[data-qa="field-issue-start"]', "in progress");
  await page.locator('[data-qa="field-issue-assessment-input"]').fill("Utility locate and traffic-control release gap holds the bore crew and creates standby exposure.");
  await page.locator('[data-qa="field-issue-schedule-input"]').fill("2");
  await page.locator('[data-qa="field-issue-cost-input"]').fill("18500");
  await clickAndWaitForState(page, '[data-qa="field-issue-save-assessment"]', "assessed");

  await page.locator('[data-qa="field-issue-evidence-input"]').fill("DR dr-lake-bore-0610, locate sketch, GC standby email");
  await clickAndWaitForState(page, '[data-qa="field-issue-add-evidence"]', "evidence added");

  await page.locator('[data-qa="field-issue-path-select"]').selectOption("rfi");
  await clickAndWaitForState(page, '[data-qa="field-issue-select-path"]', "path selected");
  await clickAndWaitForState(page, '[data-qa="field-issue-create-downstream"]', "downstream created");

  await page.locator('[data-qa="field-issue-resolution-note"]').fill("RFI-FI-001 created and field issue cleared for follow-up.");
  await clickAndWaitForState(page, '[data-qa="field-issue-resolve"]', "resolved");
  await page.locator('[data-qa="field-issue-outcome"]').getByText("Field issue escalated", { exact: false }).first().waitFor({ timeout: 5_000 });

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await expectCommandTriageNotContains(page, "Escalate field issue");
  await page.reload({ waitUntil: "networkidle" });
  await expectCommandTriageNotContains(page, "Escalate field issue");

  await page.goto(`${baseUrl}/field-execution`, { waitUntil: "networkidle" });
  await expectState(page, "resolved");
  await page.locator('[data-qa="field-issue-outcome"]').getByText("RFI-FI-001", { exact: false }).waitFor({ timeout: 5_000 });

  await page.goto(`${baseUrl}/rfis-submittals`, { waitUntil: "networkidle" });
  await page.locator('[data-qa="details-toggle"]').first().click();
  await page.getByText("RFI-FI-001", { exact: false }).first().waitFor({ timeout: 5_000 });
  await page.getByText("Field issue escalation: Lake Norman bore path locates", { exact: false }).first().waitFor({ timeout: 5_000 });

  await page.screenshot({ fullPage: true, path: join(artifactDir, "field-issue-persisted-browser-flow.png") });

  if (consoleIssues.length > 0) {
    throw new Error(`Field issue browser flow produced console/runtime issues:\n${consoleIssues.join("\n")}`);
  }

  console.log("Field issue browser acceptance passed.");
  console.log(JSON.stringify({
    baseUrl,
    fieldIssueStorePath,
    screenshot: join(artifactDir, "field-issue-persisted-browser-flow.png")
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

async function expectState(page, expectedText) {
  await page.locator('[data-qa="field-issue-state"]').getByText(expectedText, { exact: false }).waitFor({ timeout: 10_000 });
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
    throw new Error(`Expected Command Center triage not to contain "${text}" after resolution. Actual: ${content}`);
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
