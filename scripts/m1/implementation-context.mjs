import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {clients} from "./baseline-correction/fixtures.mjs";
export const root=process.cwd();
export const evidence=resolve("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01");
export const hash=x=>createHash("sha256").update(x).digest("hex");
export const q=x=>x===null?"null":"'"+String(x).replaceAll("'","''")+"'";
export const j=x=>q(JSON.stringify(x))+"::jsonb";
export const manifest=JSON.parse(readFileSync(resolve(evidence,"RUN-MANIFEST.json")));
export function boundary(){
 if(root!==manifest.root||manifest.project!=="rybex-cfg03-q-m1-s1-recovery-20260928")throw Error("wrong_target");
 if(hash(readFileSync(manifest.ownership))!==manifest.ownership_sha256)throw Error("ownership_drift");
 const owner=JSON.parse(readFileSync(manifest.ownership));
 const p=spawnSync("docker",["inspect",...owner.resources.map(x=>x.id)],{encoding:"utf8",windowsHide:true});if(p.status!==0)throw Error("ownership_unavailable");
 for(const a of JSON.parse(p.stdout)){const expected=owner.resources.find(x=>x.id===a.Id);if(!expected||a.Name!==expected.name||a.Config.Labels?.["com.supabase.cli.project"]!==manifest.project||JSON.stringify(a.Mounts)!==JSON.stringify(expected.mounts))throw Error("ownership_drift");}
 return owner.database_container;
}
export function sql(text){const p=spawnSync("docker",["exec","-i",boundary(),"psql","-X","-qAt","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],{input:text,encoding:"utf8",windowsHide:true,maxBuffer:8*1024*1024});if(p.status!==0)throw Error(p.stderr);return p.stdout.trim();}
export function save(name,value){const p=resolve(evidence,name);if(!p.startsWith(evidence+"\\")||existsSync(p))throw Error("evidence_exists_or_outside");writeFileSync(p,JSON.stringify(value,null,2));}
export async function context(){boundary();const c=await clients();if(c.env.NEXT_PUBLIC_SUPABASE_URL!=="http://127.0.0.1:61421")throw Error("wrong_endpoint");return c;}
export async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
export async function createWork(client,fixture,title="Synthetic governed work",extra={}){return rpc(client,"d5o_create_work_record_v1",{p_workspace_id:fixture.workspace,p_command_id:randomUUID(),p_payload:{title,workTypeKey:fixture.pack.workType.key,gateKey:fixture.pack.gate.key,configurationVersionId:fixture.version,...extra}});}
export async function loadWork(client,fixture,id){return rpc(client,"d5o_load_work_record_v1",{p_workspace_id:fixture.workspace,p_work_id:id});}
export async function command(client,fixture,id,kind,payload={},proofRevision=null,expectedVersion=null,commandId=randomUUID()){
 const w=await loadWork(client,fixture,id);return rpc(client,"d5o_execute_work_command_v1",{p_workspace_id:fixture.workspace,p_work_id:id,p_expected_version:expectedVersion??w.work.record_version,p_proof_revision:proofRevision??w.proof?.proof_package_revision??null,p_command_id:commandId,p_kind:kind,p_payload:payload});
}
