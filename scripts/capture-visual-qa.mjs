import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const outputRoot = resolve(process.cwd(), "visual-qa-output");
const manifestPath = join(outputRoot, "manifest.json");

const desktopRoutes = [
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
  "/admin",
  "/pipeline/new",
  "/projects/new",
  "/mobilization/new",
  "/field-execution/daily-report/new",
  "/rfis-submittals/rfi/new",
  "/rfis-submittals/submittal/new",
  "/changes/new",
  "/billing/pay-application/new",
  "/safety/record/new",
  "/quality/inspection/new",
  "/closeout/package/new",
  "/reports/lessons-learned/new"
];

const responsiveRoutes = [
  "/command-center",
  "/pilot",
  "/field-execution",
  "/field-execution/daily-report/new",
  "/billing",
  "/closeout",
  "/reports"
];

const viewportSets = [
  {
    name: "desktop",
    width: 1440,
    height: 1100,
    routes: desktopRoutes
  },
  {
    name: "tablet",
    width: 900,
    height: 1100,
    routes: responsiveRoutes
  },
  {
    name: "mobile",
    width: 390,
    height: 900,
    routes: responsiveRoutes
  }
];

function slugForRoute(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?#=&]/g, "__");
}

function ensureOutputFolders() {
  mkdirSync(outputRoot, { recursive: true });

  for (const viewport of viewportSets) {
    const folder = join(outputRoot, viewport.name);

    mkdirSync(folder, { recursive: true });

    for (const entry of readdirSync(folder)) {
      if (entry.endsWith(".png")) {
        rmSync(join(folder, entry), { force: true });
      }
    }
  }
}

function writeManifest(manifest) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function validateManifest(manifest) {
  const validationFailures = [];

  if (!manifest.timestamp) {
    validationFailures.push("Manifest missing timestamp.");
  }
  if (!manifest.baseUrl) {
    validationFailures.push("Manifest missing baseUrl.");
  }
  if (!Array.isArray(manifest.viewportSizes) || manifest.viewportSizes.length === 0) {
    validationFailures.push("Manifest missing viewportSizes.");
  }
  if (!Array.isArray(manifest.routesAttempted) || manifest.routesAttempted.length === 0) {
    validationFailures.push("Manifest missing routesAttempted.");
  }
  if (!Array.isArray(manifest.screenshots)) {
    validationFailures.push("Manifest missing screenshots array.");
  }
  if (!Array.isArray(manifest.failures)) {
    validationFailures.push("Manifest missing failures array.");
  }

  return validationFailures;
}

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, { redirect: "manual" });
    if (response.status >= 200 && response.status < 500) {
      return;
    }

    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(
      `Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run visual:capture. ${
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
      "Playwright is not installed in this project. Run npm install and npx playwright install chromium, then run npm run visual:capture again."
    );
  }
}

ensureOutputFolders();

const manifest = {
  timestamp: new Date().toISOString(),
  baseUrl,
  viewportSizes: viewportSets.map(({ name, width, height }) => ({ name, width, height })),
  routesAttempted: [],
  routesCaptured: [],
  screenshots: [],
  failures: []
};

try {
  await assertServerReady();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();

  try {
    for (const viewport of viewportSets) {
      const context = await browser.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height
        }
      });
      const page = await context.newPage();

      for (const route of viewport.routes) {
        const url = `${baseUrl}${route}`;
        const filePath = join(outputRoot, viewport.name, `${slugForRoute(route)}.png`);
        manifest.routesAttempted.push({ viewport: viewport.name, route, url });

        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
          await page.screenshot({ path: filePath, fullPage: true });
          manifest.routesCaptured.push({ viewport: viewport.name, route });
          manifest.screenshots.push(filePath);
          console.log(`Captured ${viewport.name} ${route}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          manifest.failures.push({ viewport: viewport.name, route, message });
          console.error(`Failed ${viewport.name} ${route}: ${message}`);
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  manifest.failures.push({ setup: true, message });
  writeManifest(manifest);
  console.error(message);
  process.exit(1);
}

writeManifest(manifest);

const manifestValidationFailures = validateManifest(manifest);

if (manifestValidationFailures.length > 0) {
  console.error(`Visual QA manifest validation failed: ${manifestValidationFailures.join(" ")}`);
  process.exit(1);
}

if (manifest.screenshots.length === 0) {
  console.error(`Visual QA capture produced no screenshots. See ${manifestPath}.`);
  process.exit(1);
}

if (manifest.failures.length > 0) {
  console.warn(`Visual QA capture completed with ${manifest.failures.length} route failure(s). See ${manifestPath}.`);
}

console.log(`Visual QA capture complete: ${manifest.screenshots.length} screenshots. Manifest written to ${manifestPath}.`);
