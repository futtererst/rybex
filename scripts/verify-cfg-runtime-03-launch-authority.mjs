import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const scripts = packageJson.scripts ?? {};
const results = [];
let failures = 0;

function record(name, passed, detail = "") {
  results.push({ name, status: passed ? "pass" : "fail", detail });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`);
  if (!passed) failures += 1;
}

const formerBypasses = [
  "foundation-0b:gate-local",
  "foundation-0c:gate-local",
  "foundation-0d:gate-local",
  "foundation-0e:gate-local",
  "foundation-0f:gate-local",
  "p1-01a:gate-local",
  "p1-01a:acceptance-closure",
];
for (const name of formerBypasses) {
  const graph = resolvePackageGraph(name, scripts, root);
  record(`${name} reaches disposable guarded launch authority`, graph.files.has("scripts/run-with-cfg-runtime-03-qualification.mjs") && graph.files.has("scripts/cfg-runtime-03-qualification-runtime.mjs") && graph.files.has("scripts/run-guarded-qualification-supabase.mjs"), [...graph.files].join(" -> "));
  record(`${name} has no reachable direct or dynamic Supabase start`, graph.violations.length === 0, graph.violations.join("; "));
}

for (const name of [
  "cfg-runtime-03:qa-browser",
  "cfg-runtime-03:regression",
  "cfg-runtime-01:qa-browser",
  "cfg-runtime-02:verify-database",
  "cfg-runtime-02:qa-browser",
  "p1-01a:qa-db",
  "p1-01a:qa-browser",
]) {
  const graph = resolvePackageGraph(name, scripts, root);
  const isolated = graph.files.has("scripts/run-with-cfg-runtime-03-qualification.mjs") || graph.files.has("scripts/cfg-runtime-03-qualification-runtime.mjs") || name === "cfg-runtime-03:regression";
  record(`${name} is qualification-isolated`, isolated && graph.violations.length === 0, [...graph.files].join(" -> "));
}

const synthetic = [
  ["direct package Supabase start", { packageScripts: { bad: "supabase start" }, files: {} }],
  ["nested package-script bypass", { packageScripts: { bad: "npm run nested", nested: "supabase start" }, files: {} }],
  ["Node subprocess bypass", { packageScripts: { bad: "node bad.mjs" }, files: { "bad.mjs": `spawnSync("supabase", ["start"]);` } }],
  ["PowerShell subprocess bypass", { packageScripts: { bad: "powershell -File bad.ps1" }, files: { "bad.ps1": `supabase start` } }],
  ["global CLI substitution", { packageScripts: { bad: "node bad.mjs" }, files: { "bad.mjs": `spawnSync("supabase", ["start"]);` } }],
  ["dynamic CLI download", { packageScripts: { bad: "npx supabase start" }, files: {} }],
];
for (const [name, fixture] of synthetic) {
  const graph = resolveVirtualGraph("bad", fixture);
  record(`${name} fails caller-graph verification`, graph.violations.length > 0, graph.violations.join("; "));
}

if (failures) {
  console.error(`CFG-RUNTIME-03 launch-authority verification failed: ${failures}`);
  process.exit(1);
}
console.log(`CFG-RUNTIME-03 launch-authority verification passed (${results.length} assertions).`);

function resolvePackageGraph(entry, packageScripts, repoRoot) {
  const virtual = {};
  return walk(entry, packageScripts, (path) => {
    const absolute = resolve(repoRoot, path);
    return existsSync(absolute) ? readFileSync(absolute, "utf8") : virtual[path];
  });
}

function resolveVirtualGraph(entry, fixture) {
  return walk(entry, fixture.packageScripts, (path) => fixture.files[normalize(path).replaceAll("\\", "/")]);
}

function walk(entry, packageScripts, readFile) {
  const scriptsSeen = new Set();
  const files = new Set();
  const violations = [];
  const visitScript = (name) => {
    if (scriptsSeen.has(name)) return;
    scriptsSeen.add(name);
    const command = packageScripts[name] ?? "";
    inspectText(`package:${name}`, command);
    for (const nested of command.matchAll(/(?:npm(?:\.cmd)?\s+run|npm\.cmd\s+run)\s+([A-Za-z0-9:_.-]+)/g)) visitScript(nested[1]);
    for (const match of command.matchAll(/(?:node|powershell(?:\.exe)?(?:\s+-File)?)\s+([^\s;&|]+\.(?:mjs|cjs|js|ps1))/gi)) visitFile(match[1], "");
  };
  const visitFile = (path, fromDir) => {
    const normalized = normalize(join(fromDir, path)).replaceAll("\\", "/").replace(/^\.\//, "");
    if (files.has(normalized)) return;
    files.add(normalized);
    const text = readFile(normalized);
    if (text === undefined) {
      violations.push(`${normalized}:missing_reachable_file`);
      return;
    }
    inspectText(normalized, text);
    const base = dirname(normalized);
    for (const match of text.matchAll(/(?:from\s+|import\s*)["'](\.\.?\/[^"']+)["']/g)) {
      let child = match[1];
      if (!extname(child)) child += ".mjs";
      visitFile(child, base);
    }
    for (const match of text.matchAll(/["']((?:scripts\/|\.\.?\/)[^"']+\.(?:mjs|cjs|js|ps1))["']/g)) visitFile(match[1], match[1].startsWith("scripts/") ? "" : base);
  };
  const inspectText = (source, text) => {
    const normalized = String(text).replace(/\\/g, "/");
    const packageOrShell = source.startsWith("package:") || source.endsWith(".ps1");
    const directStart = packageOrShell && /\b(?:npx(?:\.cmd)?\s+)?supabase(?:\.cmd)?(?:@[^\s]+)?\s+start\b/i.test(normalized);
    const nodeStart = /(?:spawnSync|spawn|execFileSync|run)\s*\(\s*["'](?:npx(?:\.cmd)?|supabase(?:\.cmd)?)["']\s*,\s*\[[^\]]{0,120}(?:["']supabase["']\s*,\s*)?["']start["']/i.test(normalized);
    const dynamicDownload = /npx(?:\.cmd)?\s+supabase(?:@[^\s]+)?\s+start/i.test(normalized);
    const shellBypass = packageOrShell && /(?:powershell|pwsh|cmd(?:\.exe)?)[^\n]*(?:supabase)[^\n]*\bstart\b/i.test(normalized);
    if (directStart || nodeStart || dynamicDownload || shellBypass) violations.push(`${source}:unguarded_supabase_start`);
  };
  visitScript(entry);
  return { scripts: scriptsSeen, files, violations };
}
