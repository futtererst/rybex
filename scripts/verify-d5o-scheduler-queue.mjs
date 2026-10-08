import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { context } from "./m1/implementation-context.mjs";

const base = process.env.D5O_BASE ?? "http://127.0.0.1:61431";
const output = resolve("artifacts/d5o-prototype-scheduler-queue-20261003");
mkdirSync(output, { recursive: true });
const c = await context();
const browser = await chromium.launch({ headless: true });

async function openScheduler(workspace) {
  const state = JSON.parse(readFileSync(resolve(`.rybexos-local/d5o-shared-schedule-v1/${workspace}.json`), "utf8"));
  const publisher = state.publications.at(-1)?.publishedBy.id;
  assert.ok(publisher, `${workspace} has a synthetic scheduler account`);
  const profile = await c.service.from("user_profiles").select("email").eq("user_id", publisher).single();
  assert.ok(!profile.error && profile.data?.email);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/*", (route) => [base, "http://127.0.0.1:61421"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/auth/sign-in?next=%2Fwork`);
  await page.getByLabel("Email", { exact: true }).fill(profile.data.email);
  await page.getByLabel("Password", { exact: true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL("**/work", { timeout: 30000 });
  await page.getByRole("button", { name: "Crew schedule", exact: true }).first().click();
  const scheduleResponse = await page.evaluate(async () => { const response = await fetch("/api/work/schedule"); return { status: response.status, payload: await response.json() }; });
  assert.equal(scheduleResponse.status, 200, `${workspace} scheduler can read its shared plan: ${JSON.stringify(scheduleResponse.payload)}`);
  assert.equal(scheduleResponse.payload.schedule.workspace, workspace);
  return { ctx, page, schedule: scheduleResponse.payload.schedule };
}

try {
  for (const workspace of ["rybex", "rotork"]) {
    const { ctx, page, schedule } = await openScheduler(workspace);
    const queue = page.getByRole("region", { name: "Work awaiting a crew" });
    await queue.getByRole("heading", { name: "Work needing a crew" }).waitFor();
    assert.equal(await queue.getByText("Date unavailable").count(), 0, "The queue waits for the shared schedule before showing dates");
    assert.equal(await queue.getByText("Demand and crew coverage").count(), 0);
    const list = queue.locator(".d5o-demand-list");
    const overflow = await list.evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight, overflow: getComputedStyle(element).overflowY }));
    assert.notEqual(overflow.overflow, "auto", "The staffing queue must not hide work behind an inner scrollbar");
    assert.ok(overflow.scroll <= overflow.client + 1, "All staffing tasks remain visible without inner scrolling");
    await page.screenshot({ path: resolve(output, `${workspace}-scheduler-queue.png`), fullPage: false });
    if (workspace === "rybex") {
      const demand = schedule.packageDemands.find((item) => item.packageId === "wp-service-rybex-3");
      assert.ok(demand, "Service package has shared explicit demand");
      const covered = demand.requiredSlots.every((slot) => new Set(schedule.assignments.filter((item) => item.workId === demand.workId && item.packageId === demand.packageId && item.date === slot.date && item.shift === slot.shift).flatMap((item) => item.people)).size >= demand.minimumPeople);
      const row = queue.getByRole("article").filter({ hasText: "Service integration plan" });
      if (covered) {
        assert.equal(await row.count(), 0, "A fully staffed package no longer asks for crew in the action queue");
        await page.locator("#d5o-week-board").getByText("Service integration plan", { exact: true }).first().waitFor();
      } else {
        await row.getByText("2+ qualified people").waitFor();
        await row.getByText("Controls service").waitFor();
        await row.getByText("REQUIRED DATE & SHIFT").waitFor();
        await row.getByText(new RegExp(demand.requiredSlots[0].shift)).waitFor();
        await row.getByRole("button", { name: "Schedule crew" }).click();
        const editor = page.locator("#d5o-crew-editor");
        await editor.waitFor();
        assert.equal(await editor.getByLabel("Work Record and package").inputValue(), "rybex-3|wp-service-rybex-3");
        assert.equal(await editor.getByLabel("Start time").inputValue(), demand.requiredSlots[0].shift.slice(0, 5));
        assert.equal(await editor.getByLabel("End time").inputValue(), demand.requiredSlots[0].shift.slice(-5));
        await editor.getByLabel("Booking day").selectOption("1");
        await editor.getByText(/Saving this assignment will also update its required date\/shift/).waitFor();
        await page.getByRole("button", { name: "Close crew assignment" }).click();
      }
      const fiberCard = page.locator(".d5o-schedule-card").filter({ hasText: "Fiber trunks and termination" }).first();
      const fiberRow = fiberCard.locator("xpath=ancestor::*[contains(@class, 'd5o-week-row')]");
      if (await fiberRow.getByRole("button", { name: /Reschedule Fiber installation/ }).isEnabled()) {
        await fiberCard.dragTo(fiberRow.locator(".d5o-week-cell").nth(4));
        const moveDialog = page.getByRole("dialog", { name: "Move Fiber installation" });
        await moveDialog.getByText(/also updates the Work Package required date\/shift/).waitFor();
        assert.equal(await moveDialog.getByRole("button", { name: "Acknowledge & save schedule" }).isEnabled(), true, "A qualified calendar move can be acknowledged without leaving the scheduler");
        await moveDialog.getByRole("button", { name: "Cancel" }).click();
      } else assert.equal(await fiberRow.getByRole("button", { name: /Reschedule Fiber installation/ }).isEnabled(), false, "Accepted historical packages cannot be rescheduled");
      const invalidDate = await page.evaluate(async () => {
        const before = await (await fetch("/api/work/schedule")).json();
        const schedule = before.schedule;
        const requirement = schedule.packageDemands.find((item) => item.packageId === "wp-service-rybex-3");
        const invalid = { id: "verify-required-date", crew: "Controls service", people: ["Samira Khan", "Kai Patel"], workId: "rybex-3", packageId: requirement.packageId, week: -1, day: 0, date: "2026-09-28", shift: requirement.requiredSlots[0].shift };
        const response = await fetch("/api/work/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-assignments", expectedRevision: schedule.revision, assignments: [...schedule.assignments, invalid] }) });
        const after = await (await fetch("/api/work/schedule")).json();
        return { status: response.status, body: await response.json(), beforeRevision: schedule.revision, afterRevision: after.schedule.revision };
      });
      assert.equal(invalidDate.status, 409, "The server rejects a booking outside required dates");
      assert.match(JSON.stringify(invalidDate.body), /outside the Work Package required dates/);
      assert.equal(invalidDate.afterRevision, invalidDate.beforeRevision, "Rejected date does not change the shared draft");
      const invalidShift = await page.evaluate(async () => {
        const before = await (await fetch("/api/work/schedule")).json();
        const schedule = before.schedule;
        const requirement = schedule.packageDemands.find((item) => item.packageId === "wp-service-rybex-3");
        const candidateDate = requirement.requiredSlots[0].date;
        const day = Math.round((Date.parse(`${candidateDate}T00:00:00Z`) - Date.parse(`${schedule.anchorDate}T00:00:00Z`)) / 86400000);
        const forbiddenShift = ["07:00–15:30", "08:00–16:00", "09:00–16:00"].find((shift) => !requirement.requiredSlots.some((slot) => slot.date === candidateDate && slot.shift === shift));
        if (!forbiddenShift) return { skipped: true };
        const invalid = { id: "verify-required-shift", crew: "Controls service", people: ["Samira Khan", "Kai Patel"], workId: "rybex-3", packageId: requirement.packageId, week: Math.floor(day / 7), day: day % 7, date: candidateDate, shift: forbiddenShift };
        const response = await fetch("/api/work/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-assignments", expectedRevision: schedule.revision, assignments: [...schedule.assignments, invalid] }) });
        const after = await (await fetch("/api/work/schedule")).json();
        return { status: response.status, body: await response.json(), beforeRevision: schedule.revision, afterRevision: after.schedule.revision };
      });
      assert.equal(invalidShift.skipped, undefined, "A non-required shift is available for the negative proof");
      assert.equal(invalidShift.status, 409, "The server rejects a booking outside required shifts");
      assert.match(JSON.stringify(invalidShift.body), /booking shift must be/);
      assert.equal(invalidShift.afterRevision, invalidShift.beforeRevision, "Rejected shift does not change the shared draft");
      const invalidDemandScope = await page.evaluate(async () => {
        const before = await (await fetch("/api/work/schedule")).json();
        const requirement = before.schedule.packageDemands.find((item) => item.packageId === "wp-service-rybex-3");
        const response = await fetch("/api/work/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-demand", expectedRevision: before.schedule.revision, demand: { ...requirement, workId: "rotork-1" } }) });
        const after = await (await fetch("/api/work/schedule")).json();
        return { status: response.status, beforeRevision: before.schedule.revision, afterRevision: after.schedule.revision };
      });
      assert.equal(invalidDemandScope.status, 400, "Work Package demand cannot cross workspace scope");
      assert.equal(invalidDemandScope.afterRevision, invalidDemandScope.beforeRevision);
      if (!covered) {
        await row.getByRole("button", { name: "View work" }).click();
        await page.getByRole("heading", { name: "Crew demand by Work Package" }).waitFor();
        const packagePlan = page.locator(".d5o-package-demand-card").filter({ hasText: "Service integration plan" });
        assert.equal(await packagePlan.getByLabel("Required date 1").inputValue(), demand.requiredSlots[0].date);
        assert.equal(await packagePlan.getByLabel("Required shift 1").inputValue(), demand.requiredSlots[0].shift);
        await page.screenshot({ path: resolve(output, "rybex-package-demand.png"), fullPage: true });
        await packagePlan.getByRole("button", { name: "Save crew requirement" }).click();
        await page.getByRole("status").getByText(/required crew dates and shifts saved/).waitFor();
      }
      const afterSave = await page.evaluate(async () => (await (await fetch("/api/work/schedule")).json()).schedule);
      assert.equal(afterSave.revision, schedule.revision, "Saving identical Work Package demand is idempotent");
    } else {
      assert.equal(await queue.getByText("Rollout authorization package").count(), 0, "Decision-only packages are not staffing demand");
      await queue.getByText(/\d+ slots? to schedule/).waitFor();
      const attemptedDecisionBooking = await page.evaluate(async () => {
        const current = await (await fetch("/api/work/schedule")).json();
        const schedule = current.schedule;
        const invalid = { id: "verify-decision-only-booking", crew: "Field crew", people: ["Harper Singh", "Noah James", "Aisha Brown"], workId: "rotork-1", packageId: "wp-rollout-rotork-1", week: 0, day: 4, date: "2026-10-09", shift: "07:00–15:30" };
        const response = await fetch("/api/work/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-assignments", expectedRevision: schedule.revision, assignments: [...schedule.assignments, invalid] }) });
        const after = await (await fetch("/api/work/schedule")).json();
        return { status: response.status, body: await response.json(), beforeRevision: schedule.revision, afterRevision: after.schedule.revision };
      });
      assert.equal(attemptedDecisionBooking.status, 409, "The server rejects a crew booking on a decision-only package");
      assert.match(JSON.stringify(attemptedDecisionBooking.body), /authorization package/);
      assert.equal(attemptedDecisionBooking.afterRevision, attemptedDecisionBooking.beforeRevision, "Rejected booking does not change the schedule");
      const attemptedDecisionDemand = await page.evaluate(async () => {
        const before = await (await fetch("/api/work/schedule")).json();
        const requirement = before.schedule.packageDemands.find((item) => item.packageId === "wp-rollout-rotork-1");
        const response = await fetch("/api/work/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-demand", expectedRevision: before.schedule.revision, demand: { ...requirement, crewSchedulable: true } }) });
        const after = await (await fetch("/api/work/schedule")).json();
        return { status: response.status, beforeRevision: before.schedule.revision, afterRevision: after.schedule.revision };
      });
      assert.equal(attemptedDecisionDemand.status, 400, "A decision package cannot be converted into crew work by a demand edit");
      assert.equal(attemptedDecisionDemand.afterRevision, attemptedDecisionDemand.beforeRevision);
    }
    await ctx.close();
  }
  console.log("D5O scheduler queue: Rybex and Rotork layout, dated unstaffed action, estimate separation, and no inner scroll PASS");
} finally { await browser.close(); }
