import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverCfgRuntime03RepositoryRoot,
  resolveCfgRuntime03EvidenceNamespace,
} from "./cfg-runtime-03-repository-boundary.mjs";
import {
  compareCfgRuntime03ProtectedSnapshots,
  snapshotCfgRuntime03ProtectedArtifacts,
} from "./cfg-runtime-03-evidence-output.mjs";
import {
  deriveCfgRuntime03RetryCount,
  validateCfgRuntime03AttemptLedger,
} from "./cfg-runtime-03-qualification-attempt.mjs";

const root = discoverCfgRuntime03RepositoryRoot({ scriptPath: fileURLToPath(import.meta.url), cwd: process.cwd() });
const namespace = process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT;
const attemptId = requiredComponent("CFG_RUNTIME_03_ATTEMPT_ID");
const profile = requiredComponent("CFG_RUNTIME_03_ATTEMPT_PROFILE");
const copyA = process.argv.find((value) => value.startsWith("--copy-a="))?.slice(9) || process.env.CFG_RUNTIME_03_COPY_A;
const copySpaces = process.argv.find((value) => value.startsWith("--copy-spaces="))?.slice(14) || process.env.CFG_RUNTIME_03_COPY_SPACES;
const copyAManifest = process.argv.find((value) => value.startsWith("--copy-a-manifest="))?.slice(18) || process.env.CFG_RUNTIME_03_COPY_A_MANIFEST;
const copySpacesManifest = process.argv.find((value) => value.startsWith("--copy-spaces-manifest="))?.slice(23) || process.env.CFG_RUNTIME_03_COPY_SPACES_MANIFEST;
if (!namespace || !copyA || !copySpaces || !copyAManifest || !copySpacesManifest) {
  throw new Error("validated namespace and both relocated-copy paths/manifests are required");
}

const orderedOnly = process.argv.includes("--ordered-only");
const activeRunRoot = resolveCfgRuntime03EvidenceNamespace(root, namespace, { requireEmpty: false, create: true });
const attemptRoot = resolve(activeRunRoot, "attempts", attemptId);
if (existsSync(attemptRoot) && readdirSync(attemptRoot).length > 0) throw new Error(`attempt ${attemptId} already exists and cannot be resumed or relabeled`);
const ledgerRoot = resolve(attemptRoot, "manifests");
const logRoot = join(ledgerRoot, "logs");
mkdirSync(logRoot, { recursive: true });
const globalManifestRoot = resolve(activeRunRoot, "manifests");
mkdirSync(globalManifestRoot, { recursive: true });
const attemptLedgerPath = resolve(globalManifestRoot, "qualification-attempt-ledger.json");
const attemptLedger = existsSync(attemptLedgerPath) ? JSON.parse(readFileSync(attemptLedgerPath, "utf8")) : { schemaVersion: 1, attempts: [] };
if (attemptLedger.attempts.some((entry) => entry.attemptId === attemptId)) throw new Error(`attempt ${attemptId} is already recorded`);
const focused = focusedCommands();
const ordered = orderedCommands();
const entries = [];
const startedAt = new Date().toISOString();
const attempt = {
  attemptId,
  profile,
  startedAt,
  completedAt: null,
  status: "RUNNING",
  commands: entries,
  retryCount: 0,
  outputRoot: relative(root, attemptRoot).replaceAll("\\", "/"),
  preStateHash: null,
  postStateHash: null,
};
attemptLedger.attempts.push(attempt);
writeAttemptLedger();

let initialPreservedState;
try {
  initialPreservedState = capturePreservedState();
  assertPreserved(initialPreservedState);
  attempt.preStateHash = sha256(JSON.stringify(initialPreservedState));
  writeAttemptLedger();
  if (!orderedOnly) await runSequence("focused", focused);
  await runSequence("ordered", ordered);
} catch (error) {
  attempt.status = entries.length === 0 ? "ABORTED" : "FAILED";
  attempt.completedAt = new Date().toISOString();
  try {
    attempt.postStateHash = sha256(JSON.stringify(capturePreservedState()));
  } catch (captureError) {
    attempt.postStateHash = sha256(JSON.stringify({ unavailable: String(captureError?.message ?? captureError) }));
  }
  writeAttemptLedger();
  throw error;
}

const finalPreservedState = capturePreservedState();
assertPreserved(finalPreservedState);
if (JSON.stringify(finalPreservedState) !== JSON.stringify(initialPreservedState)) throw new Error("preserved database digest changed across qualification");
attempt.status = "PASSED";
attempt.completedAt = new Date().toISOString();
attempt.postStateHash = sha256(JSON.stringify(finalPreservedState));
writeAttemptLedger();
writeLedger("complete", { completedAt: new Date().toISOString(), initialPreservedState, finalPreservedState });
console.log(`PASS: ${orderedOnly ? "ordered rerun" : `${focused.length} focused and`} ${ordered.length} ordered commands completed sequentially`);
console.log(`Ledger: ${join(ledgerRoot, "command-ledger.json")}`);

async function runSequence(sequence, commands) {
  for (const command of commands) {
    const position = `${sequence}-${String(command.index).padStart(2, "0")}`;
    if (entries.some((entry) => entry.sequence === sequence && entry.index === command.index)) {
      throw new Error(`${position} cannot be executed twice within attempt ${attemptId}`);
    }
    const startedAt = new Date().toISOString();
    console.log(`\n[${position}] START ${command.display}`);
    const preservedBefore = command.databaseCapable ? capturePreservedState() : null;
    if (preservedBefore) assertPreserved(preservedBefore);
    const env = {
      ...process.env,
      DOCKER_CONTEXT: "desktop-linux",
      CFG_RUNTIME_03_ACTIVE_RUN_ROOT: namespace,
      CFG_RUNTIME_03_EVIDENCE_NAMESPACE: namespace,
      CFG_RUNTIME_03_ATTEMPT_ID: attemptId,
      CFG_RUNTIME_03_SUITE: sequence,
      CFG_RUNTIME_03_COMMAND_NUMBER: String(command.index),
      CFG_RUNTIME_03_INVOCATION_ID: `acceptance-${sequence}-${String(command.index).padStart(2, "0")}`,
      CFG_RUNTIME_03_RUN_PHASE: `${attemptId}-${position}`,
      CFG_RUNTIME_03_SOURCE_HEAD: "ef5cfe85fd7dc516db1bf0510b42147d47b0b1c6",
      CFG_RUNTIME_03_DIRTY_STATE_DESCRIPTION: "Prompt 13 bounded evidence-isolation remediation worktree",
    };
    if (/\b(?:build|qa-browser|regression)\b/i.test(command.display)) {
      rmSync(join(root, ".next"), { recursive: true, force: true });
    }
    const protectedBefore = snapshotCfgRuntime03ProtectedArtifacts(root, activeRunRoot);
    const result = await execute(command.file, command.args, env, position);
    const protectedAfter = snapshotCfgRuntime03ProtectedArtifacts(root, activeRunRoot);
    const historicalMutations = compareCfgRuntime03ProtectedSnapshots(protectedBefore, protectedAfter);
    const finishedAt = new Date().toISOString();
    const preservedAfter = command.databaseCapable ? capturePreservedState() : null;
    if (preservedAfter) {
      assertPreserved(preservedAfter);
      if (JSON.stringify(preservedAfter) !== JSON.stringify(preservedBefore)) throw new Error(`${position} changed the preserved database digest`);
    }
    const combined = `${result.stdout}\n${result.stderr}`;
    const entry = {
      sequence,
      index: command.index,
      requirement: command.requirement,
      exactCommand: command.display,
      workingDirectory: root,
      activeRepositoryRoot: root,
      validatedEvidenceNamespace: namespace,
      validatedOutputRoot: ledgerRoot,
      startedAt,
      finishedAt,
      exitCode: result.code,
      stdoutSha256: sha256(result.stdout),
      stderrSha256: sha256(result.stderr),
      retryCount: 0,
      warnings: extract(combined, /\bwarn(?:ing)?\b[^\r\n]*/gi),
      failures: result.code === 0 ? [] : extract(combined, /(?:\bfail(?:ed|ure)?\b|\berror\b)[^\r\n]*/gi),
      requiredSkips: count(combined, /required skip/gi),
      optionalSkips: count(combined, /optional skip/gi),
      childGuard: "synchronous CFG-RUNTIME-03 guard required by invoked repository path",
      preservedStateBefore: preservedBefore,
      preservedStateAfter: preservedAfter,
      preservedStateUnchanged: preservedBefore ? JSON.stringify(preservedBefore) === JSON.stringify(preservedAfter) : null,
      resourcesCreated: parseResourceIds(combined),
      actualBindings: extract(combined, /127\.0\.0\.1:\d+/g),
      residualRows: extract(combined, /(?:residu(?:e|al)|dangling)[^\r\n]*/gi),
      cleanup: extract(combined, /cleanup[^\r\n]*/gi),
      historicalEvidenceMutations: historicalMutations,
      stdoutLog: `logs/${position}.stdout.log`,
      stderrLog: `logs/${position}.stderr.log`,
    };
    entries.push(entry);
    writeAttemptLedger();
    writeLedger(result.code === 0 ? "in-progress" : "failed", { current: position });
    if (result.code !== 0) throw new Error(`${position} failed with exit ${result.code}: ${command.display}`);
    if (historicalMutations.length) throw new Error(`${position} changed ${historicalMutations.length} protected historical artifact(s)`);
    if (entry.requiredSkips || entry.optionalSkips) throw new Error(`${position} recorded a prohibited skip`);
    console.log(`[${position}] PASS`);
  }
}

function execute(file, args, env, position) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(file, args, { cwd: root, env, shell: file.toLowerCase().endsWith(".cmd"), windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { const value = chunk.toString(); stdout += value; process.stdout.write(value); });
    child.stderr.on("data", (chunk) => { const value = chunk.toString(); stderr += value; process.stderr.write(value); });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      writeFileSync(join(logRoot, `${position}.stdout.log`), stdout);
      writeFileSync(join(logRoot, `${position}.stderr.log`), stderr);
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });
}

function capturePreservedState() {
  const sql = `with state as (
 select 'opportunities' k,count(*)::text c,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) h from public.opportunities t
 union all select 'qualifications',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.opportunity_qualifications t
 union all select 'evidence_objects',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.evidence_objects t
 union all select 'evidence_links',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.evidence_links t
 union all select 'assignments',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.opportunity_assignments t
 union all select 'authority',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.opportunity_bid_evidence_satisfactions t
 union all select 'audit_events',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.audit_events t
 union all select 'projects',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.projects t
 union all select 'migrations',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by version::text),'')) from supabase_migrations.schema_migrations t
 union all select 'profiles',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.user_profiles t
 union all select 'auth_users',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from auth.users t
 union all select 'memberships',count(*)::text,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id::text),'')) from public.workspace_memberships t
), dangling as (
 select count(*)::bigint c from public.evidence_links el where
 (el.entity_type='opportunity' and not exists(select 1 from public.opportunities o where o.id=el.entity_id)) or
 (el.entity_type='opportunity_qualification' and not exists(select 1 from public.opportunity_qualifications q where q.id=el.entity_id))
) select jsonb_build_object('tables',(select jsonb_object_agg(k,jsonb_build_object('count',c::bigint,'md5',h) order by k) from state),'danglingLinks',(select c from dangling))::text;`;
  const result = spawnSync("docker", ["exec", "supabase_db_rybex-2-local", "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: root, env: { ...process.env, DOCKER_CONTEXT: "desktop-linux" }, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 10,
  });
  if (result.status !== 0) throw new Error(`preserved-state capture failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim());
}

function assertPreserved(state) {
  const expected = {
    opportunities: [2, "2a2b72d070c08874fa2d830d1dfe9773"], qualifications: [2, "b05dc928a1981d20a2733e0d1e92a559"],
    evidence_objects: [0, "d41d8cd98f00b204e9800998ecf8427e"], evidence_links: [0, "d41d8cd98f00b204e9800998ecf8427e"],
    assignments: [0, "d41d8cd98f00b204e9800998ecf8427e"], authority: [0, "d41d8cd98f00b204e9800998ecf8427e"],
    audit_events: [19695, "ae0505f30079e419f14f74ed6f3bd67d"], projects: [2, "732d79bd41926c12ddc3361dfda61279"],
    migrations: [31, "3b525be1b7668c3a99871b172bddde9c"], profiles: [15, "cf273519b324c1303f9dd6344837eb3d"],
    auth_users: [16, "23f19578e8d13a6de735b26d55cff1b5"], memberships: [15, "627eddba294554bf9674c67c1a80f1fb"],
  };
  for (const [key, [countValue, md5]] of Object.entries(expected)) {
    if (state.tables?.[key]?.count !== countValue || state.tables?.[key]?.md5 !== md5) throw new Error(`preserved ${key} differs from the independently proven baseline`);
  }
  if (state.danglingLinks !== 0) throw new Error("preserved database has dangling evidence links");
}

function writeLedger(status, extra = {}) {
  writeFileSync(join(ledgerRoot, "command-ledger.json"), `${JSON.stringify({
    status, generatedAt: new Date().toISOString(), repositoryRoot: root, evidenceNamespace: namespace,
    focusedExpected: 43, orderedExpected: 27, entries, ...extra,
  }, null, 2)}\n`);
}

function writeAttemptLedger() {
  attempt.retryCount = deriveCfgRuntime03RetryCount(attempt.commands);
  validateCfgRuntime03AttemptLedger(attemptLedger);
  writeFileSync(attemptLedgerPath, `${JSON.stringify({
    ...attemptLedger,
    generatedAt: new Date().toISOString(),
    globalDisclosureComplete: true,
    retrySemantics: "retryCount is derived from duplicate command keys within this identified attempt; prior attempts remain separately disclosed",
  }, null, 2)}\n`);
}

function requiredComponent(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error(`${name} is required and must be lowercase hyphenated text`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function focusedCommands() {
  const npm = (index, requirement, script, databaseCapable = false, extra = []) => command(index, requirement, "npm.cmd", ["run", script, ...extra], databaseCapable);
  return [
    npm(1, "Complete candidate-inventory verifier", "cfg-runtime-03:verify-complete-candidate-inventory"),
    npm(2, "Complete ignored-code-shaped-universe verifier", "cfg-runtime-03:verify-ignored-code-universe"),
    npm(3, "Complete repository-universe digest verifier", "cfg-runtime-03:verify-complete-universe"),
    npm(4, "Protected-hash verifier", "cfg-runtime-03:verify-protected-hashes"),
    npm(5, "Migrations 0029/0030/0031 immutability", "cfg-runtime-03:verify-migration-immutability"),
    npm(6, "Preserved-database baseline verifier", "cfg-runtime-03:verify-authoritative-baseline", true),
    command(7, "Package/reference/revision domain-contract tests", "node", ["scripts/verify-cfg-runtime-03-revision-authority.mjs", "--case=domain"]),
    command(8, "Package-revision database reconciliation tests", "node", ["scripts/verify-cfg-runtime-03-revision-authority.mjs", "--case=database"], true),
    command(9, "Held-state revision-authority tests", "node", ["scripts/verify-cfg-runtime-03-revision-authority.mjs", "--case=held"]),
    command(10, "Approved-state revision-authority tests", "node", ["scripts/verify-cfg-runtime-03-revision-authority.mjs", "--case=approved"]),
    command(11, "Revision-authority negative controls", "node", ["scripts/verify-cfg-runtime-03-revision-authority.mjs", "--case=negative"]),
    command(12, "Revision UI-rendering tests", "node", ["scripts/verify-cfg-runtime-03-revision-authority.mjs", "--case=ui"]),
    npm(13, "Root-discovery tests in original repository", "cfg-runtime-03:verify-root-output-original"),
    command(14, "Output-root tests in original repository", "node", ["scripts/verify-cfg-runtime-03-root-output-authority.mjs", "--mode=original"]),
    command(15, "Relocated-copy test at different path", "node", ["scripts/verify-cfg-runtime-03-relocated-copy.mjs", `--copy=${copyA}`, `--browser-manifest=${copyAManifest}`]),
    command(16, "Relocated-copy test at path containing spaces", "node", ["scripts/verify-cfg-runtime-03-relocated-copy.mjs", `--copy=${copySpaces}`, `--browser-manifest=${copySpacesManifest}`]),
    command(17, "Root-confusion negative controls", "node", ["scripts/verify-cfg-runtime-03-root-output-authority.mjs", "--mode=negative", "--case=root"]),
    command(18, "Output-containment negative controls", "node", ["scripts/verify-cfg-runtime-03-root-output-authority.mjs", "--mode=negative", "--case=output"]),
    command(19, "Symlink/junction/reparse controls", "node", ["scripts/verify-cfg-runtime-03-root-output-authority.mjs", "--mode=negative", "--case=reparse"]),
    npm(20, "Package-script caller graph verifier", "cfg-runtime-03:verify-launch-authority"),
    command(21, "Seven guarded startup-path tests", "node", ["scripts/verify-cfg-runtime-03-launch-authority.mjs", "--case=positive"]),
    command(22, "Startup-bypass negative controls", "node", ["scripts/verify-cfg-runtime-03-launch-authority.mjs", "--case=negative"]),
    npm(23, "Preserved-stack targeting rejection", "cfg-runtime-03:verify-preserved-write-rejection", true),
    npm(24, "Docker prelaunch binding controls", "cfg-runtime-03:verify-loopback-boundary"),
    npm(25, "Live Docker post-start inspection", "cfg-runtime-03:inspect-bindings", true),
    npm(26, "Qualification-residue verifier", "cfg-runtime-03:verify-qualification-residue", true),
    npm(27, "Fresh migration chain through 0031", "cfg-runtime-03:verify-migration-fresh", true),
    npm(28, "Upgrade from 0029", "cfg-runtime-03:verify-migration-upgrade", true),
    npm(29, "Upgrade from 0030", "cfg-runtime-03:verify-migration-upgrade-0030", true),
    npm(30, "Actor/profile identity coherence", "cfg-runtime-03:verify-identity-coherence", true),
    npm(31, "Evidence transaction and cross-boundary controls", "cfg-runtime-03:verify-evidence-authority", true),
    command(32, "Evidence read-model tests", "node", ["scripts/verify-cfg-runtime-03-database.mjs", "--focus=business"], true),
    command(33, "Evidence UI tests", "node", ["scripts/verify-cfg-runtime-03-static.mjs", "--case=evidence-ui"]),
    npm(34, "Focused PrimaryNav tests", "cfg-runtime-03:verify-primary-nav"),
    npm(35, "Focused workflow-runtime tests", "cfg-runtime-03:verify-workflow-runtime"),
    npm(36, "TypeScript typecheck", "typecheck"),
    npm(37, "Workflow action verification", "workflow:verify-actions"),
    npm(38, "CFG-RUNTIME-03 static verification", "cfg-runtime-03:verify-static"),
    npm(39, "CFG-RUNTIME-03 database verification", "cfg-runtime-03:verify-database", true),
    npm(40, "CFG-RUNTIME-03 loopback boundary", "cfg-runtime-03:verify-loopback-boundary"),
    npm(41, "Production build", "build"),
    npm(42, "Lint", "lint"),
    command(43, "Git whitespace validation", "git", ["diff", "--check"]),
  ];
}

function orderedCommands() {
  const npm = (index, requirement, script, databaseCapable = false) => command(index, requirement, "npm.cmd", ["run", script], databaseCapable);
  return [
    command(1, "git status", "git", ["status", "--short", "--branch"]),
    command(2, "clean dependency installation", "npm.cmd", ["ci", "--ignore-scripts", "--prefer-offline", "--no-audit"]),
    command(3, "repository-local Supabase CLI version", process.execPath, [join(root, "node_modules/supabase/dist/supabase.js"), "--version"]),
    npm(4, "loopback boundary", "cfg-runtime-03:verify-loopback-boundary"),
    npm(5, "configuration foundation", "configuration:verify-foundation"),
    npm(6, "configuration negative controls", "configuration:verify-foundation-negative-controls"),
    npm(7, "configuration database", "configuration:verify-foundation-database", true),
    npm(8, "CFG-RUNTIME-03 static", "cfg-runtime-03:verify-static"),
    npm(9, "CFG-RUNTIME-03 database", "cfg-runtime-03:verify-database", true),
    npm(10, "CFG-RUNTIME-03 browser", "cfg-runtime-03:qa-browser", true),
    npm(11, "CFG-RUNTIME-03 full regression", "cfg-runtime-03:regression", true),
    npm(12, "CFG-RUNTIME-02 static", "cfg-runtime-02:verify-static"),
    npm(13, "CFG-RUNTIME-02 database", "cfg-runtime-02:verify-database", true),
    npm(14, "CFG-RUNTIME-02 browser", "cfg-runtime-02:qa-browser", true),
    npm(15, "CFG-RUNTIME-01 static", "cfg-runtime-01:verify-static"),
    npm(16, "CFG-RUNTIME-01 database", "cfg-runtime-01:verify-database", true),
    npm(17, "CFG-RUNTIME-01 browser", "cfg-runtime-01:qa-browser", true),
    npm(18, "P1-01A static", "p1-01a:verify"),
    npm(19, "P1-01A database", "p1-01a:qa-db", true),
    npm(20, "P1-01A browser", "p1-01a:qa-browser", true),
    npm(21, "P1-01B.1 verify", "p1-01b-1:verify"),
    npm(22, "P1-01B.2 verify", "p1-01b-2:verify"),
    npm(23, "workflow actions", "workflow:verify-actions"),
    npm(24, "build", "build"),
    npm(25, "typecheck", "typecheck"),
    npm(26, "lint", "lint"),
    command(27, "git diff check", "git", ["diff", "--check"]),
  ];
}

function command(index, requirement, file, args, databaseCapable = false) {
  return { index, requirement, file, args, databaseCapable, display: [file, ...args].map(quote).join(" ") };
}
function quote(value) { return /\s/.test(value) ? `"${value}"` : value; }
function count(value, regex) { return value.match(regex)?.length ?? 0; }
function extract(value, regex) { return [...new Set(value.match(regex) ?? [])].slice(0, 50); }
function parseResourceIds(value) { return extract(value, /rybex-cfg03-q-[a-z0-9-]+/g); }
