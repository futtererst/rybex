import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { context, loadWork } from "../m1/implementation-context.mjs";
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

async function submitValidDraft(fixture) {
  const draft = await prepare(c, fixture, { submit: false });
  const preparer = await pageFor(fixture, "preparer");
  await preparer.goto(url(fixture, draft.work));
  await preparer.getByRole("heading", { name: "Prepare proof for review" }).waitFor();
  await preparer.getByRole("button", { name: "Submit proof for review", exact: true }).click();
  await preparer.waitForURL("**result=recorded**");
  assert.equal((await loadWork(draft.owner, fixture, draft.work)).proof?.status, "submitted");
  return draft;
}

try {
  const rybexDraft = await submitValidDraft(rybex);
  results.push("Rybex preparer submits a valid draft through the workspace command adapter");

  const reviewer = await pageFor(rybex, "quality_verifier");
  await reviewer.goto(url(rybex, rybexDraft.work));
  assert.equal(await reviewer.getByRole("button", { name: "Submit proof for review", exact: true }).count(), 0);
  assert.match(await reviewer.getByText(/cannot prepare or submit a revision/i).innerText(), /cannot prepare or submit/i);
  results.push("non-preparer cannot submit proof from the workspace");

  await submitValidDraft(rotork);
  results.push("Rotork preparer uses the same proof flow and command adapter");

  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
