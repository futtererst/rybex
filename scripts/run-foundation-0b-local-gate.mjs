import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readSupabaseConfigPorts } from "./local-supabase-config-utils.mjs";
import { defaultSupabaseCommand } from "./cfg-runtime-03-loopback-guard.mjs";

const root = process.cwd();
const supabaseCommand = defaultSupabaseCommand(root);
const localSupabasePorts = readSupabaseConfigPorts(readFileSync(join(root, "supabase", "config.toml"), "utf8"));
const dockerBin = "C:\\Program Files\\Docker\\Docker\\resources\\bin";
const evidenceDir = join(root, "visual-qa-output", "foundation-0b");
const resultsPath = join(evidenceDir, "results.json");
const environmentPath = join(evidenceDir, "environment-summary.json");
const testPassword = `Foundation-0B-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const startedAt = new Date().toISOString();
const commandResults = [];

let stackStartedByThisRun = false;

if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });

try {
  const nodeVersion = process.version;
  const dockerVersion = summarizeDockerVersion(runCapture("docker", ["version"], {
    label: "docker version",
    includeDockerPath: true
  }).stdout);
  runCapture("docker", ["info"], {
    label: "docker info",
    includeDockerPath: true
  });
  const supabaseVersion = runCapture(supabaseCommand, ["--version"], {
    label: "supabase --version",
    includeDockerPath: true
  }).stdout.trim();

  if (!existsSync(join(root, "supabase", "config.toml"))) {
    run(supabaseCommand, ["init"], {
      label: "supabase init",
      includeDockerPath: true
    });
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

  writeEnvironmentSummary({
    nodeVersion,
    supabaseCliVersion: supabaseVersion,
    dockerVersion,
    localEnv
  });

  const baseEnv = {
    ...process.env,
    ...localEnv,
    RYBEXOS_RUNTIME_MODE: "test",
    FOUNDATION_0A_TEST_PASSWORD: testPassword,
    FOUNDATION_0A_RESULTS_PATH: join(root, "visual-qa-output", "foundation-0a-security", "results.json"),
    FOUNDATION_0B_RESULTS_PATH: resultsPath,
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

  run("npm.cmd", ["run", "foundation-0b:verify"], { label: "foundation-0b:verify", env: baseEnv });
  run("npm.cmd", ["run", "foundation-0b:qa-command"], { label: "foundation-0b:qa-command", env: baseEnv });
  run("npm.cmd", ["run", "foundation-0b:qa-evidence"], { label: "foundation-0b:qa-evidence", env: baseEnv });

  const regressions = [
    ["npm.cmd", ["run", "foundation-0a:verify"]],
    ["npm.cmd", ["run", "foundation-0a:qa"]],
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
  ];

  for (const [command, args] of regressions) {
    run(command, args, { label: args.join(" "), env: baseEnv });
  }

  finalizeEvidence({
    verdict: "GATE_0B_PASSED",
    failure: null,
    nodeVersion,
    supabaseCliVersion: supabaseVersion,
    dockerVersion
  });
  console.log("Foundation 0B local gate passed.");
} catch (error) {
  finalizeEvidence({
    verdict: "GATE_0B_BLOCKED",
    failure: error instanceof Error ? error.message : String(error)
  });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: withDockerPath(options.env ?? process.env, options.includeDockerPath),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 30
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

  if (!apiUrl || !publishableKey || !serviceKey) {
    throw new Error("Unable to map local Supabase credentials from status output.");
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_SECRET_KEY: serviceKey
  };
}

function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, "");
}

function writeEnvironmentSummary({ nodeVersion, supabaseCliVersion, dockerVersion, localEnv }) {
  const api = new URL(localEnv.NEXT_PUBLIC_SUPABASE_URL);
  const payload = {
    runTimestamp: startedAt,
    nodeVersion,
    supabaseCliVersion,
    dockerVersion,
    dockerAvailable: true,
    runtimeMode: "test",
    apiHost: api.hostname,
    apiPort: api.port,
    databaseHost: "127.0.0.1",
    databasePort: localSupabasePorts.db,
    studioHost: "127.0.0.1",
    studioPort: localSupabasePorts.studio,
    migrationCount: 6,
    localStack: "running"
  };
  writeFileSync(environmentPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function summarizeDockerVersion(output) {
  const versions = [...output.matchAll(/Version:\s+([0-9.]+)/g)].map((match) => match[1]);
  return {
    client: versions[0] ?? "unknown",
    server: versions[1] ?? "unknown"
  };
}

function finalizeEvidence({ verdict, failure, nodeVersion, supabaseCliVersion, dockerVersion }) {
  const existing = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : {};
  const payload = {
    ...existing,
    runTimestamp: startedAt,
    nodeVersion: nodeVersion ?? process.version,
    supabaseCliVersion: supabaseCliVersion ?? "unknown",
    dockerVersion: dockerVersion ?? "unknown",
    migrationVersionsApplied: [
      "0001_core_foundation",
      "0002_d1_d2_pipeline_projects",
      "0003_workflow_transactions",
      "0004_rls_security_scaffold",
      "0005_identity_workspace_security",
      "0006_shared_command_audit_evidence"
    ],
    commandResults,
    regressionResults: commandResults.filter((entry) => entry.command.includes(":") || entry.command === "run build"),
    finalGateVerdict: verdict,
    failure
  };
  writeFileSync(resultsPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function markFinalLocalStackStatus(status) {
  if (!existsSync(environmentPath)) return;
  const payload = JSON.parse(readFileSync(environmentPath, "utf8"));
  payload.finalLocalStack = status;
  writeFileSync(environmentPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function redact(value) {
  if (!value) return "";
  return value
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}
