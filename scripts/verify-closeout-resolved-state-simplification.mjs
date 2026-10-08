import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-closeout-resolved-"));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const geometryPath = resolve(root, "visual-qa-output/journey-states/closeout-resolved/mobile-closeout-resolved-geometry.json");
const evidenceRequirementIds = [
  "restoration-acceptance-photos",
  "final-unconditional-waiver",
  "retainage-release-request"
];

mkdirSync(dirname(geometryPath), { recursive: true });

console.log("Building app for Closeout resolved-state verification...");
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
  const page = await browser.newPage({ viewport: mobile() });

  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Release final billing");
  await expectVisible(page, "$58,000 blocked");
  await expectVisible(page, "Assess closeout requirements");

  await page.setViewportSize(desktop());
  await completeCloseout(page, baseUrl);

  await page.setViewportSize(mobile());
  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Closeout blocker cleared");
  await expectVisible(page, "$58,000 unblocked for final billing and retainage processing");
  await expectVisible(page, "Closeout requirement complete");
  await expectVisible(page, "acceptance/evidence complete");
  await expectVisible(page, "Release approval recorded");
  await expectVisible(page, "Billing projection updated");
  await expectVisible(page, "Command Center updated");
  await expectVisible(page, "Ready for final billing processing");
  await expectVisible(page, "Payment has not yet been recorded");
  await expectVisible(page, "Open Billing");

  const cta = page.getByRole("link", { name: "Open Billing" }).first();
  const box = await cta.boundingBox();
  if (!box) throw new Error("Open Billing CTA has no bounding box.");
  const ctaBottom = box.y + box.height;
  if (ctaBottom > mobile().height) {
    throw new Error(`Open Billing CTA is below the first viewport. Bottom=${ctaBottom}, viewport=${mobile().height}.`);
  }

  const primarySurfaceCount = await page.locator("[data-closeout-resolved-primary-surface]").count();
  if (primarySurfaceCount !== 2) {
    throw new Error(`Expected exactly two Closeout resolved primary surfaces before support, found ${primarySurfaceCount}.`);
  }

  const supportDisclosureCount = await page.getByText("Supporting closeout records", { exact: true }).count();
  if (supportDisclosureCount !== 1) {
    throw new Error(`Expected exactly one Supporting closeout records disclosure, found ${supportDisclosureCount}.`);
  }

  const visibleText = await page.locator("body").innerText();
  for (const stalePhrase of [
    "Final billing / retainage at risk",
    "Amount at risk",
    "Final billing is blocked",
    "Retainage is blocked",
    "Assessment needed",
    "Required now",
    "What changed",
    "Supporting closeout release details",
    "Final billing and retainage released",
    "Retainage released",
    "Final billing paid",
    "Cash received",
    "Payment complete"
  ]) {
    if (visibleText.includes(stalePhrase)) {
      throw new Error(`Resolved Closeout mobile still shows stale or over-strong phrase: ${stalePhrase}`);
    }
  }
  if (visibleText.includes("Resolved closeout package:")) {
    throw new Error("Supporting closeout records helper/detail content is visible while collapsed.");
  }

  const progressCount = await page.locator('[data-qa="closeout-final-billing-step-progress"]').count();
  if (progressCount !== 0) throw new Error("Resolved Closeout mobile still renders a completed progress rail.");

  await page.setViewportSize(desktop());
  await page.goto(`${baseUrl}/closeout`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Closeout blocker cleared");
  await expectVisible(page, "$58,000 unblocked for final billing and retainage processing");
  await expectVisible(page, "Ready for final billing processing");
  await expectVisible(page, "Open Billing");
  const desktopText = await page.locator("body").innerText();
  for (const stalePhrase of ["Final billing / retainage at risk", "Amount at risk", "Assessment needed", "Final billing and retainage released", "Retainage released"]) {
    if (desktopText.includes(stalePhrase)) {
      throw new Error(`Resolved Closeout desktop still shows stale phrase: ${stalePhrase}`);
    }
  }

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectTriageNotContains(page, "Release final billing");

  await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "Closeout release approved");
  await expectVisible(page, "Final billing");
  await expectVisible(page, "Ready for processing");
  await expectVisible(page, "Retainage");
  await expectVisible(page, "Release approved");
  await expectVisible(page, "Payment");
  await expectVisible(page, "Not recorded");
  await expectVisible(page, "Closeout restriction");
  await expectVisible(page, "Cleared");
  await expectVisible(page, "Other billing blockers may still require action");
  await expectVisible(page, "final billing unblocked | retainage release approved");
  const billingProjectionText = await page.locator('[data-qa="billing-final-release-projection"]').innerText();
  for (const stalePhrase of ["Final billing paid", "final billing paid", "Payment complete", "Cash received", "Commercial exposure recovered"]) {
    if (billingProjectionText.includes(stalePhrase)) {
      throw new Error(`Billing closeout projection still implies payment/recovery: ${stalePhrase}`);
    }
  }

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
    supportDisclosureCount,
    canonicalAmount: 58000,
    canonicalStatus: "resolved",
    paymentRecorded: false
  };
  await writeFile(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`);

  console.log("Closeout resolved-state browser verification passed.");
  console.log(JSON.stringify({
    baseUrl,
    geometryPath,
    ctaBottom,
    primarySurfaceCount,
    supportDisclosureCount,
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
