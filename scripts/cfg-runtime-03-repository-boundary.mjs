import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_HASHES = Object.freeze({
  "supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql": "fc2dd4616f19cfdc97cb7ba0d234236f30797f3c3ca82fa4d976b848820ca15a",
  "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql": "3a597bd63309d7a6139a86fde66ea998b18e56b1ba9b36a4ea8714cfffe50cda",
  "supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql": "ed9eb6928f5ea0204c71d20eeaea133a341bb86bd31488fa5cfa46b2980bbe5d",
});

const EVIDENCE_NAMESPACE = /^artifacts\/cfg-runtime-03-[a-z0-9]+(?:-[a-z0-9]+)*\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
const OUTPUT_LEAF = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function discoverCfgRuntime03RepositoryRoot(options = {}) {
  const scriptPath = options.scriptPath
    ? resolve(String(options.scriptPath))
    : fileURLToPath(options.scriptUrl ?? import.meta.url);
  const scriptRoot = findRepositoryRoot(dirname(scriptPath));
  const workingRoot = findRepositoryRoot(resolve(options.cwd ?? process.cwd()));
  if (!sameRealPath(scriptRoot, workingRoot)) {
    throw boundaryError("repository_root_confusion", "executing script and working directory resolve to different repository copies");
  }
  if (options.callerRoot && !sameRealPath(scriptRoot, resolve(String(options.callerRoot)))) {
    throw boundaryError("caller_repository_root", "caller-supplied repository root differs from the executing candidate");
  }
  validateCfgRuntime03RepositoryRoot(scriptRoot);
  return realpath(scriptRoot);
}

export function validateCfgRuntime03RepositoryRoot(root) {
  const candidate = realpath(resolve(String(root)));
  const packageJson = readJson(resolve(candidate, "package.json"), "package_json");
  const packageLock = readJson(resolve(candidate, "package-lock.json"), "package_lock");
  if (packageJson.name !== "rybex-os" || packageJson.private !== true) {
    throw boundaryError("repository_markers", "package.json does not identify the canonical private Rybex OS candidate");
  }
  if (packageJson.devDependencies?.supabase !== "2.109.1"
    || packageLock.packages?.[""]?.devDependencies?.supabase !== "2.109.1"
    || packageLock.packages?.["node_modules/supabase"]?.version !== "2.109.1"
    || !packageLock.packages?.["node_modules/supabase"]?.integrity) {
    throw boundaryError("repository_lockfile", "package and lockfile authority for Supabase CLI 2.109.1 is incomplete");
  }
  for (const marker of [
    "supabase/config.toml",
    "scripts/cfg-runtime-03-loopback-guard.mjs",
    "scripts/manage-rybex-local-stack.mjs",
  ]) {
    if (!existsSync(resolve(candidate, marker))) throw boundaryError("repository_markers", `missing canonical marker ${marker}`);
  }
  for (const [path, expected] of Object.entries(MIGRATION_HASHES)) {
    const absolute = resolve(candidate, path);
    if (!existsSync(absolute) || sha256(readFileSync(absolute)) !== expected) {
      throw boundaryError("repository_migration_hash", `${path} does not match protected migration authority`);
    }
  }
  return candidate;
}

export function resolveCfgRuntime03EvidenceNamespace(root, namespace, options = {}) {
  const activeRoot = validateCfgRuntime03RepositoryRoot(root);
  const normalized = normalizeRelativeNamespace(namespace);
  if (!EVIDENCE_NAMESPACE.test(normalized)) {
    throw boundaryError("evidence_namespace", "expected artifacts/cfg-runtime-03-<lowercase-hyphenated-purpose>/<UTC timestamp>");
  }
  const artifactsRoot = resolve(activeRoot, "artifacts");
  const output = resolve(activeRoot, ...normalized.split("/"));
  assertContained(artifactsRoot, output, "evidence_namespace");
  assertNoReparseEscape(activeRoot, output);
  if (existsSync(output) && options.requireEmpty !== false && readdirSync(output).length > 0) {
    throw boundaryError("evidence_namespace", "preexisting nonempty evidence namespace cannot be overwritten");
  }
  if (options.create) mkdirSync(output, { recursive: true });
  if (existsSync(output)) {
    assertContained(realpath(activeRoot), realpath(output), "evidence_namespace");
  }
  return output;
}

export function resolveCfgRuntime03OutputDirectory(root, namespace, leaf, options = {}) {
  if (!OUTPUT_LEAF.test(String(leaf ?? ""))) throw boundaryError("output_leaf", "output leaf must be lowercase hyphenated text");
  const namespaceRoot = resolveCfgRuntime03EvidenceNamespace(root, namespace, { requireEmpty: false, create: options.create });
  const activeNamespace = String(process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT ?? "").replaceAll("\\", "/").replace(/\/$/, "");
  const normalizedNamespace = normalizeRelativeNamespace(namespace);
  let output;
  if (activeNamespace) {
    if (normalizedNamespace !== normalizeRelativeNamespace(activeNamespace)) {
      throw boundaryError("active_run_root", "writer namespace differs from the explicit active-run root");
    }
    const attemptId = qualificationComponent("attempt", process.env.CFG_RUNTIME_03_ATTEMPT_ID);
    const suite = qualificationComponent("suite", process.env.CFG_RUNTIME_03_SUITE);
    const commandNumber = String(process.env.CFG_RUNTIME_03_COMMAND_NUMBER ?? "");
    const invocationId = qualificationComponent("invocation", process.env.CFG_RUNTIME_03_INVOCATION_ID);
    if (!/^[1-9][0-9]*$/.test(commandNumber)) throw boundaryError("command_number", "positive command number is required");
    const canonicalCommandParent = resolve(namespaceRoot, "attempts", attemptId, suite, `command-${commandNumber}`);
    const nestedParent = String(process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT ?? "").trim();
    if (nestedParent) {
      if (!isAbsolute(nestedParent)) throw boundaryError("nested_output_parent", "coordinator-issued nested parent must be absolute");
      const resolvedNestedParent = resolve(nestedParent);
      assertContained(canonicalCommandParent, resolvedNestedParent, "nested_output_parent");
      assertNoReparseEscape(root, resolvedNestedParent);
      const firstSegment = relative(canonicalCommandParent, resolvedNestedParent).split(sep)[0];
      if (!firstSegment.startsWith(".tmp-") || !existsSync(resolvedNestedParent)) {
        throw boundaryError("nested_output_parent", "nested parent is not an active coordinator temporary root");
      }
      output = resolve(resolvedNestedParent, "children", invocationId, String(leaf));
    } else {
      output = resolve(canonicalCommandParent, invocationId, String(leaf));
    }
  } else {
    output = resolve(namespaceRoot, String(leaf));
  }
  assertContained(namespaceRoot, output, "output_directory");
  assertNoReparseEscape(root, output);
  if (existsSync(output) && readdirSync(output).length > 0) {
    throw boundaryError("output_directory", "preexisting nonempty output directory cannot be overwritten");
  }
  if (options.create) mkdirSync(output, { recursive: true });
  return output;
}

function qualificationComponent(label, value) {
  const text = String(value ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) throw boundaryError(label, `${label} identifier is required and must be lowercase hyphenated text`);
  return text;
}

export function cfgRuntime03EvidenceNamespacePattern() {
  return EVIDENCE_NAMESPACE;
}

function findRepositoryRoot(start) {
  let current = realpath(resolve(start));
  while (true) {
    if (existsSync(resolve(current, "package.json"))
      && existsSync(resolve(current, "package-lock.json"))
      && existsSync(resolve(current, "supabase", "config.toml"))
      && existsSync(resolve(current, "scripts", "cfg-runtime-03-loopback-guard.mjs"))) return current;
    const parent = dirname(current);
    if (parent === current) throw boundaryError("repository_root", `no canonical repository root found from ${start}`);
    current = parent;
  }
}

function normalizeRelativeNamespace(value) {
  const raw = String(value ?? "").trim().replaceAll("\\", "/").replace(/\/$/, "");
  if (!raw || isAbsolute(raw) || /^[a-zA-Z]:/.test(raw) || raw.startsWith("//") || raw.split("/").includes("..") || raw.split("/").includes(".")) {
    throw boundaryError("evidence_namespace", "absolute, UNC, alternate-drive, dot, and traversal paths are prohibited");
  }
  return raw;
}

function assertNoReparseEscape(root, target) {
  const relativePath = relative(resolve(root), resolve(target));
  let current = resolve(root);
  for (const part of relativePath.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (!existsSync(current)) break;
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw boundaryError("reparse_escape", `symbolic link or junction is prohibited in output path: ${current}`);
  }
}

function assertContained(parent, child, category) {
  const segment = relative(resolve(parent), resolve(child));
  if (!segment || segment.startsWith("..") || isAbsolute(segment)) throw boundaryError(category, "resolved path escapes its authorized repository boundary");
}

function sameRealPath(a, b) {
  return normalizeReal(a) === normalizeReal(b);
}

function normalizeReal(value) {
  const normalized = realpath(resolve(value)).replaceAll("/", sep).replace(/[\\/]$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function realpath(value) {
  try {
    return realpathSync.native(resolve(value));
  } catch (error) {
    throw boundaryError("real_path", `unable to resolve ${value}: ${error.message}`);
  }
}

function readJson(path, category) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw boundaryError(category, `unable to read ${path}: ${error.message}`); }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function boundaryError(category, detail) {
  const error = new Error(`${category}: ${detail}`);
  error.category = category;
  return error;
}
