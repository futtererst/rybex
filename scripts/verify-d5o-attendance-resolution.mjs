import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { context } from "./m1/implementation-context.mjs";

const base = "http://127.0.0.1:61430";
const output = resolve("artifacts/d5o-prototype-attendance-resolution-20261003");
const storePath = resolve(".rybexos-local/d5o-shared-schedule-v1/rybex.json");
mkdirSync(output, { recursive: true });
const c = await context();
const before = JSON.parse(readFileSync(storePath, "utf8"));
const original = before.publications.filter((item) => item.week === 0).find((item) =>
  before.receipts.some((receipt) => receipt.publicationId === item.id && receipt.recipient === "Avery Reed" && receipt.response === "cannot-attend"));
assert.ok(original, "The original Avery Reed attendance issue remains in immutable history");
const originalBooking = original.assignments.find((item) => item.people.includes("Avery Reed"));
assert.ok(originalBooking, "Original publication includes Avery's booking");
const publisher = await c.service.from("user_profiles").select("email").eq("user_id", original.publishedBy.id).single();
assert.ok(!publisher.error && publisher.data?.email, "Publisher has a local synthetic account");

const browser = await chromium.launch({ headless: true });
async function signIn(email, next = "/work") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await ctx.route("**/*", (route) => [base, "http://127.0.0.1:61421"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/auth/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL(`**${next}`, { timeout: 30000 });
  return { ctx, page };
}

try {
  const scheduler = await signIn(publisher.data.email);
  await scheduler.page.getByRole("button", { name: "Crew schedule", exact: true }).first().click();
  const queue = scheduler.page.getByRole("region", { name: "Crew attendance actions" });
  let state = JSON.parse(readFileSync(storePath, "utf8"));
  if (state.publications.filter((item) => item.week === 0).at(-1)?.id === original.id) {
    await queue.getByRole("heading", { name: "1 person cannot attend" }).waitFor();
    await queue.getByText("Avery Reed", { exact: false }).first().waitFor();
    if (state.assignments.find((item) => item.id === originalBooking.id)?.people.includes("Avery Reed")) {
      await scheduler.page.screenshot({ path: resolve(output, "scheduler-attendance-issue.png"), fullPage: true });
      await queue.getByRole("button", { name: /Mia Owens/ }).click();
      const dialog = scheduler.page.getByRole("dialog", { name: /Move Fiber installation/ });
      await dialog.getByRole("button", { name: "Acknowledge & save schedule" }).click();
      await dialog.waitFor({ state: "hidden" });
      state = JSON.parse(readFileSync(storePath, "utf8"));
      assert.equal(state.publications.filter((item) => item.week === 0).at(-1).id, original.id, "Saving replacement changes the draft only");
      assert.ok(state.assignments.find((item) => item.id === originalBooking.id).people.includes("Mia Owens"));
      assert.ok(!state.assignments.find((item) => item.id === originalBooking.id).people.includes("Avery Reed"));
    }
    await scheduler.page.getByText("REVISED DRAFT NEEDS PUBLICATION").waitFor();
    await scheduler.page.getByRole("button", { name: "Execution & control", exact: true }).click();
    await scheduler.page.getByRole("heading", { name: "Revised crew plan awaiting publication" }).waitFor();
    await scheduler.page.screenshot({ path: resolve(output, "execution-draft-needs-publication.png"), fullPage: true });
    await scheduler.page.getByRole("button", { name: "Resolve in crew schedule" }).click();
    await scheduler.page.getByRole("button", { name: "Publish revised plan" }).click();
    await scheduler.page.getByRole("button", { name: "Confirm publication" }).click();
    await scheduler.page.getByRole("button", { name: "Confirm publication" }).waitFor({ state: "hidden" });
    state = JSON.parse(readFileSync(storePath, "utf8"));
    const justPublished = state.publications.filter((item) => item.week === 0).at(-1);
    assert.equal(state.receipts.filter((item) => item.publicationId === justPublished.id).length, 0, "Fresh publication requires fresh crew receipts");
    await scheduler.page.screenshot({ path: resolve(output, "revised-publication-awaiting-receipts.png"), fullPage: true });
  }
  state = JSON.parse(readFileSync(storePath, "utf8"));
  const revised = state.publications.filter((item) => item.week === 0).at(-1);
  assert.notEqual(revised.id, original.id);
  assert.ok(revised.assignments.find((item) => item.id === originalBooking.id).people.includes("Mia Owens"));
  assert.ok(state.receipts.some((item) => item.publicationId === original.id && item.recipient === "Avery Reed" && item.response === "cannot-attend"), "Historical decline is retained");
  await scheduler.ctx.close();

  const mia = await signIn("crew-rybex-mia-owens@d5o-synthetic.local", "/work/my-schedule");
  await mia.page.getByText("Loading your published schedule…").waitFor({ state: "hidden" });
  if (await mia.page.getByRole("button", { name: "Accept booking" }).count()) {
    await mia.page.getByRole("button", { name: "Accept booking" }).first().click();
    await mia.page.getByRole("button", { name: "Confirm response" }).click();
  }
  await mia.page.getByText("Accepted by you").waitFor();
  await mia.page.reload();
  await mia.page.getByText("Accepted by you").waitFor();
  await mia.page.screenshot({ path: resolve(output, "replacement-crew-acknowledged.png"), fullPage: true });
  await mia.ctx.close();

  state = JSON.parse(readFileSync(storePath, "utf8"));
  assert.ok(state.receipts.some((item) => item.publicationId === revised.id && item.recipient === "Mia Owens" && item.source === "self" && item.response === "acknowledged"));
  assert.ok(state.receipts.some((item) => item.publicationId === original.id && item.recipient === "Avery Reed" && item.response === "cannot-attend"));
  writeFileSync(resolve(output, "RESULTS.json"), JSON.stringify({ status: "PASS", originalPublication: original.id, revisedPublication: revised.id, originalDeclineRetained: true, draftSaveBeforePublish: true, newPublicationRequiresFreshReceipts: true, replacementSelfAcknowledged: true }, null, 2));
  console.log("D5O attendance resolution: declined receipt → qualified replacement draft → republication → replacement acknowledgement PASS");
} finally {
  await browser.close();
}
