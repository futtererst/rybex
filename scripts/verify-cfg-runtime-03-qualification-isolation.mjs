import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  PRESERVED_PROJECT_ID,
  assertDisposableQualificationIdentity,
  createDisposableQualificationRuntime,
  teardownDisposableQualificationRuntime,
} from "./cfg-runtime-03-qualification-runtime.mjs";
import { inspectSupabaseProjectBindings } from "./local-supabase-loopback-network.mjs";

const root = resolve(process.cwd());
const mode = process.argv.find((value) => value.startsWith("--mode="))?.slice(7) ?? "static";
const preservedContainer = `supabase_db_${PRESERVED_PROJECT_ID}`;

if (mode === "static") staticControls();
else if (mode === "preserved-rejection") preservedRejection();
else if (mode === "live") await liveDisposableControl();
else if (mode === "preserved-residue") preservedResidue();
else throw new Error(`unsupported qualification-isolation mode:${mode}`);

function staticControls() {
  const temp = mkdtempSync(join(tmpdir(), "cfg03-isolation-negative-"));
  try {
    mkdirSync(join(temp, "supabase"), { recursive: true });
    writeFileSync(join(temp, "supabase", "config.toml"), `project_id = "${PRESERVED_PROJECT_ID}"\n[api]\nport = 60001\n[db]\nport = 60002\nshadow_port = 60003\n`);
    expectReject("preserved project identity", { root, projectId: PRESERVED_PROJECT_ID, projectDir: temp, env: {} });
    writeFileSync(join(temp, "supabase", "config.toml"), `project_id = "rybex-cfg03-q-negative"\n[api]\nport = 60001\n[db]\nport = 60002\nshadow_port = 60003\n`);
    expectReject("preserved database port", { root, projectId: "rybex-cfg03-q-negative", projectDir: temp, ports: { api: "60001", db: "55322" }, env: {} });
    expectReject("preserved database URL", { root, projectId: "rybex-cfg03-q-negative", projectDir: temp, ports: { api: "60001", db: "60002" }, env: { DATABASE_URL: "postgresql://postgres@127.0.0.1:55322/postgres" } });
    expectReject("preserved container identity", { root, projectId: "rybex-cfg03-q-negative", projectDir: temp, ports: { api: "60001", db: "60002" }, env: { RYBEX_DB_CONTAINER: preservedContainer } });
    console.log("CFG-RUNTIME-03 qualification isolation static controls passed.");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function preservedRejection() {
  const before = preservedCounts();
  let rejected = false;
  try {
    assertDisposableQualificationIdentity({ root, projectId: PRESERVED_PROJECT_ID, projectDir: root, env: {} });
  } catch (error) {
    rejected = /qualification_project_identity_required/.test(error.message);
  }
  const after = preservedCounts();
  if (!rejected || JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`preserved_write_rejection_failed:${JSON.stringify({ before, after, rejected })}`);
  console.log(`PASS: preserved-stack qualification target rejected before mutation - ${JSON.stringify(after)}`);
}

async function liveDisposableControl() {
  const preservedBefore = preservedCounts();
  const runtime = await createDisposableQualificationRuntime({ root, label: "isolation" });
  let cleanup;
  try {
    const bindings = inspectSupabaseProjectBindings(runtime.projectId);
    const published = bindings.containers.flatMap((container) => container.bindings);
    if (published.length === 0 || published.some((entry) => entry.hostIp !== "127.0.0.1" || entry.hostPort === "55329")) throw new Error(`invalid_disposable_bindings:${JSON.stringify(published)}`);
    const residue = containerCounts(runtime.dbContainer);
    if (!Object.values(residue).every((value) => Number(value) === 0)) throw new Error(`initial_disposable_residue:${JSON.stringify(residue)}`);
    console.log(`PASS: live disposable loopback qualification - ${JSON.stringify({ projectId: runtime.projectId, ports: runtime.ports, published, residue })}`);
  } finally {
    cleanup = teardownDisposableQualificationRuntime(runtime, { tolerateMissing: false });
  }
  const preservedAfter = preservedCounts();
  if (!cleanup.zeroResidualResources || JSON.stringify(preservedBefore) !== JSON.stringify(preservedAfter)) throw new Error(`live_isolation_cleanup_failed:${JSON.stringify({ cleanup, preservedBefore, preservedAfter })}`);
  console.log(`PASS: failure-safe teardown leaves zero disposable resources and preserved rows stable - ${JSON.stringify(cleanup.residual)}`);
}

function preservedResidue() {
  const counts = preservedCounts();
  const expected = { opportunities: 2, qualifications: 2, evidenceObjects: 0, evidenceLinks: 0, authorityRows: 0, auditEvents: 19695 };
  if (JSON.stringify(counts) !== JSON.stringify(expected)) throw new Error(`preserved_baseline_mismatch:${JSON.stringify({ expected, counts })}`);
  console.log(`PASS: authoritative preserved baseline has zero qualification residue - ${JSON.stringify(counts)}`);
}

function expectReject(label, options) {
  let rejected = false;
  try { assertDisposableQualificationIdentity(options); } catch { rejected = true; }
  if (!rejected) throw new Error(`${label} was not rejected`);
  console.log(`PASS: ${label} rejected before launch`);
}

function preservedCounts() {
  if (!existsSync(join(root, ".env.local"))) throw new Error("repository identity unavailable");
  return containerCounts(preservedContainer, true);
}

function containerCounts(container, includeAudit = false) {
  const fields = [
    `'opportunities', (select count(*) from opportunities)`,
    `'qualifications', (select count(*) from opportunity_qualifications)`,
    `'evidenceObjects', (select count(*) from evidence_objects)`,
    `'evidenceLinks', (select count(*) from evidence_links)`,
    `'authorityRows', (select count(*) from opportunity_bid_evidence_satisfactions)`,
  ];
  if (includeAudit) fields.push(`'auditEvents', (select count(*) from audit_events)`);
  const result = spawnSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", `select json_build_object(${fields.join(",")})::text;`], { cwd: root, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 20 });
  if (result.status !== 0) throw new Error(`database_count_failed:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim());
}
