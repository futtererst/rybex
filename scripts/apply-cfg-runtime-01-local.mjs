import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "node:net";
import { rewriteSupabaseConfigForProject } from "./local-supabase-config-utils.mjs";
import { defaultSupabaseCommand } from "./cfg-runtime-03-loopback-guard.mjs";
import { ensureLoopbackNetwork, removeLoopbackNetwork } from "./local-supabase-loopback-network.mjs";

const repoRoot = process.cwd();
const supabaseCommand = defaultSupabaseCommand(repoRoot);
const nodeCommand = process.execPath;
const localProjectId = process.env.RYBEX_QUALIFICATION_PROJECT_ID;
const localDbContainer = process.env.RYBEX_QUALIFICATION_DB_CONTAINER;
const localProjectDir = process.env.RYBEX_QUALIFICATION_PROJECT_DIR;
if (!localProjectId || !localDbContainer || !localProjectDir || localProjectId === "rybex-2-local") throw new Error("disposable qualification identity required");
const artifactDir = join(repoRoot, "artifacts", "cfg-runtime-01-local-application");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const fullBackupPath = join(artifactDir, `pre-cfg-runtime-01-full-database-${timestamp}.dump`);
const backupPath = join(artifactDir, `pre-cfg-runtime-01-public-data-${timestamp}.dump`);
const authBackupPath = join(artifactDir, `pre-cfg-runtime-01-auth-users-${timestamp}.dump`);
const evidencePath = join(artifactDir, `LOCAL-APPLICATION-EVIDENCE-${timestamp}.json`);
const migrationRoot = join(repoRoot, "supabase", "migrations");
const evidence = {
  startedAt: new Date().toISOString(),
  localProjectId,
  fullBackupPath,
  backupPath,
  authBackupPath,
  checks: [],
  noGo: {
    staging: "untouched",
    production: "untouched",
    ConfigurationStudio: "not authorized",
    P1_01B_3: "paused",
  },
};

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || repoRoot,
    input: options.input,
    encoding: options.encoding ?? "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 200,
    env: options.env || process.env,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? "unknown"}\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

function record(name, passed, detail = "") {
  evidence.checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`);
  if (!passed) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
}

function parseStatus() {
  const result = run(supabaseCommand, ["status", "-o", "json", "--workdir", localProjectDir], { allowFailure: true });
  if (result.status !== 0) throw new Error(`supabase status failed\n${result.stdout}\n${result.stderr}`);
  const text = result.stdout;
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error(`Unable to parse supabase status output:\n${text}`);
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
}

function assertLocalStatus(status) {
  const api = new URL(status.API_URL);
  const db = new URL(status.DB_URL);
  record("local API target is loopback", ["127.0.0.1", "localhost", "::1"].includes(api.hostname), status.API_URL);
  record("local DB target is loopback", ["127.0.0.1", "localhost", "::1"].includes(db.hostname), status.DB_URL.replace(/:\/\/[^@]+@/, "://[redacted]@"));
  for (const key of ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN"]) {
    record(`${key} is not set`, !process.env[key], process.env[key] ? "set" : "unset");
  }
  const linkedRefPath = join(repoRoot, "supabase", ".temp", "project-ref");
  evidence.linkedProjectRefFile = existsSync(linkedRefPath) ? String(readFileSync(linkedRefPath, "utf8")).trim() : null;
  record("migration execution uses explicit --local mode", true, "supabase migration up --local --yes");
}

function psql(containerName, sql, options = {}) {
  return run("docker", ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q"], {
    input: sql,
    allowFailure: options.allowFailure,
  });
}

function psqlValue(containerName, sql) {
  return psql(containerName, `\\pset tuples_only on\n\\pset format unaligned\n${sql.trim()}\n`).stdout.trim();
}

function currentMigrationState(containerName) {
  return psqlValue(containerName, `
select coalesce(string_agg(version || ':' || name, ',' order by version), '')
from supabase_migrations.schema_migrations;
`);
}

function acceptedSliceFingerprint(containerName) {
  const payload = psqlValue(containerName, `
select jsonb_build_object(
  'opportunities', (select count(*) from opportunities),
  'opportunity_qualifications', (select count(*) from opportunity_qualifications),
  'pursuit_events', coalesce((select count(*) from opportunity_pursuit_authorization_events), 0),
  'bid_events', coalesce((select count(*) from opportunity_bid_submission_events), 0),
  'opportunity_hash', coalesce((select string_agg(id::text || ':' || lifecycle_status || ':' || version::text, ',' order by id) from opportunities), '')
)::text;
`);
  return {
    payload,
    sha256: createHash("sha256").update(payload).digest("hex"),
  };
}

function createBackup() {
  mkdirSync(dirname(backupPath), { recursive: true });
  const fullDump = run("docker", [
    "exec",
    localDbContainer,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-Fc",
    "--no-owner",
    "--no-privileges",
  ], {
    encoding: "buffer",
  });
  const publicDump = run("docker", [
    "exec",
    localDbContainer,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-Fc",
    "--data-only",
    "--schema=public",
    "--no-owner",
    "--no-privileges",
  ], {
    encoding: "buffer",
  });
  const authDump = run("docker", ["exec", localDbContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--data-only", "--table=auth.users", "--no-owner", "--no-privileges"], {
    encoding: "buffer",
  });
  writeFileSync(fullBackupPath, fullDump.stdout);
  writeFileSync(backupPath, publicDump.stdout);
  writeFileSync(authBackupPath, authDump.stdout);
  evidence.backup = {
    fullDatabase: {
      path: fullBackupPath,
      bytes: fullDump.stdout.length,
      sha256: createHash("sha256").update(fullDump.stdout).digest("hex"),
    },
    publicData: {
      path: backupPath,
      bytes: publicDump.stdout.length,
      sha256: createHash("sha256").update(publicDump.stdout).digest("hex"),
    },
    authUsers: {
      path: authBackupPath,
      bytes: authDump.stdout.length,
      sha256: createHash("sha256").update(authDump.stdout).digest("hex"),
    },
    restoreMethod: "Apply repository migrations through 0027 in an isolated disposable Supabase database, then restore auth.users and public data-only backups as the local container superuser. The public restore uses --disable-triggers in the disposable proof only so circular Configuration Foundation active-version references restore coherently without touching the existing local database.",
  };
  record("pre-migration full database backup captured", fullDump.stdout.length > 0, `${fullDump.stdout.length} bytes`);
  record("pre-migration public data backup captured", publicDump.stdout.length > 0, `${publicDump.stdout.length} bytes`);
  record("pre-migration auth.users data backup captured", authDump.stdout.length > 0, `${authDump.stdout.length} bytes`);
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

async function getFreePorts(count) {
  const ports = [];
  for (let index = 0; index < count; index += 1) ports.push(await getFreePort());
  return ports;
}

function copySupabaseProject(projectDir, projectId, ports) {
  mkdirSync(join(projectDir, "supabase", "migrations"), { recursive: true });
  let config = readFileSync(join(repoRoot, "supabase", "config.toml"), "utf8");
  config = rewriteSupabaseConfigForProject(config, projectId, ports);
  writeFileSync(join(projectDir, "supabase", "config.toml"), config);
}

function findDatabaseContainer(projectId) {
  const names = run("docker", ["ps", "--format", "{{.Names}}"]).stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const exact = `supabase_db_${projectId}`;
  if (names.includes(exact)) return exact;
  const match = names.find((name) => name.includes(projectId) && name.includes("db"));
  if (!match) throw new Error(`No disposable restore DB container found for ${projectId}`);
  return match;
}

function applyRestoreMigrations(containerName) {
  const files = readdirSync(migrationRoot)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 27)
    .sort();
  for (const fileName of files) {
    const sql = readFileSync(join(migrationRoot, fileName), "utf8");
    psql(containerName, `\\echo Restore proof applying ${fileName}\n${sql}\n`);
  }
}

async function proveBackupRestore() {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const projectId = `rybex-cfg01-restore-${suffix}`.slice(0, 50);
  const projectDir = join(tmpdir(), `rybex-cfg01-restore-${suffix}`);
  const [api, db, shadow, studio, inbucket, smtp, pop3, analytics] = await getFreePorts(8);
  copySupabaseProject(projectDir, projectId, { api, db, shadow, studio, inbucket, smtp, pop3, analytics });
  evidence.restoreProof = { projectId, db: `127.0.0.1:${db}` };
  let containerName;
  const networkName = ensureLoopbackNetwork(projectId);
  try {
    const exclude = "edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector";
    const start = run(process.execPath, [join(repoRoot, "scripts", "run-supabase-loopback.mjs"), "start", "--workdir", projectDir, "--exclude", exclude, "--network-id", networkName, "--yes"], { allowFailure: true });
    if (start.status !== 0) throw new Error(`restore proof disposable start failed\n${start.stdout}\n${start.stderr}`);
    containerName = findDatabaseContainer(projectId);
    applyRestoreMigrations(containerName);
    run("docker", ["exec", "-i", "-e", "PGPASSWORD=postgres", containerName, "pg_restore", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--no-owner", "--no-privileges"], {
      input: readFileSync(authBackupPath),
      encoding: "buffer",
    });
    run("docker", ["exec", "-i", "-e", "PGPASSWORD=postgres", containerName, "pg_restore", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--disable-triggers", "--no-owner", "--no-privileges"], {
      input: readFileSync(backupPath),
      encoding: "buffer",
    });
    const count = Number(psqlValue(containerName, "select count(*) from information_schema.tables where table_schema = 'public';"));
    const restoredFingerprint = acceptedSliceFingerprint(containerName);
    record("backup restored into disposable local database", count > 0, `${projectId}; public tables=${count}`);
    record("restored accepted P1 fingerprint matches pre-migration backup source", restoredFingerprint.sha256 === evidence.acceptedSliceBefore.sha256, `${restoredFingerprint.sha256} -> ${evidence.acceptedSliceBefore.sha256}`);
  } finally {
    run(supabaseCommand, ["stop", "--workdir", projectDir, "--project-id", projectId, "--no-backup", "--yes"], { allowFailure: true });
    removeLoopbackNetwork(projectId);
    rmSync(projectDir, { recursive: true, force: true });
  }
}

function applyLocalMigrations() {
  const result = run(supabaseCommand, ["migration", "up", "--local", "--yes", "--workdir", localProjectDir], { allowFailure: true });
  evidence.migrationUpOutput = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  record("pending migrations applied with explicit local command", result.status === 0, evidence.migrationUpOutput);
}

function verifyLocalCatalog(containerName) {
  const columns = Number(psqlValue(containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
  and column_name in ('pricing_review_configuration_version_id','pricing_review_gate_key');
`));
  record("local catalog has CFG-RUNTIME-01 provenance columns", columns === 2, `columns=${columns}`);
  const functions = Number(psqlValue(containerName, `
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('p1_01a_pricing_review_configuration_v1','p1_01a_pricing_review_readiness_v1');
`));
  record("local catalog has CFG-RUNTIME-01 resolver functions", functions >= 2, `functions=${functions}`);
}

function loadLocalPack(status) {
  const result = run(nodeCommand, ["scripts/load-cfg-runtime-01-pack-local.mjs"], {
    allowFailure: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      SUPABASE_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
    },
  });
  evidence.loaderOutput = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  record("local compatibility pack loaded idempotently", result.status === 0, evidence.loaderOutput);
}

try {
  const status = parseStatus();
  evidence.status = {
    apiUrl: status.API_URL,
    dbUrl: status.DB_URL?.replace(/:\/\/[^@]+@/, "://[redacted]@"),
  };
  assertLocalStatus(status);
  record("expected local database container is running", run("docker", ["ps", "--format", "{{.Names}}"]).stdout.includes(localDbContainer), localDbContainer);
  evidence.migrationStateBefore = currentMigrationState(localDbContainer);
  evidence.acceptedSliceBefore = acceptedSliceFingerprint(localDbContainer);
  createBackup();
  await proveBackupRestore();
  applyLocalMigrations();
  verifyLocalCatalog(localDbContainer);
  evidence.migrationStateAfter = currentMigrationState(localDbContainer);
  evidence.acceptedSliceAfter = acceptedSliceFingerprint(localDbContainer);
  record("accepted P1 slice fingerprint preserved after migrations", evidence.acceptedSliceBefore.sha256 === evidence.acceptedSliceAfter.sha256, `${evidence.acceptedSliceBefore.sha256} -> ${evidence.acceptedSliceAfter.sha256}`);
  loadLocalPack(status);
  evidence.finishedAt = new Date().toISOString();
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Wrote ${evidencePath}`);
  console.log("CFG-RUNTIME-01 local application completed.");
} catch (error) {
  evidence.failedAt = new Date().toISOString();
  evidence.error = error instanceof Error ? error.message : String(error);
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.error("CFG-RUNTIME-01 local application failed.");
  console.error(evidence.error);
  process.exit(1);
}
