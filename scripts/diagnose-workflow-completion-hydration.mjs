import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/workflow-completion-qa");
const reportPath = join(artifactDir, "hydration-diagnostic.json");

if (!existsSync(artifactDir)) {
  mkdirSync(artifactDir, { recursive: true });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const events = [];

page.on("console", (message) => {
  events.push({ type: "console", level: message.type(), text: message.text() });
});

page.on("pageerror", (error) => {
  events.push({ type: "pageerror", text: error.message, stack: error.stack });
});

await page.goto(`${baseUrl}/billing?focus=billing-billing-backup-cash-recovery#focused-task`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const panel = page.locator('[data-qa="workflow-completion-panel"]').first();
const panelVisible = await panel.isVisible().catch(() => false);
const dataReady = await panel.getAttribute("data-ready").catch(() => null);
const buttons = await panel.locator("button").evaluateAll((nodes) =>
  nodes.map((node) => {
    const element = node;
    const rect = element.getBoundingClientRect();
    return {
      label: element.innerText.trim(),
      disabled: element.disabled,
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  })
).catch((error) => [{ error: error.message }]);

let clickOutcome = null;
if (panelVisible) {
  await panel.getByRole("button", { name: "Mark backup attached", exact: true }).click({ timeout: 5000 }).catch((error) => {
    clickOutcome = { clicked: false, error: error.message };
  });
  await page.waitForTimeout(400);
  const textAfterClick = await panel.innerText().catch(() => "");
  clickOutcome = clickOutcome ?? {
    clicked: true,
    stateChanged: /Backup marked attached|evidence attached/i.test(textAfterClick),
    textAfterClick: textAfterClick.slice(0, 1000)
  };
}

const ignoredDevServerEvents = events.filter((event) =>
  event.type === "console" &&
  event.level === "error" &&
  event.text.includes("/_next/webpack-hmr") &&
  event.text.includes("ERR_INVALID_HTTP_RESPONSE")
);
const blockingErrors = events.filter((event) =>
  event.type === "pageerror" ||
  (event.type === "console" &&
    event.level === "error" &&
    !event.text.includes("/_next/webpack-hmr") &&
    !event.text.includes("ERR_INVALID_HTTP_RESPONSE"))
);

const report = {
  url: page.url(),
  panelVisible,
  dataReady,
  buttons,
  clickOutcome,
  appErrors: blockingErrors,
  ignoredDevServerEvents: ignoredDevServerEvents.length,
  generatedAt: new Date().toISOString()
};

writeFileSync(reportPath, JSON.stringify(report, null, 2));
await browser.close();

if (!panelVisible || dataReady !== "true" || blockingErrors.length > 0 || clickOutcome?.stateChanged === false) {
  console.error("Workflow completion hydration diagnostic found an issue.");
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log("Workflow completion hydration diagnostic passed.");
