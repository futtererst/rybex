import {
  check,
  finish,
  normalizeSql,
  readAllConfigurationSql,
  readMigration,
} from "./configuration-foundation-static-utils.mjs";

const results = [];
const seedSql = readMigration("0026_configuration_template_pack_seed_data.sql");
const allSql = normalizeSql(readAllConfigurationSql());
const normalizedSeed = normalizeSql(seedSql);

check(results, "seed migration file exists and is readable", seedSql.length > 0);
check(results, "seed data is explicitly deferred", normalizedSeed.includes("seed data is deferred"));
check(results, "seed migration inserts no records", !/\binsert\s+into\b/i.test(seedSql));
check(results, "seed migration names all required future template packs", normalizedSeed.includes("rybex data center infrastructure") && normalizedSeed.includes("rotork industrial service lifecycle") && normalizedSeed.includes("generic d5o enterprise"));
check(results, "template pack tables exist before seed placeholder", allSql.includes("create table if not exists config_template_packs") && allSql.includes("create table if not exists config_template_pack_versions"));
check(results, "tenant activation model exists before future seeds", allSql.includes("create table if not exists config_tenant_template_activations"));

finish(results, "Configuration Foundation template-pack seed static verification");
