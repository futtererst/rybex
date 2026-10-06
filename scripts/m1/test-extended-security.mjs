import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {context,sql,q,j,save,loadWork,command,createWork} from './implementation-context.mjs';
import {prepare} from './proof-fixtures.mjs';
const c=await context(),plan=JSON.parse(readFileSync(process.argv[2])),f=plan.scenarios[0],p=await prepare(c,f),results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
const initial=await loadWork(p.owner,f,p.work),v=initial.work.record_version;
const auth=id=>`set local role authenticated;set local request.jwt.claim.sub=${q(id)};set local request.jwt.claim.role='authenticated';`;
function probe(name,setup,payload,error,actor=f.actors.quality_verifier.id){const expression=`public.d5o_execute_work_command_v1(${q(f.workspace)},${q(p.work)},(select_version),1,${q(randomUUID())},'decide',${j(payload)})`;const out=sql(`begin;${setup}select set_config('m1.test.version',(select record_version::text from d5o_work_records where id=${q(p.work)}),true);${auth(actor)}do $p$ declare caught text;begin begin perform ${expression.replace('(select_version)',"current_setting('m1.test.version')::integer")};exception when others then caught:=SQLERRM;end;if caught is distinct from ${q(error)} then raise exception 'unexpected: %',coalesce(caught,'SUCCESS');end if;end $p$;rollback;`);assert(Number(out)>0);results.push({name,status:'PASS',expected:error,transactionRolledBack:true});}
try{
 const decision={rightKey:'verify-quality',reason:'Negative guard test'};
 probe('suspended actor profile denied',`update user_profiles set status='suspended' where id=${q(f.actors.quality_verifier.profile)};`,decision,'forbidden');
 probe('forged actor payload rejected','',{...decision,actorId:f.actors.preparer.id},'invalid_command');
 probe('client readiness attestation cannot bypass server contract','',{...decision,readiness:true},'invalid_command');
 probe('failed scan evidence cannot be consumed',`update evidence_objects set scan_status='failed' where id=${q(p.objects[0].id)};`,decision,'invalid_evidence');
 probe('revoked evidence verification cannot be consumed',`update evidence_objects set verification_status='rejected' where id=${q(p.objects[0].id)};`,decision,'invalid_evidence');
 probe('changed evidence version cannot be consumed',`update evidence_objects set version=version+1 where id=${q(p.objects[0].id)};`,decision,'invalid_evidence');
 probe('unscanned evidence cannot be consumed',`update evidence_objects set scan_status='not_configured' where id=${q(p.objects[0].id)};`,decision,'invalid_evidence');
 probe('preparer cannot self-review despite eligible assignment',`update workspace_memberships set role='project_manager' where id=${q(f.actors.preparer.membership)};insert into d5o_work_participants(workspace_id,work_id,configuration_version_id,profile_id,role_key,assigned_by) values(${q(f.workspace)},${q(p.work)},${q(f.version)},${q(f.actors.preparer.profile)},'quality_verifier',${q(f.actors.preparer.id)});`,decision,'separation_of_duty',f.actors.preparer.id);
 const falseRationale={scope:'shared',authorization:'independent',ownership:'shared',commercial:'shared',readiness:'independent',execution:'independent',acceptance:'independent',outcome:'independent'};
 await assert.rejects(()=>createWork(p.owner,f,'Ambiguous new identity',{relation:{workId:p.work,type:'derived_from',rationale:falseRationale}}),/independent_obligation_required/);results.push({name:'new identity requires independent scope',status:'PASS'});
 const foreignOwner=await c.login(plan.scenarios[1].actors.preparer.email);const foreign=await createWork(foreignOwner,plan.scenarios[1]);await assert.rejects(()=>command(p.owner,f,p.work,'relate',{workId:foreign.workId,type:'derived_from',rationale:{...falseRationale,scope:'independent'}}),/foreign key|cross_workspace/);results.push({name:'cross-workspace lineage denied',status:'PASS'});
 for(const role of [c.anon,p.owner])for(const table of ['d5o_work_records','d5o_proof_packages','d5o_work_decisions','d5o_work_outcomes']){const z=await role.from(table).select('*').limit(1);assert(z.error);}results.push({name:'anon and authenticated direct authoritative reads denied',status:'PASS'});
 assert.equal((await loadWork(p.owner,f,p.work)).work.record_version,v);save('EXTENDED-SECURITY-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save('EXTENDED-SECURITY-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}
