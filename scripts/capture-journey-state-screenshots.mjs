import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const outputRoot = resolve(root, "visual-qa-output/journey-states");
const requiredBillingEvidenceIds = [
  "signed-tm-ticket",
  "daily-report-reference",
  "photo-log-reference",
  "supervisor-confirmation",
  "product-approval-backup"
];
const closeoutEvidenceRequirementIds = [
  "restoration-acceptance-photos",
  "final-unconditional-waiver",
  "retainage-release-request"
];

mkdirSync(outputRoot, { recursive: true });

console.log("Building app for journey-state screenshots...");
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

const screenshots = [];

await captureScenario("default", async ({ baseUrl, page }) => {
  await capturePage(page, baseUrl, "/command-center", "default/desktop-command-center.png", desktop());
  await capturePage(page, baseUrl, "/command-center", "default/mobile-command-center.png", mobile());
  await capturePage(page, baseUrl, "/billing", "default/desktop-billing.png", desktop());
  await capturePage(page, baseUrl, "/billing", "default/mobile-billing.png", mobile());
  await capturePage(page, baseUrl, "/field-execution", "default/desktop-field-execution.png", desktop());
  await capturePage(page, baseUrl, "/field-execution", "default/mobile-field-execution.png", mobile());
  await capturePage(page, baseUrl, "/closeout", "default/desktop-closeout.png", desktop());
  await capturePage(page, baseUrl, "/closeout", "default/mobile-closeout.png", mobile());
  await capturePage(page, baseUrl, "/rfis-submittals", "default/desktop-rfis-submittals.png", desktop());
  await capturePage(page, baseUrl, "/changes", "default/desktop-changes.png", desktop());
});

await captureScenario("field-rfi-created", async ({ baseUrl, page }) => {
  await completeFieldIssue(page, baseUrl, "rfi");
  await capturePage(page, baseUrl, "/rfis-submittals", "field-rfi-created/desktop-rfis-submittals-rfi-created.png", desktop(), async () => {
    await page.getByText("RFI-FI-001", { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/rfis-submittals", "field-rfi-created/mobile-rfis-submittals-rfi-created.png", mobile(), async () => {
    await page.getByText("RFI-FI-001", { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/field-execution", "field-rfi-created/desktop-field-execution-resolved.png", desktop(), async () => {
    await expectFieldIssueState(page, "resolved");
  });
  await capturePage(page, baseUrl, "/command-center", "field-rfi-created/desktop-command-center-field-resolved.png", desktop(), async () => {
    await expectTriageNotContains(page, "Escalate field issue");
  });
});

await captureScenario("field-change-created", async ({ baseUrl, page }) => {
  await completeFieldIssue(page, baseUrl, "change_event");
  await capturePage(page, baseUrl, "/changes", "field-change-created/desktop-changes-change-created.png", desktop(), async () => {
    await page.locator('[data-qa="downstream-change-record"]').waitFor({ state: "visible", timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/changes", "field-change-created/mobile-changes-change-created.png", mobile(), async () => {
    await page.locator('[data-qa="downstream-change-record"]').waitFor({ state: "visible", timeout: 10_000 });
  });
});

await captureScenario("billing-resolved", async ({ baseUrl, page }) => {
  await completeBilling(page, baseUrl);
  await capturePage(page, baseUrl, "/billing", "billing-resolved/desktop-billing-resolved.png", desktop(), async () => {
    await page.getByText("Billing blocker cleared", { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/billing", "billing-resolved/mobile-billing-resolved.png", mobile(), async () => {
    await page.getByText("Billing blocker cleared", { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/command-center", "billing-resolved/desktop-command-center-billing-resolved.png", desktop(), async () => {
    await expectTriageNotContains(page, "Recover blocked billing");
  });
});

await captureScenario("closeout-resolved", async ({ baseUrl, page }) => {
  await completeCloseout(page, baseUrl);
  await capturePage(page, baseUrl, "/closeout", "closeout-resolved/desktop-closeout-resolved.png", desktop(), async () => {
    await expectCloseoutState(page, "resolved");
  });
  await capturePage(page, baseUrl, "/closeout", "closeout-resolved/mobile-closeout-resolved.png", mobile(), async () => {
    await page.getByText("Closeout blocker cleared", { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/billing", "closeout-resolved/desktop-billing-final-release-projection.png", desktop(), async () => {
    await page.getByText("final billing unblocked | retainage release approved", { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await capturePage(page, baseUrl, "/command-center", "closeout-resolved/desktop-command-center-closeout-resolved.png", desktop(), async () => {
    await expectTriageNotContains(page, "Release final billing");
  });
});

await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify({
  timestamp: new Date().toISOString(),
  screenshots
}, null, 2)}\n`);

console.log(`Journey-state screenshots captured: ${screenshots.length}`);

async function captureScenario(name, run) {
  const tempRoot = await mkdtemp(join(tmpdir(), `rybexos-journey-${name}-`));
  const env = {
    ...process.env,
    RYBEXOS_FIELD_ISSUE_STORE_PATH: join(tempRoot, "field-issue-store.json"),
    RYBEXOS_BILLING_V2_STORE_PATH: join(tempRoot, "billing-v2-store.json"),
    RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH: join(tempRoot, "closeout-final-billing-store.json"),
    NEXT_TELEMETRY_DISABLED: "1"
  };
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverOutput = [];
  const server = spawn(process.execPath, [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    "start",
    "-p",
    String(port)
  ], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
  server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

  let browser;
  try {
    await waitForServer(`${baseUrl}/command-center`, server, serverOutput, 90_000);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: desktop() });
    await run({ baseUrl, page });
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

async function capturePage(page, baseUrl, route, name, viewport, beforeScreenshot) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
  if (beforeScreenshot) await beforeScreenshot();
  const filePath = join(outputRoot, name);
  await mkdir(dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  screenshots.push({ route, filePath });
  console.log(`Captured ${name}`);
}

async function completeFieldIssue(page, baseUrl, path) {
  await page.goto(`${baseUrl}/field-execution`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-qa="field-issue-escalation-workflow"]', { state: "visible", timeout: 15_000 });
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-start"]', "in progress");
  await page.locator('[data-qa="field-issue-assessment-input"]').fill("Utility locate and traffic-control release gap holds the bore crew and creates standby exposure.");
  await page.locator('[data-qa="field-issue-schedule-input"]').fill("2");
  await page.locator('[data-qa="field-issue-cost-input"]').fill("18500");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-save-assessment"]', "assessed");
  await page.locator('[data-qa="field-issue-evidence-input"]').fill("DR dr-lake-bore-0610, locate sketch, GC standby email");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-add-evidence"]', "evidence added");
  await page.locator('[data-qa="field-issue-path-select"]').selectOption(path);
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-select-path"]', "path selected");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-create-downstream"]', "downstream created");
  const record = path === "rfi" ? "RFI-FI-001" : "CE-FI-001";
  await page.locator('[data-qa="field-issue-resolution-note"]').fill(`${record} created and field issue cleared for follow-up.`);
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-resolve"]', "resolved");
}

async function completeBilling(page, baseUrl) {
  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-qa="billing-v2-guided-workflow"]', { state: "attached", timeout: 15_000 });
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-start-package"]', "billing-v2-step-build-package");
  await page.locator('[data-qa="billing-v2-backup-summary-input"]').fill("Stored material support and product approval backup for PA-001.");
  await page.locator('[data-qa="billing-v2-related-source-input"]').fill("bb-lake-001 / vault and handhole product approval");
  await page.locator('[data-qa="billing-v2-amount-input"]').fill("38500");
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-save-package"]', "billing-v2-step-add-proof");
  for (const evidenceId of requiredBillingEvidenceIds) {
    const card = page.locator(`[data-qa="billing-v2-evidence-card-${evidenceId}"]`);
    await card.waitFor({ state: "visible", timeout: 10_000 });
    await card.locator(`[data-qa="billing-v2-add-reference-${evidenceId}"]`).fill(`Reference saved for ${evidenceId} on PA-001.`);
    await card.getByRole("button", { name: "Save reference", exact: true }).click();
  }
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-validate-readiness"]', "billing-v2-step-review");
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-send-review"]', "billing-v2-step-review-decision");
  await page.locator('[data-qa="billing-v2-review-note-input"]').fill("Backup package approved for PA-001 commercial review.");
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-approve-review"]', "billing-v2-step-clear-blocker");
  await page.locator('[data-qa="billing-v2-resolution-note-input"]').fill("Commercial review approved the backup package. PA-001 can move to pay application review.");
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-clear-blocker"]', "billing-v2-step-outcome");
}

async function completeCloseout(page, baseUrl) {
  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-qa="closeout-final-billing-workflow"]', { state: "visible", timeout: 15_000 });
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-start"]', "in progress");
  await page.locator('[data-qa="closeout-final-billing-assessment-input"]').fill("Acceptance exceptions are closed, punch proof is aligned, and final billing release is ready once evidence is attached.");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-save-assessment"]', "assessed");
  await page.locator('[data-qa="closeout-final-billing-evidence-input"]').fill("Bluegrass final waiver package, restoration photos, and retainage release backup");
  for (const requirementId of closeoutEvidenceRequirementIds) {
    await page.locator(`[data-qa="closeout-final-billing-add-evidence-${requirementId}"]`).first().click();
  }
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-validate"]', "ready for review");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-submit-review"]', "review pending");
  await page.locator('[data-qa="closeout-final-billing-decision-note"]').fill("Approved for final billing and retainage release.");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-approve"]', "approved");
  await page.locator('[data-qa="closeout-final-billing-resolution-note"]').fill("Closeout release approved; final billing and retainage can be released.");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-clear"]', "resolved");
}

async function clickAndWaitForFieldState(page, selector, expectedText) {
  await page.locator(selector).first().click();
  await expectFieldIssueState(page, expectedText);
}

async function expectFieldIssueState(page, expectedText) {
  await page.locator('[data-qa="field-issue-state"]').getByText(expectedText, { exact: false }).waitFor({ timeout: 10_000 });
}

async function clickAndWaitForBillingStep(page, selector, expectedQa) {
  await page.locator(selector).first().click();
  await page.waitForSelector(`[data-qa="${expectedQa}"]`, { timeout: 10_000 });
}

async function clickAndWaitForCloseoutState(page, selector, expectedText) {
  await page.locator(selector).first().click();
  await expectCloseoutState(page, expectedText);
}

async function expectCloseoutState(page, expectedText) {
  await page.locator('[data-qa="closeout-final-billing-state"]').getByText(expectedText, { exact: false }).waitFor({ timeout: 10_000 });
}

async function expectTriageNotContains(page, text) {
  const triage = page.locator('[data-qa="command-center-visual-triage"]').first();
  await triage.waitFor({ state: "visible", timeout: 10_000 });
  const content = await triage.innerText();
  if (content.includes(text)) throw new Error(`Expected Command Center triage not to contain "${text}".`);
}

async function waitForServer(url, server, serverOutput, timeoutMs) {
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

function desktop() {
  return { width: 1440, height: 1100 };
}

function mobile() {
  return { width: 390, height: 844 };
}
