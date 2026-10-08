import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult={data:unknown;error:{message:string}|null};
export type D4PackagePayload={scopeSummary:string;siteZone:string;
  methodReference:string;hazardNotes:string;permitNotes:string;
  materialNotes:string;testInstructions:string;holdPoints:string;
  contingency:string;plannedStart:string;plannedEnd:string};
export type D4Package={id:string;code:string;revision:number;jobRevision:number;
  state:"draft";payload:D4PackagePayload;updatedAt:string};
export type D4PackageList={status:"ok";workId:string;items:D4Package[];canEdit:boolean}|
  {status:"denied"|"invalid"|"unavailable"};
export type D4PackageSave={status:"saved";packageId:string;revision:number;
  replayed:boolean}|{status:"denied"|"invalid"|"conflict"|"stale"|
    "unavailable"};
function validPayload(x:unknown):x is D4PackagePayload{
  if(!x||typeof x!=="object"||Array.isArray(x))return false;
  const p=x as D4PackagePayload;
  return [p.scopeSummary,p.siteZone,p.methodReference,p.hazardNotes,
    p.permitNotes,p.materialNotes,p.testInstructions,p.holdPoints,
    p.contingency,p.plannedStart,p.plannedEnd]
    .every(v=>typeof v==="string"&&v.length<=4000)
    &&p.scopeSummary.trim().length>=20&&p.siteZone.trim().length>=2
    &&Number.isFinite(Date.parse(p.plannedStart))
    &&Number.isFinite(Date.parse(p.plannedEnd));
}
function validPackage(x:unknown):x is D4Package{
  if(!x||typeof x!=="object")return false;
  const p=x as D4Package;
  return uuid.test(p.id)&&typeof p.code==="string"
    &&Number.isInteger(p.revision)&&Number.isInteger(p.jobRevision)
    &&p.state==="draft"&&validPayload(p.payload)
    &&typeof p.updatedAt==="string";
}
async function scoped(workspaceId:string){
  const context=await getRequestContext();
  return context.authenticated&&context.status==="authorized"
    &&context.workspace?.id===workspaceId;
}
async function rpc(name:string,args:Record<string,unknown>):Promise<RpcResult>{
  const client=await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as
    (name:string,args:Record<string,unknown>)=>Promise<RpcResult>)(name,args);
}
export async function listD4PackageDrafts(workspaceId:string,workId:string):
  Promise<D4PackageList>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(workspaceId)||!uuid.test(workId))return{status:"invalid"};
  if(!await scoped(workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_list_package_drafts_v1",
      {p_workspace_id:workspaceId,p_work_id:workId});
    if(error)return /forbidden|permission_denied|verification_required/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    const r=data as {workId?:unknown;items?:unknown;canEdit?:unknown}|null;
    return r?.workId===workId&&Array.isArray(r.items)&&r.items.length<=100
      &&r.items.every(validPackage)&&typeof r.canEdit==="boolean"
      ?{status:"ok",workId,items:r.items,canEdit:r.canEdit}
      :{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function saveD4PackageDraft(input:{workspaceId:string;workId:string;
  packageId:string|null;expectedRevision:number;expectedJobRevision:number;
  commandId:string;payload:D4PackagePayload}):Promise<D4PackageSave>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.workId)
    ||(input.packageId!==null&&!uuid.test(input.packageId))
    ||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0
    ||!Number.isInteger(input.expectedJobRevision)||input.expectedJobRevision<1
    ||input.commandId.length<8||input.commandId.length>200
    ||!validPayload(input.payload))return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_save_package_draft_v1",{
      p_workspace_id:input.workspaceId,p_work_id:input.workId,
      p_package_id:input.packageId,p_expected_revision:input.expectedRevision,
      p_expected_job_revision:input.expectedJobRevision,
      p_command_id:input.commandId,p_payload:input.payload});
    if(error){
      if(/permission_denied|forbidden|verification_required/.test(error.message))
        return{status:"denied"};
      if(/d4_package_job_stale/.test(error.message))return{status:"stale"};
      if(/d4_package_conflict|idempotency_mismatch|command_in_progress/.test(error.message))
        return{status:"conflict"};
      if(/invalid_d4|d4_package_scope_invalid|d4_package_window_outside_job/.test(error.message))
        return{status:"invalid"};
      return{status:"unavailable"};
    }
    const r=data as {success?:unknown;workId?:unknown;packageId?:unknown;
      revision?:unknown;state?:unknown;auditId?:unknown;eventId?:unknown;
      releaseEligible?:unknown;replayed?:unknown}|null;
    return r?.success===true&&r.workId===input.workId
      &&typeof r.packageId==="string"&&uuid.test(r.packageId)
      &&Number.isInteger(r.revision)&&r.state==="draft"
      &&typeof r.auditId==="string"&&uuid.test(r.auditId)
      &&typeof r.eventId==="string"&&uuid.test(r.eventId)
      &&r.releaseEligible===false
      ?{status:"saved",packageId:r.packageId,revision:r.revision as number,
        replayed:r.replayed===true}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
