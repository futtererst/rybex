import { readFileSync } from "node:fs";
import { chromium } from "playwright";

if (process.env.D5O_ISOLATED_PILOT !== "1" || !process.env.D5O_PILOT_CREDENTIALS_FILE)
  throw new Error("disposable_pilot_only");
const users = JSON.parse(readFileSync(process.env.D5O_PILOT_CREDENTIALS_FILE, "utf8")).users;
const quality = users.find((item) => item.key === "quality");
const origin = "http://127.0.0.1:61641";
const target = `${origin}/work?workspace=rybex&view=record&section=Deploy&record=rybex-d910a2a58a9c46038fb459436e1839c3`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/auth/sign-in?next=${encodeURIComponent(target.slice(origin.length))}`);
  await page.locator('input[name="email"]').fill(quality.email);
  await page.locator('input[name="password"]').fill(quality.password);
  await page.getByRole("button", { name: "Continue to your work" }).click();
  await page.getByRole("heading", { name: "Deliver and verify the released work" }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Field work" }).click();
  const completion = page.locator('article:has(h3:text-is("Reviewed package completion"))');
  const button = completion.getByRole("button", { name: "Record reviewed completion" });
  if (await button.count()) {
    if (await button.isDisabled()) {
      console.log(JSON.stringify({ blocker: (await completion.innerText()).slice(0, 1600) }));
      throw new Error("service_completion_still_blocked");
    }
    await completion.locator('input[name="reason"]').fill("Verified the full one-visit actual, passing retest, reviewed evidence and released scope.");
    await button.click();
    await completion.getByText(/Completion decision/).waitFor({ timeout: 30000 });
  }
  await page.reload();
  await page.getByRole("button", { name: "Field work" }).click();
  if ((await page.locator('article:has(h3:text-is("Reviewed package completion"))').innerText()).includes("Not reviewed"))
    throw new Error("service_completion_not_persisted");
  console.log(JSON.stringify({ status: "service_package_completion_independently_reviewed" }));
  await context.close();
} finally { await browser.close(); }
