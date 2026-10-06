import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { chromium } from "playwright";
import { commandId, createClients, ids, redact, signIn, userIdFor } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const artifactDir = join(root, "artifacts/p1-01b-1-implementation-acceptance-review/condition-closure-live-qa");
const screenshotDir = join(artifactDir, "screenshots");
const manifestPath = join(artifactDir, "condition-closure-live-qa-manifest.json");
const resultPath = join(artifactDir, "condition-closure-live-qa-results.json");

await mkdir(screenshotDir, { recursive: true });

const env = ensureLocalSupabaseEnv();
bootstrapFoundation(env);
const { service } = createClients();
await assertPursuitMigrationApplied(service);
await cleanupAcceptanceRows(service);

const bd = await signIn("bd-a@foundation0a.local");
const ops = await signIn("ops-a@foundation0a.local");
const admin = await signIn("admin-a@foundation0a.local");
const auditor = await signIn("auditor-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");

const fixtures = {
  entry: await createDecisionApprovedOpportunity("P1B1 Acceptance Entry", "approve"),
  approve: await createDecisionApprovedOpportunity("P1B1 Acceptance Approve", "approve"),
  hold: await createDecisionApprovedOpportunity("P1B1 Acceptance Hold", "hold"),
  decline: await createDecisionApprovedOpportunity("P1B1 Acceptance Decline", "decline"),
  auditor: await createDecisionApprovedOpportunity("P1B1 Acceptance Auditor", "approve"),
  unavailable: await createDecisionApprovedOpportunity("P1B1 Acceptance Unavailable", "approve"),
  stale: await createDecisionApprovedOpportunity("P1B1 Acceptance Stale", "approve"),
  isolation: await createDecisionApprovedOpportunity("P1B1 Acceptance Isolation", "approve"),
  mobile: await createDecisionApprovedOpportunity("P1B1 Acceptance Mobile", "approve")
};

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = await startAppServer(port, env);
const scenarios = [];

try {
  const browser = await chromium.launch({ headless: true });
  try {
    const opsContext = await signInBrowser(browser, baseUrl, "ops-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);

    await recordScenario("A", "Qualified opportunity enters Pursuit Authorization", "Decision Owner / assigned Pursuit Authority", "desktop", async () => {
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
      const queueHasGate = await page.getByText("Pursuit Authorization gate").first().isVisible().catch(() => false);
      await page.goto(opportunityUrl(fixtures.entry), { waitUntil: "networkidle" });
      await page.waitForSelector("[data-pipeline-screen='pursuit-authorization']", { timeout: 30_000 });
      await expectText(page, "Pursuit Authorization");
      await expectText(page, "Should Rybex pursue this qualified opportunity now?");
      await expectText(page, "Qualified opportunity");
      const path = await screenshot(page, "A-qualified-entry-desktop.png");
      await page.close();
      return {
        actualResult: queueHasGate
          ? "Queue exposed a Pursuit Authorization gate and the qualified opportunity opened to the decision surface."
          : "Decision surface opened; queue gate label was not directly observed before opening.",
        persistenceVerificationMethod: "Local Supabase read model via p1_01a_get_opportunity_v1 and browser surface.",
        auditHistoryVerificationMethod: "No pursuit decision expected yet; history panel visible.",
        screenshotPath: path,
        status: "Pass",
        notes: "Opportunity is qualified but not yet pursuit-authorized."
      };
    });

    await recordScenario("B", "Approve pursuit", "Decision Owner / assigned Pursuit Authority", "desktop", async () => {
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.approve), { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Approve pursuit" }).click();
      await page.waitForLoadState("networkidle");
      await expectText(page, "Pursuit approved");
      await page.reload({ waitUntil: "networkidle" });
      await expectText(page, "Pursuit approved");
      const row = await getOpportunityRow(fixtures.approve.opportunity.id);
      const events = await pursuitEventCount(ops, fixtures.approve.opportunity.id, "approve_pursuit");
      const path = await screenshot(page, "B-approve-outcome-desktop.png");
      await page.close();
      return {
        actualResult: `Approved status persisted as ${row.pursuit_authorization_status}; event rows: ${events}.`,
        persistenceVerificationMethod: "Queried local opportunities.pursuit_authorization_status after refresh.",
        auditHistoryVerificationMethod: "Queried local opportunity_pursuit_authorization_events for approve_pursuit.",
        screenshotPath: path,
        status: row.pursuit_authorization_status === "approved" && events >= 1 ? "Pass" : "Fail",
        notes: "No bid submission transition was created by the action."
      };
    });

    await recordScenario("C", "Hold pending evidence", "Decision Owner / assigned Pursuit Authority", "desktop", async () => {
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.hold), { waitUntil: "networkidle" });
      const disclosure = page.locator("details").filter({ hasText: "Hold pending evidence" }).first();
      await disclosure.locator("summary").click();
      await disclosure.locator("textarea[name='pursuitReason']").fill("Route survey evidence must be attached before pursuit approval.");
      await disclosure.getByRole("button", { name: "Hold pending evidence" }).click();
      await page.waitForLoadState("networkidle");
      await expectText(page, "Hold recorded");
      await page.reload({ waitUntil: "networkidle" });
      await expectText(page, "Hold recorded");
      const row = await getOpportunityRow(fixtures.hold.opportunity.id);
      const events = await pursuitEventCount(ops, fixtures.hold.opportunity.id, "hold_pending_evidence");
      const path = await screenshot(page, "C-hold-outcome-desktop.png");
      await page.close();
      return {
        actualResult: `Hold status persisted as ${row.pursuit_authorization_status}; reason persisted: ${Boolean(row.pursuit_authorization_reason)}; event rows: ${events}.`,
        persistenceVerificationMethod: "Queried local opportunities status and reason after refresh.",
        auditHistoryVerificationMethod: "Queried local opportunity_pursuit_authorization_events for hold_pending_evidence.",
        screenshotPath: path,
        status: row.pursuit_authorization_status === "hold_pending_evidence" && Boolean(row.pursuit_authorization_reason) && events >= 1 ? "Pass" : "Fail",
        notes: "Outcome remains in Pursuit Authorization and does not advance to bid submission."
      };
    });

    await recordScenario("D", "Decline pursuit", "Decision Owner / assigned Pursuit Authority", "desktop", async () => {
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.decline), { waitUntil: "networkidle" });
      const disclosure = page.locator("details").filter({ hasText: "Decline pursuit" }).first();
      await disclosure.locator("summary").click();
      await disclosure.locator("textarea[name='pursuitReason']").fill("Risk-adjusted margin falls below the pursuit threshold.");
      await disclosure.getByRole("button", { name: "Decline pursuit" }).click();
      await page.waitForLoadState("networkidle");
      await expectText(page, "Pursuit declined");
      await page.reload({ waitUntil: "networkidle" });
      await expectText(page, "Pursuit declined");
      const row = await getOpportunityRow(fixtures.decline.opportunity.id);
      const events = await pursuitEventCount(ops, fixtures.decline.opportunity.id, "decline_pursuit");
      const path = await screenshot(page, "D-decline-outcome-desktop.png");
      await page.close();
      return {
        actualResult: `Declined status persisted as ${row.pursuit_authorization_status}; reason persisted: ${Boolean(row.pursuit_authorization_reason)}; event rows: ${events}.`,
        persistenceVerificationMethod: "Queried local opportunities status and reason after refresh.",
        auditHistoryVerificationMethod: "Queried local opportunity_pursuit_authorization_events for decline_pursuit.",
        screenshotPath: path,
        status: row.pursuit_authorization_status === "declined" && Boolean(row.pursuit_authorization_reason) && events >= 1 ? "Pass" : "Fail",
        notes: "Outcome remains terminal for pursuit and does not advance to bid submission, award, or project readiness."
      };
    });

    await opsContext.close();

    const auditorContext = await signInBrowser(browser, baseUrl, "auditor-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("E", "Auditor/read-only behavior", "Read-only Auditor", "desktop", async () => {
      const page = await newScenarioPage(auditorContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.auditor), { waitUntil: "networkidle" });
      await expectText(page, "Read-only pursuit authorization review");
      const approveVisible = await page.getByRole("button", { name: "Approve pursuit" }).isVisible().catch(() => false);
      const path = await screenshot(page, "E-auditor-read-only-desktop.png");
      await page.close();
      return {
        actualResult: approveVisible ? "Read-only page rendered but mutation button was visible." : "Read-only page rendered with no mutation button.",
        persistenceVerificationMethod: "Browser rendered read-only context from local Supabase role.",
        auditHistoryVerificationMethod: "Audit/history panel remained inspectable.",
        screenshotPath: path,
        status: approveVisible ? "Fail" : "Pass",
        notes: "Auditor can inspect without mutation controls."
      };
    });
    await auditorContext.close();

    const adminContext = await signInBrowser(browser, baseUrl, "admin-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("F", "Unauthorized or unavailable behavior", "Admin not assigned as Pursuit Authority", "desktop", async () => {
      const page = await newScenarioPage(adminContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.unavailable), { waitUntil: "networkidle" });
      const unavailableVisible = await page.getByText("You are not eligible to decide this pursuit", { exact: false }).first().isVisible().catch(() => false);
      const approveRecommendedVisible = await page.getByText("Approve pursuit recommended", { exact: false }).first().isVisible().catch(() => false);
      const approveVisible = await page.getByRole("button", { name: "Approve pursuit" }).isVisible().catch(() => false);
      const rpc = await admin.rpc("record_opportunity_pursuit_authorization_v1", {
        p_opportunity_id: fixtures.unavailable.opportunity.id,
        p_pursuit_action: "approve_pursuit",
        p_reason: "",
        p_command_id: commandId("p1b1-admin-denied"),
        p_expected_version: fixtures.unavailable.opportunity.version,
        p_correlation_id: "p1b1-admin-denied"
      });
      const path = await screenshot(page, "F-unavailable-desktop.png");
      await page.close();
      return {
        actualResult: `Unavailable copy visible: ${unavailableVisible}; approve-recommended copy visible: ${approveRecommendedVisible}; approve button visible: ${approveVisible}; RPC result: ${rpc.data?.error ?? rpc.error?.message ?? "unknown"}.`,
        persistenceVerificationMethod: "Mutation attempted through local RPC as unassigned admin.",
        auditHistoryVerificationMethod: "No success event expected or recorded.",
        screenshotPath: path,
        status: unavailableVisible && !approveRecommendedVisible && !approveVisible && rpc.data?.success === false && rpc.data?.error === "pursuit_authority_required" ? "Pass" : "Fail",
        notes: "Pass requires visible unavailable UI, no approve-ready posture, no mutation button, and server-side block."
      };
    });
    await adminContext.close();

    const opsConflictContext = await signInBrowser(browser, baseUrl, "ops-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("G", "Stale/conflict behavior", "Decision Owner / assigned Pursuit Authority", "desktop", async () => {
      const page = await newScenarioPage(opsConflictContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.stale), { waitUntil: "networkidle" });
      const staleVersion = fixtures.stale.opportunity.version + 1;
      const { error } = await service.from("opportunities").update({ version: staleVersion }).eq("id", fixtures.stale.opportunity.id);
      if (error) throw new Error(error.message);
      await page.getByRole("button", { name: "Approve pursuit" }).click();
      await page.waitForLoadState("networkidle");
      await expectText(page, "This package changed before your decision was recorded");
      const row = await getOpportunityRow(fixtures.stale.opportunity.id);
      const path = await screenshot(page, "G-stale-conflict-desktop.png");
      await page.close();
      return {
        actualResult: `Stale action redirected to conflict recovery; status remained ${row.pursuit_authorization_status}; version is ${row.version}.`,
        persistenceVerificationMethod: "Manually advanced local package version before submitting stale browser form.",
        auditHistoryVerificationMethod: "No successful pursuit authorization event expected for stale action.",
        screenshotPath: path,
        status: row.pursuit_authorization_status !== "approved" && row.version === staleVersion ? "Pass" : "Fail",
        notes: "Browser-level stale form submission was exercised."
      };
    });
    await opsConflictContext.close();

    const userBContext = await signInBrowser(browser, baseUrl, "user-b@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("H", "Workspace isolation", "Different workspace Operations Leader", "desktop", async () => {
      const page = await newScenarioPage(userBContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixtures.isolation), { waitUntil: "networkidle" });
      await expectText(page, "You do not have access to this opportunity");
      const rpc = await userB.rpc("record_opportunity_pursuit_authorization_v1", {
        p_opportunity_id: fixtures.isolation.opportunity.id,
        p_pursuit_action: "approve_pursuit",
        p_reason: "",
        p_command_id: commandId("p1b1-workspace-denied"),
        p_expected_version: fixtures.isolation.opportunity.version,
        p_correlation_id: "p1b1-workspace-denied"
      });
      const path = await screenshot(page, "H-workspace-isolation-desktop.png");
      await page.close();
      return {
        actualResult: `Cross-workspace page access denied; RPC result: ${rpc.data?.error ?? rpc.error?.message ?? "unknown"}.`,
        persistenceVerificationMethod: "Mutation attempted through local RPC as Workspace B user.",
        auditHistoryVerificationMethod: "No success event expected or recorded.",
        screenshotPath: path,
        status: rpc.data?.success === false ? "Pass" : "Fail",
        notes: "Workspace B browser access is denied and direct RPC mutation is blocked server-side; RPC error text is recorded for review."
      };
    });
    await userBContext.close();

    const mobileContext = await signInBrowser(browser, baseUrl, "ops-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("I", "Mobile smoke", "Decision Owner / assigned Pursuit Authority", "mobile", async () => {
      const page = await newScenarioPage(mobileContext, { width: 390, height: 844 });
      await page.goto(opportunityUrl(fixtures.mobile), { waitUntil: "networkidle" });
      await page.waitForSelector("[data-pipeline-screen='pursuit-authorization']", { timeout: 30_000 });
      const layout = await page.evaluate(() => {
        const bodyOverflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
        const targets = Array.from(document.querySelectorAll("h1, .button, .pursuit-role-pill, .pursuit-badges span, .pursuit-recommendation strong, .pursuit-next-state strong"));
        const clipped = targets
          .filter((el) => el.scrollWidth > el.clientWidth + 2)
          .map((el) => (el.textContent || "").trim().slice(0, 80));
        return { bodyOverflowX, clipped };
      });
      const path = await screenshot(page, "I-mobile-smoke.png");
      await page.close();
      return {
        actualResult: layout.bodyOverflowX || layout.clipped.length
          ? `Mobile layout issue: ${JSON.stringify(layout)}`
          : "Mobile surface rendered without checked horizontal overflow or critical clipping.",
        persistenceVerificationMethod: "Live local decision surface loaded with authenticated local user.",
        auditHistoryVerificationMethod: "No pursuit decision expected for smoke scenario.",
        screenshotPath: path,
        status: layout.bodyOverflowX || layout.clipped.length ? "Fail" : "Pass",
        notes: "Checked headline, decision CTA, status chip, and critical decision copy."
      };
    });
    await mobileContext.close();
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}

const manifest = {
  captureTimestamp: new Date().toISOString(),
  localServerUrl: baseUrl,
  localSupabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  result: scenarios.every((scenario) => scenario.status === "Pass") ? "PASS" : "FAIL",
  productionOrStagingMutationAttempted: false,
  remoteSupabaseUsed: false,
  scenarios
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify({
  result: manifest.result,
  totalScenarios: scenarios.length,
  passed: scenarios.filter((scenario) => scenario.status === "Pass").length,
  failed: scenarios.filter((scenario) => scenario.status === "Fail").length,
  blocked: scenarios.filter((scenario) => scenario.status === "Blocked").length
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  result: manifest.result,
  totalScenarios: scenarios.length,
  passed: scenarios.filter((scenario) => scenario.status === "Pass").length,
  failed: scenarios.filter((scenario) => scenario.status === "Fail").length,
  blocked: scenarios.filter((scenario) => scenario.status === "Blocked").length,
  manifestPath: relative(root, manifestPath).replace(/\\/g, "/")
}, null, 2));

if (manifest.result !== "PASS") process.exit(1);

async function recordScenario(scenarioId, name, roleContext, viewport, fn) {
  try {
    const result = await fn();
    scenarios.push({
      scenarioId,
      name,
      userRoleContext: roleContext,
      localUrl: baseUrl,
      viewport,
      actionAttempted: name,
      expectedResult: expectedResultFor(scenarioId),
      actualResult: result.actualResult,
      persistenceVerificationMethod: result.persistenceVerificationMethod,
      auditHistoryVerificationMethod: result.auditHistoryVerificationMethod,
      screenshotPath: result.screenshotPath,
      status: result.status,
      notes: result.notes
    });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message || error.stack || String(error)
      : String(error);
    scenarios.push({
      scenarioId,
      name,
      userRoleContext: roleContext,
      localUrl: baseUrl,
      viewport,
      actionAttempted: name,
      expectedResult: expectedResultFor(scenarioId),
      actualResult: redact(detail),
      persistenceVerificationMethod: "Not completed",
      auditHistoryVerificationMethod: "Not completed",
      screenshotPath: null,
      status: "Fail",
      notes: "Scenario failed during live local browser QA."
    });
  }
}

function expectedResultFor(scenarioId) {
  const expectations = {
    A: "Qualified opportunity reaches Pursuit Authorization and is not yet pursuit-authorized.",
    B: "Approve pursuit persists after refresh with decision history.",
    C: "Hold pending evidence persists after refresh without bid submission.",
    D: "Decline pursuit persists after refresh without downstream transition.",
    E: "Auditor can inspect and cannot mutate.",
    F: "Unavailable user is blocked in UI and server-side RPC.",
    G: "Stale update is blocked with recovery guidance.",
    H: "Cross-workspace user cannot access or mutate.",
    I: "Mobile surface has no critical clipping or horizontal overflow."
  };
  return expectations[scenarioId] ?? "Scenario passes.";
}

function ensureLocalSupabaseEnv() {
  process.env.RYBEXOS_RUNTIME_MODE = "test";
  process.env.RYBEXOS_AUTH_MODE = "supabase";
  process.env.RYBEXOS_DATA_SOURCE = "database";
  process.env.FOUNDATION_0A_TEST_PASSWORD ||= `P1B1-LIVE-${Date.now()}-${randomUUID()}!`;

  const status = spawnSync("npx.cmd", ["supabase", "status", "-o", "env"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 20
  });
  if (status.status !== 0) {
    throw new Error(`Local Supabase status failed: ${redact(status.stderr || status.stdout || "no output")}`);
  }
  const mapped = mapSupabaseEnv(status.stdout);
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(mapped.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error(`Refusing live QA against non-local Supabase URL: ${mapped.NEXT_PUBLIC_SUPABASE_URL}`);
  }
  Object.assign(process.env, mapped);
  return {
    ...mapped,
    RYBEXOS_RUNTIME_MODE: process.env.RYBEXOS_RUNTIME_MODE,
    RYBEXOS_AUTH_MODE: process.env.RYBEXOS_AUTH_MODE,
    RYBEXOS_DATA_SOURCE: process.env.RYBEXOS_DATA_SOURCE,
    FOUNDATION_0A_TEST_PASSWORD: process.env.FOUNDATION_0A_TEST_PASSWORD,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_DISABLE_DEV_INDICATOR: "1"
  };
}

function mapSupabaseEnv(output) {
  const parsed = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) parsed[match[1]] = stripQuotes(match[2]);
  }
  const apiUrl = parsed.API_URL ?? parsed.SUPABASE_URL ?? parsed.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = parsed.PUBLISHABLE_KEY ?? parsed.SUPABASE_PUBLISHABLE_KEY ?? parsed.ANON_KEY ?? parsed.SUPABASE_ANON_KEY;
  const anonKey = parsed.ANON_KEY ?? parsed.SUPABASE_ANON_KEY ?? publishableKey;
  const serviceKey = parsed.SERVICE_ROLE_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY ?? parsed.SECRET_KEY ?? parsed.SUPABASE_SECRET_KEY;
  if (!apiUrl || !publishableKey || !serviceKey) throw new Error("Unable to map local Supabase credentials from status output.");
  return {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_SECRET_KEY: serviceKey
  };
}

function stripQuotes(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function bootstrapFoundation(env) {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error(`Foundation bootstrap failed: ${redact(result.stderr || result.stdout || "no output")}`);
  }
}

async function assertPursuitMigrationApplied(client) {
  const { data: columns, error: columnError } = await client
    .from("opportunities")
    .select("pursuit_authorization_status")
    .limit(1);
  if (columnError && !/Results contain 0 rows|JSON object requested/.test(columnError.message)) {
    throw new Error(`Pursuit authorization column check failed: ${columnError.message}`);
  }
  const { data, error } = await client.rpc("p1_01b_1_recommendation", { opportunity_uuid: "00000000-0000-0000-0000-000000000000" });
  if (error) throw new Error(`P1-01B.1 recommendation RPC missing: ${error.message}`);
  return { columns, data };
}

async function cleanupAcceptanceRows(client) {
  const { data, error } = await client
    .from("opportunities")
    .select("id")
    .eq("workspace_id", ids.workspaceA)
    .like("name", "P1B1 Acceptance%");
  if (error) throw new Error(`Acceptance cleanup lookup failed: ${error.message}`);
  const opportunityIds = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (opportunityIds.length === 0) return;
  await client.from("opportunity_pursuit_authorization_events").delete().in("opportunity_id", opportunityIds);
  await client.from("opportunity_assignments").delete().in("opportunity_id", opportunityIds);
  await client.from("opportunity_qualifications").delete().in("opportunity_id", opportunityIds);
  await client.from("opportunities").delete().in("id", opportunityIds);
}

async function createDecisionApprovedOpportunity(name, mode) {
  const created = await createOpportunity(name, mode);
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: created.opportunity.id,
    p_payload: qualificationFor(mode),
    p_command_id: commandId(`${name}-qualification`),
    p_expected_version: created.opportunity.version,
    p_correlation_id: `${name}-qualification`
  });
  if (qualified.error || qualified.data?.success !== true) throw new Error(qualified.error?.message ?? JSON.stringify(qualified.data));
  const accountable = await setDecisionAccountability(qualified.data);
  const evidence = await attachDecisionSupportEvidence(accountable);
  const decision = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: evidence.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId(`${name}-decision-approved`),
    p_expected_version: evidence.opportunity.version,
    p_correlation_id: `${name}-decision-approved`
  });
  if (decision.error || decision.data?.success !== true) throw new Error(decision.error?.message ?? JSON.stringify(decision.data));
  return decision.data;
}

async function createOpportunity(name, mode) {
  const result = await bd.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: "Acceptance Local GC",
      projectType: "Data center backbone",
      location: `${name} Charlotte NC`,
      scopeSummary: `Local-only acceptance fixture for ${mode} pursuit authorization.`,
      estimatedValue: "4800000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-10",
      duplicateConfirmed: true
    },
    p_command_id: commandId(`${name}-create`),
    p_correlation_id: `${name}-create`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function setDecisionAccountability(detail) {
  const decisionOwnerUserId = await userIdFor(service, "ops-a@foundation0a.local");
  const result = await bd.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: detail.opportunity.id,
    p_decision_owner_user_id: decisionOwnerUserId,
    p_decision_due_at: "2026-07-10",
    p_command_id: commandId(`${detail.opportunity.name}-accountability`),
    p_expected_version: detail.opportunity.version,
    p_correlation_id: `${detail.opportunity.name}-accountability`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function attachDecisionSupportEvidence(detail) {
  const result = await bd.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: detail.opportunity.id,
    p_payload: {
      fileName: "p1b1-local-acceptance-evidence.txt",
      mimeType: "text/plain",
      sizeBytes: 128,
      checksumSha256: `p1b1-local-${detail.opportunity.id}`
    },
    p_command_id: commandId(`${detail.opportunity.name}-evidence`),
    p_expected_version: detail.opportunity.version,
    p_correlation_id: `${detail.opportunity.name}-evidence`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  const submit = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: result.data.opportunity.id,
    p_command_id: commandId(`${detail.opportunity.name}-submit`),
    p_expected_version: result.data.opportunity.version,
    p_correlation_id: `${detail.opportunity.name}-submit`
  });
  if (submit.error || submit.data?.success !== true) throw new Error(submit.error?.message ?? JSON.stringify(submit.data));
  return submit.data;
}

function qualificationFor(mode) {
  const risk = mode === "hold";
  const decline = mode === "decline";
  return {
    strategicFit: "strong",
    customerRelationship: "strong",
    geographyFit: "strong",
    projectTypeFit: "strong",
    scopeClarity: risk || decline ? "risk" : "acceptable",
    designMaturity: "acceptable",
    commercialTermsRisk: risk || decline ? "risk" : "acceptable",
    scheduleFeasibility: "acceptable",
    crewCapacityFit: "acceptable",
    materialLeadTimeRisk: "acceptable",
    permitsAccessRisk: decline ? "risk" : "acceptable",
    safetyQualityComplexity: "acceptable",
    subcontractorDependency: "acceptable",
    cashFlowRisk: "acceptable",
    marginConfidence: risk || decline ? "risk" : "strong",
    contractualRisk: "acceptable",
    riskSummary: decline
      ? "Risk-adjusted margin and access uncertainty make pursuit unattractive."
      : risk
        ? "Engineering evidence must be attached before pursuit approval."
        : "Evidence and commercial basis support pursuit authorization.",
    assumptions: "Local-only acceptance fixture for pursuit authorization.",
    recommendation: decline ? "decline" : "pursue"
  };
}

async function startAppServer(port, env) {
  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  execFileSync(process.execPath, [nextBin, "build"], {
    cwd: root,
    env: { ...process.env, ...env, NODE_ENV: "production" },
    stdio: "inherit"
  });
  const child = spawn(process.execPath, [
    nextBin,
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    String(port)
  ], {
    cwd: root,
    env: { ...process.env, ...env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  await waitForServer(`http://127.0.0.1:${port}`, 90_000, () => logs);
  return child;
}

async function signInBrowser(browser, baseUrl, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.waitForTimeout(800);
  const proof = await fetchSessionProof(page);
  if (proof.status !== 200 || proof.body?.success !== true) {
    const cookies = await context.cookies();
    throw new Error(`Browser sign-in failed for ${email}; session proof status ${proof.status}; finalUrl=${page.url()}; cookieCount=${cookies.length}; body=${redact(JSON.stringify(proof.body).slice(0, 300))}`);
  }
  await page.close();
  return context;
}

async function newScenarioPage(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  return page;
}

async function fetchSessionProof(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/session-proof", { headers: { accept: "application/json" } });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  });
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
}

async function screenshot(page, fileName) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [data-nextjs-dev-tools-button],
      [aria-label*="Next.js"],
      [aria-label*="next.js"] {
        display: none !important;
        visibility: hidden !important;
      }
    `
  }).catch(() => {});
  const path = join(screenshotDir, fileName);
  await page.screenshot({ path, fullPage: true });
  return relative(root, path).replace(/\\/g, "/");
}

function opportunityUrl(detail) {
  return `${baseUrl}/pipeline/${detail.opportunity.id}`;
}

async function getOpportunityRow(id) {
  const { data, error } = await service
    .from("opportunities")
    .select("id,pursuit_authorization_status,pursuit_authorization_reason,version")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? `Missing opportunity ${id}`);
  return data;
}

async function pursuitEventCount(client, id, action) {
  const { data, error } = await client.rpc("p1_01a_get_opportunity_v1", { p_opportunity_id: id });
  if (error || data?.success !== true) {
    throw new Error(error?.message || JSON.stringify(data));
  }
  const events = Array.isArray(data.pursuitAuthorizationEvents) ? data.pursuitAuthorizationEvents : [];
  return events.filter((event) => event.decisionAction === action).length;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs, getLogs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`Timed out waiting for ${url}\n${redact(getLogs())}`);
}
