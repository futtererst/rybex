import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/pilot-field-closeout-human-execution");
const reportPath = resolve(root, "docs/pilot-field-closeout-human-execution-qa-report.md");
const resultsPath = join(artifactDir, "results.json");

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const results = [];

try {
  await resetPilotState(page);
  await runFieldIssueHumanFlow(page, results);
  await runCloseoutHumanFlow(page, results);
  await page.screenshot({ fullPage: true, path: join(artifactDir, "pilot-field-closeout-human-execution.png") });
} finally {
  await browser.close();
}

writeFileSync(resultsPath, JSON.stringify({ baseUrl, results, generatedAt: new Date().toISOString() }, null, 2));
writeFileSync(reportPath, buildReport(results), "utf8");

const failed = results.filter((result) => !result.passed);
if (failed.length > 0) {
  console.error("Pilot Field/Closeout human execution QA failed:");
  for (const result of failed) console.error(`- ${result.name}: ${result.notes}`);
  process.exit(1);
}

console.log("Pilot Field/Closeout human execution QA passed.");

async function runFieldIssueHumanFlow(page, results) {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  const card = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Escalate field issue" }).first();
  await card.locator('[data-qa="pilot-workflow-primary-cta"]').click();
  await page.waitForURL((url) =>
    url.pathname === "/field-execution" &&
    url.searchParams.get("focus") === "field-issue-escalation" &&
    url.searchParams.get("pilot") === "1" &&
    url.hash === "#focused-task",
    { timeout: 10000 }
  );

  const panel = page.locator('[data-qa="field-issue-completion-panel"]').first();
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await guided.waitFor({ state: "visible", timeout: 10000 });
  await guided.getByText("Escalate field issue", { exact: false }).first().waitFor({ timeout: 5000 });
  await guided.getByText("Choose the control path for this field issue.", { exact: false }).first().waitFor({ timeout: 5000 });
  requireStep(results, "Field guided flow visible", true, "Field issue guided flow is above details.");

  const escalationNote = "Need owner clarification on Zone B conduit routing and cost protection if route changes.";
  const createRfi = guided.getByRole("button", { name: "Create RFI from field issue", exact: true });
  if (!(await createRfi.isDisabled())) throw new Error("Create RFI should wait for saved field issue inputs.");
  await guided.locator('[data-qa="field-escalation-note-input"]').fill(escalationNote);
  const saveNote = guided.locator('[data-qa="save-field-escalation-note"]');
  await expectEnabled(saveNote, "Save escalation note should become enabled after typing.");
  await saveNote.click();
  await guided.getByText(`Saved escalation note: ${escalationNote}`, { exact: false }).waitFor({ timeout: 5000 });
  requireStep(results, "Field escalation note saved visibly", true, escalationNote);
  await guided.locator('[data-qa="field-control-path-input"]').selectOption("RFI");
  await guided.locator('[data-qa="save-field-control-path"]').click();
  await guided.getByText("Saved control path: RFI", { exact: false }).waitFor({ timeout: 5000 });
  await guided.locator('[data-qa="rfi-draft-title-input"]').fill("RFI - Zone B conduit routing conflict");
  await guided.locator('[data-qa="save-rfi-draft-title"]').click();
  await guided.getByText("Saved RFI draft title: RFI - Zone B conduit routing conflict", { exact: false }).waitFor({ timeout: 5000 });
  await guided.locator('[data-qa="rfi-question-input"]').fill("Confirm revised routing direction or approve field reroute around marked utility conflict.");
  await guided.locator('[data-qa="save-rfi-question"]').click();
  await guided.getByText("Saved RFI question: Confirm revised routing direction", { exact: false }).waitFor({ timeout: 5000 });

  await expectEnabled(createRfi, "Create RFI should be enabled after note save.");
  await createRfi.click();
  await panel.getByText("RFI draft created from field issue", { exact: false }).first().waitFor({ timeout: 5000 });
  await panel.getByText("RFI draft from field issue", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.locator('[data-qa="field-issue-state"]').first().getByText(/rfi created/i).waitFor({ timeout: 5000 });
  requireStep(results, "Field RFI output visible", true, "RFI draft appears and state changes.");

  const controlled = guided.getByRole("button", { name: "Mark issue controlled", exact: true });
  await expectDisabled(controlled, "Mark issue controlled should wait for control reason.");
  await guided.locator('[data-qa="field-control-reason-input"]').fill("RFI draft created and linked to the field issue for owner response.");
  await guided.locator('[data-qa="save-field-control-reason"]').click();
  await guided.getByText("Saved control reason: RFI draft created", { exact: false }).waitFor({ timeout: 5000 });
  await expectEnabled(controlled, "Mark issue controlled should enable after linked output and control reason exist.");
  await controlled.click();
  await panel.getByText("Field issue marked controlled", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.locator('[data-qa="field-issue-state"]').first().getByText(/controlled/i).waitFor({ timeout: 5000 });
  requireStep(results, "Field issue controlled", true, "State changes to controlled.");

  const resolve = guided.getByRole("button", { name: "Resolve field issue", exact: true });
  await expectDisabled(resolve, "Resolve field issue should wait for resolution note.");
  await guided.locator('[data-qa="field-resolution-note-input"]').fill("Issue is controlled through RFI tracking and no longer unmanaged in the daily report.");
  await guided.locator('[data-qa="save-field-resolution-note"]').click();
  await guided.getByText("Saved field resolution note: Issue is controlled", { exact: false }).waitFor({ timeout: 5000 });
  await expectEnabled(resolve, "Resolve field issue should enable after controlled and resolution note.");
  await resolve.click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await guided.getByText("Field issue resolved", { exact: false }).first().waitFor({ timeout: 5000 });

  const historyText = await panel.locator('[data-qa="workflow-completion-history"]').innerText();
  requireStep(
    results,
    "Field history includes note and actions",
    historyText.includes("Saved escalation note") &&
      historyText.includes("Saved control path") &&
      historyText.includes("Saved RFI draft title") &&
      historyText.includes("Saved RFI question") &&
      historyText.includes("Saved control reason") &&
      historyText.includes("Saved field resolution note") &&
      historyText.includes("Create RFI from field issue") &&
      historyText.includes("Mark issue controlled") &&
      historyText.includes("Resolve field issue"),
    historyText
  );

  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
  const completedCard = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Escalate field issue" }).first();
  await completedCard.getByText("Complete", { exact: false }).first().waitFor({ timeout: 5000 });
  await completedCard.getByText("resolved", { exact: false }).first().waitFor({ timeout: 5000 });
  requireStep(results, "Field Pilot progress updates", true, "Field card shows complete/resolved.");
}

async function runCloseoutHumanFlow(page, results) {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  const card = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Complete closeout requirement" }).first();
  await card.locator('[data-qa="pilot-workflow-primary-cta"]').click();
  await page.waitForURL((url) =>
    url.pathname === "/closeout" &&
    url.searchParams.get("focus") === "closeout-requirement-final-billing-release" &&
    url.searchParams.get("pilot") === "1" &&
    url.hash === "#focused-task",
    { timeout: 10000 }
  );

  const panel = page.locator('[data-qa="closeout-completion-panel"]').first();
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await guided.waitFor({ state: "visible", timeout: 10000 });
  await guided.getByText("Complete closeout requirement", { exact: false }).first().waitFor({ timeout: 5000 });
  await guided.getByText("Satisfy this closeout item so acceptance and final billing can move.", { exact: false }).first().waitFor({ timeout: 5000 });
  requireStep(results, "Closeout guided flow visible", true, "Closeout guided flow is above details.");

  const closeoutNote = "As-built redline package is attached in the closeout folder for Segment A.";
  const attach = guided.getByRole("button", { name: "Mark closeout evidence attached", exact: true });
  if (!(await attach.isDisabled())) throw new Error("Mark closeout evidence attached should wait for saved closeout inputs.");
  await guided.locator('[data-qa="closeout-evidence-note-input"]').fill(closeoutNote);
  const saveNote = guided.locator('[data-qa="save-closeout-evidence-note"]');
  await expectEnabled(saveNote, "Save closeout note should become enabled after typing.");
  await saveNote.click();
  await guided.getByText(`Saved closeout evidence note: ${closeoutNote}`, { exact: false }).waitFor({ timeout: 5000 });
  requireStep(results, "Closeout evidence note saved visibly", true, closeoutNote);
  await guided.locator('[data-qa="closeout-evidence-reference-input"]').fill("Closeout Package CP-001, Section 04 - As-builts, file ASB-FB-A-Rev2.pdf.");
  await guided.locator('[data-qa="save-closeout-evidence-reference"]').click();
  await guided.getByText("Saved closeout evidence reference: Closeout Package CP-001", { exact: false }).waitFor({ timeout: 5000 });

  await expectEnabled(attach, "Mark closeout evidence attached should enable after note and reference save.");
  await attach.click();
  await panel.getByText("Closeout evidence marked attached", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.locator('[data-qa="closeout-state"]').first().getByText(/evidence attached/i).waitFor({ timeout: 5000 });
  requireStep(results, "Closeout evidence attached", true, "Evidence status and completion state changed.");

  const review = guided.getByRole("button", { name: "Send closeout item to review", exact: true });
  await expectEnabled(review, "Send closeout item to review should enable after evidence attached.");
  await review.click();
  await panel.getByText("Closeout item sent to review", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.locator('[data-qa="closeout-state"]').first().getByText(/ready for review/i).waitFor({ timeout: 5000 });
  await panel.getByText("Closeout package item ready for review", { exact: false }).first().waitFor({ timeout: 5000 });
  requireStep(results, "Closeout review output visible", true, "Closeout package update appears.");

  const resolve = guided.getByRole("button", { name: "Resolve closeout blocker", exact: true });
  await expectDisabled(resolve, "Resolve closeout blocker should wait for acceptance note.");
  await guided.locator('[data-qa="closeout-acceptance-note-input"]').fill("Required as-built documentation is complete and ready for final billing/acceptance review.");
  await guided.locator('[data-qa="save-closeout-acceptance-note"]').click();
  await guided.getByText("Saved acceptance note: Required as-built documentation", { exact: false }).waitFor({ timeout: 5000 });
  await expectEnabled(resolve, "Resolve closeout blocker should enable after acceptance note.");
  await resolve.click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await guided.getByText("Closeout blocker resolved", { exact: false }).first().waitFor({ timeout: 5000 });

  const historyText = await panel.locator('[data-qa="workflow-completion-history"]').innerText();
  requireStep(
    results,
    "Closeout history includes note and actions",
    historyText.includes("Saved closeout evidence note") &&
      historyText.includes("Saved closeout evidence reference") &&
      historyText.includes("Saved acceptance note") &&
      historyText.includes("Mark closeout evidence attached") &&
      historyText.includes("Send closeout item to review") &&
      historyText.includes("Resolve closeout blocker"),
    historyText
  );

  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
  const completedCard = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Complete closeout requirement" }).first();
  await completedCard.getByText("Complete", { exact: false }).first().waitFor({ timeout: 5000 });
  await completedCard.getByText("resolved", { exact: false }).first().waitFor({ timeout: 5000 });
  requireStep(results, "Closeout Pilot progress updates", true, "Closeout card shows complete/resolved.");
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
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run pilot-field-closeout:qa. ${error instanceof Error ? error.message : ""}`);
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

function requireStep(results, name, passed, notes) {
  results.push({ name, passed, notes: String(notes).replaceAll("\n", " ") });
}

function buildReport(results) {
  const passed = results.every((result) => result.passed);
  const rows = results.map((result) => `| ${result.name} | ${result.passed ? "Pass" : "Fail"} | ${result.notes} |`).join("\n");

  return `# Pilot Field / Closeout Human Execution QA Report

## Result

${passed ? "Pass" : "Fail"}

## Scope

- Field Issue -> RFI / Change Escalation from Pilot Mode.
- Closeout Requirement -> Acceptance / Final Billing Release from Pilot Mode.

## Steps

| Step | Status | Notes |
| --- | --- | --- |
${rows}

## Acceptance Notes

- Guided flows must be visible without opening details.
- Editable notes must save and remain visible.
- State, linked outputs, history, and result banners must update.
- Returning to Pilot Mode must show each workflow complete/resolved.
`;
}
