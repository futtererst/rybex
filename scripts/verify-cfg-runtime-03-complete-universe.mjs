import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverCfgRuntime03RepositoryRoot, resolveCfgRuntime03OutputDirectory } from "./cfg-runtime-03-repository-boundary.mjs";

const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.slice(7) ?? "candidate";
if (!new Set(["candidate", "ignored", "universe"]).has(mode)) throw new Error(`unsupported universe mode ${mode}`);
const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd(), callerRoot: process.env.CFG_RUNTIME_03_ACTIVE_ROOT });
const namespace = process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE
  || `artifacts/cfg-runtime-03-final-remediation/${new Date().toISOString().replaceAll(":", "-").replace(".", "-")}`;
const runPhase = (process.env.CFG_RUNTIME_03_RUN_PHASE ?? "standalone").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
const output = resolveCfgRuntime03OutputDirectory(root, namespace, `inventory-${runPhase}-${mode}`, { create: true });

const tracked = new Set(lines(git(["ls-files"])));
const untracked = new Set(lines(git(["ls-files", "--others", "--exclude-standard"])));
const ignored = new Set(lines(git(["ls-files", "--others", "--ignored", "--exclude-standard"])));
const staged = new Set(lines(git(["diff", "--cached", "--name-only"])));
const unstaged = new Set(lines(git(["diff", "--name-only"])));
const candidatePaths = new Set([...staged, ...unstaged, ...untracked]);
for (const path of lines(git(["ls-files", "supabase/migrations", "prisma/schema.prisma", "package.json", "package-lock.json"]))) candidatePaths.add(path);

const ignoredCodePaths = [...ignored].filter(isCodeShapedIgnored).sort();
const prompt10Artifact = JSON.parse(readFileSync(join(root, "artifacts/cfg-runtime-03-authoritative-baseline-independent-rereview/2026-08-12T22-05-28-104Z/initial-integrity-and-candidate-reconciliation.json"), "utf8"));
const prompt10Paths = findPathArray(prompt10Artifact, 302);
if (!prompt10Paths) throw new Error("Prompt 10 ignored-file set could not be reconstructed");
const prompt10Set = new Set(prompt10Paths);
const missingPrompt10 = [...prompt10Set].filter((path) => !ignoredCodePaths.includes(path));
if (missingPrompt10.length) throw new Error(`Prompt 10 ignored paths are missing: ${missingPrompt10.join(", ")}`);

const candidate = [...candidatePaths]
  .filter((path) => !isGeneratedEvidence(path) && existsSync(join(root, path)))
  .sort()
  .map((path) => describeCandidate(path));
const canonicalCallerEvidence = findCanonicalPackageOutputReferences();
const ignoredEntries = ignoredCodePaths.map((path) => describeIgnored(path, canonicalCallerEvidence));
if (ignoredEntries.some((entry) => entry.disposition === "IGNORED AMBIGUOUS — BLOCK" || entry.disposition === "IGNORED BUT EXECUTABLE — INCLUDE IN CANDIDATE")) {
  throw new Error("ignored code-shaped universe contains executable or ambiguous authority");
}
const universe = [...candidate, ...ignoredEntries].sort((a, b) => a.path.localeCompare(b.path));
const evidence = [...untracked].filter(isGeneratedEvidence).filter((path) => existsSync(join(root, path))).sort().map((path) => describeFile(path));

const payload = {
  generatedAt: new Date().toISOString(),
  repositoryRoot: root,
  head: git(["rev-parse", "HEAD"]).trim(),
  mode,
  prompt10IgnoredCount: prompt10Set.size,
  ignoredCodeShapedCount: ignoredEntries.length,
  prompt10SetFullyClassified: missingPrompt10.length === 0,
  additionalIgnoredCodeShapedPaths: ignoredCodePaths.filter((path) => !prompt10Set.has(path)),
  canonicalPackageOutputReferences: canonicalCallerEvidence,
  counts: { candidate: candidate.length, ignored: ignoredEntries.length, completeUniverse: universe.length, evidence: evidence.length },
  digests: {
    candidateImplementationTreeSha256: digest(candidate),
    ignoredCodeShapedUniverseSha256: digest(ignoredEntries),
    completeRepositoryCodeShapedUniverseSha256: digest(universe),
    generatedEvidenceTreeSha256: digest(evidence),
  },
  entries: mode === "candidate" ? candidate : mode === "ignored" ? ignoredEntries : universe,
};
writeFileSync(join(output, `${mode}-manifest.json`), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`PASS: CFG-RUNTIME-03 ${mode} manifest generated`);
console.log(JSON.stringify({ counts: payload.counts, digests: payload.digests, output }));

function describeCandidate(path) {
  const state = staged.has(path) ? "staged" : untracked.has(path) ? "untracked" : unstaged.has(path) ? "unstaged" : tracked.has(path) ? "tracked" : "untracked";
  return {
    ...describeFile(path), gitState: state, classification: "candidate implementation",
    canonicalStatus: /-ShawnT13\./i.test(path) ? "noncanonical parallel file" : "canonical or candidate-supporting",
    executableOrImported: /^(?:app|components|lib|scripts)\//.test(path) && /\.(?:js|mjs|cjs|ts|tsx|ps1)$/.test(path),
    referencingCallers: [], inclusion: "candidate authority",
  };
}

function describeIgnored(path, references) {
  const historicalPackage = path.startsWith("package-output/rybexos-demo-package/");
  const generated = /(?:^|\/)(?:dist|build|coverage|\.next)(?:\/|$)/.test(path);
  const executableCallers = references.filter((entry) => entry.kind === "executable-caller" && entry.text.includes(path));
  const disposition = executableCallers.length
    ? "IGNORED BUT EXECUTABLE — INCLUDE IN CANDIDATE"
    : historicalPackage
      ? "IGNORED NONCANONICAL HISTORICAL PACKAGE — INVENTORY ONLY"
      : generated
        ? "IGNORED GENERATED ARTIFACT — INVENTORY ONLY"
        : "IGNORED AMBIGUOUS — BLOCK";
  return {
    ...describeFile(path), gitState: "ignored", classification: "ignored code-shaped file",
    canonicalStatus: historicalPackage ? "noncanonical historical export" : generated ? "generated artifact" : "ambiguous",
    executableOrImported: executableCallers.length > 0,
    referencingCallers: executableCallers,
    duplicateOfPath: null,
    purpose: historicalPackage ? "historical demo package export" : generated ? "generated output" : "unresolved",
    inclusion: "repository universe only",
    disposition,
    prompt10SetMember: prompt10Set.has(path),
    classificationEvidence: historicalPackage
      ? "gitignored package-output export; package scripts contain no positive caller; canonical verifiers assert this tree is excluded"
      : "generated-path classification",
  };
}

function describeFile(path) {
  const absolute = join(root, path);
  const stat = statSync(absolute);
  return { path, mode: stat.mode.toString(8), size: stat.size, sha256: sha(readFileSync(absolute)) };
}

function findCanonicalPackageOutputReferences() {
  const result = spawnSync("rg", ["-n", "package-output/rybexos-demo-package", "package.json", "app", "components", "lib", "scripts"], { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 20 });
  if (![0, 1].includes(result.status ?? 1)) throw new Error(`caller graph scan failed: ${result.stderr}`);
  return lines(result.stdout).map((text) => ({
    text,
    kind: /(?:includes\(|must not|not referenced|Historical package)/i.test(text) ? "negative-control-reference" : "executable-caller",
  }));
}

function findPathArray(value, expectedLength) {
  if (Array.isArray(value) && value.length === expectedLength && value.every((item) => typeof item === "string" && item.startsWith("package-output/"))) return value;
  if (value && typeof value === "object") for (const child of Object.values(value)) { const found = findPathArray(child, expectedLength); if (found) return found; }
  return null;
}
function isCodeShapedIgnored(path) {
  return !/^(?:node_modules|\.next|\.codex-npm-cache|artifacts|visual-qa-output)\//.test(path)
    && (/^(?:package-output\/[^/]+\/(?:app|components|lib|scripts|prisma|supabase|config|docs)\/)/.test(path)
      || /^package-output\/[^/]+\/(?:package(?:-lock)?\.json|tsconfig\.json|eslint\.config\.mjs|README\.md|PACKAGE-NOTES\.md)$/.test(path))
    && /\.(?:js|mjs|cjs|ts|tsx|sql|toml|json|md|ps1)$/.test(path);
}
function isGeneratedEvidence(path) { return /^(?:artifacts|visual-qa-output)\//.test(path); }
function lines(value) { return String(value ?? "").split(/\r?\n/).map((line) => line.trim().replaceAll("\\", "/")).filter(Boolean); }
function git(args) { const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 200 }); if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`); return result.stdout; }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function digest(entries) { return sha(entries.map((entry) => `${entry.path}\0${entry.sha256}\0${entry.mode}`).sort().join("\n")); }
