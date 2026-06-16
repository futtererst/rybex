import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/workflow-execution-qa");
const reportPath = resolve(root, "docs/workflow-execution-qa-report.md");
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
  await page.screenshot({ fullPage: true, path: join(artifactDir, "workflow-execution-qa.png") });
} finally {
  await browser.close();
}

writeFileSync(resultsPath, JSON.stringify({ baseUrl, results, generatedAt: new Date().toISOString() }, null, 2));
writeFileSync(reportPath, buildReport(results), "utf8");

const failed = results.filter((result) => !result.passed);
if (failed.length > 0) {
  console.error("Workflow execution QA failed:");
  for (const result of failed) console.error(`- ${result.name}: ${result.notes}`);
  process.exit(1);
}

console.log("Workflow execution QA passed: all three Pilot Mode workflows require, save, and use human-editable fields.");

async function runBilling(page, results) {
  await openPilotWorkflow(page, "Add missing billing backup", "/billing", "billing-billing-backup-cash-recovery");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const mark = guided.getByRole("button", { name: "Mark backup attached", exact: true });
  await expectDisabled(mark, "Billing mark attached should start disabled.");

  await fillAndSave(guided, "backup-note-input", "save-backup-note", "Saved backup note", "Signed T&M ticket and supervisor backup are available for CE-004.");
  await expectDisabled(mark, "Billing mark attached should still wait for evidence reference.");
  await fillAndSave(guided, "billing-evidence-reference-input", "save-billing-evidence-reference", "Saved evidence reference", "Daily Report DR-2026-06-10, photo log PL-014, signed T&M ticket T&M-077.");
  await expectEnabled(mark, "Billing mark attached should enable after backup note and evidence reference.");
  await mark.click();
  await page.getByText("Backup marked attached", { exact: false }).first().waitFor({ timeout: 5000 });

  await guided.getByRole("button", { name: "Send to review", exact: true }).click();
  await page.getByText("Billing backup is ready for review", { exact: false }).first().waitFor({ timeout: 5000 });
  const resolve = guided.getByRole("button", { name: "Resolve billing blocker", exact: true });
  await expectDisabled(resolve, "Billing resolve should wait for resolution note.");
  await fillAndSave(guided, "billing-resolution-note-input", "save-billing-resolution-note", "Saved resolution note", "Backup package is complete and ready for pay application review.");
  await expectEnabled(resolve, "Billing resolve should enable after resolution note.");
  await resolve.click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await assertHistory(page, ["Saved backup note", "Saved evidence reference", "Saved resolution note", "Mark backup attached", "Send to review", "Resolve billing blocker"]);
  await returnToPilot(page);
  await expectPilotComplete(page, "Add missing billing backup");
  pass(results, "Billing editable execution", "Backup note, evidence reference, resolution note, history, and progress passed.");
}

async function runField(page, results) {
  await openPilotWorkflow(page, "Escalate field issue", "/field-execution", "field-issue-escalation");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const createRfi = guided.getByRole("button", { name: "Create RFI from field issue", exact: true });
  await expectDisabled(createRfi, "Field RFI should start disabled.");

  await fillAndSave(guided, "field-escalation-note-input", "save-field-escalation-note", "Saved escalation note", "Conduit route in Zone B conflicts with marked utility path and requires owner direction before continuing.");
  await guided.locator('[data-qa="field-control-path-input"]').selectOption("RFI");
  await guided.locator('[data-qa="save-field-control-path"]').click();
  await guided.getByText("Saved control path: RFI", { exact: false }).waitFor({ timeout: 5000 });
  await fillAndSave(guided, "rfi-draft-title-input", "save-rfi-draft-title", "Saved RFI draft title", "RFI - Zone B conduit routing conflict");
  await fillAndSave(guided, "rfi-question-input", "save-rfi-question", "Saved RFI question", "Confirm revised routing direction or approve field reroute around marked utility conflict.");
  await expectEnabled(createRfi, "Field RFI should enable after escalation note, path, title, and question.");
  await createRfi.click();
  await page.getByText("RFI draft created from field issue", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.getByText("RFI draft from field issue", { exact: false }).first().waitFor({ timeout: 5000 });

  const controlled = guided.getByRole("button", { name: "Mark issue controlled", exact: true });
  await expectDisabled(controlled, "Field controlled should wait for control reason.");
  await fillAndSave(guided, "field-control-reason-input", "save-field-control-reason", "Saved control reason", "RFI draft created and linked to the field issue for owner response.");
  await expectEnabled(controlled, "Field controlled should enable after control reason.");
  await controlled.click();
  await page.getByText("Field issue marked controlled", { exact: false }).first().waitFor({ timeout: 5000 });

  const resolve = guided.getByRole("button", { name: "Resolve field issue", exact: true });
  await expectDisabled(resolve, "Field resolve should wait for resolution note.");
  await fillAndSave(guided, "field-resolution-note-input", "save-field-resolution-note", "Saved field resolution note", "Issue is controlled through RFI tracking and no longer unmanaged in the daily report.");
  await expectEnabled(resolve, "Field resolve should enable after resolution note.");
  await resolve.click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await assertHistory(page, ["Saved escalation note", "Saved control path", "Saved RFI draft title", "Saved RFI question", "Saved control reason", "Saved field resolution note", "Create RFI from field issue", "Mark issue controlled", "Resolve field issue"]);
  await returnToPilot(page);
  await expectPilotComplete(page, "Escalate field issue");
  pass(results, "Field editable execution", "Escalation note, RFI details, control reason, resolution note, linked output, history, and progress passed.");
}

async function runCloseout(page, results) {
  await openPilotWorkflow(page, "Complete closeout requirement", "/closeout", "closeout-requirement-final-billing-release");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const attach = guided.getByRole("button", { name: "Mark closeout evidence attached", exact: true });
  await expectDisabled(attach, "Closeout attach should start disabled.");

  await fillAndSave(guided, "closeout-evidence-note-input", "save-closeout-evidence-note", "Saved closeout evidence note", "As-built redlines for Fiber Backbone Segment A are complete and included in the closeout package.");
  await expectDisabled(attach, "Closeout attach should still wait for evidence reference.");
  await fillAndSave(guided, "closeout-evidence-reference-input", "save-closeout-evidence-reference", "Saved closeout evidence reference", "Closeout Package CP-001, Section 04 - As-builts, file ASB-FB-A-Rev2.pdf.");
  await expectEnabled(attach, "Closeout attach should enable after note and reference.");
  await attach.click();
  await page.getByText("Closeout evidence marked attached", { exact: false }).first().waitFor({ timeout: 5000 });

  await guided.getByRole("button", { name: "Send closeout item to review", exact: true }).click();
  await page.getByText("Closeout item sent to review", { exact: false }).first().waitFor({ timeout: 5000 });
  const resolve = guided.getByRole("button", { name: "Resolve closeout blocker", exact: true });
  await expectDisabled(resolve, "Closeout resolve should wait for acceptance note.");
  await fillAndSave(guided, "closeout-acceptance-note-input", "save-closeout-acceptance-note", "Saved acceptance note", "Required as-built documentation is complete and ready for final billing/acceptance review.");
  await expectEnabled(resolve, "Closeout resolve should enable after acceptance note.");
  await resolve.click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await assertHistory(page, ["Saved closeout evidence note", "Saved closeout evidence reference", "Saved acceptance note", "Mark closeout evidence attached", "Send closeout item to review", "Resolve closeout blocker"]);
  await returnToPilot(page);
  await expectPilotComplete(page, "Complete closeout requirement");
  pass(results, "Closeout editable execution", "Evidence note, reference, acceptance note, history, and progress passed.");
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
  await page.locator('[data-qa="guided-completion-flow"]').first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator('[data-ready="true"]').first().waitFor({ state: "attached", timeout: 10000 });
}

async function fillAndSave(scope, inputQa, saveQa, savedLabel, value) {
  await scope.locator(`[data-qa="${inputQa}"]`).fill(value);
  const save = scope.locator(`[data-qa="${saveQa}"]`);
  await expectEnabled(save, `${saveQa} should enable after typing.`);
  await save.click();
  await scope.getByText(`${savedLabel}: ${value}`, { exact: false }).first().waitFor({ timeout: 5000 });
}

async function assertHistory(page, phrases) {
  const historyText = await page.locator('[data-qa="workflow-completion-history"]').first().innerText();
  for (const phrase of phrases) {
    if (!historyText.includes(phrase)) {
      throw new Error(`History missing ${phrase}. History: ${historyText}`);
    }
  }
}

async function returnToPilot(page) {
  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
}

async function expectPilotComplete(page, label) {
  const card = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: label }).first();
  await card.getByText("Complete", { exact: false }).first().waitFor({ timeout: 5000 });
  await card.getByText("resolved", { exact: false }).first().waitFor({ timeout: 5000 });
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
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run workflow-execution:qa. ${error instanceof Error ? error.message : ""}`);
  }
}

async function expectEnabled(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  if (await locator.isDisabled()) throw new Error(message);
}

async function expectDisabled(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  if (!(await locator.isDisabled())) throw new Error(message);
}

function pass(results, name, notes) {
  results.push({ name, passed: true, notes });
}

function buildReport(results) {
  const passed = results.every((result) => result.passed);
  const rows = results.map((result) => `| ${result.name} | ${result.passed ? "Pass" : "Fail"} | ${result.notes} |`).join("\n");

  return `# Workflow Execution QA Report

## Result

${passed ? "Pass" : "Fail"}

## Scope

Starts at Pilot Mode and completes Billing, Field Issue, and Closeout using visible editable fields.

## Steps

| Step | Status | Notes |
| --- | --- | --- |
${rows}

## Acceptance Notes

- Required fields are visible in the guided workflow.
- Required fields block downstream actions until saved.
- Saved values remain visible and appear in history.
- Pilot Mode progress updates after each workflow resolves.
- This is local/demo workflow execution, not production persistence.
`;
}
