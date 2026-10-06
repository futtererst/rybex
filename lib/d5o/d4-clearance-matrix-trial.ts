import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type D4MatrixRow={key:string;label:string;status:string;
  sourceId:string|null;detail:string};
export type D4ClearanceMatrix={workId:string;packageId:string;
  packageRevision:number;jobRevision:number;fieldReviewSubmissionId:string|null;
  fieldReviewResponseId:string|null;minimumCrewAcrossWindow:number;
  requiredCrew:number;currentShiftCount:number;custodyCandidates:number;
  rows:D4MatrixRow[];releaseEligible:false};
export type D4MatrixResult={status:"ok";matrix:D4ClearanceMatrix}|
  {status:"denied"|"invalid"|"unavailable"};
function validRow(x:unknown):x is D4MatrixRow{
  if(!x||typeof x!=="object")return false;
  const r=x as D4MatrixRow;
  return typeof r.key==="string"&&typeof r.label==="string"
    &&typeof r.status==="string"&&typeof r.detail==="string"
    &&(r.sourceId===null||uuid.test(r.sourceId));
}
function valid(x:unknown):x is D4ClearanceMatrix{
  if(!x||typeof x!=="object")return false;
  const m=x as D4ClearanceMatrix;
  return uuid.test(m.workId)&&uuid.test(m.packageId)
    &&[m.packageRevision,m.jobRevision,m.minimumCrewAcrossWindow,
      m.requiredCrew,m.currentShiftCount,m.custodyCandidates].every(Number.isInteger)
    &&(m.fieldReviewSubmissionId===null||uuid.test(m.fieldReviewSubmissionId))
    &&(m.fieldReviewResponseId===null||uuid.test(m.fieldReviewResponseId))
    &&Array.isArray(m.rows)&&m.rows.length===8&&m.rows.every(validRow)
    &&m.releaseEligible===false;
}
export async function getD4ClearanceMatrix(input:{workspaceId:string;
  packageId:string}):Promise<D4MatrixResult>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.packageId))
    return{status:"invalid"};
  const context=await getRequestContext();
  if(!context.authenticated||context.status!=="authorized"
    ||context.workspace?.id!==input.workspaceId)return{status:"denied"};
  try{
    const client=await createRybexSupabaseServerClient();
    const rpc=client.rpc.bind(client) as unknown as
      (name:string,args:Record<string,unknown>)=>Promise<{
        data:unknown;error:{message:string}|null}>;
    const {data,error}=await rpc("d5o_d4_package_clearance_matrix_v1",{
      p_workspace_id:input.workspaceId,p_package_id:input.packageId});
    if(error)return /forbidden|permission_denied|verification_required/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    return valid(data)&&data.packageId===input.packageId
      ?{status:"ok",matrix:data}:{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
