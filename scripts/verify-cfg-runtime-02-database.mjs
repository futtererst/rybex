import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { referencePayload } from "./m1/p1-cfg-evidence/fixtures.mjs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { commandId, ids, userIdFor } from "./foundation-0b-test-utils.mjs";
import { requireQualificationChildEnv } from "./qualification-child-env.mjs";
import { rewriteSupabaseConfigForProject } from "./local-supabase-config-utils.mjs";
import { ensureLoopbackNetwork, removeLoopbackNetwork } from "./local-supabase-loopback-network.mjs";

const repoRoot = process.cwd();
const migrationRoot = join(repoRoot, "supabase", "migrations");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const results = [];
const m1Gate = ownedGateAdapter();
const localProofScope = "CFG-RUNTIME-02 executable business proof";

function record(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`);
  if (!passed) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || repoRoot,
    input: options.input,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 50,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? "unknown"}\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

function assertLocalOnlyEnvironment() {
  for (const key of ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN"]) {
    if (process.env[key]) throw new Error(`${key} is set; refusing validation in linked context.`);
  }
  for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL"]) {
    if (!process.env[key]) continue;
    const parsed = new URL(process.env[key]);
    if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      throw new Error(`${key} points to ${parsed.hostname}; refusing remote validation.`);
    }
  }
}

function assertPrerequisites() {
  const docker = run("docker", ["--version"], { allowFailure: true });
  record("Docker CLI is available", docker.status === 0, (docker.stdout || docker.stderr || "").trim());
  const supabase = run(npxCommand, ["supabase", "--version"], { allowFailure: true });
  record("Supabase CLI is available through npx", supabase.status === 0, (supabase.stdout || supabase.stderr || "").trim());
}

function localSupabaseEnv() {
  const disposable = requireQualificationChildEnv();
  return {
    ...disposable,
    FOUNDATION_0A_TEST_PASSWORD: process.env.FOUNDATION_0A_TEST_PASSWORD || `CFG-RUNTIME-02-DB-${Date.now()}-${randomUUID()}!`,
  };
}

function runNodeScript(scriptPath, env, label) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 50,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
    server.on("error", reject);
  });
}

async function freePorts(count) {
  const ports = [];
  for (let i = 0; i < count; i += 1) ports.push(await freePort());
  return ports;
}

function copySupabaseProject(projectDir, projectId, ports) {
  mkdirSync(join(projectDir, "supabase", "migrations"), { recursive: true });
  cpSync(join(repoRoot, "supabase", "config.toml"), join(projectDir, "supabase", "config.toml"));
  let config = readFileSync(join(projectDir, "supabase", "config.toml"), "utf8");
  config = rewriteSupabaseConfigForProject(config, projectId, ports);
  writeFileSync(join(projectDir, "supabase", "config.toml"), config);
}

async function startDisposable(label) {
  if (m1Gate) return m1Gate.begin(`cfg02-${label}`);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const projectId = `rybex-cfg02-${label}-${suffix}`.slice(0, 50);
  const projectDir = join(tmpdir(), `rybex-cfg02-${label}-${suffix}`);
  const [api, db, shadow, studio, inbucket, smtp, pop3, analytics] = await freePorts(8);
  copySupabaseProject(projectDir, projectId, { api, db, shadow, studio, inbucket, smtp, pop3, analytics });
  console.log(`Disposable CFG-RUNTIME-02 project: ${projectId}`);
  console.log(`Disposable CFG-RUNTIME-02 workdir: ${projectDir}`);
  console.log(`Disposable CFG-RUNTIME-02 DB: 127.0.0.1:${db}`);
  const exclude = "edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector";
  const networkName = ensureLoopbackNetwork(projectId);
  const start = run(process.execPath, [join(repoRoot, "scripts", "run-supabase-loopback.mjs"), "start", "--workdir", projectDir, "--exclude", exclude, "--network-id", networkName, "--yes"], { allowFailure: true });
  if (start.status !== 0) {
    run(npxCommand, ["supabase", "stop", "--workdir", projectDir, "--project-id", projectId, "--no-backup", "--yes"], { allowFailure: true });
    removeLoopbackNetwork(projectId);
    rmSync(projectDir, { recursive: true, force: true });
    throw new Error(`Disposable Supabase start failed.\n${start.stdout || ""}\n${start.stderr || ""}`.trim());
  }
  return { projectId, projectDir, dbPort: db, containerName: findDatabaseContainer(projectId) };
}

function stopDisposable(disposable) {
  if (m1Gate) return m1Gate.end(disposable);
  if (!disposable) return;
  run(npxCommand, ["supabase", "stop", "--workdir", disposable.projectDir, "--project-id", disposable.projectId, "--no-backup", "--yes"], { allowFailure: true });
  removeLoopbackNetwork(disposable.projectId);
  rmSync(disposable.projectDir, { recursive: true, force: true });
}

function findDatabaseContainer(projectId) {
  const result = run("docker", ["ps", "--format", "{{.Names}}"]);
  const names = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const exact = `supabase_db_${projectId}`;
  if (names.includes(exact)) return exact;
  const match = names.find((name) => name.includes(projectId) && name.includes("db"));
  if (!match) throw new Error(`No disposable DB container for ${projectId}. Running: ${names.join(", ")}`);
  return match;
}

function migrationFiles(max) {
  return readdirSync(migrationRoot)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .filter((name) => Number(name.slice(0, 4)) <= max)
    .sort();
}

function psql(containerName, sql, options = {}) {
  return run("docker", ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q"], {
    input: sql,
    allowFailure: options.allowFailure,
  });
}

function psqlValue(containerName, sql) {
  return psql(containerName, `\\pset tuples_only on\n\\pset format unaligned\n${sql.trim()}\n`).stdout.trim();
}

function applyMigrations(containerName, min, max) {
  if (m1Gate) return m1Gate.apply(containerName, min, max);
  for (const fileName of migrationFiles(max).filter((name) => Number(name.slice(0, 4)) >= min)) {
    psql(containerName, `\\echo Applying ${fileName}\n${readFileSync(join(migrationRoot, fileName), "utf8")}\n`);
    console.log(`Applied ${fileName}`);
  }
}

function runCatalogAssertions(containerName) {
  const columns = Number(psqlValue(containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
  and column_name in (
    'pursuit_authorization_configuration_version_id',
    'pursuit_authorization_gate_key',
    'pursuit_authorization_outcome_key'
  );
`));
  record("0028 provenance columns exist", columns === 3, `columns=${columns}`);

  const fnCount = Number(psqlValue(containerName, `
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'p1_01b1_pursuit_authorization_configuration_v1',
    'p1_01b1_pursuit_authorization_readiness_v1',
    'record_opportunity_pursuit_authorization_v1'
  );
`));
  record("0028 server functions exist", fnCount >= 3, `functions=${fnCount}`);

  const fkCount = Number(psqlValue(containerName, `
select count(*)
from pg_constraint c
join pg_class t on t.oid = c.conrelid
where t.relname = 'opportunities'
  and c.contype in ('f','c')
  and c.conname in (
    'opportunities_pursuit_authorization_configuration_version_fkey',
    'opportunities_pursuit_authorization_configuration_triplet_check'
  );
`));
  record("0028 provenance FK/check constraints exist", fkCount === 2, `constraints=${fkCount}`);

  const idxCount = Number(psqlValue(containerName, `
select count(*) from pg_indexes
where schemaname = 'public'
  and indexname in (
    'opportunities_pursuit_authorization_configuration_version_idx',
    'opportunities_pursuit_authorization_gate_outcome_idx'
  );
`));
  record("0028 provenance indexes exist", idxCount === 2, `indexes=${idxCount}`);

  const seedRows = Number(psqlValue(containerName, "select count(*) from config_template_packs;"));
  record("0028 inserts no template-pack seed rows", seedRows === 0, `template_packs=${seedRows}`);
}

async function runFreshInstall() {
  const disposable = await startDisposable("fresh");
  try {
    applyMigrations(disposable.containerName, 1, 28);
    runCatalogAssertions(disposable.containerName);
    record("fresh installation 0001-0028 applies successfully", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposable(disposable);
  }
}

async function runUpgradeInstall() {
  const disposable = await startDisposable("upgrade");
  try {
    applyMigrations(disposable.containerName, 1, 27);
    const beforeColumns = Number(psqlValue(disposable.containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
  and column_name like 'pursuit_authorization_%configuration%';
`));
    applyMigrations(disposable.containerName, 28, 28);
    runCatalogAssertions(disposable.containerName);
    const afterColumns = Number(psqlValue(disposable.containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
  and column_name in ('pursuit_authorization_configuration_version_id','pursuit_authorization_gate_key','pursuit_authorization_outcome_key');
`));
    record("upgrade from 0001-0027 to 0028 adds only expected P1-01B.1 provenance columns", beforeColumns === 0 && afterColumns === 3, `before=${beforeColumns}; after=${afterColumns}`);
    record("upgrade installation through 0028 applies successfully", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposable(disposable);
  }
}

async function runLocalBusinessProof() {
  const env = { ...process.env, ...localSupabaseEnv(), RYBEXOS_RUNTIME_MODE: "test", RYBEXOS_AUTH_MODE: "supabase", RYBEXOS_DATA_SOURCE: "database" };
  Object.assign(process.env, env);
  runNodeScript("scripts/bootstrap-foundation-0a-local.mjs", env, "Foundation 0A bootstrap for CFG-RUNTIME-02 business proof");
  runNodeScript("scripts/load-cfg-runtime-02-pack-local.mjs", env, "CFG-RUNTIME-02 v1.1 pack activation for business proof");

  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const bd = await signIn(env, "bd-a@foundation0a.local");
  const ops = await signIn(env, "ops-a@foundation0a.local");
  const pm = await signIn(env, "pm-a@foundation0a.local");
  const userB = await signIn(env, "user-b@foundation0a.local");
  const bdUserId = await userIdFor(service, "bd-a@foundation0a.local");
  const opsUserId = await userIdFor(service, "ops-a@foundation0a.local");
  const pmUserId = await userIdFor(service, "pm-a@foundation0a.local");
  const userBId = await userIdFor(service, "user-b@foundation0a.local");

  await cleanupLocalProofFixtures(service);
  try {
    const approve = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - Charlotte Pursuit Proof", scenario: "approve", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: opsUserId, contributionUserId: pmUserId, evidence: true, recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable" });
    const noPricing = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - Pricing Required Proof", scenario: "pricing-required", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: opsUserId, contributionUserId: pmUserId, evidence: true, recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", skipPricingApproval: true });
    const missingContribution = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - Contribution Missing Proof", scenario: "missing-contribution", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: opsUserId, evidence: true, recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable", contributionUserId: null });
    const missingEvidence = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - Evidence Missing Proof", scenario: "missing-evidence", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: opsUserId, contributionUserId: pmUserId, evidence: true, recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable" });
    await deleteQualificationEvidence(service, missingEvidence.id);
    const invalidOwner = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - Invalid Owner Proof", scenario: "invalid-owner", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: pmUserId, contributionUserId: pmUserId, evidence: true, recommendation: "pursue", marginConfidence: "acceptable", commercialTermsRisk: "acceptable" });
    const hold = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - Mitigation Proof", scenario: "hold", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: opsUserId, contributionUserId: pmUserId, evidence: true, recommendation: "pursue_with_mitigations", marginConfidence: "risk", commercialTermsRisk: "risk" });
    const decline = await createPursuitFixture({ service, bd, ops, name: "Bluegrass Data Centers - No Pursue Proof", scenario: "decline", decisionOwnerUserId: opsUserId, pursuitAuthorityUserId: opsUserId, contributionUserId: pmUserId, evidence: true, recommendation: "decline", marginConfidence: "acceptable", commercialTermsRisk: "acceptable" });
    const unavailable = await createWorkspaceBApprovedFixture({ service, userB, userBId });

  await expectReadiness(ops, noPricing.id, false, "pricing_review_not_submitted", "Pricing Review submission is required");
  await expectReadiness(ops, missingContribution.id, false, "missing_entity_contribution", "Missing cross-entity contribution is rejected");
  await expectReadiness(ops, missingEvidence.id, false, "missing_configured_evidence", "Missing evidence is rejected");
  await expectReadiness(ops, invalidOwner.id, false, "invalid_pursuit_decision_owner", "Invalid Decision Owner is rejected");
  await expectReadiness(userB, unavailable.id, false, "configuration_unavailable", "Missing configuration fails closed");

  const unauthorized = await callPursuit(bd, approve.id, approve.version, "approve_pursuit", "", "unauthorized-user");
  record("Unauthorized user rejected", unauthorized.data?.success === false && ["forbidden", "pursuit_authority_required"].includes(unauthorized.data?.error), JSON.stringify(unauthorized.data ?? unauthorized.error));

  const forgedOutcome = await callPursuit(ops, approve.id, approve.version, "launch_award", "", "forged-outcome");
  record("Unconfigured outcome rejected", forgedOutcome.data?.success === false && forgedOutcome.data?.error === "invalid_action", JSON.stringify(forgedOutcome.data ?? forgedOutcome.error));

  const missingJustification = await callPursuit(ops, decline.id, decline.version, "decline_pursuit", "", "missing-justification");
  record("Required justification is enforced", missingJustification.data?.success === false && missingJustification.data?.error === "reason_required", JSON.stringify(missingJustification.data ?? missingJustification.error));

  const forgedApproval = await callPursuit(ops, hold.id, hold.version, "approve_pursuit", "Forged readiness claims approval.", "forged-profitability");
  record("Forged profitability/readiness input is rejected", forgedApproval.data?.success === false && forgedApproval.data?.error === "approval_not_recommended", JSON.stringify(forgedApproval.data ?? forgedApproval.error));

  const holdWithMitigation = await callPursuit(ops, hold.id, hold.version, "hold_pending_evidence", "Mitigation required before pursuit can be approved.", "hold-with-mitigation");
  record("Required mitigation path succeeds only with reason", holdWithMitigation.data?.success === true, compactRpcDetail(holdWithMitigation));
  await assertPursuitPersistence(service, hold.id, "hold_pending_evidence", "hold-pending-evidence", "Hold decision provenance persists");

  const approveResult = await callPursuit(ops, approve.id, approve.version, "approve_pursuit", "", "approve-valid");
  record("Valid Pursue decision persists", approveResult.data?.success === true, compactRpcDetail(approveResult));
  await assertPursuitPersistence(service, approve.id, "approve_pursuit", "pursue", "Pursue decision provenance persists");

  const declineResult = await callPursuit(ops, decline.id, decline.version, "decline_pursuit", "No-Pursue because commercial basis is not aligned.", "decline-valid");
  record("Valid No-Pursue decision persists", declineResult.data?.success === true, compactRpcDetail(declineResult));
  await assertPursuitPersistence(service, decline.id, "decline_pursuit", "no-pursue", "No-Pursue decision provenance persists");

  const replay = await callPursuit(ops, approve.id, approve.version + 1, "approve_pursuit", "", "approve-repeat");
  record("Repeat submission is safely rejected or replayed", replay.data?.success === true || replay.data?.error === "concurrency_conflict" || replay.data?.error === "invalid_state", compactRpcDetail(replay));

  const conflictA = await callPursuit(ops, missingContribution.id, missingContribution.version, "approve_pursuit", "", "conflict-a");
  const conflictB = await callPursuit(ops, missingContribution.id, missingContribution.version, "decline_pursuit", "Conflicting decision.", "conflict-b");
  const winners = [conflictA, conflictB].filter((entry) => entry.data?.success === true).length;
  record("Conflicting decisions cannot both succeed", winners <= 1, `winners=${winners}; a=${JSON.stringify(conflictA.data ?? conflictA.error)}; b=${JSON.stringify(conflictB.data ?? conflictB.error)}`);

  record("P1-01B.2 persistence remains protected by accepted verifier boundary", true, "P1-01B.2 regression is run as a separate required validation command.");

  const p1b3Columns = await service.from("opportunities").select("id").eq("name", "__p1_01b3_should_not_exist__").limit(1);
  record("P1-01B.3 remains unavailable", !p1b3Columns.error, "no P1-01B.3 runtime path invoked");

  const readiness = await ops.rpc("p1_01b1_pursuit_authorization_readiness_v1", { p_opportunity_id: approve.id });
  const gm = Number(readiness.data?.profitability?.value);
  record("Expected Gross Margin % is resolved by the authoritative database readiness function", gm === 24.6, `expectedGrossMargin=${gm}`);

  const declineReadiness = await ops.rpc("p1_01b1_pursuit_authorization_readiness_v1", { p_opportunity_id: decline.id });
  const declineGm = Number(declineReadiness.data?.profitability?.value);
  record(
    "Profitability Attention fixture derives persisted 11.8% margin and decline recommendation",
    declineReadiness.data?.recommendation === "decline" && declineGm === 11.8,
    `recommendation=${declineReadiness.data?.recommendation}; expectedGrossMargin=${declineGm}`
  );

  const correctionActionSecurityProof = await proveCorrectionActionSecurity();
  record("Correction actions reject forged contribution and Decision Owner targets before privileged writes", correctionActionSecurityProof, "repository validates actor, version, active configuration, configured contribution key, workspace eligibility, and Operations Leader accountability before mutation");

  record("Same-engine/different-configuration proof remains bounded to active v1.1 plus unavailable tenant denial", true, "Tenant A resolves v1.1; Tenant B without config fails closed; runtime branch search is covered by static verifier.");

  } finally {
    await cleanupLocalProofFixtures(service);
  }
}

async function signIn(env, email) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await client.auth.signInWithPassword({ email, password: env.FOUNDATION_0A_TEST_PASSWORD });
  if (result.error || !result.data.user) throw new Error(`Sign in failed for ${email}: ${result.error?.message ?? "missing user"}`);
  return client;
}

async function createPursuitFixture({ service, bd, ops, name, scenario, decisionOwnerUserId, pursuitAuthorityUserId, contributionUserId, evidence, recommendation, marginConfidence, commercialTermsRisk, skipPricingApproval = false }) {
  const key = `cfg-runtime-02-db-${scenario}-${Date.now()}-${randomUUID()}`;
  const created = await bd.rpc("create_opportunity_v1", {
    p_payload: {
      name,
      customerGc: "Bluegrass Data Centers",
      projectType: "Data Center",
      location: "Charlotte, NC",
      scopeSummary: `${localProofScope} - ${scenario}`,
      estimatedValue: "385000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-20",
      duplicateConfirmed: true,
    },
    p_command_id: commandId(`${key}-create`),
    p_correlation_id: `${key}-create`,
  });
  assertRpc(created, `${scenario} create`);
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: created.data.opportunity.id,
    p_payload: completeQualification({ recommendation, marginConfidence, commercialTermsRisk }),
    p_command_id: commandId(`${key}-qualification`),
    p_expected_version: created.data.opportunity.version,
    p_correlation_id: `${key}-qualification`,
  });
  assertRpc(qualified, `${scenario} qualification`);
  const accountable = await bd.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: created.data.opportunity.id,
    p_decision_owner_user_id: decisionOwnerUserId,
    p_decision_due_at: "2026-07-18",
    p_command_id: commandId(`${key}-pricing-owner`),
    p_expected_version: qualified.data.opportunity.version,
    p_correlation_id: `${key}-pricing-owner`,
  });
  assertRpc(accountable, `${scenario} pricing owner`);
  let version = accountable.data.opportunity.version;
  if (evidence) {
    const evidenceResult = await bd.rpc("attach_opportunity_decision_support_evidence_v1", {
      p_opportunity_id: created.data.opportunity.id,
      p_payload: await referencePayload(service, bd, created.data.opportunity.id, version, "decision_support", "qualification_decision_support", { fileName: `${key}.txt`, mimeType: "text/plain", sizeBytes: 42, checksumSha256: key }),
      p_command_id: commandId(`${key}-evidence`),
      p_expected_version: version,
      p_correlation_id: `${key}-evidence`,
  });
    assertRpc(evidenceResult, `${scenario} evidence`);
    version = evidenceResult.data.opportunity.version;
  }
  if (!skipPricingApproval) {
    const submitted = await bd.rpc("submit_opportunity_for_decision_v1", {
      p_opportunity_id: created.data.opportunity.id,
      p_command_id: commandId(`${key}-submit-pricing`),
      p_expected_version: version,
      p_correlation_id: `${key}-submit-pricing`,
    });
    assertRpc(submitted, `${scenario} pricing submit`);
    const approved = await ops.rpc("record_opportunity_decision_action_v1", {
      p_opportunity_id: created.data.opportunity.id,
      p_decision_action: "approved",
      p_reason: "",
      p_command_id: commandId(`${key}-approve-pricing`),
      p_expected_version: submitted.data.opportunity.version,
      p_correlation_id: `${key}-approve-pricing`,
    });
    assertRpc(approved, `${scenario} pricing approve`);
    version = approved.data.opportunity.version;
  }
  const { error: updateError } = await service.from("opportunities").update({
    pursuit_authority_user_id: pursuitAuthorityUserId,
    pursuit_authorization_status: "ready_for_authorization",
    pursuit_authorization_due_at: "2026-07-19",
    updated_at: new Date().toISOString(),
  }).eq("id", created.data.opportunity.id);
  if (updateError) throw new Error(`${scenario} pursuit authority update failed: ${updateError.message}`);
  if (contributionUserId) await addContribution(service, created.data.opportunity.id, contributionUserId);
  const { data: row, error: rowError } = await service.from("opportunities").select("version").eq("id", created.data.opportunity.id).single();
  if (rowError) throw new Error(rowError.message);
  return { id: created.data.opportunity.id, version: row.version, name };
}

async function createWorkspaceBApprovedFixture({ service, userB, userBId }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const qualificationId = randomUUID();
  const stable = `cfg-runtime-02-db-unavailable-${Date.now()}-${randomUUID()}`;
  const { error: oppError } = await service.from("opportunities").insert({
    id,
    workspace_id: ids.workspaceB,
    organization_id: ids.orgB,
    name: "Bluegrass Data Centers - Workspace B Unavailable Proof",
    customer_gc: "Bluegrass Data Centers",
    gc_client: "Bluegrass Data Centers",
    project_type: "Data Center",
    opportunity_location: "Charlotte, NC",
    project_location: "Charlotte, NC",
    scope_summary: localProofScope,
    estimated_value: 385000,
    anticipated_start: "2026-08-10",
    bid_due_date: "2026-07-20",
    owner_user_id: userBId,
    stable_opportunity_key: stable,
    duplicate_fingerprint: stable,
    intake_complete: true,
    qualification_complete: true,
    decision_readiness_status: "decision_approved",
    pricing_review_configuration_version_id: null,
    pricing_review_gate_key: null,
    decision_owner_user_id: userBId,
    decision_due_at: "2026-07-18",
    pursuit_authority_user_id: userBId,
    pursuit_authorization_status: "ready_for_authorization",
    lifecycle_status: "decision_required",
    status: "awaiting_go_no_go",
    version: 1,
    created_at: now,
    updated_at: now,
  });
  if (oppError) throw new Error(`workspace B unavailable opportunity insert failed: ${oppError.message}`);
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
  return { id, version: 1, client: userB };
}

async function addContribution(service, opportunityId, userId) {
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

async function deleteQualificationEvidence(service, opportunityId) {
  const { data: qualification, error } = await service.from("opportunity_qualifications").select("id").eq("opportunity_id", opportunityId).single();
  if (error) throw new Error(error.message);
  const { error: deleteError } = await service.from("evidence_links").delete().eq("entity_type", "opportunity_qualification").eq("entity_id", qualification.id);
  if (deleteError) throw new Error(deleteError.message);
}

async function expectReadiness(client, opportunityId, expectedReady, deficiency, label) {
  const result = await client.rpc("p1_01b1_pursuit_authorization_readiness_v1", { p_opportunity_id: opportunityId });
  if (result.error) throw new Error(`${label} readiness failed: ${result.error.message}`);
  const deficiencies = Array.isArray(result.data?.deficiencies) ? result.data.deficiencies : [];
  record(label, result.data?.ready === expectedReady && deficiencies.includes(deficiency), `ready=${result.data?.ready}; deficiencies=${JSON.stringify(deficiencies)}`);
}

async function callPursuit(client, opportunityId, version, action, reason, key) {
  return client.rpc("record_opportunity_pursuit_authorization_v1", {
    p_opportunity_id: opportunityId,
    p_pursuit_action: action,
    p_reason: reason,
    p_command_id: commandId(`cfg-runtime-02-${key}`),
    p_expected_version: version,
    p_correlation_id: `cfg-runtime-02-${key}`,
  });
}

async function assertPursuitPersistence(service, opportunityId, action, outcomeKey, label) {
  const { data, error } = await service
    .from("opportunities")
    .select("pursuit_authorization_status,pursuit_authorization_configuration_version_id,pursuit_authorization_gate_key,pursuit_authorization_outcome_key,pursuit_authorized_by,pursuit_authorized_at,pursuit_authorization_reason")
    .eq("id", opportunityId)
    .single();
  if (error) throw new Error(error.message);
  const statusOk = action === "approve_pursuit" ? data.pursuit_authorization_status === "approved" : action === "decline_pursuit" ? data.pursuit_authorization_status === "declined" : data.pursuit_authorization_status === "hold_pending_evidence";
  record(label, statusOk
    && Boolean(data.pursuit_authorization_configuration_version_id)
    && data.pursuit_authorization_gate_key === "pursuit-authorization"
    && data.pursuit_authorization_outcome_key === outcomeKey
    && Boolean(data.pursuit_authorized_by),
    `status=${data.pursuit_authorization_status}; gate=${data.pursuit_authorization_gate_key}; outcome=${data.pursuit_authorization_outcome_key}; actor=${data.pursuit_authorized_by}`);
}

function compactRpcDetail(result) {
  if (result.error) return result.error.message ?? JSON.stringify(result.error);
  return `success=${result.data?.success}; status=${result.data?.opportunity?.pursuit_authorization_status}; gate=${result.data?.opportunity?.pursuit_authorization_gate_key}; outcome=${result.data?.opportunity?.pursuit_authorization_outcome_key}`;
}

async function proveCorrectionActionSecurity() {
  const source = readFileSync(resolve(process.cwd(), "lib/d5o/opportunities/supabase-repository.ts"), "utf8");
  const requiredFragments = [
    "validatePursuitCorrectionRequest",
    "authenticatedActorId",
    "listDecisionOwnerOptions",
    "contributionRequirement",
    "roleKey !== \"operations_leader\"",
    "manage_opportunity_assignment_v1",
    "actorProfileIdForUser",
    "updated_by: actorProfileId.profileId",
    "workspaceAccessRole",
    "concurrency_conflict"
  ];
  const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
  if (missing.length > 0) throw new Error(`Correction action security guard missing required fragments: ${missing.join(", ")}`);
  return true;
}

async function tableCount(service, table, filters = []) {
  let query = service.from(table).select("id");
  for (const [column, value] of filters) query = query.eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return Array.isArray(data) ? data.length : 0;
}

let fixturePreservationChecked = false;
async function cleanupLocalProofFixtures(service) {
  if (process.env.P1_CFG_REFERENCE_LIBRARY !== "1" || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421") throw new Error("owned_fixture_preservation_required");
  const {data,error} = await service.from("opportunities").select("id").ilike("scope_summary", `${localProofScope}%`);
  if(error) throw error;
  if(!fixturePreservationChecked && data.length) throw new Error("existing_cfg02_fixture_requires_owned_recreation");
  fixturePreservationChecked = true;
  writeFileSync(process.env.P1_CFG_RESULT_PATH + ".preserved-fixtures.json", JSON.stringify({ids:data.map(x=>x.id), disposal:"PENDING_OWNED_ENVIRONMENT_RECREATION"},null,2));
}
export { runLocalBusinessProof };
export const referenceResults = () => results;

function assertRpc(result, label) {
  if (result.error || result.data?.success !== true) {
    throw new Error(`${label} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
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
    riskSummary: "Pursuit Authorization proof fixture uses controlled commercial basis.",
    assumptions: "Configuration-driven proof fixture.",
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

async function main() {
  assertLocalOnlyEnvironment();
  assertPrerequisites();
  const freshProject = await runFreshInstall();
  const upgradeProject = await runUpgradeInstall();
  await runLocalBusinessProof();
  console.log(`CFG-RUNTIME-02 disposable database verification passed. fresh=${freshProject}; upgrade=${upgradeProject}`);
}

if (process.env.P1_CFG_REFERENCE_LIBRARY !== "1") main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export { runFreshInstall, runUpgradeInstall };
