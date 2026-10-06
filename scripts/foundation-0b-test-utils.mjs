import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const ids = {
  workspaceA: "10000000-0000-4000-8000-000000000001",
  workspaceB: "10000000-0000-4000-8000-000000000002",
  orgA: "20000000-0000-4000-8000-000000000001",
  orgB: "20000000-0000-4000-8000-000000000002",
  projectA: "30000000-0000-4000-8000-000000000001",
  projectB: "30000000-0000-4000-8000-000000000002"
};

export function requireLocalSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.FOUNDATION_0A_TEST_PASSWORD;

  if (!url || !anonKey || !serviceKey || !password) {
    throw new Error("Foundation 0B QA requires local Supabase URL, anon/publishable key, service key, and in-memory test password.");
  }

  return { url, anonKey, serviceKey, password };
}

export function createClients() {
  const env = requireLocalSupabaseEnv();
  const service = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return {
    ...env,
    service,
    anon: createClient(env.url, env.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  };
}

export async function signIn(email) {
  const { url, anonKey, password } = requireLocalSupabaseEnv();
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user) {
    throw new Error(`Sign in failed for ${email}: ${result.error?.message ?? "missing user"}`);
  }

  return client;
}

export function createRecorder(resultPath, suiteName) {
  const tests = [];
  const startedAt = new Date().toISOString();
  if (resultPath) {
    mkdirSync(dirname(resultPath), { recursive: true });
  }

  return {
    tests,
    async record(name, category, fn) {
      try {
        const result = await fn();
        const ok = Boolean(result?.ok);
        tests.push({
          name,
          category,
          status: ok ? "pass" : "fail",
          detail: redact(result?.detail ?? "")
        });
      } catch (error) {
        tests.push({
          name,
          category,
          status: "fail",
          detail: redact(error instanceof Error ? error.message : String(error))
        });
      }
    },
    finalize(extra = {}) {
      const failed = tests.filter((test) => test.status === "fail");
      const payload = {
        suiteName,
        runTimestamp: startedAt,
        totalTests: tests.length,
        passedTests: tests.filter((test) => test.status === "pass").length,
        failedTests: failed.length,
        skippedTests: tests.filter((test) => test.status === "skip").length,
        tests,
        ...extra
      };
      if (resultPath) {
        writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
      }
      return payload;
    }
  };
}

export function pass(ok, detail = "") {
  return { ok, detail };
}

export function noRows(data, error) {
  return pass(!error && Array.isArray(data) && data.length === 0, error?.message ?? `rows:${Array.isArray(data) ? data.length : "unknown"}`);
}

export async function getServiceRow(service, table, select, filters) {
  let query = service.from(table).select(select);
  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.single();
  if (error || !data) throw new Error(`${table} lookup failed: ${error?.message ?? "missing row"}`);
  return data;
}

export async function tableCount(service, table, filters = []) {
  let query = service.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

export async function userIdFor(service, email) {
  const listed = await service.auth.admin.listUsers();
  if (listed.error) throw new Error(`User lookup failed: ${listed.error.message}`);
  const user = listed.data.users.find((entry) => entry.email === email);
  if (!user?.id) throw new Error(`Missing bootstrap user ${email}`);
  return user.id;
}

export function stableHash(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function commandId(prefix) {
  return `${prefix}-${Date.now()}-${randomUUID()}`;
}

export function mergeSuiteResult(path, suiteName, suiteResult) {
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const suites = existing.suites ?? {};
  suites[suiteName] = suiteResult;
  const allTests = Object.values(suites).flatMap((suite) => suite.tests ?? []);
  const payload = {
    ...existing,
    suites,
    totalTests: allTests.length,
    passedTests: allTests.filter((test) => test.status === "pass").length,
    failedTests: allTests.filter((test) => test.status === "fail").length,
    skippedTests: allTests.filter((test) => test.status === "skip").length
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

export function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}
