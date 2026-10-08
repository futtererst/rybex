import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { commandId, ids, userIdFor } from "./foundation-0b-test-utils.mjs";
import { defaultSupabaseCommand } from "./cfg-runtime-03-loopback-guard.mjs";
import { discoverCfgRuntime03RepositoryRoot } from "./cfg-runtime-03-repository-boundary.mjs";

const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd(), callerRoot: process.env.CFG_RUNTIME_03_ACTIVE_ROOT });
const supabaseCommand = defaultSupabaseCommand(root);
const dockerBin = "C:\\Program Files\\Docker\\Docker\\resources\\bin";
const evidenceDir = resolve(root, "visual-qa-output/p1-01a-opportunity/acceptance-closure");
const dbPath = join(evidenceDir, "database-results.json");
const browserPath = join(evidenceDir, "browser-results.json");
const summaryPath = join(evidenceDir, "coverage-summary.json");
const password = `P1-01A-Closure-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const startedAt = new Date().toISOString();
const dbResults = [];
const browserResults = [];
const commandResults = [];
const productDefects = [];
let stackStarted = false;
let nextServer = null;
let browser = null;
let localEnv = {};
let service;
let clients = {};
let fixtures = {};
let nextRestartPersistence = false;
let productionContainmentVerified = false;
let phase0RegressionPassed = false;

mkdirSync(evidenceDir, { recursive: true });

try {

  const nodeVersion = process.version;
  const dockerVersion = summarizeDocker(runCapture("docker", ["version"], { includeDockerPath: true, label: "docker version" }).stdout);
  runCapture("docker", ["info"], { includeDockerPath: true, label: "docker info" });
  const supabaseCliVersion = runCapture(supabaseCommand, ["--version"], { includeDockerPath: true, label: "supabase --version" }).stdout.trim();

  const statusBefore = runCapture(supabaseCommand, ["status", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR], { includeDockerPath: true, label: "supabase status before", allowFailure: true }).stdout;
  run(process.execPath, ["scripts/run-guarded-qualification-supabase.mjs", "start"], { includeDockerPath: true, label: "supabase start", suppressOutput: true });
  stackStarted = true;

  localEnv = mapSupabaseEnv(runCapture(supabaseCommand, ["status", "-o", "env", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR], {
    includeDockerPath: true,
    label: "supabase status -o env",
    suppressOutput: true
  }).stdout);

  const baseEnv = {
    ...process.env,
    ...localEnv,
    NEXT_TELEMETRY_DISABLED: "1",
    RYBEXOS_RUNTIME_MODE: "test",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database",
    FOUNDATION_0A_TEST_PASSWORD: password,
    P1_01A_RESULTS_PATH: join(root, "visual-qa-output/p1-01a-opportunity/results.json"),
    Path: `${dockerBin};${process.env.Path ?? process.env.PATH ?? ""}`,
    PATH: `${dockerBin};${process.env.PATH ?? process.env.Path ?? ""}`
  };

  run(supabaseCommand, ["db", "reset", "--local", "--no-seed", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR], {
    includeDockerPath: true,
    env: baseEnv,
    label: "supabase db reset --local --no-seed"
  });

  run("node", ["scripts/bootstrap-foundation-0a-local.mjs"], {
    env: baseEnv,
    label: "bootstrap-foundation-0a-local"
  });

  run("npm.cmd", ["run", "p1-01a:verify"], { env: baseEnv, label: "npm.cmd run p1-01a:verify" });
  run("npm.cmd", ["run", "p1-01a:qa-db"], { env: baseEnv, label: "npm.cmd run p1-01a:qa-db" });
  run("npm.cmd", ["run", "p1-01a:qa-browser"], { env: baseEnv, label: "npm.cmd run p1-01a:qa-browser" });

  await setupClients();
  await cleanupClosureFixtures();
  await runDatabaseCases();
  await runBrowserCases(baseEnv);

  run("npm.cmd", ["run", "p1-01a:verify-acceptance-package"], {
    env: baseEnv,
    label: "npm.cmd run p1-01a:verify-acceptance-package"
  });

  const regressionEnv = {
    ...baseEnv,
    RYBEXOS_AUTH_MODE: "demo",
    RYBEXOS_DATA_SOURCE: "seed",
    RYBEXOS_BILLING_V2_PERSISTENCE: "local",
    RYBEXOS_FIELD_ISSUE_PERSISTENCE: "local",
    RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "local"
  };
  const regressions = [
    ["npm.cmd", ["run", "foundation-0f:verify"]],
    ["npm.cmd", ["run", "production:verify-no-fallback"]],
    ["npm.cmd", ["run", "command-center:c-plus-verify"]],
    ["npm.cmd", ["run", "command-center:supporting-context-verify"]],
    ["npm.cmd", ["run", "typecheck"]],
    ["npm.cmd", ["run", "lint"]],
    ["npm.cmd", ["run", "build"]]
  ];
  for (const [cmd, args] of regressions) {
    run(cmd, args, { env: regressionEnv, label: `${cmd} ${args.join(" ")}` });
  }
  phase0RegressionPassed = true;
  await recordDeferredDbCases();

  writeEvidence({
    nodeVersion,
    dockerVersion,
    supabaseCliVersion,
    statusBefore
  });

  const failedDb = dbResults.filter((entry) => entry.result === "failed");
  const failedBrowser = browserResults.filter((entry) => entry.result === "failed");
  if (failedDb.length > 0 || failedBrowser.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  if (dbResults.length === 0 && browserResults.length === 0) {
    productDefects.push({
      type: "infrastructure_failure",
      message: redact(error instanceof Error ? error.message : String(error))
    });
  }
  writeEvidence({ failure: redact(error instanceof Error ? error.message : String(error)) });
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (nextServer && !nextServer.killed) nextServer.kill();
  if (stackStarted && !process.env.RYBEX_QUALIFICATION_PROJECT_ID) {
    const stop = spawnSync(supabaseCommand, ["stop", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR, "--project-id", process.env.RYBEX_QUALIFICATION_PROJECT_ID, "--no-backup", "--yes"], {
      cwd: root,
      env: withDockerPath(process.env, true),
      encoding: "utf8",
      shell: false,
      maxBuffer: 1024 * 1024 * 20
    });
    commandResults.push({ command: "npx.cmd supabase stop", status: stop.status === 0 ? "passed" : "failed", exitCode: stop.status, stderr: redact(stop.stderr ?? "") });
    if (stop.stdout) process.stdout.write(redact(stop.stdout));
    if (stop.stderr) process.stderr.write(redact(stop.stderr));
  }
  writeEvidence();
}

async function setupClients() {
  service = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  clients = {
    bd: await signIn("bd-a@foundation0a.local"),
    ops: await signIn("ops-a@foundation0a.local"),
    auditor: await signIn("auditor-a@foundation0a.local"),
    pm: await signIn("pm-a@foundation0a.local"),
    field: await signIn("field-a@foundation0a.local"),
    userB: await signIn("user-b@foundation0a.local")
  };
}

async function runDatabaseCases() {
  const localBefore = localOpportunityArtifacts();
  const primary = await createOpportunity(clients.bd, "DB Closure Primary", "Hospital access road and conduit crossing", { duplicateConfirmed: true });
  fixtures.primary = primary;

  await db("DB-001", "Business Development Lead can create an opportunity.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "create_opportunity_v1", true, true, async () => {
    assert(primary.success === true, "create_opportunity_v1 did not succeed");
    assert(primary.opportunity.lifecycle_status === "qualifying", "lifecycle did not become qualifying");
  });

  await db("DB-002", "Cross-workspace user cannot read the opportunity.", "user-b", "operations_leader", primary.opportunity.stable_opportunity_key, "select opportunity from Workspace B", true, true, async () => {
    const { data, error } = await clients.userB.from("opportunities").select("id").eq("id", primary.opportunity.id);
    assert(!error, error?.message);
    assert(Array.isArray(data) && data.length === 0, `Workspace B saw ${data?.length ?? "unknown"} rows`);
  });

  await db("DB-003", "Unauthorized user cannot edit the opportunity.", "field-a", "field_supervisor", primary.opportunity.stable_opportunity_key, "update_opportunity_v1", true, true, async () => {
    const result = await updateOpportunity(clients.field, primary.opportunity.id, { scopeSummary: "unauthorized edit" }, primary.opportunity.version);
    assert(result.success === false && result.error === "forbidden", JSON.stringify(result));
  });

  await db("DB-004", "Read-only Auditor can read but cannot mutate.", "auditor-a", "read_only_auditor", primary.opportunity.stable_opportunity_key, "read then mutate", true, true, async () => {
    const read = await getOpportunity(clients.auditor, primary.opportunity.id);
    const mutate = await createOpportunity(clients.auditor, "DB Auditor Forbidden", "No access", { duplicateConfirmed: true });
    assert(read.success === true, "auditor could not read");
    assert(mutate.success === false && mutate.error === "forbidden", JSON.stringify(mutate));
  });

  const estimatorOnly = await createOpportunity(clients.bd, "DB Estimator Assigned", "Assigned bore", { duplicateConfirmed: true });
  const unassigned = await createOpportunity(clients.bd, "DB Estimator Unassigned", "Unassigned bore", { duplicateConfirmed: true });
  await assignEstimator(estimatorOnly.opportunity.id, estimatorOnly.opportunity.version);

  await db("DB-005", "Assigned Estimator can access only the assigned opportunity.", "pm-a", "project_manager as estimator", estimatorOnly.opportunity.stable_opportunity_key, "read assigned/unassigned opportunities", true, true, async () => {
    const assigned = await getOpportunity(clients.pm, estimatorOnly.opportunity.id);
    const notAssigned = await getOpportunity(clients.pm, unassigned.opportunity.id);
    assert(assigned.success === true, "assigned estimator could not access assigned opportunity");
    assert(notAssigned.success === false && notAssigned.error === "forbidden", "estimator accessed unassigned opportunity");
  });

  await db("DB-006", "Estimator cannot manage assignments or exercise executive-decision authority.", "pm-a", "project_manager as estimator", estimatorOnly.opportunity.stable_opportunity_key, "manage assignment / decision authority check", true, true, async () => {
    const fieldUser = await userIdFor(service, "field-a@foundation0a.local");
    const manage = await manageAssignment(clients.pm, estimatorOnly.opportunity.id, fieldUser, "contributor", "active", estimatorOnly.opportunity.version + 1);
    assert(manage.success === false && manage.error === "forbidden", JSON.stringify(manage));
    assert(!(await hasOpportunityDecision(estimatorOnly.opportunity.id)), "estimator action created an executive decision record");
  });

  await db("DB-007", "Unassigned non-elevated contributor cannot access the opportunity.", "field-a", "field_supervisor", primary.opportunity.stable_opportunity_key, "select and RPC read", true, true, async () => {
    const direct = await clients.field.from("opportunities").select("id").eq("id", primary.opportunity.id);
    const rpc = await getOpportunity(clients.field, primary.opportunity.id);
    assert(!direct.error && direct.data.length === 0, "unassigned user saw direct row");
    assert(rpc.success === false && rpc.error === "forbidden", JSON.stringify(rpc));
  });

  await db("DB-008", "Ordinary user cannot self-assign as opportunity owner.", "field-a", "field_supervisor", primary.opportunity.stable_opportunity_key, "manage_opportunity_assignment_v1 self-owner", true, true, async () => {
    const fieldUser = await userIdFor(service, "field-a@foundation0a.local");
    const result = await manageAssignment(clients.field, primary.opportunity.id, fieldUser, "owner", "active", primary.opportunity.version);
    assert(result.success === false && result.error === "forbidden", JSON.stringify(result));
  });

  await db("DB-009", "Direct authenticated insert, update, and delete against protected opportunity, assignment, and qualification tables are denied.", "field-a", "field_supervisor", primary.opportunity.stable_opportunity_key, "direct table mutations", true, true, async () => {
    const before = await serviceSnapshot(primary.opportunity.id);
    const attempts = [];
    attempts.push(await clients.field.from("opportunities").insert({ workspace_id: ids.workspaceA, organization_id: ids.orgA, name: "Direct denied", gc_client: "Denied", stable_opportunity_key: `direct-${Date.now()}`, customer_gc: "Denied" }));
    attempts.push(await clients.field.from("opportunities").update({ name: "Direct update denied" }).eq("id", primary.opportunity.id));
    attempts.push(await clients.field.from("opportunities").delete().eq("id", primary.opportunity.id));
    attempts.push(await clients.field.from("opportunity_assignments").insert({ workspace_id: ids.workspaceA, opportunity_id: primary.opportunity.id, user_id: await userIdFor(service, "field-a@foundation0a.local"), assignment_type: "contributor" }));
    attempts.push(await clients.field.from("opportunity_assignments").update({ status: "archived" }).eq("opportunity_id", primary.opportunity.id));
    attempts.push(await clients.field.from("opportunity_assignments").delete().eq("opportunity_id", primary.opportunity.id));
    attempts.push(await clients.field.from("opportunity_qualifications").insert({ workspace_id: ids.workspaceA, opportunity_id: primary.opportunity.id, strategic_fit: "strong" }));
    attempts.push(await clients.field.from("opportunity_qualifications").update({ strategic_fit: "risk" }).eq("opportunity_id", primary.opportunity.id));
    attempts.push(await clients.field.from("opportunity_qualifications").delete().eq("opportunity_id", primary.opportunity.id));
    assert(attempts.every((attempt) => Boolean(attempt.error)), `direct mutation succeeded: ${JSON.stringify(attempts.map((a) => a.error?.message ?? "success"))}`);
    const after = await serviceSnapshot(primary.opportunity.id);
    assert(JSON.stringify(before) === JSON.stringify(after), "target record changed after direct-denial attempts");
  });

  await db("DB-010", "Valid opportunity intake persists.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "service reload", true, true, async () => {
    const row = await serviceOpportunity(primary.opportunity.id);
    assert(row.name === "DB Closure Primary", "created opportunity not persisted");
  });

  await db("DB-011", "Exactly one active accountable owner is established.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "owner count", true, true, async () => {
    const count = await countRows("opportunity_assignments", [["opportunity_id", primary.opportunity.id], ["assignment_type", "owner"], ["status", "active"]]);
    assert(count === 1, `active owner count ${count}`);
  });

  await db("DB-012", "Incomplete intake fails with specific typed validation.", "bd-a", "business_development_lead", null, "create_opportunity_v1 missing name", true, true, async () => {
    const before = await allCounts();
    const result = await createOpportunity(clients.bd, "", "Missing name", { duplicateConfirmed: true });
    const after = await allCounts();
    assert(result.success === false && result.error === "validation_failed", JSON.stringify(result));
    assertCountsEqual(before, after, "incomplete intake changed database state");
  });

  await db("DB-013", "Duplicate warning is limited to the same workspace.", "bd-a/user-b", "business_development_lead / operations_leader Workspace B", primary.opportunity.stable_opportunity_key, "duplicate create in A and B", true, true, async () => {
    const sameWorkspace = await createOpportunity(clients.bd, "DB Closure Primary", "Hospital access road and conduit crossing");
    const otherWorkspace = await createOpportunity(clients.userB, "DB Closure Primary", "Hospital access road and conduit crossing", { duplicateConfirmed: false });
    assert(sameWorkspace.success === false && sameWorkspace.error === "duplicate_warning_requires_confirmation", JSON.stringify(sameWorkspace));
    assert(otherWorkspace.success === true, JSON.stringify(otherWorkspace));
  });

  await db("DB-014", "Authorized confirmation of a possible duplicate is audited.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "duplicate confirmed create", true, true, async () => {
    const result = await createOpportunity(clients.bd, "DB Closure Primary", "Hospital access road and conduit crossing", { duplicateConfirmed: true });
    const audit = await countRows("audit_events", [["entity_type", "opportunity"], ["action", "opportunity.duplicate_confirmed"]]);
    assert(result.success === true, JSON.stringify(result));
    assert(audit >= 1, `duplicate audit count ${audit}`);
  });

  await db("DB-015", "Stable opportunity key is unique.", "service", "service fixture", primary.opportunity.stable_opportunity_key, "duplicate stable key insert", false, false, async () => {
    const row = await serviceOpportunity(primary.opportunity.id);
    const { error } = await service.from("opportunities").insert({ ...row, id: randomUUID(), name: "Duplicate stable key" });
    assert(Boolean(error), "duplicate stable key insert succeeded");
  });

  await db("DB-017", "Qualification can be saved incrementally.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "save partial qualification", true, true, async () => {
    const result = await saveQualification(clients.bd, primary.opportunity.id, primary.opportunity.version, partialQualification());
    fixtures.partialResult = result;
    assert(result.success === true, JSON.stringify(result));
    assert(result.qualification.completeness_result === "incomplete", "partial qualification not marked incomplete");
  });

  await db("DB-018", "Required qualification criteria completeness is enforced.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "partial then complete qualification", true, true, async () => {
    const partial = fixtures.partialResult;
    const complete = await saveQualification(clients.bd, primary.opportunity.id, partial.opportunity.version, completeQualification());
    fixtures.primaryQualified = complete;
    assert(partial.qualification.completeness_result === "incomplete", "partial was not incomplete");
    assert(complete.qualification.completeness_result === "complete", "complete qualification not complete");
  });

  await db("DB-019", "Optional qualification criteria do not falsely block completion.", "bd-a", "business_development_lead", null, "blank assumptions qualification", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Optional Qualification", "Optional road", { duplicateConfirmed: true });
    const payload = { ...completeQualification(), assumptions: "" };
    const result = await saveQualification(clients.bd, opp.opportunity.id, opp.opportunity.version, payload);
    assert(result.success === true, JSON.stringify(result));
    assert(result.qualification.completeness_result === "complete", "blank assumptions blocked completion");
  });

  await db("DB-020", "Qualification recommendation remains distinct from executive decision.", "bd-a", "business_development_lead", null, "save recommendation no_bid", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Recommendation Distinct", "Decision road", { duplicateConfirmed: true });
    const result = await saveQualification(clients.bd, opp.opportunity.id, opp.opportunity.version, { ...completeQualification(), recommendation: "no_bid" });
    const row = await serviceOpportunity(opp.opportunity.id);
    assert(result.qualification.recommendation === "no_bid", "recommendation not stored");
    assert(row.decision === null, "executive decision field was set");
  });

  await db("DB-022", "Assigned Estimator can contribute only to approved qualification fields.", "pm-a", "project_manager as estimator", estimatorOnly.opportunity.stable_opportunity_key, "save qualification with extra ignored field", true, true, async () => {
    const before = await serviceOpportunity(estimatorOnly.opportunity.id);
    const result = await saveQualification(clients.pm, estimatorOnly.opportunity.id, estimatorOnly.opportunity.version + 1, { ...completeQualification(), ownerUserId: await userIdFor(service, "pm-a@foundation0a.local") });
    const after = await serviceOpportunity(estimatorOnly.opportunity.id);
    assert(result.success === true, JSON.stringify(result));
    assert(before.owner_user_id === after.owner_user_id, "extra ownerUserId changed owner");
  });

  await db("DB-023", "Unauthorized qualification mutation is denied.", "field-a", "field_supervisor", primary.opportunity.stable_opportunity_key, "save qualification", true, true, async () => {
    const result = await saveQualification(clients.field, primary.opportunity.id, fixtures.primaryQualified.opportunity.version, completeQualification());
    assert(result.success === false && result.error === "forbidden", JSON.stringify(result));
  });

  const draftNoIntake = await insertOpportunityFixture("DB Draft No Intake", { intakeComplete: false, ownerUserId: await userIdFor(service, "bd-a@foundation0a.local") });
  const noOwner = await insertOpportunityFixture("DB No Owner", { intakeComplete: true, ownerUserId: null });

  await db("DB-024", "Opportunity with incomplete intake cannot submit for decision.", "bd-a", "business_development_lead", draftNoIntake.stable_opportunity_key, "submit incomplete intake", true, true, async () => {
    const before = await allCounts();
    const result = await submitForDecision(clients.bd, draftNoIntake.id, draftNoIntake.version);
    const after = await allCounts();
    assert(result.success === false && result.error === "validation_failed", JSON.stringify(result));
    assertCountsEqual(before, after, "failed submit changed state");
  });

  await db("DB-025", "Opportunity without an active accountable owner cannot submit.", "bd-a", "business_development_lead", noOwner.stable_opportunity_key, "submit no owner", true, true, async () => {
    const result = await submitForDecision(clients.bd, noOwner.id, noOwner.version);
    assert(result.success === false && result.error === "validation_failed", JSON.stringify(result));
  });

  await db("DB-026", "Incomplete qualification cannot submit.", "bd-a", "business_development_lead", null, "submit without complete qualification", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Incomplete Submit", "Incomplete crossing", { duplicateConfirmed: true });
    const result = await submitForDecision(clients.bd, opp.opportunity.id, opp.opportunity.version);
    assert(result.success === false && result.error === "validation_failed", JSON.stringify(result));
  });

  await db("DB-027", "Missing explicitly mandatory managed evidence cannot submit when the acceptance contract requires it.", "bd-a", "business_development_lead", null, "submit without evidence", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Evidence Required Probe", "Evidence road", { duplicateConfirmed: true });
    const qualified = await saveQualification(clients.bd, opp.opportunity.id, opp.opportunity.version, completeQualification());
    const result = await submitForDecision(clients.bd, opp.opportunity.id, qualified.opportunity.version);
    assert(result.success === false && result.error === "evidence_missing", JSON.stringify(result));
  });

  await db("DB-028", "Valid intake and qualification advance the opportunity to decision_required.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "submit complete opportunity", true, true, async () => {
    fixtures.primaryEvidence = await attachDecisionSupportEvidence(clients.bd, primary.opportunity.id, fixtures.primaryQualified.opportunity.version);
    const result = await submitForDecision(clients.bd, primary.opportunity.id, fixtures.primaryEvidence.opportunity.version);
    fixtures.submitted = result;
    assert(result.success === true, JSON.stringify(result));
    assert(result.opportunity.lifecycle_status === "decision_required", "not decision_required");
  });

  await db("DB-029", "Submission actor and timestamp persist.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "inspect submitted fields", true, true, async () => {
    const row = await serviceOpportunity(primary.opportunity.id);
    const bdUser = await userIdFor(service, "bd-a@foundation0a.local");
    assert(Boolean(row.submitted_for_decision_at), "missing submitted timestamp");
    assert(row.submitted_for_decision_by === bdUser, "submitted actor mismatch");
  });

  await db("DB-030", "No executive decision record is created by P1-01A submission.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "inspect decision state", true, true, async () => {
    const row = await serviceOpportunity(primary.opportunity.id);
    assert(row.decision === null, "decision field was set");
    assert(!(await hasOpportunityDecision(primary.opportunity.id)), "executive decision record was created");
  });

  await db("DB-031", "Same command ID and same payload replay safely without duplicate state, audit, or events.", "bd-a", "business_development_lead", null, "qualification replay count", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Replay Safety", "Replay road", { duplicateConfirmed: true });
    const cmd = commandId("db031-replay");
    const before = await eventCounts(opp.opportunity.id);
    const first = await saveQualification(clients.bd, opp.opportunity.id, opp.opportunity.version, completeQualification(), cmd);
    const afterFirst = await eventCounts(opp.opportunity.id);
    const second = await saveQualification(clients.bd, opp.opportunity.id, opp.opportunity.version, completeQualification(), cmd);
    const afterSecond = await eventCounts(opp.opportunity.id);
    assert(first.success === true && second.success === true && second.replayed === true, JSON.stringify(second));
    assert(afterFirst.audit === before.audit + 1 && afterFirst.events === before.events + 1, "first replay command did not append expected events");
    assert(afterSecond.audit === afterFirst.audit && afterSecond.events === afterFirst.events, "replay appended duplicate audit/events");
  });

  await db("DB-032", "Stale expected version returns a concurrency conflict.", "bd-a", "business_development_lead", null, "stale update", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Stale Conflict", "Conflict road", { duplicateConfirmed: true });
    const result = await updateOpportunity(clients.bd, opp.opportunity.id, { scopeSummary: "stale" }, opp.opportunity.version - 1);
    assert(result.success === false && result.error === "concurrency_conflict", JSON.stringify(result));
  });

  await db("DB-033", "Concurrent same-version updates produce one success and one conflict.", "bd-a", "business_development_lead", null, "parallel updates", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Concurrent", "Concurrent road", { duplicateConfirmed: true });
    const [a, b] = await Promise.all([
      updateOpportunity(clients.bd, opp.opportunity.id, { scopeSummary: "concurrent A" }, opp.opportunity.version),
      updateOpportunity(clients.bd, opp.opportunity.id, { scopeSummary: "concurrent B" }, opp.opportunity.version)
    ]);
    const statuses = [a, b].map((r) => r.success ? "success" : r.error).sort();
    assert(statuses.includes("success") && statuses.includes("concurrency_conflict"), JSON.stringify([a, b]));
  });

  await db("DB-034", "Failed submission produces no partial opportunity, assignment, qualification, audit, or event state.", "bd-a", "business_development_lead", null, "failed submit counts", true, true, async () => {
    const opp = await createOpportunity(clients.bd, "DB Failed Submit No Partial", "Failure road", { duplicateConfirmed: true });
    const before = await eventCounts(opp.opportunity.id);
    const result = await submitForDecision(clients.bd, opp.opportunity.id, opp.opportunity.version);
    const after = await eventCounts(opp.opportunity.id);
    const row = await serviceOpportunity(opp.opportunity.id);
    assert(result.success === false && result.error === "validation_failed", JSON.stringify(result));
    assert(before.audit === after.audit && before.events === after.events, "failed submit wrote audit/events");
    assert(row.lifecycle_status === "qualifying" && row.submitted_for_decision_at === null, "failed submit mutated opportunity");
  });

  await db("DB-035", "Successful material commands append the correct audit and domain events.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "event action check", true, true, async () => {
    const auditActions = await actionsFor("audit_events", primary.opportunity.id);
    const domainTypes = await actionsFor("domain_events", primary.opportunity.id, "event_type");
    for (const action of ["opportunity.created", "opportunity.qualification_saved", "opportunity.submitted_for_decision"]) {
      assert(auditActions.includes(action), `missing audit ${action}`);
      assert(domainTypes.includes(action), `missing domain event ${action}`);
    }
  });

  await db("DB-038", "Explicit test/database mode operates successfully.", "bd-a", "business_development_lead", primary.opportunity.stable_opportunity_key, "list in test database mode", true, true, async () => {
    const list = await clients.bd.rpc("p1_01a_list_opportunity_actions_v1");
    assert(list.data?.success === true && list.data.items.length > 0, JSON.stringify(list.data ?? list.error));
  });

  await db("DB-039", "No local JSON opportunity store is read or written.", "filesystem", "n/a", null, "local artifact diff", false, false, async () => {
    const after = localOpportunityArtifacts();
    assert(JSON.stringify(localBefore) === JSON.stringify(after), `local opportunity artifacts changed: ${JSON.stringify({ before: localBefore, after })}`);
  });
}

async function recordDeferredDbCases() {
  await db("DB-016", "Saved intake survives repository reload and application-server restart.", "bd-a", "business_development_lead", fixtures.primary?.opportunity?.stable_opportunity_key ?? null, "browser restart persistence", true, true, async () => {
    assert(nextRestartPersistence === true, "Next server restart persistence was not verified");
  });
  await db("DB-021", "Qualification survives repository reload and application-server restart.", "bd-a", "business_development_lead", fixtures.primary?.opportunity?.stable_opportunity_key ?? null, "browser restart persistence", true, true, async () => {
    assert(nextRestartPersistence === true, "Qualification restart persistence was not verified");
  });
  await db("DB-036", "True production runtime does not read or present seed opportunity data.", "bd-a", "business_development_lead", null, "production containment browser", true, true, async () => {
    assert(productionContainmentVerified === true, "Production containment was not verified");
  });
  await db("DB-037", "Pipeline remains unavailable in the production-module registry.", "bd-a", "business_development_lead", null, "production containment browser", true, true, async () => {
    assert(productionContainmentVerified === true, "Production unavailable state was not verified");
  });
  await db("DB-040", "Existing Phase 0 production-enabled routes and persisted domains remain unaffected.", "regression", "n/a", null, "Phase 0 regression commands", false, false, async () => {
    assert(phase0RegressionPassed === true, "Phase 0 regression commands did not pass");
  });
}

async function runBrowserCases(baseEnv) {
  execFileSync(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
    cwd: root,
    env: baseEnv,
    stdio: "inherit"
  });

  const port = await freePort();
  let baseUrl = `http://127.0.0.1:${port}`;
  nextServer = startNext(port, baseEnv);
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  let browserCreatedId = null;
  let browserCreatedStable = null;

  await br("BR-001", "Sign in through the application as Business Development Lead.", "bd-a", "business_development_lead", null, "/auth/sign-in", async () => {
    await signInBrowser(page, baseUrl, "bd-a@foundation0a.local", "/pipeline");
    assert(new URL(page.url()).pathname === "/pipeline", `unexpected path ${page.url()}`);
  });

  await br("BR-002", "Open the Opportunity Action Queue.", "bd-a", "business_development_lead", null, "/pipeline", async () => {
    await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
    await visible(page, "Opportunity intake and qualification");
  });

  await br("BR-003", "Verify the empty or seeded queue state is understandable and actionable.", "bd-a", "business_development_lead", null, "/pipeline", async () => {
    await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
    await visible(page, "New opportunity");
    const body = await page.locator("body").innerText();
    assert(/Current pipeline action|No active P1-01A opportunities/i.test(body), "queue state lacked action framing");
  });

  await br("BR-004", "Navigate through the UI and create a new opportunity.", "bd-a", "business_development_lead", null, "/pipeline/new", async () => {
    await page.getByRole("link", { name: "New opportunity" }).first().click();
    await page.waitForURL(/\/pipeline\/new/);
    await fillIntake(page, `BR Closure Intake ${Date.now()}`, "Browser access road");
    await Promise.all([
      page.waitForURL(/\/pipeline\/[0-9a-f-]+/i, { timeout: 20_000 }),
      page.getByRole("button", { name: "Create opportunity" }).click()
    ]);
    browserCreatedId = new URL(page.url()).pathname.split("/").pop();
    const row = await serviceOpportunity(browserCreatedId);
    browserCreatedStable = row.stable_opportunity_key;
    await visible(page, "Finish opportunity qualification");
  });

  await br("BR-005", "Trigger and verify a real rendered duplicate warning.", "bd-a", "business_development_lead", browserCreatedStable, "/pipeline/new", async () => {
    await page.goto(`${baseUrl}/pipeline/new`, { waitUntil: "domcontentloaded" });
    await fillIntake(page, `BR Closure Intake`, "Duplicate browser road");
    await Promise.all([
      page.waitForURL(/\/pipeline\/[0-9a-f-]+/i, { timeout: 20_000 }),
      page.getByRole("button", { name: "Create opportunity" }).click()
    ]);
    const firstCount = await countOpportunityName("BR Closure Intake");
    await page.goto(`${baseUrl}/pipeline/new`, { waitUntil: "domcontentloaded" });
    await fillIntake(page, `BR Closure Intake`, "Duplicate browser road");
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Create opportunity" }).click()
    ]);
    await page.waitForTimeout(400);
    const text = await page.locator("body").innerText();
    const countAfterWarning = await countOpportunityName("BR Closure Intake");
    const warningComplete = /potential duplicate|duplicate exists|matching/i.test(text)
      && /BR Closure Intake/i.test(text)
      && /Bluegrass Data Centers/i.test(text)
      && /Duplicate browser road/i.test(text)
      && /Return to intake/i.test(text)
      && /Create as separate opportunity/i.test(text)
      && countAfterWarning === firstCount;
    if (!warningComplete) {
      productDefects.push({
        id: "P1-01A-DUPLICATE-WARNING",
        failedAcceptanceIds: ["BR-005"],
        description: "Rendered duplicate flow does not identify the matching candidate and user choice before final creation."
      });
    }
    assert(warningComplete, "Product defect: duplicate warning is generic or redirects without complete candidate/choice proof.");
    await page.getByRole("link", { name: "Return to intake" }).click();
    await page.waitForURL(/\/pipeline\/new$/);
    const countAfterCancel = await countOpportunityName("BR Closure Intake");
    assert(countAfterCancel === firstCount, "return to intake created a duplicate record");
    await page.goto(`${baseUrl}/pipeline/new`, { waitUntil: "domcontentloaded" });
    await fillIntake(page, `BR Closure Intake`, "Duplicate browser road");
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Create opportunity" }).click()
    ]);
    await page.getByRole("button", { name: "Create as separate opportunity" }).click();
    await page.waitForURL(/\/pipeline\/[0-9a-f-]+/i, { timeout: 20_000 });
    const countAfterOverride = await countOpportunityName("BR Closure Intake");
    assert(countAfterOverride === firstCount + 1, "confirmed override did not create exactly one separate record");
  });

  await br("BR-006", "Confirm the created opportunity appears in the queue.", "bd-a", "business_development_lead", browserCreatedStable, "/pipeline", async () => {
    await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
    await visible(page, "BR Closure Intake");
  });

  await br("BR-007", "Open the canonical Opportunity Workbench.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    await page.goto(`${baseUrl}/pipeline/${browserCreatedId}`, { waitUntil: "networkidle" });
    await visible(page, "Finish opportunity qualification");
  });

  await br("BR-008", "Complete any remaining intake information through the workbench.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    const draftOwner = await userIdFor(service, "bd-a@foundation0a.local");
    const draft = await insertOpportunityFixture("BR Draft Intake", { intakeComplete: false, ownerUserId: draftOwner });
    await page.goto(`${baseUrl}/pipeline/${draft.id}`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    const hasIntakeEdit = /Opportunity name|Customer \/ GC|Scope summary/i.test(body) && /Save intake|Complete intake|Update opportunity/i.test(body);
    if (!hasIntakeEdit) {
      productDefects.push({
        id: "P1-01A-WORKBENCH-INTAKE-EDIT",
        failedAcceptanceIds: ["BR-008"],
        description: "Opportunity Workbench does not provide a rendered path to complete remaining intake information."
      });
    }
    assert(hasIntakeEdit, "Product defect: workbench has no intake completion/edit surface.");
    await page.getByLabel("Scope summary").fill("Completed draft intake through the Opportunity Workbench.");
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Complete intake" }).click()
    ]);
    await visible(page, "Finish opportunity qualification");
    browserCreatedId = new URL(page.url()).pathname.split("/").pop();
    browserCreatedStable = (await serviceOpportunity(browserCreatedId)).stable_opportunity_key;
  });

  await br("BR-009", "Complete qualification through the rendered application.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    await fillQualification(page);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Save qualification" }).click()
    ]);
    await visible(page, "ready for decision");
  });

  await br("BR-010", "Attach managed evidence when the acceptance contract requires it.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    const body = await page.locator("body").innerText();
    const hasEvidenceUi = /evidence|document|attachment|upload/i.test(body) && /Add|Attach|Upload/i.test(body);
    if (!hasEvidenceUi) {
      productDefects.push({
        id: "P1-01A-EVIDENCE-UI",
        failedAcceptanceIds: ["BR-010", "DB-027"],
        description: "P1-01A has no rendered managed-evidence attachment requirement before decision submission."
      });
    }
    assert(hasEvidenceUi, "Product defect: no managed evidence attachment surface exists for P1-01A.");
    await page.setInputFiles('input[name="decisionSupportDocument"]', {
      name: "decision-support.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("P1-01A closure browser evidence")
    });
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Attach decision support document" }).click()
    ]);
    await visible(page, "Decision support linked and clean");
  });

  await br("BR-011", "Submit the opportunity for decision.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Submit for decision" }).click()
    ]);
    await visible(page, "Qualification ready for decision");
  });

  await br("BR-012", "Verify the rendered decision-ready state says: Qualification ready for decision.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    const body = await page.locator("body").innerText();
    assert(/Qualification ready for decision/i.test(body), "Product defect: exact phrase 'Qualification ready for decision' is not rendered.");
  });

  await br("BR-013", "Verify no decision button or inert decision CTA exists.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    const body = await page.locator("body").innerText();
    assert(!/Record go decision|Record no-go|Award opportunity|Convert to project|Approve pursuit/i.test(body), "decision/award/project CTA rendered");
  });

  await br("BR-014", "Refresh the page and verify the same canonical state remains.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    await page.reload({ waitUntil: "networkidle" });
    await visible(page, "Qualification ready for decision");
  });

  await br("BR-015", "Restart the Next application server.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    nextServer.kill();
    await delay(1200);
    nextServer = startNext(port, baseEnv);
    await waitForServer(`${baseUrl}/api/health`, 90_000);
  });

  await br("BR-016", "Verify browser can reauthenticate or retain approved session and opportunity state remains.", "bd-a", "business_development_lead", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    await page.goto(`${baseUrl}/pipeline/${browserCreatedId}`, { waitUntil: "networkidle" });
    if (new URL(page.url()).pathname.includes("/auth/sign-in")) {
      await signInBrowser(page, baseUrl, "bd-a@foundation0a.local", `/pipeline/${browserCreatedId}`);
    }
    await visible(page, "Qualification ready for decision");
    nextRestartPersistence = true;
  });

  await br("BR-017", "Sign in as Read-only Auditor and verify read-only behavior.", "auditor-a", "read_only_auditor", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    const auditorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const auditorPage = await auditorContext.newPage();
    await signInBrowser(auditorPage, baseUrl, "auditor-a@foundation0a.local", `/pipeline/${browserCreatedId}`);
    const body = await auditorPage.locator("body").innerText();
    const mutation = await createOpportunity(clients.auditor, "BR Auditor Forbidden", "No access", { duplicateConfirmed: true });
    await auditorContext.close();
    const readOnlyVisible = /read-only|auditor/i.test(body);
    if (!readOnlyVisible) {
      productDefects.push({
        id: "P1-01A-AUDITOR-READONLY-VISUAL",
        failedAcceptanceIds: ["BR-017"],
        description: "Auditor can view/denial is enforced, but rendered state does not clearly identify read-only access."
      });
    }
    assert(/P1-01A Opportunity|Opportunity/i.test(body), "auditor could not view opportunity");
    assert(mutation.success === false && mutation.error === "forbidden", "auditor mutation succeeded");
    assert(readOnlyVisible, "Product defect: auditor view lacks clear read-only affordance.");
  });

  await br("BR-018", "Sign in as assigned Estimator and verify scoped access and permitted contribution.", "pm-a", "project_manager as estimator", null, "/pipeline/[opportunityId]", async () => {
    const estimatorOpp = await createOpportunity(clients.bd, "BR Estimator Assigned", "Estimator road", { duplicateConfirmed: true });
    const otherOpp = await createOpportunity(clients.bd, "BR Estimator Unassigned", "Other estimator road", { duplicateConfirmed: true });
    await assignEstimator(estimatorOpp.opportunity.id, estimatorOpp.opportunity.version);
    const estimatorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const estimatorPage = await estimatorContext.newPage();
    await signInBrowser(estimatorPage, baseUrl, "pm-a@foundation0a.local", `/pipeline/${estimatorOpp.opportunity.id}`);
    await visible(estimatorPage, "Finish opportunity qualification");
    await fillQualification(estimatorPage);
    await Promise.all([
      estimatorPage.waitForLoadState("domcontentloaded"),
      estimatorPage.getByRole("button", { name: "Save qualification" }).click()
    ]);
    await estimatorPage.goto(`${baseUrl}/pipeline/${otherOpp.opportunity.id}`, { waitUntil: "networkidle" });
    const deniedText = await estimatorPage.locator("body").innerText();
    await estimatorContext.close();
    const submitAllowed = await submitForDecision(clients.pm, estimatorOpp.opportunity.id, estimatorOpp.opportunity.version + 1);
    if (submitAllowed.success === true) {
      productDefects.push({
        id: "P1-01A-ESTIMATOR-SUBMIT-AUTHORITY",
        failedAcceptanceIds: ["BR-018"],
        description: "Assigned estimator can submit the opportunity for decision; acceptance expected contribution only unless explicitly permitted."
      });
    }
    assert(/Opportunity unavailable/i.test(deniedText), "estimator could access unassigned opportunity");
    assert(submitAllowed.success === false, "Product defect: estimator was able to submit for decision.");
  });

  await br("BR-019", "Sign in as unassigned non-elevated user and verify opportunity access is denied.", "field-a", "field_supervisor", browserCreatedStable, `/pipeline/${browserCreatedId}`, async () => {
    const fieldContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const fieldPage = await fieldContext.newPage();
    await signInBrowser(fieldPage, baseUrl, "field-a@foundation0a.local", `/pipeline/${browserCreatedId}`);
    const body = await fieldPage.locator("body").innerText();
    await fieldContext.close();
    assert(/Opportunity unavailable/i.test(body), "unassigned non-elevated user saw opportunity");
  });

  await br("BR-020", "Run in true production runtime and verify Pipeline remains contained and seed-free.", "bd-a", "business_development_lead", null, "/pipeline", async () => {
    nextServer.kill();
    await delay(1200);
    const prodEnv = { ...baseEnv, RYBEXOS_RUNTIME_MODE: "production" };
    const prodPort = await freePort();
    const prodUrl = `http://127.0.0.1:${prodPort}`;
    nextServer = startNext(prodPort, prodEnv);
    await waitForServer(`${prodUrl}/api/health`, 90_000);
    const prodContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const prodPage = await prodContext.newPage();
    await signInBrowser(prodPage, prodUrl, "bd-a@foundation0a.local", "/pipeline");
    const body = await prodPage.locator("body").innerText();
    await prodContext.close();
    assert(/unavailable in production mode/i.test(body), "Pipeline was not production-contained");
    assert(!/BR Closure Intake|DB Closure Primary|Lake Norman Underground/i.test(body), "opportunity/seed data rendered in production-contained Pipeline");
    productionContainmentVerified = true;
  });

  await context.close();
}

async function db(id, title, actorFixture, role, stableKey, action, authenticated, rls, fn) {
  const record = baseRecord(id, title, actorFixture, role, stableKey, action, authenticated, rls);
  try {
    await fn();
    record.result = "passed";
  } catch (error) {
    record.result = "failed";
    record.failureMessage = redact(error instanceof Error ? error.message : String(error));
    if (/Product defect/i.test(record.failureMessage)) {
      productDefects.push({ failedAcceptanceIds: [id], description: record.failureMessage });
    }
  }
  dbResults.push(record);
}

async function br(id, title, actorFixture, role, stableKey, route, fn) {
  const record = baseRecord(id, title, actorFixture, role, stableKey, route, true, true);
  try {
    await fn();
    record.result = "passed";
  } catch (error) {
    record.result = "failed";
    record.failureMessage = redact(error instanceof Error ? error.message : String(error));
    if (/Product defect/i.test(record.failureMessage)) {
      productDefects.push({ failedAcceptanceIds: [id], description: record.failureMessage });
    }
  }
  browserResults.push(record);
}

function baseRecord(id, title, actorFixture, role, stableKey, action, authenticated, rls) {
  return {
    acceptanceId: id,
    title,
    actorFixtureKey: actorFixture,
    canonicalRole: role,
    workspaceFixtureKey: actorFixture === "user-b" ? "Workspace B" : "Workspace A",
    opportunityStableKey: stableKey,
    actionPerformed: action,
    assertionsPerformed: [],
    rlsExercised: rls,
    realAuthenticatedClientUsed: authenticated,
    result: "failed",
    failureMessage: null,
    evidenceReference: id.startsWith("DB") ? dbPath : browserPath
  };
}

async function createOpportunity(client, name, location, overrides = {}) {
  const result = await client.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: overrides.customerGc ?? "Bluegrass Data Centers",
      projectType: overrides.projectType ?? "Underground conduit",
      location,
      scopeSummary: overrides.scopeSummary ?? "OSP conduit and access coordination package for hyperscale data center service.",
      estimatedValue: overrides.estimatedValue ?? "385000",
      anticipatedStart: overrides.anticipatedStart ?? "2026-08-10",
      bidDueDate: overrides.bidDueDate ?? "2026-07-15",
      duplicateConfirmed: overrides.duplicateConfirmed ?? false
    },
    p_command_id: overrides.commandId ?? commandId(`p1-closure-create-${hash(name + location)}`),
    p_correlation_id: "p1-01a-acceptance-closure"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function updateOpportunity(client, id, payload, version, cmd = commandId("p1-closure-update")) {
  const result = await client.rpc("update_opportunity_v1", {
    p_opportunity_id: id,
    p_payload: payload,
    p_command_id: cmd,
    p_expected_version: version,
    p_correlation_id: "p1-01a-acceptance-closure"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function saveQualification(client, id, version, payload, cmd = commandId("p1-closure-qualification")) {
  const result = await client.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: id,
    p_payload: payload,
    p_command_id: cmd,
    p_expected_version: version,
    p_correlation_id: "p1-01a-acceptance-closure"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function submitForDecision(client, id, version, cmd = commandId("p1-closure-submit")) {
  const result = await client.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: id,
    p_command_id: cmd,
    p_expected_version: version,
    p_correlation_id: "p1-01a-acceptance-closure"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function attachDecisionSupportEvidence(client, id, version, cmd = commandId("p1-closure-evidence")) {
  const result = await client.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: id,
    p_payload: {
      fileName: "decision-support.txt",
      mimeType: "text/plain",
      sizeBytes: 48,
      checksumSha256: `p1-01a-closure-${hash(id + String(version))}`
    },
    p_command_id: cmd,
    p_expected_version: version,
    p_correlation_id: "p1-01a-acceptance-closure"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function manageAssignment(client, opportunityId, userId, type, status, version) {
  const result = await client.rpc("manage_opportunity_assignment_v1", {
    p_opportunity_id: opportunityId,
    p_user_id: userId,
    p_assignment_type: type,
    p_status: status,
    p_command_id: commandId("p1-closure-assignment"),
    p_expected_version: version,
    p_correlation_id: "p1-01a-acceptance-closure"
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function getOpportunity(client, id) {
  const result = await client.rpc("p1_01a_get_opportunity_v1", { p_opportunity_id: id });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function assignEstimator(opportunityId, version) {
  const pmUser = await userIdFor(service, "pm-a@foundation0a.local");
  return manageAssignment(clients.bd, opportunityId, pmUser, "estimator", "active", version);
}

async function insertOpportunityFixture(name, { intakeComplete, ownerUserId }) {
  const bdAuth = await userIdFor(service, "bd-a@foundation0a.local");
  const bdProfile = await profileIdFor(bdAuth);
  const id = randomUUID();
  const stable = `p1-closure-${hash(name).slice(0, 12)}`;
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
    scope_summary: "Acceptance closure fixture.",
    estimated_value: 385000,
    bid_due_date: "2026-07-15",
    anticipated_start: "2026-08-10",
    owner_user_id: ownerUserId,
    lifecycle_status: intakeComplete ? "qualifying" : "draft",
    intake_complete: intakeComplete,
    qualification_complete: false,
    decision_readiness_status: "not_ready",
    duplicate_fingerprint: stable,
    status: intakeComplete ? "under_review" : "new_intake",
    d5o_phase: "discover",
    version: 1,
    created_by: bdProfile,
    updated_by: bdProfile
  };
  const { data, error } = await service.from("opportunities").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  if (ownerUserId) {
    await service.from("opportunity_assignments").insert({
      workspace_id: ids.workspaceA,
      opportunity_id: id,
      user_id: ownerUserId,
      assignment_type: "owner",
      status: "active",
      created_by: bdAuth
    });
  }
  return data;
}

async function cleanupClosureFixtures() {
  const { data } = await service
    .from("opportunities")
    .select("id")
    .eq("workspace_id", ids.workspaceA)
    .or("name.ilike.DB %,name.ilike.BR %,stable_opportunity_key.ilike.p1-closure-%");
  const idsToDelete = Array.isArray(data) ? data.map((row) => row.id).filter(Boolean) : [];
  if (idsToDelete.length > 0) {
    await service.from("opportunity_qualifications").delete().in("opportunity_id", idsToDelete);
    await service.from("opportunity_assignments").delete().in("opportunity_id", idsToDelete);
    await service.from("opportunities").delete().in("id", idsToDelete);
  }
}

async function signIn(email) {
  const client = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user) throw new Error(`Sign in failed for ${email}: ${result.error?.message ?? "missing user"}`);
  return client;
}

async function signInBrowser(page, baseUrl, email, next) {
  await page.goto(`${baseUrl}/auth/sign-in?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.waitForTimeout(700);
}

async function fillIntake(page, name, location) {
  await page.getByLabel("Opportunity name").fill(name);
  await page.getByLabel("Customer / GC").fill("Bluegrass Data Centers");
  await page.getByLabel("Project type").fill("Underground conduit");
  await page.getByLabel("Location").fill(location);
  await page.getByLabel("Scope summary").fill("OSP conduit, access coordination, traffic control, and restoration scope.");
  await page.getByLabel("Estimated value").fill("385000");
  await page.getByLabel("Anticipated start").fill("2026-08-10");
  await page.getByLabel("Bid due date").fill("2026-07-15");
}

async function fillQualification(page) {
  for (const select of await page.locator("select").all()) {
    const name = await select.getAttribute("name");
    await select.selectOption(name === "recommendation" ? "pursue_with_mitigations" : "acceptable");
  }
  await page.getByLabel("Risk summary").fill("Access, utility locate, schedule, and commercial terms require pursuit controls.");
  await page.getByLabel("Assumptions").fill("Qualification assumes the current access plan and drawing set remain valid.");
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

function partialQualification() {
  return { ...completeQualification(), scopeClarity: "", riskSummary: "Partial qualification fixture." };
}

async function serviceOpportunity(id) {
  const { data, error } = await service.from("opportunities").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

async function serviceSnapshot(id) {
  const opportunity = await serviceOpportunity(id);
  const assignments = await service.from("opportunity_assignments").select("*").eq("opportunity_id", id);
  const qualifications = await service.from("opportunity_qualifications").select("*").eq("opportunity_id", id);
  return {
    opportunityName: opportunity.name,
    opportunityVersion: opportunity.version,
    assignments: assignments.data?.length ?? 0,
    qualifications: qualifications.data?.length ?? 0
  };
}

async function allCounts() {
  return {
    opportunities: await countRows("opportunities", [["workspace_id", ids.workspaceA]]),
    assignments: await countRows("opportunity_assignments", [["workspace_id", ids.workspaceA]]),
    qualifications: await countRows("opportunity_qualifications", [["workspace_id", ids.workspaceA]]),
    audit: await countRows("audit_events", [["workspace_id", ids.workspaceA], ["entity_type", "opportunity"]]),
    events: await countRows("domain_events", [["workspace_id", ids.workspaceA], ["aggregate_type", "opportunity"]])
  };
}

async function countRows(table, filters = []) {
  let query = service.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countOpportunityName(name) {
  return countRows("opportunities", [["workspace_id", ids.workspaceA], ["name", name]]);
}

async function eventCounts(id) {
  return {
    audit: await countRows("audit_events", [["entity_id", id]]),
    events: await countRows("domain_events", [["aggregate_id", id]])
  };
}

async function actionsFor(table, id, column = "action") {
  const { data, error } = await service.from(table).select(column).eq(table === "audit_events" ? "entity_id" : "aggregate_id", id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row[column]).filter(Boolean);
}

async function hasOpportunityDecision(opportunityId) {
  const { count, error } = await service
    .from("opportunity_decisions")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId);
  if (error?.code === "42P01" || /does not exist/i.test(error?.message ?? "")) return false;
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function profileIdFor(authUserId) {
  const { data, error } = await service.from("user_profiles").select("id").eq("auth_user_id", authUserId).single();
  if (error || !data?.id) throw new Error(error?.message ?? "profile missing");
  return data.id;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function assertCountsEqual(a, b, message) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${message}: ${JSON.stringify({ before: a, after: b })}`);
}

async function visible(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
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
  throw new Error(`Timed out waiting for ${url}`);
}

function freePort() {
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

function localOpportunityArtifacts() {
  const localRoot = join(root, ".rybexos-local");
  if (!existsSync(localRoot)) return [];
  const result = spawnSync("cmd.exe", ["/c", "dir", "/s", "/b", ".rybexos-local\\*opportun*"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 5
  });
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean).sort() : [];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: withDockerPath(options.env ?? process.env, options.includeDockerPath),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 80
  });
  commandResults.push({
    command: options.label ?? `${command} ${args.join(" ")}`,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stderr: redact(result.stderr ?? result.error?.message ?? "")
  });
  if (!options.suppressOutput) {
    if (result.stdout) process.stdout.write(redact(result.stdout));
    if (result.stderr) process.stderr.write(redact(result.stderr));
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${options.label ?? command} failed with exit code ${result.status}: ${redact(result.stderr || result.stdout || "")}`);
  }
  return result;
}

function runCapture(command, args, options = {}) {
  return run(command, args, { ...options, suppressOutput: true });
}

function withDockerPath(env, include) {
  if (!include) return env;
  return {
    ...env,
    Path: `${dockerBin};${env.Path ?? env.PATH ?? ""}`,
    PATH: `${dockerBin};${env.PATH ?? env.Path ?? ""}`
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
  if (!apiUrl || !publishableKey || !serviceKey) throw new Error("Unable to map local Supabase credentials.");
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

function summarizeDocker(output) {
  const versions = [...output.matchAll(/Version:\s+([0-9.]+)/g)].map((m) => m[1]);
  return { client: versions[0] ?? "unknown", server: versions[1] ?? "unknown" };
}

function writeEvidence(extra = {}) {
  const dbPassed = dbResults.filter((r) => r.result === "passed").length;
  const dbFailed = dbResults.filter((r) => r.result === "failed").length;
  const browserPassed = browserResults.filter((r) => r.result === "passed").length;
  const browserFailed = browserResults.filter((r) => r.result === "failed").length;
  const verdict = dbPassed === 40 && dbFailed === 0 && browserPassed === 20 && browserFailed === 0 && productDefects.length === 0
    ? "P1-01A READY FOR HUMAN VISUAL ACCEPTANCE"
    : `P1-01A BLOCKED - ${[...dbResults, ...browserResults].filter((r) => r.result === "failed").map((r) => r.acceptanceId).join(", ") || "infrastructure failure"}`;
  writeFileSync(dbPath, `${JSON.stringify({ runTimestamp: startedAt, requiredCases: 40, passedCases: dbPassed, failedCases: dbFailed, skippedCases: 0, results: dbResults }, null, 2)}\n`);
  writeFileSync(browserPath, `${JSON.stringify({ runTimestamp: startedAt, requiredCases: 20, passedCases: browserPassed, failedCases: browserFailed, skippedCases: 0, results: browserResults }, null, 2)}\n`);
  writeFileSync(summaryPath, `${JSON.stringify({
    runTimestamp: startedAt,
    requiredDatabaseCases: 40,
    passedDatabaseCases: dbPassed,
    failedDatabaseCases: dbFailed,
    skippedDatabaseCases: 0,
    requiredBrowserCases: 20,
    passedBrowserCases: browserPassed,
    failedBrowserCases: browserFailed,
    skippedBrowserCases: 0,
    productDefectsDiscovered: dedupeProductDefects(productDefects),
    infrastructureFailures: extra.failure ? [extra.failure] : [],
    gateVerdict: verdict,
    migrationVersion: "0011_p1_01a_opportunity_intake_qualification.sql",
    nextBuildMode: "next build + next start",
    supabaseMode: "local Docker Supabase",
    dockerStatus: extra.dockerVersion ?? "checked",
    commandResults,
    ...extra
  }, null, 2)}\n`);
}

function dedupeProductDefects(defects) {
  const seen = new Set();
  return defects.filter((defect) => {
    const key = defect.id ?? defect.description;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hash(value) {
  return createHash("sha1").update(String(value)).digest("hex");
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}
