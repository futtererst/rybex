import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertDisposableQualificationIdentity,
  createDisposableQualificationRuntime,
  teardownDisposableQualificationRuntime,
} from "./cfg-runtime-03-qualification-runtime.mjs";
import { createSanitizedChildEnv } from "./cfg-runtime-03-loopback-guard.mjs";

const root = resolve(process.cwd());
const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) throw new Error("qualification_child_command_required");

let runtime;
let childResult;
let residueCleanup;
let residue;
let cleanup;

try {
  runtime = await createDisposableQualificationRuntime({ root, label: "package" });
  assertDisposableQualificationIdentity({ ...runtime, env: runtime.env });
  const env = createSanitizedChildEnv({
    ...runtime.env,
    CFG_RUNTIME_01_DB_CONTAINER: runtime.dbContainer,
    CFG_RUNTIME_02_DB_CONTAINER: runtime.dbContainer,
    CFG_RUNTIME_03_DB_CONTAINER: runtime.dbContainer,
    CFG_RUNTIME_03_ACTIVE_ROOT: process.env.CFG_RUNTIME_03_ACTIVE_ROOT,
    CFG_RUNTIME_03_ACTIVE_RUN_ROOT: process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT,
    CFG_RUNTIME_03_EVIDENCE_NAMESPACE: process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE,
    CFG_RUNTIME_03_ATTEMPT_ID: process.env.CFG_RUNTIME_03_ATTEMPT_ID,
    CFG_RUNTIME_03_SUITE: process.env.CFG_RUNTIME_03_SUITE,
    CFG_RUNTIME_03_COMMAND_NUMBER: process.env.CFG_RUNTIME_03_COMMAND_NUMBER,
    CFG_RUNTIME_03_INVOCATION_ID: process.env.CFG_RUNTIME_03_INVOCATION_ID,
    CFG_RUNTIME_03_NESTED_OUTPUT_PARENT: process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT,
    CFG_RUNTIME_03_RUN_PHASE: process.env.CFG_RUNTIME_03_RUN_PHASE,
    CFG_RUNTIME_03_SOURCE_HEAD: process.env.CFG_RUNTIME_03_SOURCE_HEAD,
    CFG_RUNTIME_03_DIRTY_STATE_DESCRIPTION: process.env.CFG_RUNTIME_03_DIRTY_STATE_DESCRIPTION,
    P1_01A_RESULTS_PATH: process.env.P1_01A_RESULTS_PATH,
  });
  childResult = run(command, args, env);
  residueCleanup = cleanupQualificationRows(runtime.dbContainer);
  residue = inspectQualificationResidue(runtime.dbContainer);
  if (!residue.zero) throw new Error(`qualification_residue_detected:${JSON.stringify(residue)}`);
  if (childResult.status !== 0) {
    throw new Error(`qualification_child_failed:${childResult.status}\n${childResult.stdout}\n${childResult.stderr}`);
  }
} finally {
  if (runtime) cleanup = teardownDisposableQualificationRuntime(runtime, { tolerateMissing: false });
  process.stdout.write(`${JSON.stringify({
    qualificationRuntime: runtime ? {
      projectId: runtime.projectId,
      projectDir: runtime.projectDir,
      dbContainer: runtime.dbContainer,
      ports: runtime.ports,
      bindings: runtime.bindings,
    } : null,
    childExitCode: childResult?.status ?? null,
    residueCleanup: residueCleanup ?? null,
    residue: residue ?? null,
    cleanup: cleanup ?? null,
  })}\n`);
}

function cleanupQualificationRows(container) {
  const sql = `
    begin;
    set local session_replication_role = replica;
    delete from opportunity_bid_evidence_satisfactions;
    delete from opportunity_bid_submission_events;
    delete from opportunity_pursuit_authorization_events;
    delete from evidence_links;
    delete from evidence_objects;
    delete from opportunity_assignments;
    delete from opportunity_qualifications;
    delete from opportunities;
    commit;
  `;
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    cwd: root,
    input: sql,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) throw new Error(`qualification_residue_cleanup_failed:${result.stderr || result.stdout}`);
  return { exitCode: result.status, transaction: "committed", scope: "disposable qualification database only" };
}

function inspectQualificationResidue(container) {
  const sql = `
    select json_build_object(
      'opportunities', (select count(*) from opportunities),
      'qualifications', (select count(*) from opportunity_qualifications),
      'evidenceObjects', (select count(*) from evidence_objects),
      'evidenceLinks', (select count(*) from evidence_links),
      'authorityRows', (select count(*) from opportunity_bid_evidence_satisfactions)
    )::text;
  `;
  const result = spawnSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) throw new Error(`qualification_residue_inspection_failed:${result.stderr || result.stdout}`);
  const counts = JSON.parse(result.stdout.trim());
  return { ...counts, zero: Object.values(counts).every((value) => Number(value) === 0) };
}

function run(childCommand, childArgs, env) {
  const invocation = process.platform === "win32" && childCommand.endsWith(".cmd")
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", childCommand, ...childArgs] }
    : { command: childCommand, args: childArgs };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    env,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}
