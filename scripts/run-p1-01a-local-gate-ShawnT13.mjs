import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readSupabaseConfigPorts } from "./local-supabase-config-utils.mjs";

const root = process.cwd();
const dockerBin = "C:\\Program Files\\Docker\\Docker\\resources\\bin";
const evidenceDir = join(root, "visual-qa-output", "p1-01a-opportunity");
const resultsPath = join(evidenceDir, "results.json");
const environmentPath = join(evidenceDir, "environment-summary.json");
const localSupabasePorts = readSupabaseConfigPorts(readFileSync(join(root, "supabase", "config.toml"), "utf8"));
const testPassword = `P1-01A-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const startedAt = new Date().toISOString();
const commandResults = [];
let stackStartedByThisRun = false;

mkdirSync(evidenceDir, { recursive: true });

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
  const supabaseCliVersion = runCapture("npx.cmd", ["supabase", "--version"], {
    label: "supabase --version",
    includeDockerPath: true
  }).stdout.trim();

  if (!existsSync(join(root, "supabase", "config.toml"))) {
    run("npx.cmd", ["supabase", "init"], {
      label: "supabase init",
      includeDockerPath: true
    });
  }

  run("npx.cmd", ["supabase", "start"], {
    label: "supabase start",
    includeDockerPath: true,
    suppressOutput: true
  });
  stackStartedByThisRun = true;

  const statusEnv = runCapture("npx.cmd", ["supabase", "status", "-o", "env"], {
    label: "supabase status -o env",
    includeDockerPath: true,
    suppressOutput: true
  }).stdout;
  const localEnv = mapSupabaseEnv(statusEnv);

  writeEnvironmentSummary({
    nodeVersion,
    supabaseCliVersion,
    dockerVersion,
    localEnv
  });

  const baseEnv = {
    ...process.env,
    ...localEnv,
    NEXT_TELEMETRY_DISABLED: "1",
    RYBEXOS_RUNTIME_MODE: "test",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database",
    FOUNDATION_0A_TEST_PASSWORD: testPassword,
    FOUNDATION_0A_RESULTS_PATH: join(root, "visual-qa-output", "foundation-0a-security", "results.json"),
    FOUNDATION_0B_RESULTS_PATH: join(root, "visual-qa-output", "foundation-0b", "results.json"),
    P1_01A_RESULTS_PATH: resultsPath,
    Path: `${dockerBin};${process.env.Path ?? process.env.PATH ?? ""}`,
    PATH: `${dockerBin};${process.env.PATH ?? process.env.Path ?? ""}`
  };

  run("npx.cmd", ["supabase", "db", "reset", "--local", "--no-seed"], {
    label: "supabase db reset --local --no-seed",
    env: baseEnv,
    includeDockerPath: true
  });

  run("npx.cmd", ["supabase", "db", "lint", "--local"], {
    label: "supabase db lint --local",
    env: baseEnv,
    includeDockerPath: true
  });

  run("node", ["scripts/bootstrap-foundation-0a-local.mjs"], {
    label: "bootstrap-foundation-0a-local",
    env: baseEnv
  });

  run("npm.cmd", ["run", "p1-01a:verify"], { label: "p1-01a:verify", env: baseEnv });
  run("npm.cmd", ["run", "p1-01a:qa-db"], { label: "p1-01a:qa-db", env: baseEnv });
  run("npm.cmd", ["run", "p1-01a:qa-browser"], { label: "p1-01a:qa-browser", env: baseEnv });

  const regressionEnv = {
    ...baseEnv,
    RYBEXOS_AUTH_MODE: "demo",
    RYBEXOS_DATA_SOURCE: "seed",
    RYBEXOS_BILLING_V2_PERSISTENCE: "local",
    RYBEXOS_FIELD_ISSUE_PERSISTENCE: "local",
    RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "local"
  };

  const regressions = [
    ["npm.cmd", ["run", "foundation-0a:verify"]],
    ["npm.cmd", ["run", "foundation-0b:verify"]],
    ["npm.cmd", ["run", "foundation-0c:verify"]],
    ["npm.cmd", ["run", "foundation-0d:verify"]],
    ["npm.cmd", ["run", "foundation-0e:verify"]],
    ["npm.cmd", ["run", "foundation-0f:verify"]],
    ["npm.cmd", ["run", "command-center:c-plus-verify"]],
    ["npm.cmd", ["run", "command-center:supporting-context-verify"]],
    ["npm.cmd", ["run", "typecheck"]],
    ["npm.cmd", ["run", "lint"]],
    ["npm.cmd", ["run", "build"]]
  ];

  for (const [command, args] of regressions) {
    run(command, args, { label: args.join(" "), env: regressionEnv });
  }

  finalizeEvidence({
    verdict: "GATE_P1_01A_PASSED",
    failure: null,
    nodeVersion,
    supabaseCliVersion,
    dockerVersion
  });
  console.log("P1-01A local gate passed.");
} catch (error) {
  finalizeEvidence({
    verdict: "GATE_P1_01A_BLOCKED",
    failure: error instanceof Error ? error.message : String(error)
  });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (stackStartedByThisRun) {
    const result = spawnSync("npx.cmd", ["supabase", "stop"], {
      cwd: root,
      env: withDockerPath(process.env, true),
      encoding: "utf8",
      shell: process.platform === "win32",
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
    maxBuffer: 1024 * 1024 * 60
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
  return String(value ?? "").replace(/^["']|["']$/g, "");
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
    migrationVersionsApplied: [
      "0001_core_foundation",
      "0002_d1_d2_pipeline_projects",
      "0003_workflow_transactions",
      "0004_rls_security_scaffold",
      "0005_identity_workspace_security",
      "0006_shared_command_audit_evidence",
      "0007_billing_v2_production_persistence",
      "0008_field_issue_rfi_change_production_persistence",
      "0009_closeout_production_persistence",
      "0010_production_cutover_hardening",
      "0011_p1_01a_opportunity_intake_qualification"
    ],
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
    commandResults,
    regressionResults: commandResults.filter((entry) => entry.command.includes(":") || entry.command === "run build"),
    finalGateVerdict: verdict,
    p1_01bAuthorized: false,
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
  return String(value)
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}
