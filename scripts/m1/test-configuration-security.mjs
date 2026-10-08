import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {context,sql,q,j,save,createWork,loadWork,command,rpc} from "./implementation-context.mjs";
import {prepare} from "./proof-fixtures.mjs";
const plan=JSON.parse(readFileSync(process.argv[2])),f=plan.scenarios[0],other=plan.scenarios[1],c=await context(),p=await prepare(c,f);
const results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,"-");
const version=(await loadWork(p.owner,f,p.work)).work.record_version;
const payload={title:"Resolver probe",workTypeKey:f.pack.workType.key,gateKey:f.pack.gate.key,configurationVersionId:f.version};
const create=(extra={})=>`public.d5o_create_work_record_v1(${q(f.workspace)},${q(randomUUID())},${j({...payload,...extra})})`;
const mutate=()=>`public.d5o_execute_work_command_v1(${q(f.workspace)},${q(p.work)},${version},1,${q(randomUUID())},'metadata','{"title":"Resolver probe"}')`;
function auth(id=f.actors.preparer.id){return `set local role authenticated;set local request.jwt.claim.sub=${q(id)};set local request.jwt.claim.role='authenticated';`;}
function probe(name,setup,expression,error){
 const response=sql(`begin;${setup}${auth()}do $probe$ declare caught text;begin begin perform ${expression};exception when others then caught:=SQLERRM;end;if caught is distinct from ${q(error)} then raise exception 'unexpected result: %',coalesce(caught,'SUCCESS');end if;end $probe$;rollback;`);
 assert.equal(response,"");results.push({name,status:"PASS",expected:error,setupRolledBack:true});
}
try{
 for(const [label,expression] of [["creation",create()],["command",mutate()]]){
  probe(`zero mappings deny ${label}`,`update config_tenants set status='archived' where id=${q(f.tenant)};`,expression,"no_tenant_mapping");
  probe(`multiple mappings deny ${label}`,`insert into config_tenants(tenant_key,name,organization_id,workspace_id,status) values(${q(randomUUID())},'Ambiguity probe',${q(plan.organization)},${q(f.workspace)},'active');`,expression,"ambiguous_tenant_mapping");
  probe(`withdrawn version denies ${label}`,`update config_configuration_versions set status='draft' where id=${q(f.version)};`,expression,"configuration_unavailable");
 }
 probe("missing default version denies creation",`update config_tenants set active_configuration_version_id=null where id=${q(f.tenant)};`,create(),"configuration_unavailable");
 probe("future default version denies creation",`update config_configuration_versions set effective_from=now()+interval '1 day' where id=${q(f.version)};`,create(),"configuration_unavailable");
 probe("incompatible Work Type denies creation","",create({workTypeKey:"unknown"}),"incompatible_work_type");
 probe("caller cannot silently bind another version","",create({configurationVersionId:other.version}),"configuration_mismatch");
 probe("mapping to another tenant cannot redirect pinned work",`update config_tenants set status='archived' where id=${q(f.tenant)};update config_tenants set workspace_id=${q(f.workspace)} where id=${q(other.tenant)};`,mutate(),"invalid_configuration_lineage");
 probe("changed pinned rule content fails closed",`update config_gate_definitions set purpose='tampered' where id=${q(f.gate)};`,mutate(),"pinned_configuration_changed");
 probe("unsupported rule cannot be interpreted permissively",`update config_gate_definitions set entry_rule_json='{"op":"allow_everything"}' where id=${q(f.gate)};`,create(),"unknown_rule_operator");
 const id=randomUUID(),w=await loadWork(p.owner,f,p.work),args={p_workspace_id:f.workspace,p_work_id:p.work,p_expected_version:w.work.record_version,p_proof_revision:1,p_command_id:id,p_kind:"metadata",p_payload:{title:"Replay revocation probe"}};
 await rpc(p.owner,"d5o_execute_work_command_v1",args);
 const response=sql(`begin;update workspace_memberships set status='suspended' where id=${q(f.actors.preparer.membership)};${auth()}do $probe$ declare caught text;begin begin perform public.d5o_execute_work_command_v1(${q(f.workspace)},${q(p.work)},${w.work.record_version},1,${q(id)},'metadata',${j(args.p_payload)});exception when others then caught:=SQLERRM;end;if caught is distinct from 'forbidden' then raise exception 'unexpected result: %',coalesce(caught,'SUCCESS');end if;end $probe$;rollback;`);assert.equal(response,"");results.push({name:"revoked membership denies cached command replay",status:"PASS"});
 const next=await loadWork(p.owner,f,p.work);assert.equal(next.work.title,"Replay revocation probe");
 for(const type of ["derived_from","repeat_of","follows_from"]){const relation={workId:p.work,type,rationale:{scope:"independent",authorization:"independent",ownership:"shared",commercial:"shared",readiness:"independent",execution:"independent",acceptance:"independent",outcome:"independent"}};const made=await createWork(p.owner,f,type,{relation});assert.notEqual(made.workId,p.work);results.push({name:type+" preserves typed independent lineage",status:"PASS"});}
 await assert.rejects(()=>command(p.owner,f,p.work,"decide",{rightKey:"accept-turnover",reason:"Unassigned operations leader"}),/wrong_authority/);results.push({name:"operations leader has no unassigned authority shortcut",status:"PASS"});
 save(`CONFIGURATION-SECURITY-${tag}.json`,{status:"PASS",results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save(`CONFIGURATION-SECURITY-${tag}.json`,{status:"FAIL",error:e.message,results});console.error(JSON.stringify({error:e.message,passed:results.length}));process.exitCode=1;}
