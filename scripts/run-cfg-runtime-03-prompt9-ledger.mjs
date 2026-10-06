import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const evidenceRoot = join(
  root,
  "artifacts/cfg-runtime-03-authoritative-baseline-remediation/2026-08-12T16-53-40-348Z",
);
const phase = process.argv.find((value) => value.startsWith("--phase="))?.slice(8);
if (!phase || !["focused", "ordered"].includes(phase)) {
  throw new Error("usage: node scripts/run-cfg-runtime-03-prompt9-ledger.mjs --phase=focused|ordered");
}

const npm = (script) => ({ executable: "npm.cmd", args: ["run", script], exact: `npm.cmd run ${script}` });
const focused = [
  npm("cfg-runtime-03:verify-candidate-inventory"),
  npm("cfg-runtime-03:verify-protected-hashes"),
  npm("cfg-runtime-03:verify-authoritative-baseline"),
  npm("cfg-runtime-03:verify-deletion-plan"),
  npm("cfg-runtime-03:verify-backup-restore"),
  npm("cfg-runtime-03:verify-preserved-cleanup"),
  npm("cfg-runtime-03:verify-remaining-links"),
  npm("cfg-runtime-03:verify-qualification-isolation"),
  npm("cfg-runtime-03:verify-preserved-write-rejection"),
  npm("cfg-runtime-03:verify-migration-0029-immutability"),
  npm("cfg-runtime-03:verify-migration-0030-immutability"),
  npm("prisma:validate"),
  npm("prisma:generate"),
  npm("cfg-runtime-03:verify-migration-fresh"),
  npm("cfg-runtime-03:verify-migration-upgrade"),
  npm("cfg-runtime-03:verify-migration-upgrade-0030"),
  npm("cfg-runtime-03:verify-identity-coherence"),
  npm("cfg-runtime-03:verify-evidence-authority"),
  { ...npm("cfg-runtime-03:verify-identity-coherence"), label: "dangling-relationship controls" },
  { ...npm("cfg-runtime-03:verify-launch-authority"), label: "package-script caller-graph verifier" },
  { ...npm("cfg-runtime-03:verify-launch-authority"), label: "seven corrected startup-path tests" },
  { ...npm("cfg-runtime-03:verify-launch-authority"), label: "startup-bypass negative controls" },
  { ...npm("cfg-runtime-03:verify-loopback-boundary"), label: "Docker prelaunch controls" },
  npm("cfg-runtime-03:verify-live-disposable"),
  npm("cfg-runtime-03:verify-qualification-residue"),
  { ...npm("cfg-runtime-03:verify-evidence-authority"), label: "evidence read-model tests" },
  { ...npm("cfg-runtime-03:verify-static"), label: "evidence UI tests" },
  npm("cfg-runtime-03:verify-primary-nav"),
  npm("cfg-runtime-03:verify-workflow-runtime"),
  npm("typecheck"),
  npm("workflow:verify-actions"),
  npm("cfg-runtime-03:verify-static"),
  npm("cfg-runtime-03:verify-database"),
  npm("cfg-runtime-03:verify-loopback-boundary"),
  npm("build"),
  { executable: "git", args: ["diff", "--check"], exact: "git diff --check" },
];

const ordered = [
  { executable: "git", args: ["status", "--short", "--branch"], exact: "git status --short --branch" },
  { executable: "npm.cmd", args: ["ci", "--cache", ".codex-npm-cache", "--prefer-offline"], exact: "npm.cmd ci --cache .codex-npm-cache --prefer-offline" },
  { executable: "node_modules\\.bin\\supabase.cmd", args: ["--version"], exact: "node_modules\\.bin\\supabase.cmd --version" },
  npm("cfg-runtime-03:verify-loopback-boundary"),
  npm("configuration:verify-foundation"),
  npm("configuration:verify-foundation-negative-controls"),
  npm("configuration:verify-foundation-database"),
  npm("cfg-runtime-03:verify-static"),
  npm("cfg-runtime-03:verify-database"),
  npm("cfg-runtime-03:qa-browser"),
  npm("cfg-runtime-03:regression"),
  npm("cfg-runtime-02:verify-static"),
  npm("cfg-runtime-02:verify-database"),
  npm("cfg-runtime-02:qa-browser"),
  npm("cfg-runtime-01:verify-static"),
  npm("cfg-runtime-01:verify-database"),
  npm("cfg-runtime-01:qa-browser"),
  npm("p1-01a:verify"),
  npm("p1-01a:qa-db"),
  npm("p1-01a:qa-browser"),
  npm("p1-01b-1:verify"),
  npm("p1-01b-2:verify"),
  npm("workflow:verify-actions"),
  npm("build"),
  npm("typecheck"),
  npm("lint"),
  { executable: "git", args: ["diff", "--check"], exact: "git diff --check" },
];

const commands = phase === "focused" ? focused : ordered;
const ledgerDir = join(evidenceRoot, `${phase}-ledger`);
mkdirSync(ledgerDir, { recursive: true });
const ledger = {
  phase,
  requiredCount: commands.length,
  cwd: root,
  startedAt: new Date().toISOString(),
  sourceHead: await gitValue(["rev-parse", "HEAD"]),
  branch: await gitValue(["branch", "--show-current"]),
  entries: [],
};

for (const [index, command] of commands.entries()) {
  const ordinal = index + 1;
  const label = command.label ?? command.exact;
  console.log(`[${phase} ${ordinal}/${commands.length}] START ${label}`);
  const startedAt = new Date().toISOString();
  const result = await execute(command, ordinal);
  const finishedAt = new Date().toISOString();
  const combined = `${result.stdout}\n${result.stderr}`;
  const outputName = `${String(ordinal).padStart(2, "0")}-${slug(label)}.log`;
  const outputPath = join(ledgerDir, outputName);
  writeFileSync(outputPath, combined, "utf8");
  const warnings = linesMatching(combined, /\bwarn(?:ing)?\b/i);
  const skipLines = linesMatching(combined, /(?:^|:\s*)(?:required\s+)?skip(?:ped)?\b/i)
    .filter((line) => !/\b(?:zero|0|no)\s+(?:required\s+|optional\s+)?skip/i.test(line));
  const requiredSkips = skipLines.filter((line) => !/optional/i.test(line));
  const entry = {
    ordinal,
    label,
    exactCommand: command.exact,
    executable: command.executable,
    args: command.args,
    cwd: root,
    startedAt,
    finishedAt,
    exitCode: result.exitCode,
    signal: result.signal,
    warnings,
    requiredSkips,
    optionalSkips: skipLines.filter((line) => /optional/i.test(line)),
    outputLog: outputName,
    outputSha256: sha(readFileSync(outputPath)),
    childProcesses: inferChildren(combined),
    guards: inferGuards(combined),
    resources: inferResources(combined),
    bindings: inferBindings(combined),
    cleanup: inferCleanup(combined),
  };
  ledger.entries.push(entry);
  persist();
  console.log(`[${phase} ${ordinal}/${commands.length}] EXIT ${entry.exitCode} warnings=${warnings.length} requiredSkips=${requiredSkips.length}`);
  if (entry.exitCode !== 0 || requiredSkips.length > 0) {
    ledger.status = "failed";
    ledger.failedOrdinal = ordinal;
    ledger.finishedAt = finishedAt;
    persist();
    process.exitCode = 1;
    break;
  }
}

if (!ledger.status) {
  ledger.status = ledger.entries.length === commands.length ? "passed" : "failed";
  ledger.finishedAt = new Date().toISOString();
  ledger.zeroRequiredSkips = ledger.entries.every((entry) => entry.requiredSkips.length === 0);
  persist();
}

function execute(command, ordinal) {
  return new Promise((resolvePromise) => {
    let child;
    try {
      const isWindowsCmd = process.platform === "win32" && command.executable.toLowerCase().endsWith(".cmd");
      const executable = isWindowsCmd ? "cmd.exe" : command.executable;
      const args = isWindowsCmd ? ["/d", "/s", "/c", command.executable, ...command.args] : command.args;
      child = spawn(executable, args, {
        cwd: root,
        env: {
          ...process.env,
        CFG_RUNTIME_03_PROMPT9_EVIDENCE_ROOT: evidenceRoot,
        CFG_RUNTIME_03_QUALIFICATION_PHASE: phase,
        CFG_RUNTIME_03_OUTPUT_DIR: join(evidenceRoot, "browser-candidate"),
        CFG_RUNTIME_03_REGRESSION_ROOT: join(evidenceRoot, "regression"),
        CFG_RUNTIME_03_ARTIFACT_ROOT: join(evidenceRoot, "runtime-artifacts"),
        },
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      resolvePromise({ stdout: "", stderr: `${error.stack ?? error.message}\n`, exitCode: 1, signal: null });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const heartbeat = setInterval(() => console.log(`[${phase} ${ordinal}/${commands.length}] still running ${command.label ?? command.exact}`), 30_000);
    child.on("error", (error) => { stderr += `${error.stack ?? error.message}\n`; });
    child.on("close", (code, signal) => {
      clearInterval(heartbeat);
      resolvePromise({ stdout, stderr, exitCode: code ?? 1, signal: signal ?? null });
    });
  });
}

function persist() {
  const output = join(evidenceRoot, `${phase}-command-ledger.json`);
  writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function linesMatching(value, pattern) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => pattern.test(line)).slice(0, 100);
}

function inferChildren(value) {
  return linesMatching(value, /(?:node|next|playwright|supabase|docker|postgres|browser|server)/i).slice(0, 40);
}

function inferGuards(value) {
  return linesMatching(value, /(?:guard|reject|local-only|loopback|token|project ref|CLI version)/i).slice(0, 40);
}

function inferResources(value) {
  return linesMatching(value, /(?:projectId|container|network|volume|database)/i).slice(0, 40);
}

function inferBindings(value) {
  return linesMatching(value, /(?:127\.0\.0\.1|HostIp|binding|listener|pooler)/i).slice(0, 40);
}

function inferCleanup(value) {
  const lines = linesMatching(value, /(?:cleanup|teardown|residue|removed|zero residual)/i);
  return { observed: lines.length > 0, lines: lines.slice(0, 40) };
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function gitValue(args) {
  const result = await execute({ executable: "git", args, exact: `git ${args.join(" ")}` }, 0);
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
