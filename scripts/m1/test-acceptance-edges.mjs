import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {context,sql,q,j,save,loadWork,command,createWork,rpc} from './implementation-context.mjs';
import {prepare,decide} from './proof-fixtures.mjs';
const plan=JSON.parse(readFileSync(process.argv[2])),c=await context(),f=plan.scenarios[0],results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
async function test(name,run){await run();results.push({name,status:'PASS'});}
try{
 const p=await prepare(c,f),other=await createWork(p.owner,f,'Separate governed unit');
 await test('idempotency key cannot replay against another target',async()=>{
 const w=await loadWork(p.owner,f,p.work),args={p_workspace_id:f.workspace,p_work_id:p.work,p_expected_version:w.work.record_version,p_proof_revision:1,p_command_id:randomUUID(),p_kind:'metadata',p_payload:{title:'Target-bound request'}};
 await rpc(p.owner,'d5o_execute_work_command_v1',args);const before=await loadWork(p.owner,f,other.workId);
 await assert.rejects(()=>rpc(p.owner,'d5o_execute_work_command_v1',{...args,p_work_id:other.workId}),/idempotency_mismatch/);
 assert.deepEqual(await loadWork(p.owner,f,other.workId),before);
 });
 const rationale={scope:'independent',authorization:'independent',ownership:'shared',commercial:'shared',readiness:'independent',execution:'independent',acceptance:'independent',outcome:'independent'};
 for(const key of Object.keys(rationale))await test('identity rationale requires '+key,async()=>{const incomplete={...rationale};delete incomplete[key];await assert.rejects(()=>createWork(p.owner,f,'Incomplete identity basis',{relation:{workId:p.work,type:'derived_from',rationale:incomplete}}),/identity_rationale_required/);});
 await test('scope without independent authorization acceptance or outcome does not justify new identity',async()=>{await assert.rejects(()=>createWork(p.owner,f,'Only execution partition',{relation:{workId:p.work,type:'child_of',rationale:{...rationale,authorization:'shared',acceptance:'shared',outcome:'shared'}}}),/independent_obligation_required/);});
 const failed=await prepare(c,f,{failed:true});
 await test('wrong-scope exception cannot be authorized',()=>assert.rejects(()=>decide(c,f,failed.work,'authorize-exception',{scopeKey:'other-package',expiresAt:new Date(Date.now()+3600000).toISOString()}),/invalid_exception/));
 await test('already expired exception cannot be authorized',()=>assert.rejects(()=>decide(c,f,failed.work,'authorize-exception',{scopeKey:'package',expiresAt:new Date(Date.now()-60000).toISOString()}),/invalid_exception/));
 await test('financial and value commitments survive outcome without claiming realization',async()=>{
 sql(`insert into d5o_work_commitments(workspace_id,work_id,commitment_type,label,source_reference,owner_profile_id,metric,unit,currency,baseline,target,provenance) values(${q(f.workspace)},${q(p.work)},'financial','Synthetic contract release','synthetic-commercial-authorization',${q(f.actors.preparer.profile)},'contract_value','USD','USD',0,100000,${j({synthetic:true,source:'excluded-upstream-financial-fixture'})});`);
 await decide(c,f,p.work,'verify-quality');await decide(c,f,p.work,'accept-turnover');
 const outcomes=JSON.parse(sql(`select jsonb_agg(result) from d5o_work_outcomes where work_id=${q(p.work)};`));assert(outcomes.length>0);
 for(const outcome of outcomes){assert.equal(outcome.valueRealized,false);assert.deepEqual([...new Set(outcome.commitments.map(x=>x.commitment_type))].sort(),['financial','value']);assert(outcome.commitments.every(x=>x.source_reference&&x.owner_profile_id));}
 });
 save('ACCEPTANCE-EDGES-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save('ACCEPTANCE-EDGES-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}
