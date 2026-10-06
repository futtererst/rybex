import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {context,save,command,loadWork} from './implementation-context.mjs';import {prepare,decide} from './proof-fixtures.mjs';
const plan=JSON.parse(readFileSync(process.argv[2])),c=await context(),results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
try{
 for(const f of plan.scenarios){
  for(const rule of f.pack.gate.entryRule.items){const p=await prepare(c,f,{omit:[rule.key],submit:false});await assert.rejects(()=>command(p.owner,f,p.work,'submit_proof'),/readiness_blocked/);const w=await loadWork(p.owner,f,p.work);assert.equal(w.decisions.length,0);assert.equal(w.proof.status,'draft');results.push({name:f.name+' missing '+rule.key+' blocks submission',status:'PASS'});}
  const p=await prepare(c,f);const final=f.pack.rights.find(x=>f.pack.outcomes.find(o=>o.key===x.outcomeKey)?.consequence.final);await assert.rejects(()=>decide(c,f,p.work,final.key),/readiness_blocked/);assert.equal((await loadWork(p.owner,f,p.work)).decisions.length,0);results.push({name:f.name+' final authority cannot bypass prerequisite decisions',status:'PASS'});
 }
 save('SCENARIO-PREREQUISITES-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save('SCENARIO-PREREQUISITES-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}
