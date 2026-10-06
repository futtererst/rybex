import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { clients, db, project } from "./m1/baseline-correction/fixtures.mjs";

const base = "http://127.0.0.1:61431";
const auth = "http://127.0.0.1:61421";
const owned = spawnSync("docker", ["inspect", db, "--format", '{{index .Config.Labels "com.supabase.cli.project"}}'], { encoding: "utf8", windowsHide: true });
assert.equal(owned.status, 0, `The approved disposable database must exist (${owned.error?.code ?? owned.stderr.trim()})`);
assert.equal(owned.stdout.trim(), project, "The database must belong to this disposable project");
const c = await clients();
assert.equal(c.env.NEXT_PUBLIC_SUPABASE_URL, auth, "Only the local disposable Auth endpoint is permitted");
const browser = await chromium.launch({ headless: true });

async function signIn(email, next) {
  const session = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await session.route("**/*", (route) => [base, auth].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await session.newPage();
  await page.goto(`${base}/auth/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL(`**${next}`, { timeout: 30000 });
  return { session, page };
}

try {
  const state = JSON.parse((await (await import("node:fs/promises")).readFile(".rybexos-local/d5o-shared-schedule-v1/rybex.json", "utf8")));
  const latest = state.publications.filter((item) => item.week === 0).at(-1);
  assert.ok(latest, "A saved booking must already be shared");
  const publisher = await c.service.from("user_profiles").select("email").eq("user_id", latest.publishedBy.id).single();
  assert.ok(!publisher.error && publisher.data?.email, "The synthetic scheduler account must be available");

  const scheduler = await signIn(publisher.data.email, "/work");
  await scheduler.page.getByRole("navigation", { name: "D5O platform" }).getByRole("button", { name: "Crew schedule" }).click();
  await scheduler.page.getByRole("button", { name: "Plan details" }).click();
  await scheduler.page.getByRole("navigation", { name: "Schedule details" }).getByRole("button", { name: "Responses" }).click();
  const responses = scheduler.page.getByRole("region", { name: "Shared plan and worker responses" });
  await responses.getByText("Shared with workers").waitFor();

  const worker = await signIn("crew-rybex-tomas-bell@d5o-synthetic.local", "/work/my-schedule");
  await worker.page.getByRole("heading", { name: "Know where you're needed." }).waitFor();
  const initial = await worker.page.evaluate(async () => (await fetch("/api/work/my-schedule", { cache: "no-store" })).json());
  assert.equal(initial.person, "Tomas Bell");
  assert.ok(initial.bookings.length > 0, "The worker sees a saved booking without a separate scheduler publication");
  const fullScheduleStatus = await worker.page.evaluate(async () => (await fetch("/api/work/schedule")).status);
  assert.equal(fullScheduleStatus, 403, "A worker cannot read the full scheduler plan");
  const booking = initial.bookings.find((item) => item.assignmentId === "seed-fiber");
  assert.ok(booking, "The synthetic fiber booking must be visible to Tomas");
  let respondedNow = false;
  if (!booking.response) {
    const card = worker.page.locator(".d5o-crew-self-list article").filter({ hasText: booking.packageName })
      .filter({ hasText: booking.crew }).filter({ hasText: booking.date });
    await card.getByRole("button", { name: "Accept booking" }).click();
    await worker.page.getByRole("button", { name: "Confirm response" }).click();
    await worker.page.getByText("Accepted by you").first().waitFor();
    respondedNow = true;
    await scheduler.page.waitForFunction(({ date, crew, recipient }) => {
      const region = document.querySelector('[aria-label="Shared plan and worker responses"]');
      return [...region?.querySelectorAll(".d5o-schedule-receipt-list > div") ?? []].some((row) =>
        row.textContent?.includes(recipient) && row.textContent.includes(date) && row.textContent.includes(crew)
        && row.textContent.includes("Accepted by worker"));
    }, { date: booking.date, crew: booking.crew, recipient: "Tomas Bell" }, { timeout: 22000 });
  }
  const after = await scheduler.page.evaluate(async () => (await fetch("/api/work/schedule", { cache: "no-store" })).json());
  assert.ok(after.schedule.receipts.some((receipt) => receipt.publicationId === booking.publicationId
    && receipt.assignmentId === booking.assignmentId && receipt.recipient === "Tomas Bell" && receipt.response === "acknowledged"),
  "The worker's response is attributed and durable for the saved booking");
  console.log(`PASS: signed-in worker sees an auto-shared booking, ${respondedNow ? "accepts it and the open scheduler response view updates" : "its prior acceptance remains durable"}; full-plan access is denied`);
  await worker.session.close();
  await scheduler.session.close();
} finally { await browser.close(); }
