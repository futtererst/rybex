import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createServer } from "node:net";
import {
  createLocalRuntimeEnv,
  createSanitizedChildEnv,
  defaultSupabaseCommand,
  parseSupabaseStatusEnv,
  validateSupabaseStatusEndpoints,
} from "./cfg-runtime-03-loopback-guard.mjs";
import { readSupabaseConfigPorts, rewriteSupabaseConfigForProject } from "./local-supabase-config-utils.mjs";
import {
  ensureLoopbackNetwork,
  inspectSupabaseProjectBindings,
  removeLoopbackNetwork,
} from "./local-supabase-loopback-network.mjs";
import { discoverCfgRuntime03RepositoryRoot, validateCfgRuntime03RepositoryRoot } from "./cfg-runtime-03-repository-boundary.mjs";

export const PRESERVED_PROJECT_ID = "rybex-2-local";
export const PRESERVED_DB_PORT = "55322";
export const QUALIFICATION_PROJECT_PREFIX = "rybex-cfg03-q-";

export function assertDisposableQualificationIdentity({ root, projectId, projectDir, ports, env = process.env }) {
  const repoRoot = validateCfgRuntime03RepositoryRoot(root);
  const resolvedProjectDir = resolve(projectDir ?? "");
  if (!projectId || !projectId.startsWith(QUALIFICATION_PROJECT_PREFIX) || projectId === PRESERVED_PROJECT_ID) {
    throw new Error("qualification_project_identity_required");
  }
  if (!projectDir || resolvedProjectDir === repoRoot || relative(repoRoot, resolvedProjectDir) === "") {
    throw new Error("qualification_project_directory_must_be_disposable");
  }
  if (!existsSync(join(resolvedProjectDir, "supabase", "config.toml"))) {
    throw new Error("qualification_project_config_missing");
  }
  const config = readFileSync(join(resolvedProjectDir, "supabase", "config.toml"), "utf8");
  if (!config.includes(`project_id = "${projectId}"`)) throw new Error("qualification_project_identity_config_mismatch");
  const actualPorts = ports ?? readSupabaseConfigPorts(config);
  for (const [key, value] of Object.entries(actualPorts)) {
    if (String(value).startsWith("5532")) throw new Error(`preserved_stack_port_rejected:${key}:${value}`);
  }
  for (const [key, value] of Object.entries(env)) {
    if (/DATABASE_URL|DB_URL|SUPABASE_URL/i.test(key) && String(value ?? "").includes(`:${PRESERVED_DB_PORT}`)) {
      throw new Error(`preserved_stack_url_rejected:${key}`);
    }
    if (String(value ?? "").includes(PRESERVED_PROJECT_ID)) throw new Error(`preserved_stack_identity_rejected:${key}`);
    if (String(value ?? "").includes(`supabase_db_${PRESERVED_PROJECT_ID}`)) throw new Error(`preserved_stack_container_rejected:${key}`);
    if (String(value ?? "").includes(`supabase_db_${PRESERVED_PROJECT_ID}`)) throw new Error(`preserved_stack_volume_rejected:${key}`);
  }
  return { root: repoRoot, projectId, projectDir: resolvedProjectDir, ports: actualPorts };
}

export async function createDisposableQualificationRuntime(options = {}) {
  const root = discoverCfgRuntime03RepositoryRoot({ scriptUrl: import.meta.url, cwd: options.root ?? process.cwd(), callerRoot: options.callerRoot ?? process.env.CFG_RUNTIME_03_ACTIVE_ROOT });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const projectId = `${QUALIFICATION_PROJECT_PREFIX}${options.label ?? "run"}-${suffix}`.slice(0, 55);
  const projectDir = mkdtempSync(join(tmpdir(), `${projectId}-`));
  const ports = await allocatePorts();
  const runtime = { root, projectId, projectDir, ports, createdContainers: [], createdNetworks: [], createdVolumes: [] };
  try {
    prepareProject(runtime);
    assertDisposableQualificationIdentity(runtime);
    const before = resourceSnapshot(projectId);
    const networkName = ensureLoopbackNetwork(projectId);
    runtime.networkName = networkName;
    const start = run(process.execPath, [
      join(root, "scripts", "run-supabase-loopback.mjs"),
      "start",
      "--workdir",
      projectDir,
      "--network-id",
      networkName,
      "--yes",
    ], { root, env: createSanitizedChildEnv() });
    if (start.status !== 0) throw new Error(`disposable_qualification_start_failed\n${start.stdout}\n${start.stderr}`);
    const afterStart = resourceSnapshot(projectId);
    runtime.createdContainers = difference(afterStart.containers, before.containers);
    runtime.createdNetworks = difference(afterStart.networks, before.networks);
    runtime.createdVolumes = difference(afterStart.volumes, before.volumes);
    runtime.bindings = inspectSupabaseProjectBindings(projectId);
    runtime.dbContainer = findDatabaseContainer(projectId);
    runtime.status = readStatus(runtime);
    runtime.env = {
      ...runtime.status.env,
      RYBEX_QUALIFICATION_PROJECT_ID: projectId,
      RYBEX_QUALIFICATION_PROJECT_DIR: projectDir,
      RYBEX_QUALIFICATION_DB_CONTAINER: runtime.dbContainer,
    };
    assertDisposableQualificationIdentity({ ...runtime, env: runtime.env });
    return runtime;
  } catch (error) {
    const cleanup = teardownDisposableQualificationRuntime(runtime, { tolerateMissing: true });
    throw new Error(`${error instanceof Error ? error.message : String(error)}\ncleanup=${JSON.stringify(cleanup)}`);
  }
}

export function teardownDisposableQualificationRuntime(runtime, options = {}) {
  if (!runtime?.projectId || runtime.projectId === PRESERVED_PROJECT_ID) throw new Error("refusing_to_teardown_non_disposable_project");
  const stop = run(defaultSupabaseCommand(runtime.root), [
    "stop",
    "--workdir",
    runtime.projectDir,
    "--project-id",
    runtime.projectId,
    "--no-backup",
    "--yes",
  ], { root: runtime.root, env: createSanitizedChildEnv(), allowFailure: true });
  let networkError = null;
  try {
    removeLoopbackNetwork(runtime.projectId);
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error);
  }
  rmSync(runtime.projectDir, { recursive: true, force: true });
  const residual = resourceSnapshot(runtime.projectId);
  const result = {
    projectId: runtime.projectId,
    stopExitCode: stop.status,
    stopStdout: stop.stdout.trim(),
    stopStderr: stop.stderr.trim(),
    networkError,
    projectDirectoryAbsent: !existsSync(runtime.projectDir),
    residual,
    zeroResidualResources: residual.containers.length === 0 && residual.networks.length === 0 && residual.volumes.length === 0,
  };
  if (!options.tolerateMissing && (stop.status !== 0 || networkError || !result.zeroResidualResources || !result.projectDirectoryAbsent)) {
    throw new Error(`qualification_teardown_failed:${JSON.stringify(result)}`);
  }
  return result;
}

export function readDisposableStatus(runtime) {
  return readStatus(runtime);
}

export function snapshotQualificationResources(projectId) {
  return resourceSnapshot(projectId);
}

function prepareProject(runtime) {
  const sourceConfig = readFileSync(join(runtime.root, "supabase", "config.toml"), "utf8");
  const projectSupabase = join(runtime.projectDir, "supabase");
  cpSync(join(runtime.root, "supabase"), projectSupabase, {
    recursive: true,
    filter: (source) => !/[\\/](?:\.temp|\.branches)(?:[\\/]|$)/.test(source) && !/-ShawnT13\.sql$/i.test(source),
  });
  writeFileSync(
    join(projectSupabase, "config.toml"),
    rewriteSupabaseConfigForProject(sourceConfig, runtime.projectId, runtime.ports),
  );
}

function readStatus(runtime) {
  const result = run(defaultSupabaseCommand(runtime.root), ["status", "-o", "env", "--workdir", runtime.projectDir], {
    root: runtime.root,
    env: createSanitizedChildEnv(),
  });
  if (result.status !== 0) throw new Error(`qualification_status_failed:${result.stderr || result.stdout}`);
  const parsed = parseSupabaseStatusEnv(result.stdout);
  validateSupabaseStatusEndpoints(parsed, { root: runtime.root, configPorts: runtime.ports });
  return { parsed, stdout: result.stdout, env: createLocalRuntimeEnv(parsed, {}, { root: runtime.root, configPorts: runtime.ports }) };
}

function findDatabaseContainer(projectId) {
  const exact = `supabase_db_${projectId}`;
  const names = run("docker", ["ps", "-a", "--format", "{{.Names}}"], { root: process.cwd() }).stdout.split(/\r?\n/).filter(Boolean);
  if (names.includes(exact)) return exact;
  const match = names.find((name) => name.includes(projectId) && name.startsWith("supabase_db_"));
  if (!match) throw new Error(`qualification_database_container_missing:${projectId}`);
  return match;
}

function resourceSnapshot(projectId) {
  const filter = `com.supabase.cli.project=${projectId}`;
  const containers = run("docker", ["ps", "-a", "--filter", `label=${filter}`, "--format", "{{.Names}}"], { root: process.cwd(), allowFailure: true }).stdout.split(/\r?\n/).filter(Boolean);
  const networks = run("docker", ["network", "ls", "--filter", `label=com.rybex.supabase-project=${projectId}`, "--format", "{{.Name}}"], { root: process.cwd(), allowFailure: true }).stdout.split(/\r?\n/).filter(Boolean);
  const volumes = run("docker", ["volume", "ls", "--filter", `label=${filter}`, "--format", "{{.Name}}"], { root: process.cwd(), allowFailure: true }).stdout.split(/\r?\n/).filter(Boolean);
  return { containers, networks, volumes };
}

function difference(after, before) {
  const prior = new Set(before);
  return after.filter((value) => !prior.has(value));
}

async function allocatePorts() {
  const names = ["api", "db", "shadow", "studio", "inbucket", "smtp", "pop3", "analytics"];
  const result = {};
  for (const name of names) result[name] = String(await freePort());
  result.pooler = String(await freePort());
  return result;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
    server.on("error", reject);
  });
}

function run(command, args, options = {}) {
  const invocation = process.platform === "win32" && command.endsWith(".cmd")
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] }
    : { command, args };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.root ?? process.cwd(),
    env: options.env ?? createSanitizedChildEnv(),
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 100,
  });
  if (!options.allowFailure && result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}
