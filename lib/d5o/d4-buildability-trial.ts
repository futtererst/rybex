import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import type { D4PackagePayload } from "@/lib/d5o/d4-package-trial";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult={data:unknown;error:{message:string}|null};
export type D4FieldReview={submissionId:string;packageId:string;
  packageRevision:number;jobRevision:number;payloadDigest:string;
  submittedBy:string;submittedAt:string;disposition:"reviewed"|"returned"|null;
  reason:string|null;respondedBy:string|null;respondedAt:string|null;
  currentPackageRevision:number;currentJobRevision:number;
  frozenPayload:D4PackagePayload};
export type D4FieldList={status:"ok";workId:string;items:D4FieldReview[];
  canSubmit:boolean;canRespond:boolean}|
  {status:"denied"|"invalid"|"unavailable"};
export type D4FieldWrite={status:"submitted"|"responded";submissionId:string;
  disposition?:"reviewed"|"returned";replayed:boolean}|
  {status:"denied"|"invalid"|"stale"|"conflict"|"incomplete"|
    "unavailable"};
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
function validReview(x:unknown):x is D4FieldReview{
  if(!x||typeof x!=="object")return false;
  const r=x as D4FieldReview;
  return uuid.test(r.submissionId)&&uuid.test(r.packageId)
    &&uuid.test(r.submittedBy)&&Number.isInteger(r.packageRevision)
    &&Number.isInteger(r.jobRevision)&&Number.isInteger(r.currentPackageRevision)
    &&Number.isInteger(r.currentJobRevision)
    &&typeof r.payloadDigest==="string"&&/^[0-9a-f]{64}$/.test(r.payloadDigest)
    &&typeof r.submittedAt==="string"
    &&(r.disposition===null||r.disposition==="reviewed"||r.disposition==="returned")
    &&(r.reason===null||typeof r.reason==="string")
    &&(r.respondedBy===null||uuid.test(r.respondedBy))
    &&(r.respondedAt===null||typeof r.respondedAt==="string")
    &&typeof r.frozenPayload?.scopeSummary==="string"
    &&typeof r.frozenPayload?.methodReference==="string"
    &&typeof r.frozenPayload?.hazardNotes==="string";
}
function errorStatus(message:string):D4FieldWrite{
  if(/permission_denied|forbidden|verification_required|self_review_denied/.test(message))
    return{status:"denied"};
  if(/d4_field_stale/.test(message))return{status:"stale"};
  if(/d4_field_brief_incomplete/.test(message))return{status:"incomplete"};
  if(/already_submitted|already_responded|idempotency_mismatch|command_in_progress/.test(message))
    return{status:"conflict"};
  if(/invalid_d4|d4_field_scope_invalid/.test(message))return{status:"invalid"};
  return{status:"unavailable"};
}
export async function listD4FieldReviews(workspaceId:string,workId:string):
  Promise<D4FieldList>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(workspaceId)||!uuid.test(workId))return{status:"invalid"};
  if(!await scoped(workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_list_buildability_v1",{
      p_workspace_id:workspaceId,p_work_id:workId});
    if(error)return /forbidden|permission_denied|verification_required/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    const r=data as {workId?:unknown;items?:unknown;
      canSubmit?:unknown;canRespond?:unknown}|null;
    return r?.workId===workId&&Array.isArray(r.items)&&r.items.length<=200
      &&r.items.every(validReview)&&typeof r.canSubmit==="boolean"
      &&typeof r.canRespond==="boolean"
      ?{status:"ok",workId,items:r.items,canSubmit:r.canSubmit,
        canRespond:r.canRespond}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function submitD4FieldReview(input:{workspaceId:string;workId:string;
  packageId:string;expectedPackageRevision:number;expectedJobRevision:number;
  commandId:string}):Promise<D4FieldWrite>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.workId)
    ||!uuid.test(input.packageId)||!Number.isInteger(input.expectedPackageRevision)
    ||!Number.isInteger(input.expectedJobRevision)
    ||input.commandId.length<8||input.commandId.length>200)return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_submit_buildability_v1",{
      p_workspace_id:input.workspaceId,p_work_id:input.workId,
      p_package_id:input.packageId,
      p_expected_package_revision:input.expectedPackageRevision,
      p_expected_job_revision:input.expectedJobRevision,p_command_id:input.commandId});
    if(error)return errorStatus(error.message);
    const r=data as {success?:unknown;submissionId?:unknown;packageId?:unknown;
      state?:unknown;auditId?:unknown;eventId?:unknown;
      releaseEligible?:unknown;replayed?:unknown}|null;
    return r?.success===true&&r.packageId===input.packageId
      &&typeof r.submissionId==="string"&&uuid.test(r.submissionId)
      &&r.state==="pending"&&r.releaseEligible===false
      &&typeof r.auditId==="string"&&uuid.test(r.auditId)
      &&typeof r.eventId==="string"&&uuid.test(r.eventId)
      ?{status:"submitted",submissionId:r.submissionId,
        replayed:r.replayed===true}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function respondD4FieldReview(input:{workspaceId:string;
  submissionId:string;disposition:"reviewed"|"returned";
  reason:string;commandId:string}):Promise<D4FieldWrite>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.submissionId)
    ||!(["reviewed","returned"] as string[]).includes(input.disposition)
    ||input.reason.trim().length<20||input.reason.trim().length>1000
    ||input.commandId.length<8||input.commandId.length>200)return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_respond_buildability_v1",{
      p_workspace_id:input.workspaceId,p_submission_id:input.submissionId,
      p_disposition:input.disposition,p_reason:input.reason.trim(),
      p_command_id:input.commandId});
    if(error)return errorStatus(error.message);
    const r=data as {success?:unknown;submissionId?:unknown;
      disposition?:unknown;auditId?:unknown;eventId?:unknown;
      releaseEligible?:unknown;replayed?:unknown}|null;
    return r?.success===true&&r.submissionId===input.submissionId
      &&r.disposition===input.disposition&&r.releaseEligible===false
      &&typeof r.auditId==="string"&&uuid.test(r.auditId)
      &&typeof r.eventId==="string"&&uuid.test(r.eventId)
      ?{status:"responded",submissionId:input.submissionId,
        disposition:input.disposition,replayed:r.replayed===true}
      :{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
