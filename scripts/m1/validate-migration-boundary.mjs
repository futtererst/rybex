import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
/** This validator admits one outer transaction and never silently retains COMMIT. */
export function rollbackOnly(source) {
 const normalized=source.replaceAll("\r\n","\n");
 const ends=[...normalized.matchAll(/^commit\s*;\s*$/gim)];
 if(ends.length!==1 || normalized.slice(ends[0].index+ends[0][0].length).trim()!=="")throw Error("One terminal COMMIT required");
 const result=normalized.slice(0,ends[0].index)+"rollback;\n";
 if(/^\s*commit\s*;/im.test(result) || !/rollback;\n$/.test(result))throw Error("Unsafe rollback transformation");
 return result;
}
if(process.argv.includes("--test")){
 for(const ending of ["\n","\r\n"]){
  const source=["begin;","select 1;","commit;", ""].join(ending);
  assert.equal(rollbackOnly(source),"begin;\nselect 1;\nrollback;\n");
 }
 for(const source of ["begin; select 1;", "begin;\ncommit;\ncommit;", "begin;\ncommit;\nselect 1;"]){assert.throws(()=>rollbackOnly(source));}
 const actual=readFileSync("supabase/migrations/20260928214119_d5o_m1_work_record_gate.sql","utf8");
 assert(!/^commit\s*;/im.test(rollbackOnly(actual)));
 console.log("Migration rollback-boundary tests: 6/6 PASS");
}
