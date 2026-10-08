import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { referencePayload } from "./m1/p1-cfg-evidence/fixtures.mjs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
const evidenceOutput = m1Gate ? m1Gate.browserOutput("cfg02") : prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
let evidenceOutputFinalized = false;
process.on("exit", () => { if (!evidenceOutputFinalized) evidenceOutput.abort(); });
const artifactRoot = evidenceOutput.temporaryRoot;
const screenshotRoot = join(artifactRoot, "screenshots");
const manifestPath = join(artifactRoot, "manifest.json");
const expectedScreenshotFiles = [
  "cfg-runtime-02-ready.png",
  "cfg-runtime-02-missing-contribution.png",
  "cfg-runtime-02-profitability-attention.png",
  "cfg-runtime-02-invalid-decision-owner.png",
  "cfg-runtime-02-configuration-unavailable.png",
  "cfg-runtime-02-pursuit-authorized.png",
  "cfg-runtime-02-pursuit-declined.png",
];
const runStartedAt = Date.now();
const previousScreenshots = snapshotScreenshots(expectedScreenshotFiles);
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `Cfg02-${Date.now()}-${randomUUID().slice(0, 8)}!`;
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
rmSync(join(root, ".next"), { recursive: true, force: true });

bootstrap();
loadCompatibilityPack();

const { service } = createClients();
await resetFixturePasswords();
const bd = await signIn("bd-a@foundation0a.local");
const ops = await signIn("ops-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");
const bdUserId = await userIdFor(service, "bd-a@foundation0a.local");
const opsUserId = await userIdFor(service, "ops-a@foundation0a.local");
const pmUserId = await userIdFor(service, "pm-a@foundation0a.local");
const userBId = await userIdFor(service, "user-b@foundation0a.local");
const runKey = `cfg-runtime-02-${Date.now()}`;
const opportunityName = "Bluegrass Data Centers - Charlotte Expansion";
const visualFixtureScope = "Charlotte expansion pursuit authorization package.";
const consoleErrors = [];
const pageErrors = [];
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

let browser;
try {
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });
  const opsContext = await signedInContext(browser, baseUrl, "ops-a@foundation0a.local");
  const userBContext = await signedInContext(browser, baseUrl, "user-b@foundation0a.local");

  await captureScenario({
    context: opsContext,
    scenario: "Pursuit decision ready",
    fixture: fixtures.ready,
    fileName: "cfg-runtime-02-ready.png",
    expectedResponsibility: "Ready for Pursuit Decision",
    expectedCtaCondition: "No outcome preselected; decision CTA disabled until a configured outcome is selected",
    beforeScreenshot: async (page) => {
      await assertQueryForgeryDoesNotChangeReadyState(page, fixtures.ready.id);
      await page.goto(`${baseUrl}/pipeline/${fixtures.ready.id}`, { waitUntil: "domcontentloaded" });
      const emptyOutcome = await callPursuit(ops, fixtures.ready.id, fixtures.ready.version, "", "", "ready-empty-outcome");
      if (emptyOutcome.data?.success !== false || emptyOutcome.data?.error !== "invalid_action") {
        throw new Error(`empty outcome direct submit did not fail: ${JSON.stringify(emptyOutcome.data ?? emptyOutcome.error)}`);
      }
    },
    assertPage: async (page) => {
      await expectText(page, "Ready for Pursuit Decision");
      await expectText(page, "Expected Gross Margin %");
      await expectText(page, "24.6%");
      await expectText(page, "Entity contribution owner attestation");
      await assertElementInViewport(page, page.getByRole("button", { name: "Record pursuit decision" }), "ready decision CTA");
      await assertNoOutcomeSelected(page);
      await assertDecisionButtonDisabled(page, "ready initial decision CTA");
      await assertDisabledDecisionButtonStyling(page);
      await assertConfiguredOutcomes(page);
      await assertCommonDom(page, { blocked: false });
    },
    afterScreenshot: async (page) => {
      await assertOutcomeEnablementBehavior(page);
    },
    databaseAssert: async () => assertNoPursuitOutcome(fixtures.ready.id),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Missing entity contribution",
    fixture: fixtures.missingContribution,
    fileName: "cfg-runtime-02-missing-contribution.png",
    expectedResponsibility: "Complete the missing entity contribution",
    expectedCtaCondition: "Main workspace shows Record entity contribution; no enabled pursuit decision action",
    beforeScreenshot: async (page) => {
      const direct = await callPursuit(ops, fixtures.missingContribution.id, fixtures.missingContribution.version, "approve_pursuit", "", "missing-contribution-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configured_pursuit_authorization_requirements_unmet") {
        throw new Error(`Missing-contribution direct submit did not fail: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
      await assertContributionTamperRejected(page, fixtures.missingContribution.id, bdUserId, "role-ineligible contributor");
      await page.goto(`${baseUrl}/pipeline/${fixtures.missingContribution.id}`, { waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Complete the missing entity contribution");
      await expectText(page, "Entity contribution owner attestation");
      await assertElementInViewport(page, page.locator('[data-main-correction="contribution"]').getByRole("button", { name: "Record entity contribution" }), "contribution completion action");
      await assertCommonDom(page, { blocked: true });
    },
    afterScreenshot: async (page) => {
      await page.locator('[data-main-correction="contribution"] select[name="contributorUserId"]').evaluateAll((selects, value) => {
        for (const element of selects) element.value = value;
      }, opsUserId);
      await Promise.all([
        waitForServerActionPost(page),
        page.locator('[data-main-correction="contribution"]').first().getByRole("button", { name: "Record entity contribution" }).click(),
      ]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Ready for Pursuit Decision");
      await page.getByRole("button", { name: "Record pursuit decision" }).waitFor({ state: "visible", timeout: 15_000 });
    },
    databaseAssert: async () => {
      await assertContributionPersisted(fixtures.missingContribution.id);
      return assertNoPursuitOutcome(fixtures.missingContribution.id);
    },
  });

  await captureScenario({
    context: opsContext,
    scenario: "Profitability or mitigation attention",
    fixture: fixtures.profitabilityAttention,
    fileName: "cfg-runtime-02-profitability-attention.png",
    expectedResponsibility: "Review profitability and mitigation",
    expectedCtaCondition: "No-Pursue action requires reason from persisted profitability state",
    assertPage: async (page) => {
      if (new URL(page.url()).searchParams.has("pursuitState")) throw new Error("profitability state used pursuitState query override");
      await expectText(page, "Expected Gross Margin %");
      await expectText(page, "11.8%");
      await expectText(page, "Review profitability and mitigation");
      await expectText(page, "No-Pursue");
      await assertDisplayedProfitabilityMatchesDatabase(page, fixtures.profitabilityAttention.id, "11.8%");
      await assertElementInViewport(page, page.locator('[data-profitability-attention-summary] [data-profitability-margin-value]'), "visible Expected Gross Margin value");
      await assertElementInViewport(page, page.getByRole("button", { name: "Record pursuit decision" }), "profitability decision action");
      await assertDecisionButtonDisabled(page, "profitability initial decision CTA");
      await assertCommonDom(page, { blocked: false });
    },
    afterScreenshot: async (page) => {
      await selectPursuitOutcome(page, "decline_pursuit");
      await fillPursuitReason(page, "No-Pursue rationale recorded from the configured profitability attention state.");
      await assertDecisionButtonEnabled(page, "profitability No-Pursue decision CTA");
      await Promise.all([waitForServerActionPost(page), page.getByRole("button", { name: "Record pursuit decision" }).click()]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Pursuit Declined");
    },
    databaseAssert: async () => assertPursuitOutcome(fixtures.profitabilityAttention.id, "declined", "no-pursue"),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Invalid Decision Owner",
    fixture: fixtures.invalidOwner,
    fileName: "cfg-runtime-02-invalid-decision-owner.png",
    expectedResponsibility: "Assign an Operations Leader",
    expectedCtaCondition: "Decision action unavailable until assigned owner is valid",
    beforeScreenshot: async (page) => {
      const direct = await callPursuit(ops, fixtures.invalidOwner.id, fixtures.invalidOwner.version, "approve_pursuit", "", "invalid-owner-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configured_pursuit_authorization_requirements_unmet") {
        throw new Error(`Invalid-owner direct submit did not fail: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
      await page.goto(`${baseUrl}/pipeline/${fixtures.invalidOwner.id}`, { waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Assign an Operations Leader");
      await expectText(page, "Operations Leader");
      await expectText(page, "Taylor Chen - Project Manager");
      await assertElementInViewport(page, page.locator('[data-main-correction="owner"]').getByRole("button", { name: "Assign Decision Owner" }), "Decision Owner assignment action");
      await assertCommonDom(page, { blocked: true });
    },
    afterScreenshot: async (page) => {
      const ownerForm = page.locator('[data-main-correction="owner"]:visible');
      const ownerSelect = ownerForm.locator('select[name="pursuitAuthorityUserId"]');
      await ownerSelect.selectOption(opsUserId);
      const selectedOwner = await ownerSelect.inputValue();
      if (selectedOwner !== opsUserId) throw new Error(`Morgan Lee was not selected before assignment submit: selected=${selectedOwner}`);
      const [ownerActionResponse] = await Promise.all([
        waitForServerActionPost(page),
        ownerForm.getByRole("button", { name: "Assign Decision Owner" }).click(),
      ]);
      const assignmentError = new URL(page.url()).searchParams.get("error");
      if (assignmentError) throw new Error(`valid owner assignment failed with ${assignmentError}`);
      await waitForDatabaseAssertion(
        () => assertPursuitAuthority(fixtures.invalidOwner.id, opsUserId),
        `valid Decision Owner assignment persistence; selected=${selectedOwner}; nextAction=${ownerActionResponse?.request?.().headers?.()["next-action"] ?? "none"}; postData=${ownerActionResponse?.request?.().postData?.() ?? "none"}; actionRedirect=${ownerActionResponse?.headers?.()["x-action-redirect"] ?? "none"}; location=${ownerActionResponse?.headers?.()["location"] ?? "none"}; response=${ownerActionResponse?.status?.()} ${ownerActionResponse?.url?.()}; currentUrl=${page.url()}`
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Ready for Pursuit Decision");
      await expectText(page, "Morgan Lee");
    },
    databaseAssert: async () => {
      await assertPursuitAuthority(fixtures.invalidOwner.id, opsUserId);
      return assertNoPursuitOutcome(fixtures.invalidOwner.id);
    },
  });

  await captureScenario({
    context: userBContext,
    scenario: "Configuration unavailable",
    fixture: fixtures.unavailable,
    fileName: "cfg-runtime-02-configuration-unavailable.png",
    expectedResponsibility: "Pursuit Authorization rules are unavailable",
    expectedCtaCondition: "No pursuit decision action is available",
    beforeScreenshot: async () => {
      const direct = await callPursuit(userB, fixtures.unavailable.id, fixtures.unavailable.version, "approve_pursuit", "", "unavailable-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configuration_unavailable") {
        throw new Error(`Unavailable direct submit did not fail: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
    },
    assertPage: async (page) => {
      await assertUnavailableDom(page);
      await assertUnavailableMarginPresentation(page, fixtures.unavailable.id);
      await expectText(page, "Submitted");
      await assertCommonDom(page, { blocked: true });
    },
    databaseAssert: async () => assertNoPursuitOutcome(fixtures.unavailable.id),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Pursuit Authorized",
    fixture: fixtures.pursue,
    fileName: "cfg-runtime-02-pursuit-authorized.png",
    expectedResponsibility: "Pursuit Authorized",
    expectedCtaCondition: "Pursue recorded through real browser CTA and persists after reload",
    beforeScreenshot: async (page) => {
      await selectPursuitOutcome(page, "approve_pursuit");
      await assertDecisionButtonEnabled(page, "Pursue decision CTA");
      await Promise.all([waitForServerActionPost(page), page.getByRole("button", { name: "Record pursuit decision" }).click()]);
      await page.reload({ waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Pursuit Authorized");
      await expectText(page, "The opportunity is authorized to proceed to bid preparation. No bid has been submitted.");
      await assertNoOutcomeControls(page);
      await assertCommonDom(page, { blocked: false });
    },
    databaseAssert: async () => assertPursuitOutcome(fixtures.pursue.id, "approved", "pursue"),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Pursuit Declined",
    fixture: fixtures.decline,
    fileName: "cfg-runtime-02-pursuit-declined.png",
    expectedResponsibility: "Pursuit Declined",
    expectedCtaCondition: "No-Pursue recorded through real browser CTA and persists after reload",
    beforeScreenshot: async (page) => {
      await selectPursuitOutcome(page, "decline_pursuit");
      await fillPursuitReason(page, "No-Pursue because the commercial basis and access risk are not aligned.");
      await assertDecisionButtonEnabled(page, "No-Pursue decision CTA");
      await Promise.all([waitForServerActionPost(page), page.getByRole("button", { name: "Record pursuit decision" }).click()]);
      await page.reload({ waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Pursuit Declined");
      await expectText(page, "Pursuit declined");
      await assertNoOutcomeControls(page);
      await assertCommonDom(page, { blocked: false });
    },
    databaseAssert: async () => assertPursuitOutcome(fixtures.decline.id, "declined", "no-pursue"),
  });

  await opsContext.close();
  await userBContext.close();
} finally {
  if (browser) await browser.close();
  server.kill();
}

const failedManifest = manifest.filter((entry) => entry.browserResult !== "pass" || entry.databaseResult !== "pass");
writeFileSync(manifestPath, `${JSON.stringify(canonicalizeCfgRuntime03EvidencePaths({
  runTimestamp: new Date().toISOString(),
  viewport: { width: 1440, height: 1000 },
  screenshotCount: manifest.length,
  expectedScreenshotCount: 7,
  consoleErrorCount: consoleErrors.length,
  pageErrorCount: pageErrors.length,
  scenarios: manifest,
  consoleErrors,
  pageErrors,
}, evidenceOutput), null, 2)}\n`);

if (manifest.length !== 7) throw new Error(`Expected exactly seven CFG-RUNTIME-02 screenshots, captured ${manifest.length}`);
if (failedManifest.length > 0) {
  for (const entry of failedManifest) console.error(`FAILED SCENARIO: ${entry.scenario}: ${entry.failureDetail}`);
  throw new Error(`CFG-RUNTIME-02 browser acceptance failed ${failedManifest.length} scenario(s).`);
}
if (consoleErrors.length > 0) throw new Error(`Unexpected browser console errors: ${consoleErrors.join("; ")}`);
if (pageErrors.length > 0) throw new Error(`Unexpected page errors: ${pageErrors.join("; ")}`);

console.log(`CFG-RUNTIME-02 browser acceptance captured ${manifest.length} focused states.`);
const committedArtifactRoot = evidenceOutput.finalize();
evidenceOutputFinalized = true;
console.log(`Manifest: ${join(committedArtifactRoot, "manifest.json")}`);

async function createFixtures() {
  const ready = await createPursuitFixture({ scenario: "ready", recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", contribution: true, pursuitAuthorityUserId: opsUserId });
  const missingContribution = await createPursuitFixture({ scenario: "missing-contribution", recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", contribution: false, pursuitAuthorityUserId: opsUserId });
  const profitabilityAttention = await createPursuitFixture({ scenario: "profitability-attention", recommendation: "decline", marginConfidence: "risk", commercialTermsRisk: "risk", contribution: true, pursuitAuthorityUserId: opsUserId });
  const invalidOwner = await createPursuitFixture({ scenario: "invalid-owner", recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", contribution: true, pursuitAuthorityUserId: pmUserId });
  const unavailable = await createWorkspaceBUnavailableOpportunity();
  const pursue = await createPursuitFixture({ scenario: "pursue", recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", contribution: true, pursuitAuthorityUserId: opsUserId });
  const decline = await createPursuitFixture({ scenario: "decline", recommendation: "decline", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", contribution: true, pursuitAuthorityUserId: opsUserId });
  return { ready, missingContribution, profitabilityAttention, invalidOwner, unavailable, pursue, decline };
}

async function createPursuitFixture({ scenario, recommendation, marginConfidence, commercialTermsRisk, contribution, pursuitAuthorityUserId }) {
  const key = `${runKey}-${scenario}`;
  const created = await createOpportunity(bd, `${opportunityName}`, key);
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: created.opportunity.id,
    p_payload: completeQualification({ recommendation, marginConfidence, commercialTermsRisk }),
    p_command_id: commandId(`${key}-qualification`),
    p_expected_version: created.opportunity.version,
    p_correlation_id: `${key}-qualification`,
  });
  assertRpc(qualified, `${scenario} qualification`);
  const accountable = await bd.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: created.opportunity.id,
    p_decision_owner_user_id: opsUserId,
    p_decision_due_at: "2026-07-18",
    p_command_id: commandId(`${key}-pricing-owner`),
    p_expected_version: qualified.data.opportunity.version,
    p_correlation_id: `${key}-pricing-owner`,
  });
  assertRpc(accountable, `${scenario} pricing owner`);
  const evidence = await bd.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: created.opportunity.id,
    p_payload: await referencePayload(service, bd, created.opportunity.id, accountable.data.opportunity.version, "decision_support", "qualification_decision_support", { fileName: `${key}.txt`, mimeType: "text/plain", sizeBytes: 42, checksumSha256: key }),
    p_command_id: commandId(`${key}-evidence`),
    p_expected_version: accountable.data.opportunity.version,
    p_correlation_id: `${key}-evidence`,
  });
  assertRpc(evidence, `${scenario} evidence`);
  const submitted = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: created.opportunity.id,
    p_command_id: commandId(`${key}-submit-pricing`),
    p_expected_version: evidence.data.opportunity.version,
    p_correlation_id: `${key}-submit-pricing`,
  });
  assertRpc(submitted, `${scenario} pricing submit`);
  const approved = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: created.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId(`${key}-approve-pricing`),
    p_expected_version: submitted.data.opportunity.version,
    p_correlation_id: `${key}-approve-pricing`,
  });
  assertRpc(approved, `${scenario} pricing approve`);
  const { error: updateError } = await service.from("opportunities").update({
    pursuit_authority_user_id: pursuitAuthorityUserId,
    pursuit_authorization_status: "ready_for_authorization",
    pursuit_authorization_due_at: "2026-07-19",
    updated_at: new Date().toISOString(),
  }).eq("id", created.opportunity.id);
  if (updateError) throw new Error(`${scenario} pursuit authority update failed: ${updateError.message}`);
  if (contribution) await addContribution(created.opportunity.id, pmUserId);
  const { data: row, error: rowError } = await service.from("opportunities").select("version").eq("id", created.opportunity.id).single();
  if (rowError) throw new Error(rowError.message);
  return { id: created.opportunity.id, version: row.version, name: opportunityName };
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

async function createWorkspaceBUnavailableOpportunity() {
  const now = new Date().toISOString();
  const id = randomUUID();
  const qualificationId = randomUUID();
  const stable = `${runKey}-unavailable-${randomUUID()}`;
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
    anticipated_start: "2026-08-10",
    bid_due_date: "2026-07-20",
    owner_user_id: userBId,
    stable_opportunity_key: stable,
    duplicate_fingerprint: stable,
    intake_complete: true,
    qualification_complete: true,
    decision_readiness_status: "decision_approved",
    decision_owner_user_id: userBId,
    decision_due_at: "2026-07-18",
    submitted_for_decision_at: now,
    submitted_for_decision_by: userBId,
    pursuit_authority_user_id: userBId,
    pursuit_authorization_status: "ready_for_authorization",
    lifecycle_status: "decision_required",
    status: "awaiting_go_no_go",
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
    ...completeQualificationDb({ recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable" }),
    prepared_by: userBId,
    completed_at: now,
    created_at: now,
    updated_at: now,
  });
  if (qualificationError) throw new Error(`workspace B qualification insert failed: ${qualificationError.message}`);
  await addContribution(id, userBId, ids.workspaceB);
  return { id, version: 1, name: opportunityName };
}

async function addContribution(opportunityId, userId, workspaceId = ids.workspaceA) {
  const { error } = await service.from("opportunity_assignments").insert({
    workspace_id: workspaceId,
    opportunity_id: opportunityId,
    user_id: userId,
    assignment_type: "estimator",
    status: "active",
    created_by: userId,
  });
  if (error) throw new Error(`contribution insert failed: ${error.message}`);
}

async function captureScenario({ context, scenario, fixture, fileName, expectedResponsibility, expectedCtaCondition, query, beforeScreenshot, assertPage, afterScreenshot, databaseAssert }) {
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`${scenario}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${scenario}: ${message.text()}`);
  });
  let browserResult = "fail";
  let databaseResult = "fail";
  let databaseDetail = "";
  let failureDetail = "";
  const screenshotPath = join(screenshotRoot, fileName);
  try {
    await page.goto(`${baseUrl}/pipeline/${fixture.id}${query ? `?${query}` : ""}`, { waitUntil: "domcontentloaded" });
    await beforeScreenshot?.(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await assertPage(page);
    await assertPresentationClean(page);
    await assertNoRawIdsOrFixtureKeys(page);
    const headerCount = await visibleOpportunityHeaderCount(page, fixture.name);
    if (headerCount !== 1) throw new Error(`expected exactly one opportunity header, found ${headerCount}`);
    const scrollY = await page.evaluate(() => window.scrollY);
    if (scrollY !== 0) throw new Error(`scroll position expected 0 at capture, found ${scrollY}`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    stampScreenshotCapture(screenshotPath, `${runKey}:${scenario}:${Date.now()}`);
    const freshness = assertFreshScreenshot(fileName, screenshotPath);
    await afterScreenshot?.(page);
    databaseDetail = await databaseAssert();
    databaseResult = "pass";
    browserResult = "pass";
    manifest.push({ scenario, fixture: fixture.id, governingConfigurationVersion: "e54badc5-a052-413b-be2a-760f18582822", expectedResponsibility, expectedCtaCondition, browserResult, databaseResult, databaseDetail, consoleErrorCount: consoleErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length, pageErrorCount: pageErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length, screenshotPath, screenshotHash: freshness.current.sha256, captureTime: freshness.current.mtimeIso });
  } catch (error) {
    failureDetail = error instanceof Error ? error.message : String(error);
    try {
      const bodyText = await page.locator("body").innerText({ timeout: 1000 });
      failureDetail += `\nRendered text:\n${bodyText.slice(0, 2000)}`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch {
      // Preserve original failure.
    }
    manifest.push({ scenario, fixture: fixture.id, governingConfigurationVersion: "e54badc5-a052-413b-be2a-760f18582822", expectedResponsibility, expectedCtaCondition, browserResult, databaseResult, databaseDetail, failureDetail, consoleErrorCount: consoleErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length, pageErrorCount: pageErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length, screenshotPath });
  } finally {
    await page.close();
  }
}

async function assertCommonDom(page, { blocked }) {
  const headerCount = await visibleOpportunityHeaderCount(page, opportunityName);
  if (headerCount !== 1) throw new Error(`opportunity header count expected 1, found ${headerCount}`);
  const bannerCount = await visibleSelectorCount(page, ".pipeline-current-state");
  if (bannerCount !== 1) throw new Error(`responsibility banner count expected 1, found ${bannerCount}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error("page has horizontal overflow");
  if (blocked) {
    const terminalEnabled = await page.locator('[data-pursuit-outcome-form] button:has-text("Record pursuit decision")').evaluateAll((buttons) => buttons.filter((button) => !button.disabled).length);
    if (terminalEnabled > 0) throw new Error(`blocked state exposed enabled terminal pursuit decision CTA count ${terminalEnabled}`);
  }
}

async function assertElementInViewport(page, locator, label) {
  await locator.first().waitFor({ state: "visible", timeout: 15_000 });
  const box = await locator.first().boundingBox();
  if (!box) throw new Error(`${label} is not visible`);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error(`missing viewport while checking ${label}`);
  if (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) {
    throw new Error(`${label} is outside captured viewport: ${JSON.stringify(box)} within ${JSON.stringify(viewport)}`);
  }
}

async function assertContributionTamperRejected(page, opportunityId, forgedUserId, label) {
  const cleanUrl = `${baseUrl}/pipeline/${opportunityId}`;
  const forms = page.locator('[data-main-correction="contribution"]');
  const form = forms.first();
  const selector = page.locator('[data-main-correction="contribution"] select[name="contributorUserId"]');
  await page.waitForTimeout(500);
  await selector.evaluateAll((selects, value) => {
    for (const element of selects) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = "Forged contributor";
      element.appendChild(option);
    }
  }, forgedUserId);
  await selector.selectOption(forgedUserId);
  if (await selector.first().inputValue() !== forgedUserId) throw new Error(`${label} tamper value was reset before submission`);
  await submitCorrectionAttempt(page, form.getByRole("button", { name: "Record entity contribution" }));
  const error = new URL(page.url()).searchParams.get("error");
  const { data, error: queryError } = await service.from("opportunity_assignments").select("id").eq("opportunity_id", opportunityId).eq("user_id", forgedUserId).eq("assignment_type", "estimator").eq("status", "active");
  if (queryError) throw new Error(`${label} tamper verification failed: ${queryError.message}`);
  if (Array.isArray(data) && data.length > 0) throw new Error(`${label} tamper persisted a forged contribution`);
  const { data: validContribution, error: validContributionError } = await service.from("opportunity_assignments").select("id").eq("opportunity_id", opportunityId).eq("user_id", opsUserId).eq("assignment_type", "estimator").eq("status", "active");
  if (validContributionError) throw new Error(`${label} tamper valid-contribution check failed: ${validContributionError.message}`);
  if (Array.isArray(validContribution) && validContribution.length > 0) throw new Error(`${label} tamper unexpectedly completed the valid contribution`);
  if (!error) {
    const { data: opportunity, error: opportunityError } = await service.from("opportunities").select("pursuit_authorization_status").eq("id", opportunityId).single();
    if (opportunityError) throw new Error(`${label} tamper opportunity check failed: ${opportunityError.message}`);
    if (opportunity.pursuit_authorization_status !== "ready_for_authorization") throw new Error(`${label} tamper unexpectedly changed pursuit state`);
  }
  await page.goto(cleanUrl, { waitUntil: "domcontentloaded" });
}

async function assertOwnerTamperRejected(page, opportunityId, forgedUserId, label) {
  const cleanUrl = `${baseUrl}/pipeline/${opportunityId}`;
  const form = page.locator('[data-main-correction="owner"]').first();
  const selector = page.locator('[data-main-correction="owner"] select[name="pursuitAuthorityUserId"]');
  await page.waitForTimeout(500);
  await selector.evaluateAll((selects, value) => {
    for (const element of selects) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = "Forged user";
      element.appendChild(option);
    }
  }, forgedUserId);
  await selector.selectOption(forgedUserId);
  if (await selector.first().inputValue() !== forgedUserId) throw new Error(`${label} tamper value was reset before submission`);
  await submitCorrectionAttempt(page, form.getByRole("button", { name: "Assign Decision Owner" }));
  const error = new URL(page.url()).searchParams.get("error");
  const { data, error: queryError } = await service.from("opportunities").select("pursuit_authority_user_id").eq("id", opportunityId).single();
  if (queryError) throw new Error(`${label} tamper verification failed: ${queryError.message}`);
  if (data.pursuit_authority_user_id === forgedUserId) throw new Error(`${label} tamper persisted a forged Decision Owner`);
  if (!error && data.pursuit_authority_user_id !== pmUserId) throw new Error(`${label} tamper unexpectedly changed Decision Owner`);
  await page.goto(cleanUrl, { waitUntil: "domcontentloaded" });
}

async function submitCorrectionAttempt(page, button) {
  const responsePromise = waitForServerActionPost(page).catch((error) => {
    if (String(error?.message ?? error).includes("Timeout")) return null;
    throw error;
  });
  await button.click();
  await responsePromise;
}

async function assertConfiguredOutcomes(page) {
  const outcomeButtons = await page.locator(".pipeline-outcome-choice").evaluateAll((choices) => choices.map((choice) => choice.textContent?.replace(/\s+/g, " ").trim() ?? ""));
  for (const outcome of ["Pursue", "Hold pending evidence", "No-Pursue"]) {
    if (!outcomeButtons.some((text) => text.includes(outcome))) throw new Error(`configured outcome missing from decision controls: ${outcome}`);
  }
  const unconfiguredOutcome = outcomeButtons.find((text) => /award|bid submission|p1-01b\.2/i.test(text));
  if (unconfiguredOutcome) throw new Error(`unexpected unconfigured outcome rendered: ${unconfiguredOutcome}`);
}

async function assertNoOutcomeSelected(page) {
  const checked = await page.locator('[data-pursuit-outcome-form] input[type="radio"]:checked').count();
  if (checked !== 0) throw new Error(`ready state had preselected outcome count ${checked}`);
}

async function assertDecisionButtonDisabled(page, label) {
  const disabled = await page.getByRole("button", { name: "Record pursuit decision" }).first().isDisabled();
  if (!disabled) throw new Error(`${label} was expected to be disabled`);
}

async function assertDecisionButtonEnabled(page, label) {
  const enabled = await page.getByRole("button", { name: "Record pursuit decision" }).first().isEnabled();
  if (!enabled) throw new Error(`${label} was expected to be enabled`);
}

async function assertOutcomeEnablementBehavior(page) {
  await assertNoOutcomeSelected(page);
  await assertDecisionButtonDisabled(page, "ready decision CTA before selection");
  const disabledBackground = await decisionButtonBackground(page);
  await page.getByRole("button", { name: "Record pursuit decision" }).first().hover();
  const disabledHoverBackground = await decisionButtonBackground(page);
  if (disabledHoverBackground !== disabledBackground) {
    throw new Error(`disabled decision CTA changed background on hover: ${disabledBackground} -> ${disabledHoverBackground}`);
  }

  await selectPursuitOutcome(page, "approve_pursuit");
  await assertDecisionButtonEnabled(page, "Pursue CTA after selection");
  const enabledBackground = await decisionButtonBackground(page);
  if (enabledBackground === disabledBackground) {
    throw new Error(`enabled and disabled decision CTA backgrounds matched: ${enabledBackground}`);
  }

  await selectPursuitOutcome(page, "decline_pursuit");
  await fillPursuitReason(page, "");
  await assertDecisionButtonDisabled(page, "No-Pursue CTA without justification");
  await fillPursuitReason(page, "No-Pursue justification for configured outcome.");
  await assertDecisionButtonEnabled(page, "No-Pursue CTA with justification");

  await selectPursuitOutcome(page, "hold_pending_evidence");
  await fillPursuitReason(page, "");
  await assertDecisionButtonDisabled(page, "Hold CTA without mitigation");
  await fillPursuitReason(page, "Hold pending evidence until mitigation is recorded.");
  await assertDecisionButtonEnabled(page, "Hold CTA with mitigation");
}

async function assertDisabledDecisionButtonStyling(page) {
  const button = page.getByRole("button", { name: "Record pursuit decision" }).first();
  const styles = await button.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
      color: computed.color,
      cursor: computed.cursor
    };
  });
  if (styles.cursor !== "not-allowed") throw new Error(`disabled decision CTA cursor was ${styles.cursor}`);
  if (!["rgb(229, 231, 235)", "#e5e7eb"].includes(styles.backgroundColor)) {
    throw new Error(`disabled decision CTA background was ${styles.backgroundColor}`);
  }
  if (!["rgb(203, 213, 225)", "#cbd5e1"].includes(styles.borderColor)) {
    throw new Error(`disabled decision CTA border was ${styles.borderColor}`);
  }
}

async function decisionButtonBackground(page) {
  return page.getByRole("button", { name: "Record pursuit decision" }).first().evaluate((el) => window.getComputedStyle(el).backgroundColor);
}

async function selectPursuitOutcome(page, value) {
  const form = page.locator("[data-pursuit-outcome-form]").first();
  await form.locator(`input[name="pursuitAction"][value="${value}"]`).check();
}

async function fillPursuitReason(page, value) {
  const form = page.locator("[data-pursuit-outcome-form]").first();
  await form.locator('textarea[name="pursuitReason"]').fill(value);
}

async function assertNoOutcomeControls(page) {
  const controls = await page.locator('[data-pursuit-outcome-form], .pipeline-outcome-choice input[type="radio"], button:has-text("Record pursuit decision")').count();
  if (controls !== 0) throw new Error(`completed state exposed outcome-selection controls: ${controls}`);
}

async function assertPresentationClean(page) {
  const text = await page.locator("body").innerText();
  if (new URL(page.url()).searchParams.has("pursuitState")) throw new Error("business state is being forced by pursuitState query parameter");
  for (const forbidden of ["Invalid Date", "NaN", "undefined", "null", "No bid submission, award, project conversion, mobilization, field execution, billing, or closeout action is available in this slice."]) {
    if (text.includes(forbidden)) throw new Error(`forbidden presentation text visible: ${forbidden}`);
  }
  if (/No-PursueJustification|PursueNo extra|Decline pursuitdeclined|Pursuit declineddeclined|declined · package/.test(text)) {
    throw new Error("concatenated outcome or audit text is visible");
  }
}

async function assertQueryForgeryDoesNotChangeReadyState(page, opportunityId) {
  await page.goto(`${baseUrl}/pipeline/${opportunityId}?pursuitState=decline-recommended`, { waitUntil: "domcontentloaded" });
  await expectText(page, "Ready for Pursuit Decision");
  await expectText(page, "24.6%");
  const text = await page.locator("body").innerText();
  if (text.includes("Review profitability and mitigation") || text.includes("Decline pursuit recommended") || text.includes("11.8%")) {
    throw new Error("forged pursuitState query changed the rendered profitability business state");
  }
}

async function assertDisplayedProfitabilityMatchesDatabase(page, opportunityId, expectedValue) {
  const { data, error } = await ops.rpc("p1_01b1_pursuit_authorization_readiness_v1", { p_opportunity_id: opportunityId });
  if (error) throw new Error(`readiness query failed for profitability assertion: ${error.message}`);
  const displayValue = data?.profitability?.displayValue;
  const versionId = data?.configuration?.configurationVersionId;
  if (displayValue !== expectedValue) throw new Error(`database Expected Gross Margin mismatch: expected ${expectedValue}, got ${displayValue}`);
  if (!versionId) throw new Error("missing active configuration version");
  const visibleValue = (await page.locator('[data-profitability-attention-summary] [data-profitability-margin-value]').first().innerText()).trim();
  if (visibleValue !== displayValue) throw new Error(`visible Expected Gross Margin ${visibleValue} did not match database ${displayValue}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectText(page, "Review profitability and mitigation");
  await expectText(page, displayValue);
  const reloadedValue = (await page.locator('[data-profitability-attention-summary] [data-profitability-margin-value]').first().innerText()).trim();
  if (reloadedValue !== displayValue) throw new Error(`reloaded Expected Gross Margin ${reloadedValue} did not match database ${displayValue}`);
}

async function assertUnavailableDom(page) {
  const text = await page.locator("body").innerText();
  const title = "Pursuit Authorization rules are unavailable";
  const explanation = "A pursuit decision cannot be recorded until the workspace rules are restored. Contact your system administrator.";
  if (countText(text, title) !== 1) throw new Error(`Unavailable title count expected 1, found ${countText(text, title)}`);
  if (countText(text, explanation) !== 1) throw new Error(`Unavailable explanation count expected 1, found ${countText(text, explanation)}`);
  if (text.includes("Not submitted")) throw new Error("Unavailable state is contaminated by Not submitted package status");
  const controls = await page.locator('[data-pursuit-outcome-form], button:has-text("Record pursuit decision")').count();
  if (controls !== 0) throw new Error(`Unavailable state exposed pursuit decision controls: ${controls}`);
}

async function assertUnavailableMarginPresentation(page, opportunityId) {
  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("0.0%")) throw new Error("Unavailable state rendered fabricated 0.0% Expected Gross Margin");
  await expectText(page, "Not available");
  const { data, error } = await ops.rpc("p1_01b1_pursuit_authorization_readiness_v1", { p_opportunity_id: opportunityId });
  if (error) throw new Error(`unavailable readiness query failed: ${error.message}`);
  const persistedDisplay = data?.profitability?.displayValue ?? null;
  const visibleValue = (await page.locator(".pipeline-fact-row").filter({ hasText: "Expected Gross Margin %" }).first().innerText()).trim();
  if (persistedDisplay && !visibleValue.includes(persistedDisplay)) {
    throw new Error(`Unavailable state did not show persisted Expected Gross Margin ${persistedDisplay}`);
  }
  if (!persistedDisplay && !visibleValue.includes("Not available")) {
    throw new Error(`Unavailable state did not show Not available for absent persisted margin: ${visibleValue}`);
  }
  await page.goto(`${baseUrl}/pipeline/${opportunityId}?pursuitState=decline-recommended`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Pursuit Authorization rules are unavailable" }).waitFor({ state: "visible", timeout: 10000 });
  const forgedText = await page.locator("body").innerText();
  if (forgedText.includes("0.0%")) throw new Error("forged pursuitState caused fabricated unavailable margin");
  if (!forgedText.includes(persistedDisplay ?? "Not available")) {
    throw new Error("forged pursuitState changed unavailable margin presentation");
  }
  await page.goto(`${baseUrl}/pipeline/${opportunityId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Pursuit Authorization rules are unavailable" }).waitFor({ state: "visible", timeout: 10000 });
}

async function assertNoPursuitOutcome(id) {
  const { data, error } = await service.from("opportunities").select("pursuit_authorization_status,pursuit_authorization_configuration_version_id,pursuit_authorization_gate_key,pursuit_authorization_outcome_key").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (data.pursuit_authorization_configuration_version_id || data.pursuit_authorization_gate_key || data.pursuit_authorization_outcome_key || ["approved", "declined"].includes(data.pursuit_authorization_status)) {
    throw new Error(`expected no pursuit outcome/provenance, got ${JSON.stringify(data)}`);
  }
  return "no terminal pursuit outcome or provenance persisted";
}

async function assertPursuitOutcome(id, status, outcomeKey) {
  const { data, error } = await service.from("opportunities").select("pursuit_authorization_status,pursuit_authorization_configuration_version_id,pursuit_authorization_gate_key,pursuit_authorization_outcome_key,pursuit_authorized_by,pursuit_authorized_at,pursuit_authorization_reason").eq("id", id).single();
  if (error) throw new Error(error.message);
  const finalDecision = status === "approved" || status === "declined";
  if (data.pursuit_authorization_status !== status || data.pursuit_authorization_gate_key !== "pursuit-authorization" || data.pursuit_authorization_outcome_key !== outcomeKey || !data.pursuit_authorization_configuration_version_id || !data.pursuit_authorized_by || (finalDecision && !data.pursuit_authorized_at) || (status === "hold_pending_evidence" && !data.pursuit_authorization_reason)) {
    throw new Error(`expected persisted pursuit outcome ${status}/${outcomeKey}, got ${JSON.stringify(data)}`);
  }
  return `status=${status}; outcome=${outcomeKey}; configurationVersion=${data.pursuit_authorization_configuration_version_id}`;
}

async function assertContributionPersisted(id) {
  const { data, error } = await service.from("opportunity_assignments").select("id").eq("opportunity_id", id).eq("user_id", opsUserId).eq("assignment_type", "estimator").eq("status", "active");
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) throw new Error("entity contribution assignment was not persisted");
  return "entity contribution persisted";
}

async function assertPursuitAuthority(id, userId) {
  const { data, error } = await service.from("opportunities").select("pursuit_authority_user_id").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (data.pursuit_authority_user_id !== userId) throw new Error(`pursuit authority not persisted: ${JSON.stringify(data)}`);
  return "pursuit authority persisted";
}

async function waitForDatabaseAssertion(assertion, label) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${label} did not become true: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function callPursuit(client, id, version, action, reason, key) {
  return client.rpc("record_opportunity_pursuit_authorization_v1", {
    p_opportunity_id: id,
    p_pursuit_action: action,
    p_reason: reason,
    p_command_id: commandId(`${runKey}-${key}`),
    p_expected_version: version,
    p_correlation_id: `${runKey}-${key}`,
  });
}

async function cleanupFixtures() {
  const { data } = await service.from("opportunities").select("id").eq("name", opportunityName).eq("scope_summary", visualFixtureScope);
  const idsToDelete = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (idsToDelete.length === 0) return;
  await service.from("audit_events").delete().in("entity_id", idsToDelete);
  await service.from("domain_events").delete().in("aggregate_id", idsToDelete);
  await service.from("opportunity_pursuit_authorization_events").delete().in("opportunity_id", idsToDelete);
  await service.from("evidence_links").delete().in("entity_id", idsToDelete);
  await service.from("evidence_objects").delete().in("opportunity_id", idsToDelete);
  await service.from("opportunity_assignments").delete().in("opportunity_id", idsToDelete);
  await service.from("opportunity_qualifications").delete().in("opportunity_id", idsToDelete);
  await service.from("opportunities").delete().in("id", idsToDelete);
}

async function setBusinessFacingNames() {
  for (const [userId, displayName] of [
    [bdUserId, "Jordan Ellis"],
    [opsUserId, "Morgan Lee"],
    [pmUserId, "Taylor Chen"],
    [userBId, "Avery Patel"],
  ]) {
    const { error } = await service.from("user_profiles").update({ display_name: displayName }).eq("user_id", userId);
    if (error) throw new Error(`display name update failed for ${displayName}: ${error.message}`);
  }
}

async function resetFixturePasswords() {
  const listed = await service.auth.admin.listUsers();
  if (listed.error) throw new Error(`fixture user lookup failed: ${listed.error.message}`);
  for (const email of ["bd-a@foundation0a.local", "ops-a@foundation0a.local", "pm-a@foundation0a.local", "user-b@foundation0a.local"]) {
    const user = listed.data.users.find((entry) => entry.email === email);
    if (!user?.id) throw new Error(`missing fixture auth user ${email}`);
    const updated = await service.auth.admin.updateUserById(user.id, { password: fixturePassword, email_confirm: true });
    if (updated.error) throw new Error(`fixture password reset failed for ${email}: ${updated.error.message}`);
  }
}

function completeQualification({ recommendation, marginConfidence, commercialTermsRisk }) {
  return {
    strategicFit: "strong",
    customerRelationship: "acceptable",
    geographyFit: "strong",
    projectTypeFit: "strong",
    scopeClarity: "acceptable",
    designMaturity: "acceptable",
    commercialTermsRisk,
    scheduleFeasibility: "acceptable",
    crewCapacityFit: "acceptable",
    materialLeadTimeRisk: "acceptable",
    permitsAccessRisk: "acceptable",
    safetyQualityComplexity: "acceptable",
    subcontractorDependency: "acceptable",
    cashFlowRisk: "acceptable",
    marginConfidence,
    contractualRisk: "acceptable",
    riskSummary: "Pursuit package is ready for configured authorization review.",
    assumptions: "Pricing Review package and contribution inputs are current.",
    recommendation,
  };
}

function completeQualificationDb(input) {
  const q = completeQualification(input);
  return {
    strategic_fit: q.strategicFit,
    customer_relationship: q.customerRelationship,
    geography_fit: q.geographyFit,
    project_type_fit: q.projectTypeFit,
    scope_clarity: q.scopeClarity,
    design_maturity: q.designMaturity,
    commercial_terms_risk: q.commercialTermsRisk,
    schedule_feasibility: q.scheduleFeasibility,
    crew_capacity_fit: q.crewCapacityFit,
    material_lead_time_risk: q.materialLeadTimeRisk,
    permits_access_risk: q.permitsAccessRisk,
    safety_quality_complexity: q.safetyQualityComplexity,
    subcontractor_dependency: q.subcontractorDependency,
    cash_flow_risk: q.cashFlowRisk,
    margin_confidence: q.marginConfidence,
    contractual_risk: q.contractualRisk,
    risk_summary: q.riskSummary,
    assumptions: q.assumptions,
    recommendation: q.recommendation,
  };
}

function assertRpc(result, label) {
  if (result.error || result.data?.success !== true) throw new Error(`${label} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
}

async function signedInContext(browser, appBaseUrl, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${appBaseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await Promise.all([page.waitForLoadState("domcontentloaded"), page.getByRole("button", { name: "Sign in" }).click()]);
  await page.waitForTimeout(700);
  if (new URL(page.url()).pathname !== "/pipeline") throw new Error(`sign-in failed for ${email}; current URL ${page.url()}`);
  await page.close();
  return context;
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
}

function waitForServerActionPost(page) {
  return page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST"
      && response.url().includes("/pipeline/")
      && Boolean(request.headers()["next-action"]);
  }, { timeout: 20_000 });
}

async function assertNoRawIdsOrFixtureKeys(page) {
  const text = await page.locator("body").innerText();
  if (/configuration_version_id|config_configuration_versions|cfg-runtime-02|bd-a|ops-a|pm-a|user-b|foundation0a\.local|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    throw new Error("page exposed raw IDs or fixture identifiers");
  }
}

async function visibleOpportunityHeaderCount(page, expectedName) {
  return page.locator(".pipeline-record-header h1").evaluateAll((elements, name) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return element.textContent?.trim() === name && rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }).length, expectedName);
}

async function visibleSelectorCount(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }).length);
}

function countText(text, needle) {
  return text.split(needle).length - 1;
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
    snapshots[fileName] = { exists: true, path: filePath, sha256: sha256File(filePath), mtimeMs: stat.mtimeMs, mtimeIso: stat.mtime.toISOString() };
  }
  return snapshots;
}

function assertFreshScreenshot(fileName, filePath) {
  if (!existsSync(filePath)) throw new Error(`Screenshot was not created: ${filePath}`);
  const stat = statSync(filePath);
  const current = { path: filePath, sha256: sha256File(filePath), mtimeMs: stat.mtimeMs, mtimeIso: stat.mtime.toISOString() };
  const previous = previousScreenshots[fileName] ?? { exists: false };
  if (current.mtimeMs < runStartedAt) throw new Error(`Screenshot was not generated during current run: ${fileName}`);
  if (previous.exists && previous.sha256 === current.sha256) throw new Error(`Screenshot hash was reused from a previous run: ${fileName}`);
  return { previous, current, hashReusedFromPreviousRun: Boolean(previous.exists && previous.sha256 === current.sha256) };
}

function stampScreenshotCapture(filePath, stamp) {
  const png = readFileSync(filePath);
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  if (!png.subarray(0, signature.length).equals(signature)) throw new Error(`Screenshot is not a PNG: ${filePath}`);
  let offset = signature.length;
  let iendOffset = -1;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > png.length) throw new Error(`Malformed PNG chunk in screenshot: ${filePath}`);
    if (type === "IEND") {
      iendOffset = offset;
      break;
    }
    offset = chunkEnd;
  }
  if (iendOffset < 0) throw new Error(`Missing PNG IEND chunk in screenshot: ${filePath}`);
  const keyword = Buffer.from("cfg-runtime-02-capture", "latin1");
  const data = Buffer.concat([keyword, Buffer.from([0]), Buffer.from(stamp, "latin1")]);
  const type = Buffer.from("tEXt", "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  const chunk = Buffer.concat([length, type, data, crc]);
  writeFileSync(filePath, Buffer.concat([png.subarray(0, iendOffset), chunk, png.subarray(iendOffset)]));
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function bootstrap() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], { cwd: root, env: qaEnv, encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });
  if (result.status !== 0) throw new Error(`bootstrap failed: ${result.stderr || result.stdout}`);
}

function loadCompatibilityPack() {
  if (m1Gate) return m1Gate.runLoader("scripts/load-cfg-runtime-02-pack-local.mjs", qaEnv);
  const result = spawnSync(process.execPath, ["scripts/load-cfg-runtime-02-pack-local.mjs"], { cwd: root, env: qaEnv, encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });
  if (result.status !== 0) throw new Error(`CFG-RUNTIME-02 pack load failed: ${result.stderr || result.stdout}`);
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
