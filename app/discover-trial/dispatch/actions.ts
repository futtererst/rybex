"use server";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { previewRmPlanShift, commitRmPlanShift, cancelRmPlanShift,
  listRmPlanShifts } from "@/lib/d5o/rm03-trial";
import { getD4Readiness } from "@/lib/d5o/d4-readiness-trial";

async function workspace() {
  const context=await getRequestContext();
  return context.status==="authorized"?context.workspace?.id:undefined;
}
export async function previewPlanAction(input:{workId:string;resourceId:string;
  startsAt:string;endsAt:string}) {
  const workspaceId=await workspace();
  return workspaceId?previewRmPlanShift({workspaceId,...input}):{status:"denied" as const};
}
export async function commitPlanAction(input:{workId:string;resourceId:string;
  startsAt:string;endsAt:string;expectedJobRevision:number;
  expectedResourceRevision:number;ackReason:string;commandId:string}) {
  const workspaceId=await workspace();
  return workspaceId?commitRmPlanShift({workspaceId,...input}):{status:"denied" as const};
}
export async function cancelPlanAction(input:{shiftId:string;reason:string;commandId:string}) {
  const workspaceId=await workspace();
  return workspaceId?cancelRmPlanShift({workspaceId,...input}):{status:"denied" as const};
}
export async function refreshPlansAction() {
  const workspaceId=await workspace();
  return workspaceId?listRmPlanShifts(workspaceId):{status:"denied" as const};
}
export async function reviewD4ReadinessAction(workId:string) {
  const workspaceId=await workspace();
  return workspaceId?getD4Readiness({workspaceId,workId}):{status:"denied" as const};
}
