import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-billing-resolved-"));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const geometryPath = resolve(root, "visual-qa-output/journey-states/billing-resolved/mobile-billing-resolved-geometry.json");
const requiredEvidenceIds = [
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

mkdirSync(dirname(geometryPath), { recursive: true });

console.log("Building app for Billing resolved-state verification...");
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
  RYBEXOS_BILLING_V2_STORE_PATH: join(tempRoot, "billing-v2-store.json"),
  RYBEXOS_CLOSEOUT_FINAL_BILLING_STORE_PATH: join(tempRoot, "closeout-final-billing-store.json"),
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
  const page = await browser.newPage({ viewport: mobile() });

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Recover blocked billing");
  await expectVisible(page, "$38,500 blocked");
  await expectVisible(page, "Start backup package");

  await completeBilling(page, baseUrl);

  await page.setViewportSize(mobile());
  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Billing blocker cleared");
  await expectVisible(page, "$38,500 unblocked for commercial review");
  await expectVisible(page, "PA-001 backup approved");
  await expectVisible(page, "5 of 5 proof items complete");
  await expectVisible(page, "Command Center updated");
  await expectVisible(page, "Ready for commercial review");
  await expectVisible(page, "Payment has not yet been recorded");
  await expectVisible(page, "Open pay application review");

  const cta = page.getByRole("link", { name: "Open pay application review" }).first();
  const box = await cta.boundingBox();
  if (!box) throw new Error("Open pay application review CTA has no bounding box.");
  const ctaBottom = box.y + box.height;
  if (ctaBottom > mobile().height) {
    throw new Error(`Open pay application review CTA is below the first viewport. Bottom=${ctaBottom}, viewport=${mobile().height}.`);
  }

  const primarySurfaceCount = await page.locator("[data-billing-resolved-primary-surface]").count();
  if (primarySurfaceCount !== 2) {
    throw new Error(`Expected exactly two Billing resolved primary surfaces before support, found ${primarySurfaceCount}.`);
  }

  const supportingDisclosureCount = await page.getByText("Supporting billing records", { exact: true }).count();
  if (supportingDisclosureCount !== 1) {
    throw new Error(`Expected exactly one Supporting billing records disclosure, found ${supportingDisclosureCount}.`);
  }

  const visibleText = await page.locator("body").innerText();
  for (const stalePhrase of [
    "Cash at risk",
    "Why it is blocked",
    "PA-001 is blocked",
    "Recover blocked billing",
    "$38.5K recovered",
    "$38,500 recovered",
    "cash recovered",
    "Required now",
    "Complete\n",
    "What changed",
    "Open billing records",
    "Supporting billing history"
  ]) {
    if (visibleText.includes(stalePhrase)) {
      throw new Error(`Resolved Billing mobile still shows stale or duplicate phrase: ${stalePhrase}`);
    }
  }
  if (visibleText.includes("Resolved billing package:")) {
    throw new Error("Supporting billing records helper/detail content is visible while collapsed.");
  }

  const progressCount = await page.locator('[data-qa="billing-v2-step-progress"]').count();
  if (progressCount !== 0) throw new Error("Resolved Billing mobile still renders a completed progress rail.");

  await page.setViewportSize(desktop());
  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Billing blocker cleared");
  await expectVisible(page, "$38,500 unblocked for commercial review");
  await expectVisible(page, "Ready for commercial review");
  await expectVisible(page, "Open pay application review");
  const desktopText = await page.locator("body").innerText();
  for (const stalePhrase of ["Cash at risk", "Why it is blocked", "PA-001 is blocked", "$38.5K recovered", "$38,500 recovered"]) {
    if (desktopText.includes(stalePhrase)) {
      throw new Error(`Resolved Billing desktop still shows stale phrase: ${stalePhrase}`);
    }
  }

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectTriageNotContains(page, "Recover blocked billing");

  await completeCloseout(page, baseUrl);
  await page.setViewportSize(desktop());
  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Closeout release approved");
  await expectVisible(page, "Other billing blockers may still require action");
  await expectVisible(page, "Ready for processing");
  await expectVisible(page, "Release approved");
  await expectVisible(page, "Not recorded");
  await expectVisible(page, "final billing unblocked | retainage release approved");

  const geometry = {
    timestamp: new Date().toISOString(),
    buildServerMode: "next build + next start",
    viewport: mobile(),
    cta: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    },
    ctaBottom,
    primarySurfaceCount,
    supportDisclosureCount: supportingDisclosureCount
  };
  await writeFile(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`);

  console.log("Billing resolved-state browser verification passed.");
  console.log(JSON.stringify({
    baseUrl,
    geometryPath,
    ctaBottom,
    primarySurfaceCount,
    supportDisclosureCount: supportingDisclosureCount,
    humanReviewStillRequired: true
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function completeBilling(page, baseUrl) {
  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.waitForSelector('[data-qa="billing-v2-guided-workflow"]', { state: "attached", timeout: 15_000 });
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-start-package"]', "billing-v2-step-build-package");
  await page.locator('[data-qa="billing-v2-backup-summary-input"]').fill("Stored material support and product approval backup for PA-001.");
  await page.locator('[data-qa="billing-v2-related-source-input"]').fill("bb-lake-001 / vault and handhole product approval");
  await page.locator('[data-qa="billing-v2-amount-input"]').fill("38500");
  await clickAndWaitForBillingStep(page, '[data-qa="billing-v2-save-package"]', "billing-v2-step-add-proof");
  for (const evidenceId of requiredEvidenceIds) {
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
  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle", timeout: 45_000 });
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

async function clickAndWaitForBillingStep(page, selector, expectedQa) {
  await page.locator(selector).first().click();
  await page.waitForSelector(`[data-qa="${expectedQa}"]`, { timeout: 10_000 });
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

function mobile() {
  return { width: 390, height: 844 };
}

function desktop() {
  return { width: 1440, height: 1100 };
}
