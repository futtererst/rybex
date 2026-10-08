import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, relative } from "node:path";
import { chromium } from "playwright";
import {
  canonicalizeCfgRuntime03EvidencePaths,
  prepareCfgRuntime03EvidenceOutput,
} from "./cfg-runtime-03-evidence-output.mjs";

const root = process.cwd();
const m1Gate = ownedGateAdapter();
const evidenceOutput = m1Gate ? m1Gate.browserOutput("p1b2") : prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
let evidenceOutputFinalized = false;
process.on("exit", () => { if (!evidenceOutputFinalized) evidenceOutput.abort(); });
const artifactDir = evidenceOutput.temporaryRoot;
const screenshotDir = join(artifactDir, "screenshots");

const viewports = [
  { name: "Desktop", width: 1440, height: 1024, suffix: "D" },
  { name: "Tablet", width: 834, height: 1112, suffix: "T" },
  { name: "Mobile", width: 390, height: 844, suffix: "M" }
];

const states = [
  { key: "submission-preparation", label: "Submission preparation" },
  { key: "submission-blocked", label: "Submission blocked / missing evidence" },
  { key: "ready-for-submission-approval", label: "Ready for submission approval" },
  { key: "submission-approval-held", label: "Submission approval held / commercial review required" },
  { key: "submission-approved-ready-to-send", label: "Submission approved / ready to send" },
  { key: "submitted-pending-outcome", label: "Submitted / pending outcome" },
  { key: "clarification-requested", label: "Clarification requested" },
  { key: "revision-bafo-required", label: "Revision requested / BAFO required" },
  { key: "revised-submission-recorded", label: "Revised submission recorded / BAFO submitted" },
  { key: "lost-not-selected", label: "Lost / not selected" },
  { key: "withdrawn-no-submit", label: "Withdrawn / no-submit" },
  { key: "selected-intent-to-award", label: "Selected / intent-to-award pending award-validation gate" },
  { key: "auditor-read-only", label: "Auditor read-only" },
  { key: "unavailable", label: "Unavailable / ineligible" },
  { key: "stale-conflict", label: "Stale / conflict" },
  { key: "loading-empty-action-failure", label: "Loading / empty / action failure recovery" }
];

await mkdir(screenshotDir, { recursive: true });

const port = m1Gate ? await m1Gate.browserPort() : await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [
  nextBin,
  "dev",
  "--webpack",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(port)
], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NEXT_DISABLE_DEV_INDICATOR: "1" },
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
server.stdout.on("data", (chunk) => { logs += chunk.toString(); });
server.stderr.on("data", (chunk) => { logs += chunk.toString(); });

try {
  await waitForServer(baseUrl, 90_000);
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  try {
    for (const [stateIndex, state] of states.entries()) {
      for (const viewport of viewports) {
        const frameId = `P1B2-IMPL-${String(stateIndex + 1).padStart(2, "0")}-${viewport.suffix}`;
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
        const url = `${baseUrl}/pipeline/p1-01b-2-review?bidState=${encodeURIComponent(state.key)}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
        try {
          await page.waitForSelector("[data-pipeline-screen='bid-submission-outcome']", { timeout: 30_000 });
        } catch (error) {
          const bodyText = await page.locator("body").innerText().catch(() => "");
          throw new Error(`Bid submission surface did not render for ${url}\nPage text:\n${bodyText.slice(0, 2000)}\nServer logs:\n${logs.slice(-4000)}\n${error}`);
        }
        await page.addStyleTag({ content: `nextjs-portal,[data-nextjs-toast],[data-nextjs-dialog-overlay],[data-nextjs-dev-tools-button],[aria-label*="Next.js"],[aria-label*="next.js"]{display:none!important;visibility:hidden!important}` });
        const screenshotPath = join(screenshotDir, `${frameId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const check = await page.evaluate(() => {
          const bodyOverflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
          const targets = Array.from(document.querySelectorAll("h1, .button, .pursuit-role-pill, .pursuit-badges span, .pursuit-recommendation strong, .pursuit-next-state strong, .pipeline-kicker"));
          const clipped = targets.filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => (el.textContent || "").trim().slice(0, 80));
          return { bodyOverflowX, clipped };
        });
        const fail = check.bodyOverflowX || check.clipped.length > 0;
        captures.push({
          captureTimestamp: new Date().toISOString(),
          localUrl: url,
          viewportDimensions: { width: viewport.width, height: viewport.height },
          screenshotPath: relative(root, screenshotPath).replace(/\\/g, "/"),
          frameId,
          state: state.label,
          captureResult: fail ? "fail" : "pass",
          notes: fail ? `Overflow/clipping detected: ${JSON.stringify(check)}` : "Captured via local Next server; no horizontal overflow or checked text clipping detected."
        });
        await page.close();
      }
    }

    for (const viewport of viewports) {
      const html = contactSheetHtml(viewport.name, captures.filter((capture) => capture.frameId.endsWith(`-${viewport.suffix}`)));
      const htmlPath = join(artifactDir, `contact-sheet-${viewport.name.toLowerCase()}.html`);
      const pngPath = join(artifactDir, `contact-sheet-${viewport.name.toLowerCase()}.png`);
      await writeFile(htmlPath, html, "utf8");
      const page = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.screenshot({ path: pngPath, fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    captureTimestamp: new Date().toISOString(),
    localUrl: baseUrl,
    routePattern: "/pipeline/p1-01b-2-review?bidState={state}",
    totalStates: states.length,
    totalScreenshotsCaptured: captures.filter((capture) => existsSync(join(root, capture.screenshotPath))).length,
    totalFailures: captures.filter((capture) => capture.captureResult !== "pass").length,
    mobileClippingDetected: captures.some((capture) => capture.frameId.endsWith("-M") && capture.captureResult !== "pass"),
    captures
  };
  await writeFile(join(artifactDir, "screenshot-capture-manifest.json"), JSON.stringify(canonicalizeCfgRuntime03EvidencePaths(manifest, evidenceOutput), null, 2), "utf8");
  console.log(JSON.stringify({
    totalStates: manifest.totalStates,
    totalScreenshotsCaptured: manifest.totalScreenshotsCaptured,
    totalFailures: manifest.totalFailures,
    mobileClippingDetected: manifest.mobileClippingDetected,
    artifactDir: relative(root, evidenceOutput.finalRoot).replace(/\\/g, "/")
  }, null, 2));
} finally {
  server.kill();
  setTimeout(() => {
    if (!server.killed) server.kill("SIGKILL");
  }, 1_000).unref();
}

const committedArtifactRoot = evidenceOutput.finalize();
evidenceOutputFinalized = true;
console.log(`Committed evidence output: ${relative(root, committedArtifactRoot).replace(/\\/g, "/")}`);

function contactSheetHtml(title, captures) {
  const cells = captures.map((capture) => {
    const imageBytes = readFileSync(join(root, capture.screenshotPath));
    const src = `data:image/png;base64,${imageBytes.toString("base64")}`;
    return `<article><div><strong>${capture.frameId}</strong><span>${capture.state}</span></div><img src="${src}" alt="${capture.frameId}"></article>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} contact sheet</title><style>body{margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827}.sheet{padding:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{background:white;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,.08)}div{padding:10px 12px;border-bottom:1px solid #e5e7eb}strong,span{display:block}span{font-size:12px;color:#4b5563;margin-top:3px}img{display:block;width:100%;height:360px;object-fit:contain;background:#fff}</style></head><body><main class="sheet">${cells}</main></body></html>`;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`Timed out waiting for ${url}\n${logs}`);
}
