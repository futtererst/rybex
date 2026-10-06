import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compareCfgRuntime03ProtectedSnapshots,
  snapshotCfgRuntime03ProtectedArtifacts,
} from "./cfg-runtime-03-evidence-output.mjs";
import {
  discoverCfgRuntime03RepositoryRoot,
  resolveCfgRuntime03EvidenceNamespace,
} from "./cfg-runtime-03-repository-boundary.mjs";

const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd() });
const namespace = String(process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT ?? "");
const activeRoot = resolveCfgRuntime03EvidenceNamespace(root, namespace, { requireEmpty: false, create: true });
const attemptId = String(process.env.CFG_RUNTIME_03_TARGETED_ATTEMPT_ID ?? "targeted-four-command-reproduction");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(attemptId)) throw new Error("invalid targeted attempt identifier");
const ledgerPath = resolve(activeRoot, "targeted-four-command-ledger.json");
const priorLedger = existsLedger();
if (priorLedger.attempts.some((entry) => entry.attemptId === attemptId)) throw new Error(`targeted attempt ${attemptId} already exists`);
const commands = [
  { number: 14, exact: ["npm.cmd", "run", "cfg-runtime-02:qa-browser"] },
  { number: 17, exact: ["npm.cmd", "run", "cfg-runtime-01:qa-browser"] },
  { number: 21, exact: ["npm.cmd", "run", "p1-01b-1:verify"], writerProbe: ["npm.cmd", "run", "p1-01b-1:capture"] },
  { number: 22, exact: ["npm.cmd", "run", "p1-01b-2:verify"], writerProbe: ["npm.cmd", "run", "p1-01b-2:capture"] },
];
const beforeDatabase = databaseDigest();
const entries = [];
const currentAttempt = { attemptId, startedAt: new Date().toISOString(), completedAt: null, status: "RUNNING", entries };
priorLedger.attempts.push(currentAttempt);
writeLedger();

for (const command of commands) {
  const before = snapshotCfgRuntime03ProtectedArtifacts(root, activeRoot);
  const env = commandEnv(command.number, `targeted-ordered-${command.number}`);
  const primary = execute(command.exact, env);
  let probe = null;
  if (primary.exitCode === 0 && command.writerProbe) {
    probe = execute(command.writerProbe, commandEnv(command.number, `targeted-ordered-${command.number}-writer-probe`));
  }
  const after = snapshotCfgRuntime03ProtectedArtifacts(root, activeRoot);
  const mutations = compareCfgRuntime03ProtectedSnapshots(before, after);
  const entry = {
    orderedCommandNumber: command.number,
    exactCommand: command.exact.join(" "),
    writerProbe: command.writerProbe?.join(" ") ?? null,
    startedAt: primary.startedAt,
    completedAt: probe?.completedAt ?? primary.completedAt,
    exitCode: primary.exitCode,
    writerProbeExitCode: probe?.exitCode ?? null,
    stdoutSha256: primary.stdoutSha256,
    stderrSha256: primary.stderrSha256,
    writerProbeStdoutSha256: probe?.stdoutSha256 ?? null,
    writerProbeStderrSha256: probe?.stderrSha256 ?? null,
    historicalEvidenceMutations: mutations,
    semanticPostcondition: primary.exitCode === 0 && (!probe || probe.exitCode === 0) && mutations.length === 0 ? "PASS" : "FAIL",
  };
  entries.push(entry);
  if (entry.semanticPostcondition !== "PASS") {
    currentAttempt.status = "FAILED";
    currentAttempt.completedAt = new Date().toISOString();
    writeLedger();
    process.exit(1);
  }
}

const afterDatabase = databaseDigest();
if (beforeDatabase !== afterDatabase) throw new Error("targeted reproduction changed the preserved database digest");
currentAttempt.status = "PASSED";
currentAttempt.completedAt = new Date().toISOString();
currentAttempt.beforeDatabaseSha256 = beforeDatabase;
currentAttempt.afterDatabaseSha256 = afterDatabase;
writeLedger();
console.log("PASS: targeted ordered commands 14, 17, 21, and 22 plus the two regression-child writer probes remained isolated");

function commandEnv(number, invocationId) {
  return {
    ...process.env,
    DOCKER_CONTEXT: "desktop-linux",
    CFG_RUNTIME_03_ACTIVE_ROOT: root,
    CFG_RUNTIME_03_ACTIVE_RUN_ROOT: namespace,
    CFG_RUNTIME_03_EVIDENCE_NAMESPACE: namespace,
    CFG_RUNTIME_03_ATTEMPT_ID: attemptId,
    CFG_RUNTIME_03_SUITE: "targeted",
    CFG_RUNTIME_03_COMMAND_NUMBER: String(number),
    CFG_RUNTIME_03_INVOCATION_ID: invocationId,
    CFG_RUNTIME_03_RUN_PHASE: `targeted-ordered-${number}`,
    CFG_RUNTIME_03_SOURCE_HEAD: "ef5cfe85fd7dc516db1bf0510b42147d47b0b1c6",
    CFG_RUNTIME_03_DIRTY_STATE_DESCRIPTION: "Prompt 13 targeted evidence-isolation reproduction",
  };
}

function execute(invocation, env) {
  const startedAt = new Date().toISOString();
  const [file, ...args] = invocation;
  const result = spawnSync(file, args, { cwd: root, env, encoding: "utf8", shell: file.endsWith(".cmd"), maxBuffer: 1024 * 1024 * 100 });
  const completedAt = new Date().toISOString();
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? result.error?.message ?? "");
  return {
    startedAt,
    completedAt,
    exitCode: result.status ?? -1,
    stdoutSha256: sha(result.stdout ?? ""),
    stderrSha256: sha(result.stderr ?? result.error?.message ?? ""),
  };
}

function databaseDigest() {
  const sql = `select md5(jsonb_build_object(
    'opportunities',(select jsonb_agg(row_to_json(t) order by id) from public.opportunities t),
    'qualifications',(select jsonb_agg(row_to_json(t) order by id) from public.opportunity_qualifications t),
    'evidence_objects',(select jsonb_agg(row_to_json(t) order by id) from public.evidence_objects t),
    'evidence_links',(select jsonb_agg(row_to_json(t) order by id) from public.evidence_links t),
    'audit_events',(select jsonb_agg(row_to_json(t) order by id) from public.audit_events t),
    'projects',(select jsonb_agg(row_to_json(t) order by id) from public.projects t)
  )::text);`;
  const result = spawnSync("docker", ["exec", "supabase_db_rybex-2-local", "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: root, env: { ...process.env, DOCKER_CONTEXT: "desktop-linux" }, encoding: "utf8", shell: false,
  });
  if (result.status !== 0) throw new Error(`database digest failed: ${result.stderr}`);
  return result.stdout.trim();
}

function writeLedger() {
  writeFileSync(ledgerPath, `${JSON.stringify({
    ...priorLedger,
    generatedAt: new Date().toISOString(),
    globalDisclosureComplete: true,
  }, null, 2)}\n`);
}

function existsLedger() {
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath, "utf8"));
    if (Array.isArray(parsed.attempts)) return parsed;
    return {
      schemaVersion: 1,
      attempts: [{ attemptId: parsed.attemptId, startedAt: parsed.entries?.[0]?.startedAt ?? null, completedAt: parsed.generatedAt, status: parsed.status, entries: parsed.entries ?? [] }],
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { schemaVersion: 1, attempts: [] };
  }
}

function sha(value) { return createHash("sha256").update(String(value)).digest("hex"); }
