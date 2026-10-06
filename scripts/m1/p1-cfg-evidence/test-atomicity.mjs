import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {context,createOpportunity,stage,attachArgs} from "./fixtures.mjs";
const c=await context(),results=[];const opp=await createOpportunity(c),item=await stage(c,c.bd,opp);const args=attachArgs(opp,item);
const q=await c.service.from("opportunity_qualifications").select("id,workspace_id").eq("opportunity_id",opp.id).single();assert.equal(q.error,null);
const actor=(await c.bd.auth.getUser()).data.user.id;
// Legitimate clean link collision forces failure AFTER the acceptance transaction updates evidence.
const collision=await c.service.from("evidence_links").insert({workspace_id:q.data.workspace_id,evidence_object_id:item.evidenceId,entity_type:"opportunity_qualification",entity_id:q.data.id,relationship_type:"qualification_decision_support",created_by:actor});assert.equal(collision.error,null);
try{
 const result=await c.bd.rpc("attach_opportunity_decision_support_evidence_v1",args);assert(result.error);assert.equal(result.error.code,"23505");
 const e=await c.bd.from("evidence_objects").select("verification_status,version").eq("id",item.evidenceId).single();assert.deepEqual(e.data,{verification_status:"pending",version:2});
 const ready=await c.bd.rpc("p1_01a_valid_qualification_evidence",{opportunity_uuid:opp.id});assert.equal(ready.data,false);
 const audit=await c.service.from("audit_events").select("id").eq("command_id",args.p_command_id);assert.equal(audit.error,null);assert.equal(audit.data.length,0);
 const cmd=await c.service.from("command_idempotency").select("id").eq("command_id",args.p_command_id);assert.equal(cmd.error,null);assert.equal(cmd.data.length,0);
 results.push({name:"Link write failure rolls back accepted status/version, command claim and acceptance audit; staged proof remains non-authoritative",status:"PASS"});
}catch(e){results.push({name:"Transactional rollback",status:"FAIL",error:e.message});throw e;}finally{writeFileSync(process.env.P1_CFG_RESULT_PATH,JSON.stringify(results,null,2));}
console.log(JSON.stringify({total:1,pass:1}));
