import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  prepareCfgRuntime03EvidenceOutput,
} from "./cfg-runtime-03-evidence-output.mjs";
import { validateCfgRuntime03AttemptLedger } from "./cfg-runtime-03-qualification-attempt.mjs";
import {
  discoverCfgRuntime03RepositoryRoot,
  resolveCfgRuntime03EvidenceNamespace,
} from "./cfg-runtime-03-repository-boundary.mjs";

const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd() });
const namespace = String(process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT ?? "");
const activeRoot = resolveCfgRuntime03EvidenceNamespace(root, namespace, { requireEmpty: false, create: true });
const fixtureRoot = resolve(activeRoot, "negative-fixtures");
const runKey = String(process.env.CFG_RUNTIME_03_NEGATIVE_RUN_ID ?? Date.now()).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
mkdirSync(fixtureRoot, { recursive: true });
const originalEnv = { ...process.env };
const results = [];

try {
  reject("Missing active-run root", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "" }, "missing_active_output");
  reject("Historical Prompt 1 evidence root", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "artifacts/cfg-runtime-03-independent-review/2026-08-11T00-00-00-000Z" }, "historical_root");
  reject("Prompt 11 candidate evidence root", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "artifacts/cfg-runtime-03-final-remediation/2026-08-12T22-40-02-287Z" }, "historical_root");
  reject("Prompt 12 review evidence root", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "artifacts/cfg-runtime-03-final-independent-rereview/2026-08-13T09-27-50-909Z" }, "historical_root");
  reject("Parent traversal", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "artifacts/cfg-runtime-03-evidence-isolation-remediation/../escape" });
  reject("Absolute output path", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: resolve(activeRoot, "absolute") });
  reject("UNC output path", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "//server/share/artifacts/cfg-runtime-03-evidence-isolation-remediation/2026-08-13T11-51-01-582Z" });
  reject("Alternate-drive output path", { CFG_RUNTIME_03_ACTIVE_RUN_ROOT: "Z:/artifacts/cfg-runtime-03-evidence-isolation-remediation/2026-08-13T11-51-01-582Z" });

  const reparseAttempt = id("negative-reparse");
  const reparseParent = resolve(activeRoot, "attempts");
  const reparseTarget = resolve(fixtureRoot, "reparse-target");
  mkdirSync(reparseTarget, { recursive: true });
  mkdirSync(reparseParent, { recursive: true });
  try {
    symlinkSync(reparseTarget, resolve(reparseParent, reparseAttempt), process.platform === "win32" ? "junction" : "dir");
    reject("Symlink, junction, or reparse escape", baseEnv({ CFG_RUNTIME_03_ATTEMPT_ID: reparseAttempt }), "reparse_escape");
  } catch (error) {
    if (!["EPERM", "EACCES"].includes(error?.code)) throw error;
    results.push(pass("Symlink, junction, or reparse escape", "OS denied creation before escape existed"));
  } finally {
    rmSync(resolve(reparseParent, reparseAttempt), { recursive: true, force: true });
  }

  const nonemptyAttempt = id("negative-nonempty");
  const nonempty = baseEnv({ CFG_RUNTIME_03_ATTEMPT_ID: nonemptyAttempt, CFG_RUNTIME_03_INVOCATION_ID: "occupied" });
  const nonemptyRoot = resolve(activeRoot, `attempts/${nonemptyAttempt}/development/command-1/occupied`);
  mkdirSync(nonemptyRoot, { recursive: true });
  writeFileSync(join(nonemptyRoot, "existing.txt"), "occupied\n");
  reject("Pre-existing nonempty command directory", nonempty, "invocation_reuse");

  const reusedEnv = baseEnv({ CFG_RUNTIME_03_ATTEMPT_ID: id("negative-reuse"), CFG_RUNTIME_03_INVOCATION_ID: "same-invocation" });
  withEnv(reusedEnv, () => {
    const output = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
    writeFileSync(join(output.temporaryRoot, "proof.txt"), "first\n");
    output.finalize();
  });
  reject("Reused command invocation directory", reusedEnv, "invocation_reuse");

  const collisionAttempt = id("negative-collision");
  const commandA = baseEnv({ CFG_RUNTIME_03_ATTEMPT_ID: collisionAttempt, CFG_RUNTIME_03_COMMAND_NUMBER: "1", CFG_RUNTIME_03_INVOCATION_ID: "shared-name" });
  const commandB = baseEnv({ CFG_RUNTIME_03_ATTEMPT_ID: collisionAttempt, CFG_RUNTIME_03_COMMAND_NUMBER: "2", CFG_RUNTIME_03_INVOCATION_ID: "shared-name" });
  const finalA = commitProof(commandA, "a");
  const finalB = commitProof(commandB, "b");
  results.push(finalA !== finalB ? pass("Output collision between two commands", `${relative(root, finalA)} != ${relative(root, finalB)}`) : fail("Output collision between two commands", "paths collided"));

  const sentinel = resolve(fixtureRoot, "outside-command-sentinel.txt");
  writeFileSync(sentinel, "protected-sentinel\n");
  const sentinelHash = sha(readFileSync(sentinel));
  const outsideEnv = baseEnv({ CFG_RUNTIME_03_ATTEMPT_ID: id("negative-child"), CFG_RUNTIME_03_INVOCATION_ID: "exit-zero-writer" });
  let detected = false;
  withEnv(outsideEnv, () => {
    const output = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
    writeFileSync(join(output.temporaryRoot, "proof.txt"), "child returned zero\n");
    const child = spawnSync(process.execPath, ["-e", `require('fs').writeFileSync(${JSON.stringify(sentinel)},'mutated\\n')`], { cwd: root });
    if (child.status !== 0) throw new Error("controlled child did not exit zero");
    try { output.finalize(); } catch (error) { detected = error?.category === "protected_artifact_mutation"; }
    output.abort();
  });
  writeFileSync(sentinel, "protected-sentinel\n");
  const childBoundaryPassed = detected && sha(readFileSync(sentinel)) === sentinelHash;
  results.push(childBoundaryPassed
    ? pass("Child-process write outside active command root", "outside write detected; sentinel restored")
    : fail("Child-process write outside active command root", "outside write was not detected"));
  results.push(childBoundaryPassed
    ? pass("Command exits zero after modifying a protected file", "exit zero did not bypass postcondition enforcement")
    : fail("Command exits zero after modifying a protected file", "exit zero concealed a mutation"));

  const duplicateCommandLedger = ledger([
    attempt("acceptance-one", "acceptance", "FAILED", [{ sequence: "focused", index: 1, retryCount: 0 }, { sequence: "focused", index: 1, retryCount: 0 }], 0),
  ]);
  rejectsLedger("Re-execution within same acceptance attempt", duplicateCommandLedger, "command_retry");

  const disclosed = ledger([
    attempt("acceptance-failed", "acceptance", "FAILED", [], 0),
    attempt("acceptance-clean", "acceptance", "PASSED", [], 0),
  ]);
  results.push(validateCfgRuntime03AttemptLedger(disclosed) && disclosed.attempts.length === 2
    ? pass("Prior failed attempt cannot be concealed", "both immutable attempts remain disclosed")
    : fail("Prior failed attempt cannot be concealed", "ledger validation failed"));

  const falsified = ledger([
    attempt("acceptance-failed-two", "acceptance", "FAILED", [], 0),
    attempt("acceptance-falsified", "acceptance", "PASSED", [{ sequence: "focused", index: 1, retryCount: 0 }], 1),
  ]);
  rejectsLedger("Manual falsification of retryCount", falsified, "retry_falsification");

  const formerDestinations = [
    "ordered-14-cfg-runtime-02",
    "ordered-17-cfg-runtime-01",
    "ordered-21-p1-01b-1",
    "ordered-22-p1-01b-2",
  ].map((name) => {
    const path = resolve(fixtureRoot, `${name}.sentinel`);
    writeFileSync(path, `${name}:protected\n`);
    return { name, path, sha256: sha(readFileSync(path)) };
  });
  results.push(formerDestinations.every((entry) => sha(readFileSync(entry.path)) === entry.sha256)
    ? pass("Four former destination sentinels", "all four remain byte-identical")
    : fail("Four former destination sentinels", "sentinel changed"));

  const failures = results.filter((entry) => entry.status !== "PASS");
  const ledgerPath = resolve(activeRoot, "negative-control-ledger.json");
  writeFileSync(ledgerPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), count: results.length, failures: failures.length, results }, null, 2)}\n`);
  for (const result of results) console.log(`${result.status}: ${result.control} - ${result.detail}`);
  if (failures.length) process.exitCode = 1;
} finally {
  Object.keys(process.env).forEach((key) => { if (!(key in originalEnv)) delete process.env[key]; });
  Object.assign(process.env, originalEnv);
}

function reject(control, env, category) {
  let error;
  withEnv({ ...baseEnv(), ...env }, () => {
    try {
      const output = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
      output.abort();
    } catch (caught) { error = caught; }
  });
  results.push(error && (!category || error.category === category)
    ? pass(control, `${error.category}: rejected`)
    : fail(control, error ? `wrong rejection ${error.category}` : "unexpectedly accepted"));
}

function commitProof(env, text) {
  return withEnv(env, () => {
    const output = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
    writeFileSync(join(output.temporaryRoot, "proof.txt"), `${text}\n`);
    return output.finalize();
  });
}

function baseEnv(overrides = {}) {
  return {
    CFG_RUNTIME_03_ACTIVE_RUN_ROOT: namespace,
    CFG_RUNTIME_03_ATTEMPT_ID: id("negative-default"),
    CFG_RUNTIME_03_SUITE: "development",
    CFG_RUNTIME_03_COMMAND_NUMBER: "1",
    CFG_RUNTIME_03_INVOCATION_ID: "negative-default",
    ...overrides,
  };
}

function withEnv(values, operation) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return operation(); }
  finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function id(prefix) { return `${prefix}-${runKey}`; }

function ledger(attempts) { return { schemaVersion: 1, attempts }; }
function attempt(attemptId, profile, status, commands, retryCount) {
  return { attemptId, profile, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status, commands, retryCount, outputRoot: "fixture", preStateHash: "a", postStateHash: "b" };
}
function rejectsLedger(control, value, category) {
  let error;
  try { validateCfgRuntime03AttemptLedger(value); } catch (caught) { error = caught; }
  results.push(error?.category === category ? pass(control, `${category}: rejected`) : fail(control, error?.message ?? "unexpectedly accepted"));
}
function pass(control, detail) { return { control, status: "PASS", detail }; }
function fail(control, detail) { return { control, status: "FAIL", detail }; }
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
