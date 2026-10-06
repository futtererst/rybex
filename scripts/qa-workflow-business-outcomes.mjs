import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/workflow-business-outcomes");
const reportPath = resolve(root, "docs/workflow-business-outcome-qa-report.md");
const resultsPath = join(artifactDir, "results.json");

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const results = [];

try {
  await resetPilotState(page);
  await runBilling(page, results);
  await runField(page, results);
  await runCloseout(page, results);
  await page.screenshot({ fullPage: true, path: join(artifactDir, "workflow-business-outcomes.png") });
} finally {
  await browser.close();
}

writeFileSync(resultsPath, JSON.stringify({ baseUrl, results, generatedAt: new Date().toISOString() }, null, 2));
writeFileSync(reportPath, buildReport(results), "utf8");

const failed = results.filter((result) => !result.passed);
if (failed.length > 0) {
  console.error("Workflow business outcome QA failed:");
  for (const result of failed) console.error(`- ${result.name}: ${result.notes}`);
  process.exit(1);
}

console.log("Workflow business outcome QA passed: all Pilot workflows produce outcome records and Pilot summaries.");

async function runBilling(page, results) {
  await openPilotWorkflow(page, "Add missing billing backup", "/billing", "billing-billing-backup-cash-recovery");
  await completeBillingV2GuidedWorkflow(page);
  await assertBillingV2Outcome(page);
  await returnToPilot(page);
  await assertPilotOutcome(page, "Add missing billing backup", "Pay App 003", "Open pay application review", "Pay App 003 billing backup readiness record");
  pass(results, "Billing outcome record", "Outcome record, saved inputs, evidence reference, next step, and Pilot summary passed.");
}

async function runField(page, results) {
  await openPilotWorkflow(page, "Escalate field issue", "/field-execution", "field-issue-escalation");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await fillAndSave(guided, "field-escalation-note-input", "save-field-escalation-note", "Saved escalation note", "Conduit route in Zone B conflicts with marked utility path and requires owner direction before continuing.");
  await guided.locator('[data-qa="field-control-path-input"]').selectOption("RFI");
  await guided.locator('[data-qa="save-field-control-path"]').click();
  await guided.getByText("Saved control path: RFI", { exact: false }).waitFor({ timeout: 5000 });
  await fillAndSave(guided, "rfi-draft-title-input", "save-rfi-draft-title", "Saved RFI draft title", "RFI - Zone B conduit routing conflict");
  await fillAndSave(guided, "rfi-question-input", "save-rfi-question", "Saved RFI question", "Confirm revised routing direction or approve field reroute around marked utility conflict.");
  await guided.getByRole("button", { name: "Create RFI from field issue", exact: true }).click();
  await fillAndSave(guided, "field-control-reason-input", "save-field-control-reason", "Saved control reason", "RFI draft created and linked to the field issue for owner response.");
  await guided.getByRole("button", { name: "Mark issue controlled", exact: true }).click();
  await fillAndSave(guided, "field-resolution-note-input", "save-field-resolution-note", "Saved field resolution note", "Issue is controlled through RFI tracking and no longer unmanaged in the daily report.");
  await guided.getByRole("button", { name: "Resolve field issue", exact: true }).click();
  await assertOutcome(page, {
    process: "Field issue control and escalation",
    object: "Field issue from daily execution",
    input: "Conduit route in Zone B conflicts",
    reference: "Confirm revised routing direction",
    impact: "Issue is no longer unmanaged",
    next: "Monitor RFI/change response",
    record: "Field issue escalation record"
  });
  await returnToPilot(page);
  await assertPilotOutcome(page, "Escalate field issue", "Field issue from daily execution", "Monitor RFI/change response", "Field issue escalation record");
  pass(results, "Field issue outcome record", "Outcome record, RFI details, linked output, next step, and Pilot summary passed.");
}

async function runCloseout(page, results) {
  await openPilotWorkflow(page, "Complete closeout requirement", "/closeout", "closeout-requirement-final-billing-release");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await fillAndSave(guided, "closeout-evidence-note-input", "save-closeout-evidence-note", "Saved closeout evidence note", "As-built redlines for Fiber Backbone Segment A are complete and included in the closeout package.");
  await fillAndSave(guided, "closeout-evidence-reference-input", "save-closeout-evidence-reference", "Saved closeout evidence reference", "Closeout Package CP-001, Section 04 - As-builts, file ASB-FB-A-Rev2.pdf.");
  await guided.getByRole("button", { name: "Mark closeout evidence attached", exact: true }).click();
  await guided.getByRole("button", { name: "Send closeout item to review", exact: true }).click();
  await fillAndSave(guided, "closeout-acceptance-note-input", "save-closeout-acceptance-note", "Saved acceptance note", "Required as-built documentation is complete and ready for final billing/acceptance review.");
  await guided.getByRole("button", { name: "Resolve closeout blocker", exact: true }).click();
  await assertOutcome(page, {
    process: "Closeout requirement completion and acceptance readiness",
    object: "Closeout requirement / closeout package item",
    input: "As-built redlines for Fiber Backbone Segment A",
    reference: "ASB-FB-A-Rev2.pdf",
    impact: "Closeout package and final billing readiness improved",
    next: "Open closeout package review",
    record: "Closeout completion record"
  });
  await returnToPilot(page);
  await assertPilotOutcome(page, "Complete closeout requirement", "Closeout requirement / closeout package item", "Open closeout package review", "Closeout completion record");
  pass(results, "Closeout outcome record", "Outcome record, document reference, linked output, next step, and Pilot summary passed.");
}

async function assertOutcome(page, expected) {
  const panel = page.locator('[data-qa="workflow-outcome-record-panel"]').first();
  await panel.waitFor({ state: "visible", timeout: 5000 });
  await panel.locator('[data-qa="workflow-outcome-business-object"]').waitFor({ state: "visible", timeout: 5000 });
  await panel.locator('[data-qa="workflow-outcome-next-step"]').waitFor({ state: "visible", timeout: 5000 });
  const text = await panel.innerText();
  for (const value of Object.values(expected)) {
    if (!text.includes(value)) throw new Error(`Outcome record missing ${value}. Text: ${text}`);
  }
  await page.locator('[data-qa="workflow-historical-record-panel"]').first().waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-qa="workflow-outcome-next-step-cta"]').first().waitFor({ state: "visible", timeout: 5000 });
}

async function assertPilotOutcome(page, label, objectText, nextStep, recordLabel) {
  const card = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: label }).first();
  await card.locator('[data-qa="pilot-workflow-outcome-summary"]').waitFor({ state: "visible", timeout: 5000 });
  const text = await card.innerText();
  for (const value of [objectText, nextStep, recordLabel]) {
    if (!text.includes(value)) throw new Error(`Pilot card missing ${value}. Text: ${text}`);
  }
}

async function openPilotWorkflow(page, label, route, focus) {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  const card = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: label }).first();
  await card.locator('[data-qa="pilot-workflow-primary-cta"]').click();
  await page.waitForURL((url) =>
    url.pathname === route &&
    url.searchParams.get("focus") === focus &&
    url.searchParams.get("pilot") === "1" &&
    url.hash === "#focused-task",
    { timeout: 10000 }
  );
  const selector = focus === "billing-billing-backup-cash-recovery"
    ? '[data-qa="billing-v2-guided-workflow"]'
    : '[data-qa="guided-completion-flow"]';
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 10000 });
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
    await card.locator(`[data-qa="billing-v2-add-reference-${evidenceId}"]`).fill(`Workflow outcome QA reference for ${evidenceId}.`);
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

async function assertBillingV2Outcome(page) {
  const outcome = await page.locator('[data-qa="billing-v2-outcome-record"]').innerText({ timeout: 5000 });
  for (const value of [
    "Billing backup blocker resolved",
    "Pay App 003",
    "$84,000",
    "commercial review"
  ]) {
    if (!outcome.includes(value)) throw new Error(`Billing v2 outcome missing ${value}. Text: ${outcome}`);
  }

  const historicalRecord = await page.locator('[data-qa="billing-v2-historical-record"]').innerText({ timeout: 5000 });
  for (const value of ["Saved fields", "Review task", "Review decision", "State transitions", "Local/demo status"]) {
    if (!historicalRecord.includes(value)) throw new Error(`Billing v2 historical record missing ${value}. Text: ${historicalRecord}`);
  }
}

async function fillAndSave(scope, inputQa, saveQa, savedLabel, value) {
  await scope.locator(`[data-qa="${inputQa}"]`).fill(value);
  await scope.locator(`[data-qa="${saveQa}"]`).click();
  await scope.getByText(`${savedLabel}: ${value}`, { exact: false }).first().waitFor({ timeout: 5000 });
}

async function returnToPilot(page) {
  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
}

async function resetPilotState(page) {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-qa="reset-pilot-demo-state"]').click();
  await page.waitForTimeout(300);
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
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app, then run npm run workflow-outcomes:qa. ${error instanceof Error ? error.message : ""}`);
  }
}

function pass(results, name, notes) {
  results.push({ name, passed: true, notes });
}

function buildReport(results) {
  const passed = results.every((result) => result.passed);
  const rows = results.map((result) => `| ${result.name} | ${result.passed ? "Pass" : "Fail"} | ${result.notes} |`).join("\n");

  return `# Workflow Business Outcome QA Report

## Result

${passed ? "Pass" : "Fail"}

## Scope

Starts at Pilot Mode, completes Billing, Field Issue, and Closeout, and verifies the business outcome record for each workflow.

| Check | Status | Notes |
| --- | --- | --- |
${rows}

## Acceptance Notes

- Outcome records show business process, business object, saved inputs, references, impact, remaining blockers, next business step, and historical record label.
- Pilot Mode cards summarize outcome and next step after completion.
- This is local/demo traceability unless database completion mode is explicitly enabled.
`;
}
