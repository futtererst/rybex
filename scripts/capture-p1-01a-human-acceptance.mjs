import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { commandId, ids, userIdFor } from "./foundation-0b-test-utils.mjs";
import { requireQualificationChildEnv } from "./qualification-child-env.mjs";

const root = process.cwd();
const authorityRoot = resolve(root, "docs/product-experience/p1-01a/visual-reference-set-v1.0");
const manifestCsvPath = join(authorityRoot, "MANIFEST.csv");
const artifactRoot = resolve(root, "artifacts/p1-01a-human-acceptance-remediation");
const screenshotRoot = join(artifactRoot, "screenshots");
const comparisonRoot = join(artifactRoot, "comparisons");
const testResultsRoot = join(artifactRoot, "test-results");
const sessionStartedAt = new Date().toISOString();
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `P1-Human-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const localEnv = ensureLocalSupabaseEnv();
const manifestRows = parseCsv(readFileSync(manifestCsvPath, "utf8"));
const captureRows = [];
const pageErrors = [];
const consoleErrors = [];

rmSync(artifactRoot, { recursive: true, force: true });
for (const vr of ["VR-01", "VR-02", "VR-03", "VR-04", "VR-05", "VR-06", "VR-07", "VR-08", "VR-09"]) {
  mkdirSync(join(screenshotRoot, vr), { recursive: true });
  mkdirSync(join(comparisonRoot, vr), { recursive: true });
}
mkdirSync(testResultsRoot, { recursive: true });

const qaEnv = {
  ...process.env,
  ...localEnv,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
  FOUNDATION_0A_TEST_PASSWORD: fixturePassword
};

const sourceFingerprint = fingerprint([
  "app/pipeline/page.tsx",
  "app/pipeline/new/page.tsx",
  "app/pipeline/[opportunityId]/page.tsx",
  "app/actions/opportunities.ts",
  "lib/d5o/opportunities/types.ts",
  "lib/d5o/opportunities/supabase-repository.ts",
  "supabase/migrations/0011_p1_01a_opportunity_intake_qualification.sql",
  "supabase/migrations/0012_p1_01a_acceptance_remediation.sql",
  "supabase/migrations/0013_p1_01a_role_accountability_read_model.sql",
  "supabase/migrations/0014_p1_01a_decision_owner_actions.sql"
]);
const authorityFingerprint = fingerprint([
  "docs/product-experience/p1-01a/RybexOS_P1-01A_Role_and_Accountability_Authority_v1.1.md",
  "docs/product-experience/RybexOS_Product_Experience_North_Star_v1.0.md",
  "docs/product-experience/p1-01a/visual-reference-set-v1.0/README.md"
]);
const manifestFingerprint = sha256(readFileSync(manifestCsvPath));
const gitCommit = runText("git", ["rev-parse", "--short", "HEAD"]);
const dirtyWorktree = runText("git", ["status", "--short"]);

writeFileSync(join(artifactRoot, "capture-session.json"), `${JSON.stringify({
  sessionStartedAt,
  command: "npm.cmd run p1-01a:capture-acceptance",
  gitCommit: gitCommit || "unavailable",
  dirtyWorktreeLines: dirtyWorktree ? dirtyWorktree.split(/\r?\n/).filter(Boolean).length : 0,
  sourceFingerprint,
  authorityFingerprint,
  manifestFingerprint,
  runtimeMode: "test",
  databaseMode: "Supabase local/test",
  secretsRecorded: false
}, null, 2)}\n`);

const { service, bd, ops, pm, auditor } = await bootstrapAndClients();
await cleanupFixtures(service);

execFileSync(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  env: qaEnv,
  stdio: "inherit"
});

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], {
  cwd: root,
  env: qaEnv,
  stdio: ["ignore", "pipe", "pipe"]
});

let browser;
try {
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });

  const contexts = {
    "Business Development Lead": await signedInContext(browser, baseUrl, "bd-a@foundation0a.local"),
    "Decision Owner": await signedInContext(browser, baseUrl, "ops-a@foundation0a.local"),
    Estimator: await signedInContext(browser, baseUrl, "pm-a@foundation0a.local"),
    Auditor: await signedInContext(browser, baseUrl, "auditor-a@foundation0a.local")
  };

  await captureManifestSubset(contexts, "empty");

  const fixtures = await createFixtures({ service, bd, ops, pm, auditor });
  await captureManifestSubset(contexts, "main", fixtures);

  for (const context of Object.values(contexts)) await context.close();
} finally {
  if (browser) await browser.close();
  server.kill();
}

writeFileSync(join(artifactRoot, "capture-manifest.json"), `${JSON.stringify({
  sessionStartedAt,
  requiredFrames: manifestRows.length,
  capturedFrames: captureRows.length,
  sourceFingerprint,
  authorityFingerprint,
  manifestFingerprint,
  entries: captureRows
}, null, 2)}\n`);
writeFileSync(join(artifactRoot, "capture-manifest.csv"), toCsv(captureRows));
writeFileSync(join(testResultsRoot, "capture-result.json"), `${JSON.stringify({
  status: captureRows.length === manifestRows.length ? "pass" : "fail",
  requiredFrames: manifestRows.length,
  capturedFrames: captureRows.length,
  pageErrors,
  consoleErrors
}, null, 2)}\n`);
writeFileSync(join(artifactRoot, "index.html"), renderIndex(captureRows));

if (captureRows.length !== manifestRows.length) {
  throw new Error(`Expected ${manifestRows.length} screenshots, captured ${captureRows.length}.`);
}
if (pageErrors.length || consoleErrors.length) {
  throw new Error("Capture recorded page or console errors.");
}

console.log(`P1-01A human acceptance capture completed: ${captureRows.length} frames.`);

async function captureManifestSubset(contexts, phase, fixtures = {}) {
  for (const row of manifestRows) {
    const fileName = basename(row.clean_frame);
    const vr = row.visual_reference;
    const target = resolveRoute(row, fixtures);
    if (phase === "empty" && !target.captureBeforeFixtures) continue;
    if (phase === "main" && target.captureBeforeFixtures) continue;
    const viewport = parseViewport(row.viewport);
    const context = contexts[row.role] ?? contexts["Business Development Lead"];
    const page = await context.newPage();
    const localConsole = [];
    const localErrors = [];
    page.on("pageerror", (error) => localErrors.push(redact(error.message)));
    page.on("console", (message) => {
      if (["error"].includes(message.type())) localConsole.push(redact(message.text()));
    });
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}${target.route}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts ? document.fonts.ready.then(() => true) : true);
    await page.waitForTimeout(250);
    await assertFrame(page, row, target, fileName);
    const screenshotPath = join(screenshotRoot, vr, fileName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const size = pngSize(screenshotPath);
    const screenshotHash = sha256(readFileSync(screenshotPath));
    const textSnapshot = redact((await page.locator("body").innerText()).slice(0, 2200));
    const comparisonPath = join(comparisonRoot, vr, fileName.replace(/\.png$/i, ".html"));
    writeFileSync(comparisonPath, renderComparison(row, screenshotPath, target));
    const entry = {
      visualReference: vr,
      screenSpec: row.screen_spec,
      state: row.state,
      role: row.role,
      opportunityResponsibility: target.responsibility,
      route: target.route,
      viewport: row.viewport,
      screenshotPath: relative(root, screenshotPath).replaceAll("\\", "/"),
      comparisonPath: relative(root, comparisonPath).replaceAll("\\", "/"),
      captureTimestamp: new Date().toISOString(),
      pngWidth: size.width,
      pngHeight: size.height,
      fileSize: statSync(screenshotPath).size,
      sha256: screenshotHash,
      sourceFingerprint,
      authorityFingerprint,
      manifestFingerprint,
      stateSetupId: target.setupId,
      expectedPersistedState: target.persistedState,
      expectedNextAction: target.nextAction,
      deniedActions: target.deniedActions,
      result: "pass",
      approvedReferenceDeviation: target.deviation,
      consoleErrors: localConsole,
      pageErrors: localErrors,
      textSnapshot
    };
    captureRows.push(entry);
    pageErrors.push(...localErrors);
    consoleErrors.push(...localConsole);
    await page.close();
  }
}

function resolveRoute(row, fixtures) {
  const ref = row.visual_reference;
  const state = row.state;
  const base = {
    responsibility: row.role,
    persistedState: state,
    nextAction: "Review current work",
    deniedActions: [],
    deviation: "None recorded during automated capture.",
    captureBeforeFixtures: false
  };
  if (ref === "VR-01" && state === "Empty") return { ...base, route: "/pipeline", setupId: "queue-empty", captureBeforeFixtures: true, nextAction: "Create opportunity intake" };
  if (ref === "VR-01" && state === "Loading") return { ...base, route: "/pipeline?state=loading-preview", setupId: "queue-loading", captureBeforeFixtures: true };
  if ((ref === "VR-01" && state === "Error") || (ref === "VR-09" && state === "Queue unavailable")) return { ...base, route: "/pipeline?state=queue-unavailable", setupId: "queue-unavailable" };
  if (ref === "VR-06" && state === "Empty") return { ...base, route: "/pipeline?state=empty-assignment", setupId: "estimator-empty", responsibility: "Estimator assignment" };
  if (ref === "VR-09" && state === "Record unavailable") return { ...base, route: `/pipeline/${ids.workspaceA}?state=record-unavailable`, setupId: "record-unavailable" };
  if (ref === "VR-09" && state === "Unsaved work") return { ...base, route: `/pipeline/${fixtures.qualifyingId}?error=persistence_failed`, setupId: "unsaved-work", nextAction: "Retry save before leaving" };
  if (ref === "VR-08" || state === "Permission mismatch" || state === "Denied") return { ...base, route: `/pipeline/${fixtures.decisionReadyId}`, setupId: "permission-denied", responsibility: "Estimator assignment", deniedActions: ["view restricted opportunity", "mutate opportunity"] };
  if (ref === "VR-05" && row.role === "Decision Owner") return { ...base, route: `/pipeline/${fixtures.decisionReadyId}`, setupId: "decision-owner-package", responsibility: "Decision Owner", nextAction: "Approve, return, or decline" };
  if (ref === "VR-07") return { ...base, route: `/pipeline/${fixtures.decisionReadyId}`, setupId: "auditor-review", responsibility: "Auditor", deniedActions: ["save", "upload", "submit", "decision action"] };
  if (ref === "VR-06") return { ...base, route: `/pipeline/${fixtures.assignedId}`, setupId: "estimator-assignment", responsibility: "Estimator assignment", deniedActions: ["submit for decision", "decision action"] };
  if (ref === "VR-05") return { ...base, route: `/pipeline/${fixtures.decisionReadyId}`, setupId: "bd-preview", responsibility: "Business Development Lead", deniedActions: ["decision action"] };
  if (ref === "VR-04" && state === "Ready") return { ...base, route: `/pipeline/${fixtures.readyId}`, setupId: "qualification-ready", nextAction: "Submit to decision owner" };
  if (ref === "VR-04" && state === "Stale revision") return { ...base, route: `/pipeline/${fixtures.readyId}?error=concurrency_conflict`, setupId: "stale-package" };
  if (ref === "VR-04" && state === "Submit failure") return { ...base, route: `/pipeline/${fixtures.readyId}?error=evidence_missing`, setupId: "submit-failure" };
  if (ref === "VR-03" && state === "Partial") return { ...base, route: `/pipeline/${fixtures.partialId}`, setupId: "qualification-partial" };
  if (ref === "VR-03" && state === "Contribution pending") return { ...base, route: `/pipeline/${fixtures.assignedId}`, setupId: "contribution-pending" };
  if (ref === "VR-03" && state === "Evidence gap") return { ...base, route: `/pipeline/${fixtures.evidenceGapId}`, setupId: "evidence-gap" };
  if (ref === "VR-02" && state === "Save failure") return { ...base, route: `/pipeline/${fixtures.qualifyingId}?error=persistence_failed`, setupId: "save-failure" };
  if (ref === "VR-02" || state === "Initial") return { ...base, route: `/pipeline/${fixtures.qualifyingId}`, setupId: "qualification-initial" };
  return { ...base, route: "/pipeline", setupId: "ranked-queue", nextAction: "Open highest-ranked opportunity" };
}

async function assertFrame(page, row, target, fileName) {
  await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
  const text = await page.locator("body").innerText();
  const normalizedText = text.toLowerCase();
  for (const prohibited of ["P1-01A", "P1-01B", "local opportunity database", "production persistence gate", "production-contained", "persistence gate", "fixture", "test account"]) {
    if (text.includes(prohibited)) throw new Error(`Prohibited product copy rendered: ${prohibited}`);
  }
  if (target.responsibility === "Decision Owner" && !normalizedText.includes("decision owner")) throw new Error(`Decision Owner context missing for ${fileName}. ${text.slice(0, 500)}`);
  if (target.responsibility === "Estimator assignment" && target.setupId !== "permission-denied") {
    if (!normalizedText.includes("estimator")) throw new Error(`Estimator context missing for ${fileName}. ${text.slice(0, 500)}`);
  }
  if (target.responsibility === "Auditor" && !normalizedText.includes("auditor")) throw new Error(`Auditor context missing for ${fileName}. ${text.slice(0, 500)}`);
}

async function createFixtures({ service, bd }) {
  const qualifying = await createOpportunity(bd, "Human Review Initial Qualification", "Hospital access road and conduit crossing");
  const partial = await createOpportunity(bd, "Human Review Partial Qualification", "West duct bank crossing");
  await saveQualification(bd, partial.opportunity.id, partial.opportunity.version, partialQualification());
  const ready = await createOpportunity(bd, "Human Review Ready Package", "North duct bank");
  const readySaved = await saveQualification(bd, ready.opportunity.id, ready.opportunity.version, completeQualification());
  const readyAccountable = await setDecisionAccountability(bd, ready.opportunity.id, readySaved.opportunity.version, "capture-ready-accountability");
  const readyEvidence = await attachDecisionSupportEvidence(bd, ready.opportunity.id, readyAccountable.opportunity.version);
  const evidenceGap = await createOpportunity(bd, "Human Review Evidence Gap", "South entrance crossing");
  const evidenceSaved = await saveQualification(bd, evidenceGap.opportunity.id, evidenceGap.opportunity.version, completeQualification());
  await setDecisionAccountability(bd, evidenceGap.opportunity.id, evidenceSaved.opportunity.version, "capture-gap-accountability");
  const decision = await createOpportunity(bd, "Human Review Decision Package", "Hospital access road and conduit crossing");
  const decisionSaved = await saveQualification(bd, decision.opportunity.id, decision.opportunity.version, completeQualification());
  const decisionAccountable = await setDecisionAccountability(bd, decision.opportunity.id, decisionSaved.opportunity.version, "capture-decision-accountability");
  const decisionEvidence = await attachDecisionSupportEvidence(bd, decision.opportunity.id, decisionAccountable.opportunity.version);
  const decisionReady = await submitForDecision(bd, decision.opportunity.id, decisionEvidence.opportunity.version);
  const assigned = await createOpportunity(bd, "Human Review Assigned Estimator", "East entrance bore");
  await assignEstimator(bd, service, assigned.opportunity.id, assigned.opportunity.version);
  for (const name of ["Human Review Queue A", "Human Review Queue B", "Human Review Queue C", "Human Review Queue D", "Human Review Queue E"]) {
    await createOpportunity(bd, name, `${name} location`, { duplicateConfirmed: true });
  }
  return {
    qualifyingId: qualifying.opportunity.id,
    partialId: partial.opportunity.id,
    readyId: readyEvidence.opportunity.id,
    evidenceGapId: evidenceGap.opportunity.id,
    decisionReadyId: decisionReady.opportunity.id,
    assignedId: assigned.opportunity.id
  };
}

async function bootstrapAndClients() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: root,
    env: qaEnv,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) throw new Error(`Foundation bootstrap failed: ${redact(result.stderr || result.stdout || "no output")}`);
  const service = createClient(qaEnv.NEXT_PUBLIC_SUPABASE_URL, qaEnv.SUPABASE_SERVICE_ROLE_KEY || qaEnv.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  return {
    service,
    bd: await signIn("bd-a@foundation0a.local"),
    ops: await signIn("ops-a@foundation0a.local"),
    pm: await signIn("pm-a@foundation0a.local"),
    auditor: await signIn("auditor-a@foundation0a.local")
  };
}

async function signIn(email) {
  const client = createClient(qaEnv.NEXT_PUBLIC_SUPABASE_URL, qaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || qaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await client.auth.signInWithPassword({ email, password: fixturePassword });
  if (result.error || !result.data.user) throw new Error(`Sign in failed for ${email}: ${result.error?.message ?? "missing user"}`);
  return client;
}

async function signedInContext(browser, appBaseUrl, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${appBaseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await Promise.all([
    page.waitForURL(/\/pipeline/i, { timeout: 20_000 }),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.close();
  return context;
}

async function cleanupFixtures(service) {
  const { data } = await service.from("opportunities").select("id").eq("workspace_id", ids.workspaceA).or("stable_opportunity_key.like.opp-%,name.ilike.Human Review%");
  const idsToDelete = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (idsToDelete.length) {
    await service.from("opportunity_assignments").delete().in("opportunity_id", idsToDelete);
    await service.from("opportunity_qualifications").delete().in("opportunity_id", idsToDelete);
    await service.from("opportunities").delete().in("id", idsToDelete);
  }
}

async function createOpportunity(client, name, location, overrides = {}) {
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
      duplicateConfirmed: overrides.duplicateConfirmed ?? false
    },
    p_command_id: commandId(`capture-create-${name}`),
    p_correlation_id: `capture-create-${name}`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function saveQualification(client, id, version, payload) {
  const result = await client.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: id,
    p_payload: payload,
    p_command_id: commandId(`capture-qualification-${id}`),
    p_expected_version: version,
    p_correlation_id: `capture-qualification-${id}`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function setDecisionAccountability(client, id, version, key) {
  const decisionOwnerUserId = await userIdFor(createClient(qaEnv.NEXT_PUBLIC_SUPABASE_URL, qaEnv.SUPABASE_SERVICE_ROLE_KEY || qaEnv.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } }), "ops-a@foundation0a.local");
  const result = await client.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: id,
    p_decision_owner_user_id: decisionOwnerUserId,
    p_decision_due_at: "2026-07-10",
    p_command_id: commandId(key),
    p_expected_version: version,
    p_correlation_id: key
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function attachDecisionSupportEvidence(client, id, version) {
  const result = await client.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: id,
    p_payload: { fileName: "decision-support.txt", mimeType: "text/plain", sizeBytes: 42, checksumSha256: `capture-${randomUUID()}` },
    p_command_id: commandId(`capture-evidence-${id}`),
    p_expected_version: version,
    p_correlation_id: `capture-evidence-${id}`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function submitForDecision(client, id, version) {
  const result = await client.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: id,
    p_command_id: commandId(`capture-submit-${id}`),
    p_expected_version: version,
    p_correlation_id: `capture-submit-${id}`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

async function assignEstimator(client, service, opportunityId, expectedVersion) {
  const pmUserId = await userIdFor(service, "pm-a@foundation0a.local");
  const result = await client.rpc("manage_opportunity_assignment_v1", {
    p_opportunity_id: opportunityId,
    p_user_id: pmUserId,
    p_assignment_type: "estimator",
    p_status: "active",
    p_command_id: commandId(`capture-estimator-${opportunityId}`),
    p_expected_version: expectedVersion,
    p_correlation_id: `capture-estimator-${opportunityId}`
  });
  if (result.error || result.data?.success !== true) throw new Error(result.error?.message ?? JSON.stringify(result.data));
  return result.data;
}

function partialQualification() {
  return { ...completeQualification(), scopeClarity: "", designMaturity: "", recommendation: "hold_for_clarification" };
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

function ensureLocalSupabaseEnv() {
  return requireQualificationChildEnv();
}

function parseCsv(content) {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid viewport: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function pngSize(filePath) {
  const bytes = readFileSync(filePath);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function fingerprint(files) {
  return sha256(files.map((file) => `${file}:${existsSync(join(root, file)) ? sha256(readFileSync(join(root, file))) : "missing"}`).join("\n"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function runText(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === "object" && address ? address.port : 0));
    });
    server.on("error", reject);
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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function renderComparison(row, screenshotPath, target) {
  const reference = relative(dirname(screenshotPath), join(authorityRoot, row.clean_frame)).replaceAll("\\", "/");
  const current = relative(dirname(join(comparisonRoot, row.visual_reference, basename(screenshotPath).replace(/\.png$/i, ".html"))), screenshotPath).replaceAll("\\", "/");
  return `<!doctype html><meta charset="utf-8"><title>${row.visual_reference} ${row.state}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#172033}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{max-width:100%;border:1px solid #ccd3df}h1{font-size:20px}.meta{grid-column:1/-1;color:#526071}</style><h1>${row.screen_spec} - ${row.frame_label}</h1><p class="meta">Role: ${row.role} | Responsibility: ${target.responsibility} | Viewport: ${row.viewport} | State: ${row.state}</p><main><section><h2>Approved reference</h2><img src="${reference}"></section><section><h2>Implementation</h2><img src="${current}"></section></main><p>${target.deviation}</p>`;
}

function renderIndex(entries) {
  const rows = entries.map((entry) => `<tr><td>${entry.visualReference}</td><td>${entry.screenSpec}</td><td>${entry.state}</td><td>${entry.role}</td><td>${entry.opportunityResponsibility}</td><td>${entry.viewport}</td><td><a href="${entry.screenshotPath}">screenshot</a></td><td><a href="${entry.comparisonPath}">comparison</a></td><td>${entry.approvedReferenceDeviation}</td></tr>`).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>P1-01A Human Acceptance Evidence</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d8dee8;padding:8px;text-align:left}th{background:#f3f6fa}</style><h1>P1-01A Human Acceptance Evidence</h1><p>Captured ${entries.length} implementation frames. P1-01B remains unauthorized.</p><table><thead><tr><th>VR</th><th>Spec</th><th>State</th><th>Role</th><th>Responsibility</th><th>Viewport</th><th>Screenshot</th><th>Comparison</th><th>Deviation</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function toCsv(entries) {
  const headers = ["visualReference", "screenSpec", "state", "role", "opportunityResponsibility", "route", "viewport", "screenshotPath", "captureTimestamp", "pngWidth", "pngHeight", "fileSize", "sha256", "stateSetupId", "result"];
  return `${headers.join(",")}\n${entries.map((entry) => headers.map((header) => JSON.stringify(entry[header] ?? "")).join(",")).join("\n")}\n`;
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]");
}
