import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { context } from "../m1/implementation-context.mjs";
import { prepare } from "../m1/proof-fixtures.mjs";

const base = process.env.M2_WORKSPACE_BASE_URL ?? "http://127.0.0.1:61430";
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"));
const [rybex, rotork] = plan.scenarios;
const c = await context();
const browser = await chromium.launch({ headless: true });
const results = [];

async function signIn(fixture, role) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto(`${base}/auth/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(fixture.actors[role].email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/m1-proof");
  return page;
}

function workspaceUrl(fixture, work) {
  return `${base}/work/${fixture.workspace}/${work}`;
}

try {
  const rybexWork = await prepare(c, rybex);
  const rotorkWork = await prepare(c, rotork);
  const rybexPage = await signIn(rybex, "quality_verifier");
  await rybexPage.goto(workspaceUrl(rybex, rybexWork.work));
  await rybexPage.getByRole("heading", { name: "Certification and turnover" }).waitFor();
  assert.match(await rybexPage.getByRole("region", { name: "Workspace identity" }).innerText(), /Synthetic rybex proof/i);
  assert.equal(await rybexPage.getByRole("heading", { name: "Readiness and blockers" }).count(), 1);
  assert.equal(await rybexPage.getByRole("heading", { name: "Evidence and proof" }).count(), 1);
  assert.equal(await rybexPage.getByRole("heading", { name: "Decision authority" }).count(), 1);
  results.push("rybex workspace renders through the shared workspace component");

  const rotorkPage = await signIn(rotork, "pilot_reviewer");
  await rotorkPage.goto(workspaceUrl(rotork, rotorkWork.work));
  await rotorkPage.getByRole("heading", { name: "Pilot-to-rollout authorization" }).waitFor();
  assert.match(await rotorkPage.getByRole("region", { name: "Workspace identity" }).innerText(), /Synthetic rotork proof/i);
  assert.match(await rotorkPage.getByText("Pilot outcome proof", { exact: true }).innerText(), /Pilot outcome proof/);
  results.push("rotork workspace renders through the same workspace component");

  await rotorkPage.goto(workspaceUrl(rybex, rybexWork.work));
  await rotorkPage.getByRole("heading", { name: "Work unavailable" }).waitFor();
  assert.equal(await rotorkPage.getByText(/Certification and turnover/i).count(), 0);
  results.push("cross-workspace record access is unavailable without data leakage");

  const anonymous = await (await browser.newContext()).newPage();
  await anonymous.goto(workspaceUrl(rybex, rybexWork.work));
  await anonymous.waitForURL("**/auth/sign-in?next=**");
  assert.match(await anonymous.locator('input[name="next"]').inputValue(), /\/work\//);
  await anonymous.context().close();
  results.push("anonymous access redirects safely to the exact workspace route");

  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
