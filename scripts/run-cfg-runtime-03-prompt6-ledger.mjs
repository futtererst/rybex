import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const phase = process.argv.find((arg) => arg.startsWith("--phase="))?.slice(8);
const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
const candidateArg = process.argv.find((arg) => arg.startsWith("--candidate-dir="))?.slice(16);
if (!phase || !["focused", "qualification"].includes(phase)) throw new Error("--phase must be focused or qualification");
if (!outputArg || !candidateArg) throw new Error("--output and --candidate-dir are required");
const allowed = resolve(root, "artifacts/cfg-runtime-03-persistence-authority-remediation");
const output = assertChild(resolve(root, outputArg));
const candidateDir = assertChild(resolve(root, candidateArg));
const relativeCandidate = relative(root, candidateDir).replaceAll("\\", "/");

const focused = [
  ["Evidence-lineage integrity adjudication verifier", "node", ["scripts/verify-cfg-runtime-03-evidence-lineage.mjs", `--output=${relativeCandidate}/evidence-lineage-reconciliation.json`]],
  ["Migration 0029 immutability check", "npm.cmd", ["run", "cfg-runtime-03:verify-migration-immutability"]],
  ["Prisma schema validation", "npm.cmd", ["run", "prisma:validate"]],
  ["Prisma client generation", "npm.cmd", ["run", "prisma:generate"]],
  ["Fresh complete migration-chain test", "npm.cmd", ["run", "cfg-runtime-03:verify-migration-fresh"]],
  ["Upgrade-from-0029 migration test", "npm.cmd", ["run", "cfg-runtime-03:verify-migration-upgrade"]],
  ["Migration negative controls", "npm.cmd", ["run", "cfg-runtime-03:verify-evidence-authority"]],
  ["Evidence persistence and transaction tests", "npm.cmd", ["run", "cfg-runtime-03:verify-evidence-authority"]],
  ["Cross-revision and cross-boundary evidence tests", "npm.cmd", ["run", "cfg-runtime-03:verify-evidence-authority"]],
  ["Evidence read-model tests", "npm.cmd", ["run", "cfg-runtime-03:verify-evidence-authority"]],
  ["Evidence UI-rendering tests", "npm.cmd", ["run", "cfg-runtime-03:verify-static"]],
  ["Docker prelaunch binding tests", "npm.cmd", ["run", "cfg-runtime-03:verify-loopback-boundary"]],
  ["Docker negative controls", "npm.cmd", ["run", "cfg-runtime-03:verify-loopback-boundary"]],
  ["Actual rybex-2-local binding inspection", "npm.cmd", ["run", "cfg-runtime-03:inspect-bindings"]],
  ["Focused PrimaryNav tests", "npm.cmd", ["run", "cfg-runtime-03:verify-primary-nav"]],
  ["Focused workflow-runtime tests", "npm.cmd", ["run", "cfg-runtime-03:verify-workflow-runtime"]],
  ["TypeScript typecheck", "npm.cmd", ["run", "typecheck"]],
  ["Workflow actions verifier", "npm.cmd", ["run", "workflow:verify-actions"]],
  ["CFG-RUNTIME-03 static verifier", "npm.cmd", ["run", "cfg-runtime-03:verify-static"]],
  ["CFG-RUNTIME-03 database verifier", "npm.cmd", ["run", "cfg-runtime-03:verify-database"]],
  ["CFG-RUNTIME-03 loopback boundary verifier", "npm.cmd", ["run", "cfg-runtime-03:verify-loopback-boundary"]],
  ["Production build", "npm.cmd", ["run", "build"]],
  ["Git diff whitespace check", "git", ["diff", "--check"]],
];

const qualification = [
  ["Git status", "git", ["status", "--short", "--branch"]],
  ["Clean dependency installation", "npm.cmd", ["ci"]],
  ["Repository-local Supabase CLI version", "node_modules\\.bin\\supabase.cmd", ["--version"]],
  ["CFG-RUNTIME-03 loopback boundary", "npm.cmd", ["run", "cfg-runtime-03:verify-loopback-boundary"]],
  ["Configuration foundation", "npm.cmd", ["run", "configuration:verify-foundation"]],
  ["Configuration foundation negative controls", "npm.cmd", ["run", "configuration:verify-foundation-negative-controls"]],
  ["Configuration foundation database", "npm.cmd", ["run", "configuration:verify-foundation-database"]],
  ["CFG-RUNTIME-03 static", "npm.cmd", ["run", "cfg-runtime-03:verify-static"]],
  ["CFG-RUNTIME-03 database", "npm.cmd", ["run", "cfg-runtime-03:verify-database"]],
  ["CFG-RUNTIME-03 browser", "npm.cmd", ["run", "cfg-runtime-03:qa-browser", "--", "--output-dir", `${relativeCandidate}/browser`]],
  ["CFG-RUNTIME-03 full regression", "npm.cmd", ["run", "cfg-runtime-03:regression"]],
  ["CFG-RUNTIME-02 static", "npm.cmd", ["run", "cfg-runtime-02:verify-static"]],
  ["CFG-RUNTIME-02 database", "npm.cmd", ["run", "cfg-runtime-02:verify-database"]],
  ["CFG-RUNTIME-02 browser", "npm.cmd", ["run", "cfg-runtime-02:qa-browser"]],
  ["CFG-RUNTIME-01 static", "npm.cmd", ["run", "cfg-runtime-01:verify-static"]],
  ["CFG-RUNTIME-01 database", "npm.cmd", ["run", "cfg-runtime-01:verify-database"]],
  ["CFG-RUNTIME-01 browser", "npm.cmd", ["run", "cfg-runtime-01:qa-browser"]],
  ["P1-01A static", "npm.cmd", ["run", "p1-01a:verify"]],
  ["P1-01A database", "npm.cmd", ["run", "p1-01a:qa-db"]],
  ["P1-01A browser", "npm.cmd", ["run", "p1-01a:qa-browser"]],
  ["P1-01B.1 verify", "npm.cmd", ["run", "p1-01b-1:verify"]],
  ["P1-01B.2 verify", "npm.cmd", ["run", "p1-01b-2:verify"]],
  ["Workflow actions", "npm.cmd", ["run", "workflow:verify-actions"]],
  ["Production build", "npm.cmd", ["run", "build"]],
  ["TypeScript typecheck", "npm.cmd", ["run", "typecheck"]],
  ["Lint", "npm.cmd", ["run", "lint"]],
  ["Git diff whitespace check", "git", ["diff", "--check"]],
];

const commands = phase === "focused" ? focused : qualification;
const ledger = {
  phase,
  repositoryRoot: root,
  startedAt: new Date().toISOString(),
  sequential: true,
  requiredCommandCount: commands.length,
  entries: [],
};
mkdirSync(dirname(output), { recursive: true });

for (let index = 0; index < commands.length; index += 1) {
  const [label, command, args] = commands[index];
  const startedAt = new Date().toISOString();
  const beforeResources = dockerResources();
  const invocation = invoke(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    env: label.startsWith("Prisma ")
      ? { ...sanitizedEnv(), DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55322/postgres" }
      : sanitizedEnv(),
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 250,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`;
  const afterResources = dockerResources();
  const entry = {
    sequence: index + 1,
    label,
    exactCommand: [command, ...args].join(" "),
    workingDirectory: root,
    startedAt,
    finishedAt,
    exitCode: result.status,
    signal: result.signal ?? null,
    warnings: combined.split(/\r?\n/).filter((line) => /\bwarn(?:ing)?\b/i.test(line)),
    failures: result.status === 0 ? [] : combined.split(/\r?\n/).filter((line) => /fail|error/i.test(line)),
    requiredSkips: combined.split(/\r?\n/).filter((line) => /required[^\r\n]*skip|skip[^\r\n]*required/i.test(line)),
    optionalSkips: combined.split(/\r?\n/).filter((line) => /optional[^\r\n]*skip|skip[^\r\n]*optional/i.test(line)),
    resourcesBefore: beforeResources,
    resourcesAfter: afterResources,
    resourcesCreated: afterResources.filter((name) => !beforeResources.includes(name)),
    cleanupResult: result.status === 0 ? "command completed; resource delta recorded" : "command failed; resource delta recorded for explicit cleanup",
    stdout,
    stderr,
  };
  ledger.entries.push(entry);
  writeFileSync(output, `${JSON.stringify({ ...ledger, finishedAt, status: result.status === 0 ? "in_progress" : "failed" }, null, 2)}\n`);
  process.stdout.write(`[${index + 1}/${commands.length}] ${label}: exit ${result.status}\n`);
  if (result.status !== 0) {
    ledger.finishedAt = finishedAt;
    ledger.status = "failed";
    writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\n`);
    process.stderr.write(stderr || stdout);
    process.exit(result.status ?? 1);
  }
}
ledger.finishedAt = new Date().toISOString();
ledger.status = "pass";
ledger.requiredSkips = ledger.entries.reduce((sum, entry) => sum + entry.requiredSkips.length, 0);
ledger.optionalSkips = ledger.entries.reduce((sum, entry) => sum + entry.optionalSkips.length, 0);
writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`${phase} ledger passed ${ledger.entries.length} sequential commands. Evidence: ${output}`);

function assertChild(candidate) {
  const child = relative(allowed, candidate);
  if (!child || child.startsWith("..") || isAbsolute(child)) throw new Error("qualification evidence must be beneath the Prompt 6 artifact root");
  return candidate;
}

function invoke(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  return { command, args };
}

function sanitizedEnv() {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "SUPABASE_URL", "POSTGRES_URL", "DATABASE_URL"]) delete env[key];
  return env;
}

function dockerResources() {
  const result = spawnSync("docker", ["ps", "-a", "--format", "{{.Names}}"], { cwd: root, env: sanitizedEnv(), encoding: "utf8" });
  if (result.status !== 0) return [`docker-inspection-failed:${result.status}`];
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
}
