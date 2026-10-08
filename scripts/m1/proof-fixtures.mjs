import {randomUUID} from "node:crypto";
import {receiptArgs,finalizeArgs} from "./baseline-correction/fixtures.mjs";
import {sql,q,j,hash,rpc,createWork,command} from "./implementation-context.mjs";
export function addFact(f,work,key,value,type="verification",actor="performer",steps=[]){const revision=Number(sql(`select coalesce(max(fact_revision),0)+1 from d5o_work_facts where work_id=${q(work)} and fact_key=${q(key)};`));sql(`insert into d5o_work_facts(workspace_id,work_id,fact_key,fact_revision,fact_type,value,scope_key,actor_profile_id,provenance) values(${q(f.workspace)},${q(work)},${q(key)},${revision},${q(type)},${j(value)},'package',${q(f.actors[actor].profile)},${j({source:"excluded-upstream-synthetic-fixture",synthetic:true,steps})});`);}
export async function evidence(c,client,f,work,key,{finalize=true,scan="clean"}={}){
 const bytes=Buffer.from("M1 synthetic evidence "+randomUUID());const intent=await rpc(client,"create_evidence_upload_intent_v1",{p_entity_type:"d5o_work_record",p_entity_id:work,p_project_id:null,p_original_filename:key+".txt",p_mime_type:"text/plain"});if(!intent.success)throw Error(intent.error);
 const item={...intent,bytes,checksum:hash(bytes)};const up=await client.storage.from(item.bucket).upload(item.objectPath,bytes,{contentType:"text/plain"});if(up.error)throw up.error;
 if(finalize){const receipt=await receiptArgs({service:c.service,field:client},item,scan);const r=await c.service.rpc("record_evidence_scan_receipt_v1",{...receipt,p_workspace_id:f.workspace,p_project_id:null});if(r.error)throw r.error;
 const z=await client.rpc("finalize_evidence_upload_v1",{...finalizeArgs(item),p_entity_type:"d5o_work_record",p_entity_id:work,p_relationship_type:key});if(z.error||!z.data?.success)throw Error(z.error?.message??z.data?.error);}
 const row=await c.service.from("evidence_objects").select("id,version,scan_status,upload_status").eq("id",item.evidenceId).single();if(row.error)throw row.error;return row.data;
}
export async function prepare(c,f,{failed=false,omit=[],submit=true}={}){
 const owner=await c.login(f.actors.preparer.email);const made=await createWork(owner,f,"Synthetic "+f.pack.packName);const work=made.workId;
 for(const role of f.pack.roles)sql(`insert into d5o_work_participants(workspace_id,work_id,configuration_version_id,profile_id,role_key,assigned_by) values(${q(f.workspace)},${q(work)},${q(f.version)},${q(f.actors[role.key].profile)},${q(role.key)},${q(f.actors.preparer.id)});`);
 // Scenario selection is confined to explicitly excluded upstream fixture generation.
 const facts=f.name==="rybex"?[["installation_complete",true,"measurement"],["testing_performed",true,"measurement"],["results_recorded",true,"verification"],["certification_result",failed?"failed":"verified_pass","verification"]]:[["assessment_complete",true,"assessment"],["pilot_authorized",true,"authorization","upstream_authority"],["pilot_complete",true,"verification"],["commercial_conditions",true,"commercial_condition","upstream_authority"]];
 for(const [key,value,type,actor] of facts)if(!omit.includes(key))addFact(f,work,key,value,type,actor??"performer",["synthetic upstream operation; not M1 delivery"]);
 const v=f.pack.protectedValue;sql(`insert into d5o_work_commitments(workspace_id,work_id,commitment_type,label,source_reference,owner_profile_id,metric,unit,currency,baseline,target,provenance) values(${q(f.workspace)},${q(work)},'value',${q(v.label)},'synthetic-contract',${q(f.actors.preparer.profile)},${q(v.metric)},${q(v.unit)},${q(v.currency)},${v.baseline},${v.target},${j({synthetic:true,source:"upstream-commercial-fixture"})});`);
 await command(owner,f,work,"new_proof");const objects=[];
 for(const def of f.pack.evidence)if(!omit.includes(def.key)){const object=await evidence(c,owner,f,work,def.key);objects.push(object);await command(owner,f,work,"add_evidence",{requirementKey:def.key,evidenceId:object.id,evidenceVersion:object.version});}
 if(submit)await command(owner,f,work,"submit_proof");return {owner,work,objects};
}
export async function decide(c,f,work,rightKey,extra={}){const r=f.pack.rights.find(x=>x.key===rightKey);const actor=await c.login(f.actors[r.roleKey].email);return command(actor,f,work,"decide",{rightKey,reason:"Synthetic contract proof",...extra});}
