import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverCfgRuntime03RepositoryRoot,
  resolveCfgRuntime03EvidenceNamespace,
  resolveCfgRuntime03OutputDirectory,
  validateCfgRuntime03RepositoryRoot,
} from "./cfg-runtime-03-repository-boundary.mjs";

const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.slice(7) ?? "original";
const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd(), callerRoot: process.env.CFG_RUNTIME_03_ACTIVE_ROOT });
const inheritedActiveRunRoot = process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT;
const inheritedEvidenceNamespace = process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE;
const failures = [];
const cleanup = [];

try {
  delete process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT;
  delete process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE;
  if (mode === "original") runOriginal();
  else if (mode === "negative") runNegative();
  else throw new Error(`unsupported mode ${mode}`);
} finally {
  for (const path of cleanup.reverse()) rmSync(path, { recursive: true, force: true });
  if (inheritedActiveRunRoot !== undefined) process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT = inheritedActiveRunRoot;
  if (inheritedEvidenceNamespace !== undefined) process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE = inheritedEvidenceNamespace;
}
if (failures.length) process.exit(1);
console.log(`CFG-RUNTIME-03 root/output authority ${mode} verification passed.`);

function runOriginal() {
  check("script and cwd discover the same active repository", () => root === discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: root }));
  check("multiple canonical markers validate", () => validateCfgRuntime03RepositoryRoot(root) === root);
  const namespace = temporaryNamespace("original");
  const output = resolveCfgRuntime03OutputDirectory(root, namespace, "proof", { create: true });
  cleanup.push(resolve(root, ...namespace.split("/")));
  check("bounded relative namespace resolves beneath active repository", () => relative(resolve(root, "artifacts"), output) && !relative(resolve(root, "artifacts"), output).startsWith(".."));
  check("Prompt 12 purpose family is supported", () => {
    const reviewNamespace = temporaryNamespace("final-independent-rereview");
    const review = resolveCfgRuntime03EvidenceNamespace(root, reviewNamespace, { create: true });
    cleanup.push(review);
    return review.includes("cfg-runtime-03-final-independent-rereview");
  });
}

function runNegative() {
  for (const value of [
    resolve(root, "artifacts/cfg-runtime-03-final-remediation/2026-08-12T23-00-00-000Z"),
    "../artifacts/cfg-runtime-03-final-remediation/2026-08-12T23-00-00-000Z",
    "//server/share/artifacts/cfg-runtime-03-final-remediation/2026-08-12T23-00-00-000Z",
    "Z:/artifacts/cfg-runtime-03-final-remediation/2026-08-12T23-00-00-000Z",
    "artifacts/cfg-runtime-03-FINAL/2026-08-12T23-00-00-000Z",
  ]) expectFailure(`reject unsafe namespace ${value}`, () => resolveCfgRuntime03EvidenceNamespace(root, value));

  const nonemptyNamespace = temporaryNamespace("nonempty");
  const nonempty = resolve(root, ...nonemptyNamespace.split("/"));
  mkdirSync(nonempty, { recursive: true });
  writeFileSync(join(nonempty, "existing.txt"), "protected\n");
  cleanup.push(nonempty);
  expectFailure("preexisting nonempty namespace rejected", () => resolveCfgRuntime03EvidenceNamespace(root, nonemptyNamespace));

  const escapeNamespace = temporaryNamespace("reparse");
  const escapeRoot = resolve(root, ...escapeNamespace.split("/"));
  mkdirSync(escapeRoot, { recursive: true });
  const outside = mkdtempSync(join(tmpdir(), "cfg03-output-escape-"));
  cleanup.push(escapeRoot, outside);
  try {
    symlinkSync(outside, join(escapeRoot, "escape"), process.platform === "win32" ? "junction" : "dir");
    expectFailure("symlink junction or reparse escape rejected", () => resolveCfgRuntime03OutputDirectory(root, escapeNamespace, "escape"));
  } catch (error) {
    check("symlink junction or reparse control unavailable only when OS denies creation", () => error && ["EPERM", "EACCES"].includes(error.code));
  }

  const arbitrary = mkdtempSync(join(tmpdir(), "cfg03-arbitrary-markers-"));
  cleanup.push(arbitrary);
  copyMarkers(arbitrary);
  writeFileSync(join(arbitrary, "supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql"), "altered\n");
  expectFailure("arbitrary copied markers and mismatched migration rejected", () => validateCfgRuntime03RepositoryRoot(arbitrary));

  const badLock = mkdtempSync(join(tmpdir(), "cfg03-bad-lock-"));
  cleanup.push(badLock);
  copyMarkers(badLock);
  const lockPath = join(badLock, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.packages["node_modules/supabase"].version = "2.108.0";
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  expectFailure("mismatched lockfile rejected", () => validateCfgRuntime03RepositoryRoot(badLock));
  expectFailure("caller-supplied different repository root rejected", () => discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: root, callerRoot: badLock }));
  expectFailure("script location and cwd from different copies rejected", () => discoverCfgRuntime03RepositoryRoot({ scriptPath: join(badLock, "scripts/cfg-runtime-03-loopback-guard.mjs"), cwd: root }));
}

function copyMarkers(target) {
  for (const path of ["package.json", "package-lock.json", "supabase/config.toml", "scripts/cfg-runtime-03-loopback-guard.mjs", "scripts/manage-rybex-local-stack.mjs", ...Object.keys({
    "supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql": 1,
    "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql": 1,
    "supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql": 1,
  })]) {
    const destination = join(target, path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, path), destination);
  }
}

function temporaryNamespace(purpose) {
  return `artifacts/cfg-runtime-03-${purpose}/${new Date().toISOString().replaceAll(":", "-").replace(".", "-")}`;
}
function expectFailure(name, operation) {
  check(name, () => { try { operation(); return false; } catch { return true; } });
}
function check(name, operation) {
  try {
    const passed = Boolean(operation());
    console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
    if (!passed) failures.push(name);
  } catch (error) {
    console.log(`FAIL: ${name} - ${error instanceof Error ? error.message : String(error)}`);
    failures.push(name);
  }
}
