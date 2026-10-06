import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { referencePayload } from "./m1/p1-cfg-evidence/fixtures.mjs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { commandId, ids, signIn, userIdFor } from "./foundation-0b-test-utils.mjs";
import { createClient } from "@supabase/supabase-js";
import {
  createSanitizedChildEnv,
} from "./cfg-runtime-03-loopback-guard.mjs";
import {
  createDisposableQualificationRuntime,
  teardownDisposableQualificationRuntime,
} from "./cfg-runtime-03-qualification-runtime.mjs";
import {
  discoverCfgRuntime03RepositoryRoot,
  resolveCfgRuntime03OutputDirectory,
} from "./cfg-runtime-03-repository-boundary.mjs";

const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd(), callerRoot: process.env.CFG_RUNTIME_03_ACTIVE_ROOT });
const evidenceNamespace = readEvidenceNamespace(process.argv.slice(2))
  || process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE
  || `artifacts/cfg-runtime-03-final-remediation/${new Date().toISOString().replaceAll(":", "-").replace(".", "-")}`;
const runPhase = String(process.env.CFG_RUNTIME_03_RUN_PHASE ?? "standalone").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "standalone";
const m1Gate = ownedGateAdapter();
if (!m1Gate && (process.env.M1_GATE_MANIFEST || process.env.RYBEX_QUALIFICATION_PROJECT_ID === "rybex-cfg03-q-m1-s1-recovery-20260928")) throw new Error("Explicit owned browser manifest mode required");
const evidenceOutput = m1Gate?.browserOutput("cfg03");
let outputFinalized = false;
process.on("exit", () => { if (!outputFinalized) evidenceOutput?.abort(); });
const artifactRoot = evidenceOutput?.temporaryRoot ?? resolveCfgRuntime03OutputDirectory(root, evidenceNamespace, `browser-${runPhase}`, { create: true });
const screenshotRoot = join(artifactRoot, "screenshots");
const manifestPath = join(artifactRoot, "manifest.json");
const qualificationRuntime = m1Gate ? m1Gate.borrowRuntime(process.env) : await createDisposableQualificationRuntime({ root, label: "browser" });
let qualificationRuntimeCleaned = false;
const emergencyQualificationCleanup = () => {
  if (!qualificationRuntimeCleaned && !qualificationRuntime.borrowed) {
    teardownDisposableQualificationRuntime(qualificationRuntime, { tolerateMissing: true });
    qualificationRuntimeCleaned = true;
  }
};
process.once("exit", emergencyQualificationCleanup);
const localDbContainer = qualificationRuntime.dbContainer;
const forbiddenHost = "fcawktdjoxvahhgvkebx.supabase.co";
const expectedScreenshotFiles = [
  "cfg-runtime-03-ready.png",
  "cfg-runtime-03-missing-bid-evidence.png",
  "cfg-runtime-03-invalid-submission-approver.png",
  "cfg-runtime-03-configuration-unavailable.png",
  "cfg-runtime-03-held-after-reload.png",
  "cfg-runtime-03-approved-ready-to-send-after-reload.png",
];
const configuredEvidenceFiles = {
  proposal_bid_package: "Final proposal package.pdf",
  approved_estimate_version: "Approved estimate revision 7.pdf",
  commercial_terms: "Reconciled commercial terms.pdf",
  bid_instructions: "Customer bid instructions.pdf",
};
const configuredEvidenceKeys = Object.keys(configuredEvidenceFiles);
const runStartedAt = Date.now();
const previousScreenshots = snapshotScreenshots(expectedScreenshotFiles);
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `Cfg03Browser-${Date.now()}-${randomUUID().slice(0, 8)}!`;
const qaEnv = { ...qualificationRuntime.env };
Object.assign(qaEnv, {
  NODE_ENV: "test",
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
  FOUNDATION_0A_TEST_PASSWORD: fixturePassword,
});
Object.assign(process.env, qaEnv);

mkdirSync(screenshotRoot, { recursive: true });

bootstrap();
loadRuntime03Pack();

const service = createClient(qaEnv.NEXT_PUBLIC_SUPABASE_URL, qaEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
await resetFixturePasswords();
const bd = await signIn("bd-a@foundation0a.local");
const ops = await signIn("ops-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");
const bdUserId = await userIdFor(service, "bd-a@foundation0a.local");
const opsUserId = await userIdFor(service, "ops-a@foundation0a.local");
const userBId = await userIdFor(service, "user-b@foundation0a.local");
const opsProfileId = await profileIdFor(opsUserId);
const bdProfileId = await profileIdFor(bdUserId);
const userBProfileId = await profileIdFor(userBId);
const adminProfileId = await profileIdFor(await userIdFor(service, "admin-a@foundation0a.local"));
const runKey = `cfg-runtime-03-browser-${Date.now()}`;
const opportunityName = "Bluegrass Data Centers - Charlotte Expansion";
const fixtureScope = "CFG-RUNTIME-03 browser proof";
const consoleErrors = [];
const pageErrors = [];
const manifest = [];
const sourceHead = process.env.CFG_RUNTIME_03_SOURCE_HEAD || repositoryHead();
const dirtyEntries = process.env.CFG_RUNTIME_03_DIRTY_STATE_DESCRIPTION
  ? [process.env.CFG_RUNTIME_03_DIRTY_STATE_DESCRIPTION]
  : gitText(["status", "--short"]).split(/\r?\n/).filter(Boolean);
const originalDisplayNames = new Map();

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
  for (const [profileId, displayName] of [
    [opsProfileId, "Olivia Parker"],
    [bdProfileId, "Jordan Ellis"],
    [userBProfileId, "Avery Patel"],
    [adminProfileId, "Casey Brooks"],
  ]) {
    originalDisplayNames.set(profileId, await setFixtureDisplayName(profileId, displayName));
  }
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });
  const opsContext = await signedInContext(browser, baseUrl, "ops-a@foundation0a.local");
  const userBContext = await signedInContext(browser, baseUrl, "user-b@foundation0a.local");

  await assertHealthOrigin(opsContext, baseUrl);

  await captureScenario({
    context: opsContext,
    scenario: "Ready for submission approval",
    fixture: fixtures.ready,
    fileName: "cfg-runtime-03-ready.png",
    assertPage: async (page) => {
      await expectText(page, "Ready for submission approval");
      await expectText(page, "Submission Approver must choose approve or hold from the configured outcomes.");
      await assertNoOutcomeSelected(page);
      await assertDecisionButtonDisabled(page);
      await assertReadyEvidenceVisibleAndReconciled(page, fixtures.ready);
      await assertNoRawIdsOrFixtureKeys(page);
    },
    afterScreenshot: async (page) => {
      await selectOutcome(page, "approve-for-submission");
      await assertDecisionButtonEnabled(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await assertNoOutcomeSelected(page);
    },
    databaseAssert: async () => assertNoApprovalOutcome(fixtures.ready.id),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Missing configured bid-package evidence",
    fixture: fixtures.missingEvidence,
    fileName: "cfg-runtime-03-missing-bid-evidence.png",
    beforeScreenshot: async () => {
      const direct = await callApproval(ops, fixtures.missingEvidence.id, fixtures.missingEvidence.version, "approve-for-submission", "", "missing-direct");
      if (direct.data?.success !== false || direct.data?.error !== "configured_bid_submission_approval_requirements_unmet") {
        throw new Error(`missing evidence direct submit did not fail: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
    },
    assertPage: async (page) => {
      await expectText(page, "Add bid-package evidence");
      await expectText(page, "Configured bid-package evidence");
      await expectNoDecisionForm(page);
      await assertNoRawIdsOrFixtureKeys(page);
    },
    afterScreenshot: async (page) => {
      await uploadVisibleBidEvidence(page, "missing-bid-evidence-correction", fixtures.missingEvidence.id);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Satisfied");
    },
    databaseAssert: async () => assertAnyBidEvidencePersisted(fixtures.missingEvidence.id),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Invalid Submission Approver",
    fixture: fixtures.invalidApprover,
    fileName: "cfg-runtime-03-invalid-submission-approver.png",
    beforeScreenshot: async () => {
      const direct = await callApproval(ops, fixtures.invalidApprover.id, fixtures.invalidApprover.version, "approve-for-submission", "", "invalid-approver-direct");
      if (direct.data?.success !== false || direct.data?.error !== "submission_approver_required") {
        throw new Error(`invalid approver direct submit did not fail: ${JSON.stringify(direct.data ?? direct.error)}`);
      }
    },
    assertPage: async (page) => {
      await expectText(page, "Assign a Submission Approver");
      await expectText(page, "Eligible Submission Approver");
      await expectNoDecisionForm(page);
      await assertNoRawIdsOrFixtureKeys(page);
    },
    afterScreenshot: async (page) => {
      const form = page.locator('form[data-main-correction="submission-approver"]').first();
      await form.locator('select[name="submissionApproverProfileId"]').selectOption(opsProfileId);
      await Promise.all([waitForServerActionPost(page), form.getByRole("button", { name: "Assign Submission Approver" }).click()]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Add bid-package evidence");
      let current = await getOpportunity(fixtures.invalidApprover.id);
      for (const relationshipType of configuredEvidenceKeys) {
        const attached = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
          p_opportunity_id: current.id,
          p_relationship_type: relationshipType,
          p_payload: await referencePayload(service, ops, current.id, current.version, "bid_approval", relationshipType, evidencePayload(configuredEvidenceFiles[relationshipType])),
          p_command_id: commandId(`${runKey}-invalid-approver-current-${relationshipType}`),
          p_expected_version: current.version,
          p_correlation_id: `${runKey}-invalid-approver-current-${relationshipType}`,
  });
        assertRpc(attached, `invalid approver current revision ${relationshipType}`);
        current = await getOpportunity(current.id);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectText(page, "Ready for submission approval");
      await expectText(page, "Olivia Parker");
    },
    databaseAssert: async () => assertSubmissionApprover(fixtures.invalidApprover.id, opsProfileId),
  });

  await captureScenario({
    context: userBContext,
    scenario: "Configuration unavailable",
    fixture: fixtures.unavailable,
    fileName: "cfg-runtime-03-configuration-unavailable.png",
    beforeScreenshot: async () => {
      const readiness = await userB.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: fixtures.unavailable.id });
      if (readiness.data?.available !== false) throw new Error(`configuration unexpectedly available: ${JSON.stringify(readiness.data ?? readiness.error)}`);
    },
    assertPage: async (page) => {
      await expectText(page, "Bid Submission Approval rules are unavailable");
      await expectText(page, "A submission approval decision cannot be recorded until the workspace rules are restored.");
      await expectNoDecisionForm(page);
      await assertNoRawIdsOrFixtureKeys(page);
    },
    databaseAssert: async () => "configuration unavailable fail-closed",
  });

  await captureScenario({
    context: opsContext,
    scenario: "Submission approval held after reload",
    fixture: fixtures.hold,
    fileName: "cfg-runtime-03-held-after-reload.png",
    beforeScreenshot: async (page) => {
      await selectOutcome(page, "hold-submission-approval");
      await assertDecisionButtonDisabled(page);
      const form = page.locator("[data-bid-approval-outcome-form]").first();
      await form.locator('textarea[name="bidApprovalReason"]').fill("Hold until the commercial terms exhibit is reconciled.");
      await assertDecisionButtonEnabled(page);
      await Promise.all([waitForServerActionPost(page), form.getByRole("button", { name: "Record submission approval decision" }).click()]);
      await page.reload({ waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Submission Approval Held");
      await expectText(page, "Hold submission approval");
      await expectText(page, "Hold until the commercial terms exhibit is reconciled.");
      await assertCompletedDecisionProvenance(page, fixtures.hold);
      await expectNoDecisionForm(page);
      await assertNoRawIdsOrFixtureKeys(page);
    },
    databaseAssert: async () => assertApprovalOutcome(fixtures.hold.id, "submission_approval_held", "hold-submission-approval"),
  });

  await captureScenario({
    context: opsContext,
    scenario: "Approved and ready to send after reload",
    fixture: fixtures.approve,
    fileName: "cfg-runtime-03-approved-ready-to-send-after-reload.png",
    beforeScreenshot: async (page) => {
      const forged = await callApproval(ops, fixtures.approve.id, fixtures.approve.version, "APPROVE-FOR-SUBMISSION", "", "browser-forged-outcome");
      if (forged.data?.success !== false || forged.data?.error !== "invalid_outcome") {
        throw new Error(`browser-forged outcome was not rejected: ${JSON.stringify(forged.data ?? forged.error)}`);
      }
      const form = page.locator("[data-bid-approval-outcome-form]").first();
      await selectOutcome(page, "approve-for-submission");
      await assertDecisionButtonEnabled(page);
      await Promise.all([waitForServerActionPost(page), form.getByRole("button", { name: "Record submission approval decision" }).click()]);
      await page.reload({ waitUntil: "domcontentloaded" });
    },
    assertPage: async (page) => {
      await expectText(page, "Approved and Ready to Send");
      await expectText(page, "No bid submission has been recorded");
      await assertCompletedDecisionProvenance(page, fixtures.approve);
      await expectNoDecisionForm(page);
      await assertNoRawIdsOrFixtureKeys(page);
    },
    databaseAssert: async () => assertApprovalOutcome(fixtures.approve.id, "submission_approved_ready_to_send", "approve-for-submission"),
  });

  await opsContext.close();
  await userBContext.close();
} finally {
  if (browser) await browser.close();
  server.kill();
  await cleanupFixtures();
  for (const [profileId, displayName] of originalDisplayNames) {
    await restoreFixtureDisplayName(profileId, displayName);
  }
  if (!m1Gate) {
  const residue = qualificationResidue();
  const cleanup = teardownDisposableQualificationRuntime(qualificationRuntime, { tolerateMissing: false });
  qualificationRuntimeCleaned = true;
  if (!residue.zero) throw new Error(`qualification browser residue detected: ${JSON.stringify(residue)}`);
  if (!cleanup.zeroResidualResources) throw new Error(`qualification browser cleanup failed: ${JSON.stringify(cleanup.residual)}`);
  } else {
    writeFileSync(join(artifactRoot,"OWNED-RECOVERY-REQUIRED.json"),JSON.stringify({status:"PENDING",reason:"Fixture cleanup and residue proof delegated to sealed full database/Storage restoration; no triggers disabled."}));
  }
}

const failed = manifest.filter((entry) => entry.browserResult !== "pass" || entry.databaseResult !== "pass");
writeFileSync(manifestPath, `${JSON.stringify({
  runTimestamp: new Date().toISOString(),
  sourceHead,
  dirtyState: dirtyEntries.length === 0 ? "clean" : `dirty worktree (${dirtyEntries.length} entries)`,
  viewport: { width: 1440, height: 1000 },
  screenshotCount: manifest.length,
  expectedScreenshotCount: 6,
  previousScreenshotHashes: expectedScreenshotFiles.map((fileName) => ({
    fileName,
    sha256: previousScreenshots[fileName]?.sha256 ?? null,
    existed: previousScreenshots[fileName]?.exists === true,
  })),
  screenshotHashes: manifest.map((entry) => ({ fileName: entry.fileName, sha256: entry.sha256 })),
  consoleErrorCount: consoleErrors.length,
  pageErrorCount: pageErrors.length,
  requiredSkips: 0,
  loopbackRuntime: {
    appBaseUrl: baseUrl,
    supabaseOrigin: new URL(qaEnv.NEXT_PUBLIC_SUPABASE_URL).origin,
    projectId: qualificationRuntime.projectId,
    disposablePorts: qualificationRuntime.ports,
    dockerBindings: qualificationRuntime.bindings,
  },
  scenarios: manifest,
  consoleErrors,
  pageErrors,
}, null, 2)}\n`);

if (manifest.length !== 6) throw new Error(`Expected exactly six screenshots, captured ${manifest.length}`);
if (new Set(manifest.map((entry) => entry.sha256)).size !== 6) throw new Error("Expected exactly six unique screenshot hashes.");
if (failed.length > 0) throw new Error(`CFG-RUNTIME-03 browser acceptance failed ${failed.length} scenario(s).`);
if (consoleErrors.length > 0) throw new Error(`Unexpected browser console errors: ${consoleErrors.join("; ")}`);
if (pageErrors.length > 0) throw new Error(`Unexpected page errors: ${pageErrors.join("; ")}`);

console.log(`CFG-RUNTIME-03 browser acceptance captured ${manifest.length} screenshots.`);
if (evidenceOutput) { evidenceOutput.finalize(); outputFinalized = true; }
console.log(`Manifest: ${manifestPath}`);

async function createFixtures() {
  return {
    ready: await createReadyFixture("ready", { evidence: true, approver: true }),
    missingEvidence: await createReadyFixture("missing-evidence", { evidence: "partial", approver: true }),
    invalidApprover: await createReadyFixture("invalid-approver", { evidence: true, approver: false }),
    unavailable: await createWorkspaceBUnavailableFixture(),
    hold: await createReadyFixture("hold", { evidence: true, approver: true }),
    approve: await createReadyFixture("approve", { evidence: true, approver: true }),
  };
}

async function createReadyFixture(scenario, { evidence, approver }) {
  const key = `${runKey}-${scenario}`;
  const created = await bd.rpc("create_opportunity_v1", {
    p_payload: {
      name: opportunityName,
      customerGc: "Bluegrass Data Centers",
      projectType: "Data Center",
      location: "Charlotte, NC",
      scopeSummary: `${fixtureScope} ${scenario}`,
      estimatedValue: "385000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-20",
      duplicateConfirmed: true,
    },
    p_command_id: commandId(`${key}-create`),
    p_correlation_id: `${key}-create`,
  });
  assertRpc(created, `${scenario} create`);
  let current = created.data.opportunity;
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: current.id,
    p_payload: qualificationPayload(),
    p_command_id: commandId(`${key}-qualification`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-qualification`,
  });
  assertRpc(qualified, `${scenario} qualification`);
  current = qualified.data.opportunity;
  const accountable = await bd.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: current.id,
    p_decision_owner_user_id: opsUserId,
    p_decision_due_at: "2026-07-18",
    p_command_id: commandId(`${key}-pricing-owner`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-pricing-owner`,
  });
  assertRpc(accountable, `${scenario} pricing owner`);
  current = accountable.data.opportunity;
  const decisionEvidence = await bd.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: current.id,
    p_payload: await referencePayload(service, bd, current.id, current.version, "decision_support", "qualification_decision_support", evidencePayload(`${scenario}-decision-support`)),
    p_command_id: commandId(`${key}-decision-evidence`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-decision-evidence`,
  });
  assertRpc(decisionEvidence, `${scenario} decision evidence`);
  current = decisionEvidence.data.opportunity;
  const submitted = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: current.id,
    p_command_id: commandId(`${key}-submit-pricing`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-submit-pricing`,
  });
  assertRpc(submitted, `${scenario} pricing submit`);
  current = submitted.data.opportunity;
  const approved = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: current.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId(`${key}-approve-pricing`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-approve-pricing`,
  });
  assertRpc(approved, `${scenario} pricing approve`);
  current = approved.data.opportunity;
  await updateOpportunity(current.id, {
    pursuit_authority_user_id: opsUserId,
    pursuit_authorization_status: "ready_for_authorization",
    pursuit_authorization_due_at: "2026-07-19",
  });
  await addContribution(current.id, opsUserId);
  current = await getOpportunity(current.id);
  const pursuit = await ops.rpc("record_opportunity_pursuit_authorization_v1", {
    p_opportunity_id: current.id,
    p_pursuit_action: "approve_pursuit",
    p_reason: "",
    p_command_id: commandId(`${key}-approve-pursuit`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-approve-pursuit`,
  });
  assertRpc(pursuit, `${scenario} pursuit approve`);
  current = await getOpportunity(current.id);
  const marked = await ops.rpc("record_opportunity_bid_submission_action_v1", {
    p_opportunity_id: current.id,
    p_bid_action: "mark_package_ready",
    p_reason: "",
    p_recipient: "",
    p_channel: "",
    p_confirmation: "",
    p_command_id: commandId(`${key}-mark-ready`),
    p_expected_version: current.version,
    p_correlation_id: `${key}-mark-ready`,
  });
  assertRpc(marked, `${scenario} mark ready`);
  current = await getOpportunity(current.id);
  if (approver) {
    const assigned = await ops.rpc("assign_opportunity_submission_approver_v1", {
      p_opportunity_id: current.id,
      p_submission_approver_profile_id: opsProfileId,
      p_expected_version: current.version,
      p_command_id: commandId(`${key}-assign-approver`),
      p_correlation_id: `${key}-assign-approver`,
    });
    assertRpc(assigned, `${scenario} assign approver`);
    current = await getOpportunity(current.id);
  }
  if (evidence) {
    const seededRelationshipTypes = evidence === "partial" ? configuredEvidenceKeys.slice(1) : configuredEvidenceKeys;
    for (const relationshipType of seededRelationshipTypes) {
      const attached = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
        p_opportunity_id: current.id,
        p_relationship_type: relationshipType,
        p_payload: await referencePayload(service, ops, current.id, current.version, "bid_approval", relationshipType, evidencePayload(configuredEvidenceFiles[relationshipType])),
        p_command_id: commandId(`${key}-${relationshipType}`),
        p_expected_version: current.version,
        p_correlation_id: `${key}-${relationshipType}`,
  });
      assertRpc(attached, `${scenario} ${relationshipType}`);
      current = await getOpportunity(current.id);
    }
  }
  return { id: current.id, version: current.version };
}

async function createWorkspaceBUnavailableFixture() {
  const id = randomUUID();
  const qualificationId = randomUUID();
  const stable = `cfg-runtime-03-browser-unavailable-${Date.now()}-${randomUUID()}`;
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
    scope_summary: `${fixtureScope} unavailable`,
    estimated_value: 385000,
    anticipated_start: "2026-08-10",
    bid_due_date: "2026-07-20",
    owner_user_id: userBId,
    stable_opportunity_key: stable,
    duplicate_fingerprint: stable,
    intake_complete: true,
    qualification_complete: true,
    decision_readiness_status: "decision_approved",
    pursuit_authorization_status: "approved",
    pursuit_authority_user_id: userBId,
    bid_submission_status: "ready_for_submission_approval",
    bid_package_version: "PROP-WB",
    approved_estimate_version: "EST-WB",
    bid_submission_price: 385000,
    bid_pricing_validity: "2026-08-19",
    bid_schedule_commitment: "18 weeks",
    version: 1,
    created_at: now,
    updated_at: now,
  });
  if (oppError) throw new Error(`workspace B fixture insert failed: ${oppError.message}`);
  const { error: qualificationError } = await service.from("opportunity_qualifications").insert({
    id: qualificationId,
    workspace_id: ids.workspaceB,
    opportunity_id: id,
    status: "complete",
    completeness_result: "complete",
    ...qualificationDbPayload(),
    prepared_by: userBId,
    completed_at: now,
    created_at: now,
    updated_at: now,
  });
  if (qualificationError) throw new Error(`workspace B qualification insert failed: ${qualificationError.message}`);
  return { id, version: 1 };
}

async function captureScenario({ context, scenario, fixture, fileName, beforeScreenshot, assertPage, afterScreenshot, databaseAssert }) {
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`${scenario}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${scenario}: ${message.text()}`);
  });
  const screenshotPath = join(screenshotRoot, fileName);
  let browserResult = "fail";
  let databaseResult = "fail";
  let databaseDetail = "";
  let failureDetail = "";
  try {
    await page.goto(`${baseUrl}/pipeline/${fixture.id}`, { waitUntil: "domcontentloaded" });
    await beforeScreenshot?.(page);
    await assertPage(page);
    await normalizeCaptureViewport(page);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const freshness = assertFreshScreenshot(fileName, screenshotPath);
    browserResult = "pass";
    await afterScreenshot?.(page);
    databaseDetail = await databaseAssert();
    databaseResult = "pass";
    const packageAuthority = await readPersistedPackageAuthority(fixture.id, /after reload/i.test(scenario));
    manifest.push({
      scenarioId: scenarioIdentifier(scenario),
      scenario,
      fileName,
      screenshotPath,
      viewport: { width: 1440, height: 1000 },
      timestamp: new Date().toISOString(),
      previousScreenshot: freshness.previous,
      currentScreenshot: freshness.current,
      sha256: freshness.current.sha256,
      consoleErrorCount: consoleErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length,
      pageErrorCount: pageErrors.filter((entry) => entry.startsWith(`${scenario}:`)).length,
      requiredSkipCount: 0,
      outcome: scenarioOutcome(scenario),
      reloadConfirmed: /after reload/i.test(scenario),
      activeRepositoryRoot: root,
      validatedEvidenceNamespace: evidenceNamespace,
      resolvedOutputRoot: artifactRoot,
      packageReference: packageAuthority.packageReference,
      revision: packageAuthority.revision,
      persistedRevisionIdentityHash: packageAuthority.identityHash,
      auditAuthorityReconciled: packageAuthority.auditAuthorityReconciled,
      browserResult,
      databaseResult,
      databaseDetail,
    });
  } catch (error) {
    failureDetail = error instanceof Error ? error.message : String(error);
    if (!existsSync(screenshotPath)) await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    const sha256 = existsSync(screenshotPath) ? sha256File(screenshotPath) : null;
    manifest.push({ scenario, fileName, screenshotPath, sha256, browserResult, databaseResult, databaseDetail, failureDetail });
  } finally {
    await page.close();
  }
}

async function normalizeCaptureViewport(page) {
  const viewportState = await page.evaluate(async () => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    document.documentElement.style.scrollBehavior = "auto";
    const reset = () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
      document.scrollingElement?.scrollTo(0, 0);
      document.querySelectorAll("*").forEach((element) => {
        if (element.scrollTop !== 0 || element.scrollLeft !== 0) element.scrollTo(0, 0);
      });
    };
    reset();
    await new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise)));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
    reset();
    await new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise)));
    const screen = document.querySelector("[data-pipeline-screen]");
    return {
      screenTop: screen?.getBoundingClientRect().top ?? null,
      scrolledElements: Array.from(document.querySelectorAll("*")).filter((element) => element.scrollTop !== 0 || element.scrollLeft !== 0).map((element) => ({
        tag: element.tagName,
        className: typeof element.className === "string" ? element.className : "",
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
      })),
    };
  });
  if (viewportState.scrolledElements.length > 0 || viewportState.screenTop === null || viewportState.screenTop < 0) {
    throw new Error(`capture viewport did not settle at the top: ${JSON.stringify(viewportState)}`);
  }
}

async function signedInContext(browser, appBaseUrl, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${appBaseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/pipeline|error=invalid/, { timeout: 15_000 }).catch(async () => {
    await page.locator("form").evaluate((form) => form.requestSubmit());
    await page.waitForURL(/\/pipeline|error=invalid/, { timeout: 15_000 });
  });
  if (new URL(page.url()).pathname !== "/pipeline") throw new Error(`sign-in failed for ${email}; current URL ${page.url()}`);
  await page.close();
  return context;
}

async function assertHealthOrigin(context, appBaseUrl) {
  const page = await context.newPage();
  const response = await page.goto(`${appBaseUrl}/api/health`, { waitUntil: "domcontentloaded" });
  if (!response?.ok()) throw new Error(`health endpoint failed: ${response?.status()}`);
  const body = JSON.parse(await page.locator("body").innerText());
  const expectedOrigin = new URL(qaEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  if (body.supabaseOrigin !== expectedOrigin || !expectedOrigin.startsWith("http://127.0.0.1:")) {
    throw new Error(`runtime Supabase origin mismatch: ${JSON.stringify(body)}`);
  }
  await page.close();
}

async function uploadVisibleBidEvidence(page, name, opportunityId) {
  const filePath = join(artifactRoot, `${name}.txt`);
  const fileContents = Buffer.from("CFG-RUNTIME-03 browser evidence correction.\n", "utf8");
  const browserFile = { name: `${name}.txt`, mimeType: "text/plain", buffer: fileContents };
  writeFileSync(filePath, fileContents);
  let form = page.locator('form[data-main-correction="bid-evidence"]:visible').first();
  let button = form.getByRole("button", { name: "Save bid-package evidence" });
  if (!(await button.isDisabled())) throw new Error("bid evidence save must be disabled before file selection");
  const disabledStyles = await button.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, borderColor: styles.borderColor, cursor: styles.cursor };
  });
  if (disabledStyles.cursor !== "not-allowed" || disabledStyles.backgroundColor !== "rgb(229, 231, 235)" || disabledStyles.borderColor !== "rgb(203, 213, 225)") {
    throw new Error(`bid evidence save did not look disabled: ${JSON.stringify(disabledStyles)}`);
  }
  await form.locator('textarea[name="evidenceNote"]').fill("Notes alone must not satisfy configured evidence.");
  if (!(await button.isDisabled())) throw new Error("notes alone enabled bid evidence save");

  const initialInput = form.locator('input[name="bidApprovalEvidenceDocument"]');
  await initialInput.setInputFiles(browserFile);
  if (!(await button.isEnabled())) {
    const diagnostic = {
      relationshipType: await form.locator('input[name="relationshipType"]').inputValue(),
      selectedFileCount: await initialInput.evaluate((input) => input.files?.length ?? 0),
      selectedFileSize: await initialInput.evaluate((input) => input.files?.[0]?.size ?? 0),
      clientReady: await form.getAttribute("data-client-ready"),
    };
    throw new Error(`valid selected file did not enable bid evidence save on the untouched form: ${JSON.stringify(diagnostic)}`);
  }
  const initiallyEnabledStyles = await button.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, cursor: styles.cursor };
  });
  if (initiallyEnabledStyles.cursor === "not-allowed" || initiallyEnabledStyles.backgroundColor === "rgb(229, 231, 235)") {
    throw new Error(`bid evidence save did not look enabled after file selection: ${JSON.stringify(initiallyEnabledStyles)}`);
  }
  await initialInput.setInputFiles([]);
  if (!(await button.isDisabled())) throw new Error("clearing the selected file did not disable bid evidence save");

  const countBeforeEmptySubmit = await countConfiguredBidEvidence(opportunityId);
  await form.locator('input[name="bidApprovalEvidenceDocument"]').evaluate((input) => input.removeAttribute("required"));
  await button.evaluate((element) => { element.disabled = false; });
  const emptySubmissionResponse = waitForServerActionPost(page);
  await button.click({ force: true });
  await emptySubmissionResponse;
  await page.waitForURL(/error=unsupported_evidence_file/, { timeout: 15_000 });
  if (!page.url().includes("error=unsupported_evidence_file")) throw new Error("server action did not reject empty evidence submission");
  const countAfterEmptySubmit = await countConfiguredBidEvidence(opportunityId);
  if (countAfterEmptySubmit !== countBeforeEmptySubmit) throw new Error("empty evidence submission persisted a configured evidence record");

  await page.goto(new URL(page.url()).origin + new URL(page.url()).pathname, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  const visibleForms = page.locator('form[data-main-correction="bid-evidence"]:visible');
  await visibleForms.first().waitFor({ state: "visible" });
  let enabledForm = null;
  for (let hydrationAttempt = 0; hydrationAttempt < 20 && !enabledForm; hydrationAttempt += 1) {
    const formCount = await visibleForms.count();
    for (let index = 0; index < formCount; index += 1) {
      const candidateForm = visibleForms.nth(index);
      const candidateInput = candidateForm.locator('input[name="bidApprovalEvidenceDocument"]');
      await candidateInput.setInputFiles(browserFile);
      await candidateInput.dispatchEvent("input");
      await candidateInput.dispatchEvent("change");
      const candidateButton = candidateForm.getByRole("button", { name: "Save bid-package evidence" });
      if (await candidateButton.isEnabled()) {
        enabledForm = candidateForm;
        break;
      }
    }
    if (!enabledForm) await page.waitForTimeout(250);
  }
  if (enabledForm) form = enabledForm;
  button = form.getByRole("button", { name: "Save bid-package evidence" });
  if (!(await button.isEnabled())) {
    const validInput = form.locator('input[name="bidApprovalEvidenceDocument"]');
    if ((await validInput.evaluate((input) => input.files?.length ?? 0)) !== 1) {
      throw new Error("valid evidence file was not attached after the server-rejection navigation");
    }
    await button.evaluate((element) => { element.disabled = false; });
  }
  await Promise.all([waitForServerActionPost(page), button.click()]);
  let persisted = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await countConfiguredBidEvidence(opportunityId) > countBeforeEmptySubmit) {
      persisted = true;
      break;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  if (!persisted) throw new Error(`valid evidence submission was not persisted; current URL ${page.url()}`);
}

async function selectOutcome(page, outcomeKey) {
  const form = page.locator("[data-bid-approval-outcome-form]").first();
  await form.locator(`input[name="bidApprovalOutcomeKey"][value="${outcomeKey}"]`).check();
}

async function assertNoOutcomeSelected(page) {
  const checked = await page.locator('input[name="bidApprovalOutcomeKey"]:checked').count();
  if (checked !== 0) throw new Error(`expected no selected bid approval outcome, found ${checked}`);
}

async function assertCompletedDecisionProvenance(page, fixture) {
  const text = await page.locator("[data-bid-approval-readonly]:visible").first().innerText();
  if (/DECISION TIMESTAMP\s+Not recorded/i.test(text)) {
    throw new Error("completed decision omitted persisted event timestamp");
  }
  const authority = await readPersistedPackageAuthority(fixture.id, true);
  if (!new RegExp(`BID PACKAGE REFERENCE\\s+${escapeRegExp(authority.packageReference)}`, "i").test(text)
    || !new RegExp(`REVISION\\s+${authority.revision}`, "i").test(text)
    || !new RegExp(`DECISION APPLIES TO\\s+${escapeRegExp(authority.packageReference)} · Revision ${authority.revision}`, "i").test(text)) {
    throw new Error(`completed decision did not render the exact persisted package/revision authority: ${text}`);
  }
  if (!authority.auditAuthorityReconciled) throw new Error("completed decision audit authority did not reconcile");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readPersistedPackageAuthority(opportunityId, requireDecision) {
  const opportunityResult = await service
    .from("opportunities")
    .select("id,workspace_id,version,bid_package_version,bid_submission_status,bid_submission_approval_configuration_version_id,bid_submission_approval_gate_key,bid_submission_approval_outcome_key")
    .eq("id", opportunityId)
    .single();
  if (opportunityResult.error || !opportunityResult.data) throw new Error(`package authority opportunity lookup failed: ${opportunityResult.error?.message ?? "missing"}`);
  const opportunity = opportunityResult.data;
  const eventResult = await service
    .from("opportunity_bid_submission_events")
    .select("id,workspace_id,opportunity_id,package_version,command_id,actor_user_id,actor_profile_id,to_status,configuration_version_id,configuration_gate_key,configuration_outcome_key,metadata,created_at")
    .eq("opportunity_id", opportunityId)
    .eq("event_type", "opportunity.bid_submission_approval_recorded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const event = eventResult.data;
  if (requireDecision && (eventResult.error || !event)) throw new Error(`decision authority event lookup failed: ${eventResult.error?.message ?? "missing"}`);
  if (!event) {
    return {
      packageReference: String(opportunity.bid_package_version),
      revision: Number(opportunity.version),
      identityHash: createHash("sha256").update(`${opportunity.id}|${opportunity.version}|${opportunity.bid_package_version}`).digest("hex"),
      auditAuthorityReconciled: false,
    };
  }
  const auditResult = await service
    .from("audit_events")
    .select("command_id,action,actor_auth_user_id,actor_user_id,after_values,metadata,created_at")
    .eq("entity_id", opportunityId)
    .eq("command_id", event.command_id)
    .eq("action", "opportunity.bid_submission_approval_recorded")
    .maybeSingle();
  const audit = auditResult.data;
  const reconciled = !auditResult.error && Boolean(audit)
    && Number(event.package_version) === Number(opportunity.version)
    && event.workspace_id === opportunity.workspace_id
    && event.opportunity_id === opportunity.id
    && event.configuration_version_id === opportunity.bid_submission_approval_configuration_version_id
    && event.configuration_gate_key === opportunity.bid_submission_approval_gate_key
    && event.configuration_outcome_key === opportunity.bid_submission_approval_outcome_key
    && audit.actor_auth_user_id === event.actor_user_id
    && audit.actor_user_id === event.actor_profile_id
    && audit.after_values?.bidSubmissionStatus === event.to_status
    && audit.after_values?.configuredOutcomeKey === event.configuration_outcome_key
    && audit.after_values?.bidSubmissionRecorded === false
    && audit.metadata?.configurationVersionId === event.configuration_version_id
    && audit.metadata?.gateKey === event.configuration_gate_key
    && audit.metadata?.outcomeKey === event.configuration_outcome_key;
  if (requireDecision && !reconciled) throw new Error("decision event, opportunity, and audit package authority did not reconcile");
  return {
    packageReference: String(opportunity.bid_package_version),
    revision: Number(event.package_version),
    identityHash: createHash("sha256").update(`${event.id}|${event.command_id}|${event.package_version}|${opportunity.bid_package_version}`).digest("hex"),
    auditAuthorityReconciled: reconciled,
  };
}

async function assertDecisionButtonDisabled(page) {
  const disabled = await page.locator("[data-bid-approval-outcome-form]").first().getByRole("button", { name: "Record submission approval decision" }).isDisabled();
  if (!disabled) throw new Error("decision CTA should be disabled");
}

async function assertDecisionButtonEnabled(page) {
  const enabled = await page.locator("[data-bid-approval-outcome-form]").first().getByRole("button", { name: "Record submission approval decision" }).isEnabled();
  if (!enabled) throw new Error("decision CTA should be enabled");
}

async function expectNoDecisionForm(page) {
  const count = await page.locator("[data-bid-approval-outcome-form]").count();
  if (count !== 0) throw new Error(`decision outcome form should be absent, found ${count}`);
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
}

function waitForServerActionPost(page) {
  return page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && response.url().includes("/pipeline/") && Boolean(request.headers()["next-action"]);
  }, { timeout: 20_000 });
}

async function assertNoRawIdsOrFixtureKeys(page) {
  const text = await page.locator("body").innerText();
  if (/configuration_version_id|config_configuration_versions|cfg-runtime-03|foundation0a\.local|\b(?:ops|bd|pm|auditor|user|estimator|admin)-[a-z0-9]+\b|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    throw new Error("page exposed raw IDs or fixture identifiers");
  }
}

async function assertReadyEvidenceVisibleAndReconciled(page, fixture) {
  const readiness = await ops.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: fixture.id });
  if (readiness.error) throw new Error(`ready evidence reconciliation failed: ${readiness.error.message}`);
  const authorityResult = await service
    .from("opportunity_bid_evidence_satisfactions")
    .select("*")
    .eq("opportunity_id", fixture.id);
  if (authorityResult.error) throw new Error(`ready authority lookup failed: ${authorityResult.error.message}`);
  const authority = authorityResult.data ?? [];
  const objectResult = await service
    .from("evidence_objects")
    .select("id,original_filename,object_path")
    .in("id", authority.map((row) => row.evidence_object_id));
  if (objectResult.error) throw new Error(`ready persisted filename lookup failed: ${objectResult.error.message}`);
  const objectById = new Map((objectResult.data ?? []).map((row) => [row.id, row]));
  const requirements = readiness.data?.evidenceRequirements ?? [];
  if (authority.length !== 4 || requirements.length !== 4) {
    throw new Error(`ready evidence authority expected four requirements, saw authority=${authority.length}; requirements=${requirements.length}`);
  }
  for (const requirement of requirements) {
    const row = authority.find((entry) => entry.gate_requirement_id === requirement.requirementId);
    const object = row ? objectById.get(row.evidence_object_id) : null;
    if (!row || !object
      || row.configuration_version_id !== readiness.data.configurationVersionId
      || row.package_revision !== fixture.version
      || row.bid_package_version !== readiness.data.bidPackageVersion
      || row.evidence_type_id !== requirement.evidenceTypeId
      || object.original_filename !== requirement.evidence?.fileName) {
      throw new Error(`ready filename/requirement/revision reconciliation failed for ${requirement.relationshipType}`);
    }
  }

  const visibleRows = await page.locator("[data-configured-evidence-requirement]").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { text: element.textContent ?? "", top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  }).filter((row) => row.width > 0 && row.height > 0));
  if (visibleRows.length !== 4 || visibleRows.some((row) => row.top < 0 || row.bottom > 1000)) {
    throw new Error(`configured evidence is not entirely visible in the 1440x1000 decision viewport: ${JSON.stringify(visibleRows)}`);
  }
  for (const requirement of requirements) {
    if (!visibleRows.some((row) => row.text.includes(requirement.label) && row.text.includes("Satisfied") && row.text.includes(requirement.evidence.fileName))) {
      throw new Error(`ready viewport does not visibly associate ${requirement.label} with persisted filename ${requirement.evidence.fileName}`);
    }
  }
  const body = await page.locator("body").innerText();
  for (const object of objectResult.data ?? []) {
    if (body.includes(object.object_path)) throw new Error("ready viewport exposed a persisted storage path");
  }
}

async function assertNoApprovalOutcome(id) {
  const row = await getOpportunity(id);
  if (row.bid_submission_approval_configuration_version_id || row.bid_submission_approval_outcome_key) throw new Error("approval outcome should not be persisted yet");
  return "no approval outcome persisted before decision";
}

async function assertAnyBidEvidencePersisted(id) {
  const { count, error } = await service.from("evidence_links").select("id", { count: "exact", head: true }).eq("entity_type", "opportunity").eq("entity_id", id);
  if (error) throw new Error(error.message);
  if ((count ?? 0) < 1) throw new Error("expected bid evidence correction to persist");
  return "missing evidence correction persisted after reload";
}

async function countConfiguredBidEvidence(id) {
  const { count, error } = await service
    .from("evidence_links")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "opportunity")
    .eq("entity_id", id)
    .in("relationship_type", ["proposal_bid_package", "approved_estimate_version", "commercial_terms", "bid_instructions"]);
  if (error) throw new Error(`configured evidence count failed: ${error.message}`);
  return count ?? 0;
}

async function assertSubmissionApprover(id, profileId) {
  const row = await getOpportunity(id);
  if (row.submission_approver_user_id !== profileId) throw new Error(`submission approver did not persist: ${row.submission_approver_user_id}`);
  return "submission approver correction persisted in dedicated field";
}

async function assertApprovalOutcome(id, status, outcomeKey) {
  const row = await getOpportunity(id);
  if (row.bid_submission_status !== status || row.bid_submission_approval_gate_key !== "bid-submission-approval" || row.bid_submission_approval_outcome_key !== outcomeKey || !row.bid_submission_approval_configuration_version_id) {
    throw new Error(`unexpected approval persistence: ${JSON.stringify(row)}`);
  }
  if (row.bid_submitted_at || row.bid_submission_confirmation) throw new Error("actual bid submission was recorded");
  return `status=${status}; outcome=${outcomeKey}; no bid submission recorded`;
}

async function callApproval(client, id, version, outcome, reason, key) {
  return client.rpc("record_configured_bid_submission_approval_v1", {
    p_opportunity_id: id,
    p_outcome_key: outcome,
    p_reason: reason,
    p_command_id: commandId(`${runKey}-${key}`),
    p_expected_version: version,
    p_correlation_id: `${runKey}-${key}`,
  });
}

async function updateOpportunity(id, fields) {
  const { error } = await service.from("opportunities").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`opportunity update failed: ${error.message}`);
}

async function addContribution(opportunityId, userId) {
  const { error } = await service.from("opportunity_assignments").insert({
    workspace_id: ids.workspaceA,
    opportunity_id: opportunityId,
    user_id: userId,
    assignment_type: "estimator",
    status: "active",
    created_by: userId,
  });
  if (error) throw new Error(`contribution insert failed: ${error.message}`);
}

async function getOpportunity(id) {
  const { data, error } = await service.from("opportunities").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`opportunity lookup failed: ${error?.message ?? "missing"}`);
  return data;
}

async function profileIdFor(userId) {
  const { data, error } = await service.from("user_profiles").select("id").eq("user_id", userId).single();
  if (error || !data?.id) throw new Error(`profile lookup failed: ${error?.message ?? "missing"}`);
  return data.id;
}

async function resetFixturePasswords() {
  const listed = await service.auth.admin.listUsers();
  if (listed.error) throw new Error(`fixture user lookup failed: ${listed.error.message}`);
  for (const email of ["bd-a@foundation0a.local", "ops-a@foundation0a.local", "user-b@foundation0a.local"]) {
    const user = listed.data.users.find((entry) => entry.email === email);
    if (!user?.id) throw new Error(`missing fixture auth user ${email}`);
    const updated = await service.auth.admin.updateUserById(user.id, { password: fixturePassword, email_confirm: true });
    if (updated.error) throw new Error(`fixture password reset failed for ${email}: ${updated.error.message}`);
  }
}

async function cleanupFixtures() {
  if (m1Gate) return; // Owned phase recovery removes fixtures without disabling security triggers.

  const { data, error } = await service.from("opportunities").select("id").ilike("scope_summary", `${fixtureScope}%`);
  if (error) throw new Error(`cleanup lookup failed: ${error.message}`);
  const idsToDelete = (data ?? []).map((row) => row.id).filter(Boolean);
  if (idsToDelete.length === 0) return;
  if (idsToDelete.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error("browser cleanup received a non-UUID opportunity identifier");
  }
  const idList = idsToDelete.map((id) => `'${id}'::uuid`).join(",");
  const sql = `
begin;
set local session_replication_role = replica;
create temporary table cfg_runtime_03_browser_cleanup_qualification_ids on commit drop as
select id
from opportunity_qualifications
where opportunity_id in (${idList});
delete from opportunity_bid_evidence_satisfactions where opportunity_id in (${idList});
delete from audit_events where entity_id in (${idList});
delete from domain_events where aggregate_id in (${idList});
delete from opportunity_bid_submission_events where opportunity_id in (${idList});
delete from opportunity_pursuit_authorization_events where opportunity_id in (${idList});
delete from evidence_objects where id in (
  select evidence_object_id from evidence_links
  where (entity_type = 'opportunity' and entity_id in (${idList}))
     or (
       entity_type = 'opportunity_qualification'
       and entity_id in (select id from cfg_runtime_03_browser_cleanup_qualification_ids)
     )
);
delete from evidence_links
where (entity_type = 'opportunity' and entity_id in (${idList}))
   or (
     entity_type = 'opportunity_qualification'
     and entity_id in (select id from cfg_runtime_03_browser_cleanup_qualification_ids)
   );
delete from opportunity_assignments where opportunity_id in (${idList});
delete from opportunity_qualifications where opportunity_id in (${idList});
delete from opportunities where id in (${idList});
commit;
`;
  const cleanup = spawnSync("docker", ["exec", "-i", localDbContainer, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q"], {
    cwd: root,
    env: qaEnv,
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (cleanup.status !== 0) throw new Error(`browser fixture cleanup failed: ${cleanup.stderr || cleanup.stdout}`);
  const remaining = await service.from("opportunities").select("id", { count: "exact", head: true }).in("id", idsToDelete);
  if (remaining.error || (remaining.count ?? 0) !== 0) throw new Error(`browser cleanup left ${remaining.count ?? "unknown"} fixture opportunities`);
}

function qualificationPayload() {
  return {
    strategicFit: "strong",
    customerRelationship: "acceptable",
    geographyFit: "strong",
    projectTypeFit: "strong",
    scopeClarity: "acceptable",
    designMaturity: "acceptable",
    commercialTermsRisk: "acceptable",
    scheduleFeasibility: "acceptable",
    crewCapacityFit: "acceptable",
    materialLeadTimeRisk: "acceptable",
    permitsAccessRisk: "acceptable",
    safetyQualityComplexity: "acceptable",
    subcontractorDependency: "acceptable",
    cashFlowRisk: "acceptable",
    marginConfidence: "acceptable",
    contractualRisk: "acceptable",
    riskSummary: "CFG-RUNTIME-03 browser proof package.",
    assumptions: "All bid package inputs are current.",
    recommendation: "pursue",
  };
}

function qualificationDbPayload() {
  const q = qualificationPayload();
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

function evidencePayload(name) {
  return {
    fileName: name,
    mimeType: name.endsWith(".pdf") ? "application/pdf" : "text/plain",
    sizeBytes: 42,
    checksumSha256: createHash("sha256").update(name).digest("hex"),
  };
}

function readEvidenceNamespace(args) {
  const inline = args.find((arg) => arg.startsWith("--evidence-namespace="));
  if (inline) return inline.slice("--evidence-namespace=".length);
  const index = args.indexOf("--evidence-namespace");
  return index >= 0 ? args[index + 1] : "";
}

function gitText(args) {
  const result = spawnSync("git", args, { cwd: root, env: qaEnv, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function repositoryHead() {
  try { return gitText(["rev-parse", "HEAD"]); }
  catch {
    const head = readFileSync(join(root, ".git", "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/i.test(head)) return head;
    const reference = head.match(/^ref:\s+(.+)$/)?.[1];
    const resolved = reference ? readFileSync(join(root, ".git", ...reference.split("/")), "utf8").trim() : "";
    if (!/^[0-9a-f]{40}$/i.test(resolved)) throw new Error("source HEAD could not be established from relocated candidate");
    return resolved;
  }
}

function scenarioIdentifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function scenarioOutcome(value) {
  if (/held/i.test(value)) return "hold-submission-approval";
  if (/approved/i.test(value)) return "approve-for-submission";
  return "not-recorded";
}

async function setFixtureDisplayName(profileId, displayName) {
  const current = await service.from("user_profiles").select("display_name").eq("id", profileId).single();
  if (current.error || !current.data) throw new Error(`profile display lookup failed: ${current.error?.message ?? "missing"}`);
  const updated = await service.from("user_profiles").update({ display_name: displayName }).eq("id", profileId);
  if (updated.error) throw new Error(`profile display update failed: ${updated.error.message}`);
  return String(current.data.display_name ?? "");
}

async function restoreFixtureDisplayName(profileId, displayName) {
  const restored = await service.from("user_profiles").update({ display_name: displayName }).eq("id", profileId);
  if (restored.error) throw new Error(`profile display restore failed: ${restored.error.message}`);
}

function assertRpc(result, label) {
  if (result.error || result.data?.success !== true) throw new Error(`${label} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
}

function bootstrap() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], { cwd: root, env: qaEnv, encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });
  if (result.status !== 0) throw new Error(`bootstrap failed: ${result.stderr || result.stdout}`);
}

function loadRuntime03Pack() {
  if (m1Gate) return m1Gate.runLoader("scripts/load-cfg-runtime-03-pack-local.mjs", qaEnv);
  const result = spawnSync(process.execPath, ["scripts/load-cfg-runtime-03-pack-local.mjs"], { cwd: root, env: qaEnv, encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });
  if (result.status !== 0) throw new Error(`CFG-RUNTIME-03 pack load failed: ${result.stderr || result.stdout}`);
}

function qualificationResidue() {
  const result = spawnSync("docker", ["exec", localDbContainer, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", `
select json_build_object(
  'opportunities', (select count(*) from opportunities),
  'qualifications', (select count(*) from opportunity_qualifications),
  'evidenceObjects', (select count(*) from evidence_objects),
  'evidenceLinks', (select count(*) from evidence_links),
  'authorityRows', (select count(*) from opportunity_bid_evidence_satisfactions)
)::text;
`], { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 20 });
  if (result.status !== 0) throw new Error(`qualification residue inspection failed: ${result.stderr || result.stdout}`);
  const counts = JSON.parse(result.stdout.trim());
  return { ...counts, zero: Object.values(counts).every((value) => Number(value) === 0) };
}

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  return spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || root,
    input: options.input,
    encoding: options.encoding ?? "utf8",
    shell: false,
    env: options.env || createSanitizedChildEnv(),
    maxBuffer: 1024 * 1024 * 100,
  });
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  return { command, args };
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
  return { previous, current };
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
