import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CFG_RUNTIME_03_DOCKER_CONTEXT,
  CFG_RUNTIME_03_FORBIDDEN_HOST,
  CFG_RUNTIME_03_SUPABASE_VERSION,
  assertCfgRuntime03PreStatusBoundary,
  createLocalRuntimeEnv,
  guardedChildSentinel,
  parseSupabaseStatusEnv,
  runSupabaseStatusWithCfgRuntime03Guard,
  validateSupabaseStatusEndpoints,
} from "./cfg-runtime-03-loopback-guard.mjs";
import { validatePublishedBindings } from "./local-supabase-loopback-network.mjs";

const root = process.cwd();
const supabaseCommand = process.platform === "win32" ? "node_modules\\.bin\\supabase.cmd" : "node_modules/.bin/supabase";
const results = [];
let failures = 0;

function record(name, passed, detail = "") {
  results.push({ name, status: passed ? "pass" : "fail", detail });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`);
  if (!passed) failures += 1;
}

function boundary(overrides = {}) {
  return {
    root,
    expectedRoot: root,
    supabaseCommand,
    expectedSupabaseCommand: supabaseCommand,
    supabaseArgs: ["status", "-o", "env"],
    env: {},
    getDockerContext: () => CFG_RUNTIME_03_DOCKER_CONTEXT,
    getDockerVersion: () => "29.5.3|29.5.3",
    getSupabaseCliVersion: () => CFG_RUNTIME_03_SUPABASE_VERSION,
    exists: (path) => existsSync(path),
    ...overrides,
  };
}

function negative(name, expectedCategory, overrides) {
  let sentinelCount = 0;
  try {
    guardedChildSentinel(name, () => {
      sentinelCount += 1;
    }, boundary(overrides));
    record(name, false, "guard unexpectedly allowed child sentinel");
  } catch (error) {
    record(name, sentinelCount === 0 && error.category === expectedCategory, `category=${error.category ?? "missing"}; sentinel=${sentinelCount}`);
  }
}

negative("forbidden NEXT_PUBLIC_SUPABASE_URL rejected before launch", "forbidden_hostname", {
  env: { NEXT_PUBLIC_SUPABASE_URL: `https://${CFG_RUNTIME_03_FORBIDDEN_HOST}` },
});
negative("forbidden SUPABASE_URL rejected before launch", "forbidden_hostname", {
  env: { SUPABASE_URL: `https://${CFG_RUNTIME_03_FORBIDDEN_HOST}` },
});
negative("remote DATABASE_URL rejected before launch", "DATABASE_URL", {
  env: { DATABASE_URL: "https://db.remote.example/postgres" },
});
negative("remote PostgreSQL URL rejected before launch", "POSTGRES_URL", {
  env: { POSTGRES_URL: "postgresql://postgres:postgres@db.remote.example:5432/postgres" },
});
negative("remote Auth URL rejected before launch", "AUTH_URL", {
  env: { AUTH_URL: "https://auth.remote.example/auth/v1" },
});
negative("remote REST URL rejected before launch", "REST_URL", {
  env: { REST_URL: "https://rest.remote.example/rest/v1" },
});
negative("remote Storage URL rejected before launch", "STORAGE_URL", {
  env: { STORAGE_URL: "https://storage.remote.example/storage/v1" },
});
negative("SUPABASE_ACCESS_TOKEN rejected before launch", "SUPABASE_ACCESS_TOKEN", {
  env: { SUPABASE_ACCESS_TOKEN: "sbp_test_token" },
});
negative("SUPABASE_PROJECT_REF rejected before launch", "SUPABASE_PROJECT_REF", {
  env: { SUPABASE_PROJECT_REF: "remote-ref" },
});
negative("link file rejected before launch", "link_file", {
  exists: (path) => path.endsWith("supabase\\.temp\\project-ref") || path.endsWith("supabase/.temp/project-ref"),
});
negative("Docker context other than desktop-linux rejected before launch", "docker_context", {
  getDockerContext: () => "default",
});
negative("wrong Supabase CLI path rejected before launch", "supabase_cli_path", {
  supabaseCommand: "supabase.cmd",
});
negative("wrong Supabase CLI version rejected before launch", "supabase_cli_version", {
  getSupabaseCliVersion: () => "2.108.0",
});
negative("working directory outside repository rejected before launch", "real_path", {
  root: join(tmpdir(), "cfg-runtime-03-boundary-outside"),
});
negative("localhost.attacker.example rejected before launch", "NEXT_PUBLIC_SUPABASE_URL", {
  env: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost.attacker.example:55321" },
});
negative("127.0.0.1.attacker.example rejected before launch", "NEXT_PUBLIC_SUPABASE_URL", {
  env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1.attacker.example:55321" },
});
negative("exact forbidden hostname rejected before launch", "forbidden_hostname", {
  env: { CFG_RUNTIME_03_SENTINEL_URL: `https://${CFG_RUNTIME_03_FORBIDDEN_HOST}` },
});

let positiveSentinelCount = 0;
try {
  guardedChildSentinel("approved loopback child sentinel", () => {
    positiveSentinelCount += 1;
  }, boundary());
  record("approved loopback pre-status guard permits child sentinel exactly once", positiveSentinelCount === 1, `sentinel=${positiveSentinelCount}`);
} catch (error) {
  record("approved loopback pre-status guard permits child sentinel exactly once", false, error.message);
}

try {
  const status = runSupabaseStatusWithCfgRuntime03Guard({ root, supabaseCommand });
  validateSupabaseStatusEndpoints(status.parsed, { root });
  const localEnv = createLocalRuntimeEnv(status.parsed, { RYBEXOS_RUNTIME_MODE: "test" });
  const api = status.parsed.API_URL || status.parsed.NEXT_PUBLIC_SUPABASE_URL;
  const parsed = new URL(api);
  record("local supabase status is guarded and returns approved loopback family", parsed.hostname === "127.0.0.1" && parsed.port === "55321");
  record("validated local child env contains loopback API only", localEnv.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:55321");
} catch (error) {
  record("local supabase status is guarded and returns approved loopback family", false, error.message);
}

for (const [name, bindings] of [
  ["wildcard IPv4 Docker binding rejected", { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "55322" }] }],
  ["wildcard IPv6 Docker binding rejected", { "5432/tcp": [{ HostIp: "::", HostPort: "55322" }] }],
  ["empty Docker HostIp rejected", { "5432/tcp": [{ HostIp: "", HostPort: "55322" }] }],
  ["non-loopback Docker binding rejected", { "5432/tcp": [{ HostIp: "192.168.1.8", HostPort: "55322" }] }],
  ["omitted Docker host mapping rejected", { "5432/tcp": [] }],
  ["pooler publication rejected", { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55329" }] }],
]) {
  try {
    validatePublishedBindings(bindings);
    record(name, false, "binding unexpectedly accepted");
  } catch (error) {
    record(name, true, error.message);
  }
}

try {
  const rows = validatePublishedBindings({ "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55322" }] });
  record("explicit IPv4 loopback Docker binding accepted", rows.length === 1 && rows[0].hostIp === "127.0.0.1");
} catch (error) {
  record("explicit IPv4 loopback Docker binding accepted", false, error.message);
}

const sampleStatus = parseSupabaseStatusEnv(`API_URL=\"http://127.0.0.1:55321\"\nDB_URL=\"postgresql://postgres:postgres@127.0.0.1:55322/postgres\"\nSTUDIO_URL=\"http://127.0.0.1:55323\"\nINBUCKET_URL=\"http://127.0.0.1:55324\"\nREST_URL=\"http://127.0.0.1:55321/rest/v1\"\nSTORAGE_S3_URL=\"http://127.0.0.1:55321/storage/v1/s3\"`);
try {
  validateSupabaseStatusEndpoints(sampleStatus, { root });
  record("approved 55320-55329 status endpoint set validates", true);
} catch (error) {
  record("approved 55320-55329 status endpoint set validates", false, error.message);
}

if (failures > 0) {
  console.error(`CFG-RUNTIME-03 loopback boundary verification failed: ${failures}`);
  process.exit(1);
}

console.log(`CFG-RUNTIME-03 loopback boundary verification passed (${results.length} assertions).`);
