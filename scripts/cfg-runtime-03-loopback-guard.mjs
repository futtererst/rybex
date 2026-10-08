import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { readSupabaseConfigPorts } from "./local-supabase-config-utils.mjs";
import { inspectSupabaseProjectBindings } from "./local-supabase-loopback-network.mjs";
import { discoverCfgRuntime03RepositoryRoot } from "./cfg-runtime-03-repository-boundary.mjs";

export const CFG_RUNTIME_03_FORBIDDEN_HOST = "fcawktdjoxvahhgvkebx.supabase.co";
export const CFG_RUNTIME_03_SUPABASE_VERSION = "2.109.1";
export const CFG_RUNTIME_03_DOCKER_CONTEXT = "desktop-linux";
export const CFG_RUNTIME_03_ENV_LOCAL_SHA256 = "bf0477de4eb2121f507ba770e28508751eda8b65b447db9843660402c6f7ce92";

const requiredPorts = {
  shadow: "55320",
  api: "55321",
  db: "55322",
  studio: "55323",
  inbucket: "55324",
  smtp: "55325",
  pop3: "55326",
  analytics: "55327",
  pooler: "55329",
};

const endpointKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "API_URL",
  "DB_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "AUTH_URL",
  "SUPABASE_AUTH_URL",
  "REST_URL",
  "SUPABASE_REST_URL",
  "STORAGE_URL",
  "SUPABASE_STORAGE_URL",
  "REALTIME_URL",
  "SUPABASE_REALTIME_URL",
  "STUDIO_URL",
  "SUPABASE_STUDIO_URL",
  "INBUCKET_URL",
  "MAILPIT_URL",
  "ANALYTICS_URL",
  "POOLER_URL",
];

const requiredLocalEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
];

const inheritedAllowlist = [
  "ALLUSERSPROFILE",
  "APPDATA",
  "CI",
  "COMSPEC",
  "DOCKER_CONTEXT",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "NUMBER_OF_PROCESSORS",
  "OS",
  "PATH",
  "PATHEXT",
  "PROCESSOR_ARCHITECTURE",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
  "WINDIR",
];

export function defaultSupabaseCommand(root = process.cwd()) {
  return process.platform === "win32" ? "node_modules\\.bin\\supabase.cmd" : "node_modules/.bin/supabase";
}

export function assertCfgRuntime03PreStatusBoundary(options = {}) {
  const discoveredRoot = discoverCfgRuntime03RepositoryRoot({
    scriptUrl: import.meta.url,
    cwd: options.root ?? process.cwd(),
    callerRoot: options.expectedRoot,
  });
  const root = normalizePath(discoveredRoot);
  const env = options.env ?? process.env;

  assertNoProhibitedProcessState({
    env,
    root,
    exists: options.exists,
    allowLocalEndpointEnv: false,
  });

  const command = options.supabaseCommand ?? defaultSupabaseCommand(root);
  const expectedCommand = options.expectedSupabaseCommand ?? defaultSupabaseCommand(root);
  if (normalizeCommand(command) !== normalizeCommand(expectedCommand)) {
    throw boundaryError("supabase_cli_path", `expected repository-local CLI ${expectedCommand}`);
  }
  const absoluteCommand = resolve(root, command);
  if (!isPathInside(root, absoluteCommand) || !existsSync(absoluteCommand)) {
    throw boundaryError("supabase_cli_path", "repository-local Supabase CLI is missing or outside the repository");
  }
  const args = options.supabaseArgs ?? ["status", "-o", "env"];
  if (!isAllowedSupabaseStatusCommand(args)) {
    throw boundaryError("supabase_command", `unapproved Supabase command: ${args.join(" ")}`);
  }

  assertAuthoritativeLocalSource(root);

  const dockerContext = options.getDockerContext ? options.getDockerContext() : runText("docker", ["context", "show"], createSanitizedChildEnv({}, { env })).trim();
  if (dockerContext !== CFG_RUNTIME_03_DOCKER_CONTEXT) {
    throw boundaryError("docker_context", `expected ${CFG_RUNTIME_03_DOCKER_CONTEXT}, received ${dockerContext || "(empty)"}`);
  }
  const dockerVersion = options.getDockerVersion
    ? options.getDockerVersion()
    : runText("docker", ["version", "--format", "{{.Client.Version}}|{{.Server.Version}}"], createSanitizedChildEnv({}, { env })).trim();
  const [dockerClientVersion, dockerServerVersion] = dockerVersion.split("|");
  if (!dockerClientVersion || !dockerServerVersion) {
    throw boundaryError("docker_version", "Docker client and server must both be accessible");
  }

  const version = options.getSupabaseCliVersion ? options.getSupabaseCliVersion(command) : runText(command, ["--version"], createSanitizedChildEnv({}, { env })).trim();
  if (version !== CFG_RUNTIME_03_SUPABASE_VERSION) {
    throw boundaryError("supabase_cli_version", `expected ${CFG_RUNTIME_03_SUPABASE_VERSION}, received ${version || "(empty)"}`);
  }

  return {
    root,
    env: createSanitizedChildEnv({}, { env }),
    command,
    args,
  };
}

export function runSupabaseStatusWithCfgRuntime03Guard(options = {}) {
  const boundary = assertCfgRuntime03PreStatusBoundary(options);
  const result = spawnSync(commandInvocation(boundary.command).command, [...commandInvocation(boundary.command).prefix, ...boundary.args], {
    cwd: boundary.root,
    env: boundary.env,
    encoding: "utf8",
    shell: false,
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 20,
  });
  if (result.status !== 0) {
    throw boundaryError("supabase_status", `local supabase status failed: ${redact(result.stderr || result.stdout || result.error?.message)}`);
  }
  const parsed = parseSupabaseStatusEnv(result.stdout);
  validateSupabaseStatusEndpoints(parsed, { root: boundary.root });
  const bindings = options.inspectBindings
    ? options.inspectBindings()
    : inspectSupabaseProjectBindings(options.projectId ?? "rybex-2-local");
  return { parsed, stdout: result.stdout, bindings, env: createLocalRuntimeEnv(parsed, options.extraEnv, { env: options.env }) };
}

export function assertNoProhibitedProcessState(options = {}) {
  const env = options.env ?? process.env;
  const root = normalizePath(options.root ?? process.cwd());
  const exists = options.exists ?? existsSync;
  if (valueOf(env, "SUPABASE_ACCESS_TOKEN")) throw boundaryError("SUPABASE_ACCESS_TOKEN", "Supabase access token is prohibited");
  if (valueOf(env, "SUPABASE_PROJECT_REF")) throw boundaryError("SUPABASE_PROJECT_REF", "Supabase project ref is prohibited");
  if (exists(resolve(root, "supabase", ".temp", "project-ref"))) throw boundaryError("link_file", "supabase/.temp/project-ref is prohibited");

  for (const [key, value] of Object.entries(env)) {
    if (String(value ?? "").includes(CFG_RUNTIME_03_FORBIDDEN_HOST)) {
      throw boundaryError("forbidden_hostname", `${key} contains forbidden hostname`);
    }
  }

  for (const key of endpointKeys) {
    const value = valueOf(env, key);
    if (!value) continue;
    validateLoopbackEndpoint(value, key);
    if (!options.allowLocalEndpointEnv) {
      throw boundaryError(key, `${key} must be supplied by guarded local status, not inherited`);
    }
  }
  if (!options.allowLocalEndpointEnv) {
    for (const key of requiredLocalEnvKeys) {
      if (valueOf(env, key)) throw boundaryError(key, `${key} must be supplied by guarded local status, not inherited`);
    }
  }
}

export function createSanitizedChildEnv(extra = {}, options = {}) {
  const source = options.env ?? process.env;
  const child = {};
  for (const key of inheritedAllowlist) {
    const value = valueOf(source, key);
    if (value !== undefined) child[actualKey(source, key) ?? key] = value;
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value !== undefined && value !== null) child[key] = String(value);
  }
  for (const key of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", ...endpointKeys]) {
    deleteCaseInsensitive(child, key);
  }
  for (const key of requiredLocalEnvKeys) {
    if (extra?.[key]) child[key] = String(extra[key]);
  }
  return child;
}

export function createLocalRuntimeEnv(statusEnv, extra = {}, options = {}) {
  validateSupabaseStatusEndpoints(statusEnv, options);
  const apiUrl = statusEnv.API_URL || statusEnv.SUPABASE_URL || statusEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = statusEnv.PUBLISHABLE_KEY || statusEnv.ANON_KEY || statusEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || statusEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = statusEnv.SERVICE_ROLE_KEY || statusEnv.SECRET_KEY || statusEnv.SUPABASE_SERVICE_ROLE_KEY || statusEnv.SUPABASE_SECRET_KEY;
  if (!apiUrl || !anonKey || !serviceKey) throw boundaryError("supabase_status", "local Supabase status did not expose API, anon, and service credentials");
  return createSanitizedChildEnv(
    {
      ...extra,
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      SUPABASE_SECRET_KEY: serviceKey,
    },
    options,
  );
}

export function parseSupabaseStatusEnv(stdout) {
  const parsed = {};
  for (const line of String(stdout ?? "").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) parsed[match[1]] = stripQuotes(match[2]);
  }
  return parsed;
}

export function validateSupabaseStatusEndpoints(statusEnv, options = {}) {
  const ports = options.configPorts ?? assertAuthoritativeLocalSource(normalizePath(options.root ?? process.cwd())).ports;
  const endpointRules = [
    ["API_URL", [ports.api]],
    ["SUPABASE_URL", [ports.api]],
    ["NEXT_PUBLIC_SUPABASE_URL", [ports.api]],
    ["DB_URL", [ports.db]],
    ["DATABASE_URL", [ports.db]],
    ["GRAPHQL_URL", [ports.api]],
    ["REST_URL", [ports.api]],
    ["MCP_URL", [ports.api]],
    ["STORAGE_S3_URL", [ports.api]],
    ["INBUCKET_URL", [ports.inbucket]],
    ["MAILPIT_URL", [ports.inbucket]],
    ["STUDIO_URL", [ports.studio]],
    ["ANALYTICS_URL", [ports.analytics]],
    ["POOLER_URL", [ports.pooler]],
  ];
  for (const [key, allowedPorts] of endpointRules) {
    if (!statusEnv[key]) continue;
    validateLoopbackEndpoint(statusEnv[key], key, allowedPorts.filter(Boolean));
  }
  return true;
}

export function assertAuthoritativeLocalSource(root = process.cwd()) {
  const normalizedRoot = normalizePath(root);
  const packageJson = readJson(resolve(normalizedRoot, "package.json"), "package_json");
  const packageLock = readJson(resolve(normalizedRoot, "package-lock.json"), "package_lock");
  if (packageJson.devDependencies?.supabase !== CFG_RUNTIME_03_SUPABASE_VERSION) {
    throw boundaryError("supabase_package_pin", `package.json must pin supabase exactly to ${CFG_RUNTIME_03_SUPABASE_VERSION}`);
  }
  const locked = packageLock.packages?.["node_modules/supabase"];
  if (packageLock.packages?.[""]?.devDependencies?.supabase !== CFG_RUNTIME_03_SUPABASE_VERSION || locked?.version !== CFG_RUNTIME_03_SUPABASE_VERSION || !locked?.integrity) {
    throw boundaryError("supabase_package_lock", `package-lock.json must resolve supabase ${CFG_RUNTIME_03_SUPABASE_VERSION} with integrity metadata`);
  }

  const configPath = resolve(normalizedRoot, "supabase", "config.toml");
  const configText = readFileSync(configPath, "utf8");
  const ports = readSupabaseConfigPorts(configText);
  for (const [name, expected] of Object.entries(requiredPorts)) {
    if (ports[name] !== expected) throw boundaryError("supabase_port_family", `${name} must be ${expected}, received ${ports[name] ?? "missing"}`);
  }
  if (!/\[db\.pooler\][\s\S]*?enabled\s*=\s*false/.test(configText)) {
    throw boundaryError("supabase_pooler", "local pooler must remain disabled");
  }

  const envPath = resolve(normalizedRoot, ".env.local");
  if (!existsSync(envPath)) throw boundaryError("env_local_hash", ".env.local is required for integrity verification");
  const envHash = createHash("sha256").update(readFileSync(envPath)).digest("hex");
  if (envHash !== CFG_RUNTIME_03_ENV_LOCAL_SHA256) {
    throw boundaryError("env_local_hash", ".env.local integrity hash does not match the approved local file");
  }
  return { ports, envHash };
}

export function validateLoopbackEndpoint(value, label, allowedPorts = []) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw boundaryError(label, `invalid URL: ${error.message}`);
  }
  const host = parsed.hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw boundaryError(label, `rejected non-loopback host ${host}`);
  }
  if (String(value).includes(CFG_RUNTIME_03_FORBIDDEN_HOST)) {
    throw boundaryError("forbidden_hostname", `${label} contains forbidden hostname`);
  }
  if (allowedPorts.length > 0 && !allowedPorts.map(String).includes(parsed.port)) {
    throw boundaryError(label, `unexpected port ${parsed.port}; expected one of ${allowedPorts.join(",")}`);
  }
  return parsed;
}

export function guardedChildSentinel(name, sentinel, options = {}) {
  assertCfgRuntime03PreStatusBoundary(options);
  sentinel(name);
}

export function redact(value) {
  return String(value ?? "")
    .replace(/eyJ[A-Za-z0-9_.-]+/g, "[REDACTED_JWT]")
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_.-]+/g, "sb_$1_[REDACTED]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(new RegExp(CFG_RUNTIME_03_FORBIDDEN_HOST.replace(/\./g, "\\."), "g"), "[FORBIDDEN_HOST]");
}

function isAllowedSupabaseStatusCommand(args) {
  return args.length === 3 && args[0] === "status" && args[1] === "-o" && args[2] === "env";
}

function readJson(path, category) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw boundaryError(category, `unable to read authoritative manifest: ${error.message}`);
  }
}

function isPathInside(root, candidate) {
  const child = relative(root, candidate);
  return child !== "" && !child.startsWith("..") && !isAbsolute(child);
}

function runText(command, args, env) {
  const invocation = commandInvocation(command);
  const result = spawnSync(invocation.command, [...invocation.prefix, ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 5,
  });
  if (result.status !== 0) throw boundaryError(command, redact(result.stderr || result.stdout || result.error?.message));
  return result.stdout;
}

function commandInvocation(command) {
  if (process.platform === "win32" && command.endsWith(".cmd")) return { command: "cmd.exe", prefix: ["/d", "/s", "/c", command] };
  return { command, prefix: [] };
}

function boundaryError(category, detail) {
  const error = new Error(`${category}: ${detail}`);
  error.category = category;
  return error;
}

function stripQuotes(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function normalizePath(value) {
  return resolve(String(value)).replaceAll("/", sep).replace(/[\\/]$/, "").toLowerCase();
}

function normalizeCommand(value) {
  return String(value).replaceAll("/", "\\").toLowerCase();
}

function actualKey(env, requestedKey) {
  return Object.keys(env).find((key) => key.toUpperCase() === requestedKey.toUpperCase());
}

function valueOf(env, requestedKey) {
  const key = actualKey(env, requestedKey);
  return key ? env[key] : undefined;
}

function deleteCaseInsensitive(object, requestedKey) {
  const key = actualKey(object, requestedKey);
  if (key) delete object[key];
}
