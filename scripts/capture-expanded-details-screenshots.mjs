import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const outputRoot = resolve(process.cwd(), "visual-qa-output");
const outputFolder = join(outputRoot, "expanded-details");
const manifestPath = join(outputFolder, "manifest.json");

const routes = [
  "/command-center",
  "/pilot",
  "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
  "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
  "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task",
  "/pipeline",
  "/projects",
  "/mobilization",
  "/field-execution",
  "/rfis-submittals",
  "/changes",
  "/billing",
  "/safety",
  "/quality",
  "/closeout",
  "/reports",
  "/admin"
];

const forbiddenButtonText = [
  "confirm",
  "submit",
  "delete",
  "resolve",
  "approve",
  "hold",
  "waive",
  "verify",
  "upload",
  "dismiss",
  "acknowledge",
  "mark in progress",
  "clear billing blocker",
  "open priority",
  "update operating model"
];

const allowedButtonText = [
  "details",
  "open details",
  "view details",
  "detailed records",
  "show more",
  "expand",
  "view all"
];

function slugForRoute(route) {
  return route.replace(/^\//, "").replace(/[/?#=&]/g, "-");
}

function ensureOutputFolder() {
  mkdirSync(outputFolder, { recursive: true });
  for (const entry of readdirSync(outputFolder)) {
    if (entry.endsWith(".png")) {
      rmSync(join(outputFolder, entry), { force: true });
    }
  }
}

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, { redirect: "manual" });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(
      `Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run visual:capture-expanded. ${
        error instanceof Error ? error.message : ""
      }`
    );
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run npm install and npx playwright install chromium, then run npm run visual:capture-expanded."
    );
  }
}

async function expandNativeDetails(page) {
  return page.evaluate(() => {
    const details = Array.from(document.querySelectorAll("details:not([open])"));
    for (const detail of details) {
      detail.setAttribute("open", "");
    }
    return details.length;
  });
}

async function clickSafeButtons(page) {
  return page.evaluate(({ allowedButtonText, forbiddenButtonText }) => {
    const normalized = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll(
        '[data-qa="details-toggle"], [data-qa="collapsed-details"] button, [data-qa="progressive-details"] button, [data-qa="details-drawer"] button, button[aria-expanded="false"], button'
      )
    );

    let clicked = 0;
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue;
      const text = normalized(candidate.innerText || candidate.getAttribute("aria-label") || "");
      if (!text) continue;
      const isForbidden = forbiddenButtonText.some((phrase) => text.includes(phrase));
      const isAllowed =
        candidate.getAttribute("aria-expanded") === "false" ||
        candidate.getAttribute("data-qa") === "details-toggle" ||
        allowedButtonText.some((phrase) => text.includes(phrase));

      if (isAllowed && !isForbidden) {
        candidate.click();
        clicked += 1;
      }
    }

    return clicked;
  }, { allowedButtonText, forbiddenButtonText });
}

async function expandAllDisclosures(page) {
  const attempts = [];
  for (let index = 0; index < 8; index += 1) {
    const detailsOpened = await expandNativeDetails(page);
    const buttonsClicked = await clickSafeButtons(page);
    attempts.push({ detailsOpened, buttonsClicked });
    await page.waitForTimeout(250);
    if (detailsOpened === 0 && buttonsClicked === 0) break;
  }
  return attempts;
}

ensureOutputFolder();

const manifest = {
  timestamp: new Date().toISOString(),
  baseUrl,
  viewport: {
    name: "desktop",
    width: 1440,
    height: 1100
  },
  routesAttempted: [],
  routesCaptured: [],
  screenshots: [],
  expansionAttempts: {},
  failures: []
};

try {
  await assertServerReady();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1440,
        height: 1100
      }
    });
    const page = await context.newPage();

    for (const route of routes) {
      const url = `${baseUrl}${route}`;
      const fileName = `${slugForRoute(route)}-expanded.png`;
      const filePath = join(outputFolder, fileName);
      manifest.routesAttempted.push({ route, url });

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(500);
        const attempts = await expandAllDisclosures(page);
        manifest.expansionAttempts[route] = attempts;
        await page.screenshot({ path: filePath, fullPage: true });
        manifest.routesCaptured.push({ route });
        manifest.screenshots.push(filePath);
        console.log(`Captured expanded ${route}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        manifest.failures.push({ route, message });
        console.error(`Failed expanded ${route}: ${message}`);
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  manifest.failures.push({ setup: true, message });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.error(message);
  process.exit(1);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (manifest.screenshots.length === 0) {
  console.error(`Expanded details capture produced no screenshots. See ${manifestPath}.`);
  process.exit(1);
}

if (manifest.failures.length > 0) {
  console.warn(`Expanded details capture completed with ${manifest.failures.length} failure(s). See ${manifestPath}.`);
}

console.log(`Expanded details capture complete: ${manifest.screenshots.length} screenshots. Manifest written to ${manifestPath}.`);
