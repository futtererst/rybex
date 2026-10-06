import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { boundary, q, sql } from './implementation-context.mjs';

boundary();
const version = '20261004234500';
const source = readFileSync('supabase/migrations/20261004234500_d5o_package_proof_snapshot.sql', 'utf8');
if (sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(version)};`) !== '0') throw Error('migration_version_already_recorded');
if (sql("select to_regprocedure('rybex_internal.d5o_m1_snapshot(uuid,uuid)') is not null;") !== 't') throw Error('m1_snapshot_missing');
const body = source.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
sql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${q(version)},'d5o_package_proof_snapshot',array[${q(source)}]);\ncommit;`);
console.log(JSON.stringify({ status: 'APPLIED', version, sha256: createHash('sha256').update(source).digest('hex') }));
