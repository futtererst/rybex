import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { boundary, q, sql } from './implementation-context.mjs';

boundary();
const version = '20261004233000';
const source = readFileSync('supabase/migrations/20261004233000_d5o_work_package_closed_guard.sql', 'utf8');
if (sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(version)};`) !== '0') throw Error('migration_version_already_recorded');
if (sql("select to_regprocedure('rybex_internal.d5o_work_package_open_guard()') is not null;") !== 'f') throw Error('guard_already_present');
const body = source.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
sql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${q(version)},'d5o_work_package_closed_guard',array[${q(source)}]);\ncommit;`);
console.log(JSON.stringify({ status: 'APPLIED', version, sha256: createHash('sha256').update(source).digest('hex') }));
