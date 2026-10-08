import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { clients, db, project } from "./m1/baseline-correction/fixtures.mjs";

const base = "http://127.0.0.1:61431";
const auth = "http://127.0.0.1:61421";
const owned = spawnSync("docker", ["inspect", db, "--format", '{{index .Config.Labels "com.supabase.cli.project"}}'], { encoding: "utf8", windowsHide: true });
assert.equal(owned.status, 0, "The owned disposable database must exist");
assert.equal(owned.stdout.trim(), project, "The database must belong to this disposable project");
const c = await clients();
assert.equal(c.env.NEXT_PUBLIC_SUPABASE_URL, auth);
const identities = JSON.parse(await readFile(".rybexos-local/d5o-shared-schedule-v1/crew-identities.json", "utf8"));
const worker = identities.find((item) => item.workspace === "rybex" && item.person === "Tomas Bell");
assert.ok(worker, "Synthetic worker identity must be provisioned");
const profile = await c.service.from("user_profiles").select("email").eq("user_id", worker.userId).single();
assert.ok(!profile.error && profile.data?.email?.endsWith(".local"), "Only the synthetic worker fixture is used");
const browser = await chromium.launch({ headless: true });
try {
  const session = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await session.route("**/*", (route) => [base, auth].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await session.newPage();
  await page.goto(`${base}/auth/sign-in?next=%2Fwork%2Fmy-schedule`);
  await page.getByLabel("Email", { exact: true }).fill(profile.data.email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL("**/work/my-schedule", { timeout: 30000 });
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Notification preferences" }).click();
  await page.getByRole("dialog", { name: "Notification preferences" }).getByRole("heading", { name: "How should D5O reach you?" }).waitFor();
  await page.getByText("Connect this browser first").waitFor();
  const checks = await page.evaluate(async () => {
    const get = await fetch("/api/work/notification-settings", { cache: "no-store" });
    const state = await get.json();
    const post = async (body) => {
      const response = await fetch("/api/work/notification-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    };
    return { getStatus: get.status, state,
      email: await post({ action: "set-channels", channels: { email: true, sms: false, push: false } }),
      sms: await post({ action: "set-channels", channels: { email: false, sms: true, push: false } }),
      unsafePush: await post({ action: "save-push", subscription: { endpoint: "https://127.0.0.1/push",
        keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) } } }) };
  });
  assert.equal(checks.getStatus, 200);
  assert.equal(checks.state.workspace, "rybex");
  assert.equal(checks.state.verifiedAccountContacts.email, "", "Synthetic .local email cannot be an external destination");
  assert.equal(checks.state.verifiedAccountContacts.phone, "", "No unverified phone is used");
  assert.equal(checks.state.available.push, true, "Local VAPID identity enables self-service browser push");
  assert.equal(checks.email.status, 409, "Email cannot be enabled without a verified external account email");
  assert.equal(checks.sms.status, 409, "SMS cannot be enabled without a verified account phone");
  assert.equal(checks.unsafePush.status, 400, "Private or arbitrary push endpoint is rejected");
  await page.getByRole("button", { name: "Close notification preferences" }).click();
  await page.getByRole("dialog", { name: "Notification preferences" }).waitFor({ state: "detached" });
  await session.close();
  const plan = JSON.parse(await readFile("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json", "utf8"));
  const schedulerSession = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await schedulerSession.route("**/*", (route) => [base, auth].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const scheduler = await schedulerSession.newPage();
  await scheduler.goto(`${base}/auth/sign-in?next=%2Fwork`);
  await scheduler.getByLabel("Email", { exact: true }).fill(plan.scenarios.find((scenario) => scenario.name === "rybex").actors.quality_verifier.email);
  await scheduler.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await scheduler.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await scheduler.waitForURL("**/work", { timeout: 30000 });
  await scheduler.getByRole("button", { name: "Account" }).click();
  await scheduler.getByRole("menuitem", { name: "Notification preferences" }).click();
  await scheduler.getByRole("dialog", { name: "Notification preferences" }).getByText("ALL WORKSPACES").waitFor();
  await scheduler.getByRole("dialog", { name: "Notification preferences" }).getByRole("heading", { name: "Crew booking alerts" }).waitFor();
  assert.equal(new URL(scheduler.url()).pathname, "/work", "Settings remain inside the current workspace");
  const drawer = await scheduler.getByRole("dialog", { name: "Notification preferences" }).evaluate((element) => ({
    width: Math.round(element.getBoundingClientRect().width), viewport: window.innerWidth,
    overflow: document.body.style.overflow
  }));
  assert(drawer.width < drawer.viewport, "Preferences display as a contained drawer, not a standalone page");
  assert.equal(drawer.overflow, "hidden", "Background is locked while preferences are open");
  await scheduler.screenshot({ path: ".rybexos-local/notification-preferences-scheduler.png" });
  await schedulerSession.close();
  console.log("Notification settings integration: PASS — worker and scheduler account drawers, authenticated guards, no route change or external delivery.");
} finally { await browser.close(); }
