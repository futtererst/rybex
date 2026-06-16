import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/field-issue-completion-qa");
const reportPath = resolve(root, "docs/field-issue-completion-qa-report.md");
const resultsPath = join(artifactDir, "results.json");
const focusPath = "/field-execution?focus=field-issue-escalation#focused-task";

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run field-issue-completion:qa. ${error instanceof Error ? error.message : ""}`);
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

async function clickByQa(page, selector) {
  await page.locator(selector).first().click({ timeout: 5000 });
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
    `| ${result.name} | ${result.passed ? "Pass" : "Fail"} | ${String(result.notes).replaceAll("\n", " ")} |`
  ).join("\n");

  return `# Field Issue Completion QA Report

## Scenario

Field Issue -> RFI / Change Escalation.

## Result

${passed ? "Pass" : "Fail"}

## Steps

| Step | Status | Notes |
| --- | --- | --- |
${rows}

## Acceptance Notes

- Field Execution focused task must say "You are here to: Escalate field issue."
- User must save escalation note, control path, RFI details, control reason, and resolution note before completion.
- User can create a local/demo RFI draft from the field issue.
- Linked output record appears visibly.
- Field issue can move to controlled, then resolved.
- Result banner and local history must update.
- This proof is local/demo state only; database persistence is not claimed.
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
  await page.goto(`${baseUrl}${focusPath}`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("rybexos.workflow-completion-demo-state.v1"));
  await page.reload({ waitUntil: "networkidle" });

  const focusedTaskVisible = await visible(page, '[data-qa="focused-task-panel"]');
  const focusedText = await page.locator('[data-qa="focused-task-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Focused task visible",
    focusedTaskVisible && /You are here to/i.test(focusedText) && /Escalate field issue/i.test(focusedText),
    focusedTaskVisible ? "Focused task names the exact field issue action." : "Focused task was not visible."
  );

  requireStep(
    results,
    "Field issue completion panel visible",
    await visible(page, '[data-qa="field-issue-completion-panel"]'),
    "Completion controls are present."
  );

  await page.waitForSelector('[data-qa="field-issue-completion-panel"][data-ready="true"]', { timeout: 5000 });
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const createRfiButton = guided.getByRole("button", { name: "Create RFI from field issue", exact: true });
  await expectDisabled(createRfiButton, "Create RFI should be disabled until required fields are saved.");
  await guided.locator('[data-qa="field-escalation-note-input"]').fill("Need owner direction before the Zone B conduit route can proceed.");
  await guided.locator('[data-qa="save-field-escalation-note"]').click();
  await guided.getByText("Saved escalation note: Need owner direction before the Zone B conduit route can proceed.", { exact: false }).first().waitFor({ timeout: 5000 });
  await guided.locator('[data-qa="field-control-path-input"]').selectOption("RFI");
  await guided.locator('[data-qa="save-field-control-path"]').click();
  await guided.getByText("Saved control path: RFI", { exact: false }).first().waitFor({ timeout: 5000 });
  await guided.locator('[data-qa="rfi-draft-title-input"]').fill("RFI - Zone B conduit routing conflict");
  await guided.locator('[data-qa="save-rfi-draft-title"]').click();
  await guided.getByText("Saved RFI draft title: RFI - Zone B conduit routing conflict", { exact: false }).first().waitFor({ timeout: 5000 });
  await guided.locator('[data-qa="rfi-question-input"]').fill("Confirm revised routing direction or approve field reroute around marked utility conflict.");
  await guided.locator('[data-qa="save-rfi-question"]').click();
  await guided.getByText("Saved RFI question: Confirm revised routing direction", { exact: false }).first().waitFor({ timeout: 5000 });
  await expectEnabled(createRfiButton, "Create RFI should enable after escalation note, RFI path, title, and question are saved.");

  const initialState = await page.locator('[data-qa="field-issue-state"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Initial field issue state",
    /open|user action required/i.test(initialState),
    initialState || "No initial state text."
  );

  await createRfiButton.click();
  const rfiText = await page.locator('[data-qa="field-issue-completion-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Create RFI from field issue",
    /RFI draft created from field issue/i.test(rfiText) && /RFI draft from field issue/i.test(rfiText),
    rfiText || "No RFI result text."
  );

  const rfiState = await page.locator('[data-qa="field-issue-state"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "State changes after RFI draft",
    /rfi created|controlled/i.test(rfiState),
    rfiState || "No RFI state text."
  );

  requireStep(
    results,
    "Linked RFI output visible",
    await visible(page, '[data-qa="linked-output-record"]') &&
      /RFI draft from field issue/i.test(await page.locator('[data-qa="linked-output-record"]').first().innerText().catch(() => "")),
    "Linked RFI draft record is visible."
  );

  const controlledButton = guided.getByRole("button", { name: "Mark issue controlled", exact: true });
  await expectDisabled(controlledButton, "Mark issue controlled should be disabled until control reason is saved.");
  await guided.locator('[data-qa="field-control-reason-input"]').fill("RFI draft created and linked to the field issue for owner response.");
  await guided.locator('[data-qa="save-field-control-reason"]').click();
  await guided.getByText("Saved control reason: RFI draft created", { exact: false }).first().waitFor({ timeout: 5000 });
  await expectEnabled(controlledButton, "Mark issue controlled should enable after control reason is saved.");
  await controlledButton.click();
  const controlledText = await page.locator('[data-qa="field-issue-completion-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Mark issue controlled",
    /Field issue marked controlled/i.test(controlledText) && /controlled/i.test(await page.locator('[data-qa="field-issue-state"]').first().innerText().catch(() => "")),
    controlledText || "No controlled result text."
  );

  const resolveButton = guided.getByRole("button", { name: "Resolve field issue", exact: true });
  await expectDisabled(resolveButton, "Resolve field issue should be disabled until resolution note is saved.");
  await guided.locator('[data-qa="field-resolution-note-input"]').fill("Issue is controlled through RFI tracking and no longer unmanaged in the daily report.");
  await guided.locator('[data-qa="save-field-resolution-note"]').click();
  await guided.getByText("Saved field resolution note: Issue is controlled through RFI tracking", { exact: false }).first().waitFor({ timeout: 5000 });
  await expectEnabled(resolveButton, "Resolve field issue should enable after resolution note is saved.");
  await resolveButton.click();
  const resolvedText = await page.locator('[data-qa="field-issue-completion-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Resolve field issue",
    /Field issue resolved/i.test(resolvedText) && /resolved/i.test(await page.locator('[data-qa="field-issue-state"]').first().innerText().catch(() => "")),
    resolvedText || "No resolved result text."
  );

  const historyText = await page.locator('[data-qa="workflow-completion-history"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Completion history visible",
    /Saved escalation note/i.test(historyText) &&
      /Saved control path/i.test(historyText) &&
      /Saved RFI draft title/i.test(historyText) &&
      /Saved RFI question/i.test(historyText) &&
      /Saved control reason/i.test(historyText) &&
      /Saved field resolution note/i.test(historyText) &&
      /Create RFI from field issue/i.test(historyText) &&
      /Mark issue controlled/i.test(historyText) &&
      /Resolve field issue/i.test(historyText),
    historyText ? "Local history shows the escalation path." : "No history was visible."
  );

  const afterUrl = page.url();
  requireStep(
    results,
    "No navigation loop",
    afterUrl.includes("/field-execution") && afterUrl.includes("focus=field-issue-escalation"),
    afterUrl
  );

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  const commandCenterFieldCta = page.getByRole("link", { name: "Escalate field issue" }).first();
  const commandCenterCtaVisible = await commandCenterFieldCta.isVisible({ timeout: 1000 }).catch(() => false);
  if (commandCenterCtaVisible) {
    await commandCenterFieldCta.click();
    await page.waitForLoadState("domcontentloaded");
    requireStep(
      results,
      "Optional Command Center field priority",
      page.url().includes("/field-execution") && page.url().includes("focus=field-issue-escalation"),
      page.url()
    );
  } else {
    requireStep(results, "Optional Command Center field priority", true, "Skipped: Command Center is still focused on billing proof priority.");
  }
} finally {
  await browser.close();
}

writeFileSync(resultsPath, JSON.stringify({ baseUrl, results, generatedAt: new Date().toISOString() }, null, 2));
writeFileSync(reportPath, reportFor(results));

if (results.some((result) => !result.passed)) {
  console.error("Field issue completion QA failed:");
  for (const result of results.filter((item) => !item.passed)) {
    console.error(`- ${result.name}: ${result.notes}`);
  }
  process.exit(1);
}

console.log("Field issue completion QA passed: field issue can create an RFI draft, become controlled, and resolve in local/demo state.");
