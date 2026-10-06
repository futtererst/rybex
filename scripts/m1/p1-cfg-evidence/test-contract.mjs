import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { context,createOpportunity,stage,attachArgs,ok } from "./fixtures.mjs";
const results=[]; const c=await context();
async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",error:e.message});throw e;}finally{writeFileSync(process.env.P1_CFG_RESULT_PATH,JSON.stringify(results,null,2));}}
await test("Installed RPC client preserves receiver with blocked transport",async()=>{
 let calls=0; const probe=createClient("http://127.0.0.1:61421","synthetic-test-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url)=>{calls++;assert.equal(String(url),"http://127.0.0.1:61421/rest/v1/rpc/receiver_probe");return new Response(JSON.stringify({success:true}),{status:200,headers:{"content-type":"application/json"}});}}});
 const detached=probe.rpc; assert.throws(()=>detached("receiver_probe",{}),/rest/);assert.equal(calls,0);
 const bound=probe.rpc.bind(probe);const reply=await bound("receiver_probe",{});assert.equal(reply.error,null);assert.equal(reply.data.success,true);assert.equal(calls,1);
});
let opp,item,args;
await test("Create scoped opportunity and qualification",async()=>{opp=await createOpportunity(c);assert(opp.id);});
await test("Legacy metadata-only attach denied",async()=>{const x=await c.bd.rpc("attach_opportunity_decision_support_evidence_v1",{...attachArgs(opp,{payload:{fileName:"fake",checksumSha256:"fake"}})});assert.equal(x.data?.error,"evidence_reference_required");});
await test("Actual custody scanner receipt and authenticated finalization",async()=>{item=await stage(c,c.bd,opp);const row=await c.bd.from("evidence_objects").select("scan_status,verification_status,version").eq("id",item.evidenceId).single();assert.deepEqual(row.data,{scan_status:"clean",verification_status:"pending",version:2});});
await test("Pending business acceptance does not qualify",async()=>{const x=await c.bd.rpc("p1_01a_valid_qualification_evidence",{opportunity_uuid:opp.id});assert.equal(x.data,false);});
await test("Authorized distinct fitness acceptance",async()=>{args=attachArgs(opp,item);await ok(c.bd,"attach_opportunity_decision_support_evidence_v1",args);});
await test("Accepted provenance qualifies and durably reloads",async()=>{const x=await c.bd.rpc("p1_01a_valid_qualification_evidence",{opportunity_uuid:opp.id});assert.equal(x.data,true);const row=await c.bd.from("evidence_objects").select("verification_status,version").eq("id",item.evidenceId).single();assert.deepEqual(row.data,{verification_status:"accepted",version:3});});
await test("Identical command replay",async()=>{const x=await ok(c.bd,"attach_opportunity_decision_support_evidence_v1",args);assert.equal(x.replayed,true);});
await test("Cross-workspace attach denied",async()=>{const x=await c.userB.rpc("attach_opportunity_decision_support_evidence_v1",args);assert.notEqual(x.data?.success,true);});
if(process.env.P1_CFG_BID==="1"){
 let bid,requirement,bidItem,bidArgs;
 await test("Typed excluded-upstream bid fixture resolves real configuration",async()=>{
  bid=await createOpportunity(c);const u=await c.service.from("opportunities").update({bid_package_version:"SYNTHETIC-v1",bid_submission_status:"ready_for_submission_approval",pursuit_authorization_status:"approved"}).eq("id",bid.id);assert.equal(u.error,null);
  const rd=await c.ops.rpc("p1_01b2_bid_submission_approval_readiness_v1",{p_opportunity_id:bid.id});assert.equal(rd.error,null);assert.equal(rd.data.available,true);requirement=rd.data.evidenceRequirements[0];assert(requirement.relationshipType);
 });
 await test("Configured bid evidence follows custody and acceptance",async()=>{bidItem=await stage(c,c.ops,bid,{purpose:"bid_approval",relationship:requirement.relationshipType});bidArgs={...attachArgs(bid,bidItem),p_relationship_type:requirement.relationshipType};await ok(c.ops,"attach_opportunity_bid_approval_evidence_v1",bidArgs);});
 await test("Configured satisfaction is durable and receipt-backed",async()=>{const rd=await c.ops.rpc("p1_01b2_bid_submission_approval_readiness_v1",{p_opportunity_id:bid.id});assert.equal(rd.data.evidenceRequirements.find(x=>x.relationshipType===requirement.relationshipType).satisfied,true);const rows=await c.service.from("opportunity_bid_evidence_satisfactions").select("id,actor_auth_user_id,actor_profile_id").eq("evidence_object_id",bidItem.evidenceId);assert.equal(rows.error,null);assert.equal(rows.data.length,1);assert(rows.data[0].actor_profile_id);});
 await test("Bid attachment replays without duplicate authority",async()=>{const v=await ok(c.ops,"attach_opportunity_bid_approval_evidence_v1",bidArgs);assert.equal(v.replayed,true);});
}
console.log(JSON.stringify({total:results.length,pass:results.filter(x=>x.status==="PASS").length}));
