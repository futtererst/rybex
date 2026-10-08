import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { referencePayload } from "./m1/p1-cfg-evidence/fixtures.mjs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { commandId, createClients, ids, signIn, userIdFor } from "./foundation-0b-test-utils.mjs";
import { requireQualificationChildEnv } from "./qualification-child-env.mjs";
import {
  canonicalizeCfgRuntime03EvidencePaths,
  prepareCfgRuntime03EvidenceOutput,
} from "./cfg-runtime-03-evidence-output.mjs";

const root = process.cwd();
const m1Gate = ownedGateAdapter();
if (!m1Gate && (process.env.M1_GATE_MANIFEST || process.env.RYBEX_QUALIFICATION_PROJECT_ID === "rybex-cfg03-q-m1-s1-recovery-20260928")) throw new Error("Explicit owned browser manifest mode required");
const evidenceOutput = m1Gate ? m1Gate.browserOutput("cfg01") : prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
let evidenceOutputFinalized = false;
process.on("exit", () => { if (!evidenceOutputFinalized) evidenceOutput.abort(); });
const artifactRoot = evidenceOutput.temporaryRoot;
const screenshotRoot = join(artifactRoot, "screenshots");
const manifestPath = join(artifactRoot, "manifest.json");
const expectedScreenshotFiles = [
  "cfg-runtime-01-ready.png",
  "cfg-runtime-01-missing-evidence.png",
  "cfg-runtime-01-invalid-decision-owner.png",
  "cfg-runtime-01-configuration-unavailable.png",
  "cfg-runtime-01-successful-advancement.png",
];
const rejectedBaselineHashes = {
  "cfg-runtime-01-ready.png": "5f6ebf15d2a5b1bcdeb66ebde2cb389e6cd6227d452e1223ed409bc1a69ae779",
  "cfg-runtime-01-missing-evidence.png": "de443d85b57d3383a4e895270e9762d1338bbb151892d9fb6307636423549c44",
  "cfg-runtime-01-invalid-decision-owner.png": "23ca899d55bf7f4d7a7b4c3f5070fcb0b775008ed5ce3452f34d5497e7bae5dd",
  "cfg-runtime-01-configuration-unavailable.png": "71312d52411d8b45adb2530a1265c9ce1fbfb8fc45c4bb6840ac5da18cd6c7ce",
};
const runStartedAt = Date.now();
const previousScreenshots = snapshotScreenshots(expectedScreenshotFiles);
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `CFG-RUNTIME-01-Browser-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const localEnv = m1Gate ? m1Gate.childEnv(process.env) : ensureLocalSupabaseEnv();
const qaEnv = {
  ...process.env,
  ...localEnv,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
  FOUNDATION_0A_TEST_PASSWORD: fixturePassword,
};
Object.assign(process.env, qaEnv);

rmSync(artifactRoot, { recursive: true, force: true });
mkdirSync(screenshotRoot, { recursive: true });

bootstrap();
loadCompatibilityPack();

const { service } = createClients();
const bd = await signIn("bd-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");
const bdUserId = await userIdFor(service, "bd-a@foundation0a.local");
const opsUserId = await userIdFor(service, "ops-a@foundation0a.local");
const pmUserId = await userIdFor(service, "pm-a@foundation0a.local");
const userBId = await userIdFor(service, "user-b@foundation0a.local");
const adminUserId = await userIdFor(service, "admin-a@foundation0a.local");
const runKey = `cfg-runtime-01-${Date.now()}`;
const opportunityName = "Bluegrass Data Centers - Charlotte Expansion";
const visualFixtureScope = "Bluegrass Charlotte expansion Pricing Review readiness package.";
const consoleErrors = [];
const pageErrors = [];
const networkFailures = [];
const manifest = [];

await setBusinessFacingNames();
await cleanupFixtures();
const fixtures = await createFixtures();

execFileSync(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  env: qaEnv,
  stdio: "inherit",
});

const port = m1Gate ? await m1Gate.browserPort() : await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: qaEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLogs = "";
server.stdout.on("data", (chunk) => { serverLogs += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverLogs += chunk.toString(); });

let browser;
try {
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });
  const bdContext = await signedInContext(browser, baseUrl, "bd-a@foundation0a.local");
  const userBContext = await signedInContext(browser, baseUrl, "user-b@foundation0a.local");

  await captureScenario({
    context: bdContext,
    scenario: "Ready",
    fixture: fixtures.ready,
    fileName: "cfg-runtime-01-ready.png",
    expectedConfigurationState: "active Rybex compatibility pack, complete evidence, valid Operations Leader accountability",
    expectedBusinessOutcome: "advancement action is available but not yet invoked",
    assertPage: async (page) => {
      await expectText(page, "Ready for Pricing Review");
      await expectText(page, "Decision support evidence");
      await expectText(page, "Satisfied");
      await expectText(page, "Operations Leader");
      await page.getByRole("button", { name: /Submit to .* for decision/ }).waitFor({ state: "visible", timeout: 15_000 });
      await assertNoRawConfigurationIds(page);
    },
    databaseAssert: async () => assertNoProvenance(fixtures.ready.id),
  });

  await captureScenario({
    context: bdContext,
    scenario: "Missing configured evidence",
    fixture: fixtures.missingEvidence,
    fileName: "cfg-runtime-01-missing-evidence.png",
    expectedConfigurationState: "active Rybex compatibility pack, configured evidence missing, valid Operations Leader accountability",
    expectedBusinessOutcome: "browser blocks advancement and direct server mutation rejects unmet configured evidence",
    beforeScreenshot: async () => {
      const direct = await submitForDecision(bd, fixtures.missingEvidence.id, fixtures.missingEvidence.version, "missing-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configured_pricing_review_requirements_unmet") {
        throw new Error(`Missing-evidence direct submit did not fail as expected: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
    },
    assertPage: async (page) => {
      await expectText(page, "Add decision support evidence");
      await expectText(page, "Decision support evidence");
      await expectText(page, "Decision support evidence is missing");
      await expectNoSubmitButton(page);
      await assertMissingEvidenceDom(page);
      await assertNoRawConfigurationIds(page);
    },
    afterScreenshot: async (page) => {
      await uploadEvidenceFromMainWorkspace(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Satisfied");
      const bodyText = await page.locator("body").innerText();
      if (bodyText.includes("Decision support evidence is missing")) {
        throw new Error("Evidence blocker remained visible after upload and reload");
      }
    },
    databaseAssert: async () => assertEvidencePersisted(fixtures.missingEvidence.id),
  });

  await captureScenario({
    context: bdContext,
    scenario: "Invalid decision-owner accountability",
    fixture: fixtures.invalidOwner,
    fileName: "cfg-runtime-01-invalid-decision-owner.png",
    expectedConfigurationState: "active Rybex compatibility pack, evidence complete, assigned owner does not satisfy configured Operations Leader role",
    expectedBusinessOutcome: "browser blocks advancement and direct server mutation rejects invalid accountability",
    beforeScreenshot: async () => {
      const direct = await submitForDecision(bd, fixtures.invalidOwner.id, fixtures.invalidOwner.version, "invalid-owner-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configured_pricing_review_requirements_unmet") {
        throw new Error(`Invalid-owner direct submit did not fail as expected: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
    },
    assertPage: async (page) => {
      await expectText(page, "Assign an Operations Leader");
      await expectText(page, "Taylor Chen cannot authorize Pricing Review");
      await expectText(page, "Operations Leader");
      await expectNoSubmitButton(page);
      await assertInvalidOwnerDom(page);
      await assertNoRawConfigurationIds(page);
    },
    afterScreenshot: async (page) => {
      await assignMorganLeeFromMainWorkspace(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Ready for Pricing Review");
      await page.getByRole("button", { name: /Submit to Morgan Lee for decision/ }).waitFor({ state: "visible", timeout: 15_000 });
    },
    databaseAssert: async () => assertDecisionOwnerPersisted(fixtures.invalidOwner.id, opsUserId),
  });

  await captureScenario({
    context: userBContext,
    scenario: "Configuration unavailable",
    fixture: fixtures.unavailable,
    fileName: "cfg-runtime-01-configuration-unavailable.png",
    expectedConfigurationState: "workspace B opportunity has no effective published configuration",
    expectedBusinessOutcome: "controlled fail-closed unavailable state and direct mutation rejection",
    beforeScreenshot: async () => {
      const direct = await submitForDecision(userB, fixtures.unavailable.id, fixtures.unavailable.version, "unavailable-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configuration_unavailable") {
        throw new Error(`Unavailable direct submit did not fail as expected: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
    },
    assertPage: async (page) => {
      await expectText(page, "Pricing Review rules are unavailable");
      await expectText(page, "Contact your system administrator");
      await expectNoSubmitButton(page);
      await assertUnavailableDom(page);
      await assertNoRawConfigurationIds(page);
    },
    databaseAssert: async () => assertNoProvenance(fixtures.unavailable.id),
  });

  await captureScenario({
    context: bdContext,
    scenario: "Successful advancement and audit confirmation",
    fixture: fixtures.success,
    fileName: "cfg-runtime-01-successful-advancement.png",
    expectedConfigurationState: "active Rybex compatibility pack, complete evidence, valid Operations Leader accountability",
    expectedBusinessOutcome: "real browser submit persists decision-required state and configuration provenance",
    beforeScreenshot: async (page) => {
      const submit = page.getByRole("button", { name: /Submit to .* for decision/ });
      await submit.waitFor({ state: "visible", timeout: 15_000 });
      const actionResponse = waitForServerActionPost(page);
      await submit.click();
      await actionResponse;
      await page.reload({ waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Submitted for Pricing Review");
      await expectText(page, "Morgan Lee now owns the Pricing Review decision");
      await assertSubmittedDom(page);
      await assertNoRawConfigurationIds(page);
    },
    databaseAssert: async () => {
      const row = await assertProvenance(fixtures.success.id);
      const count = await auditCount(fixtures.success.id, row.pricing_review_configuration_version_id);
      if (count < 1) throw new Error("expected audit event containing configuration provenance");
      const replay = await submitForDecision(bd, fixtures.success.id, row.version, "success-replay");
      if (replay.error || replay.data?.success !== true) throw new Error(`expected idempotent/safe replay success: ${JSON.stringify(replay.data ?? replay.error)}`);
      return `configurationVersion=${row.pricing_review_configuration_version_id}; gate=${row.pricing_review_gate_key}; audit=${count}`;
    },
  });

  await bdContext.close();
  await userBContext.close();
} finally {
  if (browser) await browser.close();
  server.kill();
}

const failedManifest = manifest.filter((entry) => entry.browserTestResult !== "pass" || entry.databaseAssertionResult !== "pass");
writeFileSync(manifestPath, `${JSON.stringify(canonicalizeCfgRuntime03EvidencePaths({
  runTimestamp: new Date().toISOString(),
  viewport: { width: 1440, height: 1000 },
  screenshotCount: manifest.length,
  expectedScreenshotCount: 5,
  consoleErrorCount: consoleErrors.length,
  pageErrorCount: pageErrors.length,
  scenarios: manifest,
  consoleErrors,
  pageErrors,
}, evidenceOutput), null, 2)}\n`);

if (manifest.length !== 5) throw new Error(`Expected exactly five screenshots, captured ${manifest.length}`);
if (failedManifest.length > 0) {
  console.error(`CFG-RUNTIME-01 failed scenario detail: ${JSON.stringify(failedManifest, null, 2)}`);
  console.error(`CFG-RUNTIME-01 console errors: ${JSON.stringify(consoleErrors, null, 2)}`);
  console.error(`CFG-RUNTIME-01 page errors: ${JSON.stringify(pageErrors, null, 2)}`);
  console.error(`CFG-RUNTIME-01 network failures: ${JSON.stringify(networkFailures, null, 2)}`);
  console.error(`CFG-RUNTIME-01 server log tail: ${serverLogs.slice(-12000)}`);
  throw new Error(`Focused browser acceptance failed ${failedManifest.length} scenario(s).`);
}
if (consoleErrors.length > 0) throw new Error(`Unexpected browser console errors: ${consoleErrors.join("; ")}`);
if (pageErrors.length > 0) throw new Error(`Unexpected page errors: ${pageErrors.join("; ")}`);

console.log(`CFG-RUNTIME-01 browser acceptance captured ${manifest.length} focused states.`);
const committedArtifactRoot = evidenceOutput.finalize();
evidenceOutputFinalized = true;
console.log(`Manifest: ${join(committedArtifactRoot, "manifest.json")}`);

async function createFixtures() {
  const ready = await createQualifiedOpportunity({ client: bd, scenarioKey: "ready", decisionOwnerUserId: opsUserId, withEvidence: true });
  const missingEvidence = await createQualifiedOpportunity({ client: bd, scenarioKey: "missing-evidence", decisionOwnerUserId: opsUserId, withEvidence: false });
  const invalidOwner = await createQualifiedOpportunity({ client: bd, scenarioKey: "invalid-owner", decisionOwnerUserId: opsUserId, withEvidence: true });
  await forceDecisionOwner(invalidOwner.id, pmUserId);
  const success = await createQualifiedOpportunity({ client: bd, scenarioKey: "success", decisionOwnerUserId: opsUserId, withEvidence: true });
  const unavailable = await createWorkspaceBUnavailableOpportunity();
  return { ready, missingEvidence, invalidOwner, unavailable, success };
}

async function createQualifiedOpportunity({ client, scenarioKey, decisionOwnerUserId, withEvidence }) {
  const commandKey = `${runKey}-${scenarioKey}`;
  const created = await createOpportunity(client, opportunityName, commandKey);
  const qualified = await client.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: created.opportunity.id,
    p_payload: completeQualification(),
    p_command_id: commandId(`${commandKey}-qualification`),
    p_expected_version: created.opportunity.version,
    p_correlation_id: `${commandKey}-qualification`,
  });
  assertRpc(qualified, `${scenarioKey} qualification`);
  const accountable = await client.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: created.opportunity.id,
    p_decision_owner_user_id: decisionOwnerUserId,
    p_decision_due_at: "2026-07-18",
    p_command_id: commandId(`${commandKey}-accountability`),
    p_expected_version: qualified.data.opportunity.version,
    p_correlation_id: `${commandKey}-accountability`,
  });
  assertRpc(accountable, `${scenarioKey} accountability`);
  let current = accountable.data;
  if (withEvidence) {
    const evidence = await attachEvidence(client, current.opportunity.id, current.opportunity.version, `${commandKey}-evidence`);
    assertRpc(evidence, `${scenarioKey} evidence`);
    current = evidence.data;
  }
  return { id: current.opportunity.id, version: current.opportunity.version, name: opportunityName };
}

async function createWorkspaceBUnavailableOpportunity() {
  const id = crypto.randomUUID();
  const qualificationId = crypto.randomUUID();
  const stable = `cfg-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  const { error: oppError } = await service.from("opportunities").insert({
    id,
    workspace_id: ids.workspaceB,
    organization_id: ids.orgB,
    name: opportunityName,
    customer_gc: "Bluegrass Data Centers",
    gc_client: "Bluegrass Data Centers",
    project_type: "Data Center",
    opportunity_location: "Charlotte, NC",
    project_location: "Charlotte, NC",
    scope_summary: visualFixtureScope,
    estimated_value: 385000,
    anticipated_start: "2026-08-01",
    bid_due_date: "2026-07-20",
    owner_user_id: userBId,
    stable_opportunity_key: stable,
    duplicate_fingerprint: stable,
    intake_complete: true,
    qualification_complete: true,
    decision_readiness_status: "ready_for_decision",
    decision_owner_user_id: userBId,
    decision_due_at: "2026-07-18",
    lifecycle_status: "qualifying",
    status: "under_review",
    version: 1,
    created_at: now,
    updated_at: now,
  });
  if (oppError) throw new Error(`workspace B opportunity insert failed: ${oppError.message}`);
  const { error: qualificationError } = await service.from("opportunity_qualifications").insert({
    id: qualificationId,
    workspace_id: ids.workspaceB,
    opportunity_id: id,
    status: "complete",
    completeness_result: "complete",
    ...completeQualificationDb(),
    prepared_by: userBId,
    completed_at: now,
    created_at: now,
    updated_at: now,
  });
  if (qualificationError) throw new Error(`workspace B qualification insert failed: ${qualificationError.message}`);
  return { id, version: 1, name: opportunityName };
}

async function forceDecisionOwner(opportunityId, userId) {
  const { error } = await service
    .from("opportunities")
    .update({ decision_owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", opportunityId);
  if (error) throw new Error(`failed to force decision owner fixture state: ${error.message}`);
}

async function captureScenario({
  context,
  scenario,
  fixture,
  fileName,
  expectedConfigurationState,
  expectedBusinessOutcome,
  beforeScreenshot,
  assertPage,
  afterScreenshot,
  databaseAssert,
}) {
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`${scenario}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${scenario}: ${message.text()} @ ${JSON.stringify(message.location())}`);
  });
  page.on("requestfailed", (request) => networkFailures.push(`${scenario}: ${request.method()} ${request.url()} - ${request.failure()?.errorText ?? "unknown"}`));
  let browserTestResult = "fail";
  let databaseAssertionResult = "fail";
  let databaseAssertionDetail = "";
  let failureDetail = "";
  let noFixtureIdentifierVisible = false;
  let opportunityHeaderCount = 0;
  let screenshotFreshness = null;
  const screenshotPath = join(screenshotRoot, fileName);
  try {
    await page.goto(`${baseUrl}/pipeline/${fixture.id}`, { waitUntil: "domcontentloaded" });
    await beforeScreenshot?.(page);
    await assertPage(page);
    const bodyText = await page.locator("body").innerText();
    noFixtureIdentifierVisible = !hasVisibleFixtureIdentifier(bodyText);
    if (!noFixtureIdentifierVisible) throw new Error("page exposed internal fixture identifiers");
    opportunityHeaderCount = await visibleOpportunityHeaderCount(page, fixture.name);
    if (opportunityHeaderCount !== 1) throw new Error(`expected exactly one opportunity header, found ${opportunityHeaderCount}`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenshotFreshness = assertFreshScreenshot(fileName, screenshotPath);
    browserTestResult = "pass";
    await afterScreenshot?.(page);
    databaseAssertionDetail = await databaseAssert();
    databaseAssertionResult = "pass";
  } catch (error) {
    failureDetail = error instanceof Error ? error.message : String(error);
    try {
      const bodyText = await page.locator("body").innerText({ timeout: 1000 });
      failureDetail += `\nRendered text:\n${bodyText.slice(0, 2000)}`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch {
      // Keep the original failure.
    }
  } finally {
    manifest.push({
      scenario,
      visibleOpportunityName: fixture.name,
      opportunityFixture: { id: fixture.id },
      expectedUserResponsibility: responsibilityForScenario(scenario),
      expectedCtaCondition: ctaForScenario(scenario),
      expectedConfigurationState,
      expectedBusinessOutcome,
      screenshotPath,
      browserTestResult,
      databaseAssertionResult,
      databaseAssertionDetail,
      failureDetail,
      consoleErrorCount: consoleErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length,
      pageErrorCount: pageErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length,
      noFixtureIdentifierVisible,
      opportunityHeaderCount,
      screenshotFreshness,
    });
    await page.close();
  }
}

async function createOpportunity(client, name, commandKey) {
  const result = await client.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: "Bluegrass Data Centers",
      projectType: "Data Center",
      location: "Charlotte, NC",
      scopeSummary: visualFixtureScope,
      estimatedValue: "385000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-20",
      duplicateConfirmed: true,
    },
    p_command_id: commandId(`${commandKey}-create`),
    p_correlation_id: `${commandKey}-create`,
  });
  assertRpc(result, `${name} create`);
  return result.data;
}

async function attachEvidence(client, id, version, key) {
  return client.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: id,
    p_payload: await referencePayload(service, client, id, version, "decision_support", "qualification_decision_support", {
      fileName: `${key}.txt`,
      mimeType: "text/plain",
      sizeBytes: 42,
      checksumSha256: `cfg-runtime-01-${key}`,
    }),
    p_command_id: commandId(key),
    p_expected_version: version,
    p_correlation_id: key,
  });
}

async function submitForDecision(client, id, version, key) {
  return client.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: id,
    p_command_id: commandId(key),
    p_expected_version: version,
    p_correlation_id: key,
  });
}

async function assertNoProvenance(id) {
  const { data, error } = await service
    .from("opportunities")
    .select("lifecycle_status,pricing_review_configuration_version_id,pricing_review_gate_key")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  if (data.pricing_review_configuration_version_id || data.pricing_review_gate_key || data.lifecycle_status === "decision_required") {
    throw new Error(`expected no advancement/provenance, got ${JSON.stringify(data)}`);
  }
  return "no advancement or provenance persisted";
}

async function assertEvidencePersisted(id) {
  const { data: qualification, error: qualificationError } = await service
    .from("opportunity_qualifications")
    .select("id")
    .eq("opportunity_id", id)
    .single();
  if (qualificationError) throw new Error(qualificationError.message);
  const { count, error } = await service
    .from("evidence_links")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "opportunity_qualification")
    .eq("entity_id", qualification.id)
    .eq("relationship_type", "qualification_decision_support");
  if (error) throw new Error(error.message);
  if ((count ?? 0) < 1) throw new Error("expected decision support evidence link after browser upload");
  return "browser upload persisted decision support evidence and cleared blocker";
}

async function assertDecisionOwnerPersisted(id, expectedUserId) {
  const { data, error } = await service
    .from("opportunities")
    .select("decision_owner_user_id, lifecycle_status, pricing_review_configuration_version_id")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  if (data.decision_owner_user_id !== expectedUserId) {
    throw new Error(`expected Morgan Lee as decision owner, got ${data.decision_owner_user_id}`);
  }
  if (data.lifecycle_status === "decision_required" || data.pricing_review_configuration_version_id) {
    throw new Error(`owner assignment must not submit package, got ${JSON.stringify(data)}`);
  }
  return "browser assignment persisted Morgan Lee as Decision Owner without submitting the package";
}

async function assertProvenance(id) {
  const { data, error } = await service
    .from("opportunities")
    .select("version,lifecycle_status,pricing_review_configuration_version_id,pricing_review_gate_key")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  if (data.lifecycle_status !== "decision_required" || !data.pricing_review_configuration_version_id || data.pricing_review_gate_key !== "pricing-review") {
    throw new Error(`expected persisted provenance, got ${JSON.stringify(data)}`);
  }
  return data;
}

async function auditCount(id, configurationVersionId) {
  const { count, error } = await service
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", id)
    .contains("after_values", { configurationVersionId });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function assertRpc(result, label) {
  if (result.error || result.data?.success !== true) {
    throw new Error(`${label} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
  }
}

function snapshotScreenshots(files) {
  const snapshots = {};
  for (const fileName of files) {
    const filePath = join(screenshotRoot, fileName);
    if (!existsSync(filePath)) {
      snapshots[fileName] = { exists: false };
      continue;
    }
    const stat = statSync(filePath);
    snapshots[fileName] = {
      exists: true,
      path: filePath,
      sha256: sha256File(filePath),
      mtimeMs: stat.mtimeMs,
      mtimeIso: stat.mtime.toISOString(),
    };
  }
  return snapshots;
}

function assertFreshScreenshot(fileName, filePath) {
  if (!existsSync(filePath)) throw new Error(`Screenshot was not created: ${filePath}`);
  const stat = statSync(filePath);
  const current = {
    path: filePath,
    sha256: sha256File(filePath),
    mtimeMs: stat.mtimeMs,
    mtimeIso: stat.mtime.toISOString(),
  };
  const previous = previousScreenshots[fileName] ?? { exists: false };
  if (rejectedBaselineHashes[fileName] && rejectedBaselineHashes[fileName] === current.sha256) {
    throw new Error(`Screenshot retained rejected baseline hash after current capture: ${fileName}`);
  }
  if (current.mtimeMs < runStartedAt) throw new Error(`Screenshot was not generated during current run: ${fileName}`);
  return { rejectedBaselineHash: rejectedBaselineHashes[fileName] ?? null, previous, current };
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
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
    recommendation: "pursue_with_mitigations",
  };
}

function completeQualificationDb() {
  return {
    strategic_fit: "strong",
    customer_relationship: "acceptable",
    geography_fit: "strong",
    project_type_fit: "strong",
    scope_clarity: "acceptable",
    design_maturity: "acceptable",
    commercial_terms_risk: "risk",
    schedule_feasibility: "acceptable",
    crew_capacity_fit: "acceptable",
    material_lead_time_risk: "risk",
    permits_access_risk: "risk",
    safety_quality_complexity: "acceptable",
    subcontractor_dependency: "acceptable",
    cash_flow_risk: "acceptable",
    margin_confidence: "acceptable",
    contractual_risk: "risk",
    risk_summary: "Utility access, schedule, and commercial terms need pursuit controls.",
    assumptions: "Qualification assumes current drawings and access windows remain stable.",
    recommendation: "pursue_with_mitigations",
  };
}

async function cleanupFixtures() {
  const { data } = await service
    .from("opportunities")
    .select("id")
    .eq("name", opportunityName)
    .eq("scope_summary", visualFixtureScope);
  const idsToDelete = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (idsToDelete.length === 0) return;
  await service.from("audit_events").delete().in("entity_id", idsToDelete);
  await service.from("domain_events").delete().in("aggregate_id", idsToDelete);
  await service.from("evidence_links").delete().in("entity_id", idsToDelete);
  await service.from("evidence_objects").delete().in("opportunity_id", idsToDelete);
  await service.from("opportunity_assignments").delete().in("opportunity_id", idsToDelete);
  await service.from("opportunity_qualifications").delete().in("opportunity_id", idsToDelete);
  await service.from("opportunities").delete().in("id", idsToDelete);
}

async function setBusinessFacingNames() {
  const updates = [
    [bdUserId, "Jordan Ellis"],
    [opsUserId, "Morgan Lee"],
    [pmUserId, "Taylor Chen"],
    [userBId, "Avery Patel"],
    [adminUserId, "Riley Adams"],
  ];
  for (const [userId, displayName] of updates) {
    const { error } = await service.from("user_profiles").update({ display_name: displayName }).eq("user_id", userId);
    if (error) throw new Error(`failed to set fixture display name for ${displayName}: ${error.message}`);
  }
}

async function signedInContext(browser, appBaseUrl, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${appBaseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.waitForTimeout(700);
  if (new URL(page.url()).pathname !== "/pipeline") {
    throw new Error(`sign-in did not reach pipeline for ${email}; current URL ${page.url()}`);
  }
  await page.close();
  return context;
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
}

async function expectNoSubmitButton(page) {
  const count = await page.getByRole("button", { name: /Submit to .* for decision/ }).count();
  if (count !== 0) throw new Error("submit action should not be available");
}

async function assertMissingEvidenceDom(page) {
  const main = page.locator(".pipeline-layout-columns > :first-child").first();
  const rail = page.locator(".pipeline-decision-column").first();
  const mainFileInputs = await main.locator('input[type="file"]').count();
  if (mainFileInputs !== 1) throw new Error(`Missing evidence state expected one main-workspace file input, found ${mainFileInputs}`);
  await main.getByRole("button", { name: "Save evidence and notes" }).waitFor({ state: "visible", timeout: 5_000 });
  const railFileInputs = await rail.locator('input[type="file"]').count();
  if (railFileInputs !== 0) throw new Error(`Right decision rail must not contain file inputs, found ${railFileInputs}`);
  const oldButtons = await page.getByRole("button", { name: "Save evidence notes" }).count();
  if (oldButtons !== 0) throw new Error(`Retired Save evidence notes button is still visible (${oldButtons})`);
}

async function uploadEvidenceFromMainWorkspace(page) {
  const main = page.locator(".pipeline-layout-columns > :first-child").first();
  await main.locator('input[type="file"]').setInputFiles({
    name: "decision-support-evidence.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Bluegrass Charlotte decision support evidence for Pricing Review.\n"),
  });
  await Promise.all([
    waitForServerActionPost(page),
    main.getByRole("button", { name: "Save evidence and notes" }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");
}

async function assertInvalidOwnerDom(page) {
  const main = page.locator(".pipeline-layout-columns > :first-child").first();
  const ownerSelectors = main.locator('select[name="decisionOwnerUserId"]');
  const ownerSelectorCount = await ownerSelectors.count();
  if (ownerSelectorCount !== 1) throw new Error(`Invalid owner state expected one eligible-owner selector, found ${ownerSelectorCount}`);
  const options = await ownerSelectors.first().locator("option").evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? ""));
  if (!options.some((option) => option === "Morgan Lee - Operations Leader")) {
    throw new Error(`Eligible-owner selector did not include Morgan Lee - Operations Leader. Options: ${options.join(", ")}`);
  }
  await main.getByRole("button", { name: "Assign Decision Owner" }).waitFor({ state: "visible", timeout: 5_000 });
  const enabledPrepareButtons = await page.getByRole("button", { name: "Prepare decision handoff" }).evaluateAll((buttons) => buttons.filter((button) => !button.disabled).length);
  if (enabledPrepareButtons !== 0) throw new Error(`Prepare decision handoff must not be enabled before assignment, found ${enabledPrepareButtons}`);
  const recommendationSelectors = await page.locator('select[name="recommendation"]').count();
  if (recommendationSelectors !== 0) throw new Error(`Recommendation selector must not be visible in invalid-owner state, found ${recommendationSelectors}`);
}

async function assignMorganLeeFromMainWorkspace(page) {
  const main = page.locator(".pipeline-layout-columns > :first-child").first();
  const selector = main.locator('select[name="decisionOwnerUserId"]');
  await selector.selectOption({ label: "Morgan Lee - Operations Leader" });
  await Promise.all([
    waitForServerActionPost(page),
    main.getByRole("button", { name: "Assign Decision Owner" }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");
}

async function assertUnavailableDom(page) {
  const bodyText = await page.locator("body").innerText();
  const titleCount = countText(bodyText, "Pricing Review rules are unavailable");
  const explanationCount = countText(bodyText, "Pricing Review cannot be submitted until the workspace rules are restored. Contact your system administrator.");
  if (titleCount !== 1) throw new Error(`Unavailable title count expected 1, found ${titleCount}`);
  if (explanationCount !== 1) throw new Error(`Unavailable explanation count expected 1, found ${explanationCount}`);
  await expectNoSubmitButton(page);
}

async function assertSubmittedDom(page) {
  const headerCount = await visibleOpportunityHeaderCount(page, opportunityName);
  if (headerCount !== 1) throw new Error(`Submitted state expected one opportunity header, found ${headerCount}`);
  const gap = await page.evaluate(() => {
    const heading = document.querySelector(".pipeline-risk-heading");
    const spacer = document.querySelector(".pipeline-risk-heading-spacer");
    const card = spacer?.previousElementSibling;
    if (!heading || !spacer || !card) return null;
    const headingRect = heading.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return headingRect.top - cardRect.bottom;
  });
  if (gap === null) throw new Error("Could not measure submitted handoff-to-risk heading gap");
  if (gap < 16) throw new Error(`Submitted handoff gap expected at least 16px, measured ${gap}px`);
}

function waitForServerActionPost(page) {
  return page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && response.url().includes("/pipeline/");
  }, { timeout: 20_000 });
}

async function assertNoRawConfigurationIds(page) {
  const text = await page.locator("body").innerText();
  if (/configuration_version_id|config_configuration_versions|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    throw new Error("page exposed raw configuration identifiers");
  }
}

function countText(text, needle) {
  return text.split(needle).length - 1;
}

function hasVisibleFixtureIdentifier(text) {
  return /CFG Runtime 01|cfg-runtime-01|bd-a|ops-a|pm-a|user-b|admin-a|foundation0a\.local/i.test(text);
}

async function visibleOpportunityHeaderCount(page, expectedName) {
  return page.locator(".pipeline-record-header h1").evaluateAll((elements, name) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return element.textContent?.trim() === name
      && rect.width > 0
      && rect.height > 0
      && style.visibility !== "hidden"
      && style.display !== "none";
  }).length, expectedName);
}

function responsibilityForScenario(scenario) {
  const labels = {
    Ready: "Ready for Pricing Review",
    "Missing configured evidence": "Add decision support evidence",
    "Invalid decision-owner accountability": "Assign an Operations Leader",
    "Configuration unavailable": "Pricing Review rules are unavailable",
    "Successful advancement and audit confirmation": "Submitted for Pricing Review",
  };
  return labels[scenario] ?? scenario;
}

function ctaForScenario(scenario) {
  const labels = {
    Ready: "Submit action visible and enabled",
    "Missing configured evidence": "Submit action absent until evidence is attached",
    "Invalid decision-owner accountability": "Submit action absent until Operations Leader is assigned",
    "Configuration unavailable": "Submit action absent while workspace rules are unavailable",
    "Successful advancement and audit confirmation": "Submitted state persists after reload",
  };
  return labels[scenario] ?? "Scenario-specific";
}

function bootstrap() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: root,
    env: qaEnv,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) throw new Error(`bootstrap failed: ${result.stderr || result.stdout}`);
}

function loadCompatibilityPack() {
  if (m1Gate) return m1Gate.runLoader("scripts/load-cfg-runtime-02-pack-local.mjs", qaEnv);
  const result = spawnSync(process.execPath, ["scripts/load-cfg-runtime-02-pack-local.mjs"], {
    cwd: root,
    env: qaEnv,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) throw new Error(`active compatibility pack load failed: ${result.stderr || result.stdout}`);
}

function ensureLocalSupabaseEnv() {
  return requireQualificationChildEnv();
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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const freePort = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(freePort));
    });
    server.on("error", reject);
  });
}
