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

  const focusedTaskVisible = await visible(page, '[data-qa="focused-task-panel"]');
  const focusedTaskText = await page.locator('[data-qa="focused-task-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Focused task instruction visible",
    focusedTaskVisible && /You are here to/i.test(focusedTaskText) && /Add missing billing backup/i.test(focusedTaskText),
    focusedTaskVisible ? "Focused task panel names the exact task." : "Focused task panel was not visible."
  );

  requireStep(
    results,
    "Completion panel visible",
    await visible(page, '[data-qa="workflow-completion-panel"]'),
    "Completion controls are present."
  );
  requireStep(
    results,
    "Guided completion flow visible",
    await visible(page, '[data-qa="guided-completion-flow"]') &&
      /Complete billing backup task/i.test(await page.locator('[data-qa="guided-completion-flow"]').first().innerText().catch(() => "")),
    "Billing task exposes a visible step-by-step workflow."
  );
  await page.waitForSelector('[data-qa="workflow-completion-panel"][data-ready="true"]', { timeout: 5000 });

  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const backupNote = "Signed T&M ticket and supervisor backup are available for CE-004.";
  const evidenceReference = "Daily Report DR-2026-06-10, photo log PL-014, signed T&M ticket T&M-077.";
  const resolutionNote = "Backup package is complete and ready for pay application review.";
  const markBackup = guided.getByRole("button", { name: "Mark backup attached", exact: true });
  await expectDisabled(markBackup, "Mark backup attached should be disabled until backup note and evidence reference are saved.");
  await guided.locator('[data-qa="backup-note-input"]').fill(backupNote);
  await guided.locator('[data-qa="save-backup-note"]').click();
  await guided.getByText(`Saved backup note: ${backupNote}`, { exact: false }).waitFor({ timeout: 5000 });
  await expectDisabled(markBackup, "Mark backup attached should remain disabled until evidence reference is saved.");
  await guided.locator('[data-qa="billing-evidence-reference-input"]').fill(evidenceReference);
  await guided.locator('[data-qa="save-billing-evidence-reference"]').click();
  await guided.getByText(`Saved evidence reference: ${evidenceReference}`, { exact: false }).waitFor({ timeout: 5000 });
  await expectEnabled(markBackup, "Mark backup attached should enable after backup note and evidence reference are saved.");

  await clickCompletionButton(page, "Mark backup attached");
  const panel = page.locator('[data-qa="workflow-completion-panel"]').first();
  const attachedText = await panel.innerText().catch(() => "");
  requireStep(results, "Mark backup attached", /Backup marked attached/i.test(attachedText), attachedText || "No attached message.");

  await page.locator('[data-qa="guided-completion-flow"]').first().getByRole("button", { name: "Send to review", exact: true }).waitFor({ state: "visible", timeout: 4000 });
  await clickCompletionButton(page, "Send to review");
  const reviewText = await panel.innerText().catch(() => "");
  requireStep(results, "Send to review", /Billing backup is ready for review/i.test(reviewText), reviewText || "No review message.");

  const resolveButton = guided.getByRole("button", { name: "Resolve billing blocker", exact: true });
  await expectDisabled(resolveButton, "Resolve billing blocker should be disabled until resolution note is saved.");
  await guided.locator('[data-qa="billing-resolution-note-input"]').fill(resolutionNote);
  await guided.locator('[data-qa="save-billing-resolution-note"]').click();
  await guided.getByText(`Saved resolution note: ${resolutionNote}`, { exact: false }).waitFor({ timeout: 5000 });
  await expectEnabled(resolveButton, "Resolve billing blocker should enable after resolution note is saved.");

  await clickCompletionButton(page, "Resolve billing blocker");
  const resolvedText = await panel.innerText().catch(() => "");
  requireStep(results, "Resolve billing blocker", /Billing blocker resolved/i.test(resolvedText), resolvedText || "No resolved message.");

  const historyText = await page.locator('[data-qa="workflow-completion-history"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Completion history visible",
    /Saved backup note/i.test(historyText) &&
      /Saved evidence reference/i.test(historyText) &&
      /Saved resolution note/i.test(historyText) &&
      /Resolve billing blocker/i.test(historyText) &&
      /Send to review/i.test(historyText) &&
      /Mark backup attached/i.test(historyText),
    historyText ? "Local history shows the completion path." : "No history was visible."
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
