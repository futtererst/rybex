import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {compareSchema} from './schema-contract.mjs';import {save} from './implementation-context.mjs';
const baseline=readFileSync('.rybexos-local/m1-s1/adoption-2026-09-28T23-24-25-581Z/adopted-schema-private.sql','utf8'),current=readFileSync('.rybexos-local/m1-s1/final-schema-2026-09-29T00-12-19-254Z/schema-private.sql','utf8'),results=[];
function test(name,run){run();results.push({name,status:'PASS'});}
test('exact sealed dump accepted',()=>assert.equal(compareSchema(baseline,baseline,'2026-09-29').mode,'EXACT'));
test('only expected one-day partition addition accepted',()=>assert.equal(compareSchema(baseline,current,'2026-09-29').mode,'EXPECTED_REALTIME_DATE_PARTITION'));
test('partition on wrong date rejected',()=>assert.throws(()=>compareSchema(baseline,current,'2026-09-30')));
test('unexpected partition ACL rejected',()=>assert.throws(()=>compareSchema(baseline,current.replace('GRANT ALL ON TABLE realtime.messages_2026_10_02 TO dashboard_user;','GRANT ALL ON TABLE realtime.messages_2026_10_02 TO anon;'),'2026-09-29')));
test('unexpected partition owner rejected',()=>assert.throws(()=>compareSchema(baseline,current.replace('ALTER TABLE realtime.messages_2026_10_02 OWNER TO supabase_realtime_admin;','ALTER TABLE realtime.messages_2026_10_02 OWNER TO postgres;'),'2026-09-29')));
test('missing historical partition rejected',()=>assert.throws(()=>compareSchema(current,baseline,'2026-09-29')));
test('changed application schema rejected',()=>assert.throws(()=>compareSchema(baseline,current.replace('CREATE TABLE public.d5o_work_records (','CREATE TABLE public.d5o_work_records_changed ('),'2026-09-29')));
test('unrecognized extra object rejected',()=>assert.throws(()=>compareSchema(baseline,current+'\n--\n-- Name: rogue; Type: TABLE; Schema: realtime; Owner: postgres\n--\nCREATE TABLE realtime.rogue(id int);\n','2026-09-29')));
save('SCHEMA-CONTRACT-TESTS-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,comparison:compareSchema(baseline,current,'2026-09-29')}));
