import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(process.cwd(), "visual-qa-output/workflow-state-architecture");
const reportPath = join(artifactDir, "workflow-state-architecture-report.json");
const storageKey = "rybexos.workflow-completion-demo-state.v1";

const failPatterns = [
  /hydration failed/i,
  /hydration mismatch/i,
  /text content did not match/i,
  /text did not match/i,
  /duplicate key/i,
  /unique "key"/i,
  /encountered a script tag/i,
  /scripts inside react components/i,
  /getSnapshot should be cached/i,
  /maximum update depth exceeded/i,
  /workflow-completion-dom-bridge/i,
  /uncaught/i
];

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const issues = [];
const steps = [];

page.on("console", (message) => {
  if (!["warning", "error"].includes(message.type())) return;
  const text = message.text();
  if (failPatterns.some((pattern) => pattern.test(text))) {
    issues.push({ source: `console:${message.type()}`, message: text });
  }
});

page.on("pageerror", (error) => {
  issues.push({ source: "pageerror", message: error.message });
});

try {
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "networkidle" });
  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
  await page.reload({ waitUntil: "networkidle" });
  await expectProgressTitle(page, /0 of 3 workflows complete/);
  steps.push("Initial deterministic Pilot progress rendered.");

  await runBilling(page);
  await expectProgressTitle(page, /1 of 3 workflows complete/);
  steps.push("Billing completed and Pilot progress updated.");

  await runField(page);
  await expectProgressTitle(page, /2 of 3 workflows complete/);
  steps.push("Field issue completed and Pilot progress updated.");

  await runCloseout(page);
  await expectProgressTitle(page, /3 of 3 workflows complete/);
  steps.push("Closeout completed and Pilot progress updated.");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await expectProgressTitle(page, /3 of 3 workflows complete/);
  steps.push("Reload safely rehydrated local/demo state.");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-qa="reset-pilot-demo-state"]').click();
  await expectProgressTitle(page, /0 of 3 workflows complete/);
  steps.push("Pilot reset restored deterministic defaults.");
} finally {
  await browser.close();
}

writeFileSync(reportPath, `${JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), issues, steps }, null, 2)}\n`);

if (issues.length > 0) {
  console.error("Workflow state architecture QA failed:");
  for (const issue of issues) console.error(`- [${issue.source}] ${issue.message}`);
  console.error(`Report written to ${reportPath}`);
  process.exit(1);
}

console.log(`Workflow state architecture QA passed. Report written to ${reportPath}.`);

async function runBilling(page) {
  await openPilotWorkflow(page, "Add missing billing backup", "/billing", "billing-billing-backup-cash-recovery");
  await completeBillingV2GuidedWorkflow(page);
  await returnToPilot(page);
}

async function runField(page) {
  await openPilotWorkflow(page, "Escalate field issue", "/field-execution", "field-issue-escalation");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await fillAndSave(guided, "field-escalation-note-input", "save-field-escalation-note", "Conduit route in Zone B conflicts with marked utility path and requires owner direction before continuing.");
  await guided.locator('[data-qa="field-control-path-input"]').selectOption("RFI");
  await guided.locator('[data-qa="save-field-control-path"]').click();
  await guided.getByText("Saved control path: RFI", { exact: false }).waitFor({ timeout: 5000 });
  await fillAndSave(guided, "rfi-draft-title-input", "save-rfi-draft-title", "RFI - Zone B conduit routing conflict");
  await fillAndSave(guided, "rfi-question-input", "save-rfi-question", "Confirm revised routing direction or approve field reroute around marked utility conflict.");
  await guided.getByRole("button", { name: "Create RFI from field issue", exact: true }).click();
  await page.getByText("RFI draft created from field issue", { exact: false }).first().waitFor({ timeout: 5000 });
  await fillAndSave(guided, "field-control-reason-input", "save-field-control-reason", "RFI draft created and linked to the field issue for owner response.");
  await guided.getByRole("button", { name: "Mark issue controlled", exact: true }).click();
  await fillAndSave(guided, "field-resolution-note-input", "save-field-resolution-note", "Issue is controlled through RFI tracking and no longer unmanaged in the daily report.");
  await guided.getByRole("button", { name: "Resolve field issue", exact: true }).click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await returnToPilot(page);
}

async function runCloseout(page) {
  await openPilotWorkflow(page, "Complete closeout requirement", "/closeout", "closeout-requirement-final-billing-release");
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await fillAndSave(guided, "closeout-evidence-note-input", "save-closeout-evidence-note", "As-built redlines for Fiber Backbone Segment A are complete and included in the closeout package.");
  await fillAndSave(guided, "closeout-evidence-reference-input", "save-closeout-evidence-reference", "Closeout Package CP-001, Section 04 - As-builts, file ASB-FB-A-Rev2.pdf.");
  await guided.getByRole("button", { name: "Mark closeout evidence attached", exact: true }).click();
  await guided.getByRole("button", { name: "Send closeout item to review", exact: true }).click();
  await fillAndSave(guided, "closeout-acceptance-note-input", "save-closeout-acceptance-note", "Required as-built documentation is complete and ready for final billing/acceptance review.");
  await guided.getByRole("button", { name: "Resolve closeout blocker", exact: true }).click();
  await guided.locator('[data-qa="guided-completion-complete"]').waitFor({ state: "visible", timeout: 5000 });
  await returnToPilot(page);
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
    await card.locator(`[data-qa="billing-v2-add-reference-${evidenceId}"]`).fill(`Workflow state QA reference for ${evidenceId}.`);
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

async function fillAndSave(scope, inputQa, saveQa, value) {
  await scope.locator(`[data-qa="${inputQa}"]`).fill(value);
  await scope.locator(`[data-qa="${saveQa}"]`).click();
  await scope.getByText(value, { exact: false }).first().waitFor({ timeout: 5000 });
}

async function returnToPilot(page) {
  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
  await page.locator('[data-qa="pilot-progress-summary"]').waitFor({ state: "visible", timeout: 10000 });
}

async function expectProgressTitle(page, pattern) {
  const title = page.locator('[data-qa="pilot-progress-title"]').first();
  await title.waitFor({ state: "visible", timeout: 10000 });
  const text = (await title.textContent())?.trim() ?? "";
  if (!pattern.test(text)) throw new Error(`Pilot progress title did not match ${pattern}. Saw: ${text}`);
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
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run workflow-state:qa. ${error instanceof Error ? error.message : ""}`);
  }
}
