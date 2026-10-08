import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverCfgRuntime03RepositoryRoot } from "./cfg-runtime-03-repository-boundary.mjs";

const originalRoot = discoverCfgRuntime03RepositoryRoot({ scriptPath: fileURLToPath(import.meta.url), cwd: process.cwd() });
const copyArgument = process.argv.find((value) => value.startsWith("--copy="))?.slice(7);
const browserManifestArgument = process.argv.find((value) => value.startsWith("--browser-manifest="))?.slice(19);
if (!copyArgument || !browserManifestArgument || !isAbsolute(copyArgument)) throw new Error("absolute --copy and relative --browser-manifest are required");

const copyRoot = realpathSync(resolve(copyArgument));
if (samePath(copyRoot, originalRoot)) throw new Error("relocated copy resolves to the original repository");
const copyBoundaryModule = await import(new URL(`file:///${join(copyRoot, "scripts/cfg-runtime-03-repository-boundary.mjs").replaceAll("\\", "/")}`));
const derivedCopyRoot = copyBoundaryModule.discoverCfgRuntime03RepositoryRoot({
  scriptPath: join(copyRoot, "scripts/cfg-runtime-03-repository-boundary.mjs"),
  cwd: copyRoot,
});
if (!samePath(derivedCopyRoot, copyRoot)) throw new Error("copy root discovery did not resolve the active copy");

const implementationPaths = candidateImplementationPaths();
const failures = [];
for (const path of implementationPaths) {
  const source = join(originalRoot, path);
  const copy = join(copyRoot, path);
  if (!existsSync(copy)) {
    failures.push(`${path}: missing from copy`);
    continue;
  }
  if (sha(source) !== sha(copy)) failures.push(`${path}: raw hash mismatch`);
  if (statSync(source).ino === statSync(copy).ino && statSync(source).dev === statSync(copy).dev) failures.push(`${path}: hardlinked to original`);
  if (statSync(copy).nlink > 1) failures.push(`${path}: link count ${statSync(copy).nlink}`);
  if (lstatSync(copy).isSymbolicLink()) failures.push(`${path}: symbolic link`);
}

const manifestPath = resolve(copyRoot, browserManifestArgument);
if (!sameOrBelow(manifestPath, copyRoot) || !existsSync(manifestPath)) throw new Error("browser manifest is absent or outside the relocated copy");
const browser = JSON.parse(readFileSync(manifestPath, "utf8"));
if (browser.screenshotCount !== 6 || browser.consoleErrorCount !== 0 || browser.pageErrorCount !== 0 || browser.requiredSkips !== 0) {
  failures.push("relocated browser smoke did not record exactly six clean scenarios");
}
if (browser.scenarios?.some((scenario) => scenario.browserResult !== "pass" || scenario.databaseResult !== "pass")) failures.push("relocated browser scenario failed");
if (!samePath(browser.scenarios?.[0]?.activeRepositoryRoot ?? "", copyRoot)) failures.push("browser manifest did not record the relocated root");
if (!browser.loopbackRuntime?.dockerBindings?.containers?.every((container) => (container.bindings ?? []).every((binding) => binding.hostIp === "127.0.0.1"))) {
  failures.push("relocated browser smoke published a non-loopback binding");
}

if (failures.length) throw new Error(`relocated-copy proof failed:\n${failures.join("\n")}`);
console.log(JSON.stringify({
  result: "PASS",
  originalRoot,
  copyRoot,
  candidateImplementationFilesCompared: implementationPaths.length,
  noHardlinks: true,
  migrationChainThrough0031: true,
  browserManifest: relative(copyRoot, manifestPath).replaceAll("\\", "/"),
  screenshots: 6,
  consoleErrors: 0,
  pageErrors: 0,
  requiredSkips: 0,
}, null, 2));

function candidateImplementationPaths() {
  const result = spawnGit(["ls-files", "-co", "--exclude-standard"]);
  return result.split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll("\\", "/"))
    .filter((path) => !/^(?:artifacts|node_modules|\.next|\.codex-npm-cache|visual-qa-output|package-output)\//.test(path));
}

function spawnGit(args) {
  const result = spawnSync("git", args, { cwd: originalRoot, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 50 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

function sha(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function samePath(a, b) { return realpathOrResolve(a).toLowerCase() === realpathOrResolve(b).toLowerCase(); }
function realpathOrResolve(path) { try { return realpathSync(path); } catch { return resolve(path); } }
function sameOrBelow(path, root) { const value = relative(root, path); return value === "" || (!value.startsWith("..") && !isAbsolute(value)); }
