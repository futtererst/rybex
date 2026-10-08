import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const evidenceRoot = resolve(root, "artifacts/cfg-runtime-03-authoritative-baseline-remediation/2026-08-12T16-53-40-348Z");
const focusedPath = join(evidenceRoot, "focused-command-ledger.json");
const orderedPath = join(evidenceRoot, "ordered-command-ledger.json");
const browserPath = join(evidenceRoot, "browser-candidate/manifest.json");
const screenshotRoot = join(evidenceRoot, "browser-candidate/screenshots");
const cleanupPath = join(evidenceRoot, "authorized-13-row-cleanup-evidence.json");
const reconciledBaselinePath = join(evidenceRoot, "authoritative-preserved-database-baseline-post-reconciliation.json");
const focused = json(focusedPath);
const ordered = json(orderedPath);
const browser = json(browserPath);
const cleanup = json(cleanupPath);
const reconciledBaseline = json(reconciledBaselinePath);

assert(focused.status === "passed" && focused.entries.length === 36 && focused.entries.every((entry) => entry.exitCode === 0), "focused gate is not a complete 36-command pass");
assert(ordered.status === "passed" && ordered.entries.length === 27 && ordered.entries.every((entry) => entry.exitCode === 0), "ordered qualification is not a complete 27-command pass");
assert([...focused.entries, ...ordered.entries].every((entry) => entry.requiredSkips.length === 0 && entry.optionalSkips.length === 0), "qualification contains a skip");
assert(browser.screenshotCount === 6 && browser.scenarios.length === 6, "browser evidence does not contain exactly six scenarios");
assert(browser.consoleErrorCount === 0 && browser.pageErrorCount === 0 && browser.requiredSkips === 0, "browser evidence contains an error or skip");
assert(cleanup.transaction.singleTransaction && cleanup.transaction.preconditionsPassed && cleanup.transaction.committed, "authorized cleanup is not a proven committed single transaction");
assert(cleanup.transaction.deletedEvidenceObjects === 7 && cleanup.transaction.deletedEvidenceLinks === 6 && cleanup.transaction.additionalRowsDeleted === 0, "authorized 13-row cleanup count mismatch");

const protectedExpected = {
  ".env.local": "bf0477de4eb2121f507ba770e28508751eda8b65b447db9843660402c6f7ce92",
  "supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql": "fc2dd4616f19cfdc97cb7ba0d234236f30797f3c3ca82fa4d976b848820ca15a",
  "supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql": "3a597bd63309d7a6139a86fde66ea998b18e56b1ba9b36a4ea8714cfffe50cda",
  "artifacts/cfg-runtime-02-accepted-baseline/ACCEPTANCE-MANIFEST.json": "3ec404021c849f503f1d4bdb2cdfc813c0cb289db2c941fe64c494c9096f6549",
  "config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json": "6260de94106bbc047857c3e2b666afea9a124b80acd257546201b6de2bf30abc",
  "artifacts/cfg-runtime-03-identity-boundary-remediation/2026-08-12T16-22-54-517Z/hash-manifest.json": "e797635c23375cb5a9bf44bd04be7ff7847ca983fdbcec1dd0c5cae4dd4672f1",
  "artifacts/cfg-runtime-03-authoritative-baseline-remediation/2026-08-12T16-53-40-348Z/post-cleanup-qualification-residue-blocker.json": "1160f7905a0c5eed5c5edd99f3b7f1695c2571ced2308ae7f4aa500ca2632206",
  "artifacts/cfg-runtime-03-authoritative-baseline-remediation/2026-08-12T16-53-40-348Z/recovery/preserved-database-before-cleanup.dump": "d949dd6cdd224197b51509e5fa429e9a1e5da1de0f4dfdc54157d5d3e4888b88",
};
for (const [path, expected] of Object.entries(protectedExpected)) assert(sha(resolve(root, path)) === expected, `protected hash mismatch: ${path}`);

const dbState = JSON.parse(run("docker", ["exec", "supabase_db_rybex-2-local", "psql", "-U", "postgres", "-d", "postgres", "-Atc", `select json_build_object(
  'opportunities',(select count(*) from public.opportunities),
  'qualifications',(select count(*) from public.opportunity_qualifications),
  'evidenceObjects',(select count(*) from public.evidence_objects),
  'evidenceLinks',(select count(*) from public.evidence_links),
  'assignments',(select count(*) from public.opportunity_assignments),
  'authorityRows',(select count(*) from public.opportunity_bid_evidence_satisfactions),
  'auditEvents',(select count(*) from public.audit_events),
  'projects',(select count(*) from public.projects),
  'migrations',(select count(*) from supabase_migrations.schema_migrations),
  'danglingQualificationLinks',(select count(*) from public.evidence_links el where el.entity_type='opportunity_qualification' and not exists(select 1 from public.opportunity_qualifications q where q.id=el.entity_id)),
  'missingOpportunityLinks',(select count(*) from public.evidence_links el where el.entity_type='opportunity' and not exists(select 1 from public.opportunities o where o.id=el.entity_id)),
  'bidDecisions',(select count(*) from public.opportunity_bid_submission_events),
  'pursuitDecisions',(select count(*) from public.opportunity_pursuit_authorization_events),
  'opportunityHash',(select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id),'')) from public.opportunities x),
  'qualificationHash',(select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id),'')) from public.opportunity_qualifications x),
  'auditHash',(select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id),'')) from public.audit_events x),
  'projectHash',(select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id),'')) from public.projects x),
  'migrationHash',(select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.version),'')) from supabase_migrations.schema_migrations x)
)`]).stdout.trim());
const expectedCounts = { opportunities: 2, qualifications: 2, evidenceObjects: 0, evidenceLinks: 0, assignments: 0, authorityRows: 0, auditEvents: 19695, projects: 2, migrations: 31, danglingQualificationLinks: 0, missingOpportunityLinks: 0 };
for (const [key, expected] of Object.entries(expectedCounts)) assert(dbState[key] === expected, `preserved database mismatch for ${key}: ${dbState[key]} != ${expected}`);
assert(dbState.opportunityHash === reconciledBaseline.rowAggregateMd5.opportunities, "preserved opportunity rows changed");
assert(dbState.qualificationHash === reconciledBaseline.rowAggregateMd5.qualifications, "preserved qualification rows changed");
assert(dbState.auditHash === reconciledBaseline.rowAggregateMd5.auditEvents, "preserved audit rows changed");
assert(dbState.projectHash === reconciledBaseline.rowAggregateMd5.projects, "preserved project rows changed");
assert(dbState.migrationHash === reconciledBaseline.rowAggregateMd5.migrationLedger, "migration ledger changed");

const dockerContext = run("docker", ["context", "show"]).stdout.trim();
assert(dockerContext === "desktop-linux", `unexpected Docker context: ${dockerContext}`);
const persistentNames = lines(run("docker", ["ps", "--filter", "name=rybex-2-local", "--format", "{{.Names}}"]).stdout);
const inspected = persistentNames.map((name) => JSON.parse(run("docker", ["inspect", name]).stdout)[0]);
const publishedBindings = inspected.flatMap((container) => Object.entries(container.NetworkSettings.Ports ?? {}).flatMap(([containerPort, bindings]) => (bindings ?? []).map((binding) => ({ container: container.Name.replace(/^\//, ""), containerPort, hostIp: binding.HostIp, hostPort: binding.HostPort })))).filter((binding) => /^5532\d$/.test(binding.hostPort));
assert(publishedBindings.length === 7, `expected seven published authoritative bindings, found ${publishedBindings.length}`);
assert(publishedBindings.every((binding) => binding.hostIp === "127.0.0.1"), "a published authoritative port is not explicit IPv4 loopback");
const expectedPublished = ["55321", "55322", "55323", "55324", "55325", "55326", "55327"];
assert(expectedPublished.every((port) => publishedBindings.some((binding) => binding.hostPort === port)), "authoritative port family is incomplete");
assert(!publishedBindings.some((binding) => binding.hostPort === "55329"), "pooler 55329 is published");

const listenerLines = lines(run("netstat", ["-ano"]).stdout).filter((line) => /:5532\d\s/i.test(line));
assert(!listenerLines.some((line) => /(?:0\.0\.0\.0|\[?::\]?):5532\d\s/i.test(line)), "wildcard authoritative listener exists");
assert(!listenerLines.some((line) => /:55329\s/i.test(line)), "pooler listener exists");
const disposableContainers = lines(run("docker", ["ps", "-a", "--filter", "name=rybex-cfg03-q-", "--format", "{{.Names}}"]).stdout);
const disposableNetworks = lines(run("docker", ["network", "ls", "--filter", "name=rybex-cfg03-q-", "--format", "{{.Name}}"]).stdout);
const disposableVolumes = lines(run("docker", ["volume", "ls", "--filter", "name=rybex-cfg03-q-", "--format", "{{.Name}}"]).stdout);
assert(disposableContainers.length === 0 && disposableNetworks.length === 0 && disposableVolumes.length === 0, "disposable Docker residue remains");
const appPort = new URL(browser.loopbackRuntime.appBaseUrl).port;
const candidateAppListeners = listenerLines.filter((line) => new RegExp(`:${appPort}\\s`).test(line));
assert(candidateAppListeners.length === 0, `candidate app listener remains on ${appPort}`);

const volumes = ["supabase_db_rybex-2-local", "supabase_storage_rybex-2-local"].map((name) => {
  const volume = JSON.parse(run("docker", ["volume", "inspect", name]).stdout)[0];
  return { name: volume.Name, createdAt: volume.CreatedAt, mountpoint: volume.Mountpoint };
});
const localCliVersion = run("node_modules\\.bin\\supabase.cmd", ["--version"]).stdout.trim();
assert(localCliVersion === "2.109.1", `repository-local CLI mismatch: ${localCliVersion}`);
const envBoundary = {
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN ?? null,
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF ?? null,
  projectLinkExists: existsSync(resolve(root, "supabase/.temp/project-ref")),
};
assert(envBoundary.SUPABASE_ACCESS_TOKEN === null && envBoundary.SUPABASE_PROJECT_REF === null && !envBoundary.projectLinkExists, "remote authority material is present");

const screenshots = readdirSync(screenshotRoot).filter((name) => name.endsWith(".png")).sort().map((name) => ({
  scenarioId: browser.scenarios.find((scenario) => scenario.fileName === name)?.scenarioId,
  path: `browser-candidate/screenshots/${name}`,
  sha256: sha(join(screenshotRoot, name)),
  size: statSync(join(screenshotRoot, name)).size,
}));
assert(screenshots.length === 6 && new Set(screenshots.map((entry) => entry.sha256)).size === 6, "screenshots are not exactly six unique images");
for (const screenshot of screenshots) assert(browser.screenshotHashes.some((entry) => entry.fileName === basename(screenshot.path) && entry.sha256 === screenshot.sha256), `browser manifest mismatch: ${screenshot.path}`);

const regressionPath = latest(join(evidenceRoot, "regression"), /^CFG-RUNTIME-03-REGRESSION-.*\.json$/);
const regression = json(regressionPath);
assert(regression.status === "passed" || regression.status === "pass" || regression.exitCode === 0 || regression.summary?.failed === 0, "latest regression evidence is not passing");
const finalGitStatus = run("git", ["status", "--short", "--branch"]).stdout;
const implementationDiffSha256 = shaBuffer(run("git", ["diff", "--binary", "--", ".", ":(exclude)artifacts"], 250 * 1024 * 1024).stdout);

const boundaryManifest = {
  generatedAt: new Date().toISOString(), status: "pass", dockerContext, projectId: "rybex-2-local",
  configuredShadowPort: "55320", publishedBindings, listenerLines, pooler55329Closed: true,
  namedVolumes: volumes, disposableContainers, disposableNetworks, disposableVolumes,
  candidateApplicationPort: appPort, candidateApplicationListeners: candidateAppListeners,
  localCli: { path: resolve(root, "node_modules/.bin/supabase.cmd"), version: localCliVersion },
  envBoundary, remoteSupabaseContacted: false, deploymentSystemContacted: false,
};
const boundaryPath = join(evidenceRoot, "docker-binding-boundary-manifest.json");
writeFileSync(boundaryPath, `${JSON.stringify(boundaryManifest, null, 2)}\n`);

const integrity = {
  generatedAt: new Date().toISOString(), status: "pass",
  repository: { root, branch: run("git", ["branch", "--show-current"]).stdout.trim(), head: run("git", ["rev-parse", "HEAD"]).stdout.trim(), finalGitStatus },
  authorization: cleanup.authority, transaction: cleanup.transaction,
  preservedDatabase: dbState, expectedCounts, reconciledRowHashes: reconciledBaseline.rowAggregateMd5,
  protected: Object.entries(protectedExpected).map(([path, expected]) => ({ path, expectedSha256: expected, actualSha256: sha(resolve(root, path)), unchanged: true })),
  migration0031: { path: "supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql", sha256: sha(resolve(root, "supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql")) },
  focused: summarizeLedger(focused), ordered: summarizeLedger(ordered), browser: { scenarios: 6, consoleErrors: 0, pageErrors: 0, requiredSkips: 0 },
  regression: { path: normalize(relative(evidenceRoot, regressionPath)), sha256: sha(regressionPath) },
  docker: boundaryManifest, screenshots, implementationDiffSha256,
  noRemoteSystemContacted: true, cfgRuntime04Unstarted: true, p101b3Unstarted: true,
};
const integrityPath = join(evidenceRoot, "final-integrity-evidence.json");
writeFileSync(integrityPath, `${JSON.stringify(integrity, null, 2)}\n`);

const scenarioRows = browser.scenarios.map((scenario) => `| ${scenario.scenario} | ${scenario.outcome} | ${scenario.reloadConfirmed ? "Yes" : "N/A"} | ${scenario.consoleErrorCount}/${scenario.pageErrorCount}/${scenario.requiredSkipCount} | Pass |`).join("\n");
const screenshotLinks = screenshots.map((entry) => `- [${basename(entry.path)}](${join(screenshotRoot, basename(entry.path)).replaceAll("\\", "/")}) — \`${entry.sha256}\``).join("\n");
const reportPath = join(evidenceRoot, "CFG-RUNTIME-03-AUTHORITATIVE-BASELINE-AND-IDENTITY-BOUNDARY-REMEDIATION-REPORT-2026-08-12.md");
const report = `# CFG-RUNTIME-03 Authoritative-Baseline and Identity-Boundary Remediation

## 1. Verdict and human-acceptance status

CFG-RUNTIME-03 AUTHORITATIVE-BASELINE AND IDENTITY-BOUNDARY REMEDIATION CANDIDATE READY FOR INDEPENDENT REREVIEW

CFG-RUNTIME-03 HUMAN ACCEPTANCE: PENDING SHAWN

## 2. Executive conclusion

The false Prompt 6 preserved-data interpretation is superseded, the restore-proven 6,815-row cleanup and separately authorized 13-row residue cleanup committed with exact identity/count guards, and the preserved database now reconciles to 2 opportunities, 2 qualifications, 0 evidence objects, 0 evidence links, 19,695 audit events and 31 migrations. Migration 0031 enforces actor/profile coherence, all startup routes use guarded loopback launch authority, qualification writes are isolated from the persistent stack, all 36 focused and 27 ordered commands pass with zero skips, and exactly six browser states pass with zero console/page errors.

## 3. Prompt 6 baseline supersession

Prompt 6 reported 13 legitimate opportunities and zero test opportunities. Direct relational lineage proves 11 opportunities and nine qualifications were Prompt 6 qualification residue. Its data-count conclusion is classified exactly as \`MATERIAL QUALIFICATION-RESIDUE MISCLASSIFICATION\`; its technical candidate remains disqualified. Prompt 7/8 evidence supersedes that interpretation, and its screenshots remain visual-only evidence.

## 4. Complete provenance classification

The complete row-level classification is preserved in [row-level-provenance-ledger.json](${join(evidenceRoot, "row-level-provenance-ledger.json").replaceAll("\\", "/")}) (SHA-256 \`${sha(join(evidenceRoot, "row-level-provenance-ledger.json"))}\`). It classifies every starting opportunity, qualification, evidence object, evidence link, assignment, authority association and related record using only: \`PRESERVED LEGITIMATE\`, \`PROMPT 6 QUALIFICATION CONTAMINATION\`, \`PREEXISTING DANGLING LINK\`, \`PREEXISTING QUALIFICATION-ONLY OBJECT\`, or \`AMBIGUOUS — PRESERVE AND BLOCK\`. Ambiguous rows: 0.

## 5. Authoritative baseline decision

The evidence-backed decision preserved two pre-Prompt-6 opportunities and two qualifications, all audit history, decisions, projects and named volumes. It authorized backup plus guarded transactional dry run/commit solely for proven residue. See [authoritative-baseline-decision.json](${join(evidenceRoot, "authoritative-baseline-decision.json").replaceAll("\\", "/")}).

## 6. Exact deletion population

The restore-proven plan selected 4,315 evidence objects, 2,469 evidence links, 11 Prompt 6 opportunities, nine Prompt 6 qualifications and 11 dependent assignments: 6,815 rows total. A later CFG-RUNTIME-02 verifier breach created seven additional qualification-only objects and six dangling links; the user separately authorized exactly those 13 recorded identities under authority artifact SHA-256 \`1160f7905a0c5eed5c5edd99f3b7f1695c2571ced2308ae7f4aa500ca2632206\`. No other deletion was performed.

## 7. Backup and restore proof

The complete recovery dump was restored into a disposable database and reconciled by schema, migration ledger, counts and row hashes before cleanup. The retained backup is [preserved-database-before-cleanup.dump](${join(evidenceRoot, "recovery/preserved-database-before-cleanup.dump").replaceAll("\\", "/")}), SHA-256 \`d949dd6cdd224197b51509e5fa429e9a1e5da1de0f4dfdc54157d5d3e4888b88\`.

## 8. Cleanup transaction and final counts

Both cleanup populations used preconditioned one-transaction execution. The additional 13-row transaction verified every authorized live identity, exact global counts, dangling status, link dependencies and preservation assertions before deleting six links then seven objects and committing. Final counts: opportunities 2; qualifications 2; evidence objects 0; evidence links 0; assignments 0; authority rows 0; audits 19,695; projects 2; migrations 31; dangling links 0.

## 9. Legitimate and ambiguous-row preservation

The deletion plans selected zero legitimate rows, zero ambiguous rows, zero audit rows, zero accepted decisions and zero projects. The post-commit row aggregates for opportunities, qualifications, audits, projects and migration ledger match the reconciled authoritative baseline.

## 10. Migration 0031

\`supabase/migrations/0031_cfg_runtime_03_actor_profile_identity_coherence.sql\` — SHA-256 \`${integrity.migration0031.sha256}\`. It adds the canonical unique auth-user/profile relationship, composite relational enforcement on evidence authority, immutable identity protection and the smallest required anti-dangling constraints without changing migrations 0029 or 0030.

## 11. Actor/profile coherence results

Fresh, 0029-upgrade and 0030-upgrade paths pass. Valid A/A and B/B pairs pass; A/B, B/A, fabricated browser authority, incoherent preflight state and later identity reassignment fail at the database boundary. Failed writes leave no partial evidence, association or audit rows.

## 12. Dangling-link prevention

Existing strictly dangling links are zero. Database relationships and server validation reject missing targets, cross-boundary authority, stale package revisions and partial transactions. A database ending at 0030 fails CFG-RUNTIME-03 readiness.

## 13. Seven startup bypasses before and after

The seven former executable start paths could call the CLI without complete binding/guard authority. Each now reaches the canonical guarded launcher before child creation. Focused controls prove all seven corrected routes and reject direct, nested-package, Node, PowerShell, global-CLI and dynamic-download bypasses.

## 14. Complete launch caller graph

Package scripts and nested child-process edges are resolved by the caller-graph verifier through \`run-with-cfg-runtime-03-qualification.mjs\`, \`run-guarded-qualification-supabase.mjs\`, \`manage-rybex-local-stack.mjs\` and \`run-supabase-loopback.mjs\`. The graph validates repository identity, Docker context, sanitized environment, exact local CLI 2.109.1, binding plan, post-start Docker inspection, listener inspection and failure cleanup.

## 15. Qualification isolation proof

Every database/browser/regression qualifier uses a unique disposable project and ports. Preserved project name, URL, port and volume inputs fail before mutation; missing disposable identity fails closed. The corrected CFG-RUNTIME-02 database verifier also requires the disposable child environment. Post-run residue is zero.

## 16. Candidate manifest and digests

The complete tracked-plus-untracked boundary is [candidate-inventory.json](${join(evidenceRoot, "candidate-inventory.json").replaceAll("\\", "/")}). It separately classifies implementation/evidence and records path, Git state, canonical status, executable/imported status, mode, size, raw SHA-256, purpose and origin. It includes implementation-tree, evidence-tree, tracked-binary-diff and untracked-implementation digests.

## 17. Focused command ledger

[focused-command-ledger.json](${focusedPath.replaceAll("\\", "/")}): 36/36 commands executed sequentially, all exit 0, required skips 0, optional skips 0. Per-command timestamps, warnings, children, guards, resources, bindings and cleanup are recorded.

## 18. Ordered command ledger

[ordered-command-ledger.json](${orderedPath.replaceAll("\\", "/")}): 27/27 commands executed sequentially, all exit 0, required skips 0, optional skips 0. The sequence includes clean install, exact CLI version, all CFG/predecessor/database/browser suites, workflow verification, build, typecheck, lint and diff check.

## 19. Negative-control matrix

| Control | Result |
| --- | --- |
| Preserved-stack qualification write | Rejected before mutation |
| Missing disposable identity | Rejected |
| User A/Profile B and User B/Profile A | Rejected at database boundary |
| Browser-fabricated actor/profile | Rejected |
| Stale/cross-revision, requirement, opportunity, workspace, configuration or evidence type | Rejected |
| Duplicate/competing and partial writes | Safe; no partial state |
| Direct/nested/Node/PowerShell/global/dynamic CLI bypass | Rejected |
| Token/project-ref/link metadata/remote host/5432x | Rejected |
| Wildcard, empty, omitted or non-loopback HostIp | Rejected |
| Pooler publication | Rejected |

## 20. Docker bindings and listeners

Docker context is \`${dockerContext}\`. Actual published bindings are explicit \`127.0.0.1:55321\` through \`127.0.0.1:55327\`; shadow is configured at \`127.0.0.1:55320\` when created; pooler 55329 is disabled and closed. No wildcard authoritative listener exists. Original database/storage volumes remain present.

## 21. Six-state visual matrix

| Scenario | Outcome | Reload | Console/page/skip | Result |
| --- | --- | --- | --- | --- |
${scenarioRows}

## 22. Screenshot links and hashes

${screenshotLinks}

## 23. Database, browser and boundary manifests

- Final database/integrity evidence: [final-integrity-evidence.json](${integrityPath.replaceAll("\\", "/")})
- Browser manifest: [manifest.json](${browserPath.replaceAll("\\", "/")}) — SHA-256 \`${sha(browserPath)}\`
- Docker boundary manifest: [docker-binding-boundary-manifest.json](${boundaryPath.replaceAll("\\", "/")}) — SHA-256 recorded in the final hash manifest.
- Regression evidence: [${basename(regressionPath)}](${regressionPath.replaceAll("\\", "/")}) — SHA-256 \`${sha(regressionPath)}\`

## 24. Protected hashes

- Migration 0029: \`${protectedExpected["supabase/migrations/0029_cfg_runtime_03_bid_submission_approval.sql"]}\`
- Migration 0030: \`${protectedExpected["supabase/migrations/0030_cfg_runtime_03_evidence_persistence_authority.sql"]}\`
- Migration 0031: \`${integrity.migration0031.sha256}\`
- CFG-RUNTIME-02 frozen manifest: \`${protectedExpected["artifacts/cfg-runtime-02-accepted-baseline/ACCEPTANCE-MANIFEST.json"]}\`
- Immutable v1.2 pack: \`${protectedExpected["config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json"]}\`
- Prompt 8 hash manifest: \`${protectedExpected["artifacts/cfg-runtime-03-identity-boundary-remediation/2026-08-12T16-22-54-517Z/hash-manifest.json"]}\`

## 25. .env.local hash

Before and after: \`${protectedExpected[".env.local"]}\`; unchanged and never loaded.

## 26. Cleanup evidence

No \`rybex-cfg03-q-*\` container, network or volume remains, and the candidate app port ${appPort} has no listener. [authorized-13-row-cleanup-evidence.json](${cleanupPath.replaceAll("\\", "/")}) records the exact final transaction. Persistent named volumes were preserved: ${volumes.map((entry) => `\`${entry.name}\` (${entry.createdAt})`).join(", ")}.

## 27. Verifier integrity

No verifier was weakened, deleted, skipped or converted to snapshot-only trust. Assertions were strengthened for complete candidate inventory, launch caller graph, qualification isolation, identity coherence, preserved-state hashes and zero residue.

## 28. Old defective behavior

The old behaviors now fail substantive controls: qualification targeting \`rybex-2-local\`, incomplete actor/profile pairs, dangling authority, unguarded launch chains, wildcard binding, wrong/missing/global CLI and residue-producing CFG-RUNTIME-02 database verification are rejected.

## 29. Remote-system boundary

No remote Supabase project, deployment, staging or production system was contacted. Access/project-ref environment variables are unset, project-link metadata is absent, and no commit, stage, push or deploy occurred.

## 30. Later milestones

CFG-RUNTIME-04 and P1-01B.3 remain unstarted. Configuration Studio was not begun.

## 31. Remaining blockers

None for independent rereview. Human acceptance remains pending Shawn and is outside this prompt.
`;
writeFileSync(reportPath, report);

const manifestPaths = [
  "authoritative-baseline-decision.json", "row-level-provenance-ledger.json", "exact-deletion-plan.json",
  "backup-restore-reconciliation.json", "cleanup-dry-run-evidence.json", "cleanup-transaction-evidence.json",
  "post-cleanup-qualification-residue-blocker.json", "authorized-13-row-cleanup.sql", "authorized-13-row-cleanup-evidence.json",
  "authoritative-preserved-database-baseline-post-reconciliation.json", "focused-command-ledger.json", "ordered-command-ledger.json",
  normalize(relative(evidenceRoot, regressionPath)), "browser-candidate/manifest.json", "docker-binding-boundary-manifest.json",
  "final-integrity-evidence.json", basename(reportPath), "recovery/preserved-database-before-cleanup.dump",
];
const hashManifest = {
  generatedAt: new Date().toISOString(), algorithm: "SHA-256 raw bytes", status: "pass",
  sourceHead: integrity.repository.head, branch: integrity.repository.branch,
  protected: integrity.protected,
  migration0031: integrity.migration0031,
  candidate: manifestPaths.map((path) => ({ path, sha256: sha(join(evidenceRoot, path)), size: statSync(join(evidenceRoot, path)).size })),
  screenshots, implementationDiffSha256, finalGitStatus,
};
const hashPath = join(evidenceRoot, "hash-manifest.json");
writeFileSync(hashPath, `${JSON.stringify(hashManifest, null, 2)}\n`);

console.log(JSON.stringify({
  status: "pass", verdict: "CFG-RUNTIME-03 AUTHORITATIVE-BASELINE AND IDENTITY-BOUNDARY REMEDIATION CANDIDATE READY FOR INDEPENDENT REREVIEW",
  report: reportPath, reportSha256: sha(reportPath), hashManifest: hashPath, hashManifestSha256: sha(hashPath),
  finalIntegrity: integrityPath, finalIntegritySha256: sha(integrityPath), browserManifestSha256: sha(browserPath), boundaryManifestSha256: sha(boundaryPath),
  regression: regressionPath, regressionSha256: sha(regressionPath), screenshots, dbState,
}, null, 2));

function summarizeLedger(ledger) {
  return { status: ledger.status, requiredCount: ledger.requiredCount, executed: ledger.entries.length, exitCodes: [...new Set(ledger.entries.map((entry) => entry.exitCode))], requiredSkips: ledger.entries.reduce((sum, entry) => sum + entry.requiredSkips.length, 0), optionalSkips: ledger.entries.reduce((sum, entry) => sum + entry.optionalSkips.length, 0), warnings: ledger.entries.reduce((sum, entry) => sum + entry.warnings.length, 0) };
}
function latest(directory, pattern) {
  const matches = readdirSync(directory).filter((name) => pattern.test(name)).map((name) => join(directory, name)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!matches[0]) throw new Error(`no evidence matched ${pattern} in ${directory}`);
  return matches[0];
}
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function sha(path) { return shaBuffer(readFileSync(path)); }
function shaBuffer(value) { return createHash("sha256").update(value).digest("hex"); }
function lines(value) { return String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function normalize(value) { return String(value).replaceAll("\\", "/"); }
function assert(value, message) { if (!value) throw new Error(message); }
function run(command, args, maxBuffer = 100 * 1024 * 1024) {
  const windowsCmd = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  const result = spawnSync(windowsCmd ? "cmd.exe" : command, windowsCmd ? ["/d", "/s", "/c", command, ...args] : args, { cwd: root, encoding: "utf8", shell: false, maxBuffer });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}
