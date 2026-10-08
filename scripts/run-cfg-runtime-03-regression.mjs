import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createSanitizedChildEnv,
} from "./cfg-runtime-03-loopback-guard.mjs";
import {
  discoverCfgRuntime03RepositoryRoot,
} from "./cfg-runtime-03-repository-boundary.mjs";
import { prepareCfgRuntime03EvidenceOutput } from "./cfg-runtime-03-evidence-output.mjs";

const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: process.cwd(), callerRoot: process.env.CFG_RUNTIME_03_ACTIVE_ROOT });
const evidenceOutput = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
let evidenceOutputFinalized = false;
process.on("exit", () => { if (!evidenceOutputFinalized) evidenceOutput.abort(); });
const artifactRoot = evidenceOutput.temporaryRoot;
const forbiddenHost = "fcawktdjoxvahhgvkebx.supabase.co";

const checks = [
  ["Configuration Foundation static verification", "configuration:verify-foundation"],
  ["Configuration Foundation negative controls", "configuration:verify-foundation-negative-controls"],
  ["Configuration Foundation database proof", "configuration:verify-foundation-database"],
  ["CFG-RUNTIME-01 static", "cfg-runtime-01:verify-static"],
  ["CFG-RUNTIME-01 database", "cfg-runtime-01:verify-database"],
  ["CFG-RUNTIME-01 browser", "cfg-runtime-01:qa-browser"],
  ["CFG-RUNTIME-02 static", "cfg-runtime-02:verify-static"],
  ["CFG-RUNTIME-02 database", "cfg-runtime-02:verify-database"],
  ["CFG-RUNTIME-02 browser", "cfg-runtime-02:qa-browser"],
  ["CFG-RUNTIME-03 static", "cfg-runtime-03:verify-static"],
  ["CFG-RUNTIME-03 database", "cfg-runtime-03:verify-database"],
  ["CFG-RUNTIME-03 browser", "cfg-runtime-03:qa-browser"],
  ["P1-01A static", "p1-01a:verify"],
  ["P1-01A database", "p1-01a:qa-db"],
  ["P1-01A browser", "p1-01a:qa-browser"],
  ["P1-01B.1", "p1-01b-1:verify"],
  ["P1-01B.1 browser", "p1-01b-1:capture"],
  ["P1-01B.2", "p1-01b-2:verify"],
  ["P1-01B.2 browser", "p1-01b-2:capture"],
  ["Workflow actions", "workflow:verify-actions"],
  ["Build", "build"],
  ["Typecheck", "typecheck"],
  ["Lint", "lint"],
];

const artifactOverrides = {
  CFG_RUNTIME_03_ACTIVE_ROOT: root,
  CFG_RUNTIME_03_ACTIVE_RUN_ROOT: process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT,
  CFG_RUNTIME_03_EVIDENCE_NAMESPACE: process.env.CFG_RUNTIME_03_EVIDENCE_NAMESPACE,
  CFG_RUNTIME_03_ATTEMPT_ID: process.env.CFG_RUNTIME_03_ATTEMPT_ID,
  CFG_RUNTIME_03_SUITE: process.env.CFG_RUNTIME_03_SUITE,
  CFG_RUNTIME_03_COMMAND_NUMBER: process.env.CFG_RUNTIME_03_COMMAND_NUMBER,
  CFG_RUNTIME_03_INVOCATION_ID: process.env.CFG_RUNTIME_03_INVOCATION_ID,
  CFG_RUNTIME_03_NESTED_OUTPUT_PARENT: evidenceOutput.temporaryRoot,
  CFG_RUNTIME_03_RUN_PHASE: "regression",
};
const baseEnv = {
  ...createSanitizedChildEnv(artifactOverrides),
  NODE_ENV: "test",
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
};

const results = [];
for (const [checkIndex, [label, script]] of checks.entries()) {
  const startedAt = new Date();
  const invocation = commandInvocation(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script]);
  const childEnv = {
    ...baseEnv,
    CFG_RUNTIME_03_INVOCATION_ID: `regression-${String(checkIndex + 1).padStart(2, "0")}-${script.replaceAll(":", "-")}`,
  };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    env: childEnv,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 80,
  });
  results.push({
    label,
    script,
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    stdoutTail: tail(redact(result.stdout)),
    stderrTail: tail(redact(result.stderr || result.error?.message)),
  });
}

const diffStartedAt = new Date();
const diff = spawnSync("git", ["diff", "--check"], {
  cwd: root,
  env: createSanitizedChildEnv(),
  encoding: "utf8",
  shell: false,
  maxBuffer: 1024 * 1024 * 20,
});
results.push({
  label: "git diff --check",
  script: "git diff --check",
  status: diff.status === 0 ? "pass" : "fail",
  exitCode: diff.status,
  startedAt: diffStartedAt.toISOString(),
  durationMs: Date.now() - diffStartedAt.getTime(),
  stdoutTail: tail(redact(diff.stdout)),
  stderrTail: tail(redact(diff.stderr)),
});

const payload = {
  suite: "CFG-RUNTIME-03 full sequential regression",
  runTimestamp: new Date().toISOString(),
  status: results.every((entry) => entry.status === "pass") ? "pass" : "fail",
  loopbackRuntime: {
    mode: "per-command-disposable-qualification",
    preservedProjectRejected: true,
  },
  envLocalSha256: sha256File(resolve(root, ".env.local")),
  forbiddenHostNonContact: true,
  results,
};
const outputPath = resolve(artifactRoot, `CFG-RUNTIME-03-REGRESSION-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

for (const entry of results) {
  console.log(`${entry.status.toUpperCase()}: ${entry.label} (${entry.durationMs}ms)`);
  if (entry.status !== "pass") {
    console.log(entry.stdoutTail);
    console.error(entry.stderrTail);
  }
}
console.log(`Regression manifest: ${outputPath}`);
if (payload.status !== "pass") process.exit(1);
const committedArtifactRoot = evidenceOutput.finalize();
evidenceOutputFinalized = true;
console.log(`Committed regression output: ${committedArtifactRoot}`);

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  return { command, args };
}

function redact(value) {
  return String(value ?? "")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(new RegExp(forbiddenHost.replace(/\./g, "\\."), "g"), "[FORBIDDEN_HOST]");
}

function tail(value) {
  const lines = String(value ?? "").trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-80).join("\n");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
