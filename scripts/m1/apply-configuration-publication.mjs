import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { boundary, sql, q } from "./implementation-context.mjs";

const version = process.argv[2] ?? "20261005200000";
const approved = new Map([
  ["20261005200000", "d5o_configuration_publication"],
  ["20261005210000", "d5o_configuration_activation_split"],
  ["20261005220000", "d5o_candidate_activation_guard"],
  ["20261005230000", "d5o_published_phase_contract"],
]);
const name = approved.get(version);
if (!name) throw new Error("unapproved_configuration_migration");
const file = `supabase/migrations/${version}_${name}.sql`;
const body = readFileSync(file, "utf8");
const sha256 = createHash("sha256").update(body).digest("hex");
boundary();
if (sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(version)}`) !== "0") {
  throw new Error("migration_already_recorded");
}
console.log(sql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations(version,statements,name)
values(${q(version)},array[${q(body)}],${q(name)});\ncommit;
select version||' '||name from supabase_migrations.schema_migrations where version=${q(version)};`));
console.log(`migration_sha256=${sha256}`);
