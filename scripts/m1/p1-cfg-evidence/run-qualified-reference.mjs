import { spawn,spawnSync } from "node:child_process";
import { writeFileSync,readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
const root=process.cwd();const out=resolve(root,process.env.P1_CFG_OUTPUT_ROOT??"artifacts/d5o-m1-s1-implementation-20260928T004316Z/p1-cfg-recovery-20260928-01/raw");
if (!out.startsWith(resolve(root,"artifacts/d5o-m1-s1-implementation-20260928T004316Z")+"\\")) throw new Error("unowned_output");
const selected=process.env.P1_CFG_TEST??"test-contract";
if (!["test-contract","test-security","test-atomicity","p1-reference","cfg01-reference","cfg02-reference","cfg03-reference","p1-browser"].includes(selected)) throw new Error("unapproved_test");
const script="scripts/local-foundation-0f-scanner-service.mjs";
const scanner=spawn(process.execPath,[script,"61428"],{cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let ready=false;let logs="";scanner.stderr.on("data",x=>logs+=x);
try{
 await new Promise((yes,no)=>{const timer=setTimeout(()=>no(new Error("scanner_ready_timeout")),10000);scanner.once("exit",code=>{if(!ready){clearTimeout(timer);no(new Error("scanner_exit_"+code+" "+logs));}});scanner.stdout.on("data",x=>{logs+=x;if(logs.includes("FOUNDATION_0F_SCANNER_READY 61428")){ready=true;clearTimeout(timer);yes();}});});
 writeFileSync(resolve(out,"scanner-process.json"),JSON.stringify({pid:scanner.pid,script,sha256:createHash("sha256").update(readFileSync(script)).digest("hex"),url:"http://127.0.0.1:61428",synthetic:true},null,2));
 let childEnv={...process.env,P1_CFG_RESULT_PATH:resolve(out,`${selected}-results.json`)};
 if(["p1-reference","cfg01-reference","cfg02-reference","cfg03-reference","p1-browser"].includes(selected)) { const {clients}=await import("../baseline-correction/fixtures.mjs");const c=await clients();childEnv={...c.env,CFG_RUNTIME_02_DB_CONTAINER:"supabase_db_rybex-cfg03-q-m1-s1-recovery-20260928",P1_01A_RESULTS_PATH:resolve(out,"p1-reference-results.json")}; }
 const target=selected==="p1-reference"?"scripts/qa-p1-01a-opportunity.mjs":`scripts/m1/p1-cfg-evidence/${selected}.mjs`;
 let childArgs=selected==="cfg01-reference"?["--input-type=module","-e",`import {writeFileSync} from 'node:fs'; const m=await import('./scripts/verify-cfg-runtime-01-database.mjs'); try { await m.runRuntimeAssertions('supabase_db_rybex-cfg03-q-m1-s1-recovery-20260928'); } finally { writeFileSync(process.env.P1_CFG_RESULT_PATH,JSON.stringify(m.referenceResults(),null,2)); }`]:[target];
 if(selected==="cfg01-reference")Object.assign(childEnv,{P1_CFG01_LIBRARY:"1",P1_CFG_RESULT_PATH:resolve(out,"cfg01-reference-results.json")});
 if(selected==="cfg02-reference" || selected==="cfg03-reference") {
  const number=selected==="cfg02-reference"?"02":"03";
  Object.assign(childEnv,{P1_CFG_REFERENCE_LIBRARY:"1",P1_CFG_RESULT_PATH:resolve(out,`${selected}-results.json`),CFG_RUNTIME_03_EVIDENCE_NAMESPACE:relative(root,out).replaceAll("\\","/"),CFG_RUNTIME_03_ACTIVE_ROOT:root});
  childArgs=["--input-type=module","-e",`import {writeFileSync} from 'node:fs';const m=await import('./scripts/verify-cfg-runtime-${number}-database.mjs');try{await m.${number==="02"?"runLocalBusinessProof()":"runOwnedReference(process.env)"};}finally{writeFileSync(process.env.P1_CFG_RESULT_PATH,JSON.stringify(m.referenceResults(),null,2));}`];
 }
 if(selected==="p1-browser") {
  Object.assign(childEnv,{P1_CFG_BROWSER_OUTPUT:out,RYBEXOS_SCANNER_MODE:"local_service",RYBEXOS_SCANNER_URL:"http://127.0.0.1:61428"});childArgs=["scripts/qa-p1-01a-browser.mjs"];
 }
 const child=spawn(process.execPath,childArgs,{cwd:root,env:childEnv,windowsHide:true,stdio:["ignore","pipe","pipe"]});
 let stdout="",stderr="";child.stdout.on("data",x=>stdout+=x);child.stderr.on("data",x=>stderr+=x);const exit=await new Promise(yes=>child.once("exit",yes));writeFileSync(resolve(out,`${selected}-run.json`),JSON.stringify({exit,stdout,stderr},null,2));console.log(JSON.stringify({exit,stdout,stderr}));process.exitCode=exit??1;
}finally{if(scanner.exitCode===null)scanner.kill();writeFileSync(resolve(out,"scanner-log.txt"),logs);}
