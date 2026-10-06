import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult={data:unknown;error:{message:string}|null};
export type RmPlanShift={id:string;workId:string;resourceId:string;
  startsAt:string;endsAt:string;jobRevision:number;resourceRevision:number;
  warnings:string[];ackReason:string|null;plannedAt:string;
  cancelledAt:string|null;cancelReason:string|null;
  currentJobRevision:number;currentResourceRevision:number};
export type RmPlanPreview={workId:string;resourceId:string;
  jobRevision:number;resourceRevision:number;blockers:string[];warnings:string[];
  crewRequired:number;crewCoveringWindow:number;crewAfterPlan:number;
  releaseEligible:false};
export type RmPlanList={status:"ok";items:RmPlanShift[];canPlan:boolean}|
  {status:"denied"|"invalid"|"unavailable"};
export type RmPlanPreviewResult={status:"ok";preview:RmPlanPreview}|
  {status:"denied"|"invalid"|"unavailable"};
export type RmPlanWrite={status:"saved"|"cancelled";shiftId:string;
  replayed:boolean;crewAfterPlan?:number;crewRequired?:number}|
  {status:"denied"|"invalid"|"blocked"|"stale"|"conflict"|
    "warning_ack_required"|"unavailable"};

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
function validPreview(x:unknown):x is RmPlanPreview{
  if(!x||typeof x!=="object")return false;
  const p=x as RmPlanPreview;
  return uuid.test(p.workId)&&uuid.test(p.resourceId)
    &&Number.isInteger(p.jobRevision)&&Number.isInteger(p.resourceRevision)
    &&Array.isArray(p.blockers)&&p.blockers.every(y=>typeof y==="string")
    &&Array.isArray(p.warnings)&&p.warnings.every(y=>typeof y==="string")
    &&Number.isInteger(p.crewRequired)&&Number.isInteger(p.crewCoveringWindow)
    &&Number.isInteger(p.crewAfterPlan)&&p.releaseEligible===false;
}
function validShift(x:unknown):x is RmPlanShift{
  if(!x||typeof x!=="object")return false;
  const s=x as RmPlanShift;
  return uuid.test(s.id)&&uuid.test(s.workId)&&uuid.test(s.resourceId)
    &&[s.startsAt,s.endsAt,s.plannedAt].every(y=>typeof y==="string")
    &&Number.isInteger(s.jobRevision)&&Number.isInteger(s.resourceRevision)
    &&Number.isInteger(s.currentJobRevision)&&Number.isInteger(s.currentResourceRevision)
    &&Array.isArray(s.warnings)&&s.warnings.every(y=>typeof y==="string")
    &&(s.ackReason===null||typeof s.ackReason==="string")
    &&(s.cancelledAt===null||typeof s.cancelledAt==="string")
    &&(s.cancelReason===null||typeof s.cancelReason==="string");
}
function errorStatus(message:string):RmPlanWrite{
  if(/permission_denied|verification_required|forbidden|unauthenticated/.test(message))return{status:"denied"};
  if(/rm_plan_blocked/.test(message))return{status:"blocked"};
  if(/rm_plan_stale/.test(message))return{status:"stale"};
  if(/rm_plan_warning_ack_required/.test(message))return{status:"warning_ack_required"};
  if(/rm_plan_cancel_conflict|idempotency_mismatch|command_in_progress/.test(message))return{status:"conflict"};
  if(/invalid_rm_|rm_plan_scope_invalid/.test(message))return{status:"invalid"};
  return{status:"unavailable"};
}
export async function listRmPlanShifts(workspaceId:string):Promise<RmPlanList>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(workspaceId))return{status:"invalid"};
  if(!await scoped(workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_rm_list_plan_shifts_v1",{p_workspace_id:workspaceId});
    if(error)return /permission_denied|verification_required|forbidden/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    const x=data as {items?:unknown;canPlan?:unknown}|null;
    return Array.isArray(x?.items)&&x.items.length<=1000&&x.items.every(validShift)
      &&typeof x.canPlan==="boolean"
      ?{status:"ok",items:x.items,canPlan:x.canPlan}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function previewRmPlanShift(input:{workspaceId:string;workId:string;
  resourceId:string;startsAt:string;endsAt:string}):Promise<RmPlanPreviewResult>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.workId)||!uuid.test(input.resourceId)
    ||!Number.isFinite(Date.parse(input.startsAt))||!Number.isFinite(Date.parse(input.endsAt)))
    return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_rm_preview_plan_shift_v1",{
      p_workspace_id:input.workspaceId,p_work_id:input.workId,
      p_resource_id:input.resourceId,p_starts_at:input.startsAt,p_ends_at:input.endsAt});
    if(error)return /permission_denied|verification_required|forbidden/.test(error.message)
      ?{status:"denied"}:{status:"invalid"};
    return validPreview(data)&&data.workId===input.workId&&data.resourceId===input.resourceId
      ?{status:"ok",preview:data}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function commitRmPlanShift(input:{workspaceId:string;workId:string;
  resourceId:string;startsAt:string;endsAt:string;expectedJobRevision:number;
  expectedResourceRevision:number;ackReason:string;commandId:string}):Promise<RmPlanWrite>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.workId)||!uuid.test(input.resourceId)
    ||!Number.isFinite(Date.parse(input.startsAt))||!Number.isFinite(Date.parse(input.endsAt))
    ||!Number.isInteger(input.expectedJobRevision)||!Number.isInteger(input.expectedResourceRevision)
    ||input.commandId.length<8||input.commandId.length>200||input.ackReason.length>1000)
    return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_rm_commit_plan_shift_v1",{
      p_workspace_id:input.workspaceId,p_work_id:input.workId,p_resource_id:input.resourceId,
      p_starts_at:input.startsAt,p_ends_at:input.endsAt,
      p_expected_job_revision:input.expectedJobRevision,
      p_expected_resource_revision:input.expectedResourceRevision,
      p_ack_reason:input.ackReason,p_command_id:input.commandId});
    if(error)return errorStatus(error.message);
    const x=data as {success?:unknown;shiftId?:unknown;state?:unknown;workId?:unknown;
      resourceId?:unknown;auditId?:unknown;eventId?:unknown;replayed?:unknown;
      crewAfterPlan?:unknown;crewRequired?:unknown}|null;
    return x?.success===true&&x.state==="tentative"&&x.workId===input.workId
      &&x.resourceId===input.resourceId&&typeof x.shiftId==="string"&&uuid.test(x.shiftId)
      &&typeof x.auditId==="string"&&uuid.test(x.auditId)
      &&typeof x.eventId==="string"&&uuid.test(x.eventId)
      ?{status:"saved",shiftId:x.shiftId,replayed:x.replayed===true,
        crewAfterPlan:Number(x.crewAfterPlan),crewRequired:Number(x.crewRequired)}
      :{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function cancelRmPlanShift(input:{workspaceId:string;shiftId:string;
  reason:string;commandId:string}):Promise<RmPlanWrite>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.shiftId)
    ||input.reason.trim().length<20||input.reason.trim().length>1000
    ||input.commandId.length<8||input.commandId.length>200)return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_rm_cancel_plan_shift_v1",{
      p_workspace_id:input.workspaceId,p_shift_id:input.shiftId,
      p_reason:input.reason.trim(),p_command_id:input.commandId});
    if(error)return errorStatus(error.message);
    const x=data as {success?:unknown;shiftId?:unknown;state?:unknown;
      auditId?:unknown;eventId?:unknown;replayed?:unknown}|null;
    return x?.success===true&&x.shiftId===input.shiftId&&x.state==="cancelled"
      &&typeof x.auditId==="string"&&uuid.test(x.auditId)
      &&typeof x.eventId==="string"&&uuid.test(x.eventId)
      ?{status:"cancelled",shiftId:input.shiftId,replayed:x.replayed===true}
      :{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
