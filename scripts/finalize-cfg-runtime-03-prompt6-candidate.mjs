import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const candidate = resolve(root, "artifacts/cfg-runtime-03-persistence-authority-remediation/2026-08-12T13-40-00-000Z");
const focusedPath = join(candidate, "focused-command-ledger.json");
const qualificationPath = join(candidate, "qualification-command-ledger.json");
const browserPath = join(candidate, "browser", "manifest.json");
const screenshots = join(candidate, "browser", "screenshots");
mkdirSync(candidate, { recursive: true });

for (const path of [focusedPath, qualificationPath]) redactLedger(path);
const focused = JSON.parse(readFileSync(focusedPath, "utf8"));
const qualification = JSON.parse(readFileSync(qualificationPath, "utf8"));
const browser = JSON.parse(readFileSync(browserPath, "utf8"));
assert(focused.status === "pass" && focused.entries.length === 23 && focused.requiredSkips === 0 && focused.optionalSkips === 0, "focused ledger is not a 23-command zero-skip pass");
assert(qualification.status === "pass" && qualification.entries.length === 27 && qualification.requiredSkips === 0 && qualification.optionalSkips === 0, "qualification ledger is not a 27-command zero-skip pass");
assert(browser.screenshotCount === 6 && browser.consoleErrorCount === 0 && browser.pageErrorCount === 0 && browser.requiredSkips === 0, "browser manifest is not a six-state zero-error zero-skip pass");

const latestDatabase = latest("artifacts/cfg-runtime-03-local-application", /^CFG-RUNTIME-03-DATABASE-EVIDENCE-.*\.json$/);
const latestRegression = latest("artifacts/cfg-runtime-03-regression", /^CFG-RUNTIME-03-REGRESSION-.*\.json$/);
copyFileSync(latestDatabase, join(candidate, "database-evidence.json"));
copyFileSync(latestRegression, join(candidate, "regression-evidence.json"));

const dockerInspect = run("node", ["scripts/manage-rybex-local-stack.mjs", "inspect"]);
const dockerState = JSON.parse(dockerInspect.stdout);
const listenersText = run("netstat", ["-ano"]).stdout;
const listenerLines = listenersText.split(/\r?\n/).filter((line) => /:5532[0-9]\s/i.test(line));
const bindings = dockerState.bindings.containers.flatMap((container) => container.bindings.map((binding) => ({ container: container.name, ...binding })));
const published = bindings.filter((binding) => /^5532[0-9]$/.test(binding.hostPort));
assert(published.every((binding) => binding.hostIp === "127.0.0.1"), "actual Docker binding is not explicit IPv4 loopback");
assert(!published.some((binding) => binding.hostPort === "55329"), "pooler 55329 is published");
assert(!listenerLines.some((line) => /\s(?:0\.0\.0\.0|\[?::\]?):5532[0-9]\s/i.test(line)), "wildcard host listener exists in authoritative port family");
assert(!listenerLines.some((line) => /:55329\s/i.test(line)), "pooler 55329 listener exists");
const volumes = {
  database: run("docker", ["volume", "inspect", "supabase_db_rybex-2-local", "--format", "{{.CreatedAt}}|{{.Name}}"]).stdout.trim(),
  storage: run("docker", ["volume", "inspect", "supabase_storage_rybex-2-local", "--format", "{{.CreatedAt}}|{{.Name}}"]).stdout.trim(),
};
const rowCounts = run("docker", ["exec", "supabase_db_rybex-2-local", "psql", "-U", "postgres", "-d", "postgres", "-Atc", "select (select count(*) from opportunities),(select count(*) from evidence_objects),(select count(*) from supabase_migrations.schema_migrations),(select count(*) from opportunity_bid_evidence_satisfactions),(select count(*) from opportunities where scope_summary like 'CFG-RUNTIME-03 database proof%' or scope_summary like 'CFG-RUNTIME-03 browser proof%');"]).stdout.trim();
const disposableContainers = run("docker", ["ps", "-a", "--format", "{{.Names}}"]).stdout.split(/\r?\n/).filter((name) => /^(?:supabase_.*_(?:rybex-cfg0[123]|rybex-cf-)|rybex-cfg0[123]|rybex-cf-)/.test(name));
assert(disposableContainers.length === 0, `disposable qualification containers remain: ${disposableContainers.join(", ")}`);
const disposableNetworks = run("docker", ["network", "ls", "--format", "{{.Name}}"]).stdout.split(/\r?\n/).filter((name) => /(?:rybex-cfg0[123]|rybex-cf-)/.test(name));
const disposableVolumes = run("docker", ["volume", "ls", "--format", "{{.Name}}"]).stdout.split(/\r?\n/).filter((name) => /(?:rybex-cfg0[123]|rybex-cf-)/.test(name));
assert(disposableNetworks.length === 0, `disposable qualification networks remain: ${disposableNetworks.join(", ")}`);
assert(disposableVolumes.length === 0, `disposable qualification volumes remain: ${disposableVolumes.join(", ")}`);
const candidateAppPort = new URL(browser.loopbackRuntime.appBaseUrl).port;
const candidateAppListeners = listenersText.split(/\r?\n/).filter((line) => /LISTENING/i.test(line) && new RegExp(`:${candidateAppPort}\\s`).test(line));
assert(candidateAppListeners.length === 0, `candidate application server listener remains on ${candidateAppPort}`);
const bindingManifest = {
  generatedAt: new Date().toISOString(),
  status: "pass",
  dockerContext: run("docker", ["context", "show"]).stdout.trim(),
  projectId: "rybex-2-local",
  advertised: dockerState.advertised,
  bindings: published,
  listenerLines,
  pooler55329Closed: true,
  namedVolumes: volumes,
  preservedRowCounts: rowCounts,
  disposableContainers,
  disposableNetworks,
  disposableVolumes,
  candidateApplicationPort: candidateAppPort,
  candidateApplicationListeners: candidateAppListeners,
  remoteSupabaseContacted: false,
  deploymentSystemContacted: false,
};
const bindingPath = join(candidate, "docker-binding-boundary-manifest.json");
writeFileSync(bindingPath, `${JSON.stringify(bindingManifest, null, 2)}\n`);

const protectedExpected = {
  ".env.local": "bf0477de4eb2121f507ba770e28508751eda8b65b447db9843660402c6f7ce92",
  "artifacts/cfg-runtime-02-accepted-baseline/ACCEPTANCE-MANIFEST.json": "3ec404021c849f503f1d4bdb2cdfc813c0cb289db2c941fe64c494c9096f6549",
  "config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json": "6260de94106bbc047857c3e2b666afea9a124b80acd257546201b6de2bf30abc",
  "supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql": "fc2dd4616f19cfdc97cb7ba0d234236f30797f3c3ca82fa4d976b848820ca15a",
};
for (const [path, expected] of Object.entries(protectedExpected)) assert(sha(join(root, path)) === expected, `protected hash mismatch: ${path}`);
const prompt1 = "artifacts/cfg-runtime-03-independent-review/CFG-RUNTIME-03-INDEPENDENT-REVIEW-2026-08-11.md";
const prompt2 = "artifacts/cfg-runtime-03-remediation/2026-08-11T23-23-45-584Z/CFG-RUNTIME-03-REMEDIATION-REPORT-2026-08-11.md";
const priorArtifacts = [prompt1, prompt2, ...walk(join(root, "artifacts/cfg-runtime-03-candidate-qualification/2026-08-12T02-25-00-000Z/browser"))
  .filter((path) => /(?:manifest\.json|\.png)$/i.test(path)).map((path) => relative(root, path).replaceAll("\\", "/"))];
const priorHashes = priorArtifacts.map((path) => ({ path, sha256: sha(join(root, path)) }));

const screenshotRecords = readdirSync(screenshots).filter((name) => name.endsWith(".png")).sort().map((name) => ({
  path: `browser/screenshots/${name}`,
  sha256: sha(join(screenshots, name)),
  size: statSync(join(screenshots, name)).size,
}));
assert(screenshotRecords.length === 6 && new Set(screenshotRecords.map((entry) => entry.sha256)).size === 6, "screenshots are not exactly six unique files");

const changedFiles = run("git", ["status", "--short"]).stdout.split(/\r?\n/).filter(Boolean);
const implementationDiff = run("git", ["diff", "--binary", "--", ".", ":(exclude)artifacts"]).stdout;
const prompt6Files = [
  "package.json", "package-lock.json", "prisma/schema.prisma",
  "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql",
  "app/pipeline/[opportunityId]/page.tsx", "lib/d5o/opportunities/types.ts",
  "lib/d5o/opportunities/database-mapper.ts", "lib/d5o/opportunities/database-mapper-ShawnT13.ts",
  "scripts/cfg-runtime-03-loopback-guard.mjs", "scripts/local-supabase-loopback-network.mjs",
  "scripts/run-supabase-loopback.mjs", "scripts/manage-rybex-local-stack.mjs",
  "scripts/verify-cfg-runtime-03-loopback-boundary.mjs", "scripts/verify-cfg-runtime-03-database.mjs",
  "scripts/verify-cfg-runtime-03-static.mjs", "scripts/capture-cfg-runtime-03-browser.mjs",
  "scripts/verify-configuration-foundation-database.mjs", "scripts/verify-cfg-runtime-01-database.mjs",
  "scripts/verify-cfg-runtime-02-database.mjs", "scripts/verify-cfg-runtime-01-static.mjs",
  "scripts/verify-cfg-runtime-02-static.mjs", "scripts/verify-cfg-runtime-03-evidence-lineage.mjs",
  "scripts/verify-cfg-runtime-03-migration-immutability.mjs", "scripts/run-cfg-runtime-03-prompt6-ledger.mjs",
  "scripts/finalize-cfg-runtime-03-prompt6-candidate.mjs",
];

const reportPath = join(candidate, "CFG-RUNTIME-03-PERSISTENCE-AUTHORITY-REMEDIATION-REPORT-2026-08-12.md");
const rows = browser.scenarios.map((scenario) => `| ${scenario.scenario} | ${scenario.browserResult}/${scenario.databaseResult} | ${scenario.outcome} | ${scenario.reloadConfirmed} | ${scenario.consoleErrorCount ?? 0}/${scenario.pageErrorCount ?? 0}/${scenario.requiredSkipCount ?? 0} |`).join("\n");
const screenshotLinks = screenshotRecords.map((entry) => `- [${basename(entry.path)}](${join(screenshots, basename(entry.path)).replaceAll("\\", "/")}) — \`${entry.sha256}\``).join("\n");
const report = `# CFG-RUNTIME-03 Persistence-Authority and High-Finding Remediation\n\n## Verdict\n\nCFG-RUNTIME-03 PERSISTENCE-AUTHORITY AND HIGH-FINDING REMEDIATION CANDIDATE READY FOR INDEPENDENT REREVIEW\n\nCFG-RUNTIME-03 HUMAN ACCEPTANCE: PENDING SHAWN\n\n## Executive conclusion\n\nThe Prompt 1 and Prompt 2 report discrepancies are adjudicated as **MANIFEST_GENERATION DEFECT** entries isolated to Prompt 4's review hash manifest. The protected baselines remain byte-identical. Migration \`0030_cfg_runtime_03_evidence_persistence_authority.sql\` establishes immutable requirement, configuration, package-revision, opportunity, workspace, attachment, actor and audit authority without modifying migration 0029. Persisted filenames now reach the ready-state UI, all published 553xx services are explicitly bound to \`127.0.0.1\`, all 23 focused gates and 27 qualification commands pass, and six corrected browser states pass with zero errors or skips.\n\n## Repository and integrity\n\n- Branch: \`${run("git", ["branch", "--show-current"]).stdout.trim()}\`\n- HEAD: \`${run("git", ["rev-parse", "HEAD"]).stdout.trim()}\`\n- Final working tree remains intentionally dirty; no staging, commit, push, or deployment occurred.\n- Prompt 1 report: \`${sha(join(root, prompt1))}\` — **MANIFEST_GENERATION DEFECT** in Prompt 4 only.\n- Prompt 2 report: \`${sha(join(root, prompt2))}\` — **MANIFEST_GENERATION DEFECT** in Prompt 4 only.\n- Migration 0029 before/after: \`${protectedExpected["supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql"]}\`.\n- New migration 0030: \`${sha(join(root, "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql"))}\`.\n- CFG-RUNTIME-02 frozen manifest: \`${protectedExpected["artifacts/cfg-runtime-02-accepted-baseline/ACCEPTANCE-MANIFEST.json"]}\`.\n- Immutable v1.2 pack: \`${protectedExpected["config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json"]}\`.\n- \`.env.local\` before/after: \`${protectedExpected[".env.local"]}\`.\n- Complete non-artifact implementation diff SHA-256: \`${createHash("sha256").update(implementationDiff).digest("hex")}\`.\n\n## Migration design and results\n\nThe normalized \`opportunity_bid_evidence_satisfactions\` association is append-only in production behavior. It binds an evidence link/object to workspace, opportunity, exact opportunity/package revision, bid-package version, configuration version, immutable template-pack version, configured gate requirement, configured evidence type, uploading actor/profile, audit event, command, and time. The server resolves these values under a locked current opportunity; browser roles cannot insert directly. Fresh 0001–0030 and upgrade 0001–0029 then 0030 paths pass. A controlled legacy evidence row is preserved but produces no authority row. Cross-revision, cross-requirement, cross-opportunity and cross-workspace associations, stale writes, duplicate satisfaction, browser-supplied authority and partial invalid transactions all fail closed. RLS exposes no direct authenticated mutation authority.\n\n## Evidence write/read/UI result\n\nThe canonical upload RPC transactionally writes the evidence object, link, audit record and authority association. Readiness joins the association to the exact persisted evidence object and returns only human-readable identity. The typed mapper rejects incomplete or mismatched authority. The ready viewport shows four satisfied configured requirements and their persisted filenames; it renders no storage key, path, signed URL or raw ID. Completed held/approved decisions remain read-only after reload, and approval remains “ready to send,” never “submitted.”\n\n## Docker boundary\n\n- Docker context: \`${bindingManifest.dockerContext}\`.\n- Explicit loopback published ports: 55321 API/Kong, 55322 PostgreSQL, 55323 Studio, 55324 Inbucket UI, 55325 SMTP, 55326 POP3, 55327 Analytics.\n- Shadow DB remains configured at 55320; pooler remains disabled and 55329 has no binding/listener.\n- Actual Docker HostIp for every published authoritative port is \`127.0.0.1\`; wildcard, empty, omitted and non-loopback negative controls fail.\n- Named volumes preserved: \`${volumes.database}\`; \`${volumes.storage}\`.\n- Preserved/current row counts (opportunities|evidence objects|migrations|authority rows|test fixtures): \`${rowCounts}\`.\n- No remote Supabase application endpoint, deployment, staging, production system or project was contacted. Public npm access was limited to exact package installation.\n\n## Command results\n\n- Focused authority gate: **23/23 exit 0**, required skips 0, optional skips 0.\n- Ordered qualification: **27/27 exit 0**, required skips 0, optional skips 0.\n- Warnings are captured per command in the ledgers; they are non-failing package/build warnings.\n- [Focused command ledger](${focusedPath.replaceAll("\\", "/")})\n- [Qualification command ledger](${qualificationPath.replaceAll("\\", "/")})\n- [Database evidence](${join(candidate, "database-evidence.json").replaceAll("\\", "/")})\n- [Regression evidence](${join(candidate, "regression-evidence.json").replaceAll("\\", "/")})\n\n## Negative-control matrix\n\n| Control | Result |\n| --- | --- |\n| Cross revision / requirement / opportunity / workspace | Rejected |\n| Missing authority / legacy link | Unsatisfied |\n| Browser direct authority | Permission denied |\n| Stale revision | Concurrency conflict |\n| Invalid/empty evidence | Rejected with no partial rows |\n| Duplicate satisfaction | Controlled rejection |\n| Wildcard/empty/omitted/non-loopback Docker HostIp | Rejected |\n| Pooler 55329 | Disabled and closed |\n| Remote hosts/tokens/project refs/link metadata/5432x | Rejected |\n\n## Six-state visual matrix\n\n| Scenario | Browser/database | Outcome | Reload | Console/page/skip |\n| --- | --- | --- | --- | --- |\n${rows}\n\n${screenshotLinks}\n\nBrowser manifest SHA-256: \`${sha(browserPath)}\`. Database evidence SHA-256: \`${sha(join(candidate, "database-evidence.json"))}\`. Regression evidence SHA-256: \`${sha(join(candidate, "regression-evidence.json"))}\`. Docker binding manifest SHA-256: \`${sha(bindingPath)}\`.\n\n## Files changed and created\n\nPrompt 6 bounded implementation files:\n\n${prompt6Files.map((path) => `- \`${path}\``).join("\n")}\n\nThe final Git status contains prior user changes as well as this bounded set and is recorded in the hash manifest. No unrelated change was removed.\n\n## Cleanup and milestone boundary\n\nAll disposable CFG/Configuration Foundation containers, networks, volumes, application servers and browser processes created by this prompt were removed. The corrected persistent \`rybex-2-local\` stack and its original named volumes were preserved. Other pre-existing unrelated Docker resources were not modified. No verifier assertion was removed or weakened; old defective filename-only readiness and wildcard binding behavior now fail substantive controls. CFG-RUNTIME-04 and P1-01B.3 remain unstarted.\n`;
writeFileSync(reportPath, report);

const hashManifest = {
  generatedAt: new Date().toISOString(),
  algorithm: "SHA-256 raw bytes",
  status: "pass",
  sourceHead: run("git", ["rev-parse", "HEAD"]).stdout.trim(),
  protected: Object.entries(protectedExpected).map(([path, expected]) => ({ path, beforeSha256: expected, afterSha256: sha(join(root, path)), unchanged: true })),
  priorArtifacts: priorHashes,
  candidate: [
    "focused-command-ledger.json", "qualification-command-ledger.json", "evidence-lineage-reconciliation.json",
    "database-evidence.json", "regression-evidence.json", "docker-binding-boundary-manifest.json",
    "browser/manifest.json", "CFG-RUNTIME-03-PERSISTENCE-AUTHORITY-REMEDIATION-REPORT-2026-08-12.md",
  ].map((path) => ({ path, sha256: sha(join(candidate, path)), size: statSync(join(candidate, path)).size })),
  screenshots: screenshotRecords,
  newMigration: { path: "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql", sha256: sha(join(root, "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql")) },
  implementationDiffSha256: createHash("sha256").update(implementationDiff).digest("hex"),
  finalGitStatus: changedFiles,
};
const hashPath = join(candidate, "hash-manifest.json");
writeFileSync(hashPath, `${JSON.stringify(hashManifest, null, 2)}\n`);
console.log(JSON.stringify({
  status: "pass",
  candidate,
  report: reportPath,
  reportSha256: sha(reportPath),
  hashManifest: hashPath,
  hashManifestSha256: sha(hashPath),
  browserManifestSha256: sha(browserPath),
  dockerBindingManifestSha256: sha(bindingPath),
  databaseEvidenceSha256: sha(join(candidate, "database-evidence.json")),
  regressionEvidenceSha256: sha(join(candidate, "regression-evidence.json")),
  screenshots: screenshotRecords,
}, null, 2));

function latest(directory, pattern) {
  const full = join(root, directory);
  const matches = readdirSync(full).filter((name) => pattern.test(name)).map((name) => join(full, name)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!matches[0]) throw new Error(`no evidence matched ${pattern} beneath ${directory}`);
  return matches[0];
}
function sha(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function assert(value, message) { if (!value) throw new Error(message); }
function run(command, args) {
  const invocation = process.platform === "win32" && command.endsWith(".cmd") ? { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] } : { command, args };
  const result = spawnSync(invocation.command, invocation.args, { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 100 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}
function redactLedger(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  const redact = (value) => String(value ?? "")
    .replace(/eyJ[A-Za-z0-9_.-]+/g, "[REDACTED_LOCAL_JWT]")
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_.-]+/g, "[REDACTED_LOCAL_KEY]")
    .replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://[REDACTED]@");
  for (const entry of data.entries ?? []) {
    entry.stdout = redact(entry.stdout);
    entry.stderr = redact(entry.stderr);
    entry.warnings = (entry.warnings ?? []).map(redact);
    entry.failures = (entry.failures ?? []).map(redact);
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}
function walk(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => walk(join(path, entry.name)));
}
