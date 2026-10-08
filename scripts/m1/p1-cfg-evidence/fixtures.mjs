import { randomUUID, createHash } from "node:crypto";
import { clients as baselineClients } from "../baseline-correction/fixtures.mjs";
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function context() { const c = await baselineClients(); return { ...c, bd: await c.login("bd-a@foundation0a.local"), ops: await c.login("ops-a@foundation0a.local"), userB: await c.login("user-b@foundation0a.local"), auditor: await c.login("auditor-a@foundation0a.local") }; }
export async function ok(client, name, args) { const r = await client.rpc(name,args); if(r.error || !r.data?.success) throw new Error(name+": "+JSON.stringify(r.error??r.data)); return r.data; }
export async function createOpportunity(c) {
 const made=await ok(c.bd,"create_opportunity_v1",{p_payload:{name:"P1 custody "+randomUUID(),customerGc:"Synthetic",projectType:"Service",location:"Synthetic",scopeSummary:"Evidence contract proof",estimatedValue:"1000",anticipatedStart:"2026-10-10",bidDueDate:"2026-10-01",duplicateConfirmed:true},p_command_id:randomUUID(),p_correlation_id:"p1-custody"});
 const q=await ok(c.bd,"save_opportunity_qualification_v1",{p_opportunity_id:made.opportunity.id,p_payload:qualification(),p_expected_version:made.opportunity.version,p_command_id:randomUUID(),p_correlation_id:"p1-custody"});return q.opportunity;
}
export async function stage(c,actor,opp,{purpose="decision_support",relationship="qualification_decision_support",bytes=Buffer.from("synthetic custody "+randomUUID()),scan=true,finalize=true,filename="proof.txt",mimeType="text/plain"}={}) {
 const item=await ok(actor,"create_opportunity_evidence_upload_intent_v1",{p_opportunity_id:opp.id,p_purpose:purpose,p_relationship_type:relationship,p_expected_version:opp.version,p_original_filename:filename,p_mime_type:mimeType,p_size_bytes:bytes.length});
 const upload=await actor.storage.from(item.bucket).upload(item.objectPath,bytes,{contentType:mimeType});if(upload.error)throw upload.error;
 if(scan){
  const info=await c.service.storage.from(item.bucket).info(item.objectPath);if(info.error)throw info.error;
  const downloaded=await c.service.storage.from(item.bucket).download(item.objectPath);if(downloaded.error)throw downloaded.error;
  const actual=Buffer.from(await downloaded.data.arrayBuffer());if(hash(actual)!==hash(bytes))throw new Error("fixture_custody_mismatch");
  const verdict=await fetch("http://127.0.0.1:61428/scan",{method:"POST",headers:{"content-type":"application/octet-stream"},body:actual});if(!verdict.ok)throw new Error("scanner_failed");const result=await verdict.json();
  const after=await c.service.storage.from(item.bucket).info(item.objectPath);if(after.error||after.data.version!==info.data.version||after.data.lastModified!==info.data.lastModified)throw new Error("fixture_storage_changed");
  const auth=await actor.auth.getUser();
  await ok(c.service,"record_evidence_scan_receipt_v1",{p_evidence_id:item.evidenceId,p_workspace_id:opp.workspaceId??"10000000-0000-4000-8000-000000000001",p_project_id:null,p_requested_by:auth.data.user.id,p_storage_object_id:info.data.id,p_bucket_id:item.bucket,p_object_path:item.objectPath,p_storage_version:info.data.version,p_storage_updated_at:info.data.lastModified,p_sha256:hash(actual),p_size_bytes:actual.length,p_scanner:"synthetic-foundation-0f",p_result:result.status,p_scanned_at:result.scannedAt,p_expected_version:1,p_correlation_id:"p1-custody",p_receipt_key:randomUUID()});
 }
 if(finalize)await ok(actor,"finalize_evidence_upload_v1",{p_evidence_id:item.evidenceId,p_entity_type:"opportunity",p_entity_id:opp.id,p_relationship_type:"supporting_evidence",p_size_bytes:bytes.length,p_checksum_sha256:hash(bytes),p_expected_version:1,p_command_id:randomUUID(),p_correlation_id:"p1-custody"});
 return {...item,payload:{evidenceId:item.evidenceId,expectedEvidenceVersion:finalize?2:1}};
}
export function attachArgs(opp,item,command=randomUUID()){return {p_opportunity_id:opp.id,p_payload:item.payload,p_expected_version:opp.version,p_command_id:command,p_correlation_id:"p1-custody"};}

function qualification() {
  return {
    strategicFit: "strong",
    customerRelationship: "acceptable",
    geographyFit: "strong",
    projectTypeFit: "strong",
    scopeClarity: "acceptable",
    designMaturity: "acceptable",
    commercialTermsRisk: "risk",
    scheduleFeasibility: "acceptable",
    crewCapacityFit: "acceptable",
    materialLeadTimeRisk: "risk",
    permitsAccessRisk: "risk",
    safetyQualityComplexity: "acceptable",
    subcontractorDependency: "acceptable",
    cashFlowRisk: "acceptable",
    marginConfidence: "acceptable",
    contractualRisk: "risk",
    riskSummary: "Utility access, schedule, and commercial terms need pursuit controls.",
    assumptions: "Qualification assumes current drawings and access windows remain stable.",
    recommendation: "pursue_with_mitigations"
  };
}

export async function referencePayload(service,actor,opportunityId,version,purpose="decision_support",relationship="qualification_decision_support",metadata={}) {
 if(process.env.RYBEX_QUALIFICATION_PROJECT_ID!=="rybex-cfg03-q-m1-s1-recovery-20260928"||process.env.NEXT_PUBLIC_SUPABASE_URL!=="http://127.0.0.1:61421")throw new Error("reference_fixture_boundary");
 const scoped=await service.from("opportunities").select("id,workspace_id").eq("id",opportunityId).single();if(scoped.error)throw scoped.error;
 const item=await stage({service},actor,{id:opportunityId,version,workspaceId:scoped.data.workspace_id},{purpose,relationship,filename:metadata.fileName??"proof.txt",mimeType:metadata.mimeType??"text/plain"});return {...item.payload,relationshipType:relationship};
}
