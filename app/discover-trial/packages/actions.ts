"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { listD4PackageDrafts,saveD4PackageDraft,
  type D4PackagePayload } from "@/lib/d5o/d4-package-trial";
import { listD4FieldReviews,submitD4FieldReview,respondD4FieldReview }
  from "@/lib/d5o/d4-buildability-trial";
import { getD4ClearanceMatrix } from "@/lib/d5o/d4-clearance-matrix-trial";
import { listD4EvidenceRequests,recordD4EvidenceRequest,
  type EvidenceDiscipline } from "@/lib/d5o/d4-evidence-requests-trial";
import { listD4StagedUploads,stageD4PrivateFile }
  from "@/lib/d5o/d4-private-staging-trial";

async function workspace(){
  const context=await getRequestContext();
  return context.status==="authorized"?context.workspace?.id:undefined;
}
export async function listPackagesAction(workId:string){
  const workspaceId=await workspace();
  return workspaceId?listD4PackageDrafts(workspaceId,workId)
    :{status:"denied" as const};
}
export async function savePackageAction(input:{workId:string;packageId:string|null;
  expectedRevision:number;expectedJobRevision:number;commandId:string;
  payload:D4PackagePayload}){
  const workspaceId=await workspace();
  return workspaceId?saveD4PackageDraft({workspaceId,...input})
    :{status:"denied" as const};
}
export async function listFieldReviewsAction(workId:string){
  const workspaceId=await workspace();
  return workspaceId?listD4FieldReviews(workspaceId,workId)
    :{status:"denied" as const};
}
export async function submitFieldReviewAction(input:{workId:string;packageId:string;
  expectedPackageRevision:number;expectedJobRevision:number;commandId:string}){
  const workspaceId=await workspace();
  return workspaceId?submitD4FieldReview({workspaceId,...input})
    :{status:"denied" as const};
}
export async function respondFieldReviewAction(input:{submissionId:string;
  disposition:"reviewed"|"returned";reason:string;commandId:string}){
  const workspaceId=await workspace();
  return workspaceId?respondD4FieldReview({workspaceId,...input})
    :{status:"denied" as const};
}
export async function packageMatrixAction(packageId:string){
  const workspaceId=await workspace();
  return workspaceId?getD4ClearanceMatrix({workspaceId,packageId})
    :{status:"denied" as const};
}
export async function listEvidenceRequestsAction(packageId:string){
  const workspaceId=await workspace();
  return workspaceId?listD4EvidenceRequests({workspaceId,packageId})
    :{status:"denied" as const};
}
export async function recordEvidenceRequestAction(input:{packageId:string;
  expectedRevision:number;expectedJobRevision:number;
  discipline:EvidenceDiscipline;title:string;acceptanceCriterion:string;
  commandId:string}){
  const workspaceId=await workspace();
  return workspaceId?recordD4EvidenceRequest({workspaceId,...input})
    :{status:"denied" as const};
}
export async function listStagedUploadsAction(packageId:string){
  const workspaceId=await workspace();
  return workspaceId?listD4StagedUploads({workspaceId,packageId})
    :{status:"denied" as const};
}
export async function stageEvidenceFileAction(form:FormData){
  const workspaceId=await workspace();
  if(!workspaceId)return{status:"denied" as const};
  const file=form.get("file");
  const requestId=form.get("requestId");
  const expectedPackageRevision=Number(form.get("packageRevision"));
  const expectedJobRevision=Number(form.get("jobRevision"));
  const commandId=form.get("commandId");
  if(!(file instanceof File)||typeof requestId!=="string"
    ||typeof commandId!=="string")return{status:"invalid" as const};
  return stageD4PrivateFile({workspaceId,requestId,
    expectedPackageRevision,expectedJobRevision,commandId,file});
}
