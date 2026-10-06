import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { boundary, q, sql } from './implementation-context.mjs';

// Records the exact source used by the isolated disposable database after
// manual qualification. This does not run or repair historical migrations.
boundary();
const source = readFileSync('supabase/migrations/20261004230000_d5o_work_package_foundation.sql', 'utf8');
const version = '20261004230000';
if (sql("select to_regclass('public.d5o_work_packages') is not null and to_regclass('public.d5o_lifecycle_actions') is not null; ") !== 't') throw Error('extension_schema_missing');
if (sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(version)};`) !== '0') throw Error('migration_version_already_recorded');
sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(version)},'d5o_work_package_foundation',array[${q(source)}]);`);
console.log(JSON.stringify({ status: 'RECORDED', version, sha256: createHash('sha256').update(source).digest('hex') }));
