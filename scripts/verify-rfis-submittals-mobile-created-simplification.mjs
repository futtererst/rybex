import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const viewport = { width: 390, height: 844 };
const outputDir = resolve(root, "visual-qa-output/journey-states/field-rfi-created");
const geometryPath = join(outputDir, "mobile-rfis-submittals-rfi-created-geometry.json");
const failures = [];

mkdirSync(outputDir, { recursive: true });

console.log("Building app for rendered RFIs/Submittals mobile created-state verification...");
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

const tempRoot = await mkdtemp(join(tmpdir(), "rybexos-rfi-mobile-created-"));
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
let geometry = {};

try {
  await waitForServer(`${baseUrl}/command-center`, server, serverOutput, 90_000);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });

  await assertEmptyState(page, baseUrl);
  await completeFieldIssue(page, baseUrl);
  await assertDesktopCreatedState(page, baseUrl);
  geometry = await assertMobileCreatedState(page, baseUrl);

  if (failures.length > 0) {
    console.error("RFIs/Submittals rendered mobile created-state verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  const result = {
    timestamp: new Date().toISOString(),
    buildMode: "next build + next start production server",
    baseUrl,
    viewport,
    ctaBoundingBox: geometry.ctaBoundingBox,
    ctaFullyVisibleWithoutScrolling: geometry.ctaFullyVisibleWithoutScrolling,
    primarySurfacesBeforeTrace: geometry.primarySurfacesBeforeTrace,
    screenshotPath: join(outputDir, "mobile-rfis-submittals-rfi-created.png")
  };
  writeFileSync(geometryPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("RFIs/Submittals rendered mobile created-state checks passed.");
  console.log(JSON.stringify({
    page: "/rfis-submittals",
    viewport,
    ctaBoundingBox: geometry.ctaBoundingBox,
    ctaFullyVisibleWithoutScrolling: geometry.ctaFullyVisibleWithoutScrolling,
    primarySurfacesBeforeTrace: geometry.primarySurfacesBeforeTrace,
    geometryPath,
    humanReviewStillRequired: true
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function assertEmptyState(page, baseUrl) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${baseUrl}/rfis-submittals`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "No field-driven RFI has been created yet.");
  await expectVisible(page, "Escalate field issue");
}

async function assertDesktopCreatedState(page, baseUrl) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${baseUrl}/rfis-submittals`, { waitUntil: "networkidle", timeout: 45_000 });
  await expectVisible(page, "RFI-FI-001 created");
  await expectVisible(page, "Featured downstream record");
  await expectVisible(page, "Source field issue");
  await expectVisible(page, "Review RFI status");
}

async function assertMobileCreatedState(page, baseUrl) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/rfis-submittals`, { waitUntil: "networkidle", timeout: 45_000 });

  await expectVisible(page, "RFI-FI-001 created");
  await expectVisible(page, "Submitted");
  await expectVisible(page, "Created from Field Issue Escalation");
  await expectVisible(page, "Lake Norman Underground Conduit Package");
  await expectVisible(page, "Hospital access road and conduit crossing");
  await expectVisible(page, "This RFI carries the field issue into the formal answer path so scope, schedule, and commercial impact are protected.");
  await expectVisible(page, "Track the RFI response");
  await expectVisible(page, "Utility locates and traffic-control release remain unconfirmed.");
  await expectVisible(page, "Obtain written direction and confirm whether standby or reroute impacts are compensable.");
  await expectVisible(page, "Review RFI status");
  await expectVisible(page, "Field issue → RFI-FI-001 → Change exposure review");

  for (const hiddenText of [
    "Featured record",
    "Featured downstream record",
    "Source field issue",
    "Impact",
    "Status",
    "Next owner action"
  ]) {
    await expectNotVisible(page, hiddenText);
  }

  const createdHeadingCount = await page.getByRole("heading", { name: "RFI-FI-001 created" }).count();
  assert(createdHeadingCount === 1, `Expected exactly one RFI-FI-001 created heading, found ${createdHeadingCount}.`);

  const supportingDetails = page.locator('[data-qa="collapsed-details"]').filter({ hasText: "Supporting RFI and submittal details" });
  const supportingCount = await supportingDetails.count();
  assert(supportingCount === 1, `Expected exactly one Supporting RFI and submittal details disclosure, found ${supportingCount}.`);

  const supportingHelperVisible = await page.getByText("Registers, linked change records, and information-control context.", { exact: true }).isVisible().catch(() => false);
  assert(!supportingHelperVisible, "Supporting helper copy must be hidden while collapsed on mobile.");

  const nestedFactCards = await page.locator(".rfi-situation-facts div, .featured-rfi-details div").evaluateAll((nodes) =>
    nodes.filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }).length
  );
  assert(nestedFactCards === 0, `Expected no visible nested fact cards on mobile, found ${nestedFactCards}.`);

  const cta = page.getByRole("link", { name: "Review RFI status" }).first();
  const ctaBox = await cta.boundingBox();
  assert(Boolean(ctaBox), "Review RFI status CTA must have a bounding box.");
  const ctaFullyVisibleWithoutScrolling = Boolean(ctaBox) && ctaBox.y >= 0 && ctaBox.y + ctaBox.height <= viewport.height;
  assert(ctaFullyVisibleWithoutScrolling, `Review RFI status CTA must be fully visible in ${viewport.width}x${viewport.height}. Box: ${JSON.stringify(ctaBox)}.`);

  const surfaceData = await page.evaluate(() => {
    const hero = document.querySelector(".rfi-situation-hero");
    const action = document.querySelector(".featured-rfi-card");
    const trace = document.querySelector(".source-record-trace");
    const support = document.querySelector('[data-qa="collapsed-details"]');
    const directChildren = Array.from(document.querySelector(".rfi-downstream-journey")?.children ?? []);
    const traceTop = trace?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
    const primarySurfacesBeforeTrace = directChildren.filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0 && rect.top < traceTop;
    }).length;

    return {
      heroBottom: hero?.getBoundingClientRect().bottom ?? null,
      actionBottom: action?.getBoundingClientRect().bottom ?? null,
      traceTop: trace?.getBoundingClientRect().top ?? null,
      supportTop: support?.getBoundingClientRect().top ?? null,
      primarySurfacesBeforeTrace
    };
  });

  assert(surfaceData.primarySurfacesBeforeTrace === 2, `Expected exactly two primary surfaces before trace, found ${surfaceData.primarySurfacesBeforeTrace}.`);
  assert(surfaceData.actionBottom <= surfaceData.traceTop, "Action surface must appear before the trace.");
  assert(surfaceData.traceTop <= surfaceData.supportTop, "Supporting details must start after the trace.");

  return {
    ctaBoundingBox: ctaBox,
    ctaFullyVisibleWithoutScrolling,
    primarySurfacesBeforeTrace: surfaceData.primarySurfacesBeforeTrace,
    surfaceData
  };
}

async function completeFieldIssue(page, baseUrl) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${baseUrl}/field-execution`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.waitForSelector('[data-qa="field-issue-escalation-workflow"]', { state: "visible", timeout: 15_000 });
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-start"]', "in progress");
  await page.locator('[data-qa="field-issue-assessment-input"]').fill("Utility locate and traffic-control release gap holds the bore crew and creates standby exposure.");
  await page.locator('[data-qa="field-issue-schedule-input"]').fill("2");
  await page.locator('[data-qa="field-issue-cost-input"]').fill("18500");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-save-assessment"]', "assessed");
  await page.locator('[data-qa="field-issue-evidence-input"]').fill("DR dr-lake-bore-0610, locate sketch, GC standby email");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-add-evidence"]', "evidence added");
  await page.locator('[data-qa="field-issue-path-select"]').selectOption("rfi");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-select-path"]', "path selected");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-create-downstream"]', "downstream created");
  await page.locator('[data-qa="field-issue-resolution-note"]').fill("RFI-FI-001 created and field issue cleared for follow-up.");
  await clickAndWaitForFieldState(page, '[data-qa="field-issue-resolve"]', "resolved");
}

async function clickAndWaitForFieldState(page, selector, expectedText) {
  await page.locator(selector).first().click();
  await page.locator('[data-qa="field-issue-state"]').getByText(expectedText, { exact: false }).waitFor({ timeout: 10_000 });
}

async function expectVisible(page, text) {
  const visible = await page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
  assert(visible, `Expected visible text: ${text}`);
}

async function expectNotVisible(page, text) {
  const locators = await page.getByText(text, { exact: true }).all();
  for (const locator of locators) {
    const visible = await locator.isVisible().catch(() => false);
    assert(!visible, `Expected text not visible on mobile: ${text}`);
  }
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

function assert(condition, message) {
  if (!condition) failures.push(message);
}
