import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { context, loadWork } from "../m1/implementation-context.mjs";

const base = process.env.M2_WORKSPACE_BASE_URL ?? "http://127.0.0.1:61430";
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"));
const fixture = plan.scenarios.find((scenario) => scenario.name === "rotork");
if (!fixture) throw new Error("rotork_fixture_missing");
const c = await context();
const browser = await chromium.launch({ headless: true });

try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto(`${base}/auth/sign-in?next=%2Fwork`);
  await page.getByLabel("Email", { exact: true }).fill(fixture.actors.preparer.email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/work");
  const title = `Work start ${Date.now()}`;
  await page.getByLabel("Work title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Start Work Record", exact: true }).click();
  await page.waitForURL("**/work/**");
  const match = page.url().match(/\/work\/([^/]+)\/([^/?#]+)/);
  assert(match, "work workspace URL is required");
  assert.equal(match[1], fixture.workspace);
  const owner = await c.login(fixture.actors.preparer.email);
  const loaded = await loadWork(owner, fixture, match[2]);
  assert.equal(loaded.work.title, title);
  assert.equal(loaded.work.workspace_id, fixture.workspace);
  assert.equal(loaded.work.configuration_version_id, fixture.version);
  assert.equal(loaded.proof?.id ?? null, null);
  assert.match(await page.getByText(/Proof package: not started/i).innerText(), /not started/i);
  console.log(JSON.stringify({ status: "PASS", result: "new work record inherits active workspace and pinned configuration" }, null, 2));
} finally {
  await browser.close();
}
