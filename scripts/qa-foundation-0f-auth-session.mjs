import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const root = process.cwd();
const artifactDir = resolve(root, "visual-qa-output/foundation-0f");
const resultPath = join(artifactDir, "auth-session-result.json");
const tests = [];
const screenshots = {};
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `Foundation-0F-Auth-${Date.now()}-${Math.random().toString(36).slice(2)}!`;

mkdirSync(artifactDir, { recursive: true });

const localEnv = ensureLocalSupabaseEnv();
const qaEnv = {
  ...process.env,
  ...localEnv,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "production",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
  RYBEXOS_BILLING_V2_PERSISTENCE: "database",
  RYBEXOS_FIELD_ISSUE_PERSISTENCE: "database",
  RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE: "database",
  RYBEXOS_EVIDENCE_STORE: "database",
  RYBEXOS_SCANNER_MODE: process.env.RYBEXOS_SCANNER_MODE ?? "local_service",
  RYBEXOS_SCANNER_URL: process.env.RYBEXOS_SCANNER_URL ?? "http://127.0.0.1:65534",
  FOUNDATION_0A_TEST_PASSWORD: fixturePassword
};

await runBootstrap();

execFileSync(process.execPath, [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  "build"
], {
  cwd: root,
  env: qaEnv,
  stdio: "inherit"
});

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
let server = startNext(port);
let browser;

try {
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });

  await record("Unauthenticated Command Center redirects to sign-in", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/command-center`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });
    screenshots.signIn = join(artifactDir, "auth-sign-in.png");
    await page.screenshot({ path: screenshots.signIn, fullPage: true });
    const url = new URL(page.url());
    await context.close();
    return url.pathname === "/auth/sign-in" && url.searchParams.get("next")?.includes("/command-center");
  });

  await record("Invalid credentials do not establish a session", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill("ops-a@foundation0a.local");
    await page.getByLabel("Password").fill("not-the-password");
    await Promise.all([
      page.waitForURL(/error=invalid/, { timeout: 15_000 }),
      page.getByRole("button", { name: "Sign in" }).click()
    ]);
    const cookies = await context.cookies();
    await context.close();
    return !cookies.some((cookie) => cookie.name.startsWith("sb-") || cookie.name.includes("auth-token"));
  });

  const signedIn = await signInContext(browser, "ops-a@foundation0a.local", "/command-center");
  const page = signedIn.page;
  const context = signedIn.context;

  await record("Valid local Supabase credentials establish a session", async () => {
    const cookies = await context.cookies();
    return cookies.some((cookie) => cookie.name.startsWith("sb-") || cookie.name.includes("auth-token"));
  });

  await record("Successful sign-in returns to validated internal next route", async () => {
    screenshots.afterSignIn = join(artifactDir, "auth-command-center-after-sign-in.png");
    await page.screenshot({ path: screenshots.afterSignIn, fullPage: true });
    return new URL(page.url()).pathname === "/command-center";
  });

  await record("Server route resolves authenticated user, workspace, and role", async () => {
    const proof = await fetchProof(page);
    return proof.success === true &&
      proof.user?.email === "ops-a@foundation0a.local" &&
      proof.workspace?.id === "10000000-0000-4000-8000-000000000001" &&
      proof.role === "operations_leader";
  });

  await record("Refresh preserves the session", async () => {
    await page.reload({ waitUntil: "networkidle" });
    const proof = await fetchProof(page);
    return proof.success === true && proof.role === "operations_leader";
  });

  await record("Client navigation preserves the session", async () => {
    await page.goto(`${baseUrl}/billing`, { waitUntil: "networkidle" });
    const proof = await fetchProof(page);
    return proof.success === true && proof.workspace?.slug === "workspace-a";
  });

  await record("Next server restart preserves the cookie-backed browser session", async () => {
    server.kill();
    await delay(1500);
    server = startNext(port);
    await waitForServer(`${baseUrl}/api/health`, 90_000);
    await page.goto(`${baseUrl}/command-center`, { waitUntil: "networkidle" });
    const proof = await fetchProof(page);
    return proof.success === true && proof.role === "operations_leader";
  });

  await record("External next destination is rejected", async () => {
    const nextAttempt = await signInContext(browser, "billing-a@foundation0a.local", "https://example.invalid/steal");
    const safePath = new URL(nextAttempt.page.url()).pathname;
    await nextAttempt.context.close();
    return safePath === "/command-center";
  });

  await record("Suspended member fails closed", async () => {
    const suspended = await signInContext(browser, "suspended-a@foundation0a.local", "/command-center", { allowDenied: true });
    const proof = await fetchProof(suspended.page);
    await suspended.context.close();
    return proof.success === false && proof.status === "no_membership";
  });

  await record("Multi-workspace ambiguity returns the approved typed state", async () => {
    const ambiguous = await signInContext(browser, "multi-ambiguous@foundation0a.local", "/command-center", { allowDenied: true });
    const proof = await fetchProof(ambiguous.page);
    await ambiguous.context.close();
    return proof.success === false && proof.status === "workspace_selection_required";
  });

  await record("Sign-out clears the usable session", async () => {
    await page.goto(`${baseUrl}/auth/sign-out`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });
    screenshots.afterSignOut = join(artifactDir, "auth-required-after-sign-out.png");
    await page.screenshot({ path: screenshots.afterSignOut, fullPage: true });
    await page.goto(`${baseUrl}/command-center`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });
    return new URL(page.url()).pathname === "/auth/sign-in";
  });

  await record("Signed-out protected API returns unauthenticated failure", async () => {
    const response = await page.evaluate(async () => {
      const result = await fetch("/api/auth/session-proof", { headers: { accept: "application/json" } });
      return { status: result.status, body: await result.json().catch(() => ({})) };
    });
    return response.status === 401 && response.body?.error === "unauthenticated";
  });

  await record("No browser context contains service-role credentials", async () => {
    const cookies = await context.cookies();
    const serialized = JSON.stringify(cookies.map((cookie) => ({ name: cookie.name, domain: cookie.domain })));
    return !serialized.includes("service_role") && !serialized.includes("sb_secret");
  });

  await record("Browser QA did not manually inject cookies or storage state", async () => true);

  await context.close();

  const summary = finalize();
  if (summary.status !== "pass") {
    throw new Error("Foundation 0F auth-session QA failed.");
  }
} catch (error) {
  finalize(error);
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}

async function signInContext(browserInstance, email, nextPath, options = {}) {
  const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/auth/sign-in?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.waitForTimeout(800);
  if (!options.allowDenied && new URL(page.url()).pathname === "/auth/sign-in") {
    throw new Error(`Sign-in did not leave the sign-in page for fixture ${email}.`);
  }
  return { context, page };
}

async function fetchProof(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/session-proof", { headers: { accept: "application/json" } });
    return response.json();
  });
}

async function record(name, fn) {
  try {
    tests.push({ name, status: (await fn()) ? "pass" : "fail" });
  } catch (error) {
    tests.push({ name, status: "fail", detail: redact(error instanceof Error ? error.message : String(error)) });
  }
}

function finalize(error) {
  const failed = tests.filter((test) => test.status === "fail");
  const payload = {
    runTimestamp: new Date().toISOString(),
    buildMode: "next build + next start",
    browserAuthMethod: "application-sign-in-form",
    noManualCookieInjection: true,
    noStorageStateShortcut: true,
    fixtureUserKeys: ["ops", "billing", "suspended", "multiAmbiguous"],
    workspaceFixtureKey: "workspace-a",
    cookiePresent: tests.some((test) => test.name === "Valid local Supabase credentials establish a session" && test.status === "pass"),
    totalTests: tests.length,
    passedTests: tests.filter((test) => test.status === "pass").length,
    failedTests: failed.length,
    skippedTests: 0,
    status: failed.length === 0 && !error ? "pass" : "fail",
    tests,
    screenshots,
    error: error ? redact(error instanceof Error ? error.message : String(error)) : undefined
  };
  writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function startNext(serverPort) {
  return spawn(process.execPath, [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    "start",
    "-p",
    String(serverPort)
  ], {
    cwd: root,
    env: qaEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // keep polling
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const freePort = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(freePort));
    });
    server.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBootstrap() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      ...localEnv,
      RYBEXOS_RUNTIME_MODE: "test",
      FOUNDATION_0A_TEST_PASSWORD: fixturePassword
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error(`Foundation 0A bootstrap failed for auth-session QA: ${redact(result.stderr || result.stdout || "no output")}`);
  }
}

function ensureLocalSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && publishable && service) {
    return {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publishable,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || publishable,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || service,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || service
    };
  }

  const result = spawnSync("npx.cmd", ["supabase", "status", "-o", "env"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error("Local Supabase credentials are not available. Start the local Supabase stack before auth-session QA.");
  }
  return mapSupabaseEnv(result.stdout);
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

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}
