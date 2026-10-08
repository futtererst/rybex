import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { context } from "./m1/implementation-context.mjs";

const base = "http://127.0.0.1:61430";
const c = await context();
const browser = await chromium.launch({ headless: true });

async function post(page, payload) {
  return page.evaluate(async (body) => {
    const response = await fetch("/api/work/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, payload);
}

try {
  for (const workspace of ["rybex", "rotork"]) {
    const schedule = JSON.parse(readFileSync(resolve(`.rybexos-local/d5o-shared-schedule-v1/${workspace}.json`), "utf8"));
    const publisher = schedule.publications.at(-1)?.publishedBy.id;
    assert.ok(publisher, `${workspace} has a synthetic workspace editor`);
    const profile = await c.service.from("user_profiles").select("email").eq("user_id", publisher).single();
    assert.ok(!profile.error && profile.data?.email);
    const session = await browser.newContext();
    await session.route("**/*", (route) => [base, "http://127.0.0.1:61421"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await session.newPage();
    await page.goto(`${base}/auth/sign-in?next=%2Fwork`);
    await page.getByLabel("Email", { exact: true }).fill(profile.data.email);
    await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
    await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
    await page.waitForURL("**/work", { timeout: 30000 });
    await page.getByRole("navigation", { name: "D5O operating system" }).getByRole("button", { name: "Start work" }).click();
    const workType = await page.getByRole("combobox", { name: "Work type" }).inputValue();
    const card = await page.locator(".d5o-path-card").textContent();
    const activeVersion = card?.match(/Exact version:\s*([0-9a-f-]{36})/i)?.[1];
    assert.ok(activeVersion, `${workspace} displays an exact active published version`);
    const first = await page.evaluate(async () => (await (await fetch("/api/work/catalog")).json()).catalog);
    const fields = { action: "create-record", title: `Synthetic phase pin QA ${workspace} ${Date.now()}`, type: workType, customer: "Synthetic qualification customer", site: "Local proof site", owner: "Synthetic workspace editor", value: "Prototype proof" };
    const stale = await post(page, { ...fields, expectedRevision: first.revision, phaseConfigurationVersionId: "00000000-0000-4000-8000-000000000000" });
    assert.equal(stale.status, 409, "An unavailable version cannot create a shared record");
    const wrongType = await post(page, { ...fields, type: "Unsupported Work Type", expectedRevision: first.revision, phaseConfigurationVersionId: activeVersion });
    assert.equal(wrongType.status, 409, "A Work Type outside the published contract cannot create a record");
    const created = await post(page, { ...fields, expectedRevision: first.revision, phaseConfigurationVersionId: activeVersion });
    assert.equal(created.status, 200, `${workspace} accepts the exact active version`);
    assert.equal(created.body.created.phaseConfigurationVersionId, activeVersion);
    const reloaded = await page.evaluate(async () => (await (await fetch("/api/work/catalog")).json()).catalog);
    assert.equal(reloaded.records.find((item) => item.id === created.body.created.id)?.phaseConfigurationVersionId, activeVersion, "The pin survives durable reload");
    await session.close();
  }
  console.log("Shared Start Work phase pin: Rybex/Rotork current version, stale version denial, incompatible Work Type denial, durable reload PASS");
} finally { await browser.close(); }
