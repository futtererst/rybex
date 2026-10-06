import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-billing-closeout-projection-"));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceRequirementIds = [
  "restoration-acceptance-photos",
  "final-unconditional-waiver",
  "retainage-release-request"
];
const evidencePath = resolve(root, "visual-qa-output/journey-states/closeout-resolved/billing-closeout-release-projection-verification.json");

mkdirSync(dirname(evidencePath), { recursive: true });

console.log("Building app for Billing closeout release projection verification...");
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

const env = {
  ...process.env,
  RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH: join(tempRoot, "closeout-final-billing-store.json"),
  RYBEXOS_BILLING_V2_STORE_PATH: join(tempRoot, "billing-v2-store.json"),
  RYBEXOS_FIELD_ISSUE_STORE_PATH: join(tempRoot, "field-issue-store.json"),
  NEXT_TELEMETRY_DISABLED: "1"
};

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

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Recover blocked billing");
  await expectVisible(page, "Start backup package");

  await completeCloseout(page, baseUrl);

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  const projection = page.locator('[data-qa="billing-final-release-projection"]').first();
  await projection.waitFor({ state: "visible", timeout: 10_000 });
  const projectionText = await projection.innerText();

  for (const expected of [
    "Closeout release approved",
    "Ready for processing",
    "Release approved",
    "Not recorded",
    "Cleared",
    "PA-001 backup package",
    "Other Billing blockers may still require action",
    "final billing unblocked | retainage release approved"
  ]) {
    if (!projectionText.includes(expected)) {
      throw new Error(`Billing projection missing expected resolved-closeout text: ${expected}`);
    }
  }

  for (const stale of [
    "Final billing paid",
    "final billing paid",
    "Payment complete",
    "Cash received",
    "Commercial exposure recovered",
    "Commercial exposure",
    "recovered"
  ]) {
    if (projectionText.includes(stale)) {
      throw new Error(`Billing projection still implies payment/recovery: ${stale}`);
    }
  }

  await expectVisible(page, "Recover blocked billing");
  await expectVisible(page, "PA-001");

  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Closeout blocker cleared");
  await expectVisible(page, "Payment has not yet been recorded");

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectTriageNotContains(page, "Release final billing");
  await expectVisible(page, "Recover blocked billing");

  await writeFile(evidencePath, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    buildServerMode: "next build + next start",
    baseUrl,
    projection: {
      title: "Closeout release approved",
      finalBillingStatus: "Ready for processing",
      retainageStatus: "Release approved",
      paymentStatus: "Not recorded",
      closeoutRestriction: "Cleared",
      remainingBlocker: "PA-001 backup package"
    },
    closeoutPaymentRecorded: false,
    commandCenterCloseoutSuppressed: true,
    billingPa001StillUnresolved: true
  }, null, 2)}\n`);

  console.log("Billing closeout release projection browser verification passed.");
  console.log(JSON.stringify({
    baseUrl,
    evidencePath,
    finalBillingStatus: "Ready for processing",
    retainageStatus: "Release approved",
    paymentStatus: "Not recorded",
    commercialState: "Closeout restriction cleared",
    humanReviewStillRequired: true
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function completeCloseout(page, baseUrl) {
  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.waitForSelector('[data-qa="closeout-final-billing-workflow"]', { state: "visible", timeout: 15_000 });
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-start"]', "in progress");
  await page.locator('[data-qa="closeout-final-billing-assessment-input"]').fill("Acceptance exceptions are closed, punch proof is aligned, and final billing release is ready once evidence is attached.");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-save-assessment"]', "assessed");
  await page.locator('[data-qa="closeout-final-billing-evidence-input"]').fill("Bluegrass final waiver package, restoration photos, and retainage release backup");
  for (const requirementId of evidenceRequirementIds) {
    await page.locator(`[data-qa="closeout-final-billing-add-evidence-${requirementId}"]`).first().click();
  }
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-validate"]', "ready for review");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-submit-review"]', "review pending");
  await page.locator('[data-qa="closeout-final-billing-decision-note"]').fill("Approved for final billing and retainage release processing.");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-approve"]', "approved");
  await page.locator('[data-qa="closeout-final-billing-resolution-note"]').fill("Closeout release package approved; final billing and retainage can continue processing.");
  await clickAndWaitForCloseoutState(page, '[data-qa="closeout-final-billing-clear"]', "resolved");
}

async function clickAndWaitForCloseoutState(page, selector, expectedText) {
  await page.locator(selector).first().click();
  await page.locator('[data-qa="closeout-final-billing-state"]').getByText(expectedText, { exact: false }).waitFor({ timeout: 10_000 });
}

async function expectVisible(page, text) {
  const locator = page.getByText(text, { exact: false });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible()) return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Expected visible text: ${text}`);
}

async function expectTriageNotContains(page, text) {
  const triage = page.locator('[data-qa="command-center-visual-triage"]').first();
  await triage.waitFor({ state: "visible", timeout: 10_000 });
  const content = await triage.innerText();
  if (content.includes(text)) throw new Error(`Expected Command Center triage not to contain "${text}".`);
}

async function waitForServer(url, runningServer, output, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (runningServer.exitCode !== null) {
      throw new Error(`Next server exited early.\n${output.join("")}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
    }
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join("")}`);
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
