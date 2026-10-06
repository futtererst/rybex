import "server-only";

import { createHash,randomUUID } from "node:crypto";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseAdminClient,
  createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed=new Set(["text/plain","application/pdf","image/png","image/jpeg","image/webp"]);
type RpcResult={data:unknown;error:{message:string}|null};
type StagedRow={evidenceId:string;requestId:string;packageRevision:number;
  jobRevision:number;filename:string;sizeBytes:number|null;checksumSha256:string|null;
  uploadStatus:string;scanStatus:string;verificationStatus:string;
  createdAt:string;current:boolean};
export type StagedList={status:"ok";packageId:string;currentRevision:number;
  items:StagedRow[]}|{status:"denied"|"invalid"|"unavailable"};
export type StageResult={status:"stored_pending_scan";evidenceId:string}|
  {status:"denied"|"invalid"|"stale"|"conflict"|"storage_unavailable"|
    "bytes_mismatch"|"unavailable"};
async function rpc(name:string,args:Record<string,unknown>,admin=false):Promise<RpcResult>{
  const client=admin?createRybexSupabaseAdminClient():
    await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as
    (name:string,args:Record<string,unknown>)=>Promise<RpcResult>)(name,args);
}
async function scoped(workspaceId:string){
  const context=await getRequestContext();
  return context.authenticated&&context.status==="authorized"
    &&context.workspace?.id===workspaceId;
}
function validRow(x:unknown):x is StagedRow{
  if(!x||typeof x!=="object")return false;
  const r=x as StagedRow;
  return uuid.test(r.evidenceId)&&uuid.test(r.requestId)
    &&Number.isInteger(r.packageRevision)&&Number.isInteger(r.jobRevision)
    &&typeof r.filename==="string"&&
    (r.sizeBytes===null||Number.isInteger(r.sizeBytes))
    &&(r.checksumSha256===null||typeof r.checksumSha256==="string")
    &&typeof r.uploadStatus==="string"&&typeof r.scanStatus==="string"
    &&typeof r.verificationStatus==="string"&&typeof r.createdAt==="string"
    &&typeof r.current==="boolean";
}
export async function listD4StagedUploads(input:{workspaceId:string;packageId:string}):
  Promise<StagedList>{
  assertDiscoverTrialEnvironment();
  if(!uuid.test(input.workspaceId)||!uuid.test(input.packageId))return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const {data,error}=await rpc("d5o_d4_list_staged_uploads_v1",{
      p_workspace_id:input.workspaceId,p_package_id:input.packageId});
    if(error)return /permission_denied|forbidden|verification_required/.test(error.message)
      ?{status:"denied"}:{status:"unavailable"};
    const r=data as {packageId?:unknown;currentRevision?:unknown;items?:unknown}|null;
    return r?.packageId===input.packageId&&Number.isInteger(r.currentRevision)
      &&Array.isArray(r.items)&&r.items.length<=200&&r.items.every(validRow)
      ?{status:"ok",packageId:input.packageId,
        currentRevision:r.currentRevision as number,items:r.items}
      :{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
export async function stageD4PrivateFile(input:{workspaceId:string;requestId:string;
  expectedPackageRevision:number;expectedJobRevision:number;
  commandId:string;file:File}):Promise<StageResult>{
  assertDiscoverTrialEnvironment();
  const file=input.file;
  if(!uuid.test(input.workspaceId)||!uuid.test(input.requestId)
    ||!Number.isInteger(input.expectedPackageRevision)
    ||!Number.isInteger(input.expectedJobRevision)
    ||!uuid.test(input.commandId)||!(file instanceof File)
    ||file.name.trim().length<1||file.name.trim().length>120
    ||file.size<1||file.size>1048576||!allowed.has(file.type))
    return{status:"invalid"};
  if(!await scoped(input.workspaceId))return{status:"denied"};
  try{
    const client=await createRybexSupabaseServerClient();
    const actor=await client.auth.getUser();
    if(actor.error||!actor.data.user)return{status:"denied"};
    const bytes=Buffer.from(await file.arrayBuffer());
    if(bytes.length!==file.size)return{status:"bytes_mismatch"};
    const sha=createHash("sha256").update(bytes).digest("hex");
    const {data,error}=await rpc("d5o_d4_prepare_upload_v1",{
      p_workspace_id:input.workspaceId,p_request_id:input.requestId,
      p_expected_package_revision:input.expectedPackageRevision,
      p_expected_job_revision:input.expectedJobRevision,
      p_filename:file.name,p_mime_type:file.type,p_command_id:input.commandId});
    if(error){
      if(/permission_denied|forbidden|verification_required/.test(error.message))
        return{status:"denied"};
      if(/d4_upload_stale/.test(error.message))return{status:"stale"};
      if(/idempotency_mismatch|command_in_progress/.test(error.message))
        return{status:"conflict"};
      return{status:"unavailable"};
    }
    const intent=data as {success?:unknown;evidenceId?:unknown;bucket?:unknown;
      objectPath?:unknown;uploadStatus?:unknown;releaseEligible?:unknown}|null;
    if(intent?.success!==true||typeof intent.evidenceId!=="string"
      ||!uuid.test(intent.evidenceId)||intent.bucket!=="d5o-trial-d4-evidence"
      ||typeof intent.objectPath!=="string"||intent.uploadStatus!=="pending_upload"
      ||intent.releaseEligible!==false)return{status:"unavailable"};
    const bucket=client.storage.from(intent.bucket);
    const upload=await bucket.upload(intent.objectPath,bytes,
      {contentType:file.type,upsert:false});
    if(upload.error&&upload.error.message.toLowerCase().includes("duplicate")===false
      &&upload.error.message.toLowerCase().includes("already exists")===false)
      return{status:"storage_unavailable"};
    const admin=createRybexSupabaseAdminClient();
    const stored=admin.storage.from(intent.bucket);
    const before=await stored.info(intent.objectPath);
    if(before.error||!before.data.id||!before.data.version)
      return{status:"storage_unavailable"};
    const download=await stored.download(intent.objectPath);
    if(download.error)return{status:"storage_unavailable"};
    const recovered=Buffer.from(await download.data.arrayBuffer());
    if(recovered.length!==bytes.length||
      createHash("sha256").update(recovered).digest("hex")!==sha)
      return{status:"bytes_mismatch"};
    const after=await stored.info(intent.objectPath);
    const timestamp=before.data.lastModified??before.data.updatedAt;
    if(after.error||after.data.id!==before.data.id
      ||after.data.version!==before.data.version||!timestamp
      ||(after.data.lastModified??after.data.updatedAt)!==timestamp)
      return{status:"storage_unavailable"};
    const confirmed=await rpc("d5o_d4_acknowledge_upload_v1",{
      p_evidence_id:intent.evidenceId,p_actor_id:actor.data.user.id,
      p_storage_object_id:before.data.id,p_storage_version:before.data.version,
      p_storage_updated_at:timestamp,p_size_bytes:bytes.length,p_sha256:sha,
      p_command_id:`d4-stage-${randomUUID()}`},true);
    const receipt=confirmed.data as {success?:unknown;uploadStatus?:unknown;
      scanStatus?:unknown;releaseEligible?:unknown}|null;
    return !confirmed.error&&receipt?.success===true
      &&receipt.uploadStatus==="uploaded"&&receipt.scanStatus==="not_configured"
      &&receipt.releaseEligible===false
      ?{status:"stored_pending_scan",evidenceId:intent.evidenceId}
      :{status:"unavailable"};
  }catch{return{status:"unavailable"};}
}
