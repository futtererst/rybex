import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {context,sql,q,j,save,loadWork,hash} from "./implementation-context.mjs";
import {prepare} from "./proof-fixtures.mjs";
const plan=JSON.parse(readFileSync(process.argv[2])),f=plan.scenarios[0],c=await context(),p=await prepare(c,f);const results=[];const tag=new Date().toISOString().replaceAll(/[:.]/g,"-");
function snap(){return sql(`select jsonb_build_object('work',(select to_jsonb(w) from d5o_work_records w where id=${q(p.work)}),'proofs',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from d5o_proof_packages x where work_id=${q(p.work)}),'items',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from d5o_proof_items x where work_id=${q(p.work)}),'decisions',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from d5o_work_decisions x where work_id=${q(p.work)}),'outcomes',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from d5o_work_outcomes x where work_id=${q(p.work)}),'history',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from audit_events x where entity_id=${q(p.work)}),'events',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from domain_events x where aggregate_id=${q(p.work)}),'commands',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from command_idempotency x where entity_id=${q(p.work)}));`);}
const signatures={emit:"rybex_internal.d5o_m1_emit(uuid,text,text,uuid,jsonb,jsonb,jsonb)",execute:"public.d5o_execute_work_command_v1(uuid,uuid,integer,integer,text,text,jsonb)"};
const definitions=Object.fromEntries(Object.entries(signatures).map(([k,s])=>[k,sql(`select pg_get_functiondef(${q(s)}::regprocedure);`)]));
try{
const v=(await loadWork(p.owner,f,p.work)).work.record_version;
const call=`set local role authenticated;set local request.jwt.claim.sub=${q(f.actors.quality_verifier.id)};set local request.jwt.claim.role='authenticated';select public.d5o_execute_work_command_v1(${q(f.workspace)},${q(p.work)},${v},1,${q(randomUUID())},'decide',${j({rightKey:"verify-quality",reason:"Fault-injection proof"})});`;
const tests=[
 {name:"before audit write",fn:"emit",marker:"a:=rybex_internal.append_audit_event"},
 {name:"after audit before domain event",fn:"emit",marker:"e:=rybex_internal.append_domain_event"},
 {name:"after audit and domain event",fn:"emit",marker:"return jsonb_build_object('audit',a,'event',e);"},
 {name:"before idempotency result write",fn:"execute",marker:"insert into command_idempotency("},
 {name:"after idempotency result write",fn:"execute",marker:"return result;"},
 ...["d5o_work_records","d5o_work_decisions","d5o_work_outcomes"].map(table=>({name:"write failure at "+table,table,deferred:false})),
 {name:"deferred commit-boundary failure",table:"d5o_work_outcomes",deferred:true}
];
for(const test of tests){const before=snap();let injection;
 if(test.fn){const source=definitions[test.fn];assert.equal(source.split(test.marker).length,2);injection=source.replace(test.marker,"raise exception 'm1_injected_fault';\n "+test.marker);}
 else{injection="create function rybex_internal.d5o_m1_test_failure() returns trigger language plpgsql as $$begin raise exception 'm1_injected_fault';end$$;"+(test.deferred?`create constraint trigger m1_fault after insert on ${test.table} deferrable initially deferred for each row execute function rybex_internal.d5o_m1_test_failure();`:`create trigger m1_fault before ${test.table==="d5o_work_records"?"update":"insert"} on ${test.table} for each row execute function rybex_internal.d5o_m1_test_failure();`);}
 assert.throws(()=>sql("begin;\n"+injection+";\n"+call+"commit;"),/m1_injected_fault/);assert.equal(snap(),before);for(const [k,s]of Object.entries(signatures))assert.equal(sql(`select pg_get_functiondef(${q(s)}::regprocedure);`),definitions[k]);
 results.push({name:test.name,status:"PASS",authoritativeStateSha256:hash(Buffer.from(before)),functionDefinitionsRestored:true});
}
save(`ATOMICITY-${tag}.json`,{status:"PASS",results,method:"Faults injected only into new M1 helpers/new-table triggers inside rollback transactions; baseline helpers untouched."});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save(`ATOMICITY-${tag}.json`,{status:"FAIL",error:e.message,results});throw e;}
