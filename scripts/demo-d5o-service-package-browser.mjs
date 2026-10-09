import { readFileSync } from "node:fs";
import { chromium } from "playwright";

if (process.env.D5O_ISOLATED_PILOT !== "1" || !process.env.D5O_PILOT_CREDENTIALS_FILE)
  throw new Error("disposable_pilot_only");
const users = JSON.parse(readFileSync(process.env.D5O_PILOT_CREDENTIALS_FILE, "utf8")).users;
const pm = users.find((item) => item.key === "pm");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const base = "http://127.0.0.1:61641";
  const child = "rybex-d910a2a58a9c46038fb459436e1839c3";
  await page.goto(`${base}/auth/sign-in?next=${encodeURIComponent(`/work?workspace=rybex&view=record&section=Design&record=${child}`)}`);
  await page.locator('input[name="email"]').fill(pm.email);
  await page.locator('input[name="password"]').fill(pm.password);
  await page.getByRole("button", { name: "Continue to your work" }).click();
  await page.getByRole("heading", { name: "Receive the service execution basis" }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Packages", exact: true }).click();
  const name = "Covered monitoring inspection and alarm test";
  const body = await page.locator("body").innerText();
  if (!body.includes(name)) {
    await page.locator('input[name="package"]').fill(name);
    await page.getByRole("button", { name: "Create shared package" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).waitFor({ timeout: 30000 });
  }
  await page.reload();
  await page.getByRole("button", { name: "Packages", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(name) }).waitFor({ timeout: 30000 });
  console.log(JSON.stringify({ status: "service_package_in_shared_catalog", workId: child, packageName: name }));
  await context.close();
} finally { await browser.close(); }
