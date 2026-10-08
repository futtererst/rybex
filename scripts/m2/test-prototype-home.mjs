import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { context } from "../m1/implementation-context.mjs";

const base = process.env.M2_WORKSPACE_BASE_URL ?? "http://127.0.0.1:61430";
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"));
const c = await context();
const browser = await chromium.launch({ headless: true });
const results = [];

async function signIn(fixture, role) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto(`${base}/auth/sign-in?next=%2Fwork`);
  await page.getByLabel("Email", { exact: true }).fill(fixture.actors[role].email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/work");
  return page;
}

try {
  const [rybex, rotork] = plan.scenarios;
  const cases = [
    [rybex, "quality_verifier", "Rybex work", "Certification and turnover"],
    [rotork, "pilot_reviewer", "Rotork work", "Pilot-to-rollout authorization"]
  ];

  for (const [fixture, role, portfolioName, gateName] of cases) {
    const page = await signIn(fixture, role);
    await page.getByRole("heading", { name: portfolioName, exact: true }).waitFor();
    assert.match(await page.getByRole("region", { name: "D5O workspace" }).innerText(), new RegExp(fixture.name, "i"));
    assert.match(await page.getByLabel("Active workspace", { exact: true }).innerText(), new RegExp(`${fixture.name} workspace`, "i"));
    assert.match(await page.getByRole("region", { name: "Workspace guide" }).innerText(), /How this workspace works/i);
    assert.match(await page.getByRole("region", { name: "Workspace guide" }).innerText(), /why this page/i);
    assert((await page.getByRole("link", { name: "Open Work Record", exact: true }).count()) >= 1);
    assert.match(await page.locator("#portfolio").innerText(), new RegExp(gateName, "i"));
    assert.equal(await page.locator("#portfolio").getByText(fixture.name === "rybex" ? "Rotork" : "Rybex", { exact: false }).count(), 0);
    const lifecycle = page.locator('#portfolio select[name="state"]');
    const lifecycleValues = await lifecycle.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    assert(lifecycleValues.length > 0, "The scoped queue must expose at least one lifecycle filter value.");
    await lifecycle.selectOption(lifecycleValues[0]);
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/work" && url.searchParams.get("state") === lifecycleValues[0]);
    assert.equal(await lifecycle.inputValue(), lifecycleValues[0]);
    assert.match(await page.locator("#portfolio").innerText(), /scoped Work Record/i);
    await page.getByRole("link", { name: "Clear", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/work" && url.search === "");
    const workType = page.locator('#portfolio select[name="workType"]');
    const workTypeValues = await workType.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    assert(workTypeValues.length > 0, "The scoped queue must expose at least one Work Type filter value.");
    await workType.selectOption(workTypeValues[0]);
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/work" && url.searchParams.get("workType") === workTypeValues[0]);
    assert.equal(await workType.inputValue(), workTypeValues[0]);
    await page.getByRole("link", { name: "Clear", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/work" && url.search === "");
    const owner = page.locator('#portfolio select[name="owner"]');
    const ownerValues = await owner.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    assert(ownerValues.length > 0, "The scoped queue must expose at least one configured decision owner.");
    const currentMyWork = await page.locator("#my-work").innerText();
    const activeOwner = ownerValues.find((candidate) => currentMyWork.toLocaleLowerCase().includes(candidate.toLocaleLowerCase()));
    assert(activeOwner, "The active role must have at least one configured decision-owner filter value.");
    await owner.selectOption(activeOwner);
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/work" && url.searchParams.get("owner") === activeOwner);
    assert.equal(await owner.inputValue(), activeOwner);
    const filteredMyWork = await page.locator("#my-work").innerText();
    assert(/Configured owner:|No configured action is currently assigned/i.test(filteredMyWork), "The owner filter must show either matching scoped actions or the explicit empty state.");
    await page.context().close();
    results.push(`${fixture.name} receives only its active-workspace Work Records and can filter by lifecycle, Work Type, and configured owner`);
  }
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
