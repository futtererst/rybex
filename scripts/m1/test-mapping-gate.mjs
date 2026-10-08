import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {context,sql,q,j,save,loadWork} from './implementation-context.mjs';import {prepare,decide} from './proof-fixtures.mjs';
const plan=JSON.parse(readFileSync(process.argv[2])),c=await context(),[a,b]=plan.scenarios,results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-'),restore=[],memberships=[];
try{
 const originalName=sql(`select name from organizations where id=${q(plan.organization)};`);restore.push(`update organizations set name=${q(originalName)} where id=${q(plan.organization)};`);sql(`update organizations set name='Neutral synthetic organization' where id=${q(plan.organization)};`);
 sql(`begin;update config_tenants set workspace_id=case when id=${q(a.tenant)} then ${q(b.workspace)}::uuid else ${q(a.workspace)}::uuid end where id in (${q(a.tenant)},${q(b.tenant)});commit;`);
 for(const [source,target] of [[a,b],[b,a]]){
 const actors={};for(const [key,actor] of Object.entries(source.actors)){
 const profile=JSON.parse(sql(`select to_jsonb(x) from user_profiles x where id=${q(actor.profile)};`));restore.push(`update user_profiles set active_workspace_id=${q(profile.active_workspace_id)} where id=${q(actor.profile)};`);
 const row=JSON.parse(sql(`select to_jsonb(x) from workspace_memberships x where id=${q(actor.membership)};`));row.id=randomUUID();row.workspace_id=target.workspace;memberships.push(row.id);sql(`insert into workspace_memberships select * from jsonb_populate_record(null::workspace_memberships,${j(row)});update user_profiles set active_workspace_id=${q(target.workspace)} where id=${q(actor.profile)};`);actors[key]={...actor,membership:row.id};
 }
 const f={...source,workspace:target.workspace,actors},p=await prepare(c,f);for(const right of f.pack.rights.filter(x=>!x.key.startsWith('hold')&&!x.approvalRule.exceptionRuleKey))await decide(c,f,p.work,right.key);
 const w=await loadWork(p.owner,f,p.work);assert.equal(w.work.workspace_id,target.workspace);assert.equal(w.work.configuration_version_id,source.version);assert.equal(w.work.lifecycle_state,f.pack.workType.lifecycle.completeState);assert(w.decisions.every(x=>x.workspace_id===target.workspace));results.push({name:source.name+' full gate executes in '+target.name+' workspace with neutral organization label',status:'PASS',work:p.work,decisions:w.decisions.length});
 }
 save('MAPPING-GATE-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save('MAPPING-GATE-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}finally{
 sql(`begin;update config_tenants set workspace_id=case when id=${q(a.tenant)} then ${q(a.workspace)}::uuid else ${q(b.workspace)}::uuid end where id in (${q(a.tenant)},${q(b.tenant)});${restore.join('')} ${memberships.length?`update workspace_memberships set status='suspended' where id in (${memberships.map(q).join(',')});`:''}commit;`);
}
