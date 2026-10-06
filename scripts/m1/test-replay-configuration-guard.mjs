import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {context,sql,q,j,save,rpc,createWork} from './implementation-context.mjs';import {cloneConfiguration,restoreDefault} from './configuration-variants.mjs';
const plan=JSON.parse(readFileSync(process.argv[2])),f=plan.scenarios[0],other=plan.scenarios[1],c=await context(),actor=await c.login(f.actors.preparer.email),tag=new Date().toISOString().replaceAll(/[:.]/g,'-'),results=[];
const createId=randomUUID(),createPayload={title:'Configuration replay boundary',workTypeKey:f.pack.workType.key,gateKey:f.pack.gate.key,configurationVersionId:f.version},created=await rpc(actor,'d5o_create_work_record_v1',{p_workspace_id:f.workspace,p_command_id:createId,p_payload:createPayload});
const executeId=randomUUID(),payload={title:'Cached metadata command'},args={p_workspace_id:f.workspace,p_work_id:created.workId,p_expected_version:1,p_proof_revision:null,p_command_id:executeId,p_kind:'metadata',p_payload:payload},executed=await rpc(actor,'d5o_execute_work_command_v1',args),second=await createWork(actor,f,'Other retry target');
const tables=['d5o_work_records','d5o_work_sources','d5o_work_relations','d5o_work_participants','d5o_work_facts','d5o_proof_packages','d5o_proof_items','d5o_work_decisions','d5o_work_commitments','d5o_work_outcomes','command_idempotency','audit_events','domain_events'];
const snapshot=`jsonb_build_object(${tables.map(t=>`${q(t)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from ${t} t)`).join(',')})`;
const calls={create:(p=createPayload,ws=f.workspace)=>`public.d5o_create_work_record_v1(${q(ws)},${q(createId)},${j(p)})`,execute:(p=payload,work=created.workId,ws=f.workspace)=>`public.d5o_execute_work_command_v1(${q(ws)},${q(work)},1,null,${q(executeId)},'metadata',${j(p)})`};
function probe(name,kind,setup='',expected=null,expression=calls[kind](),who=f.actors.preparer.id){
 const text=sql(`begin;${setup}select set_config('m1.before',(${snapshot})::text,true) is not null;set local role authenticated;set local request.jwt.claim.sub=${q(who)};set local request.jwt.claim.role='authenticated';do $probe$ declare answer jsonb; caught text;begin begin answer:=${expression};exception when others then caught:=SQLERRM;end;perform set_config('m1.answer',jsonb_build_object('answer',answer,'error',caught)::text,true);end $probe$;reset role;select jsonb_build_object('result',current_setting('m1.answer')::jsonb,'unchanged',current_setting('m1.before')::jsonb=${snapshot});rollback;`);
 const actual=JSON.parse(text.split('\n').at(-1));assert.equal(actual.result.error,expected,name);assert.equal(actual.unchanged,true,name+' new effects');if(expected===null){assert.equal(actual.result.answer.replayed,true);assert.deepEqual(actual.result.answer,{...(kind==='create'?created:executed),replayed:true});}results.push({name:kind+' '+name,status:'PASS',expected:expected??'original result replayed',noNewAuthoritativeEffects:true,setupRolledBack:true});
}
try{
 for(const kind of ['create','execute']){
  probe('identical retry',kind);
  probe('zero mappings',kind,`update config_tenants set status='archived' where id=${q(f.tenant)};`,'no_tenant_mapping');
  probe('multiple mappings',kind,`insert into config_tenants(tenant_key,name,organization_id,workspace_id,status) values(${q(randomUUID())},'Synthetic ambiguity',${q(plan.organization)},${q(f.workspace)},'active');`,'ambiguous_tenant_mapping');
  probe('withdrawn pin',kind,`update config_configuration_versions set status='draft' where id=${q(f.version)};`,'configuration_unavailable');
  // A deleted version cannot coexist with its FK-bound work. A missing gate is reachable without disabling integrity controls.
  probe('unavailable pinned gate',kind,`update config_gate_definitions set status='archived' where id=${q(f.gate)};`,'incompatible_work_type');
  probe('wrong tenant lineage',kind,`update config_tenants set status='archived' where id=${q(f.tenant)};update config_tenants set workspace_id=${q(f.workspace)} where id=${q(other.tenant)};`,'invalid_configuration_lineage');
  probe('invalid configuration lineage',kind,`update config_tenant_configurations set status='archived' where id=${q(f.configuration)};`,'invalid_configuration_lineage');
  probe('tampered pinned content',kind,`update config_gate_definitions set purpose='tampered retry configuration' where id=${q(f.gate)};`,'pinned_configuration_changed');
  probe('revoked membership',kind,`update workspace_memberships set status='suspended' where id=${q(f.actors.preparer.membership)};`,'forbidden');
  probe('changed actor',kind,'','idempotency_mismatch',calls[kind](),f.actors[Object.keys(f.actors).find(k=>k!=='preparer'&&f.actors[k].workspaceRole!=='read_only_auditor')].id);
  probe('changed payload',kind,'','idempotency_mismatch',calls[kind](kind==='create'?{...createPayload,title:'Changed request'}:{title:'Changed request'}));
  probe('wrong workspace target',kind,'','forbidden',kind==='create'?calls.create(createPayload,other.workspace):calls.execute(payload,created.workId,other.workspace));
 }
 for(const kind of ['create','execute'])probe('missing cached record',kind,`delete from d5o_work_records where id=${q(created.workId)};`,'forbidden');
 probe('changed record target','execute','','idempotency_mismatch',calls.execute(payload,second.workId));
 const before=sql(`select ${snapshot};`);const variant=cloneConfiguration(f);
 try{for(const kind of ['create','execute'])probe('valid original pin after newer published default',kind);assert.equal(sql(`select ${snapshot};`),before);}finally{restoreDefault(f);}
 // Referential integrity itself prevents a missing pinned version or gate: no trigger/FK bypass is permitted.
 for(const [name,statement] of [['missing pinned version',`delete from config_configuration_versions where id=${q(f.version)}`],['missing pinned gate',`delete from config_gate_definitions where id=${q(f.gate)}`]]){
  assert.throws(()=>sql(`begin;${statement};rollback;`),/foreign key|immutable|cannot delete/i,name);results.push({name,status:'PASS',proof:'Database integrity rejects deletion; no nonexistent state fabricated'});
 }
 save('REPLAY-CONFIGURATION-GUARD-'+tag+'.json',{status:'PASS',results,work:created.workId,scope:'Both public RPCs, genuine authenticated context; rolled-back adversarial setup; whole authoritative table hashes before/after each retry'});console.log(JSON.stringify({status:'PASS',pass:results.length}));
}catch(e){save('REPLAY-CONFIGURATION-GUARD-'+tag+'.json',{status:'FAIL',results,error:e.message,work:created.workId});console.error(e.message);process.exitCode=1;}
