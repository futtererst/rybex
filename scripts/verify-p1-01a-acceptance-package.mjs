import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const artifactRoot = resolve(root, "artifacts/p1-01a-human-acceptance-remediation");
const authorityRoot = resolve(root, "docs/product-experience/p1-01a/visual-reference-set-v1.0");
const manifestCsvPath = join(authorityRoot, "MANIFEST.csv");
const captureSessionPath = join(artifactRoot, "capture-session.json");
const captureManifestPath = join(artifactRoot, "capture-manifest.json");
const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, status: ok ? "pass" : "fail", detail });
}

check("Artifact root exists", existsSync(artifactRoot), artifactRoot);
check("Capture session exists", existsSync(captureSessionPath), captureSessionPath);
check("Capture manifest exists", existsSync(captureManifestPath), captureManifestPath);
check("Approved MANIFEST exists", existsSync(manifestCsvPath), manifestCsvPath);

const approvedRows = existsSync(manifestCsvPath) ? parseCsv(readFileSync(manifestCsvPath, "utf8")) : [];
const session = existsSync(captureSessionPath) ? JSON.parse(readFileSync(captureSessionPath, "utf8")) : {};
const capture = existsSync(captureManifestPath) ? JSON.parse(readFileSync(captureManifestPath, "utf8")) : {};
const entries = Array.isArray(capture.entries) ? capture.entries : [];
const sessionStart = Date.parse(session.sessionStartedAt ?? "");

check("Approved manifest has 36 rows", approvedRows.length === 36, `rows:${approvedRows.length}`);
check("Capture manifest has exactly 36 entries", entries.length === 36, `entries:${entries.length}`);
check("Capture session timestamp is valid", Number.isFinite(sessionStart), session.sessionStartedAt ?? "missing");
check("Source fingerprint exists", Boolean(session.sourceFingerprint && capture.sourceFingerprint), "missing source fingerprint");
check("Authority fingerprint exists", Boolean(session.authorityFingerprint && capture.authorityFingerprint), "missing authority fingerprint");
check("Manifest fingerprint exists", Boolean(session.manifestFingerprint && capture.manifestFingerprint), "missing manifest fingerprint");
check("Manifest fingerprint matches approved manifest", session.manifestFingerprint === sha256(readFileSync(manifestCsvPath)), "manifest changed since capture");

const entriesByPath = new Map(entries.map((entry) => [entry.screenshotPath, entry]));
const expectedGroups = new Map();
for (const row of approvedRows) {
  const vr = row.visual_reference;
  expectedGroups.set(vr, (expectedGroups.get(vr) ?? 0) + 1);
  const expectedFile = `artifacts/p1-01a-human-acceptance-remediation/screenshots/${vr}/${basename(row.clean_frame)}`;
  const entry = entriesByPath.get(expectedFile);
  check(`${basename(row.clean_frame)} entry exists`, Boolean(entry), expectedFile);
  if (!entry) continue;
  const filePath = join(root, entry.screenshotPath);
  const comparisonPath = join(root, entry.comparisonPath ?? "");
  const viewport = parseViewport(row.viewport);
  check(`${basename(row.clean_frame)} file exists`, existsSync(filePath), filePath);
  check(`${basename(row.clean_frame)} comparison exists`, existsSync(comparisonPath), comparisonPath);
  if (existsSync(filePath)) {
    check(`${basename(row.clean_frame)} is non-empty`, statSync(filePath).size > 0, `${statSync(filePath).size} bytes`);
    const size = pngSize(filePath);
    check(`${basename(row.clean_frame)} width matches`, size.width === viewport.width, `${size.width} vs ${viewport.width}`);
    check(`${basename(row.clean_frame)} height matches`, size.height === viewport.height, `${size.height} vs ${viewport.height}`);
    check(`${basename(row.clean_frame)} hash matches metadata`, sha256(readFileSync(filePath)) === entry.sha256, "hash mismatch");
    const referencePath = join(authorityRoot, row.clean_frame);
    if (existsSync(referencePath)) {
      check(`${basename(row.clean_frame)} is not substituted reference`, sha256(readFileSync(filePath)) !== sha256(readFileSync(referencePath)), "implementation image equals reference");
    }
  }
  const captureTime = Date.parse(entry.captureTimestamp ?? "");
  check(`${basename(row.clean_frame)} captured in current session`, Number.isFinite(captureTime) && Number.isFinite(sessionStart) && captureTime >= sessionStart, entry.captureTimestamp ?? "missing");
  check(`${basename(row.clean_frame)} has metadata`, Boolean(entry.sourceFingerprint && entry.authorityFingerprint && entry.stateSetupId && entry.expectedPersistedState), "metadata missing");
  check(`${basename(row.clean_frame)} has no console errors`, Array.isArray(entry.consoleErrors) && entry.consoleErrors.length === 0, JSON.stringify(entry.consoleErrors ?? []));
  check(`${basename(row.clean_frame)} has no page errors`, Array.isArray(entry.pageErrors) && entry.pageErrors.length === 0, JSON.stringify(entry.pageErrors ?? []));
  check(`${basename(row.clean_frame)} has no runtime error copy`, !/Unhandled Runtime Error|Application error|Internal Server Error|stack trace|HTTP 500/i.test(entry.textSnapshot ?? ""), "runtime error text");
  check(`${basename(row.clean_frame)} avoids package-output`, !String(entry.screenshotPath).includes("package-output") && !String(entry.comparisonPath).includes("package-output"), "historical export path");
}

for (const [vr, count] of expectedGroups) {
  const actual = entries.filter((entry) => entry.visualReference === vr).length;
  check(`${vr} group complete`, actual === count, `${actual} vs ${count}`);
  check(`${vr} screenshot directory exists`, existsSync(join(artifactRoot, "screenshots", vr)), vr);
  check(`${vr} comparison directory exists`, existsSync(join(artifactRoot, "comparisons", vr)), vr);
}

check("Index exists", existsSync(join(artifactRoot, "index.html")), "index.html");
check("Capture result exists", existsSync(join(artifactRoot, "test-results", "capture-result.json")), "capture-result.json");

const failed = checks.filter((entry) => entry.status === "fail");
for (const entry of checks) {
  console.log(`${entry.status === "pass" ? "PASS" : "FAIL"} ${entry.name}${entry.detail ? ` - ${entry.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`P1-01A acceptance package verification failed ${failed.length} check(s).`);
  process.exit(1);
}

console.log("P1-01A acceptance package verification passed.");

function parseCsv(content) {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid viewport: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function pngSize(filePath) {
  const bytes = readFileSync(filePath);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
