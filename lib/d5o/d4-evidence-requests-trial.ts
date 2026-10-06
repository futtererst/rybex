import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { evidenceDisciplines,type EvidenceDiscipline,type D4EvidenceRequest,
  type D4EvidenceList,type D4EvidenceSave } from "./d4-evidence-request-contract";
export type { EvidenceDiscipline,D4EvidenceRequest,D4EvidenceList,D4EvidenceSave }
  from "./d4-evidence-request-contract";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult={data:unknown;error:{message:string}|null};
async function rpc(name:string,args:Record<string,unknown>):Promise<RpcResult>{
  const client=await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as
    (name:string,args:Record<string,unknown>)=>Promise<RpcResult>)(name,args);
}
async function scoped(workspaceId:string){
  const context=await getRequestContext();
  return context.authenticated&&context.status==="authorized"
    &&context.workspace?.id===workspaceId;
}
function validRequest(x:unknown):x is D4EvidenceRequest{
  if(!x||typeof x!=="object")return false;
  const r=x as D4EvidenceRequest;
  return uuid.test(r.id)&&evidenceDisciplines.includes(r.discipline)
    &&typeof r.title==="string"&&typeof r.acceptanceCriterion==="string"
    &&Number.isInteger(r.packageRevision)&&Number.isInteger(r.jobRevision)
    &&uuid.test(r.requestedBy)&&typeof r.requestedAt==="string"
    &&(r.status==="evidence_needed"||r.status==="historical");
}
export async function listD4EvidenceRequests(input:{workspaceId:string;packageId:string}):
  Promise<D4EvidenceList>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.packageId))return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_list_evidence_requests_v1",{
      p_workspace_id:input.workspaceId,p_package_id:input.packageId});
    if(error)return /permission_denied|forbidden|verification_required/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    const r=data as {packageId?:unknown;currentRevision?:unknown;
      canRequest?:unknown;items?:unknown}|null;
    return r?.packageId===input.packageId&&Number.isInteger(r.currentRevision)
      &&typeof r.canRequest==="boolean"&&Array.isArray(r.items)
      &&r.items.length<=200&&r.items.every(validRequest)
      ?{status:"ok",packageId:input.packageId,
        currentRevision:r.currentRevision as number,canRequest:r.canRequest,
        items:r.items}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function recordD4EvidenceRequest(input:{workspaceId:string;packageId:string;
  expectedRevision:number;expectedJobRevision:number;discipline:EvidenceDiscipline;
  title:string;acceptanceCriterion:string;commandId:string}):Promise<D4EvidenceSave>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.packageId)
    ||!Number.isInteger(input.expectedRevision)||input.expectedRevision<1
    ||!Number.isInteger(input.expectedJobRevision)||input.expectedJobRevision<1
    ||!evidenceDisciplines.includes(input.discipline)
    ||input.title.trim().length<8||input.title.trim().length>160
    ||input.acceptanceCriterion.trim().length<20
    ||input.acceptanceCriterion.trim().length>1000
    ||input.commandId.length<8||input.commandId.length>200)
    return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_record_evidence_request_v1",{
      p_workspace_id:input.workspaceId,p_package_id:input.packageId,
      p_expected_revision:input.expectedRevision,
      p_expected_job_revision:input.expectedJobRevision,
      p_discipline:input.discipline,p_title:input.title,
      p_acceptance_criterion:input.acceptanceCriterion,
      p_command_id:input.commandId});
    if(error){
      if(/permission_denied|forbidden|verification_required/.test(error.message))
        return{status:"denied"};
      if(/d4_evidence_request_stale/.test(error.message))return{status:"stale"};
      if(/idempotency_mismatch|command_in_progress/.test(error.message))
        return{status:"conflict"};
      if(/invalid_d4_evidence_request|scope_invalid/.test(error.message))
        return{status:"invalid"};
      return{status:"unavailable"};
    }
    const r=data as {success?:unknown;requestId?:unknown;
      packageId?:unknown;packageRevision?:unknown;status?:unknown;
      auditId?:unknown;eventId?:unknown;releaseEligible?:unknown;
      replayed?:unknown}|null;
    return r?.success===true&&typeof r.requestId==="string"&&uuid.test(r.requestId)&&
      r.packageId===input.packageId&&r.packageRevision===input.expectedRevision
      &&r.status==="evidence_needed"&&typeof r.auditId==="string"
      &&uuid.test(r.auditId)&&typeof r.eventId==="string"
      &&uuid.test(r.eventId)&&r.releaseEligible===false
      ?{status:"recorded",requestId:r.requestId as string,
        replayed:r.replayed===true}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
