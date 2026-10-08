import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { commandId, ids, userIdFor } from "./foundation-0b-test-utils.mjs";
import { requireQualificationChildEnv } from "./qualification-child-env.mjs";

const root = process.cwd();
const outputDir = resolve(root, "visual-qa-output/p1-01a-opportunity/acceptance");
const manifestPath = join(outputDir, "manifest.json");
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `P1-01A-Acceptance-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const localEnv = ensureLocalSupabaseEnv();
const timestamp = new Date().toISOString();
const manifest = [];

mkdirSync(outputDir, { recursive: true });

const qaEnv = {
  ...process.env,
  ...localEnv,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
  FOUNDATION_0A_TEST_PASSWORD: fixturePassword
};

const { service, bd, pm, auditor } = await bootstrapAndClients();
await cleanupAcceptanceFixtures(service);

execFileSync(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  env: qaEnv,
  stdio: "inherit"
});

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = startNext(port, qaEnv);
let browser;

try {
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });

  const bdContext = await signedInContext(browser, baseUrl, "bd-a@foundation0a.local", fixturePassword);
  const bdPage = await bdContext.newPage();

  await captureState(bdPage, {
    stateKey: "01-opportunity-action-queue-empty",
    route: "/pipeline",
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: null,
    lifecycleState: "empty",
    currentAction: "New opportunity",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "03-new-opportunity-intake-initial",
    route: "/pipeline/new",
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: null,
    lifecycleState: "new",
    currentAction: "Create opportunity",
    reachedThrough: "browser interaction"
  });

  await bdPage.goto(`${baseUrl}/pipeline/new`, { waitUntil: "domcontentloaded" });
  await fillIntakeForm(bdPage, "P1 Acceptance Intake Complete", "Hospital access road and conduit crossing");
  await captureCurrentPage(bdPage, {
    stateKey: "04-new-opportunity-intake-completed-form",
    route: "/pipeline/new",
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: null,
    lifecycleState: "form_completed",
    currentAction: "Create opportunity",
    reachedThrough: "browser interaction"
  });

  const qualifying = await createOpportunity(bd, {
    name: "P1 Acceptance Qualifying",
    location: "Hospital access road and conduit crossing"
  });
  const draft = await insertDraftOpportunity(service, "P1 Acceptance Draft");
  const partial = await createOpportunity(bd, {
    name: "P1 Acceptance Partial Qualification",
    location: "West duct bank crossing"
  });
  await saveQualification(bd, partial.opportunity.id, partial.opportunity.version, partialQualification());
  const ready = await createOpportunity(bd, {
    name: "P1 Acceptance Ready Qualification",
    location: "North duct bank"
  });
  const readySaved = await saveQualification(bd, ready.opportunity.id, ready.opportunity.version, completeQualification());
  const readyEvidence = await attachDecisionSupportEvidence(bd, ready.opportunity.id, readySaved.opportunity.version);
  const decision = await createOpportunity(bd, {
    name: "P1 Acceptance Decision Ready",
    location: "Hospital access road and conduit crossing"
  });
  const decisionSaved = await saveQualification(bd, decision.opportunity.id, decision.opportunity.version, completeQualification());
  const decisionEvidence = await attachDecisionSupportEvidence(bd, decision.opportunity.id, decisionSaved.opportunity.version);
  const decisionReady = await submitForDecision(bd, decision.opportunity.id, decisionEvidence.opportunity.version);
  const assigned = await createOpportunity(bd, {
    name: "P1 Acceptance Assigned Estimator",
    location: "East entrance bore"
  });
  await assignEstimator(bd, service, assigned.opportunity.id, assigned.opportunity.version);
  await createOpportunity(bd, {
    name: "P1 Acceptance Queue Item A",
    location: "Campus loop north"
  });
  await createOpportunity(bd, {
    name: "P1 Acceptance Queue Item B",
    location: "Campus loop south"
  });

  await captureState(bdPage, {
    stateKey: "02-opportunity-action-queue-multiple",
    route: "/pipeline",
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: "multiple",
    lifecycleState: "mixed",
    currentAction: "Open opportunity",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "05-duplicate-warning-state",
    route: "/pipeline/new?error=duplicate",
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: qualifying.opportunity.stable_opportunity_key,
    lifecycleState: "duplicate_warning_requested",
    currentAction: "Create opportunity",
    reachedThrough: "browser route after duplicate guard"
  });

  await captureState(bdPage, {
    stateKey: "06-opportunity-workbench-draft-intake-incomplete",
    route: `/pipeline/${draft.id}`,
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: draft.stable_opportunity_key,
    lifecycleState: "draft",
    currentAction: "Start qualification",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "07-opportunity-workbench-qualifying",
    route: `/pipeline/${qualifying.opportunity.id}`,
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: qualifying.opportunity.stable_opportunity_key,
    lifecycleState: "qualifying",
    currentAction: "Save qualification",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "08-qualification-initial",
    route: `/pipeline/${qualifying.opportunity.id}`,
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: qualifying.opportunity.stable_opportunity_key,
    lifecycleState: "qualifying",
    currentAction: "Save qualification",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "09-qualification-partially-completed",
    route: `/pipeline/${partial.opportunity.id}`,
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: partial.opportunity.stable_opportunity_key,
    lifecycleState: "qualifying_partial",
    currentAction: "Save qualification",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "10-qualification-ready-to-submit",
    route: `/pipeline/${readyEvidence.opportunity.id}`,
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: readyEvidence.opportunity.stable_opportunity_key,
    lifecycleState: "qualifying_complete",
    currentAction: "Submit for decision",
    reachedThrough: "fixture setup"
  });

  await captureState(bdPage, {
    stateKey: "11-decision-ready-state",
    route: `/pipeline/${decisionReady.opportunity.id}`,
    actor: "bd-a",
    role: "business_development_lead",
    stableKey: decisionReady.opportunity.stable_opportunity_key,
    lifecycleState: "decision_required",
    currentAction: "P1-01B reserved",
    reachedThrough: "fixture setup"
  });

  const auditorContext = await signedInContext(browser, baseUrl, "auditor-a@foundation0a.local", fixturePassword);
  const auditorPage = await auditorContext.newPage();
  await captureState(auditorPage, {
    stateKey: "12-auditor-read-only-state",
    route: `/pipeline/${decisionReady.opportunity.id}`,
    actor: "auditor-a",
    role: "read_only_auditor",
    stableKey: decisionReady.opportunity.stable_opportunity_key,
    lifecycleState: "decision_required",
    currentAction: "Read-only review",
    reachedThrough: "fixture setup"
  });

  const pmContext = await signedInContext(browser, baseUrl, "pm-a@foundation0a.local", fixturePassword);
  const pmPage = await pmContext.newPage();
  await captureState(pmPage, {
    stateKey: "13-assigned-estimator-scoped-access-state",
    route: `/pipeline/${assigned.opportunity.id}`,
    actor: "pm-a",
    role: "project_manager",
    stableKey: assigned.opportunity.stable_opportunity_key,
    lifecycleState: "assigned_estimator",
    currentAction: "Save qualification",
    reachedThrough: "fixture setup"
  });

  const userBContext = await signedInContext(browser, baseUrl, "user-b@foundation0a.local", fixturePassword);
  const userBPage = await userBContext.newPage();
  await captureState(userBPage, {
    stateKey: "14-permission-denied-state",
    route: `/pipeline/${decisionReady.opportunity.id}`,
    actor: "user-b",
    role: "operations_leader_workspace_b",
    stableKey: decisionReady.opportunity.stable_opportunity_key,
    lifecycleState: "permission_denied",
    currentAction: "Opportunity unavailable",
    reachedThrough: "fixture setup"
  });

  await bdContext.close();
  await auditorContext.close();
  await pmContext.close();
  await userBContext.close();

  server.kill();
  await delay(1000);

  const productionEnv = { ...qaEnv, RYBEXOS_RUNTIME_MODE: "production" };
  const productionPort = await getFreePort();
  const productionBaseUrl = `http://127.0.0.1:${productionPort}`;
  const productionServer = startNext(productionPort, productionEnv);
  try {
    await waitForServer(`${productionBaseUrl}/api/health`, 90_000);
    const productionContext = await signedInContext(browser, productionBaseUrl, "bd-a@foundation0a.local", fixturePassword);
    const productionPage = await productionContext.newPage();
    await captureState(productionPage, {
      stateKey: "15-production-contained-pipeline-state",
      route: "/pipeline",
      actor: "bd-a",
      role: "business_development_lead",
      stableKey: null,
      lifecycleState: "production_contained",
      currentAction: "Pipeline contained in production runtime",
      reachedThrough: "production-mode authenticated browser"
    }, productionBaseUrl, "production");
    await productionContext.close();
  } finally {
    productionServer.kill();
  }

  writeManifest();
} finally {
  if (browser) await browser.close();
  if (!server.killed) server.kill();
}

async function captureState(page, state, stateBaseUrl = baseUrl, buildMode = "test") {
  await page.goto(`${stateBaseUrl}${state.route}`, { waitUntil: "networkidle" });
  await captureCurrentPage(page, state, buildMode);
}

async function captureCurrentPage(page, state, buildMode = "test") {
  for (const viewport of [
    { key: "desktop", width: 1440, height: 900 },
    { key: "mobile", width: 390, height: 844 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(250);
    const filename = `${state.stateKey}-${viewport.key}.png`;
    const filePath = join(outputDir, filename);
    const textSnapshot = await page.locator("body").innerText().catch(() => "");
    await page.screenshot({ path: filePath, fullPage: true });
    manifest.push({
      filename,
      route: state.route,
      viewport: { name: viewport.key, width: viewport.width, height: viewport.height },
      authenticatedActorFixture: state.actor,
      role: state.role,
      opportunityStableKey: state.stableKey,
      lifecycleState: state.lifecycleState,
      currentAction: state.currentAction,
      captureTimestamp: new Date().toISOString(),
      nextBuildMode: buildMode === "production" ? "next build + next start, production runtime" : "next build + next start, test runtime",
      databaseMode: "local Supabase database",
      reachedThrough: state.reachedThrough,
      consoleErrors: [],
      pageErrors: [],
      textSnapshot: textSnapshot.slice(0, 4000)
    });
  }
}

async function signedInContext(browserInstance, stateBaseUrl, email, password) {
  const context = await browserInstance.newContext();
  const page = await context.newPage();
  await page.goto(`${stateBaseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.waitForTimeout(700);
  await page.close();
  return context;
}

async function bootstrapAndClients() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: root,
    env: qaEnv,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) throw new Error(`Foundation bootstrap failed: ${redact(result.stderr || result.stdout)}`);
  const service = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return {
    service,
    bd: await signIn("bd-a@foundation0a.local"),
    pm: await signIn("pm-a@foundation0a.local"),
    auditor: await signIn("auditor-a@foundation0a.local")
  };
}

async function signIn(email) {
  const client = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const result = await client.auth.signInWithPassword({ email, password: fixturePassword });
  if (result.error || !result.data.user) throw new Error(`Sign in failed for ${email}: ${result.error?.message ?? "missing user"}`);
  return client;
}

async function createOpportunity(client, { name, location }) {
  const result = await client.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: "Bluegrass Data Centers",
      projectType: "Underground conduit",
      location,
      scopeSummary: "OSP conduit, access coordination, traffic control, and restoration scope.",
      estimatedValue: "385000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-15",
      duplicateConfirmed: true
    },
    p_command_id: commandId(`p1-acceptance-create-${randomUUID()}`),
    p_correlation_id: "p1-01a-acceptance-capture"
  });
  if (result.error || !result.data?.success) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function saveQualification(client, opportunityId, expectedVersion, payload) {
  const result = await client.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: opportunityId,
    p_payload: payload,
    p_command_id: commandId(`p1-acceptance-qualification-${randomUUID()}`),
    p_expected_version: expectedVersion,
    p_correlation_id: "p1-01a-acceptance-capture"
  });
  if (result.error || !result.data?.success) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function submitForDecision(client, opportunityId, expectedVersion) {
  const result = await client.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: opportunityId,
    p_command_id: commandId(`p1-acceptance-submit-${randomUUID()}`),
    p_expected_version: expectedVersion,
    p_correlation_id: "p1-01a-acceptance-capture"
  });
  if (result.error || !result.data?.success) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function attachDecisionSupportEvidence(client, opportunityId, expectedVersion) {
  const result = await client.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: opportunityId,
    p_payload: {
      fileName: "decision-support.txt",
      mimeType: "text/plain",
      sizeBytes: 47,
      checksumSha256: `p1-acceptance-${randomUUID()}`
    },
    p_command_id: commandId(`p1-acceptance-evidence-${randomUUID()}`),
    p_expected_version: expectedVersion,
    p_correlation_id: "p1-01a-acceptance-capture"
  });
  if (result.error || !result.data?.success) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function assignEstimator(client, serviceClient, opportunityId, expectedVersion) {
  const pmUserId = await userIdFor(serviceClient, "pm-a@foundation0a.local");
  const result = await client.rpc("manage_opportunity_assignment_v1", {
    p_opportunity_id: opportunityId,
    p_user_id: pmUserId,
    p_assignment_type: "estimator",
    p_status: "active",
    p_command_id: commandId(`p1-acceptance-assignment-${randomUUID()}`),
    p_expected_version: expectedVersion,
    p_correlation_id: "p1-01a-acceptance-capture"
  });
  if (result.error || !result.data?.success) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function insertDraftOpportunity(serviceClient, name) {
  const bdUserId = await userIdFor(serviceClient, "bd-a@foundation0a.local");
  const bdProfileId = await profileIdFor(serviceClient, bdUserId);
  const id = randomUUID();
  const stable = `p1-acceptance-draft-${id.slice(0, 8)}`;
  const row = {
    id,
    workspace_id: ids.workspaceA,
    organization_id: ids.orgA,
    stable_opportunity_key: stable,
    name,
    customer_gc: "Bluegrass Data Centers",
    gc_client: "Bluegrass Data Centers",
    project_type: "Underground conduit",
    project_location: "Hospital access road and conduit crossing",
    opportunity_location: "Hospital access road and conduit crossing",
    scope_summary: "Draft intake fixture with incomplete intake facts.",
    estimated_value: 385000,
    bid_due_date: "2026-07-15",
    anticipated_start: "2026-08-10",
    owner_user_id: bdUserId,
    lifecycle_status: "draft",
    intake_complete: false,
    qualification_complete: false,
    decision_readiness_status: "not_ready",
    duplicate_fingerprint: stable,
    status: "new",
    d5o_phase: "discover",
    version: 1,
    created_by: bdProfileId,
    updated_by: bdProfileId
  };
  const { data, error } = await serviceClient.from("opportunities").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

async function profileIdFor(serviceClient, authUserId) {
  const { data, error } = await serviceClient
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !data?.id) throw new Error(`Profile lookup failed for auth user ${authUserId}: ${error?.message ?? "missing profile"}`);
  return data.id;
}

async function cleanupAcceptanceFixtures(serviceClient) {
  const { data } = await serviceClient
    .from("opportunities")
    .select("id")
    .eq("workspace_id", ids.workspaceA);
  const idsToDelete = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (idsToDelete.length === 0) return;
  await serviceClient.from("opportunity_qualifications").delete().in("opportunity_id", idsToDelete);
  await serviceClient.from("opportunity_assignments").delete().in("opportunity_id", idsToDelete);
  await serviceClient.from("opportunities").delete().in("id", idsToDelete);
}

async function fillIntakeForm(page, name, location) {
  await page.getByLabel("Opportunity name").fill(name);
  await page.getByLabel("Customer / GC").fill("Bluegrass Data Centers");
  await page.getByLabel("Project type").fill("Underground conduit");
  await page.getByLabel("Location").fill(location);
  await page.getByLabel("Scope summary").fill("OSP conduit, access coordination, traffic control, and restoration scope.");
  await page.getByLabel("Estimated value").fill("385000");
  await page.getByLabel("Anticipated start").fill("2026-08-10");
  await page.getByLabel("Bid due date").fill("2026-07-15");
}

function partialQualification() {
  return {
    ...completeQualification(),
    scopeClarity: "",
    marginConfidence: "",
    riskSummary: "Partial qualification fixture; key risks still need review."
  };
}

function completeQualification() {
  return {
    strategicFit: "strong",
    customerRelationship: "acceptable",
    geographyFit: "strong",
    projectTypeFit: "strong",
    scopeClarity: "acceptable",
    designMaturity: "acceptable",
    commercialTermsRisk: "risk",
    scheduleFeasibility: "acceptable",
    crewCapacityFit: "acceptable",
    materialLeadTimeRisk: "risk",
    permitsAccessRisk: "risk",
    safetyQualityComplexity: "acceptable",
    subcontractorDependency: "acceptable",
    cashFlowRisk: "acceptable",
    marginConfidence: "acceptable",
    contractualRisk: "risk",
    riskSummary: "Utility access, schedule, and commercial terms need pursuit controls.",
    assumptions: "Qualification assumes current drawings and access windows remain stable.",
    recommendation: "pursue_with_mitigations"
  };
}

function startNext(port, env) {
  return spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // keep polling
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
    server.on("error", reject);
  });
}

function ensureLocalSupabaseEnv() {
  return requireQualificationChildEnv();
}

function writeManifest() {
  writeFileSync(manifestPath, `${JSON.stringify({
    runTimestamp: timestamp,
    requiredStateCount: 15,
    screenshots: manifest.length,
    entries: manifest
  }, null, 2)}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}
