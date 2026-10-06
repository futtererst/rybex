import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {context,sql,q,save,hash,createWork,loadWork,command} from './implementation-context.mjs';
import {prepare,decide} from './proof-fixtures.mjs';
import {cloneConfiguration,restoreDefault} from './configuration-variants.mjs';
const plan=JSON.parse(readFileSync(process.argv[2])),c=await context(),results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
const definitions=()=>sql("select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='rybex_internal' and p.proname like 'd5o_m1_%') or (n.nspname='public' and p.proname in ('d5o_create_work_record_v1','d5o_execute_work_command_v1','d5o_load_work_record_v1'));");
const before=definitions();
const replace=(x,a,b)=>typeof x==='string'?(x===a?b:x):Array.isArray(x)?x.map(v=>replace(v,a,b)):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,replace(v,a,b)])):x;
async function finish(f,p){for(const r of f.pack.rights.filter(r=>!r.key.startsWith('hold')&&!r.approvalRule.exceptionRuleKey))await decide(c,f,p.work,r.key);return loadWork(p.owner,f,p.work);}
try{
 for(const f of plan.scenarios){try{
  const key=f.pack.evidence[0].key,newKey='alternate-'+key;
  const changed=cloneConfiguration(f,row=>replace(row,key,newKey));changed.pack=replace(f.pack,key,newKey);
  const p=await prepare(c,changed,{submit:false});await assert.rejects(()=>command(p.owner,changed,p.work,'add_evidence',{requirementKey:key,evidenceId:p.objects[0].id,evidenceVersion:p.objects[0].version}),/unknown_evidence_requirement/);await command(p.owner,changed,p.work,'submit_proof');await finish(changed,p);results.push({name:f.name+' evidence requirement comes from configuration',status:'PASS'});
  const state='configured-completion';const lifecycle=cloneConfiguration(f,(row,table)=>table==='config_work_item_type_definitions'?{...row,lifecycle_json:{...row.lifecycle_json,completeState:state}}:table==='config_gate_decision_outcomes'&&row.consequence_json.final?{...row,consequence_json:{...row.consequence_json,state}}:row);
  const lp=await prepare(c,lifecycle);const completed=await finish(lifecycle,lp);assert.equal(completed.work.lifecycle_state,state);results.push({name:f.name+' final lifecycle and outcome follow configuration',status:'PASS'});
 }finally{restoreDefault(f);}}
 const f=plan.scenarios[0];try{
  const variant=cloneConfiguration(f,(row,table)=>table==='config_role_definitions'&&row.role_key==='quality_verifier'?{...row,eligibility_rule_json:{workspaceRoles:['operations_leader']}}:row);
  const p=await prepare(c,variant);await assert.rejects(()=>decide(c,variant,p.work,'verify-quality'),/wrong_authority/);
  const prior=sql(`select role from workspace_memberships where id=${q(f.actors.quality_verifier.membership)};`);
  try{sql(`update workspace_memberships set role='operations_leader' where id=${q(f.actors.quality_verifier.membership)};`);await decide(c,variant,p.work,'verify-quality');const snapshot=(await loadWork(p.owner,variant,p.work)).decisions;sql(`update workspace_memberships set role=${q(prior)} where id=${q(f.actors.quality_verifier.membership)};`);assert.deepEqual((await loadWork(p.owner,variant,p.work)).decisions,snapshot);results.push({name:'configured eligibility changes authority; later role change preserves historical decision',status:'PASS'});}finally{sql(`update workspace_memberships set role=${q(prior)} where id=${q(f.actors.quality_verifier.membership)};`);}
  const disabled=cloneConfiguration(f,(row,table)=>table==='config_exception_rules'?{...row,status:'inactive'}:row);const failed=await prepare(c,disabled,{failed:true});await assert.rejects(()=>decide(c,disabled,failed.work,'authorize-exception',{scopeKey:'package',expiresAt:new Date(Date.now()+3600000).toISOString()}),/exception_not_permitted/);await assert.rejects(()=>decide(c,disabled,failed.work,'verify-quality'),/readiness_blocked/);results.push({name:'configuration can prohibit exception; nonwaivable failure remains blocked',status:'PASS'});
 }finally{restoreDefault(f);}
 const [a,b]=plan.scenarios;
 try{
  sql(`begin;update config_tenants set workspace_id=case when id=${q(a.tenant)} then ${q(b.workspace)}::uuid else ${q(a.workspace)}::uuid end where id in (${q(a.tenant)},${q(b.tenant)});commit;`);
  for(const [target,source] of [[a,b],[b,a]]){const actor=await c.login(target.actors.preparer.email),mapped={...source,workspace:target.workspace};const created=await createWork(actor,mapped,'Mapped configuration');const loaded=await loadWork(actor,mapped,created.workId);assert.equal(loaded.work.configuration_version_id,source.version);assert.equal(loaded.work.lifecycle_state,source.pack.workType.lifecycle.initialState);results.push({name:target.name+' workspace resolves swapped '+source.name+' configuration',status:'PASS'});}
 }finally{sql(`begin;update config_tenants set workspace_id=case when id=${q(a.tenant)} then ${q(a.workspace)}::uuid else ${q(b.workspace)}::uuid end where id in (${q(a.tenant)},${q(b.tenant)});commit;`);}
 assert.equal(definitions(),before);results.push({name:'all variants execute identical engine definitions',status:'PASS',sha256:hash(Buffer.from(before))});save('ADVERSARIAL-INVARIANCE-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save('ADVERSARIAL-INVARIANCE-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}
