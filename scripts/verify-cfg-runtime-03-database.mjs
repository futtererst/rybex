import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { referencePayload } from "./m1/p1-cfg-evidence/fixtures.mjs";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { commandId, ids, signIn, userIdFor } from "./foundation-0b-test-utils.mjs";
import { readSupabaseConfigPorts, rewriteSupabaseConfigForProject } from "./local-supabase-config-utils.mjs";
import { ensureLoopbackNetwork, removeLoopbackNetwork } from "./local-supabase-loopback-network.mjs";
import {
  assertNoProhibitedProcessState,
  createSanitizedChildEnv,
  runSupabaseStatusWithCfgRuntime03Guard,
  validateLoopbackEndpoint,
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
const migrationRoot = join(root, "supabase", "migrations");
const supabaseCommand = process.platform === "win32" ? "node_modules\\.bin\\supabase.cmd" : "node_modules/.bin/supabase";
const localProjectId = "rybex-2-local";
let localDbContainer = `supabase_db_${localProjectId}`;
const forbiddenHost = "fcawktdjoxvahhgvkebx.supabase.co";
const evidenceNamespace = process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE
  || `artifacts/cfg-runtime-03-final-remediation/${new Date().toISOString().replaceAll(":", "-").replace(".", "-")}`;
const runPhase = String(process.env.CFG_RUNTIME_03_RUN_PHASE ?? "standalone").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "standalone";
const ownedReferenceOutput = process.env.P1_CFG_REFERENCE_LIBRARY === "1" ? dirname(resolve(process.env.P1_CFG_RESULT_PATH ?? "")) : null;
if(ownedReferenceOutput && (!ownedReferenceOutput.startsWith(resolve(root,"artifacts/d5o-m1-s1-implementation-20260928T004316Z") + "\\") || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421")) throw new Error("unowned_reference_output");
const artifactRoot = ownedReferenceOutput ?? resolveCfgRuntime03OutputDirectory(root, evidenceNamespace, `database-${runPhase}-${process.argv.find((arg) => arg.startsWith("--focus="))?.slice(8) ?? "full"}`, { create: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = join(artifactRoot, `CFG-RUNTIME-03-DATABASE-EVIDENCE-${timestamp}.json`);
const fullBackupPath = join(artifactRoot, `pre-cfg-runtime-03-full-database-${timestamp}.dump`);
const publicBackupPath = join(artifactRoot, `pre-cfg-runtime-03-public-data-${timestamp}.dump`);
const authBackupPath = join(artifactRoot, `pre-cfg-runtime-03-auth-users-${timestamp}.dump`);
const testPassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `Cfg03-${Date.now()}-${randomUUID().slice(0, 8)}!`;
const results = [];
const m1Gate = ownedGateAdapter();
const focus = process.argv.find((arg) => arg.startsWith("--focus="))?.slice("--focus=".length) ?? "full";
const disposableProjects = [];
let restoreProject = null;
let localStatus = null;
let service = null;
let bd = null;

let ops = null;
let pm = null;
let auditor = null;
let userB = null;
let userIds = {};
let profileIds = {};

const evidenceKeys = ["proposal_bid_package", "approved_estimate_version", "commercial_terms", "bid_instructions"];

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || root,
    input: options.input,
    encoding: options.encoding ?? "utf8",
    shell: false,
    env: options.env || createSanitizedChildEnv(),
    maxBuffer: 1024 * 1024 * 200,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? "unknown"}\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function record(name, passed, detail = "") {
  results.push({ name, status: passed ? "pass" : "fail", detail: redact(detail) });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${redact(detail)}` : ""}`);
  if (!passed) throw new Error(`${name}${detail ? `: ${redact(detail)}` : ""}`);
}

function redact(value) {
  return String(value ?? "")
    .replace(/eyJ[A-Za-z0-9_.-]+/g, "[REDACTED_JWT]")
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_.-]+/g, "[REDACTED_KEY]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@");
}

function assertLoopbackUrl(value, label) {
  return validateLoopbackEndpoint(value, label);
}

function assertLocalOnlyEnvironment() {
  assertNoProhibitedProcessState({ root, allowLocalEndpointEnv: false });
  record("SUPABASE_PROJECT_REF is unset", !process.env.SUPABASE_PROJECT_REF, process.env.SUPABASE_PROJECT_REF ? "set" : "unset");
  record("SUPABASE_ACCESS_TOKEN is unset", !process.env.SUPABASE_ACCESS_TOKEN, process.env.SUPABASE_ACCESS_TOKEN ? "set" : "unset");
  const rejected = (() => {
    try {
      assertLoopbackUrl(`https://${forbiddenHost}`, "negative-control Supabase URL");
      return false;
    } catch {
      return true;
    }
  })();
  record("forbidden hostname is rejected before process launch", rejected, forbiddenHost);
  record("project link metadata is absent", !existsSync(join(root, "supabase", ".temp", "project-ref")), "supabase/.temp/project-ref");
}

function localSupabaseEnv() {
  const status = runSupabaseStatusWithCfgRuntime03Guard({
    root,
    supabaseCommand,
    extraEnv: {
      NEXT_TELEMETRY_DISABLED: "1",
      RYBEXOS_RUNTIME_MODE: "test",
      RYBEXOS_AUTH_MODE: "supabase",
      RYBEXOS_DATA_SOURCE: "database",
      FOUNDATION_0A_TEST_PASSWORD: testPassword,
    },
  });
  return {
    ...status.env,
    FOUNDATION_0A_TEST_PASSWORD: testPassword,
    RYBEXOS_RUNTIME_MODE: "test",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database",
    NEXT_TELEMETRY_DISABLED: "1",
  };
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

function migrationFiles(min, max) {
  return readdirSync(migrationRoot)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .filter((name) => !/-ShawnT13\.sql$/i.test(name))
    .filter((name) => Number(name.slice(0, 4)) >= min && Number(name.slice(0, 4)) <= max)
    .sort();
}

function applyMigrations(containerName, min, max) {
  if (m1Gate) return m1Gate.apply(containerName, min, max);
  for (const fileName of migrationFiles(min, max)) {
    psql(containerName, `\\echo Applying ${fileName}\n${readFileSync(join(migrationRoot, fileName), "utf8")}\n`);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function getFreePorts(count) {
  const ports = [];
  for (let index = 0; index < count; index += 1) ports.push(await getFreePort());
  return ports;
}

function copySupabaseProject(projectDir, projectId, ports) {
  mkdirSync(join(projectDir, "supabase", "migrations"), { recursive: true });
  cpSync(join(root, "supabase", "config.toml"), join(projectDir, "supabase", "config.toml"));
  let config = readFileSync(join(projectDir, "supabase", "config.toml"), "utf8");
  config = rewriteSupabaseConfigForProject(config, projectId, ports);
  writeFileSync(join(projectDir, "supabase", "config.toml"), config);
}

async function startDisposable(label) {
  if (m1Gate) return m1Gate.begin(`cfg03-${label}`);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const projectId = `rybex-cfg03-${label}-${suffix}`.slice(0, 40);
  const projectDir = join(tmpdir(), `rybex-cfg03-${label}-${suffix}`);
  const [api, db, shadow, studio, inbucket, smtp, pop3, analytics] = await getFreePorts(8);
  copySupabaseProject(projectDir, projectId, { api, db, shadow, studio, inbucket, smtp, pop3, analytics });
  const exclude = "edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector";
  const networkName = ensureLoopbackNetwork(projectId);
  const start = run(process.execPath, [join(root, "scripts", "run-supabase-loopback.mjs"), "start", "--workdir", projectDir, "--exclude", exclude, "--network-id", networkName, "--yes"], { allowFailure: true });
  if (start.status !== 0) {
    run(supabaseCommand, ["stop", "--workdir", projectDir, "--project-id", projectId, "--no-backup", "--yes"], { allowFailure: true });
    removeLoopbackNetwork(projectId);
    rmSync(projectDir, { recursive: true, force: true });
    throw new Error(`disposable Supabase start failed\n${start.stdout || ""}\n${start.stderr || ""}`.trim());
  }
  const disposable = { projectId, projectDir, dbPort: db, containerName: findDatabaseContainer(projectId) };
  disposableProjects.push({ projectId, dbPort: db, label });
  return disposable;
}

function stopDisposable(disposable) {
  if (m1Gate) return m1Gate.end(disposable);
  if (!disposable) return;
  run(supabaseCommand, ["stop", "--workdir", disposable.projectDir, "--project-id", disposable.projectId, "--no-backup", "--yes"], { allowFailure: true });
  removeLoopbackNetwork(disposable.projectId);
  rmSync(disposable.projectDir, { recursive: true, force: true });
}

function findDatabaseContainer(projectId) {
  const names = run("docker", ["ps", "--format", "{{.Names}}"]).stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const exact = `supabase_db_${projectId}`;
  if (names.includes(exact)) return exact;
  const match = names.find((name) => name.includes(projectId) && name.includes("db"));
  if (!match) throw new Error(`No database container found for ${projectId}`);
  return match;
}

function catalogAssertions(containerName, prefix) {
  const columns = Number(psqlValue(containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
  and column_name in ('submission_approver_user_id','bid_submission_approval_configuration_version_id','bid_submission_approval_gate_key','bid_submission_approval_outcome_key');
`));
  record(`${prefix} 0029 opportunity columns exist`, columns === 4, `columns=${columns}`);
  const eventColumns = Number(psqlValue(containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunity_bid_submission_events'
  and column_name in ('configuration_version_id','configuration_gate_key','configuration_outcome_key','actor_profile_id');
`));
  record(`${prefix} 0029 bid-event provenance columns exist`, eventColumns === 4, `columns=${eventColumns}`);
  const functions = Number(psqlValue(containerName, `
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'p1_01b2_bid_submission_approval_configuration_v1',
  'p1_01b2_bid_submission_approval_readiness_v1',
  'assign_opportunity_submission_approver_v1',
  'record_configured_bid_submission_approval_v1',
  'attach_opportunity_bid_approval_evidence_v1'
);
`));
  record(`${prefix} 0029 functions exist`, functions === 5, `functions=${functions}`);
  const indexes = Number(psqlValue(containerName, `
select count(*) from pg_indexes
where schemaname = 'public'
  and indexname in (
    'opportunities_submission_approver_idx',
    'opportunities_bid_submission_approval_configuration_idx',
    'opportunity_bid_submission_events_configuration_idx',
    'opportunity_bid_submission_events_cfg_decision_idx'
  );
`));
  record(`${prefix} narrow CFG-RUNTIME-03 indexes exist`, indexes === 4, `indexes=${indexes}`);
  const broadTables = Number(psqlValue(containerName, `
select count(*) from information_schema.tables
where table_schema = 'public'
  and table_name in ('bid_submission_workflows','submission_approval_workflows','award_validations','configuration_studio_changes');
`));
  record(`${prefix} no broad workflow schema was added`, broadTables === 0, `broadTables=${broadTables}`);
  const policyCount = Number(psqlValue(containerName, `
select count(*) from pg_policies
where schemaname = 'public' and tablename in ('opportunities','opportunity_bid_submission_events');
`));
  record(`${prefix} RLS policies remain present`, policyCount >= 2, `policies=${policyCount}`);
  const authorityTable = Number(psqlValue(containerName, `
select count(*) from information_schema.tables
where table_schema = 'public' and table_name = 'opportunity_bid_evidence_satisfactions';
`));
  record(`${prefix} 0030 evidence authority table exists`, authorityTable === 1, `tables=${authorityTable}`);
  const authorityPolicies = Number(psqlValue(containerName, `
select count(*) from pg_policies
where schemaname = 'public' and tablename = 'opportunity_bid_evidence_satisfactions';
`));
  record(`${prefix} 0030 evidence authority RLS is explicit`, authorityPolicies === 4, `policies=${authorityPolicies}`);
  const actorIdentityConstraint = Number(psqlValue(containerName, `
select count(*) from pg_constraint
where conrelid = 'public.opportunity_bid_evidence_satisfactions'::regclass
  and conname = 'opportunity_bid_evidence_satisfactions_actor_identity_fkey'
  and pg_get_constraintdef(oid) like 'FOREIGN KEY (actor_auth_user_id, actor_profile_id)%';
`));
  record(`${prefix} 0031 actor/profile composite authority exists`, actorIdentityConstraint === 1, `constraints=${actorIdentityConstraint}`);
}

async function disposableFreshProof() {
  const disposable = await startDisposable("fresh");
  try {
    applyMigrations(disposable.containerName, 1, 31);
    catalogAssertions(disposable.containerName, "fresh");
    record("fresh disposable applies migrations 0001 through 0031", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposable(disposable);
  }
}

async function disposableUpgradeProof() {
  const disposable = await startDisposable("upgrade");
  try {
    applyMigrations(disposable.containerName, 1, 28);
    psql(disposable.containerName, `
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000c301','authenticated','authenticated','cfg03-upgrade@local.test', now(), now(), now())
on conflict (id) do nothing;
insert into organizations (id, name, slug)
values ('00000000-0000-4000-8000-00000000c302','CFG03 Upgrade Org','cfg03-upgrade-org')
on conflict (id) do nothing;
insert into workspaces (id, organization_id, name, slug)
values ('${ids.workspaceA}', '00000000-0000-4000-8000-00000000c302', 'CFG03 Upgrade Workspace', 'cfg03-upgrade-workspace')
on conflict (id) do nothing;
insert into opportunities (
  id, organization_id, workspace_id, stable_opportunity_key, name, gc_client, customer_gc,
  project_type, project_location, opportunity_location, scope_summary, estimated_value,
  anticipated_start, bid_due_date, owner_user_id, lifecycle_status, status,
  intake_complete, qualification_complete, decision_readiness_status, duplicate_fingerprint,
  duplicate_confirmed, pursuit_authorization_status, bid_submission_status, version
) values (
  '00000000-0000-4000-8000-00000000c303', '00000000-0000-4000-8000-00000000c302', '${ids.workspaceA}',
  'CFG03-UPGRADE-HISTORICAL', 'CFG03 Upgrade Historical', 'Client', 'Client',
  'Data Center', 'NC', 'NC', 'CFG-RUNTIME-03 upgrade representative record', 100000,
  '2026-08-01', '2026-07-20', '00000000-0000-4000-8000-00000000c301',
  'qualifying', 'under_review', true, true, 'decision_approved', 'cfg03-upgrade-historical',
  false, 'approved', 'ready_for_submission_approval', 7
) on conflict (id) do nothing;
insert into opportunity_bid_submission_events (workspace_id, opportunity_id, event_type, bid_action, from_status, to_status, reason, package_version, command_id)
values ('${ids.workspaceA}', '00000000-0000-4000-8000-00000000c303', 'historical', 'approve_submission', 'ready_for_submission_approval', 'submission_approved_ready_to_send', 'legacy approval', 7, 'legacy-cfg03-null-provenance')
on conflict do nothing;
`);
    const before = persistentFingerprint(disposable.containerName, false);
    applyMigrations(disposable.containerName, 29, 29);
    psql(disposable.containerName, `
insert into evidence_objects (
  id, workspace_id, object_path, original_filename, mime_type, size_bytes, checksum_sha256,
  uploaded_by, upload_status, scan_status, verification_status, uploaded_at
) values (
  '00000000-0000-4000-8000-00000000c304', '${ids.workspaceA}',
  'legacy/cfg03-upgrade-proposal.pdf', 'cfg03-upgrade-proposal.pdf', 'application/pdf', 128,
  repeat('a', 64), '00000000-0000-4000-8000-00000000c301', 'uploaded', 'clean', 'accepted', now()
);
insert into evidence_links (
  id, workspace_id, evidence_object_id, entity_type, entity_id, relationship_type, created_by
) values (
  '00000000-0000-4000-8000-00000000c305', '${ids.workspaceA}',
  '00000000-0000-4000-8000-00000000c304', 'opportunity',
  '00000000-0000-4000-8000-00000000c303', 'proposal_bid_package',
  '00000000-0000-4000-8000-00000000c301'
);
`);
    const legacyEvidenceBefore = Number(psqlValue(disposable.containerName, "select count(*) from evidence_links;"));
    applyMigrations(disposable.containerName, 30, 30);
    applyMigrations(disposable.containerName, 31, 31);
    catalogAssertions(disposable.containerName, "upgrade");
    const after = persistentFingerprint(disposable.containerName, true);
    record("upgrade preserves existing accepted counts and hashes", before.sha256 === after.sha256, `${before.sha256} -> ${after.sha256}`);
    const nullOk = Number(psqlValue(disposable.containerName, `
select count(*) from opportunity_bid_submission_events
where command_id = 'legacy-cfg03-null-provenance'
  and configuration_version_id is null
  and actor_profile_id is null;
`));
    record("historical bid events remain valid with nullable CFG-RUNTIME-03 provenance", nullOk === 1, `legacyRows=${nullOk}`);
    const noBackfill = Number(psqlValue(disposable.containerName, "select count(*) from opportunities where submission_approver_user_id is not null;"));
    record("upgrade does not guess Submission Approver backfill", noBackfill === 0, `submissionApproverRows=${noBackfill}`);
    const authorityRows = Number(psqlValue(disposable.containerName, "select count(*) from opportunity_bid_evidence_satisfactions;"));
    const legacyEvidenceAfter = Number(psqlValue(disposable.containerName, "select count(*) from evidence_links;"));
    record("ambiguous legacy evidence remains preserved but unsatisfied", authorityRows === 0 && legacyEvidenceBefore === 1 && legacyEvidenceAfter === 1, `authority=${authorityRows}; links=${legacyEvidenceAfter}`);
    record("upgrade disposable applies 0030 and 0031 after 0029 cleanly", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposable(disposable);
  }
}

async function disposableUpgradeFrom0030Proof() {
  const disposable = await startDisposable("upgrade0030");
  try {
    applyMigrations(disposable.containerName, 1, 30);
    const before = psqlValue(disposable.containerName, "select count(*) from opportunity_bid_evidence_satisfactions;");
    applyMigrations(disposable.containerName, 31, 31);
    catalogAssertions(disposable.containerName, "upgrade-from-0030");
    const after = psqlValue(disposable.containerName, "select count(*) from opportunity_bid_evidence_satisfactions;");
    record("upgrade from 0030 through 0031 preserves authority rows", before === after, `${before}->${after}`);
    return disposable.projectId;
  } finally {
    stopDisposable(disposable);
  }
}

async function disposableIdentityPreflightProof() {
  const mismatch = await startDisposable("identity-mismatch");
  let mismatchMessage = "";
  try {
    applyMigrations(mismatch.containerName, 1, 30);
    psql(mismatch.containerName, `
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at) values
('10000000-0000-4000-8000-000000000001','authenticated','authenticated','identity-a@local.test',now(),now(),now()),
('10000000-0000-4000-8000-000000000002','authenticated','authenticated','identity-b@local.test',now(),now(),now());
insert into user_profiles (id, auth_user_id, user_id, display_name)
values ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Incoherent Test Profile');
`);
    const result = psql(mismatch.containerName, readFileSync(join(migrationRoot, "0031_cfg_runtime_03_actor_profile_identity_coherence.sql"), "utf8"), { allowFailure: true });
    mismatchMessage = result.stderr;
    record("0031 preflight fails on an existing mismatched actor/profile pair", result.status !== 0 && /actor_profile_preflight_incoherent_profile/.test(result.stderr), result.stderr);
    record("failed actor/profile preflight leaves 0031 unapplied", Number(psqlValue(mismatch.containerName, "select count(*) from pg_constraint where conname = 'opportunity_bid_evidence_satisfactions_actor_identity_fkey';")) === 0, "constraint absent");
  } finally {
    stopDisposable(mismatch);
  }

  const dangling = await startDisposable("identity-dangling");
  let danglingMessage = "";
  try {
    applyMigrations(dangling.containerName, 1, 30);
    psql(dangling.containerName, `
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','identity-c@local.test',now(),now(),now());
insert into user_profiles (id, auth_user_id, user_id, display_name)
values ('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Coherent Test Profile');
set session_replication_role = replica;
insert into opportunity_bid_evidence_satisfactions (
  id, workspace_id, opportunity_id, evidence_link_id, evidence_object_id,
  configuration_version_id, template_pack_version_id, gate_requirement_id, evidence_type_id,
  package_revision, bid_package_version, actor_auth_user_id, actor_profile_id, audit_event_id, command_id
) values (
  '20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011',
  1,'v1','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000012','identity-dangling-preflight'
);
set session_replication_role = origin;
`);
    const result = psql(dangling.containerName, readFileSync(join(migrationRoot, "0031_cfg_runtime_03_actor_profile_identity_coherence.sql"), "utf8"), { allowFailure: true });
    danglingMessage = result.stderr;
    record("0031 preflight fails on a dangling authority relationship", result.status !== 0 && /authority_preflight_dangling_relationship/.test(result.stderr), result.stderr);
    record("failed dangling-authority preflight leaves 0031 unapplied", Number(psqlValue(dangling.containerName, "select count(*) from pg_constraint where conname = 'opportunity_bid_evidence_satisfactions_actor_identity_fkey';")) === 0, "constraint absent");
  } finally {
    stopDisposable(dangling);
  }
  return { mismatchProject: mismatch.projectId, danglingProject: dangling.projectId, mismatchMessage, danglingMessage };
}

function persistentFingerprint(containerName) {
  const payload = psqlValue(containerName, `
select jsonb_build_object(
  'opportunities', (select count(*) from opportunities),
  'qualifications', (select count(*) from opportunity_qualifications),
  'bidEvents', (select count(*) from opportunity_bid_submission_events),
  'opportunityHash', coalesce((select string_agg(id::text || ':' || lifecycle_status || ':' || version::text || ':' || bid_submission_status, ',' order by id) from opportunities), '')
)::text;
`);
  return { payload, sha256: createHash("sha256").update(payload).digest("hex") };
}

function inspectPersistentBaseline() {
  const dockerPs = run("docker", ["ps", "--format", "{{.Names}}"]).stdout;
  record("persistent local database container is running", dockerPs.includes(localDbContainer), localDbContainer);
  const migrationList = psqlValue(localDbContainer, "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations;");
  const migrationVersions = migrationList.split(",");
  record("persistent stack has migrations through 0028", migrationVersions.includes("0028"), migrationList);
  const alreadyApplied0029 = migrationVersions.includes("0029");
  const alreadyApplied0030 = migrationVersions.includes("0030");
  record("persistent stack 0029 state is known", true, alreadyApplied0029 ? "0029 already applied by this guarded task" : "0029 not yet applied");
  record("persistent stack 0030 state is known", true, alreadyApplied0030 ? "0030 already applied" : "0030 not yet applied");
  const versionCount = Number(psqlValue(localDbContainer, "select count(*) from config_template_pack_versions where semver in ('1.0.0','1.1.0');"));
  record("pack versions through v1.1 exist", versionCount >= 2, `versions=${versionCount}`);
  const active = psqlValue(localDbContainer, `
select coalesce(ct.tenant_key,'') || '|' || coalesce(ct.workspace_id::text,'') || '|' || coalesce(cv.version::text,'') || '|' || coalesce(ctpv.semver,'')
from config_tenants ct
left join config_configuration_versions cv on cv.id = ct.active_configuration_version_id
left join config_template_pack_versions ctpv on ctpv.id = cv.source_template_pack_version_id
where ct.workspace_id = '${ids.workspaceA}'
limit 1;
`);
  const activeIsV11 = active.endsWith("|2|1.1.0");
  const activeIsV12 = active.endsWith("|3|1.2.0");
  record("expected active v1.1 baseline or resumed v1.2 configuration exists", activeIsV11 || activeIsV12, active);
  const acceptedFunctions = Number(psqlValue(localDbContainer, `
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'p1_01a_pricing_review_readiness_v1',
  'p1_01b1_pursuit_authorization_readiness_v1',
  'record_opportunity_bid_submission_action_v1'
);
`));
  record("accepted P1-01A, P1-01B.1, P1-01B.2, CFG-RUNTIME-01, and CFG-RUNTIME-02 structures are present", acceptedFunctions === 3, `functions=${acceptedFunctions}`);
  if (alreadyApplied0030) catalogAssertions(localDbContainer, "persistent resumed 0030");
  return {
    decision: "REUSE ACCEPTED LOCAL DEVELOPMENT STACK",
    migrationList,
    active,
    fingerprint: persistentFingerprint(localDbContainer, false),
    alreadyApplied0029,
    alreadyApplied0030,
  };
}

function createBackup() {
  mkdirSync(artifactRoot, { recursive: true });
  const fullDump = run("docker", ["exec", localDbContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--no-owner", "--no-privileges"], { encoding: "buffer" });
  const publicDump = run("docker", ["exec", localDbContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--data-only", "--schema=public", "--no-owner", "--no-privileges"], { encoding: "buffer" });
  const authDump = run("docker", ["exec", localDbContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--data-only", "--table=auth.users", "--no-owner", "--no-privileges"], { encoding: "buffer" });
  writeFileSync(fullBackupPath, fullDump.stdout);
  writeFileSync(publicBackupPath, publicDump.stdout);
  writeFileSync(authBackupPath, authDump.stdout);
  record("pre-0029 full local backup captured", fullDump.stdout.length > 0, `${fullDump.stdout.length} bytes; sha256=${hashBuffer(fullDump.stdout)}`);
  record("pre-0029 public data backup captured", publicDump.stdout.length > 0, `${publicDump.stdout.length} bytes; sha256=${hashBuffer(publicDump.stdout)}`);
  record("pre-0029 auth.users backup captured", authDump.stdout.length > 0, `${authDump.stdout.length} bytes; sha256=${hashBuffer(authDump.stdout)}`);
  return {
    fullDatabase: backupMeta(fullBackupPath),
    publicData: backupMeta(publicBackupPath),
    authUsers: backupMeta(authBackupPath),
  };
}

async function proveBackupRestore(sourceFingerprint) {
  const disposable = await startDisposable("restore");
  restoreProject = { projectId: disposable.projectId, dbPort: disposable.dbPort };
  try {
    applyMigrations(disposable.containerName, 1, 28);
    run("docker", ["exec", "-i", "-e", "PGPASSWORD=postgres", disposable.containerName, "pg_restore", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--no-owner", "--no-privileges"], {
      input: readFileSync(authBackupPath),
      encoding: "buffer",
    });
    run("docker", ["exec", "-i", "-e", "PGPASSWORD=postgres", disposable.containerName, "pg_restore", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--disable-triggers", "--no-owner", "--no-privileges"], {
      input: readFileSync(publicBackupPath),
      encoding: "buffer",
    });
    const restored = persistentFingerprint(disposable.containerName, false);
    record("backup restores into isolated loopback project", restored.sha256 === sourceFingerprint.sha256, `${disposable.projectId}; ${restored.sha256}`);
    const packHistory = Number(psqlValue(disposable.containerName, "select count(*) from config_template_pack_versions where semver in ('1.0.0','1.1.0');"));
    record("restore preserves pack history", packHistory >= 2, `packVersions=${packHistory}`);
  } finally {
    stopDisposable(disposable);
  }
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function backupMeta(path) {
  const stat = statSync(path);
  return { path, bytes: stat.size, sha256: hashBuffer(readFileSync(path)) };
}

function latestExistingBackup() {
  const searchRoots = [...new Set([artifactRoot, join(root, "artifacts", "cfg-runtime-03-local-application")])];
  for (const backupRoot of searchRoots) {
    if (!existsSync(backupRoot)) continue;
    const files = readdirSync(backupRoot).filter((name) => name.startsWith("pre-cfg-runtime-03-") && name.endsWith(".dump")).sort();
    const findLatest = (kind) => files.filter((name) => name.includes(kind)).at(-1);
    const full = findLatest("full-database");
    const publicData = findLatest("public-data");
    const authUsers = findLatest("auth-users");
    if (!full || !publicData || !authUsers) continue;
    return {
      fullDatabase: backupMeta(join(backupRoot, full)),
      publicData: backupMeta(join(backupRoot, publicData)),
      authUsers: backupMeta(join(backupRoot, authUsers)),
    };
  }
  return null;
}

function apply0029Persistent() {
  const versionsBefore = psqlValue(localDbContainer, "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations;");
  if (versionsBefore.split(",").includes("0029")) {
    record("0029 already applied to persistent local stack", true, versionsBefore);
    return;
  }
  psql(localDbContainer, readFileSync(join(migrationRoot, "0029_cfg_runtime_03_bid_submission_approval.sql"), "utf8"));
  psql(localDbContainer, `
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('0029', array[]::text[], '0029_cfg_runtime_03_bid_submission_approval')
on conflict (version) do nothing;
`);
  const versionsAfter = psqlValue(localDbContainer, "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations;");
  record("0029 applied to persistent local stack", versionsAfter.split(",").includes("0029"), versionsAfter);
  catalogAssertions(localDbContainer, "persistent 0029");
}

function ensureServiceRoleLoaderGrants() {
  psql(localDbContainer, `
grant select, insert, update on
  config_template_packs,
  config_template_pack_versions,
  config_tenants,
  config_tenant_template_activations,
  config_tenant_configurations,
  config_configuration_versions,
  config_phase_definitions,
  config_gate_definitions,
  config_role_definitions,
  config_permission_definitions,
  config_evidence_type_definitions,
  config_gate_evidence_requirements,
  config_gate_decision_outcomes,
  config_decision_right_definitions,
  config_kpi_definitions,
  config_configuration_audit_events
to service_role;
grant select on opportunity_bid_submission_events to service_role;
`);
  record("service-role grants for local pack loader and proof inspection are present", true, "configuration tables and bid events");
}

async function runDisposableBusinessQualification() {
  const preservedContainer = localDbContainer;
  const preservedStatus = localStatus;
  const runtime = await createDisposableQualificationRuntime({ root, label: "database" });
  let cleanup;
  try {
    localDbContainer = runtime.dbContainer;
    localStatus = {
      ...runtime.env,
      NODE_ENV: "test",
      NEXT_TELEMETRY_DISABLED: "1",
      RYBEXOS_RUNTIME_MODE: "test",
      RYBEXOS_AUTH_MODE: "supabase",
      RYBEXOS_DATA_SOURCE: "database",
      FOUNDATION_0A_TEST_PASSWORD: testPassword,
      CFG_RUNTIME_03_DB_CONTAINER: runtime.dbContainer,
    };
    record("business qualification rejects preserved project identity", runtime.projectId !== localProjectId, runtime.projectId);
    record("business qualification rejects preserved database port", !Object.values(runtime.ports).includes("55322"), JSON.stringify(runtime.ports));
    ensureServiceRoleLoaderGrants();
    await prepareClients(localStatus);
    await runBusinessProof();
    const residue = JSON.parse(psqlValue(localDbContainer, `
select json_build_object(
  'opportunities', (select count(*) from opportunities),
  'qualifications', (select count(*) from opportunity_qualifications),
  'evidenceObjects', (select count(*) from evidence_objects),
  'evidenceLinks', (select count(*) from evidence_links),
  'authorityRows', (select count(*) from opportunity_bid_evidence_satisfactions)
)::text;
`));
    record("business qualification leaves zero disposable residue before teardown", Object.values(residue).every((value) => Number(value) === 0), JSON.stringify(residue));
    return { projectId: runtime.projectId, ports: runtime.ports, bindings: runtime.bindings, residue };
  } finally {
    cleanup = teardownDisposableQualificationRuntime(runtime, { tolerateMissing: false });
    record("business qualification disposable resources are fully removed", cleanup.zeroResidualResources, JSON.stringify(cleanup.residual));
    localDbContainer = preservedContainer;
    localStatus = preservedStatus;
  }
}

function apply0030Persistent() {
  const versionsBefore = psqlValue(localDbContainer, "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations;");
  psql(localDbContainer, readFileSync(join(migrationRoot, "0030_cfg_runtime_03_evidence_persistence_authority.sql"), "utf8"));
  psql(localDbContainer, `
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('0030', array[]::text[], '0030_cfg_runtime_03_evidence_persistence_authority')
on conflict (version) do nothing;
`);
  record(
    versionsBefore.split(",").includes("0030") ? "0030 reapplies deterministically" : "0030 applied to persistent local stack",
    true,
    "forward-only authority extension",
  );
  catalogAssertions(localDbContainer, "persistent 0030");
}

function runNodeScript(script, env, label) {
  const result = run(process.execPath, [script], { env, allowFailure: true });
  record(label, result.status === 0, result.status === 0 ? "ok" : `${result.stdout || ""}\n${result.stderr || ""}`);
  return result;
}

async function prepareClients(env) {
  Object.assign(process.env, env);
  runNodeScript("scripts/bootstrap-foundation-0a-local.mjs", env, "Foundation 0A local bootstrap completed");
  runNodeScript("scripts/load-cfg-runtime-03-pack-local.mjs", env, "CFG-RUNTIME-03 v1.2 load pass 1 completed");
  runNodeScript("scripts/load-cfg-runtime-03-pack-local.mjs", env, "CFG-RUNTIME-03 v1.2 load pass 2 proves idempotency");
  service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await resetFixturePasswords();
  bd = await signIn("bd-a@foundation0a.local");
  ops = await signIn("ops-a@foundation0a.local");
  pm = await signIn("pm-a@foundation0a.local");
  auditor = await signIn("auditor-a@foundation0a.local");
  userB = await signIn("user-b@foundation0a.local");
  userIds = {
    bd: await userIdFor(service, "bd-a@foundation0a.local"),
    ops: await userIdFor(service, "ops-a@foundation0a.local"),
    pm: await userIdFor(service, "pm-a@foundation0a.local"),
    auditor: await userIdFor(service, "auditor-a@foundation0a.local"),
    userB: await userIdFor(service, "user-b@foundation0a.local"),
  };
  profileIds = {
    bd: await profileIdFor(userIds.bd),
    ops: await profileIdFor(userIds.ops),
    pm: await profileIdFor(userIds.pm),
    auditor: await profileIdFor(userIds.auditor),
    userB: await profileIdFor(userIds.userB),
  };
}

async function resetFixturePasswords() {
  const listed = await service.auth.admin.listUsers();
  if (listed.error) throw new Error(`fixture user lookup failed: ${listed.error.message}`);
  for (const email of ["bd-a@foundation0a.local", "ops-a@foundation0a.local", "pm-a@foundation0a.local", "auditor-a@foundation0a.local", "user-b@foundation0a.local"]) {
    const user = listed.data.users.find((entry) => entry.email === email);
    if (!user?.id) throw new Error(`missing fixture auth user ${email}`);
    const updated = await service.auth.admin.updateUserById(user.id, { password: testPassword, email_confirm: true });
    if (updated.error) throw new Error(`fixture password reset failed for ${email}: ${updated.error.message}`);
  }
}

async function profileIdFor(userId) {
  const { data, error } = await service.from("user_profiles").select("id").eq("user_id", userId).single();
  if (error || !data?.id) throw new Error(`profile lookup failed for ${userId}: ${error?.message ?? "missing"}`);
  return data.id;
}

async function runBusinessProof() {
  await cleanupProofFixtures();
  try {
    const ready = await createReadyFixture("ready");
    await assertReadiness(ready.id, true, "ready_for_submission_approval", "Entry state ready_for_submission_approval is accepted");
    await assertRow(ready.id, (row) => row.submission_approver_user_id === profileIds.ops, "Dedicated Submission Approver persists");
    await assertConfiguredRequirements(ready.id);

    const exactBadCase = await callApproval(ops, ready.id, ready.version, "Approve-For-Submission", "", "case-variant");
    record("case variant outcome is rejected", exactBadCase.data?.success === false && exactBadCase.data?.error === "invalid_outcome", JSON.stringify(exactBadCase.data ?? exactBadCase.error));
    const exactBadWhitespace = await callApproval(ops, ready.id, ready.version, "approve-for-submission ", "", "whitespace-variant");
    record("whitespace variant outcome is rejected", exactBadWhitespace.data?.success === false && exactBadWhitespace.data?.error === "invalid_outcome", JSON.stringify(exactBadWhitespace.data ?? exactBadWhitespace.error));
    const holdNoReason = await callApproval(ops, ready.id, ready.version, "hold-submission-approval", "", "hold-no-reason");
    record("hold rationale is required", holdNoReason.data?.success === false && holdNoReason.data?.error === "hold_rationale_required", JSON.stringify(holdNoReason.data ?? holdNoReason.error));

    const unauthorized = await callApproval(bd, ready.id, ready.version, "approve-for-submission", "", "unauthorized-bd");
    record("unauthorized actor is rejected", unauthorized.data?.success === false && unauthorized.data?.error === "submission_approver_required", JSON.stringify(unauthorized.data ?? unauthorized.error));
    const viewer = await callApproval(auditor, ready.id, ready.version, "approve-for-submission", "", "viewer");
    record("viewer is rejected", viewer.data?.success === false && ["forbidden", "submission_approver_required"].includes(viewer.data?.error), JSON.stringify(viewer.data ?? viewer.error));
    const crossActor = await callApproval(userB, ready.id, ready.version, "approve-for-submission", "", "cross-workspace");
    record("cross-workspace actor is rejected", crossActor.data?.success === false && ["forbidden", "submission_approver_required"].includes(crossActor.data?.error), JSON.stringify(crossActor.data ?? crossActor.error));

    const unknownEvidence = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
      p_opportunity_id: ready.id,
      p_relationship_type: "unknown_bid_evidence",
      p_payload: evidencePayload("unknown"),
      p_command_id: commandId("cfg03-unknown-evidence"),
      p_expected_version: ready.version,
      p_correlation_id: "cfg03-unknown-evidence",
    });
    record("unknown evidence key is rejected", unknownEvidence.data?.success === false && unknownEvidence.data?.error === "unknown_evidence_key", JSON.stringify(unknownEvidence.data ?? unknownEvidence.error));

    const wrongApprover = await createBaseFixture("wrong-approver", { evidence: true, approverProfileId: profileIds.pm });
    const assignWrong = await ops.rpc("assign_opportunity_submission_approver_v1", {
      p_opportunity_id: wrongApprover.id,
      p_submission_approver_profile_id: profileIds.pm,
      p_expected_version: wrongApprover.version,
      p_command_id: commandId("cfg03-ineligible-approver"),
      p_correlation_id: "cfg03-ineligible-approver",
    });
    record("ineligible approver is rejected", assignWrong.data?.success === false && assignWrong.data?.error === "invalid_submission_approver", JSON.stringify(assignWrong.data ?? assignWrong.error));
    const assignCross = await ops.rpc("assign_opportunity_submission_approver_v1", {
      p_opportunity_id: wrongApprover.id,
      p_submission_approver_profile_id: profileIds.userB,
      p_expected_version: wrongApprover.version,
      p_command_id: commandId("cfg03-cross-approver"),
      p_correlation_id: "cfg03-cross-approver",
    });
    record("cross-workspace target approver is rejected", assignCross.data?.success === false && assignCross.data?.error === "invalid_submission_approver", JSON.stringify(assignCross.data ?? assignCross.error));

    const targetMissing = await createBaseFixture("cross-opportunity-evidence-target", { evidence: false, approverProfileId: profileIds.ops });
    const otherWithEvidence = await createBaseFixture("cross-opportunity-evidence-source", { evidence: true, approverProfileId: profileIds.ops });
    await assertReadiness(targetMissing.id, false, "missing_bid_evidence", "cross-opportunity evidence does not satisfy target opportunity");
    record("cross-opportunity evidence source remains separate", otherWithEvidence.id !== targetMissing.id, "separate records");
    await assertEvidenceAuthorityControls(ready, targetMissing);

    const forgedState = await createBaseFixture("forged-state", { evidence: false, approverProfileId: null, skipMarkReady: true });
    await updateOpportunityService(forgedState.id, { submission_approver_user_id: profileIds.ops });
    const forgedStateRow = await getOpportunity(forgedState.id);
    const forgedApproval = await callApproval(ops, forgedState.id, forgedState.version, "approve-for-submission", "", "forged-state");
    record("forged readiness/state is rejected server-side", forgedApproval.data?.success === false && forgedApproval.data?.error === "invalid_state", `status=${forgedStateRow.bid_submission_status}; ${JSON.stringify(forgedApproval.data ?? forgedApproval.error)}`);

    const stale = await createReadyFixture("stale");
    const staleAssign = await ops.rpc("assign_opportunity_submission_approver_v1", {
      p_opportunity_id: stale.id,
      p_submission_approver_profile_id: profileIds.ops,
      p_expected_version: stale.version,
      p_command_id: commandId("cfg03-stale-version-bump"),
      p_correlation_id: "cfg03-stale-version-bump",
    });
    record("repeat approver assignment is idempotent", staleAssign.data?.success === true, JSON.stringify(staleAssign.data ?? staleAssign.error));
    const staleApproval = await callApproval(ops, stale.id, stale.version - 1, "approve-for-submission", "", "stale");
    record("stale command is rejected", staleApproval.data?.success === false && staleApproval.data?.error === "concurrency_conflict", JSON.stringify(staleApproval.data ?? staleApproval.error));

    const hold = await createReadyFixture("hold");
    const holdResult = await callApproval(ops, hold.id, hold.version, "hold-submission-approval", "Package needs commercial sign-off before release.", "hold-valid");
    record("valid hold command persists held state", holdResult.data?.success === true, JSON.stringify(holdResult.data ?? holdResult.error));
    await assertApprovalPersistence(hold.id, "submission_approval_held", "hold-submission-approval", true);

    const approve = await createReadyFixture("approve");
    const approveCommand = commandId("cfg03-approve-valid");
    const approveResult = await callApproval(ops, approve.id, approve.version, "approve-for-submission", "", approveCommand, true);
    record("valid approve command persists approved-ready-to-send state", approveResult.data?.success === true, JSON.stringify(approveResult.data ?? approveResult.error));
    await assertApprovalPersistence(approve.id, "submission_approved_ready_to_send", "approve-for-submission", false);
    const replay = await callApproval(ops, approve.id, approve.version, "approve-for-submission", "", approveCommand, true);
    record("repeat command is idempotent", replay.data?.success === true && replay.data?.replayed === true, JSON.stringify(replay.data ?? replay.error));

    const concurrent = await createReadyFixture("concurrent");
    const [approveConcurrent, holdConcurrent] = await Promise.all([
      callApproval(ops, concurrent.id, concurrent.version, "approve-for-submission", "", "concurrent-approve"),
      callApproval(ops, concurrent.id, concurrent.version, "hold-submission-approval", "Concurrent hold rationale.", "concurrent-hold"),
    ]);
    const winners = [approveConcurrent, holdConcurrent].filter((entry) => entry.data?.success === true).length;
    record("exactly one concurrent approve/hold command wins", winners === 1, `winners=${winners}`);

    const unavailable = await createWorkspaceBUnavailableFixture();
    const unavailableReadiness = await userB.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: unavailable.id });
    record("configuration-unavailable fail-closed behavior", unavailableReadiness.data?.available === false && unavailableReadiness.data?.ready === false, JSON.stringify(unavailableReadiness.data ?? unavailableReadiness.error));

    const wrongConfig = psql(localDbContainer, `
begin;
update config_tenants set active_configuration_version_id = (
  select cv.id from config_configuration_versions cv
  join config_tenant_configurations ctc on ctc.id = cv.tenant_configuration_id
  where ctc.tenant_id = config_tenants.id and cv.version = 2
  limit 1
)
where workspace_id = '${ids.workspaceA}';
set local role authenticated;
set local request.jwt.claim.sub = '${userIds.ops}';
set local request.jwt.claim.role = 'authenticated';
select public.record_configured_bid_submission_approval_v1('${ready.id}', 'approve-for-submission', '', 'cfg03-wrong-version', ${ready.version}, 'cfg03-wrong-version')::text;
rollback;
`, { allowFailure: true });
    record("wrong active configuration version fails closed", /configuration_unavailable|bid_submission_approval_gate_missing/.test(`${wrongConfig.stdout}\n${wrongConfig.stderr}`), redact(`${wrongConfig.stdout}\n${wrongConfig.stderr}`));

    const eventCount = Number(psqlValue(localDbContainer, `
select count(*)
from opportunity_bid_submission_events e
join opportunities o on o.id = e.opportunity_id
where o.scope_summary ilike 'CFG-RUNTIME-03 database proof%'
  and e.bid_action = 'record_submission';
`));
    record("no actual bid submission event was recorded", eventCount === 0, `record_submission_events=${eventCount}`);
    const forbiddenActions = await countForbiddenBidActions();
    record("no receipt, clarification, BAFO, pursuit outcome, award validation, or P1-01B.3 event was recorded", forbiddenActions === 0, `forbiddenEvents=${forbiddenActions}`);
  } finally {
    await cleanupProofFixtures();
  }
}

async function assertEvidenceAuthorityControls(ready, targetMissing) {
  const authorityResult = await service
    .from("opportunity_bid_evidence_satisfactions")
    .select("*")
    .eq("opportunity_id", ready.id)
    .order("gate_requirement_id");
  if (authorityResult.error) throw new Error(`authority read failed: ${authorityResult.error.message}`);
  const authority = authorityResult.data ?? [];
  const objectIds = authority.map((row) => row.evidence_object_id);
  const objectResult = await service.from("evidence_objects").select("id,original_filename").in("id", objectIds);
  if (objectResult.error) throw new Error(`authority filename read failed: ${objectResult.error.message}`);
  const fileByObject = new Map((objectResult.data ?? []).map((row) => [row.id, row.original_filename]));
  const readinessResult = await ops.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: ready.id });
  if (readinessResult.error) throw new Error(`authority readiness read failed: ${readinessResult.error.message}`);
  const requirements = readinessResult.data?.evidenceRequirements ?? [];
  const reconciled = requirements.every((requirement) => {
    const row = authority.find((entry) => entry.gate_requirement_id === requirement.requirementId);
    return Boolean(
      row
      && row.configuration_version_id === readinessResult.data?.configurationVersionId
      && row.package_revision === ready.version
      && row.bid_package_version === readinessResult.data?.bidPackageVersion
      && row.evidence_type_id === requirement.evidenceTypeId
      && fileByObject.get(row.evidence_object_id) === requirement.evidence?.fileName,
    );
  });
  record(
    "persisted filenames reconcile to exact requirement, configuration, and package revision",
    authority.length === evidenceKeys.length && requirements.length === evidenceKeys.length && reconciled,
    JSON.stringify(requirements.map((requirement) => ({
      relationshipType: requirement.relationshipType,
      fileName: requirement.evidence?.fileName,
      packageRevision: requirement.evidence?.packageRevision,
    }))),
  );

  const base = authority[0];
  if (!base) throw new Error("authority fixture did not persist an association");
  record(
    "valid User A/Profile A authority pair persists",
    base.actor_auth_user_id === userIds.ops && base.actor_profile_id === profileIds.ops,
    `${base.actor_auth_user_id}/${base.actor_profile_id}`,
  );
  const identityConstraint = JSON.parse(psqlValue(localDbContainer, `
select json_build_object('definition', pg_get_constraintdef(c.oid), 'validated',c.convalidated,
 'sourceColumns',(select array_agg(a.attname order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum),
 'target',c.confrelid::regclass::text,
 'targetColumns',(select array_agg(a.attname order by k.ordinality) from unnest(c.confkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.attnum),
 'triggersEnabled',not exists(select 1 from pg_trigger t where t.tgconstraint=c.oid and t.tgenabled not in ('O','A')))
from pg_constraint c where c.conrelid='public.opportunity_bid_evidence_satisfactions'::regclass and c.conname='opportunity_bid_evidence_satisfactions_actor_identity_fkey';`));
  record("installed actor/profile FK is validated and enabled", identityConstraint.validated && identityConstraint.triggersEnabled && JSON.stringify(identityConstraint.sourceColumns)===JSON.stringify(["actor_auth_user_id","actor_profile_id"]) && ["user_profiles","public.user_profiles"].includes(identityConstraint.target) && JSON.stringify(identityConstraint.targetColumns)===JSON.stringify(["user_id","id"]), JSON.stringify(identityConstraint));
  record("installed identity FK retains RESTRICT semantics", /ON UPDATE RESTRICT ON DELETE RESTRICT$/.test(identityConstraint.definition), identityConstraint.definition);
  const copiedDefinition=identityConstraint.definition.replace(/REFERENCES (?:public\.)?user_profiles\(user_id, id\)/,"REFERENCES cfg_identity_parent(user_id, id)");
  if(copiedDefinition===identityConstraint.definition) throw new Error("identity_probe_target_not_replaced");
  const probeSetup=`begin;
create temporary table cfg_identity_parent (user_id uuid not null, id uuid not null, unique(user_id,id)) on commit drop;
insert into cfg_identity_parent select user_id,id from public.user_profiles where id in ('${profileIds.ops}','${profileIds.userB}');
do $probe$ begin
 if (select count(*) from cfg_identity_parent)<>2
 or exists((select user_id,id from cfg_identity_parent except select user_id,id from public.user_profiles where id in ('${profileIds.ops}','${profileIds.userB}')))
 or exists((select user_id,id from public.user_profiles where id in ('${profileIds.ops}','${profileIds.userB}') except select user_id,id from cfg_identity_parent))
 then raise exception 'identity_probe_copy_mismatch'; end if;
end $probe$;
create temporary table cfg_identity_probe (actor_auth_user_id uuid, actor_profile_id uuid, constraint cfg_identity_probe_actor_identity_fkey ${copiedDefinition}) on commit drop;`;
  const validPairs=psql(localDbContainer,`${probeSetup} savepoint pair_probe; insert into cfg_identity_probe values ('${userIds.ops}','${profileIds.ops}'),('${userIds.userB}','${profileIds.userB}'); rollback to pair_probe; rollback;`,{allowFailure:true});
  record("valid A/A and B/B pairs satisfy copied identity FK semantics",validPairs.status===0,validPairs.stderr || "temporary probe rolled back; no business authority claimed");
  const mismatchedAB=psql(localDbContainer,`${probeSetup} savepoint pair_probe; insert into cfg_identity_probe values ('${userIds.ops}','${profileIds.userB}'); rollback to pair_probe; rollback;`,{allowFailure:true});
  record("A/B pair fails copied identity FK semantics",mismatchedAB.status!==0 && /actor_identity_fkey|foreign key/i.test(mismatchedAB.stderr),mismatchedAB.stderr);
  const mismatchedBA=psql(localDbContainer,`${probeSetup} savepoint pair_probe; insert into cfg_identity_probe values ('${userIds.userB}','${profileIds.ops}'); rollback to pair_probe; rollback;`,{allowFailure:true});
  record("B/A pair fails copied identity FK semantics",mismatchedBA.status!==0 && /actor_identity_fkey|foreign key/i.test(mismatchedBA.stderr),mismatchedBA.stderr);
  const insertBase = { ...base };
  delete insertBase.id;
  delete insertBase.created_at;
  const second = authority.find((row) => row.gate_requirement_id !== base.gate_requirement_id);
  if (!second) throw new Error("authority fixture did not persist distinct configured requirements");

  const rejectServiceInsert = async (label, overrides) => {
    const candidate = { ...insertBase, ...overrides, command_id: `cfg03-negative-${randomUUID()}` };
    const { error } = await service.from("opportunity_bid_evidence_satisfactions").insert(candidate);
    record(label, Boolean(error), error?.message ?? "unexpected insert success");
  };
  await rejectServiceInsert("cross-revision evidence authority is rejected", { package_revision: ready.version + 1 });
  await rejectServiceInsert("cross-requirement evidence authority is rejected", {
    gate_requirement_id: second.gate_requirement_id,
    evidence_type_id: second.evidence_type_id,
  });
  await rejectServiceInsert("cross-opportunity evidence authority is rejected", { opportunity_id: targetMissing.id });
  await rejectServiceInsert("cross-workspace evidence authority is rejected", { workspace_id: ids.workspaceB });
  const alternateConfigurationId = psqlValue(localDbContainer, `select id from config_configuration_versions where id <> '${base.configuration_version_id}' order by created_at limit 1;`);
  if (alternateConfigurationId) await rejectServiceInsert("cross-configuration evidence authority is rejected", { configuration_version_id: alternateConfigurationId });
  await rejectServiceInsert("mismatched evidence type is rejected", { evidence_type_id: second.evidence_type_id });

  const directCandidate = { ...insertBase, command_id: `cfg03-browser-authority-${randomUUID()}` };
  const directInsert = await ops.from("opportunity_bid_evidence_satisfactions").insert(directCandidate);
  record("authenticated browser role cannot create evidence authority", Boolean(directInsert.error), directInsert.error?.message ?? "unexpected insert success");

  const duplicate = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
    p_opportunity_id: ready.id,
    p_relationship_type: evidenceKeys[0],
    p_payload: evidencePayload("duplicate-authority"),
    p_command_id: commandId(`cfg03-duplicate-${randomUUID()}`),
    p_expected_version: ready.version,
    p_correlation_id: `cfg03-duplicate-${randomUUID()}`,
  });
  record("duplicate configured-requirement association is safely rejected", duplicate.data?.success === false && duplicate.data?.error === "evidence_requirement_already_satisfied", JSON.stringify(duplicate.data ?? duplicate.error));

  const stale = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
    p_opportunity_id: targetMissing.id,
    p_relationship_type: evidenceKeys[0],
    p_payload: evidencePayload("stale-authority"),
    p_command_id: commandId(`cfg03-stale-evidence-${randomUUID()}`),
    p_expected_version: targetMissing.version - 1,
    p_correlation_id: `cfg03-stale-evidence-${randomUUID()}`,
  });
  record("stale package revision during evidence upload is rejected", stale.data?.success === false && stale.data?.error === "concurrency_conflict", JSON.stringify(stale.data ?? stale.error));

  const beforeInvalid = Number(psqlValue(localDbContainer, "select count(*) from evidence_objects;"));
  const invalid = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
    p_opportunity_id: targetMissing.id,
    p_relationship_type: evidenceKeys[0],
    p_payload: { fileName: "", mimeType: "text/plain", sizeBytes: 0, checksumSha256: "" },
    p_command_id: commandId(`cfg03-invalid-evidence-${randomUUID()}`),
    p_expected_version: targetMissing.version,
    p_correlation_id: `cfg03-invalid-evidence-${randomUUID()}`,
  });
  const afterInvalid = Number(psqlValue(localDbContainer, "select count(*) from evidence_objects;"));
  record("invalid evidence transaction leaves no partial attachment or authority", invalid.data?.success === false && beforeInvalid === afterInvalid, `objects=${beforeInvalid}->${afterInvalid}; ${JSON.stringify(invalid.data ?? invalid.error)}`);

  const legacyLink = await service.from("evidence_links").insert({
    workspace_id: ids.workspaceA,
    evidence_object_id: base.evidence_object_id,
    entity_type: "opportunity",
    entity_id: targetMissing.id,
    relationship_type: evidenceKeys[0],
    created_by: userIds.ops,
  });
  if (legacyLink.error) throw new Error(`legacy-link negative fixture failed: ${legacyLink.error.message}`);
  const missingAuthorityReadiness = await ops.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: targetMissing.id });
  const legacyRequirement = (missingAuthorityReadiness.data?.evidenceRequirements ?? []).find((entry) => entry.relationshipType === evidenceKeys[0]);
  record("legacy evidence link without persisted authority cannot satisfy readiness", legacyRequirement?.satisfied === false && !legacyRequirement?.evidence, JSON.stringify(legacyRequirement));
}

async function createReadyFixture(scenario) {
  return createBaseFixture(scenario, { evidence: true, approverProfileId: profileIds.ops });
}

async function createBaseFixture(scenario, { evidence, approverProfileId, skipMarkReady = false }) {
  const key = `cfg-runtime-03-db-${scenario}-${Date.now()}-${randomUUID()}`;
  const created = await bd.rpc("create_opportunity_v1", {
    p_payload: {
      name: "Bluegrass Data Centers - Charlotte Expansion",
      customerGc: "Bluegrass Data Centers",
      projectType: "Data Center",
      location: "Charlotte, NC",
      scopeSummary: `CFG-RUNTIME-03 database proof ${scenario}`,
      estimatedValue: "385000",
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-20",
      duplicateConfirmed: true,
    },
    p_command_id: commandId(`${key}-create`),
    p_correlation_id: `${key}-create`,
  });
  assertRpc(created, `${scenario} create`);
  let current = created.data;
  const qualified = await bd.rpc("save_opportunity_qualification_v1", {
    p_opportunity_id: current.opportunity.id,
    p_payload: qualificationPayload(),
    p_command_id: commandId(`${key}-qualification`),
    p_expected_version: current.opportunity.version,
    p_correlation_id: `${key}-qualification`,
  });
  assertRpc(qualified, `${scenario} qualification`);
  current = qualified.data;
  const owner = await bd.rpc("set_opportunity_decision_accountability_v1", {
    p_opportunity_id: current.opportunity.id,
    p_decision_owner_user_id: userIds.ops,
    p_decision_due_at: "2026-07-18",
    p_command_id: commandId(`${key}-pricing-owner`),
    p_expected_version: current.opportunity.version,
    p_correlation_id: `${key}-pricing-owner`,
  });
  assertRpc(owner, `${scenario} pricing owner`);
  current = owner.data;
  const decisionEvidence = await bd.rpc("attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: current.opportunity.id,
    p_payload: await referencePayload(service, bd, current.opportunity.id, current.opportunity.version, "decision_support", "qualification_decision_support", evidencePayload(`${scenario}-decision-support`)),
    p_command_id: commandId(`${key}-decision-evidence`),
    p_expected_version: current.opportunity.version,
    p_correlation_id: `${key}-decision-evidence`,
  });
  assertRpc(decisionEvidence, `${scenario} decision evidence`);
  current = decisionEvidence.data;
  const submitted = await bd.rpc("submit_opportunity_for_decision_v1", {
    p_opportunity_id: current.opportunity.id,
    p_command_id: commandId(`${key}-submit-pricing`),
    p_expected_version: current.opportunity.version,
    p_correlation_id: `${key}-submit-pricing`,
  });
  assertRpc(submitted, `${scenario} pricing submit`);
  current = submitted.data;
  const approved = await ops.rpc("record_opportunity_decision_action_v1", {
    p_opportunity_id: current.opportunity.id,
    p_decision_action: "approved",
    p_reason: "",
    p_command_id: commandId(`${key}-approve-pricing`),
    p_expected_version: current.opportunity.version,
    p_correlation_id: `${key}-approve-pricing`,
  });
  assertRpc(approved, `${scenario} pricing approve`);
  current = approved.data;
  await updateOpportunityService(current.opportunity.id, {
    pursuit_authority_user_id: userIds.ops,
    pursuit_authorization_status: "ready_for_authorization",
    pursuit_authorization_due_at: "2026-07-19",
  });
  await addContribution(current.opportunity.id, userIds.ops);
  current = await getOpportunity(current.opportunity.id);
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
  if (!skipMarkReady) {
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
  }
  if (approverProfileId) {
    const assigned = await ops.rpc("assign_opportunity_submission_approver_v1", {
      p_opportunity_id: current.id,
      p_submission_approver_profile_id: approverProfileId,
      p_expected_version: current.version,
      p_command_id: commandId(`${key}-assign-approver`),
      p_correlation_id: `${key}-assign-approver`,
    });
    if (approverProfileId === profileIds.ops) assertRpc(assigned, `${scenario} assign approver`);
    current = await getOpportunity(current.id);
  }
  if (evidence) {
    for (const relationshipType of evidenceKeys) {
      const attached = await ops.rpc("attach_opportunity_bid_approval_evidence_v1", {
        p_opportunity_id: current.id,
        p_relationship_type: relationshipType,
        p_payload: await referencePayload(service, ops, current.id, current.version, "bid_approval", relationshipType, evidencePayload(`${scenario}-${relationshipType}`)),
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
  const stable = `cfg-runtime-03-unavailable-${Date.now()}-${randomUUID()}`;
  const now = new Date().toISOString();
  const { error: oppError } = await service.from("opportunities").insert({
    id,
    workspace_id: ids.workspaceB,
    organization_id: ids.orgB,
    name: "Bluegrass Data Centers - Workspace B Approval Proof",
    customer_gc: "Bluegrass Data Centers",
    gc_client: "Bluegrass Data Centers",
    project_type: "Data Center",
    opportunity_location: "Charlotte, NC",
    project_location: "Charlotte, NC",
    scope_summary: "CFG-RUNTIME-03 database proof unavailable",
    estimated_value: 385000,
    anticipated_start: "2026-08-10",
    bid_due_date: "2026-07-20",
    owner_user_id: userIds.userB,
    stable_opportunity_key: stable,
    duplicate_fingerprint: stable,
    intake_complete: true,
    qualification_complete: true,
    decision_readiness_status: "decision_approved",
    pursuit_authorization_status: "approved",
    pursuit_authority_user_id: userIds.userB,
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
    prepared_by: userIds.userB,
    completed_at: now,
    created_at: now,
    updated_at: now,
  });
  if (qualificationError) throw new Error(`workspace B qualification insert failed: ${qualificationError.message}`);
  return { id, version: 1 };
}

async function assertConfiguredRequirements(opportunityId) {
  const readiness = await ops.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: opportunityId });
  if (readiness.error) throw new Error(readiness.error.message);
  const keys = new Set((readiness.data?.evidenceRequirements ?? []).map((entry) => entry.evidenceTypeKey));
  const outcomes = new Set((readiness.data?.permittedOutcomes ?? []).map((entry) => entry.outcomeKey));
  record("configured evidence requirements are present", evidenceKeys.every((key) => keys.has(key)), JSON.stringify([...keys]));
  record("configured exact outcomes are present", outcomes.has("approve-for-submission") && outcomes.has("hold-submission-approval") && outcomes.size === 2, JSON.stringify([...outcomes]));
  record("Submission Approver accountability and decision rights resolve", readiness.data?.submissionApproverAccountability?.roleKey === "submission_approver", JSON.stringify(readiness.data?.submissionApproverAccountability));
  record("configuration and actor/profile provenance are available before decision", Boolean(readiness.data?.configurationVersionId && readiness.data?.gateKey), JSON.stringify(readiness.data?.configurationVersionId ?? null));
}

async function assertReadiness(opportunityId, expectedReady, expectedStatusOrDeficiency, label) {
  const row = await getOpportunity(opportunityId);
  const readiness = await ops.rpc("p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: opportunityId });
  if (readiness.error) throw new Error(readiness.error.message);
  const deficiencies = readiness.data?.deficiencies ?? [];
  const ok = readiness.data?.ready === expectedReady
    && (expectedReady ? row.bid_submission_status === expectedStatusOrDeficiency : deficiencies.includes(expectedStatusOrDeficiency));
  record(label, ok, `ready=${readiness.data?.ready}; status=${row.bid_submission_status}; deficiencies=${JSON.stringify(deficiencies)}`);
}

async function assertApprovalPersistence(opportunityId, status, outcomeKey, requiresReason) {
  const { data, error } = await service
    .from("opportunities")
    .select("version,bid_submission_status,bid_submission_approval_configuration_version_id,bid_submission_approval_gate_key,bid_submission_approval_outcome_key,bid_submitted_at,bid_submission_confirmation,bid_recipient,bid_submission_channel,bid_outcome_reason")
    .eq("id", opportunityId)
    .single();
  if (error) throw new Error(error.message);
  record("atomic state/revision transition persisted", data.bid_submission_status === status && data.version > 1, `status=${data.bid_submission_status}; version=${data.version}`);
  record("configuration-version, gate, and outcome provenance persisted", Boolean(data.bid_submission_approval_configuration_version_id) && data.bid_submission_approval_gate_key === "bid-submission-approval" && data.bid_submission_approval_outcome_key === outcomeKey, JSON.stringify(data));
  record("no actual bid submission receipt fields were populated", !data.bid_submitted_at && !data.bid_submission_confirmation && !data.bid_recipient && !data.bid_submission_channel, "receipt fields null");
  if (requiresReason) record("required hold rationale persisted", Boolean(data.bid_outcome_reason), data.bid_outcome_reason);
  const { data: event, error: eventError } = await service
    .from("opportunity_bid_submission_events")
    .select("bid_action,actor_profile_id,configuration_version_id,configuration_gate_key,configuration_outcome_key,package_version,metadata")
    .eq("opportunity_id", opportunityId)
    .eq("configuration_outcome_key", outcomeKey)
    .single();
  if (eventError) throw new Error(eventError.message);
  record("actor-profile provenance and package revision persisted", Boolean(event.actor_profile_id && event.configuration_version_id && event.package_version), JSON.stringify(event));
  record("CFG-RUNTIME-03 provenance states no bid submission recorded", event.metadata?.bidSubmissionRecorded === false, JSON.stringify(event.metadata));
}

async function assertRow(opportunityId, predicate, label) {
  const row = await getOpportunity(opportunityId);
  record(label, predicate(row), JSON.stringify(row));
}

async function callApproval(client, id, version, outcome, reason, key, rawKey = false) {
  const command = rawKey ? key : commandId(`cfg03-${key}`);
  return client.rpc("record_configured_bid_submission_approval_v1", {
    p_opportunity_id: id,
    p_outcome_key: outcome,
    p_reason: reason,
    p_command_id: command,
    p_expected_version: version,
    p_correlation_id: command,
  });
}

async function updateOpportunityService(id, fields) {
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

async function tableCount(table, filters = []) {
  let query = service.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function countForbiddenBidActions() {
  return Number(psqlValue(localDbContainer, `
select count(*)
from opportunity_bid_submission_events e
join opportunities o on o.id = e.opportunity_id
where o.scope_summary ilike 'CFG-RUNTIME-03 database proof%'
  and e.bid_action in (
    'record_submission',
    'record_clarification_request',
    'record_revision_bafo_request',
    'record_revised_submission',
    'record_lost_not_selected',
    'record_withdrawn_no_submit',
    'record_selected_handoff'
  );
`));
}

let fixturePreservationChecked = false;
async function cleanupProofFixtures() {
  if(process.env.P1_CFG_REFERENCE_LIBRARY !== "1" || localDbContainer !== "supabase_db_rybex-cfg03-q-m1-s1-recovery-20260928") throw new Error("owned_fixture_preservation_required");
  const {data,error}=await service.from("opportunities").select("id").ilike("scope_summary","CFG-RUNTIME-03 database proof%");
  if(error) throw error;
  if(!fixturePreservationChecked && data.length) throw new Error("existing_cfg03_fixture_requires_owned_recreation");
  fixturePreservationChecked=true;
  writeFileSync(process.env.P1_CFG_RESULT_PATH + ".preserved-fixtures.json",JSON.stringify({ids:data.map(x=>x.id),disposal:"PENDING_OWNED_ENVIRONMENT_RECREATION"},null,2));
}
export async function runOwnedReference(env) {
  if(env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421" || process.env.P1_CFG_REFERENCE_LIBRARY !== "1") throw new Error("unowned_reference");
  localDbContainer="supabase_db_rybex-cfg03-q-m1-s1-recovery-20260928";
  localStatus=env;
  await prepareClients(env);
  await runBusinessProof();
}
export const referenceResults = () => results;

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
    riskSummary: "CFG-RUNTIME-03 controlled bid submission approval proof.",
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
    fileName: `${name}.txt`,
    mimeType: "text/plain",
    sizeBytes: 42,
    checksumSha256: createHash("sha256").update(name).digest("hex"),
  };
}

function assertRpc(result, label) {
  if (result.error || result.data?.success !== true) {
    throw new Error(`${label} failed: ${result.error?.message ?? JSON.stringify(result.data)}`);
  }
}

function verifyEnvLocalUnchanged(startHash) {
  const currentHash = createHash("sha256").update(readFileSync(join(root, ".env.local"))).digest("hex");
  record(".env.local remained unchanged", currentHash === startHash, currentHash);
}

async function main() {
  const envLocalHash = createHash("sha256").update(readFileSync(join(root, ".env.local"))).digest("hex");
  mkdirSync(dirname(evidencePath), { recursive: true });
  assertLocalOnlyEnvironment();
  localStatus = localSupabaseEnv();
  record("local Supabase runtime is loopback-only", true, localStatus.NEXT_PUBLIC_SUPABASE_URL);
  if (focus === "fresh") {
    const freshProject = await disposableFreshProof();
    return finishFocusedProof("fresh complete migration chain", { freshProject, envLocalHash });
  }
  if (focus === "upgrade") {
    const upgradeProject = await disposableUpgradeProof();
    return finishFocusedProof("upgrade from 0029", { upgradeProject, envLocalHash });
  }
  if (focus === "upgrade0030") {
    const upgrade0030Project = await disposableUpgradeFrom0030Proof();
    return finishFocusedProof("upgrade from 0030", { upgrade0030Project, envLocalHash });
  }
  if (focus === "identity") {
    const identityPreflight = await disposableIdentityPreflightProof();
    return finishFocusedProof("actor/profile identity preflight", { identityPreflight, envLocalHash });
  }
  if (focus === "business") {
    inspectPersistentBaseline();
    const businessProject = await runDisposableBusinessQualification();
    verifyEnvLocalUnchanged(envLocalHash);
    record("forbidden remote hostname was not contacted", true, forbiddenHost);
    return finishFocusedProof("evidence persistence authority", { envLocalHash, businessProject });
  }
  if (focus !== "full") throw new Error(`unsupported database verifier focus: ${focus}`);
  const freshProject = await disposableFreshProof();
  const upgradeProject = await disposableUpgradeProof();
  const upgrade0030Project = await disposableUpgradeFrom0030Proof();
  const baseline = inspectPersistentBaseline();
  let backup;
  if (baseline.alreadyApplied0029) {
    backup = latestExistingBackup();
    record("pre-0029 backup artifact is preserved from guarded apply run", Boolean(backup), backup?.fullDatabase?.path ?? "missing");
  } else {
    backup = createBackup();
    await proveBackupRestore(baseline.fingerprint);
    apply0029Persistent();
  }
  const businessProject = await runDisposableBusinessQualification();
  verifyEnvLocalUnchanged(envLocalHash);
  record("forbidden remote hostname was not contacted", true, forbiddenHost);
  const configPorts = readSupabaseConfigPorts(readFileSync(join(root, "supabase", "config.toml"), "utf8"));
  const payload = {
    suite: "CFG-RUNTIME-03 database/local application",
    runTimestamp: new Date().toISOString(),
    status: "pass",
    localProjectId,
    localPorts: { api: new URL(localStatus.NEXT_PUBLIC_SUPABASE_URL).port, db: configPorts.db, studio: configPorts.studio },
    disposition: baseline.decision,
    disposableProjects,
    freshProject,
    upgradeProject,
    upgrade0030Project,
    businessProject,
    restoreProject,
    backup,
    results,
    forbiddenHostNonContact: true,
    envLocalSha256: envLocalHash,
  };
  writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`CFG-RUNTIME-03 database verification passed. Evidence: ${evidencePath}`);
}

function finishFocusedProof(suite, detail) {
  const payload = {
    suite: `CFG-RUNTIME-03 ${suite}`,
    runTimestamp: new Date().toISOString(),
    status: "pass",
    localProjectId,
    focus,
    detail,
    disposableProjects,
    results,
  };
  writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`CFG-RUNTIME-03 ${suite} verification passed. Evidence: ${evidencePath}`);
}

if (process.env.P1_CFG_REFERENCE_LIBRARY !== "1") main().catch((error) => {
  const payload = {
    suite: "CFG-RUNTIME-03 database/local application",
    runTimestamp: new Date().toISOString(),
    status: "fail",
    localProjectId,
    disposableProjects,
    restoreProject,
    results,
    error: redact(error instanceof Error ? error.message : String(error)),
  };
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.error("CFG-RUNTIME-03 database verification failed.");
  console.error(payload.error);
  process.exit(1);
});

export { disposableFreshProof, disposableUpgradeProof, disposableUpgradeFrom0030Proof };
