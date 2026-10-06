import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const evidenceRoot = resolve(root, "artifacts/cfg-runtime-03-authoritative-baseline-remediation/2026-08-12T16-53-40-348Z");
const outputPath = resolve(evidenceRoot, "candidate-inventory.json");

const tracked = new Set(lines(git(["ls-files"])));
const untracked = new Set(lines(git(["ls-files", "--others", "--exclude-standard"])));
const staged = new Set(lines(git(["diff", "--cached", "--name-only"])).map(normalize));
const unstaged = new Set(lines(git(["diff", "--name-only"])).map(normalize));
const candidates = new Set([...staged, ...unstaged, ...untracked].map(normalize));
for (const path of lines(git(["ls-files", "supabase/migrations", "prisma/schema.prisma", "package.json", "package-lock.json"]))) candidates.add(normalize(path));

const outputRelative = normalize(relative(root, outputPath));
const files = [...candidates].sort().filter((path) => path !== outputRelative && existsSync(resolve(root, path))).map((path) => describe(path));
const implementation = files.filter((entry) => entry.classification === "implementation");
const evidence = files.filter((entry) => entry.classification === "evidence");
const untrackedImplementation = implementation.filter((entry) => entry.gitState === "untracked");
const payload = {
  generatedAt: new Date().toISOString(),
  repositoryRoot: root,
  head: git(["rev-parse", "HEAD"]).trim(),
  branch: git(["branch", "--show-current"]).trim(),
  completeDirtyBoundary: true,
  counts: { total: files.length, implementation: implementation.length, evidence: evidence.length, staged: files.filter((entry) => entry.staged).length, unstaged: files.filter((entry) => entry.unstaged).length, untrackedImplementation: untrackedImplementation.length },
  digests: {
    implementationTreeSha256: digest(implementation),
    evidenceTreeSha256: digest(evidence),
    trackedBinaryDiffSha256: sha(Buffer.from(git(["diff", "--binary"]))),
    untrackedImplementationSha256: digest(untrackedImplementation),
  },
  untrackedImplementation,
  files,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`PASS: complete candidate inventory generated - ${outputPath}`);
console.log(JSON.stringify({ counts: payload.counts, digests: payload.digests }));

function describe(path) {
  const absolute = resolve(root, path);
  const stat = statSync(absolute);
  const isEvidence = /^artifacts\//.test(path) || /^visual-qa-output\//.test(path);
  const gitState = untracked.has(path) ? "untracked" : tracked.has(path) ? "tracked" : "outside-index";
  return {
    path,
    gitState,
    staged: staged.has(path),
    unstaged: unstaged.has(path),
    classification: isEvidence ? "evidence" : "implementation",
    canonicalStatus: /-ShawnT13\./i.test(path) ? "parallel-noncanonical" : isEvidence ? "evidence-only" : "canonical-or-supporting",
    executableOrImported: /^(?:app|components|lib|scripts)\//.test(path) && /\.(?:js|mjs|cjs|ts|tsx|ps1)$/.test(path),
    mode: stat.mode.toString(8),
    size: stat.size,
    sha256: sha(readFileSync(absolute)),
    purpose: purpose(path),
    originatingPrompt: /^artifacts\/cfg-runtime-03-authoritative-baseline-remediation\//.test(path) || /0031|qualification|launch-authority|candidate-inventory/i.test(path) ? "Prompt 9" : "pre-existing candidate change",
  };
}

function purpose(path) {
  if (/migrations\/0031/.test(path)) return "actor/profile identity-coherence migration";
  if (/schema\.prisma$/.test(path)) return "canonical Prisma schema";
  if (/package(?:-lock)?\.json$/.test(path)) return "package command/dependency authority";
  if (/qualification|launch-authority/.test(path)) return "qualification isolation and launch authority";
  if (/authoritative-baseline-remediation/.test(path)) return "Prompt 9 forensic, cleanup, qualification, or report evidence";
  if (/verify|qa|capture|test/i.test(path)) return "test or verifier";
  return "candidate implementation";
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 200 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed:${result.stderr}`);
  return result.stdout;
}
function lines(value) { return String(value).split(/\r?\n/).map(normalize).filter(Boolean); }
function normalize(value) { return String(value).trim().replaceAll("\\", "/"); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function digest(entries) { return sha(entries.map((entry) => `${entry.path}\0${entry.sha256}\0${entry.gitState}\0${entry.mode}`).sort().join("\n")); }
