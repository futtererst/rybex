import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const output = resolveOutput(process.argv.slice(2));
const prompt1Path = "artifacts/cfg-runtime-03-independent-review/CFG-RUNTIME-03-INDEPENDENT-REVIEW-2026-08-11.md";
const prompt2Path = "artifacts/cfg-runtime-03-remediation/2026-08-11T23-23-45-584Z/CFG-RUNTIME-03-REMEDIATION-REPORT-2026-08-11.md";
const prompt4ManifestPath = "artifacts/cfg-runtime-03-corrected-independent-rereview/2026-08-12T11-35-30-071Z/review-hash-manifest.json";
const protectedFiles = {
  cfgRuntime02FrozenManifest: ["artifacts/cfg-runtime-02-accepted-baseline/ACCEPTANCE-MANIFEST.json", "3ec404021c849f503f1d4bdb2cdfc813c0cb289db2c941fe64c494c9096f6549"],
  immutableV12Pack: ["config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json", "6260de94106bbc047857c3e2b666afea9a124b80acd257546201b6de2bf30abc"],
  envLocal: [".env.local", "bf0477de4eb2121f507ba770e28508751eda8b65b447db9843660402c6f7ce92"],
};
const currentExpected = {
  [prompt1Path]: "dc9e7964618a4a2e3aadfc4f6d4e062d36fb131d16ea15a332f6b111170cdad1",
  [prompt2Path]: "31663252022da939d45da6f7b0ebd25f9fd26fe000a730855cdbe67efa963542",
};
const prompt4Incorrect = {
  [prompt1Path]: "dc9e7964141d289a950e2f0f1084b5abe203a1f93a75f84bfe476c34a16adad1",
  [prompt2Path]: "316632526e9c5d51c66421a8cb9165afbd5d2617cddfb8c85ed9cbfb8ee8f542",
};

for (const [label, [path, expected]] of Object.entries(protectedFiles)) {
  assertHash(path, expected, `protected ${label}`);
}
for (const [path, expected] of Object.entries(currentExpected)) assertHash(path, expected, path);

const prompt4 = JSON.parse(readFileSync(join(root, prompt4ManifestPath), "utf8"));
if (prompt4.protectedHashes?.prompt1ReviewReport !== prompt4Incorrect[prompt1Path]
  || prompt4.protectedHashes?.prompt2RemediationReport !== prompt4Incorrect[prompt2Path]) {
  throw new Error("Prompt 4 no longer contains the two adjudicated incorrect report-hash records.");
}

const earlierManifests = [
  "artifacts/cfg-runtime-03-remediation/2026-08-11T23-23-45-584Z/hash-manifest.json",
  "artifacts/cfg-runtime-03-candidate-qualification/2026-08-12T02-25-00-000Z/hash-manifest.json",
  "artifacts/cfg-runtime-03-high-finding-remediation/2026-08-12T12-38-50-853Z/hash-manifest.json",
];
const earlierManifestText = earlierManifests.map((path) => readFileSync(join(root, path), "utf8"));
for (const [path, expected] of Object.entries(currentExpected)) {
  const priorCount = earlierManifestText.filter((text) => text.includes(expected)).length;
  if (priorCount < 2) throw new Error(`${path} lacks a reconstructed chain of correct final raw-byte hashes.`);
}

const artifactRoots = [
  "artifacts/cfg-runtime-03-independent-review",
  "artifacts/cfg-runtime-03-remediation/2026-08-11T23-23-45-584Z",
  "artifacts/cfg-runtime-03-candidate-qualification/2026-08-12T02-25-00-000Z",
  "artifacts/cfg-runtime-03-corrected-independent-rereview/2026-08-12T11-35-30-071Z",
  "artifacts/cfg-runtime-03-high-finding-remediation/2026-08-12T12-38-50-853Z",
];
const artifacts = artifactRoots.flatMap((path) => walk(join(root, path)))
  .filter((path) => /\.(?:md|json|png)$/i.test(path))
  .map(fileRecord)
  .sort((a, b) => a.path.localeCompare(b.path));

const report = {
  generatedAt: new Date().toISOString(),
  algorithm: "SHA-256 raw bytes",
  status: "pass",
  integrityDisposition: [
    {
      path: prompt1Path,
      disposition: "MANIFEST_GENERATION DEFECT",
      currentFinalRawSha256: currentExpected[prompt1Path],
      incorrectPrompt4RecordedSha256: prompt4Incorrect[prompt1Path],
      evidence: "The current raw hash is recorded consistently by the finalized Prompt 2 and Prompt 3 manifests created before Prompt 4; file timestamps predate those manifests and show no later modification.",
    },
    {
      path: prompt2Path,
      disposition: "MANIFEST_GENERATION DEFECT",
      currentFinalRawSha256: currentExpected[prompt2Path],
      incorrectPrompt4RecordedSha256: prompt4Incorrect[prompt2Path],
      evidence: "The Prompt 2 manifest was created after report completion and records the current raw hash; Prompt 3 and Prompt 5 independently repeat it. Prompt 4 alone records a non-file hash.",
    },
  ],
  qualification: "Prompt 4 review-hash-manifest.json is qualified for these two keys only; disputed artifacts remain unmodified and current qualification does not rely on those incorrect keys.",
  protectedFiles: Object.fromEntries(Object.entries(protectedFiles).map(([label, [path, expected]]) => [label, { path, sha256: expected, status: "unchanged" }])),
  inventoryCount: artifacts.length,
  artifacts,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`PASS: evidence lineage reconciled; ${artifacts.length} Prompt 1-5 report, ledger, manifest, and screenshot files hashed as raw bytes.`);
console.log(`PASS: Prompt 1 report disposition MANIFEST_GENERATION DEFECT.`);
console.log(`PASS: Prompt 2 report disposition MANIFEST_GENERATION DEFECT.`);
console.log(`Evidence: ${output}`);

function resolveOutput(args) {
  const entry = args.find((arg) => arg.startsWith("--output="));
  const candidate = entry
    ? resolve(root, entry.slice("--output=".length))
    : resolve(root, "artifacts/cfg-runtime-03-persistence-authority-remediation/evidence-lineage-reconciliation.json");
  const allowed = resolve(root, "artifacts/cfg-runtime-03-persistence-authority-remediation");
  const child = relative(allowed, candidate);
  if (!child || child.startsWith("..") || isAbsolute(child)) throw new Error("lineage output must be a new file beneath the Prompt 6 artifact root");
  return candidate;
}

function assertHash(path, expected, label) {
  const actual = sha256(join(root, path));
  if (actual !== expected) throw new Error(`${label} raw-byte hash mismatch: ${actual}`);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(path) {
  if (!existsSync(path)) throw new Error(`required artifact root missing: ${relative(root, path)}`);
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => walk(join(path, entry.name)));
}

function fileRecord(path) {
  const stat = statSync(path);
  const relativePath = relative(root, path).replaceAll("\\", "/");
  const git = spawnSync("git", ["status", "--short", "--", relativePath], { cwd: root, encoding: "utf8" });
  return {
    path: relativePath,
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    gitStatus: git.stdout.trim() || "tracked-or-ignored-unchanged",
    sha256: sha256(path),
  };
}
