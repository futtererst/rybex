import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/closeout-completion-qa");
const reportPath = resolve(root, "docs/closeout-completion-qa-report.md");
const resultsPath = join(artifactDir, "results.json");
const focusPath = "/closeout?focus=closeout-requirement-final-billing-release#focused-task";

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run closeout-completion:qa. ${error instanceof Error ? error.message : ""}`);
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

  return `# Closeout Completion QA Report

## Scenario

Closeout Requirement -> Acceptance / Final Billing Release.

## Result

${passed ? "Pass" : "Fail"}

## Steps

| Step | Status | Notes |
| --- | --- | --- |
${rows}

## Acceptance Notes

- Closeout focused task must say "You are here to: Complete closeout requirement."
- User must save closeout evidence note, evidence reference, and acceptance note before completion.
- User can mark closeout evidence attached in local/demo state.
- User can send the closeout item to review.
- User can resolve the closeout blocker.
- Linked closeout/final billing output records, result banner, and local history must update.
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
    focusedTaskVisible && /You are here to/i.test(focusedText) && /Complete closeout requirement/i.test(focusedText),
    focusedTaskVisible ? "Focused task names the exact closeout action." : "Focused task was not visible."
  );

  requireStep(
    results,
    "Closeout completion panel visible",
    await visible(page, '[data-qa="closeout-completion-panel"]'),
    "Completion controls are present."
  );

  await page.waitForSelector('[data-qa="closeout-completion-panel"][data-ready="true"]', { timeout: 5000 });
  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  const attachButton = guided.getByRole("button", { name: "Mark closeout evidence attached", exact: true });
  await expectDisabled(attachButton, "Mark closeout evidence attached should be disabled until evidence note and reference are saved.");
  await guided.locator('[data-qa="closeout-evidence-note-input"]').fill("As-built redline package is attached in the Segment A closeout folder.");
  await guided.locator('[data-qa="save-closeout-evidence-note"]').click();
  await guided.getByText("Saved closeout evidence note: As-built redline package is attached", { exact: false }).first().waitFor({ timeout: 5000 });
  await expectDisabled(attachButton, "Mark closeout evidence attached should remain disabled until evidence reference is saved.");
  await guided.locator('[data-qa="closeout-evidence-reference-input"]').fill("Closeout Package CP-001, Section 04 - As-builts, file ASB-FB-A-Rev2.pdf.");
  await guided.locator('[data-qa="save-closeout-evidence-reference"]').click();
  await guided.getByText("Saved closeout evidence reference: Closeout Package CP-001", { exact: false }).first().waitFor({ timeout: 5000 });
  await expectEnabled(attachButton, "Mark closeout evidence attached should enable after note and reference are saved.");

  const initialState = await page.locator('[data-qa="closeout-state"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Initial closeout state",
    /waiting on evidence/i.test(initialState),
    initialState || "No initial state text."
  );

  await attachButton.click();
  const attachedText = await page.locator('[data-qa="closeout-completion-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Mark closeout evidence attached",
    /Closeout evidence marked attached/i.test(attachedText) &&
      /evidence attached/i.test(await page.locator('[data-qa="closeout-state"]').first().innerText().catch(() => "")) &&
      /uploaded/i.test(await page.locator('[data-qa="evidence-status"]').first().innerText().catch(() => "")),
    attachedText || "No attached result text."
  );

  await clickByQa(page, '[data-qa="send-closeout-item-to-review"]');
  const reviewText = await page.locator('[data-qa="closeout-completion-panel"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Send closeout item to review",
    /Closeout item sent to review/i.test(reviewText) &&
      /ready for review/i.test(await page.locator('[data-qa="closeout-state"]').first().innerText().catch(() => "")),
    reviewText || "No review result text."
  );

  requireStep(
    results,
    "Linked closeout output visible",
    await visible(page, '[data-qa="closeout-linked-output-record"]') &&
      /Closeout package item ready for review/i.test(await page.locator('[data-qa="closeout-linked-output-record"]').first().innerText().catch(() => "")),
    "Linked closeout package update is visible."
  );

  const resolveButton = guided.getByRole("button", { name: "Resolve closeout blocker", exact: true });
  await expectDisabled(resolveButton, "Resolve closeout blocker should be disabled until acceptance note is saved.");
  await guided.locator('[data-qa="closeout-acceptance-note-input"]').fill("Required as-built documentation is complete and ready for final billing/acceptance review.");
  await guided.locator('[data-qa="save-closeout-acceptance-note"]').click();
  await guided.getByText("Saved acceptance note: Required as-built documentation", { exact: false }).first().waitFor({ timeout: 5000 });
  await expectEnabled(resolveButton, "Resolve closeout blocker should enable after acceptance note is saved.");
  await resolveButton.click();
  const resolvedText = await page.locator('[data-qa="closeout-completion-panel"]').first().innerText().catch(() => "");
  const linkedOutputText = await page.locator('[data-qa="closeout-linked-output-record"]').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent ?? "").join(" ")
  ).catch(() => "");
  requireStep(
    results,
    "Resolve closeout blocker",
    /Closeout blocker resolved/i.test(resolvedText) &&
      /resolved/i.test(await page.locator('[data-qa="closeout-state"]').first().innerText().catch(() => "")) &&
      /Final billing release note/i.test(linkedOutputText),
    resolvedText || "No resolved result text."
  );

  const historyText = await page.locator('[data-qa="workflow-completion-history"]').first().innerText().catch(() => "");
  requireStep(
    results,
    "Completion history visible",
    /Saved closeout evidence note/i.test(historyText) &&
      /Saved closeout evidence reference/i.test(historyText) &&
      /Saved acceptance note/i.test(historyText) &&
      /Mark closeout evidence attached/i.test(historyText) &&
      /Send closeout item to review/i.test(historyText) &&
      /Resolve closeout blocker/i.test(historyText),
    historyText ? "Local history shows the closeout completion path." : "No history was visible."
  );

  const afterUrl = page.url();
  requireStep(
    results,
    "No navigation loop",
    afterUrl.includes("/closeout") && afterUrl.includes("focus=closeout-requirement-final-billing-release"),
    afterUrl
  );

  await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
  const commandCenterCloseoutCta = page.getByRole("link", { name: "Complete closeout requirement" }).first();
  const commandCenterCtaVisible = await commandCenterCloseoutCta.isVisible({ timeout: 1000 }).catch(() => false);
  if (commandCenterCtaVisible) {
    await commandCenterCloseoutCta.click();
    await page.waitForLoadState("domcontentloaded");
    requireStep(
      results,
      "Optional Command Center closeout priority",
      page.url().includes("/closeout") && page.url().includes("focus=closeout-requirement-final-billing-release"),
      page.url()
    );
  } else {
    requireStep(results, "Optional Command Center closeout priority", true, "Skipped: Command Center is still focused on billing proof priority.");
  }
} finally {
  await browser.close();
}

writeFileSync(resultsPath, JSON.stringify({ baseUrl, results, generatedAt: new Date().toISOString() }, null, 2));
writeFileSync(reportPath, reportFor(results));

if (results.some((result) => !result.passed)) {
  console.error("Closeout completion QA failed:");
  for (const result of results.filter((item) => !item.passed)) {
    console.error(`- ${result.name}: ${result.notes}`);
  }
  process.exit(1);
}

console.log("Closeout completion QA passed: closeout evidence can be attached, reviewed, and resolved in local/demo state.");
