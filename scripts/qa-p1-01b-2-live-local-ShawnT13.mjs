import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, relative } from "node:path";
import { chromium } from "playwright";
import { commandId, createClients, ids, redact, signIn, userIdFor } from "./foundation-0b-test-utils.mjs";

const root = process.cwd();
const artifactDir = join(root, "artifacts/p1-01b-2-implementation-acceptance-review/live-browser-qa");
const screenshotDir = join(artifactDir, "screenshots");
const manifestPath = join(artifactDir, "live-browser-qa-manifest.json");
const resultPath = join(artifactDir, "live-browser-qa-results.json");

await mkdir(screenshotDir, { recursive: true });

const env = ensureLocalSupabaseEnv();
bootstrapFoundation(env);
const { service } = createClients();
await assertBidSubmissionMigrationApplied(service);
await cleanupAcceptanceRows(service);

const bd = await signIn("bd-a@foundation0a.local");
const ops = await signIn("ops-a@foundation0a.local");
const admin = await signIn("admin-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = await startAppServer(port, env);
const scenarios = [];

try {
  const browser = await chromium.launch({ headless: true });
  try {
    const opsContext = await signInBrowser(browser, baseUrl, "ops-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);

    await recordScenario("A", "Authorized pursuit enters Bid Submission / Pursuit Outcome", "Assigned commercial owner", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance A Entry");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await page.waitForSelector("[data-pipeline-screen='bid-submission-outcome']", { timeout: 30_000 });
      await expectText(page, "Bid Submission / Pursuit Outcome");
      await expectText(page, "Pursuit authorized upstream");
      const path = await screenshot(page, "A-authorized-entry-desktop.png");
      await page.close();
      return passResult(fixture, "Authorized pursuit opened to the bid-submission gate.", path);
    });

    await recordScenario("B", "Submission preparation", "Assigned commercial owner", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance B Prep");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await expectText(page, "Build the bid package before approval");
      const path = await screenshot(page, "B-submission-preparation-desktop.png");
      await page.close();
      const row = await getOpportunityRow(fixture.opportunity.id);
      return resultFor(row.bid_submission_status === "not_started", fixture, `Preparation status is ${row.bid_submission_status}.`, path);
    });

    await recordScenario("C", "Mark package ready", "Assigned commercial owner", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance C Ready");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Mark package ready");
      await expectText(page, "Ready for submission approval");
      const path = await screenshot(page, "C-mark-package-ready-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "ready_for_submission_approval", "mark_package_ready", path);
    });

    await recordScenario("D", "Hold submission approval", "Submission approver", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance D Hold");
      await recordBid(fixture, "mark_package_ready");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Hold submission approval", "Commercial review required before sending.");
      await expectText(page, "Submission approval held");
      const path = await screenshot(page, "D-hold-submission-approval-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "submission_approval_held", "hold_submission_approval", path);
    });

    await recordScenario("E", "Approve submission", "Submission approver", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance E Approve");
      await recordBid(fixture, "mark_package_ready");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Approve submission");
      await expectText(page, "Submission approved / ready to send");
      const path = await screenshot(page, "E-approve-submission-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "submission_approved_ready_to_send", "approve_submission", path);
    });

    await recordScenario("F", "Record submission", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareApprovedToSend("P1B2 Acceptance F Record");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record submission", "Approved package submitted to the customer portal.");
      await expectText(page, "Submitted / pending outcome");
      const path = await screenshot(page, "F-record-submission-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "submitted_pending_outcome", "record_submission", path);
    });

    await recordScenario("G", "Clarification requested", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance G Clarification");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record clarification request", "Customer requested fiber route clarification.");
      await expectText(page, "Clarification requested");
      const path = await screenshot(page, "G-clarification-requested-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "clarification_requested", "record_clarification_request", path);
    });

    await recordScenario("H", "Revision / BAFO requested", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance H BAFO");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record revision / BAFO request", "Customer requested revised pricing.");
      await expectText(page, "Revision requested / BAFO required");
      const path = await screenshot(page, "H-revision-bafo-requested-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "revision_bafo_required", "record_revision_bafo_request", path);
    });

    await recordScenario("I", "Revised submission / BAFO submitted", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance I Revised");
      await recordBid(fixture, "record_revision_bafo_request", "BAFO requested by customer.");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record revised submission", "Revised package submitted with receipt.");
      await expectText(page, "Revised submission recorded / BAFO submitted");
      const path = await screenshot(page, "I-revised-submission-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "revised_submission_recorded", "record_revised_submission", path);
    });

    await recordScenario("J", "Lost / not selected", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance J Lost");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record lost / not selected", "Customer selected another bidder.");
      await expectText(page, "Lost / not selected");
      await expectText(page, "Lost is terminal");
      const path = await screenshot(page, "J-lost-not-selected-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "lost_not_selected", "record_lost_not_selected", path);
    });

    await recordScenario("K", "Withdrawn / no-submit", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance K Withdrawn");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record withdrawn / no-submit", "Rybex withdrew due to unresolved terms risk.");
      await expectText(page, "Withdrawn / no-submit");
      await expectText(page, "Withdrawn is terminal");
      const path = await screenshot(page, "K-withdrawn-no-submit-desktop.png");
      await page.close();
      return await verifyBidState(fixture.opportunity.id, "withdrawn_no_submit", "record_withdrawn_no_submit", path);
    });

    await recordScenario("L", "Selected / intent-to-award handoff", "Authorized recorder", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance L Selected");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await submitBidAction(page, "Record selected handoff", "Customer issued intent-to-award notice.");
      await expectText(page, "Award validation has not started");
      const path = await screenshot(page, "L-selected-handoff-desktop.png");
      await page.close();
      const state = await verifyBidState(fixture.opportunity.id, "selected_intent_to_award", "record_selected_handoff", path);
      const events = await bidEvents(fixture.opportunity.id);
      const selected = events.find((event) => event.bidAction === "record_selected_handoff");
      const handoffOnly = selected?.metadata?.handoffOnly === true && selected?.metadata?.awardValidationStarted === false;
      return { ...state, status: state.status === "Pass" && handoffOnly ? "Pass" : "Fail", notes: `${state.notes} Handoff-only metadata: ${handoffOnly}.` };
    });

    await recordScenario("P", "Stale / conflict", "Assigned commercial owner", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance P Stale");
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await service.from("opportunities").update({ version: fixture.opportunity.version + 1 }).eq("id", fixture.opportunity.id);
      await submitBidAction(page, "Mark package ready");
      await expectText(page, "This package changed before your action was recorded");
      const path = await screenshot(page, "P-stale-conflict-desktop.png");
      await page.close();
      const row = await getOpportunityRow(fixture.opportunity.id);
      return resultFor(row.bid_submission_status === "not_started", fixture, `Stale conflict preserved status ${row.bid_submission_status}.`, path);
    });

    await recordScenario("Q", "Action failure / recovery", "Assigned commercial owner", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance Q Failure");
      const rpc = await ops.rpc("record_opportunity_bid_submission_action_v1", {
        p_opportunity_id: fixture.opportunity.id,
        p_bid_action: "record_submission",
        p_reason: "Invalid early submission attempt.",
        p_recipient: "Northstar GC",
        p_channel: "Customer portal",
        p_confirmation: "NS-INVALID",
        p_command_id: commandId("p1b2-invalid-state"),
        p_expected_version: fixture.opportunity.version,
        p_correlation_id: "p1b2-invalid-state"
      });
      const page = await newScenarioPage(opsContext, { width: 1440, height: 1024 });
      await page.goto(`${opportunityUrl(fixture)}?bidState=action-failure&error=invalid_state`, { waitUntil: "networkidle" });
      await expectText(page, "Action failed");
      const path = await screenshot(page, "Q-action-failure-desktop.png");
      await page.close();
      const row = await getOpportunityRow(fixture.opportunity.id);
      const blocked = rpc.data?.success === false && rpc.data?.error === "invalid_state" && row.bid_submission_status === "not_started";
      return resultFor(blocked, fixture, `Invalid RPC result ${rpc.data?.error}; status ${row.bid_submission_status}.`, path);
    });

    await recordScenario("R", "Mobile smoke", "Assigned commercial owner", "mobile", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance R Mobile");
      const page = await newScenarioPage(opsContext, { width: 390, height: 844 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await page.waitForSelector("[data-pipeline-screen='bid-submission-outcome']", { timeout: 30_000 });
      const layout = await page.evaluate(() => {
        const bodyOverflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
        const targets = Array.from(document.querySelectorAll("h1, .button, .pursuit-role-pill, .pursuit-badges span, .pursuit-recommendation strong, .pursuit-next-state strong"));
        const clipped = targets.filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => (el.textContent || "").trim().slice(0, 80));
        return { bodyOverflowX, clipped };
      });
      const path = await screenshot(page, "R-mobile-smoke.png");
      await page.close();
      return resultFor(!layout.bodyOverflowX && layout.clipped.length === 0, fixture, `Mobile layout check ${JSON.stringify(layout)}.`, path);
    });

    await opsContext.close();

    const auditorContext = await signInBrowser(browser, baseUrl, "auditor-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("M", "Auditor/read-only", "Read-only auditor", "desktop", async () => {
      const fixture = await prepareSubmitted("P1B2 Acceptance M Auditor");
      const page = await newScenarioPage(auditorContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await expectText(page, "Read-only");
      const mutationButton = await page.getByRole("button", { name: "Record lost / not selected" }).isVisible().catch(() => false);
      const path = await screenshot(page, "M-auditor-read-only-desktop.png");
      await page.close();
      return resultFor(!mutationButton, fixture, `Auditor mutation button visible: ${mutationButton}.`, path);
    });
    await auditorContext.close();

    const adminContext = await signInBrowser(browser, baseUrl, "admin-a@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("N", "Unavailable / ineligible", "Admin not record-scoped", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance N Unavailable");
      const page = await newScenarioPage(adminContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await expectText(page, "not assigned");
      const rpc = await admin.rpc("record_opportunity_bid_submission_action_v1", {
        p_opportunity_id: fixture.opportunity.id,
        p_bid_action: "mark_package_ready",
        p_reason: "",
        p_recipient: "",
        p_channel: "",
        p_confirmation: "",
        p_command_id: commandId("p1b2-admin-denied"),
        p_expected_version: fixture.opportunity.version,
        p_correlation_id: "p1b2-admin-denied"
      });
      const path = await screenshot(page, "N-unavailable-ineligible-desktop.png");
      await page.close();
      const blocked = rpc.data?.success === false && rpc.data?.error === "bid_submission_authority_required";
      return resultFor(blocked, fixture, `Admin RPC result ${rpc.data?.error ?? rpc.error?.message}.`, path);
    });
    await adminContext.close();

    const userBContext = await signInBrowser(browser, baseUrl, "user-b@foundation0a.local", env.FOUNDATION_0A_TEST_PASSWORD);
    await recordScenario("O", "Cross-workspace isolation", "Different workspace user", "desktop", async () => {
      const fixture = await createPursuitApprovedOpportunity("P1B2 Acceptance O Isolation");
      const page = await newScenarioPage(userBContext, { width: 1440, height: 1024 });
      await page.goto(opportunityUrl(fixture), { waitUntil: "networkidle" });
      await expectText(page, "You do not have access to this opportunity");
      const rpc = await userB.rpc("record_opportunity_bid_submission_action_v1", {
        p_opportunity_id: fixture.opportunity.id,
        p_bid_action: "mark_package_ready",
        p_reason: "",
        p_recipient: "",
        p_channel: "",
        p_confirmation: "",
        p_command_id: commandId("p1b2-cross-workspace-denied"),
        p_expected_version: fixture.opportunity.version,
        p_correlation_id: "p1b2-cross-workspace-denied"
      });
      const path = await screenshot(page, "O-cross-workspace-isolation-desktop.png");
      await page.close();
      return resultFor(rpc.data?.success === false, fixture, `Cross-workspace RPC result ${rpc.data?.error ?? rpc.error?.message}.`, path);
    });
    await userBContext.close();
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
  productionOrStagingMutationAttempted: false,
  remoteSupabaseUsed: false,
  selectedIntentToAwardHandoffOnly: scenarios.find((scenario) => scenario.scenarioId === "L")?.status === "Pass",
  lostWithdrawnTerminal: scenarios.filter((scenario) => ["J", "K"].includes(scenario.scenarioId)).every((scenario) => scenario.status === "Pass"),
  result: scenarios.every((scenario) => scenario.status === "Pass") ? "PASS" : "FAIL",
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
    scenarios.push({
      scenarioId,
      name,
      userRoleContext: roleContext,
      localUrl: baseUrl,
      viewport,
      actionAttempted: name,
      expectedResult: expectedResultFor(scenarioId),
      actualResult: redact(error instanceof Error ? error.message : String(error)),
      persistenceVerificationMethod: "Not completed",
      auditHistoryVerificationMethod: "Not completed",
      screenshotPath: null,
      status: "Fail",
      notes: "Scenario failed during live local P1-01B.2 QA."
    });
  }
}

function expectedResultFor(id) {
  return {
    A: "Pursuit-approved opportunity opens to P1-01B.2 gate.",
    B: "Submission preparation is understandable and non-mutated.",
    C: "Mark package ready persists and creates history.",
    D: "Hold submission approval persists and creates history.",
    E: "Approve submission persists and creates history.",
    F: "Record submission requires receipt and persists submitted state.",
    G: "Clarification request persists after submitted state.",
    H: "Revision / BAFO request persists after submitted state.",
    I: "Revised submission persists with version lineage.",
    J: "Lost / not selected persists as terminal.",
    K: "Withdrawn / no-submit persists as terminal.",
    L: "Selected / intent-to-award persists as handoff-only, not award validation.",
    M: "Auditor can inspect but cannot mutate.",
    N: "Ineligible admin cannot mutate.",
    O: "Cross-workspace user cannot access or mutate.",
    P: "Stale/conflict prevents silent overwrite.",
    Q: "Invalid action fails without mutation and shows recovery.",
    R: "Mobile surface has no critical clipping or horizontal overflow."
  }[id] ?? "Scenario passes.";
}

async function createPursuitApprovedOpportunity(name) {
  const created = await createOpportunity(name);
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: created.opportunity.id,
    p_payload: qualificationPayload(),
    p_command_id: commandId(`${name}-qualification`),
    p_expected_version: created.opportunity.version,
    p_correlation_id: `${name}-qualification`
  });
  assertRpc(qualified, "qualification");
  const accountable = await setDecisionAccountability(qualified.data);
  const evidenced = await attachDecisionEvidence(accountable);
  const decision = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: evidenced.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId(`${name}-decision`),
    p_expected_version: evidenced.opportunity.version,
    p_correlation_id: `${name}-decision`
  });
  assertRpc(decision, "decision");
  const pursuit = await ops.rpc("record_opportunity_pursuit_authorization_v1", {
    p_opportunity_id: decision.data.opportunity.id,
    p_pursuit_action: "approve_pursuit",
    p_reason: "Authorized for local P1-01B.2 QA.",
    p_command_id: commandId(`${name}-pursuit`),
    p_expected_version: decision.data.opportunity.version,
    p_correlation_id: `${name}-pursuit`
  });
  assertRpc(pursuit, "pursuit authorization");
  return pursuit.data;
}

async function createOpportunity(name) {
  const result = await bd.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: "P1B2 Local GC",
      projectType: "Data center backbone",
      location: `${name} Charlotte NC`,
      scopeSummary: `Local-only P1-01B.2 fixture for ${name}.`,
      estimatedValue: "4960000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-10",
      duplicateConfirmed: true
    },
    p_command_id: commandId(`${name}-create`),
    p_correlation_id: `${name}-create`
  });
  assertRpc(result, "create opportunity");
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
  assertRpc(result, "decision accountability");
  return result.data;
}

async function attachDecisionEvidence(detail) {
  const result = await bd.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: detail.opportunity.id,
    p_payload: {
      fileName: "p1b2-local-decision-evidence.txt",
      mimeType: "text/plain",
      sizeBytes: 128,
      checksumSha256: `p1b2-local-${detail.opportunity.id}`
    },
    p_command_id: commandId(`${detail.opportunity.name}-evidence`),
    p_expected_version: detail.opportunity.version,
    p_correlation_id: `${detail.opportunity.name}-evidence`
  });
  assertRpc(result, "decision evidence");
  const submit = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: result.data.opportunity.id,
    p_command_id: commandId(`${detail.opportunity.name}-submit`),
    p_expected_version: result.data.opportunity.version,
    p_correlation_id: `${detail.opportunity.name}-submit`
  });
  assertRpc(submit, "submit for decision");
  return submit.data;
}

async function prepareApprovedToSend(name) {
  const fixture = await createPursuitApprovedOpportunity(name);
  await recordBid(fixture, "mark_package_ready");
  await recordBid(fixture, "approve_submission");
  return await currentDetail(fixture.opportunity.id);
}

async function prepareSubmitted(name) {
  const fixture = await prepareApprovedToSend(name);
  await recordBid(fixture, "record_submission", "Approved package submitted to customer.", "NS-44991");
  return await currentDetail(fixture.opportunity.id);
}

async function recordBid(detail, action, reason = "", confirmation = "") {
  const current = await currentDetail(detail.opportunity.id);
  const result = await ops.rpc("record_opportunity_bid_submission_action_v1", {
    p_opportunity_id: current.opportunity.id,
    p_bid_action: action,
    p_reason: reason || defaultReason(action),
    p_recipient: "Northstar GC",
    p_channel: "Customer portal",
    p_confirmation: confirmation || defaultConfirmation(action),
    p_command_id: commandId(`p1b2-${action}`),
    p_expected_version: current.opportunity.version,
    p_correlation_id: `p1b2-${action}`
  });
  assertRpc(result, `bid action ${action}`);
  return result.data;
}

async function currentDetail(id) {
  const result = await ops.rpc("p1_01a_get_opportunity_v1", { p_opportunity_id: id });
  assertRpc(result, "current detail");
  return result.data;
}

function defaultReason(action) {
  return {
    mark_package_ready: "All package evidence is complete.",
    request_missing_evidence: "Missing package evidence blocks approval.",
    approve_submission: "Final package is approved for submission.",
    hold_submission_approval: "Commercial review is required before sending.",
    record_submission: "Approved package was submitted to customer.",
    record_clarification_request: "Customer requested clarification.",
    record_revision_bafo_request: "Customer requested revised pricing.",
    record_revised_submission: "Revised package submitted.",
    record_lost_not_selected: "Customer selected another bidder.",
    record_withdrawn_no_submit: "Rybex withdrew due to unresolved terms.",
    record_selected_handoff: "Customer issued intent-to-award notice."
  }[action] ?? "Local P1-01B.2 QA action.";
}

function defaultConfirmation(action) {
  return {
    record_submission: "NS-44991",
    record_revised_submission: "NS-44992",
    record_selected_handoff: "Intent-to-award notice"
  }[action] ?? "Local QA confirmation";
}

async function submitBidAction(page, label, reason) {
  const disclosure = page.locator("details").filter({ hasText: label }).first();
  await disclosure.locator("summary").click();
  if (reason) await disclosure.locator("textarea[name='bidReason']").fill(reason);
  await disclosure.getByRole("button", { name: label }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(750);
}

async function verifyBidState(id, expectedStatus, action, screenshotPath) {
  const row = await getOpportunityRow(id);
  const events = await bidEvents(id);
  const eventCount = events.filter((event) => event.bidAction === action).length;
  return {
    actualResult: `Status persisted as ${row.bid_submission_status}; ${action} events: ${eventCount}.`,
    persistenceVerificationMethod: "Queried local opportunities.bid_submission_status after browser/RPC action.",
    auditHistoryVerificationMethod: "Queried p1_01a_get_opportunity_v1 bidSubmissionEvents.",
    screenshotPath,
    status: row.bid_submission_status === expectedStatus && eventCount >= 1 ? "Pass" : "Fail",
    notes: `Expected ${expectedStatus}.`
  };
}

async function getOpportunityRow(id) {
  const { data, error } = await service
    .from("opportunities")
    .select("id,bid_submission_status,version")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? `Missing opportunity ${id}`);
  return data;
}

async function bidEvents(id) {
  const detail = await currentDetail(id);
  return Array.isArray(detail.bidSubmissionEvents) ? detail.bidSubmissionEvents : [];
}

function qualificationPayload() {
  return {
    strategicFit: "strong",
    customerRelationship: "strong",
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
    marginConfidence: "strong",
    contractualRisk: "acceptable",
    riskSummary: "Local-only P1-01B.2 QA fixture.",
    assumptions: "Route survey and commercial basis are tied to the decision package.",
    recommendation: "pursue"
  };
}

function passResult(fixture, actualResult, screenshotPath) {
  return resultFor(true, fixture, actualResult, screenshotPath);
}

function resultFor(ok, fixture, actualResult, screenshotPath) {
  return {
    actualResult,
    persistenceVerificationMethod: `Local Supabase opportunity ${fixture.opportunity.id}.`,
    auditHistoryVerificationMethod: "Local bid submission event/read-model history where applicable.",
    screenshotPath,
    status: ok ? "Pass" : "Fail",
    notes: "Local-only Supabase QA; remote .env.local Supabase was not used."
  };
}

function assertRpc(result, label) {
  if (result.error || result.data?.success !== true) {
    throw new Error(`${label} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
  }
}

async function signInBrowser(browser, url, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${url}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.waitForTimeout(800);
  const proof = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session-proof", { headers: { accept: "application/json" } });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  });
  if (proof.status !== 200 || proof.body?.success !== true) {
    throw new Error(`Browser sign-in failed for ${email}; status ${proof.status}; body ${redact(JSON.stringify(proof.body))}`);
  }
  await page.close();
  return context;
}

async function newScenarioPage(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  return page;
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
}

async function screenshot(page, fileName) {
  await page.addStyleTag({ content: `nextjs-portal,[data-nextjs-toast],[data-nextjs-dialog-overlay],[data-nextjs-dev-tools-button],[aria-label*="Next.js"],[aria-label*="next.js"]{display:none!important;visibility:hidden!important}` }).catch(() => {});
  const path = join(screenshotDir, fileName);
  await page.screenshot({ path, fullPage: true });
  return relative(root, path).replace(/\\/g, "/");
}

function opportunityUrl(detail) {
  return `${baseUrl}/pipeline/${detail.opportunity.id}`;
}

function ensureLocalSupabaseEnv() {
  process.env.RYBEXOS_RUNTIME_MODE = "test";
  process.env.RYBEXOS_AUTH_MODE = "supabase";
  process.env.RYBEXOS_DATA_SOURCE = "database";
  process.env.FOUNDATION_0A_TEST_PASSWORD ||= `P1B2-LIVE-${Date.now()}-${randomUUID()}!`;

  const status = spawnSync("npx.cmd", ["supabase", "status", "-o", "env"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 20
  });
  if (status.status !== 0) throw new Error(`Local Supabase status failed: ${redact(status.stderr || status.stdout || "no output")}`);
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
  if (result.status !== 0) throw new Error(`Foundation bootstrap failed: ${redact(result.stderr || result.stdout || "no output")}`);
}

async function assertBidSubmissionMigrationApplied(client) {
  const { error } = await client.from("opportunities").select("bid_submission_status").limit(1);
  if (error && !/Results contain 0 rows|JSON object requested/.test(error.message)) {
    throw new Error(`Bid-submission migration column check failed: ${error.message}`);
  }
}

async function cleanupAcceptanceRows(client) {
  const { data, error } = await client
    .from("opportunities")
    .select("id")
    .eq("workspace_id", ids.workspaceA)
    .like("name", "P1B2 Acceptance%");
  if (error) throw new Error(`Acceptance cleanup lookup failed: ${error.message}`);
  const opportunityIds = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (opportunityIds.length === 0) return;
  await client.from("opportunities").delete().in("id", opportunityIds);
}

async function startAppServer(port, env) {
  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, ...env, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  await waitForServer(`http://127.0.0.1:${port}`, 90_000, () => logs);
  return child;
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
