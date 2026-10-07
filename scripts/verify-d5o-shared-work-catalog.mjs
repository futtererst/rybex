import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { context } from "./m1/implementation-context.mjs";

const base = process.env.D5O_BASE ?? "http://127.0.0.1:61431";
const output = resolve("artifacts/d5o-prototype-shared-work-20261004");
mkdirSync(output, { recursive: true });
const c = await context();
const browser = await chromium.launch({ headless: true });
const cases = [
  { workspace: "rybex", title: "Synthetic Shared Generator Controls Validation", package: "Generator controls site validation", day: 3 },
  { workspace: "rotork", title: "Synthetic Shared Actuator Service Validation", package: "Actuator service preparation", day: 2 }
];

async function signIn(workspace) {
  const schedule = JSON.parse(readFileSync(resolve(`.rybexos-local/d5o-shared-schedule-v1/${workspace}.json`), "utf8"));
  const publisher = schedule.publications.at(-1)?.publishedBy.id;
  assert.ok(publisher, `${workspace} has a synthetic workspace editor`);
  const profile = await c.service.from("user_profiles").select("email").eq("user_id", publisher).single();
  assert.ok(!profile.error && profile.data?.email);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/*", (route) => [base, "http://127.0.0.1:61421"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/auth/sign-in?next=%2Fwork`);
  await page.getByLabel("Email", { exact: true }).fill(profile.data.email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL("**/work", { timeout: 30000 });
  return { ctx, page, schedule };
}

async function getCatalog(page) {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/work/catalog");
    return { status: response.status, body: await response.json() };
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.canEdit, true);
  return result.body.catalog;
}

async function post(page, endpoint, payload) {
  return page.evaluate(async ({ endpoint, payload }) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }, { endpoint, payload });
}

try {
  for (const item of cases) {
    const first = await signIn(item.workspace);
    let catalog = await getCatalog(first.page);
    assert.equal(catalog.workspace, item.workspace);
    let record = catalog.records.find((entry) => entry.title === item.title);
    if (!record) {
      await first.page.getByRole("navigation", { name: "D5O operating system" }).getByRole("button", { name: "Start work" }).click();
      await first.page.getByLabel("Work name").fill(item.title);
      await first.page.getByLabel("Customer or account").fill("Synthetic qualification customer");
      await first.page.getByLabel("Site, asset or operating location").fill("Local proof site");
      await first.page.getByRole("button", { name: "Create Work Record" }).click();
      await first.page.getByRole("heading", { name: item.title }).waitFor();
      catalog = await getCatalog(first.page);
      record = catalog.records.find((entry) => entry.title === item.title);
    } else {
      await first.page.getByRole("navigation", { name: "D5O platform" }).getByRole("button", { name: "Portfolio" }).click();
      await first.page.getByLabel("Find work").fill(item.title);
      await first.page.locator(".d5o-portfolio-register").getByRole("button", { name: new RegExp(item.title) }).click();
    }
    assert.ok(record, "The new Work Record is durably cataloged");
    await first.page.getByRole("button", { name: "Design", exact: true }).click();
    await first.page.getByRole("button", { name: "Packages", exact: true }).click();
    let workPackage = catalog.packages.find((entry) => entry.workId === record.id && entry.name === item.package);
    if (!workPackage) {
      await first.page.getByLabel("New Work Package").fill(item.package);
      await first.page.getByRole("button", { name: "Create shared package" }).click();
      await first.page.getByRole("status").getByText(/Work Package is shared/).waitFor();
      catalog = await getCatalog(first.page);
      workPackage = catalog.packages.find((entry) => entry.workId === record.id && entry.name === item.package);
    }
    assert.ok(workPackage, "The new package is durably attached to the same Work Record");
    await first.page.getByRole("button", { name: new RegExp(item.package) }).waitFor();
    const date = new Date(`${first.schedule.anchorDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + item.day);
    const requiredDate = date.toISOString().slice(0, 10);
    const card = first.page.locator(".d5o-package-demand-card").filter({ hasText: item.package });
    await card.waitFor();
    const scheduleBefore = await first.page.evaluate(async () => (await (await fetch("/api/work/schedule")).json()).schedule);
    if (!scheduleBefore.packageDemands.some((entry) => entry.packageId === workPackage.id)) {
      await card.getByLabel("Required date 1").fill(requiredDate);
      await card.getByRole("button", { name: "Make schedulable" }).click();
      await first.page.getByRole("status").getByText(/required crew dates and shifts saved/).waitFor();
    }
    const scheduleAfter = await first.page.evaluate(async () => (await (await fetch("/api/work/schedule")).json()).schedule);
    assert.ok(scheduleAfter.packageDemands.some((entry) => entry.packageId === workPackage.id && entry.workId === record.id && entry.requiredSlots.some((slot) => slot.date === requiredDate)));
    await first.page.screenshot({ path: resolve(output, `${item.workspace}-shared-plan.png`), fullPage: true });

    const second = await signIn(item.workspace);
    const secondCatalog = await getCatalog(second.page);
    assert.ok(secondCatalog.records.some((entry) => entry.id === record.id), "The separate session can load the shared Work Record API");
    await second.page.getByRole("navigation", { name: "D5O platform" }).getByRole("button", { name: "Portfolio" }).click();
    await second.page.getByLabel("Find work").fill(item.title);
    await second.page.locator(".d5o-portfolio-register").getByRole("button", { name: new RegExp(item.title) }).waitFor();
    await second.page.locator(".d5o-portfolio-register").getByRole("button", { name: new RegExp(item.title) }).click();
    await second.page.getByRole("button", { name: "Design", exact: true }).click();
    await second.page.getByRole("button", { name: "Packages", exact: true }).click();
    await second.page.getByRole("button", { name: new RegExp(item.package) }).waitFor();
    await second.page.locator(".d5o-package-demand-card").filter({ hasText: item.package }).getByText("Schedulable").waitFor();
    assert.equal(await second.page.locator(".d5o-package-demand-card").filter({ hasText: item.package }).getByLabel("Required date 1").inputValue(), requiredDate);
    await second.page.getByRole("navigation", { name: "D5O platform" }).getByRole("button", { name: "Crew schedule" }).click();
    const secondSchedule = await second.page.evaluate(async () => (await (await fetch("/api/work/schedule")).json()).schedule);
    const required = secondSchedule.packageDemands.find((entry) => entry.packageId === workPackage.id);
    const assigned = secondSchedule.assignments.filter((entry) => entry.packageId === workPackage.id && entry.date === requiredDate && entry.shift === required.requiredSlots[0].shift);
    if (new Set(assigned.flatMap((entry) => entry.people)).size >= required.minimumPeople) {
      assert.ok(assigned.length, "A staffed package is retained in the separate session's shared calendar");
      await second.page.locator("#d5o-week-board").getByText(item.package, { exact: true }).waitFor();
    } else {
      await second.page.getByRole("region", { name: "Work awaiting a crew" }).getByRole("article").filter({ hasText: item.package }).waitFor();
    }
    await second.page.screenshot({ path: resolve(output, `${item.workspace}-shared-crew-queue.png`), fullPage: false });

    const stale = await post(first.page, "/api/work/catalog", { action: "create-package", expectedRevision: catalog.revision - 1, workId: record.id, name: "Stale attempt", owner: "Scheduler" });
    assert.equal(stale.status, 409, "Stale catalog writes are rejected");
    const wrongScope = await post(first.page, "/api/work/catalog", { action: "create-package", expectedRevision: (await getCatalog(first.page)).revision, workId: item.workspace === "rybex" ? "rotork-1" : "rybex-1", name: "Wrong workspace", owner: "Scheduler" });
    assert.equal(wrongScope.status, 404, "A package cannot attach to another workspace's Work Record");
    const forgedDemand = await post(first.page, "/api/work/schedule", { action: "save-demand", expectedRevision: scheduleAfter.revision, demand: { ...scheduleAfter.packageDemands.find((entry) => entry.packageId === workPackage.id), packageId: "wp-forged-package" } });
    assert.equal(forgedDemand.status, 404, "Demand requires a shared Work Package identity");
    await second.ctx.close();
    await first.ctx.close();
  }
  const anonymous = await browser.newPage();
  const unauthenticated = await anonymous.goto(`${base}/api/work/catalog`);
  assert.equal(unauthenticated.status(), 401);
  await anonymous.close();
  const crew = await browser.newContext();
  await crew.route("**/*", (route) => [base, "http://127.0.0.1:61421"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const crewPage = await crew.newPage();
  await crewPage.goto(`${base}/auth/sign-in?next=%2Fwork%2Fmy-schedule`);
  await crewPage.getByLabel("Email", { exact: true }).fill("crew-rybex-nate-walker@d5o-synthetic.local");
  await crewPage.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await crewPage.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await crewPage.waitForURL("**/work/my-schedule", { timeout: 30000 });
  const crewRead = await crewPage.evaluate(async () => (await fetch("/api/work/catalog")).status);
  assert.equal(crewRead, 403, "A crew account cannot read the scheduler's shared Work Record catalog");
  const crewWrite = await post(crewPage, "/api/work/catalog", { action: "create-package", expectedRevision: 1, workId: "rybex-1", name: "Unauthorized package", owner: "Crew" });
  assert.equal(crewWrite.status, 403, "A crew account cannot create a Work Package");
  await crew.close();
  console.log("D5O shared work catalog: creation, package ownership, dated demand, separate-session visibility, workspace and concurrency guards PASS");
} finally { await browser.close(); }
