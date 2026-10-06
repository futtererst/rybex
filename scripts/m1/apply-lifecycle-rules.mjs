import { readFileSync } from "node:fs";
import { hash, q, sql } from "./implementation-context.mjs";

const version = "20261005122038";
const name = "d5o_configured_lifecycle_rules";
const source = readFileSync("supabase/migrations/" + version + "_" + name + ".sql", "utf8");
if (sql("select count(*) from supabase_migrations.schema_migrations where version=" + q(version) + ";") !== "0")
  throw new Error("migration_version_already_recorded");
if (sql("select to_regprocedure('rybex_internal.d5o_m1_evaluate(jsonb,uuid,uuid,jsonb,jsonb)') is not null;") !== "t")
  throw new Error("baseline_evaluator_missing");
const body = source.replace(/\bbegin;\s*$/m, "").replace(/\bcommit;\s*$/m, "");
sql("begin;\n" + body + "\ninsert into supabase_migrations.schema_migrations(version,name,statements) values("
  + q(version) + "," + q(name) + ",array[" + q(source) + "]);\ncommit;");
const recorded = sql("select statements[1] from supabase_migrations.schema_migrations where version=" + q(version) + ";");
if (hash(recorded) !== hash(source.trim())) throw new Error("recorded_migration_source_mismatch");
console.log(JSON.stringify({ status: "APPLIED", version, sha256: hash(source), target: "owned disposable database only" }));
