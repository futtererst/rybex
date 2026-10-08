import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const events = [];

page.on("console", (message) => events.push({ type: "console", level: message.type(), text: message.text() }));
page.on("pageerror", (error) => events.push({ type: "pageerror", text: error.message, stack: error.stack }));

await page.goto("http://127.0.0.1:3000/billing?focus=billing-billing-backup-cash-recovery#focused-task", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const dataReady = await page.locator('[data-qa="workflow-completion-panel"]').first().getAttribute("data-ready").catch((error) => `missing: ${error.message}`);
const panelText = await page.locator('[data-qa="workflow-completion-panel"]').first().innerText().catch((error) => `missing: ${error.message}`);

console.log(JSON.stringify({
  dataReady,
  panelText: panelText.slice(0, 800),
  events
}, null, 2));

await browser.close();
