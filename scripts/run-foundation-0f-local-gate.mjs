import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultSupabaseCommand } from "./cfg-runtime-03-loopback-guard.mjs";

const root = process.cwd();
const supabaseCommand = defaultSupabaseCommand(root);
const dockerBin = "C:\\Program Files\\Docker\\Docker\\resources\\bin";
const evidenceDir = join(root, "visual-qa-output", "foundation-0f");
const resultsPath = join(evidenceDir, "results.json");
const environmentPath = join(evidenceDir, "environment-summary.json");
const testPassword = `Foundation-0F-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const startedAt = new Date().toISOString();
const commandResults = [];

let stackStartedByThisRun = false;
let scannerProcess;
let scannerUrl = "";

if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });

try {
  const nodeVersion = process.version;
  const dockerVersion = summarizeDockerVersion(runCapture("docker", ["version"], {
    label: "docker version",
    includeDockerPath: true
  }).stdout);
  runCapture("docker", ["info"], { label: "docker info", includeDockerPath: true });
  const supabaseVersion = runCapture(supabaseCommand, ["--version"], {
    label: "supabase --version",
    includeDockerPath: true
  }).stdout.trim();

  if (!existsSync(join(root, "supabase", "config.toml"))) {
    run(supabaseCommand, ["init"], { label: "supabase init", includeDockerPath: true });
  }

  run(process.execPath, ["scripts/run-guarded-qualification-supabase.mjs", "start"], {
    label: "supabase start",
    includeDockerPath: true,
    suppressOutput: true
  });
  stackStartedByThisRun = true;

  const statusEnv = runCapture(supabaseCommand, ["status", "-o", "env", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR], {
    label: "supabase status -o env",
    includeDockerPath: true,
    suppressOutput: true
  }).stdout;
  const localEnv = mapSupabaseEnv(statusEnv);

  const scanner = await startScannerService();
  scannerProcess = scanner.process;
  scannerUrl = scanner.url;

  writeEnvironmentSummary({
    nodeVersion,
    supabaseCliVersion: supabaseVersion,
    dockerVersion,
    localEnv,
    scannerUrl
  });

  const baseEnv = {
    ...process.env,
    ...localEnv,
    RYBEXOS_RUNTIME_MODE: "test",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database",
    RYBEXOS_BILLING_V2_PERSISTENCE: "database",
    RYBEXOS_FIELD_ISSUE_PERSISTENCE: "database",
    RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "database",
    RYBEXOS_EVIDENCE_STORE: "database",
    RYBEXOS_SCANNER_MODE: "local_service",
    RYBEXOS_SCANNER_URL: scannerUrl,
    FOUNDATION_0A_TEST_PASSWORD: testPassword,
    FOUNDATION_0F_RESULTS_PATH: resultsPath,
    Path: `${dockerBin};${process.env.Path ?? process.env.PATH ?? ""}`,
    PATH: `${dockerBin};${process.env.PATH ?? process.env.Path ?? ""}`
  };

  run(supabaseCommand, ["db", "reset", "--local", "--no-seed", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR], {
    label: "supabase db reset --local --no-seed",
    env: baseEnv,
    includeDockerPath: true
  });
  run(supabaseCommand, ["db", "lint", "--local", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR], {
    label: "supabase db lint --local",
    env: baseEnv,
    includeDockerPath: true
  });
  run("node", ["scripts/bootstrap-foundation-0a-local.mjs"], {
    label: "bootstrap-foundation-0a-local",
    env: baseEnv
  });

  run("npm.cmd", ["run", "foundation-0f:verify"], { label: "foundation-0f:verify", env: baseEnv });
  run("npm.cmd", ["run", "production:verify-config"], { label: "production:verify-config", env: productionEnv(baseEnv) });
  run("npm.cmd", ["run", "production:verify-no-fallback"], { label: "production:verify-no-fallback", env: productionEnv(baseEnv) });
  run("npm.cmd", ["run", "core:migrate-local:dry-run"], { label: "core:migrate-local:dry-run", env: baseEnv });
  run("node", ["scripts/verify-foundation-0f-security.mjs"], { label: "verify-foundation-0f-security", env: baseEnv });
  run("node", ["scripts/qa-foundation-0f-backup-restore.mjs"], { label: "qa-foundation-0f-backup-restore", env: baseEnv });
  run("node", ["scripts/qa-foundation-0f-resilience.mjs"], { label: "qa-foundation-0f-resilience", env: baseEnv });
  run("node", ["scripts/qa-foundation-0f-performance.mjs"], { label: "qa-foundation-0f-performance", env: baseEnv });
  run("npm.cmd", ["run", "foundation-0f:verify-auth-bridge"], { label: "foundation-0f:verify-auth-bridge", env: baseEnv });
  run("npm.cmd", ["run", "foundation-0f:qa-auth-session"], { label: "foundation-0f:qa-auth-session", env: productionEnv(baseEnv) });
  run("node", ["scripts/qa-foundation-0f-core-journey.mjs"], { label: "qa-foundation-0f-core-journey", env: productionEnv(baseEnv) });

  const regressionEnv = {
    ...baseEnv,
    RYBEXOS_AUTH_MODE: "demo",
    RYBEXOS_DATA_SOURCE: "seed",
    RYBEXOS_BILLING_V2_PERSISTENCE: "local",
    RYBEXOS_FIELD_ISSUE_PERSISTENCE: "local",
    RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "local",
    RYBEXOS_EVIDENCE_STORE: "local",
    RYBEXOS_SCANNER_MODE: "disabled"
  };

  for (const [command, args] of [
    ["npm.cmd", ["run", "foundation-0a:verify"]],
    ["npm.cmd", ["run", "foundation-0a:qa"]],
    ["npm.cmd", ["run", "foundation-0b:verify"]],
    ["npm.cmd", ["run", "foundation-0c:verify"]],
    ["npm.cmd", ["run", "foundation-0d:verify"]],
    ["npm.cmd", ["run", "foundation-0e:verify"]],
    ["npm.cmd", ["run", "operating-slices:verify"]],
    ["npm.cmd", ["run", "billing-v2:verify-persisted-slice"]],
    ["npm.cmd", ["run", "billing-v2:qa"]],
    ["npm.cmd", ["run", "field-issue:verify-persisted-slice"]],
    ["npm.cmd", ["run", "field-issue:qa"]],
    ["npm.cmd", ["run", "closeout-final-billing:verify-persisted-slice"]],
    ["npm.cmd", ["run", "closeout-final-billing:qa"]],
    ["npm.cmd", ["run", "command-center:c-plus-verify"]],
    ["npm.cmd", ["run", "command-center:supporting-context-verify"]],
    ["npm.cmd", ["run", "typecheck"]],
    ["npm.cmd", ["run", "lint"]],
    ["npm.cmd", ["run", "build"]]
  ]) {
    run(command, args, { label: args.join(" "), env: regressionEnv });
  }

  finalizeEvidence({
    verdict: "GATE_0F_PASSED",
    failure: null,
    nodeVersion,
    supabaseCliVersion: supabaseVersion,
    dockerVersion
  });
  console.log("Foundation 0F local gate passed.");
} catch (error) {
  finalizeEvidence({
    verdict: "GATE_0F_BLOCKED",
    failure: error instanceof Error ? error.message : String(error)
  });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (scannerProcess) {
    scannerProcess.kill();
    markFinalScannerStatus("stopped");
  }
  if (stackStartedByThisRun && !process.env.RYBEX_QUALIFICATION_PROJECT_ID) {
    const result = spawnSync(supabaseCommand, ["stop", "--workdir", process.env.RYBEX_QUALIFICATION_PROJECT_DIR, "--project-id", process.env.RYBEX_QUALIFICATION_PROJECT_ID, "--no-backup", "--yes"], {
      cwd: root,
      env: withDockerPath(process.env, true),
      encoding: "utf8",
      shell: false,
      maxBuffer: 1024 * 1024 * 20
    });
    commandResults.push({
      command: "supabase stop",
      status: result.status === 0 ? "pass" : "fail",
      exitCode: result.status,
      stderr: redact(result.stderr ?? result.error?.message ?? "")
    });
    if (result.stdout) process.stdout.write(redact(result.stdout));
    if (result.stderr) process.stderr.write(redact(result.stderr));
    markFinalLocalStackStatus(result.status === 0 ? "stopped" : "stop_failed");
  }
}

function productionEnv(env) {
  return {
    ...env,
    RYBEXOS_RUNTIME_MODE: "production",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database",
    RYBEXOS_BILLING_V2_PERSISTENCE: "database",
    RYBEXOS_FIELD_ISSUE_PERSISTENCE: "database",
    RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "database",
    RYBEXOS_EVIDENCE_STORE: "database",
    RYBEXOS_SCANNER_MODE: "local_service",
    RYBEXOS_SCANNER_URL: scannerUrl
  };
}

async function startScannerService() {
  const port = await getFreePort();
  const child = spawn(process.execPath, ["scripts/local-foundation-0f-scanner-service.mjs", String(port)], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  const url = `http://127.0.0.1:${port}`;
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(`${url}/scan`, { method: "POST", body: Buffer.from("scanner startup check") });
      if (response.ok) return { process: child, url };
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error(`Local scanner service did not become ready. ${output.join("").slice(-1000)}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: withDockerPath(options.env ?? process.env, options.includeDockerPath),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 100
  });

  const entry = {
    command: options.label ?? `${command} ${args.join(" ")}`,
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    stderr: redact(result.stderr ?? result.error?.message ?? "")
  };
  commandResults.push(entry);

  if (!options.suppressOutput) {
    if (result.stdout) process.stdout.write(redact(result.stdout));
    if (result.stderr) process.stderr.write(redact(result.stderr));
  }

  if (result.status !== 0) {
    throw new Error(`${entry.command} failed with exit code ${result.status}: ${entry.stderr || "no stderr"}`);
  }

  return result;
}

function runCapture(command, args, options = {}) {
  return run(command, args, { ...options, suppressOutput: true });
}

function withDockerPath(env, includeDockerPath) {
  if (!includeDockerPath) return env;
  return {
    ...env,
    Path: `${dockerBin};${env.Path ?? env.PATH ?? ""}`,
    PATH: `${dockerBin};${env.PATH ?? env.Path ?? ""}`
  };
}

function mapSupabaseEnv(output) {
  const parsed = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    parsed[match[1]] = stripQuotes(match[2]);
  }
  const apiUrl = parsed.API_URL ?? parsed.SUPABASE_URL ?? parsed.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = parsed.PUBLISHABLE_KEY ?? parsed.SUPABASE_PUBLISHABLE_KEY ?? parsed.ANON_KEY ?? parsed.SUPABASE_ANON_KEY;
  const anonKey = parsed.ANON_KEY ?? parsed.SUPABASE_ANON_KEY ?? publishableKey;
  const serviceKey = parsed.SERVICE_ROLE_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY ?? parsed.SECRET_KEY ?? parsed.SUPABASE_SECRET_KEY;
  if (!apiUrl || !publishableKey || !serviceKey) throw new Error("Unable to map local Supabase credentials from status output.");
  return {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_SECRET_KEY: serviceKey
  };
}

function stripQuotes(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function summarizeDockerVersion(output) {
  return output.split(/\r?\n/).filter((line) => /Version:|Server:|Client:|Context:|Docker Desktop/i.test(line)).join(" | ").slice(0, 1000);
}

function writeEnvironmentSummary(input) {
  const summary = {
    runTimestamp: startedAt,
    nodeVersion: input.nodeVersion,
    supabaseCliVersion: input.supabaseCliVersion,
    dockerVersion: input.dockerVersion,
    localSupabase: {
      apiUrl: redactUrl(input.localEnv.NEXT_PUBLIC_SUPABASE_URL),
      hasPublishableKey: Boolean(input.localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      hasAnonKey: Boolean(input.localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasServiceRoleKey: Boolean(input.localEnv.SUPABASE_SERVICE_ROLE_KEY)
    },
    runtimeMode: "production",
    persistenceModes: {
      dataSource: "database",
      billing: "database",
      fieldIssue: "database",
      closeout: "database",
      evidence: "database"
    },
    scanner: {
      mode: "local_service",
      url: redactUrl(input.scannerUrl)
    },
    migrationTarget: "0010_production_cutover_hardening"
  };
  writeFileSync(environmentPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function finalizeEvidence(extra) {
  const existing = existsSync(resultsPath) ? safeJson(readFileSync(resultsPath, "utf8")) : {};
  const payload = {
    ...existing,
    gate: "0F",
    runTimestamp: startedAt,
    commandResults,
    finalLocalStackStatus: existing.finalLocalStackStatus ?? "unknown",
    finalScannerStatus: existing.finalScannerStatus ?? "unknown",
    ...extra
  };
  writeFileSync(resultsPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function markFinalLocalStackStatus(status) {
  const existing = existsSync(resultsPath) ? safeJson(readFileSync(resultsPath, "utf8")) : {};
  writeFileSync(resultsPath, `${JSON.stringify({ ...existing, finalLocalStackStatus: status }, null, 2)}\n`);
}

function markFinalScannerStatus(status) {
  const existing = existsSync(resultsPath) ? safeJson(readFileSync(resultsPath, "utf8")) : {};
  writeFileSync(resultsPath, `${JSON.stringify({ ...existing, finalScannerStatus: status }, null, 2)}\n`);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}:${url.port}`;
  } catch {
    return "[LOCAL_URL]";
  }
}
