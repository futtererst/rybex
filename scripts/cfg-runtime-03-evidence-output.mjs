import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  discoverCfgRuntime03RepositoryRoot,
  resolveCfgRuntime03EvidenceNamespace,
} from "./cfg-runtime-03-repository-boundary.mjs";

const COMPONENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUITES = new Set(["focused", "ordered", "browser", "targeted", "development"]);
const PROMPT_13_FAMILY = "artifacts/cfg-runtime-03-evidence-isolation-remediation/";

export function prepareCfgRuntime03EvidenceOutput(options = {}) {
  const root = discoverCfgRuntime03RepositoryRoot({
    scriptUrl: options.scriptUrl ?? import.meta.url,
    cwd: options.cwd ?? process.cwd(),
    callerRoot: process.env.CFG_RUNTIME_03_ACTIVE_ROOT,
  });
  const namespace = required("CFG_RUNTIME_03_ACTIVE_RUN_ROOT").replaceAll("\\", "/").replace(/\/$/, "");
  if (!namespace.startsWith(PROMPT_13_FAMILY)) {
    throw outputError("historical_root", "active-run root must be a new Prompt 13 evidence-isolation namespace");
  }
  const attemptId = component("attemptId", required("CFG_RUNTIME_03_ATTEMPT_ID"));
  const suite = component("suite", required("CFG_RUNTIME_03_SUITE"));
  if (!SUITES.has(suite)) throw outputError("suite", `unsupported suite ${suite}`);
  const commandNumber = positiveInteger("commandNumber", required("CFG_RUNTIME_03_COMMAND_NUMBER"));
  const invocationId = component("invocationId", required("CFG_RUNTIME_03_INVOCATION_ID"));
  const activeRunRoot = resolveCfgRuntime03EvidenceNamespace(root, namespace, { requireEmpty: false, create: true });
  assertNoReparse(root, activeRunRoot);

  const canonicalCommandParent = resolve(activeRunRoot, "attempts", attemptId, suite, `command-${commandNumber}`);
  const nestedParent = String(process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT ?? "").trim();
  const commandParent = nestedParent
    ? resolveNestedOutputParent(root, activeRunRoot, canonicalCommandParent, nestedParent)
    : canonicalCommandParent;
  const finalRoot = resolve(commandParent, invocationId);
  const temporaryRoot = resolve(commandParent, `.tmp-${invocationId}-${randomUUID().toLowerCase()}`);
  assertContained(activeRunRoot, finalRoot, "attempt_output");
  assertContained(activeRunRoot, temporaryRoot, "attempt_output");
  assertNoReparse(root, commandParent);
  if (existsSync(finalRoot)) throw outputError("invocation_reuse", "command invocation directory already exists");
  if (existsSync(temporaryRoot)) throw outputError("output_collision", "temporary command output already exists");
  mkdirSync(commandParent, { recursive: true });
  mkdirSync(temporaryRoot, { recursive: false });

  const protectedBefore = snapshotArtifactUniverse(root, [temporaryRoot, finalRoot]);
  let settled = false;
  return {
    root,
    activeRunRoot,
    temporaryRoot,
    finalRoot,
    attemptId,
    suite,
    commandNumber,
    invocationId,
    finalize() {
      if (settled) throw outputError("output_lifecycle", "output transaction is already settled");
      if (!existsSync(temporaryRoot) || readdirSync(temporaryRoot).length === 0) {
        throw outputError("empty_output", "successful evidence command produced no output");
      }
      const protectedAfter = snapshotArtifactUniverse(root, [temporaryRoot, finalRoot]);
      assertSnapshotsEqual(protectedBefore, protectedAfter);
      if (existsSync(finalRoot)) throw outputError("invocation_reuse", "final command output appeared before commit");
      renameSync(temporaryRoot, finalRoot);
      settled = true;
      return finalRoot;
    },
    abort() {
      if (settled) return;
      rmSync(temporaryRoot, { recursive: true, force: true });
      settled = true;
    },
  };
}

function resolveNestedOutputParent(root, activeRunRoot, canonicalCommandParent, nestedParent) {
  if (!isAbsolute(nestedParent)) {
    throw outputError("nested_output_parent", "nested output parent must be the coordinator-issued absolute temporary root");
  }
  const resolvedParent = resolve(nestedParent);
  assertContained(canonicalCommandParent, resolvedParent, "nested_output_parent");
  assertContained(activeRunRoot, resolvedParent, "nested_output_parent");
  assertNoReparse(root, resolvedParent);
  const parentName = resolvedParent.slice(resolve(canonicalCommandParent).length + 1).split(/[\\/]/)[0];
  if (!parentName?.startsWith(".tmp-") || !existsSync(resolvedParent)) {
    throw outputError("nested_output_parent", "nested output parent is not an active coordinator temporary root");
  }
  return resolve(resolvedParent, "children");
}

export function snapshotCfgRuntime03ProtectedArtifacts(root, activeRunRoot) {
  return snapshotArtifactUniverse(resolve(root), [resolve(activeRunRoot)]);
}

export function compareCfgRuntime03ProtectedSnapshots(before, after) {
  return diffSnapshots(before, after);
}

export function canonicalizeCfgRuntime03EvidencePaths(value, transaction) {
  if (typeof value === "string") return value.replaceAll(transaction.temporaryRoot, transaction.finalRoot);
  if (Array.isArray(value)) return value.map((entry) => canonicalizeCfgRuntime03EvidencePaths(entry, transaction));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, canonicalizeCfgRuntime03EvidencePaths(entry, transaction)]));
  }
  return value;
}

function snapshotArtifactUniverse(root, excludedRoots) {
  const artifacts = resolve(root, "artifacts");
  const rows = [];
  walk(artifacts, (path) => {
    if (excludedRoots.some((excluded) => isWithin(excluded, path))) return false;
    const stat = lstatSync(path);
    const repositoryPath = relative(root, path).replaceAll("\\", "/");
    if (stat.isSymbolicLink()) {
      rows.push({ path: repositoryPath, kind: "reparse", size: stat.size, sha256: null });
      return false;
    }
    if (stat.isFile()) rows.push({ path: repositoryPath, kind: "file", size: stat.size, sha256: sha256(readFileSync(path)) });
    return stat.isDirectory();
  });
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return rows;
}

function walk(directory, visit) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const descend = visit(path);
    if (descend && entry.isDirectory()) walk(path, visit);
  }
}

function assertSnapshotsEqual(before, after) {
  const changes = diffSnapshots(before, after);
  if (changes.length) {
    throw outputError("protected_artifact_mutation", `evidence command changed ${changes.length} path(s) outside its active command root: ${changes.slice(0, 5).map((row) => row.path).join(", ")}`);
  }
}

function diffSnapshots(before, after) {
  const a = new Map(before.map((row) => [row.path, row]));
  const b = new Map(after.map((row) => [row.path, row]));
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort();
  return paths.flatMap((path) => JSON.stringify(a.get(path) ?? null) === JSON.stringify(b.get(path) ?? null)
    ? []
    : [{ path, before: a.get(path) ?? null, after: b.get(path) ?? null }]);
}

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw outputError("missing_active_output", `${name} is required`);
  return value;
}

function component(name, value) {
  if (!COMPONENT.test(value)) throw outputError(name, `${name} must be lowercase hyphenated text`);
  return value;
}

function positiveInteger(name, value) {
  if (!/^[1-9][0-9]*$/.test(value)) throw outputError(name, `${name} must be a positive integer`);
  return Number(value);
}

function assertNoReparse(root, target) {
  const segment = relative(resolve(root), resolve(target));
  let current = resolve(root);
  for (const part of segment.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) throw outputError("reparse_escape", `reparse point is prohibited: ${current}`);
  }
  if (existsSync(target)) {
    const actual = realpathSync.native(target);
    assertContained(realpathSync.native(root), actual, "reparse_escape");
  }
}

function assertContained(parent, child, category) {
  const segment = relative(resolve(parent), resolve(child));
  if (!segment || segment.startsWith("..") || isAbsolute(segment)) throw outputError(category, "resolved output escapes its boundary");
}

function isWithin(parent, child) {
  const segment = relative(resolve(parent), resolve(child));
  return !segment.startsWith("..") && !isAbsolute(segment);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function outputError(category, message) {
  const error = new Error(`${category}: ${message}`);
  error.category = category;
  return error;
}
