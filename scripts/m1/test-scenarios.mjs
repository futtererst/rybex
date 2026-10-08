import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {context,save,loadWork} from "./implementation-context.mjs";
import {prepare,decide} from "./proof-fixtures.mjs";
const plan=JSON.parse(readFileSync(process.argv[2]));const c=await context();const results=[];const tag=new Date().toISOString().replaceAll(/[:.]/g,"-");
try{
 for(const f of plan.scenarios){const p=await prepare(c,f);const final=f.pack.rights.filter(x=>!x.key.startsWith("hold-")&&!x.approvalRule.exceptionRuleKey);for(const r of final)await decide(c,f,p.work,r.key);const loaded=await loadWork(p.owner,f,p.work);assert.equal(loaded.work.lifecycle_state,f.pack.workType.lifecycle.completeState);assert.equal(loaded.decisions.length,final.length);assert.equal(new Set(loaded.decisions.map(x=>x.actor_id)).size,final.length);assert(loaded.outcomes.every(x=>x.result.valueRealized===false));results.push({scenario:f.name,status:"PASS",work:p.work,decisions:loaded.decisions.length,history:loaded.history.length,proofRevision:loaded.proof.proof_package_revision});}
 save(`SCENARIOS-${tag}.json`,{status:"PASS",results});console.log(JSON.stringify(results));
}catch(e){save(`SCENARIOS-${tag}.json`,{status:"FAIL",error:e.message,results});throw e;}
