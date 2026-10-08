import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {context,sql,q,save,hash,loadWork,command} from "./implementation-context.mjs";
import {prepare,decide} from "./proof-fixtures.mjs";
import {cloneConfiguration,restoreDefault} from "./configuration-variants.mjs";
const plan=JSON.parse(readFileSync(process.argv[2])),c=await context(),results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,"-");
const engine=()=>sql("select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='rybex_internal' and p.proname like 'd5o_m1_%') or (n.nspname='public' and p.proname in ('d5o_create_work_record_v1','d5o_execute_work_command_v1','d5o_load_work_record_v1'));");
const before=engine();
try{
 for(const f of plan.scenarios){
  const original=await prepare(c,f),prior=await loadWork(original.owner,f,original.work);
  try{
   const variant=cloneConfiguration(f,(row,table)=>table==='config_gate_definitions'?{...row,entry_rule_json:{op:"all",items:[row.entry_rule_json,{op:"fact_equals",key:"additional_configured_requirement",value:true}]}}:row);
   const newer=await prepare(c,variant,{submit:false});await assert.rejects(()=>command(newer.owner,variant,newer.work,"submit_proof"),/readiness_blocked/);
   await decide(c,f,original.work,f.pack.rights.find(r=>!r.key.startsWith('hold')&&!r.approvalRule.exceptionRuleKey).key);
   const pinned=await loadWork(original.owner,f,original.work);assert.equal(pinned.work.configuration_version_id,f.version);assert.equal(pinned.work.configuration_digest,prior.work.configuration_digest);
   results.push({name:f.name+" pack swap changes required behavior while in-flight work remains pinned",status:"PASS",oldVersion:f.version,newVersion:variant.version});
   const labels=cloneConfiguration(f,(row)=>Object.hasOwn(row,'label')?{...row,label:"Arbitrary display label"}:row);
   const labelled=await prepare(c,labels);for(const right of f.pack.rights.filter(r=>!r.key.startsWith('hold')&&!r.approvalRule.exceptionRuleKey))await decide(c,labels,labelled.work,right.key);
   const final=await loadWork(labelled.owner,labels,labelled.work);assert.equal(final.work.lifecycle_state,f.pack.workType.lifecycle.completeState);assert.equal(final.decisions.length,f.name==='rybex'?2:3);
   results.push({name:f.name+" label swap leaves business authority and completion unchanged",status:"PASS",version:labels.version});
  }finally{restoreDefault(f);}
 }
 assert.equal(engine(),before);results.push({name:"identical database engine definitions across both packs and swaps",status:"PASS",sha256:hash(Buffer.from(before))});
 const paths=['supabase/migrations/20260928214119_d5o_m1_work_record_gate.sql','lib/d5o/work-record/server.ts','app/m1-proof/actions.ts','app/m1-proof/page.tsx'];
 for(const path of paths){const source=readFileSync(path,'utf8');assert(!/(?:if|case|when)[^\n;]{0,180}(?:rotork|certification-turnover|pilot-rollout|d5o-m1-proof-rybex|d5o-m1-proof-rotork)/i.test(source),path);}
 results.push({name:"scenario-specific business branching inspection",status:"PASS",paths,allowedIdentityLiteral:"Environment guard identifies owned infrastructure only; fixture generation chooses synthetic inputs only."});
 save(`INVARIANCE-${tag}.json`,{status:"PASS",results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save(`INVARIANCE-${tag}.json`,{status:"FAIL",error:e.message,results});console.error(JSON.stringify({error:e.message,passed:results.length}));process.exitCode=1;}
