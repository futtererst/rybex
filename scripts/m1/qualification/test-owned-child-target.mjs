import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {bindOwnedChildTarget,dispatchOwnedLoader} from "./owned-child-target.mjs";
const m=JSON.parse(readFileSync(process.env.M1_GATE_MANIFEST,"utf8"));
const owner=JSON.parse(readFileSync(m.ownership,"utf8"));
const name=`supabase_db_${m.project}`;
const env={NEXT_PUBLIC_SUPABASE_URL:m.api,RYBEX_QUALIFICATION_PROJECT_DIR:m.runtimeDirectory,RYBEX_QUALIFICATION_PROJECT_ID:m.project,RYBEX_QUALIFICATION_DB_CONTAINER:name};
const results=[];let invocations=0;
function test(name,fn){fn();results.push({name,status:"PASS"});}
function dispatch(patch={},manifest=m,script=m.loaders[1].script){return dispatchOwnedLoader(manifest,owner,{...env,...patch},script,(_script,child)=>{invocations++;return child;});}
test("All legacy aliases bind to the same explicit owned container",()=>{const actual=dispatch();for(const key of ["CFG_RUNTIME_01_DB_CONTAINER","CFG_RUNTIME_02_DB_CONTAINER","CFG_RUNTIME_03_DB_CONTAINER","RYBEX_QUALIFICATION_DB_CONTAINER"])assert.equal(actual[key],name);});
for(const [key,value] of [
 ["CFG_RUNTIME_01_DB_CONTAINER","supabase_db_rybex-2-local"],["CFG_RUNTIME_02_DB_CONTAINER","supabase_db_rybex-2-local"],["CFG_RUNTIME_03_DB_CONTAINER","d5o-platform"],["RYBEX_QUALIFICATION_DB_CONTAINER","other"],["RYBEX_QUALIFICATION_PROJECT_ID","rybex-2-local"],["RYBEX_QUALIFICATION_PROJECT_DIR","C:/unapproved"],["NEXT_PUBLIC_SUPABASE_URL","http://127.0.0.1:55321"],["NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co"],["NEXT_PUBLIC_SUPABASE_URL",undefined],["SUPABASE_URL","http://127.0.0.1:55321"],["DATABASE_URL","postgres://localhost:55322/postgres"],["DOCKER_HOST","tcp://localhost:2375"],["PGHOST","localhost"],["PORT","61431"],["RYBEXOS_SCANNER_URL","http://127.0.0.1:61431"],["RYBEXOS_SCANNER_MODE","disabled"],["CFG_RUNTIME_02_PACK_PATH","other.json"],["CFG_RUNTIME_02_WORKSPACE_ID","other"],
])test(`Reject ${key}=${value} before child invocation`,()=>{const before=invocations;assert.throws(()=>dispatch({[key]:value}));assert.equal(invocations,before);});
for(const field of ["sha256","packSha256"])test(`Reject changed ${field} before child invocation`,()=>{const before=invocations;assert.throws(()=>dispatch({}, {...m,loaders:m.loaders.map(x=>({...x,[field]:"0".repeat(64)}))}));assert.equal(invocations,before);});
test("Unlisted loader cannot execute",()=>{const before=invocations;assert.throws(()=>dispatch({},m,"scripts/other.mjs"));assert.equal(invocations,before);});
test("Owner mismatch rejected",()=>assert.throws(()=>bindOwnedChildTarget(m,{...owner,database_container:"unknown"},env)));
for(const n of ["01","02","03"])test(`CFG${n} browser uses central environment and loader guard`,()=>{const source=readFileSync(`scripts/capture-cfg-runtime-${n}-browser.mjs`,"utf8");assert(source.includes(n==="03"?"m1Gate.borrowRuntime(process.env)":"m1Gate.childEnv(process.env)"));assert(source.includes('if (m1Gate) return m1Gate.runLoader('));assert(source.includes("Explicit owned browser manifest mode required"));assert(source.includes("await m1Gate.browserPort()"));});
writeFileSync(resolve(m.evidence,"CHILD-TARGET-RESULTS.json"),JSON.stringify({tests:results,childInvocations:invocations,meaning:"Only the valid case reached the injected child launcher; no loaders or databases executed by this test."},null,2));console.log(JSON.stringify({pass:results.length,total:results.length,childInvocations:invocations}));
