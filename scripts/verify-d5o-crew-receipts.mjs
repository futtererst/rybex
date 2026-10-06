import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { context } from "./m1/implementation-context.mjs";

const c = await context();
const base = process.env.D5O_SCHEDULE_BASE_URL ?? "http://127.0.0.1:61430";
const source = JSON.parse(readFileSync(resolve(".rybexos-local/d5o-shared-schedule-v1/rybex.json"), "utf8"));
const publication = source.publications.filter((item) => item.week === 0).at(-1);
assert.ok(publication, "Rybex week has a published plan");
const fiber = publication.assignments.find((item) => item.people.includes("Nate Walker"));
const other = publication.assignments.find((item) => !item.people.includes("Nate Walker"));
assert.ok(fiber && other, "Test needs separate named bookings");
const declinedPublication = source.publications.find((item) => source.receipts.some((receipt) => receipt.publicationId === item.id && receipt.recipient === "Avery Reed" && receipt.response === "cannot-attend"));
assert.ok(declinedPublication, "Avery's historical attendance response remains available");
const results = [];
const browser = await chromium.launch({ headless: true });
const output = resolve("artifacts/d5o-prototype-crew-receipts-20261003");
mkdirSync(output, { recursive: true });

async function session(email, next = "/work/my-schedule") {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route("**/*", (route) => {
    const origin = new URL(route.request().url()).origin;
    return [base, "http://127.0.0.1:61421"].includes(origin) ? route.continue() : route.abort();
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/auth/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL(`**${next}`, { timeout: 30000 });
  return { ctx, page };
}

async function post(page, payload) {
  return page.evaluate(async (body) => {
    const response = await fetch("/api/work/my-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, payload);
}

try {
  const nate = await session("crew-rybex-nate-walker@d5o-synthetic.local");
  await nate.page.getByRole("heading", { name: "Know where you're needed." }).waitFor();
  await nate.page.getByRole("heading", { name: "North Campus Data Hall Turnover" }).first().waitFor();
  const initial = await nate.page.evaluate(async () => (await fetch("/api/work/my-schedule")).json());
  assert.equal(initial.person, "Nate Walker");
  assert.ok(initial.bookings.length > 0 && initial.bookings.every((item) => item.assignmentId === fiber.id));
  const fullSchedule = await nate.page.evaluate(async () => (await fetch("/api/work/schedule")).status);
  assert.ok([401, 403].includes(fullSchedule), "Crew account cannot fetch the full scheduler plan");
  const forged = await post(nate.page, { expectedRevision: initial.revision, publicationId: publication.id, assignmentId: other.id, response: "acknowledged" });
  assert.equal(forged.status, 403, "Crew account cannot acknowledge someone else's booking");
  const stale = await post(nate.page, { expectedRevision: initial.revision - 1, publicationId: publication.id, assignmentId: fiber.id, response: "acknowledged" });
  assert.equal(stale.status, 409, "Stale response is rejected");
  results.push({ check: "crew scope, no full schedule, cross-person denial, stale revision", status: "PASS" });
  if (!initial.bookings[0].response) {
    await nate.page.getByRole("button", { name: "Accept booking" }).first().click();
    await nate.page.getByRole("button", { name: "Confirm response" }).click();
  }
  await nate.page.getByText("Accepted by you").waitFor();
  await nate.page.reload();
  await nate.page.getByText("Accepted by you").waitFor();
  await nate.page.screenshot({ path: resolve(output, "rybex-crew-acknowledged.png"), fullPage: true });
  const duplicate = await post(nate.page, { expectedRevision: (await nate.page.evaluate(async () => (await fetch("/api/work/my-schedule")).json())).revision,
    publicationId: publication.id, assignmentId: fiber.id, response: "acknowledged" });
  assert.equal(duplicate.status, 409, "Duplicate response is rejected");
  const olderPublication = source.publications.filter((item) => item.week === 0).find((item) => item.id !== publication.id && item.assignments.some((booking) => booking.id === fiber.id && booking.people.includes("Nate Walker")));
  if (olderPublication) {
    const currentRevision = (await nate.page.evaluate(async () => (await fetch("/api/work/my-schedule")).json())).revision;
    const superseded = await post(nate.page, { expectedRevision: currentRevision, publicationId: olderPublication.id, assignmentId: fiber.id, response: "acknowledged" });
    assert.equal(superseded.status, 409, "Superseded publication cannot receive a new direct response");
  }
  results.push({ check: "direct acknowledgement, durable reload, duplicate denial", status: "PASS" });
  await nate.ctx.close();

  const avery = await session("crew-rybex-avery-reed@d5o-synthetic.local");
  const averyView = await avery.page.evaluate(async () => (await fetch("/api/work/my-schedule")).json());
  if (publication.assignments.some((item) => item.people.includes("Avery Reed"))) {
    if (!averyView.bookings[0].response) {
      await avery.page.getByRole("button", { name: "Decline booking" }).first().click();
      await avery.page.getByRole("button", { name: "Confirm response" }).click();
    }
    await avery.page.getByText("Declined — scheduler review").waitFor();
  } else {
    assert.equal(averyView.bookings.length, 0, "A replaced crew member has no current booking");
    assert.ok(source.receipts.some((item) => item.publicationId === declinedPublication.id && item.recipient === "Avery Reed" && item.response === "cannot-attend"));
  }
  results.push({ check: "direct attendance issue retained historically after replacement", status: "PASS" });
  await avery.ctx.close();

  const rotork = await session("crew-rotork-priya-shah@d5o-synthetic.local");
  await rotork.page.getByRole("heading", { name: "Know where you're needed." }).waitFor();
  await rotork.page.getByText("Loading your published schedule…").waitFor({ state:"hidden" });
  const rotorkView = await rotork.page.evaluate(async () => (await fetch("/api/work/my-schedule")).json());
  assert.equal(rotorkView.workspace, "rotork");
  assert.ok(rotorkView.bookings.every((item) => item.workId.startsWith("rotork-")));
  results.push({ check: "Rotork identity isolated from Rybex bookings", status: "PASS" });
  await rotork.ctx.close();

  const publishedBy = publication.publishedBy.id;
  const profile = await c.service.from("user_profiles").select("email").eq("user_id", publishedBy).single();
  assert.ok(!profile.error && profile.data?.email);
  const scheduler = await session(profile.data.email, "/work");
  const schedule = await scheduler.page.evaluate(async () => (await fetch("/api/work/schedule")).json());
  const coordinatorAttempt = await scheduler.page.evaluate(async ({ publicationId, assignmentId, recipient, expectedRevision }) => {
    const response = await fetch("/api/work/schedule", { method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ action:"receipt", publicationId, assignmentId, recipient, expectedRevision }) });
    return response.status;
  }, { publicationId:publication.id, assignmentId:fiber.id, recipient:fiber.people[0], expectedRevision:schedule.schedule.revision });
  assert.equal(coordinatorAttempt, 400, "Scheduler cannot respond for an assigned worker");
  const receipts = schedule.schedule.receipts.filter((item) => item.publicationId === publication.id && item.assignmentId === fiber.id);
  assert.equal(receipts.find((item) => item.recipient === "Nate Walker")?.source, "self");
  const oldReceipts = schedule.schedule.receipts.filter((item) => item.publicationId === declinedPublication.id);
  assert.equal(oldReceipts.find((item) => item.recipient === "Avery Reed")?.response, "cannot-attend");
  if (fiber.people.includes("Mia Owens")) assert.equal(receipts.find((item) => item.recipient === "Mia Owens")?.source, "self");
  results.push({ check: "scheduler sees attributed acknowledgement and attendance issue", status: "PASS" });
  await scheduler.ctx.close();

  const auditorProfile = await c.service.from("user_profiles").select("email").eq("workspace_id", "5488a1a7-d6eb-460c-88a4-4629d742d705")
    .eq("display_name", "auditor").limit(1).single();
  assert.ok(!auditorProfile.error && auditorProfile.data?.email);
  const auditor = await session(auditorProfile.data.email, "/work");
  const readOnly = await auditor.page.evaluate(async () => {
    const response = await fetch("/api/work/schedule");
    return { status:response.status, data:await response.json() };
  });
  assert.equal(readOnly.status, 200);
  assert.equal(readOnly.data.canEdit, false);
  results.push({ check: "non-crew auditor retains read-only schedule access", status: "PASS" });
  await auditor.ctx.close();

  writeFileSync(resolve(output, "RESULTS.json"), JSON.stringify({ status: "PASS", results }, null, 2));
  console.log(JSON.stringify({ status: "PASS", checks: results.length, output }));
} finally { await browser.close(); }
