import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-billing-v2-browser-"));
const storePath = join(tempRoot, "billing-v2-store.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = resolve(root, "visual-qa-output/billing-v2-workflow");
const requiredEvidenceIds = [
  "signed-tm-ticket",
  "daily-report-reference",
  "photo-log-reference",
  "supervisor-confirmation",
  "product-approval-backup"
];

mkdirSync(artifactDir, { recursive: true });

execFileSync(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "build"
], {
  cwd: root,
  env: {
    ...process.env,
    RYBEXOS_BILLING_V2_STORE_PATH: storePath,
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
    RYBEXOS_BILLING_V2_STORE_PATH: storePath,
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
  consoleIssues = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleIssues.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await expectCommandTriageContains(page, "Recover blocked billing");
  await page.locator('[data-qa="command-center-visual-triage"]').getByRole("link", { name: "Recover blocked billing" }).click();
  await page.waitForURL((url) => url.pathname === "/billing", { timeout: 15_000 });

  await page.waitForSelector('[data-qa="billing-v2-guided-workflow"]', { state: "attached", timeout: 15_000 });
  try {
    await page.waitForSelector('[data-qa="focused-task-panel"][data-billing-v2-hydrated="true"]', { timeout: 15_000 });
  } catch (error) {
    const marker = await page.locator('[data-qa="focused-task-panel"]').first().getAttribute("data-billing-v2-hydrated").catch(() => "missing");
    const bodyText = await page.locator("body").innerText().catch(() => "body unavailable");
    throw new Error(`Billing V2 client did not hydrate. Marker=${marker}. Console=${consoleIssues.join("\n") || "none"}. Body=${bodyText.slice(0, 2000)}. Cause=${error instanceof Error ? error.message : String(error)}`);
  }
  await page.getByText("PA-001", { exact: false }).first().waitFor({ timeout: 5_000 });
  await page.locator(".billing-situation-facts").getByText("$38,500", { exact: false }).first().waitFor({ timeout: 5_000 });
  await assertSingleActiveStep(page, "billing-v2-step-understand");

  await clickAndWaitForStep(page, '[data-qa="billing-v2-start-package"]', "billing-v2-step-build-package");

  await page.locator('[data-qa="billing-v2-backup-summary-input"]').fill("Stored material support and product approval backup for PA-001.");
  await page.locator('[data-qa="billing-v2-related-source-input"]').fill("bb-lake-001 / vault and handhole product approval");
  await page.locator('[data-qa="billing-v2-amount-input"]').fill("38500");
  await clickAndWaitForStep(page, '[data-qa="billing-v2-save-package"]', "billing-v2-step-add-proof");

  await page.getByText("0 of 5 complete", { exact: false }).first().waitFor({ timeout: 5_000 });
  for (const [index, evidenceId] of requiredEvidenceIds.entries()) {
    const card = page.locator(`[data-qa="billing-v2-evidence-card-${evidenceId}"]`);
    await card.waitFor({ state: "visible", timeout: 5_000 });
    await card.locator(`[data-qa="billing-v2-add-reference-${evidenceId}"]`).fill(`Reference saved for ${evidenceId} on PA-001.`);
    await card.getByRole("button", { name: "Save reference", exact: true }).click();
    await page.getByText(`${index + 1} of 5 complete`, { exact: false }).first().waitFor({ timeout: 5_000 });
  }
  await page.getByText("5 of 5 complete", { exact: false }).first().waitFor({ timeout: 5_000 });

  await clickAndWaitForStep(page, '[data-qa="billing-v2-validate-readiness"]', "billing-v2-step-review");
  await page.getByText("Ready", { exact: false }).first().waitFor({ timeout: 5_000 });

  await clickAndWaitForStep(page, '[data-qa="billing-v2-send-review"]', "billing-v2-step-review-decision");
  await page.locator('[data-qa="billing-v2-review-note-input"]').fill("Backup package approved for PA-001 commercial review.");
  await clickAndWaitForStep(page, '[data-qa="billing-v2-approve-review"]', "billing-v2-step-clear-blocker");

  await page.locator('[data-qa="billing-v2-resolution-note-input"]').fill("Commercial review approved the backup package. PA-001 can move to pay application review.");
  await clickAndWaitForStep(page, '[data-qa="billing-v2-clear-blocker"]', "billing-v2-step-outcome");
  await page.getByText("Ready for commercial review", { exact: false }).first().waitFor({ timeout: 5_000 });

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await expectCommandTriageNotContains(page, "Recover blocked billing");
  await page.reload({ waitUntil: "networkidle" });
  await expectCommandTriageNotContains(page, "Recover blocked billing");

  await page.goto(`${baseUrl}/billing?focus=billing-billing-backup-cash-recovery#focused-task`, { waitUntil: "networkidle" });
  await assertSingleActiveStep(page, "billing-v2-step-outcome");
  await page.getByText("Ready for commercial review", { exact: false }).first().waitFor({ timeout: 5_000 });
  await page.locator('[data-qa="billing-v2-step-outcome"]').getByText("Billing blocker cleared", { exact: false }).first().waitFor({ timeout: 5_000 });
  await openBillingSupportingRecords(page);
  await page.getByText("Resolved billing package:", { exact: false }).first().waitFor({ timeout: 5_000 });

  await page.screenshot({ fullPage: true, path: join(artifactDir, "billing-v2-persisted-browser-flow.png") });

  if (consoleIssues.length > 0) {
    throw new Error(`Billing V2 browser flow produced console/runtime issues:\n${consoleIssues.join("\n")}`);
  }

  console.log("Billing V2 browser acceptance passed.");
  console.log(JSON.stringify({
    baseUrl,
    storePath,
    screenshot: join(artifactDir, "billing-v2-persisted-browser-flow.png")
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function assertSingleActiveStep(page, expectedQa) {
  await page.waitForSelector(`[data-qa="${expectedQa}"]`, { timeout: 10_000 });
  const renderedSteps = await page.locator([
    '[data-qa="billing-v2-step-understand"]',
    '[data-qa="billing-v2-step-build-package"]',
    '[data-qa="billing-v2-step-add-proof"]',
    '[data-qa="billing-v2-step-review"]',
    '[data-qa="billing-v2-step-review-decision"]',
    '[data-qa="billing-v2-step-clear-blocker"]',
    '[data-qa="billing-v2-step-outcome"]'
  ].join(",")).count();
  if (renderedSteps !== 1) {
    throw new Error(`Expected exactly one active Billing V2 step, found ${renderedSteps}.`);
  }
}

async function openBillingSupportingRecords(page) {
  const records = page.locator('#details-records [data-qa="details-toggle"]').first();
  await records.waitFor({ state: "visible", timeout: 5_000 });
  await records.click();
}

async function clickAndWaitForStep(page, selector, expectedQa) {
  const control = page.locator(selector).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await control.click();
    try {
      await assertSingleActiveStep(page, expectedQa);
      return;
    } catch (error) {
      if (attempt === 2) {
        const activeText = await page.locator('[data-qa="billing-v2-active-step"]').innerText().catch(() => "active step unavailable");
        const bodyText = await page.locator("body").innerText().catch(() => "body unavailable");
        throw new Error(`Click ${selector} did not reach ${expectedQa}.\nConsole issues:\n${consoleIssues.join("\n") || "none"}\nActive step:\n${activeText}\nPage text excerpt:\n${bodyText.slice(0, 3000)}\nCause: ${error instanceof Error ? error.message : String(error)}`);
      }
      await page.waitForTimeout(750);
    }
  }
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
    throw new Error(`Expected Command Center triage not to contain "${text}" after clearance. Actual: ${content}`);
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`Next dev server exited early.\n${serverOutput.join("")}`);
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
