import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import { requireQualificationChildEnv } from "./qualification-child-env.mjs";

const root = process.cwd();
const artifactDir = resolve(process.env.P1_CFG_BROWSER_OUTPUT ?? "");
const evidenceRoot = resolve(root, "artifacts/d5o-m1-s1-implementation-20260928T004316Z");
if (!artifactDir.startsWith(evidenceRoot + "\\") || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421") throw new Error("unowned_browser_boundary");
const resultPath = join(artifactDir, "browser-result.json");
let serverStdout = "", serverStderr = "";
const screenshots = {};
const tests = [];
let activePage;
const intakeOpportunityName = `P1 Browser Intake ${Date.now()}`;
const fixturePassword = process.env.FOUNDATION_0A_TEST_PASSWORD || `P1-01A-Browser-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
const localEnv = ensureLocalSupabaseEnv();

mkdirSync(artifactDir, { recursive: true });

const qaEnv = {
  ...process.env,
  ...localEnv,
  NEXT_TELEMETRY_DISABLED: "1",
  RYBEXOS_RUNTIME_MODE: "test",
  RYBEXOS_AUTH_MODE: "supabase",
  RYBEXOS_DATA_SOURCE: "database",
  FOUNDATION_0A_TEST_PASSWORD: fixturePassword
};

await bootstrap();
loadCompatibilityPack();

execFileSync(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  env: qaEnv,
  stdio: "inherit"
});

const port = await requireApprovedPort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = startNext(port);
let browser;

try {
  await waitForServer(`${baseUrl}/api/health`, 90_000);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  activePage = page;

  await record("Business development lead signs in through application", async () => {
    await page.goto(`${baseUrl}/auth/sign-in?next=${encodeURIComponent("/pipeline")}`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill("bd-a@foundation0a.local");
    await page.getByLabel("Password").fill(fixturePassword);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Sign in" }).click()
    ]);
    await page.waitForTimeout(700);
    return new URL(page.url()).pathname === "/pipeline";
  });

  await record("Pipeline renders action-first opportunity queue", async () => {
    await expectText(page, "Opportunity queue");
    await expectText(page, "New opportunity");
    screenshots.pipeline = join(artifactDir, "pipeline-mobile.png");
    await page.screenshot({ path: screenshots.pipeline, fullPage: true });
    return true;
  });

  await record("New opportunity intake creates a qualifying record", async () => {
    await page.goto(`${baseUrl}/pipeline/new`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Opportunity name").fill(intakeOpportunityName);
    await page.getByLabel("Customer / GC").fill("Bluegrass Data Centers");
    await page.getByLabel("Project type").fill("Underground conduit");
    await page.getByLabel("Location").fill("Hospital access road and conduit crossing");
    await page.getByLabel("Scope summary").fill("OSP conduit, access coordination, traffic control, and restoration scope.");
    await page.getByLabel("Estimated value").fill("385000");
    await page.getByLabel("Anticipated start").fill("2026-08-10");
    await page.getByLabel("Bid due date").fill("2026-07-15");
    screenshots.intake = join(artifactDir, "new-opportunity-mobile.png");
    await page.screenshot({ path: screenshots.intake, fullPage: true });
    await Promise.all([
      page.waitForURL(/\/pipeline\/[0-9a-f-]+/i, { timeout: 20_000 }),
      page.getByRole("button", { name: "Create opportunity" }).click()
    ]);
    await expectText(page, "Opportunity fit");
    return true;
  });

  await record("Qualification page saves required criteria", async () => {
    await expandQualificationSections(page);
    for (const select of await page.locator("form.pipeline-section-list select").all()) {
      const name = await select.getAttribute("name");
      if (name === "recommendation") {
        await select.selectOption("pursue_with_mitigations");
      } else {
        await select.selectOption("acceptable");
      }
    }
    await page.getByLabel("Risk summary").fill("Access, utility locate, schedule, and commercial terms require pursuit controls.");
    await page.getByLabel("Assumptions").fill("Qualification assumes the current access plan and drawing set remain valid.");
    screenshots.qualification = join(artifactDir, "qualification-mobile.png");
    await page.screenshot({ path: screenshots.qualification, fullPage: true });
    const qualificationResponse = waitForServerActionPost(page);
    await page.getByRole("button", { name: /Continue to delivery readiness|Resolve delivery readiness|Resolve evidence gap|Submit to/i }).click();
    await qualificationResponse;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectText(page, "Add decision support evidence");
    return true;
  });

  await record("Submit for decision reaches decision-required state", async () => {
    const evidencePath = join(artifactDir, "decision-support.txt");
    writeFileSync(evidencePath, "Decision support evidence\n");
    await page.setInputFiles('input[name="decisionSupportDocument"]', evidencePath);
    const evidenceResponse = waitForServerActionPost(page);
    await page.getByRole("button", { name: "Save evidence and notes" }).click();
    const evidencePost = await evidenceResponse;
    writeFileSync(join(artifactDir,"evidence-action-diagnostics.json"),JSON.stringify({status:evidencePost.status(),requestUrl:evidencePost.url(),redirect:evidencePost.headers()["x-action-redirect"]??null,currentUrl:page.url()},null,2));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectText(page, "Configured evidence satisfied");
    const decisionOwnerSelect = page.locator('select[name="decisionOwnerUserId"]:visible').first();
    const operationsLeaderValue = await decisionOwnerSelect.locator("option").evaluateAll((options) =>
      options.find((option) => /operations leader|^ops-a$/i.test((option.textContent ?? "").trim()))?.value ?? ""
    );
    if (!operationsLeaderValue) throw new Error("Operations Leader decision owner option is unavailable");
    await decisionOwnerSelect.selectOption(operationsLeaderValue);
    const handoffForm = decisionOwnerSelect.locator("xpath=ancestor::form");
    await handoffForm.locator('input[name="decisionDueAt"]').fill("2026-07-10");
    const handoffResponse = waitForServerActionPost(page);
    await handoffForm.getByRole("button", { name: "Set decision handoff" }).click();
    await handoffResponse;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectText(page, "Ready for Pricing Review");
    const submit = page.getByRole("button", { name: /Submit to .* for decision/ });
    await submit.waitFor({ state: "visible", timeout: 10_000 });
    const submitResponse = waitForServerActionPost(page);
    await submit.click();
    await submitResponse;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectText(page, "Submitted for Pricing Review");
    await expectText(page, "Package submitted for decision");
    screenshots.decisionReady = join(artifactDir, "decision-ready-mobile.png");
    await page.screenshot({ path: screenshots.decisionReady, fullPage: true });
    return true;
  });

  await record("Pipeline queue shows decision-required opportunity", async () => {
    await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
    const opportunityRow = page.locator(".pipeline-row").filter({ hasText: intakeOpportunityName });
    if (await opportunityRow.count() !== 1) throw new Error("Decision-required opportunity is absent from the queue");
    const rowText = await opportunityRow.innerText();
    if (!rowText.includes("Package is ready for assigned decision review")) {
      throw new Error(`Decision-required queue reason is missing: ${rowText}`);
    }
    return true;
  });

  await context.close();
  const summary = finalize();
  if (summary.failedTests > 0) throw new Error("P1-01A browser QA failed.");
} catch (error) {
  finalize(error);
  throw error;
} finally {
  if (browser) await browser.close();
  writeFileSync(join(artifactDir, "server-diagnostics.json"), JSON.stringify({stdout:redact(serverStdout),stderr:redact(serverStderr)},null,2));
  server.kill();
}

async function record(name, fn) {
  try {
    tests.push({ name, status: (await fn()) ? "pass" : "fail" });
  } catch (error) {
    let pageText = "";
    try {
      pageText = activePage ? redact((await activePage.locator("body").innerText({ timeout: 1_000 })).slice(0, 1500)) : "";
    } catch {
      pageText = "";
    }
    tests.push({ name, status: "fail", detail: redact(error instanceof Error ? error.message : String(error)), pageText });
  }
}

function finalize(error) {
  const failed = tests.filter((test) => test.status === "fail");
  const payload = {
    runTimestamp: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    buildMode: "next build + next start",
    runtimeMode: "test",
    totalTests: tests.length,
    passedTests: tests.filter((test) => test.status === "pass").length,
    failedTests: failed.length,
    skippedTests: 0,
    tests,
    screenshots,
    error: error ? redact(error instanceof Error ? error.message : String(error)) : undefined
  };
  writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
}

function waitForServerActionPost(page) {
  return page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && response.url().includes("/pipeline/");
  }, { timeout: 20_000 });
}

async function expandQualificationSections(page) {
  await page.locator("details.pipeline-section").evaluateAll((sections) => {
    for (const section of sections) section.open = true;
  });
}

async function bootstrap() {
  const result = spawnSync(process.execPath, ["scripts/bootstrap-foundation-0a-local.mjs"], {
    cwd: root,
    env: qaEnv,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error(`Foundation bootstrap failed for P1-01A browser QA: ${redact(result.stderr || result.stdout || "no output")}`);
  }
}

function loadCompatibilityPack() {
  const result = spawnSync(process.execPath, ["scripts/load-cfg-runtime-02-pack-local.mjs"], {
    cwd: root,
    env: qaEnv,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    throw new Error(`Active compatibility-pack load failed for P1-01A browser QA: ${redact(result.stderr || result.stdout || "no output")}`);
  }
}

function startNext(serverPort) {
  const ownedServer = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(serverPort)], {
    cwd: root,
    env: qaEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
  ownedServer.stdout.on("data",chunk=>serverStdout+=chunk);
  ownedServer.stderr.on("data",chunk=>serverStderr+=chunk);
  return ownedServer;
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

function requireApprovedPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(61430, "127.0.0.1", () => {
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

function ensureLocalSupabaseEnv() {
  return requireQualificationChildEnv();
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY|SUPABASE_SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)=.+/g, "$1=[REDACTED]");
}
