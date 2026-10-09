import { readFileSync } from "node:fs";
import { chromium } from "playwright";

if (process.env.D5O_ISOLATED_PILOT !== "1" || !process.env.D5O_PILOT_CREDENTIALS_FILE)
  throw new Error("disposable_pilot_only");
const users = JSON.parse(readFileSync(process.env.D5O_PILOT_CREDENTIALS_FILE, "utf8")).users;
const origin = "http://127.0.0.1:61641";
const target = `${origin}/work?workspace=rybex&view=record&section=Operate&record=rybex-a8fd95e7e20d4bb3881c3549459c99e0`;
const jobId = "9db34eeb-71e3-4d13-a3fe-68796189a419";
const browser = await chromium.launch({ headless: true });
async function signIn(key) {
  const user = users.find((item) => item.key === key);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/auth/sign-in?next=${encodeURIComponent(target.slice(origin.length))}`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole("button", { name: "Continue to your work" }).click();
  await page.getByRole("button", { name: "Requests & jobs", exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Requests & jobs", exact: true }).click();
  return { context, page };
}
try {
  const quality = await signIn("quality");
  const job = quality.page.locator(`article:has-text("${jobId.slice(0, 8)}")`).filter({ has: quality.page.getByRole("button", { name: "Link reviewed execution" }) });
  const link = quality.page.getByRole("button", { name: "Link reviewed execution" });
  if (await link.count()) {
    await link.click();
    await quality.page.getByText(/Execution linked/).waitFor({ timeout: 10000 });
  }
  await quality.context.close();

  const operations = await signIn("operations");
  const completion = operations.page.locator('form:has(button:has-text("Complete service job"))');
  if (await completion.count()) {
    await completion.locator('input[name="note"]').fill("Independently reviewed the accepted service completion and linked report evidence.");
    await completion.getByRole("button", { name: "Complete service job" }).click();
    await operations.page.getByText(/Completed/).waitFor({ timeout: 30000 });
  }
  await operations.context.close();

  const pm = await signIn("pm");
  const request = pm.page.locator('article:has(b:has-text("Synthetic covered monitoring inspection"))');
  const resolution = request.locator('form:has(button:has-text("Record reviewed resolution"))');
  if (await resolution.count()) {
    await resolution.locator('input[name="resolution"]').fill("The monitored panel and alarm inputs were inspected, corrected and verified in the completed service visit.");
    await resolution.locator('input[name="reviewSource"]').fill("SYNTHETIC PILOT reviewed service report and passing retest");
    await resolution.getByRole("button", { name: "Record reviewed resolution" }).click();
    await request.getByText(/Resolved/).waitFor({ timeout: 30000 });
  }
  await pm.context.close();

  const closer = await signIn("operations");
  const closedRequest = closer.page.locator('article:has(b:has-text("Synthetic covered monitoring inspection"))');
  const close = closedRequest.locator('form:has(button:has-text("Close reviewed request"))');
  if (await close.count()) {
    await close.locator('input[name="note"]').fill("Operations independently closes the resolved synthetic service request after asset history review.");
    await close.getByRole("button", { name: "Close reviewed request" }).click();
    await closedRequest.getByText(/Closed/).waitFor({ timeout: 30000 });
  }
  await closer.page.reload();
  await closer.page.getByRole("button", { name: "Requests & jobs", exact: true }).click();
  if (!(await closer.page.locator("body").innerText()).includes("Synthetic covered monitoring inspection · Closed"))
    throw new Error("service_request_close_not_persisted");
  console.log(JSON.stringify({ status: "service_job_completed_request_closed", jobId }));
  await closer.context.close();
} finally { await browser.close(); }
