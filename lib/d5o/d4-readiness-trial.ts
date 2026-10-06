import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type D4Readiness={workId:string;workVersion:number;jobRevision:number;
  jobState:string;requiredCrew:number;plannedPeople:number;
  minimumCrewAcrossWindow:number;staleShifts:number;warningShifts:number;
  blockers:string[];releaseEligible:false;releaseAvailable:false};
export type D4ReadinessResult={status:"ok";review:D4Readiness}|
  {status:"denied"|"invalid"|"unavailable"};
function valid(x:unknown):x is D4Readiness{
  if(!x||typeof x!=="object")return false;
  const r=x as D4Readiness;
  return uuid.test(r.workId)&&Number.isInteger(r.workVersion)
    &&Number.isInteger(r.jobRevision)&&typeof r.jobState==="string"
    &&[r.requiredCrew,r.plannedPeople,r.minimumCrewAcrossWindow,
      r.staleShifts,r.warningShifts].every(Number.isInteger)
    &&Array.isArray(r.blockers)&&r.blockers.every(y=>typeof y==="string")
    &&r.releaseEligible===false&&r.releaseAvailable===false;
}
export async function getD4Readiness(input:{workspaceId:string;workId:string}):
  Promise<D4ReadinessResult>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.workId))return{status:"invalid"};
  const context=await getRequestContext();
  if(!context.authenticated||context.status!=="authorized"
    ||context.workspace?.id!==input.workspaceId)return{status:"denied"};
  try{
    const client=await createRybexSupabaseServerClient();
    const rpc=client.rpc.bind(client) as unknown as
      (name:string,args:Record<string,unknown>)=>Promise<{
        data:unknown;error:{message:string}|null}>;
    const {data,error}=await rpc("d5o_rm_d4_readiness_v1",{
      p_workspace_id:input.workspaceId,p_work_id:input.workId});
    if(error)return /forbidden|permission_denied|verification_required/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    return valid(data)&&data.workId===input.workId
      ?{status:"ok",review:data}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
