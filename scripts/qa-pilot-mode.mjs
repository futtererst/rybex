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
    completionSelector: '[data-qa="workflow-completion-panel"]'
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
  await page.waitForSelector('[data-qa="guided-completion-flow"]', { timeout: 10000 });
  await page.getByText("Complete billing backup task", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.getByText("Follow these steps to clear the billing blocker.", { exact: false }).first().waitFor({ timeout: 5000 });

  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const markBackup = guided.getByRole("button", { name: "Mark backup attached", exact: true });
  if (!(await markBackup.isDisabled())) throw new Error("Mark backup attached should wait for saved backup inputs.");
  await guided.locator('[data-qa="backup-note-input"]').fill("Signed T&M ticket and supervisor backup are available for CE-004.");
  await guided.locator('[data-qa="save-backup-note"]').click();
  await guided.getByText("Saved backup note: Signed T&M ticket", { exact: false }).first().waitFor({ timeout: 5000 });
  await guided.locator('[data-qa="billing-evidence-reference-input"]').fill("Daily Report DR-2026-06-10, photo log PL-014, signed T&M ticket T&M-077.");
  await guided.locator('[data-qa="save-billing-evidence-reference"]').click();
  await guided.getByText("Saved evidence reference: Daily Report DR-2026-06-10", { exact: false }).first().waitFor({ timeout: 5000 });
  if (await markBackup.isDisabled()) throw new Error("Mark backup attached remained disabled after required backup inputs were saved.");
  await markBackup.click();
  await page.waitForFunction(() => document.body.innerText.includes("Backup attached"), null, { timeout: 5000 });
  const sendButton = guided.getByRole("button", { name: "Send to review", exact: true });
  await sendButton.waitFor({ state: "visible", timeout: 5000 });
  if (await sendButton.isDisabled()) throw new Error("Send to review remained disabled after backup was attached.");
  await sendButton.click();
  await page.waitForFunction(() => document.body.innerText.includes("Ready for review"), null, { timeout: 5000 });
  const resolveButton = guided.getByRole("button", { name: "Resolve billing blocker", exact: true });
  await resolveButton.waitFor({ state: "visible", timeout: 5000 });
  if (!(await resolveButton.isDisabled())) throw new Error("Resolve billing blocker should wait for resolution note.");
  await guided.locator('[data-qa="billing-resolution-note-input"]').fill("Backup package is complete and ready for pay application review.");
  await guided.locator('[data-qa="save-billing-resolution-note"]').click();
  await guided.getByText("Saved resolution note: Backup package is complete", { exact: false }).first().waitFor({ timeout: 5000 });
  if (await resolveButton.isDisabled()) throw new Error("Resolve billing blocker remained disabled after resolution note.");
  await resolveButton.click();
  await page.waitForSelector('[data-qa="guided-completion-complete"]', { timeout: 5000 });
  await page.getByText("Billing blocker resolved", { exact: false }).first().waitFor({ timeout: 5000 });
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
