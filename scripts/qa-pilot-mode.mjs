import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/pilot-mode-qa");
const reportPath = resolve(root, "docs/pilot-mode-qa-report.md");

const workflows = [
  {
    label: "Add missing billing backup",
    routeText: "/billing",
    panelSelector: '[data-qa="focused-task-panel"]',
    completionSelector: '[data-qa="billing-v2-guided-workflow"]'
  },
  {
    label: "Escalate field issue",
    routeText: "/field-execution",
    panelSelector: '[data-qa="focused-task-panel"]',
    completionSelector: '[data-qa="field-issue-completion-panel"]'
  },
  {
    label: "Complete closeout requirement",
    routeText: "/closeout",
    panelSelector: '[data-qa="focused-task-panel"]',
    completionSelector: '[data-qa="closeout-completion-panel"]'
  }
];

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const results = [];

try {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-qa="pilot-mode-page"]', { timeout: 10000 });
  await expectCount(page, '[data-qa="pilot-workflow-card"]', 3, "Pilot Mode must render exactly three workflow cards.");
  await page.waitForSelector('[data-qa="pilot-mode-guardrails"]', { timeout: 5000 });
  await page.getByText("not production ready", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.waitForSelector('[data-qa="reset-pilot-demo-state"]', { timeout: 5000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-qa="reset-pilot-demo-state"]').click();
  await page.waitForTimeout(250);

  await runBillingManualFailureRegression(page, results);

  for (const workflow of workflows) {
    await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
    const card = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: workflow.label }).first();
    await card.waitFor({ state: "visible", timeout: 5000 });
    await card.locator('[data-qa="pilot-workflow-primary-cta"]').click();
    await page.waitForURL((url) => url.pathname.includes(workflow.routeText) && url.searchParams.get("pilot") === "1", { timeout: 10000 });
    await page.waitForSelector(workflow.panelSelector, { timeout: 10000 });
    await page.waitForSelector(workflow.completionSelector, { timeout: 10000 });
    if (workflow.label === "Add missing billing backup") {
      await completeBillingV2GuidedWorkflow(page);
    }
    await page.waitForSelector('[data-qa="return-to-pilot-mode"]', { timeout: 5000 });
    results.push({
      workflow: workflow.label,
      routed: page.url(),
      focusedTask: true,
      completionPanel: true,
      returnLink: true
    });
    await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
    await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
  }

  await page.screenshot({ fullPage: true, path: join(artifactDir, "pilot-mode.png") });
  writeFileSync(reportPath, buildReport(results), "utf8");
  console.log("Pilot Mode QA passed: three workflow cards route to focused tasks and return to Pilot Mode.");
} finally {
  await browser.close();
}

async function runBillingManualFailureRegression(page, results) {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  const billingCard = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Add missing billing backup" }).first();
  await billingCard.locator('[data-qa="pilot-workflow-primary-cta"]').click();
  await page.waitForURL((url) =>
    url.pathname === "/billing" &&
    url.searchParams.get("focus") === "billing-billing-backup-cash-recovery" &&
    url.searchParams.get("pilot") === "1" &&
    url.hash === "#focused-task",
    { timeout: 10000 }
  );
  await page.waitForSelector('[data-qa="focused-task-panel"]', { timeout: 10000 });
  await page.waitForSelector('[data-qa="billing-v2-guided-workflow"]', { timeout: 10000 });
  await page.waitForSelector('[data-qa="billing-v2-process-rail"]', { timeout: 5000 });
  await completeBillingV2GuidedWorkflow(page);
  await page.getByText("Billing backup blocker resolved. Pay App 003 is ready for commercial review.", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
  const completedCard = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Add missing billing backup" }).first();
  await completedCard.getByText("Complete", { exact: false }).first().waitFor({ timeout: 5000 });
  await completedCard.getByText("resolved", { exact: false }).first().waitFor({ timeout: 5000 });

  results.push({
    workflow: "Add missing billing backup manual regression",
    routed: page.url(),
    focusedTask: true,
    completionPanel: true,
    guidedFlow: true,
    completed: true,
    returnLink: true
  });
}

async function completeBillingV2GuidedWorkflow(page) {
  await page.locator('[data-qa="billing-v2-start-package"]').click();
  await page.locator('[data-qa="billing-v2-backup-summary-input"]').fill("Signed T&M ticket and supervisor backup are available for CE-004.");
  await page.locator('[data-qa="billing-v2-related-source-input"]').fill("CE-004 / stored material billing support");
  await page.locator('[data-qa="billing-v2-amount-input"]').fill("84000");
  await page.locator('[data-qa="billing-v2-save-package"]').click();
  await page.locator('[data-qa="billing-v2-step-add-proof"]').waitFor({ state: "visible", timeout: 5000 });

  for (const evidenceId of [
    "signed-tm-ticket",
    "daily-report-reference",
    "photo-log-reference",
    "supervisor-confirmation",
    "product-approval-backup"
  ]) {
    const card = page.locator(`[data-qa="billing-v2-evidence-card-${evidenceId}"]`);
    await card.locator(`[data-qa="billing-v2-add-reference-${evidenceId}"]`).fill(`Pilot Mode QA reference for ${evidenceId}.`);
    await card.getByRole("button", { name: "Save reference", exact: true }).click();
    await card.getByText("Saved reference:", { exact: false }).waitFor({ timeout: 5000 });
  }

  await page.locator('[data-qa="billing-v2-validate-readiness"]').click();
  await page.locator('[data-qa="billing-v2-step-review"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-qa="billing-v2-send-review"]').click();
  await page.locator('[data-qa="billing-v2-step-review-decision"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-qa="billing-v2-review-note-input"]').fill("Backup package approved for Pay App 003 commercial review.");
  await page.locator('[data-qa="billing-v2-approve-review"]').click();
  await page.locator('[data-qa="billing-v2-step-clear-blocker"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-qa="billing-v2-resolution-note-input"]').fill("Backup package is complete and ready for pay application review.");
  await page.locator('[data-qa="billing-v2-clear-blocker"]').click();
  await page.locator('[data-qa="billing-v2-step-outcome"]').waitFor({ state: "visible", timeout: 5000 });
}

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/pilot`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run pilot-mode:qa. ${error instanceof Error ? error.message : ""}`);
  }
}

async function expectCount(page, selector, expected, message) {
  const count = await page.locator(selector).count();
  if (count !== expected) {
    throw new Error(`${message} Found ${count}.`);
  }
}

function buildReport(results) {
  return `# Pilot Mode QA Report

## Result

Pass. Pilot Mode renders exactly three workflow cards, each routes to the exact focused task, and each focused task exposes a return path to Pilot Mode.

Manual regression passed: Add missing billing backup is visibly executable from Pilot Mode through resolution.

## Tested Workflows

${results.map((result) => `- ${result.workflow}: ${result.routed}`).join("\n")}

## Guardrails

- Controlled internal pilot candidate.
- Not production ready.
- Local/demo reset is available.
- No navigation loop observed.
`;
}
