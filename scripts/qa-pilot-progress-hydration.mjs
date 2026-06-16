import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(process.cwd(), "visual-qa-output/pilot-progress-hydration");
const reportPath = join(artifactDir, "pilot-progress-hydration-report.json");

const failPatterns = [
  /hydration failed/i,
  /hydration mismatch/i,
  /text content did not match/i,
  /text did not match/i,
  /didn't match/i,
  /did not match/i,
  /PilotProgressSummary/i,
  /duplicate key/i,
  /encountered a script tag/i,
  /scripts inside react components/i,
  /uncaught/i
];

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const issues = [];

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
  await page.goto(`${baseUrl}/pilot`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate(() => window.localStorage.removeItem("rybexos.workflow-completion-demo-state.v1"));
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector('[data-qa="pilot-mode-page"]', { timeout: 10000 });
  await page.waitForTimeout(1500);

  await expectProgressTitle(page, /0 of 3 workflows complete/);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-qa="reset-pilot-demo-state"]').click();
  await page.waitForTimeout(250);

  const billingCard = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Add missing billing backup" }).first();
  await billingCard.locator('[data-qa="pilot-workflow-primary-cta"]').click();
  await page.waitForURL((url) =>
    url.pathname === "/billing" &&
    url.searchParams.get("focus") === "billing-billing-backup-cash-recovery" &&
    url.searchParams.get("pilot") === "1" &&
    url.hash === "#focused-task",
    { timeout: 10000 }
  );

  const guided = page.locator('[data-qa="guided-completion-flow"]').first();
  await guided.locator('[data-qa="backup-note-input"]').fill("Signed T&M ticket and supervisor backup are available for CE-004.");
  await guided.locator('[data-qa="save-backup-note"]').click();
  await guided.locator('[data-qa="billing-evidence-reference-input"]').fill("Daily Report DR-2026-06-10, photo log PL-014, signed T&M ticket T&M-077.");
  await guided.locator('[data-qa="save-billing-evidence-reference"]').click();
  await guided.getByRole("button", { name: "Mark backup attached", exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Backup attached"), null, { timeout: 5000 });
  await guided.getByRole("button", { name: "Send to review", exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Ready for review"), null, { timeout: 5000 });
  await guided.locator('[data-qa="billing-resolution-note-input"]').fill("Backup package is complete and ready for pay application review.");
  await guided.locator('[data-qa="save-billing-resolution-note"]').click();
  await guided.getByRole("button", { name: "Resolve billing blocker", exact: true }).click();
  await page.waitForSelector('[data-qa="guided-completion-complete"]', { timeout: 5000 });

  await page.locator('[data-qa="return-to-pilot-mode"]').first().click();
  await page.waitForURL((url) => url.pathname === "/pilot", { timeout: 10000 });
  await page.waitForSelector('[data-qa="pilot-mode-page"]', { timeout: 10000 });
  await page.waitForTimeout(2000);

  await expectProgressTitle(page, /1 of 3 workflows complete/);
  const completedCard = page.locator('[data-qa="pilot-workflow-card"]').filter({ hasText: "Add missing billing backup" }).first();
  await completedCard.getByText("Complete", { exact: false }).first().waitFor({ timeout: 5000 });
  await completedCard.getByText("resolved", { exact: false }).first().waitFor({ timeout: 5000 });
} finally {
  await browser.close();
}

writeFileSync(reportPath, `${JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), issues }, null, 2)}\n`);

if (issues.length > 0) {
  console.error("Pilot progress hydration QA failed:");
  for (const issue of issues) {
    console.error(`- [${issue.source}] ${issue.message}`);
  }
  console.error(`Report written to ${reportPath}`);
  process.exit(1);
}

console.log(`Pilot progress hydration QA passed. Report written to ${reportPath}.`);

async function expectProgressTitle(page, pattern) {
  const title = page.locator('[data-qa="pilot-progress-title"]').first();
  await title.waitFor({ state: "visible", timeout: 10000 });
  const text = (await title.textContent())?.trim() ?? "";
  if (!pattern.test(text)) {
    throw new Error(`Pilot progress title did not match ${pattern}. Saw: ${text}`);
  }
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
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run pilot-progress:qa. ${error instanceof Error ? error.message : ""}`);
  }
}
