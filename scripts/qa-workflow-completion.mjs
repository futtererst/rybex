import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/workflow-completion-qa");
const reportPath = resolve(root, "docs/workflow-completion-qa-report.md");
const resultsPath = join(artifactDir, "results.json");

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run workflow-completion:qa. ${error instanceof Error ? error.message : ""}`);
  }
}

async function visible(page, selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.some((node) => {
      const element = node;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    })
  ).catch(() => false);
}

async function clickCompletionButton(page, label) {
  const panel = page.locator('[data-qa="guided-completion-flow"]').first();
  await panel.getByRole("button", { name: label, exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(250);
}

async function expectDisabled(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  if (!(await locator.isDisabled())) throw new Error(message);
}

async function expectEnabled(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  if (await locator.isDisabled()) throw new Error(message);
}

function requireStep(results, name, passed, notes) {
  results.push({ name, passed, notes });
}

function reportFor(results) {
  const passed = results.every((result) => result.passed);
  const rows = results.map((result) =>
    `| ${result.name} | ${result.passed ? "Pass" : "Fail"} | ${result.notes} |`
  ).join("\n");

  return `# Workflow Completion QA Report

## Scenario

Billing Backup Blocker -> Cash Recovery.

## Result

${passed ? "Pass" : "Fail"}

## Steps

| Step | Status | Notes |
| --- | --- | --- |
${rows}

## Acceptance Notes

- Command Center primary CTA must be concrete: Add missing billing backup.
- CTA must route to Billing with focus metadata.
- Billing must show a focused task panel with "You are here to".
- Billing must show the guided "Complete billing backup task" flow above dense details.
- User must save backup note, evidence reference, and resolution note before completing the blocker.
- User must be able to mark backup attached, send to review, resolve the blocker, and see local history.
- Manual pilot failure regression: the user must not land on Billing with only informational details.
- This is local/demo state only; production persistence is not claimed.
`;
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
    await card.locator(`[data-qa="billing-v2-add-reference-${evidenceId}"]`).fill(`Workflow completion QA reference for ${evidenceId}.`);
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

await assertServerReady();

if (!existsSync(artifactDir)) {
  mkdirSync(artifactDir, { recursive: true });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const results = [];

try {
  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("rybexos.workflow-completion-demo-state.v1"));
  await page.evaluate(() => window.localStorage.removeItem("rybexos.evidence-demo-state.v1"));
  await page.reload({ waitUntil: "networkidle" });

  const ctaVisible = await page.getByRole("link", { name: "Add missing billing backup" }).first().isVisible({ timeout: 4000 }).catch(() => false);
  requireStep(results, "Command Center concrete CTA", ctaVisible, ctaVisible ? "Primary CTA is concrete." : "Primary CTA was not visible.");

  if (ctaVisible) {
    await page.getByRole("link", { name: "Add missing billing backup" }).first().click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('[data-qa="focused-task-panel"]', { timeout: 4000 }).catch(() => undefined);
  }

  const focusedUrl = page.url();
  requireStep(
    results,
    "Routes to focused Billing task",
    focusedUrl.includes("/billing") && focusedUrl.includes("focus=billing-billing-backup-cash-recovery") && focusedUrl.includes("#focused-task"),
    focusedUrl
  );

  await page.goto(focusedUrl, { waitUntil: "networkidle" });

  const focusedTaskVisible = await visible(page, '[data-qa="focused-task-panel"]');
  const focusedTaskText = await page.locator('[data-qa="focused-task-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Focused task instruction visible",
    focusedTaskVisible && /Billing Backup Package/i.test(focusedTaskText) && /Pay App 003/i.test(focusedTaskText),
    focusedTaskVisible ? "Focused task panel names the guided Billing v2 package." : "Focused task panel was not visible."
  );

  requireStep(
    results,
    "Guided Billing v2 workflow visible",
    await visible(page, '[data-qa="billing-v2-guided-workflow"]') &&
      await visible(page, '[data-qa="billing-v2-process-rail"]') &&
      await visible(page, '[data-qa="billing-v2-active-step"]'),
    "Billing task exposes a process rail and one active guided step."
  );

  await completeBillingV2GuidedWorkflow(page);
  const outcomeText = await page.locator('[data-qa="billing-v2-outcome-record"]').innerText({ timeout: 5000 });
  requireStep(
    results,
    "Billing v2 outcome visible",
    /Billing backup blocker resolved/i.test(outcomeText) && /Pay App 003/i.test(outcomeText) && /\$84,000/i.test(outcomeText),
    outcomeText || "No Billing v2 outcome was visible."
  );

  const historyText = await page.locator('[data-qa="billing-v2-historical-record"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Billing v2 historical record visible",
    /Saved fields/i.test(historyText) &&
      /Review task/i.test(historyText) &&
      /Review decision/i.test(historyText) &&
      /State transitions/i.test(historyText),
    historyText ? "Local historical record shows the guided completion path." : "No historical record was visible."
  );
} finally {
  await browser.close();
}

writeFileSync(resultsPath, JSON.stringify({ baseUrl, results, generatedAt: new Date().toISOString() }, null, 2));
writeFileSync(reportPath, reportFor(results));

if (results.some((result) => !result.passed)) {
  console.error("Workflow completion QA failed:");
  for (const result of results.filter((item) => !item.passed)) {
    console.error(`- ${result.name}: ${result.notes}`);
  }
  process.exit(1);
}

console.log("Workflow completion QA passed: billing backup blocker can be completed in local/demo state.");
