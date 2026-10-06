import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// A fresh browser context keeps this synthetic journey out of a reviewer's saved prototype state.
const base = "http://127.0.0.1:61431";
const plan = JSON.parse(readFileSync("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json", "utf8"));
const fixture = plan.scenarios.find((scenario) => scenario.name === "rybex");
assert(fixture, "Rybex synthetic actor fixture is required");
const localPassword = readFileSync(".rybexos-local/m1-s1/brc-test-password", "utf8").trim();
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 980 } })).newPage();
  await page.goto(`${base}/auth/sign-in?next=%2Fwork`);
  await page.getByLabel("Email", { exact: true }).fill(fixture.actors.preparer.email);
  await page.getByLabel("Password", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Continue to your work", exact: true }).click();
  await page.waitForURL("**/work");
  const catalog = await page.evaluate(async () => {
    const read = await fetch("/api/work/catalog", { cache: "no-store" });
    const snapshot = await read.json();
    const write = await fetch("/api/work/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invalid", expectedRevision: snapshot.catalog?.revision }) });
    return { readStatus: read.status, canEdit: snapshot.canEdit, writeStatus: write.status, write: await write.json() };
  });
  assert.equal(catalog.readStatus, 200);
  assert.equal(catalog.canEdit, true);
  assert.equal(catalog.writeStatus, 400);
  assert.equal(catalog.write.error, "invalid_action");
  const spoofed = await page.request.post(`${base}/api/work/catalog`, {
    headers: { Origin: "http://127.0.0.1:61430", "Sec-Fetch-Site": "same-origin" },
    data: { action: "invalid", expectedRevision: 1 }
  });
  assert.equal(spoofed.status(), 403);
  assert.equal((await spoofed.json()).error, "invalid_origin");
  checks.push("61431 shared catalog writes reach validation without weakening same-origin scope");
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await page.locator(".d5o-portfolio-register button").filter({ hasText: "North Campus Data Hall Turnover" }).click();
  await page.getByRole("button", { name: "Readiness", exact: true }).click();
  assert.match(await page.locator(".d5o-record-workspace.is-blocked").innerText(), /condition|blocked|issue/i);
  checks.push("open condition blocks quality decision");

  await page.getByRole("button", { name: "Issues & changes", exact: true }).click();
  await page.getByRole("button", { name: /Add and review required proof/i }).click();
  await page.getByRole("textbox", { name: "Evidence name" }).fill("Unrelated turnover test result");
  await page.getByRole("textbox", { name: "Evidence source or identifier" }).fill("synthetic://unrelated-turnover-test");
  await page.getByRole("combobox", { name: "Applies to package" }).selectOption("wp-turnover-rybex-1");
  await page.getByRole("button", { name: "Add draft reference" }).click();
  await page.locator("details.d5o-task-disclosure").filter({ hasText: "Review other draft references" }).locator("summary").click();
  await page.getByRole("textbox", { name: "Review note" }).fill("Synthetic source inspected; belongs to turnover package");
  await page.getByRole("checkbox", { name: /I inspected the identified source/i }).check();
  await page.getByRole("button", { name: "Record reference review" }).click();
  await page.getByRole("button", { name: "Issues & changes", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Record resolution" }).count(), 0);
  checks.push("reviewed proof for another package cannot clear FT-24");
  await page.getByRole("button", { name: /Add and review required proof/i }).click();
  await page.getByRole("textbox", { name: "Evidence name" }).fill("Synthetic FT-24 retest result");
  await page.getByRole("textbox", { name: "Evidence source or identifier" }).fill("synthetic://ft-24-retest");
  await page.getByRole("button", { name: "Add draft reference" }).click();
  await page.getByRole("textbox", { name: "Review note" }).fill("Synthetic retest source inspected for prototype journey");
  await page.getByRole("checkbox", { name: /I inspected the identified source/i }).check();
  await page.getByRole("button", { name: "Record reference review" }).click();
  checks.push("draft proof requires explicit source review");

  await page.getByRole("button", { name: "Issues & changes", exact: true }).click();
  await page.locator(".d5o-issue-resolution select[name='proofId']").selectOption({ label: "Synthetic FT-24 retest result" });
  await page.locator(".d5o-issue-resolution input[name='resolution']").fill("FT-24 retested and passed in synthetic review");
  await page.getByRole("button", { name: "Record resolution" }).click();
  assert.match(await page.locator(".d5o-issue-list").innerText(), /No uncontrolled issue is open/i);
  checks.push("issue clears only with newly reviewed matching proof");

  await page.getByRole("button", { name: "Execution", exact: true }).click();
  const fibre = page.locator(".d5o-package-list article").filter({ hasText: "Fiber trunks and termination" }).first();
  await fibre.locator("input[name='tested']").fill("100");
  await fibre.getByRole("button", { name: "Save actual quantities" }).click();
  await fibre.getByRole("button", { name: "Record acceptance" }).click();
  const turnover = page.locator(".d5o-package-list article").filter({ hasText: "Certification and turnover package" }).first();
  await turnover.getByRole("button", { name: "Record acceptance" }).click();
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem("d5o.full-prototype.v3:rybex") ?? "{}");
    const target = saved.work?.find((item) => item.id === "rybex-1");
    return target?.packages?.filter((item) => item.status === "accepted").length === 3;
  });
  checks.push("installed, tested, and accepted package facts remain distinct");

  await page.getByRole("button", { name: "Readiness", exact: true }).click();
  await page.locator(".d5o-decision-composer textarea").fill("Synthetic quality verification after FT-24 retest and package acceptance");
  await page.getByRole("button", { name: "Verify certification results", exact: true }).click();
  assert.match(await page.locator(".d5o-stage-badge").innerText(), /Customer acceptance/i);
  checks.push("quality verification advances to separate customer acceptance");

  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByRole("textbox", { name: "Evidence name" }).fill("Package-level receipt only");
  await page.getByRole("textbox", { name: "Evidence source or identifier" }).fill("synthetic://package-receipt");
  await page.getByRole("combobox", { name: "Applies to package" }).selectOption("wp-fibre-rybex-1");
  await page.getByRole("button", { name: "Add draft reference" }).click();
  await page.locator("details.d5o-task-disclosure").filter({ hasText: "Review other draft references" }).locator("summary").click();
  await page.getByRole("textbox", { name: "Review note" }).fill("Package receipt inspected, but not owner acceptance");
  await page.getByRole("checkbox", { name: /I inspected the identified source/i }).check();
  await page.getByRole("button", { name: "Record reference review" }).click();
  await page.getByRole("button", { name: "Readiness", exact: true }).click();
  assert.match(await page.locator(".d5o-record-workspace.is-blocked").innerText(), /acceptance record/i);
  checks.push("package-scoped receipt cannot substitute for Work Record owner acceptance");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByRole("textbox", { name: "Evidence name" }).fill("Synthetic owner acceptance record");
  await page.getByRole("textbox", { name: "Evidence source or identifier" }).fill("synthetic://owner-acceptance");
  await page.getByRole("button", { name: "Add draft reference" }).click();
  await page.getByRole("textbox", { name: "Review note" }).fill("Synthetic owner acceptance source inspected");
  await page.getByRole("checkbox", { name: /I inspected the identified source/i }).check();
  await page.getByRole("button", { name: "Record reference review" }).click();
  await page.getByRole("button", { name: "Readiness", exact: true }).click();
  await page.locator(".d5o-decision-composer textarea").fill("Synthetic owner acceptance supported by reviewed acceptance record");
  await page.getByRole("button", { name: "Record owner acceptance", exact: true }).click();
  assert.match(await page.locator(".d5o-stage-badge").innerText(), /Accepted and handed over/i);
  checks.push("customer acceptance retains a distinct reviewed record and outcome");

  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await page.locator(".d5o-portfolio-register button").filter({ hasText: "Generator Monitoring Upgrade" }).click();
  await page.getByRole("button", { name: "Execution", exact: true }).click();
  const monitoring = page.locator(".d5o-package-list article").filter({ hasText: "Monitoring equipment and site survey" }).first();
  await monitoring.getByRole("button", { name: "Start package" }).click();
  await monitoring.getByRole("button", { name: "Add proof for this package" }).click();
  assert.equal(await page.getByRole("combobox", { name: "Applies to package" }).inputValue(), "wp-monitoring-rybex-3");
  assert.match(await page.locator(".d5o-record-task-card").innerText(), /Monitoring equipment and site survey/i);
  checks.push("package proof action opens Evidence with the affected package selected");

  console.log(JSON.stringify({ status: "PASS", checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", checks, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
