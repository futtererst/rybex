import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { command, context, loadWork } from "../m1/implementation-context.mjs";
import { prepare } from "../m1/proof-fixtures.mjs";

const base = process.env.M2_WORKSPACE_BASE_URL ?? "http://127.0.0.1:61430";
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"));
const [rybex, rotork] = plan.scenarios;
const c = await context();
const browser = await chromium.launch({ headless: true });
const results = [];

function url(fixture, work) {
  return `${base}/work/${fixture.workspace}/${work}`;
}

async function pageFor(fixture, role) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto(`${base}/auth/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(fixture.actors[role].email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/m1-proof");
  return page;
}

try {
  const rybexWork = await prepare(c, rybex);
  const quality = await pageFor(rybex, "quality_verifier");
  await quality.goto(url(rybex, rybexWork.work));
  await quality.getByRole("heading", { name: "Take configured action" }).waitFor();
  assert.match(await quality.getByRole("region", { name: "Next guided step" }).innerText(), /Review and record the next decision/i);
  const chooser = quality.getByLabel("Choose a decision", { exact: true });
  await chooser.selectOption("verify-quality");
  await quality.getByText("Consequence: Quality verified.", { exact: true }).waitFor();
  await quality.getByLabel("Verify quality: decision reason", { exact: true }).fill("Workspace action proof");
  await quality.getByRole("button", { name: "Verify quality", exact: true }).click();
  await quality.waitForURL("**result=recorded**");
  assert.equal((await loadWork(rybexWork.owner, rybex, rybexWork.work)).decisions.length, 1);
  results.push("permitted Rybex decision records through the shared command transaction");

  const staleWork = await prepare(c, rybex);
  await quality.goto(url(rybex, staleWork.work));
  await quality.getByLabel("Choose a decision", { exact: true }).selectOption("verify-quality");
  await command(staleWork.owner, rybex, staleWork.work, "metadata", { title: "Changed after workspace read" });
  await quality.getByLabel("Verify quality: decision reason", { exact: true }).fill("Stale workspace action");
  await quality.getByRole("button", { name: "Verify quality", exact: true }).click();
  await quality.waitForURL("**result=concurrency_conflict**");
  assert.equal((await loadWork(staleWork.owner, rybex, staleWork.work)).decisions.length, 0);
  results.push("stale workspace command rejects without recording a decision");

  const rotorkWork = await prepare(c, rotork);
  const pilot = await pageFor(rotork, "pilot_reviewer");
  await pilot.goto(url(rotork, rotorkWork.work));
  assert.match(await pilot.getByRole("region", { name: "Next guided step" }).innerText(), /Review and record the next decision/i);
  const pilotChooser = pilot.getByLabel("Choose a decision", { exact: true });
  await pilotChooser.selectOption("review-pilot");
  assert.equal(await pilot.getByRole("button", { name: "Review pilot outcome", exact: true }).isEnabled(), true);
  assert.equal(await pilot.locator('option[value="authorize-rollout"]').count(), 0);
  results.push("Rotork pilot reviewer receives configured review authority but not rollout authority");

  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
