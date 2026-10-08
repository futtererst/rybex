import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { boundary, evidence, hash, sql } from "../m1/implementation-context.mjs";

const manifestPath = resolve(evidence, "replay-guard-correction-20260929-01/GATE-MANIFEST.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const source = resolve("supabase/migrations/20261002000000_d5o_m2_work_record_queue.sql");
const entry = { path: source, staged_name: basename(source), sha256: hash(readFileSync(source)) };
const output = resolve(evidence, "m2-workspace-20261002-01/M2-S5-QUEUE-MIGRATION.json");
const stage = resolve(".rybexos-local/m1-s1/m2-queue-migration-stage");
const migrationDir = resolve(stage, "supabase/migrations");

assert.equal(manifest.project, "rybex-cfg03-q-m1-s1-recovery-20260928");
boundary();
assert.match(readFileSync(source, "utf8"), /revoke all on function public\.d5o_list_work_records_v1\(uuid, integer\) from public, anon, service_role/i);
const before = sql("begin read only;select count(*) from supabase_migrations.schema_migrations;commit;");
assert.equal(before, "35", "unexpected_migration_ledger");
mkdirSync(migrationDir, { recursive: true });
const config = readFileSync(".rybexos-local/m1-s1/brc-recovery/supabase/config.toml", "utf8");
assert(config.includes('project_id = "rybex-cfg03-q-m1-s1-recovery-20260928"'));
writeFileSync(resolve(stage, "supabase/config.toml"), config);
for (const prior of manifest.replay) {
  assert.equal(hash(readFileSync(prior.path)), prior.sha256, `prior_source_drift:${prior.staged_name ?? prior.source}`);
  writeFileSync(resolve(migrationDir, prior.staged_name ?? basename(prior.path)), readFileSync(prior.path));
}
writeFileSync(resolve(migrationDir, entry.staged_name), readFileSync(source));
const cli = resolve(".rybexos-local/m1-s1/toolchain/supabase-go.exe");
const env = { ...process.env, SUPABASE_HOME: resolve(".rybexos-local/m1-s1/cli-home"), SUPABASE_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1", CI: "1" };
const run = spawnSync(cli, ["migration", "up", "--local", "--workdir", stage, "--yes"], { env, encoding: "utf8", windowsHide: true, maxBuffer: 12 * 1024 * 1024 });
writeFileSync(output, JSON.stringify({ before, entry, stage, exit: run.status, stdout: run.stdout, stderr: run.stderr }, null, 2));
assert.equal(run.status, 0, "migration_up_failed");
const after = sql("begin read only;select count(*) from supabase_migrations.schema_migrations;commit;");
assert.equal(after, "36", "queue_migration_not_recorded");
console.log(JSON.stringify({ status: "PASS", before, after, entry }, null, 2));
