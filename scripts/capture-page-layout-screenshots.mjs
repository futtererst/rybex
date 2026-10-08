import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const outputRoot = resolve(root, "visual-qa-output/page-layout");
const baseUrl = process.env.BASE_URL ?? "http://localhost:3217";

const captures = [
  { name: "desktop/billing.png", route: "/billing", width: 1440, height: 1100 },
  { name: "mobile/billing.png", route: "/billing", width: 390, height: 900 },
  { name: "desktop/command-center.png", route: "/command-center", width: 1440, height: 1100 },
  { name: "mobile/command-center.png", route: "/command-center", width: 390, height: 900 },
  { name: "desktop/rfis-submittals.png", route: "/rfis-submittals", width: 1440, height: 1100 },
  { name: "desktop/changes.png", route: "/changes", width: 1440, height: 1100 },
  { name: "desktop/field-execution.png", route: "/field-execution", width: 1440, height: 1100 },
  { name: "mobile/field-execution.png", route: "/field-execution", width: 390, height: 900 },
  { name: "desktop/closeout.png", route: "/closeout", width: 1440, height: 1100 },
  { name: "mobile/closeout.png", route: "/closeout", width: 390, height: 900 }
];

await mkdir(join(outputRoot, "desktop"), { recursive: true });
await mkdir(join(outputRoot, "mobile"), { recursive: true });

const browser = await chromium.launch({ headless: true });
const screenshots = [];

try {
  for (const capture of captures) {
    const page = await browser.newPage({
      viewport: {
        width: capture.width,
        height: capture.height
      }
    });
    const url = `${baseUrl}${capture.route}`;
    const filePath = join(outputRoot, capture.name);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await page.screenshot({ path: filePath, fullPage: true });
    screenshots.push({ route: capture.route, filePath });
    await page.close();
    console.log(`Captured ${capture.name}`);
  }
} finally {
  await browser.close();
}

await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify({
  timestamp: new Date().toISOString(),
  baseUrl,
  screenshots
}, null, 2)}\n`);

console.log(`Page layout screenshots captured: ${screenshots.length}`);
