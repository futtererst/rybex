import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {context,sql,q,j,save,hash} from "./implementation-context.mjs";
const c=await context();const run=randomUUID().slice(0,8);const plan={run,organization:randomUUID(),scenarios:[]};
for(const name of ["rybex","rotork"]){
 const path=`config/template-packs/d5o-m1-proof-${name}-v1.json`;const pack=JSON.parse(readFileSync(path));
 const fixture={name,workspace:randomUUID(),tenant:randomUUID(),template:randomUUID(),templateVersion:randomUUID(),activation:randomUUID(),configuration:randomUUID(),version:randomUUID(),phase:randomUUID(),gate:randomUUID(),pack,path,sha256:hash(readFileSync(path)),roles:{},evidenceTypes:{},actors:{}};
 for(const role of pack.roles)fixture.roles[role.key]=randomUUID();for(const e of pack.evidence)fixture.evidenceTypes[e.key]=randomUUID();
 const actors=[{key:"preparer",workspaceRole:"operations_leader"},{key:"performer",workspaceRole:"field_supervisor"},{key:"upstream_authority",workspaceRole:"operations_leader"},{key:"auditor",workspaceRole:"read_only_auditor"},...pack.roles.map(x=>({key:x.key,workspaceRole:x.workspaceRoles[0]}))];
 for(const a of actors)fixture.actors[a.key]={...a,id:randomUUID(),profile:randomUUID(),membership:randomUUID(),email:`m1-${run}-${name}-${a.key}@synthetic.local`};plan.scenarios.push(fixture);
}
save(`FIXTURE-PLAN-${run}.json`,plan);
function insert(table,row){return `insert into public.${table}(${Object.keys(row).join(",")}) values(${Object.values(row).map(x=>typeof x==="object"&&x!==null?j(x):q(x)).join(",")});`;}
let setup="begin;"+insert("organizations",{id:plan.organization,name:"Synthetic M1 proof organization",slug:`m1-${run}`});
for(const f of plan.scenarios){setup+=insert("workspaces",{id:f.workspace,organization_id:plan.organization,name:`Synthetic ${f.name} proof`,slug:`m1-${run}-${f.name}`});}
sql(setup+"commit;");
for(const f of plan.scenarios){for(const a of Object.values(f.actors)){const made=await c.service.auth.admin.createUser({id:a.id,email:a.email,password:c.env.FOUNDATION_0A_TEST_PASSWORD,email_confirm:true});if(made.error||made.data.user.id!==a.id)throw Error(made.error?.message??"actor_identity_mismatch");sql("begin;"+insert("user_profiles",{id:a.profile,user_id:a.id,auth_user_id:a.id,organization_id:plan.organization,workspace_id:f.workspace,active_workspace_id:f.workspace,display_name:a.key,email:a.email,status:"active"})+insert("workspace_memberships",{id:a.membership,organization_id:plan.organization,workspace_id:f.workspace,user_profile_id:a.profile,user_id:a.id,role:a.workspaceRole,status:"active"})+"commit;");}}
for(const f of plan.scenarios){
 const p=f.pack;let s="begin;";
 s+=insert("config_tenants",{id:f.tenant,tenant_key:`m1-${run}-${f.name}`,name:p.packName,organization_id:plan.organization,workspace_id:f.workspace,status:"active"});
 s+=insert("config_template_packs",{id:f.template,pack_key:p.packKey+"-"+run,name:p.packName,domain:p.domain,status:"released"});
 s+=insert("config_template_pack_versions",{id:f.templateVersion,template_pack_id:f.template,semver:p.version,status:"released",defaults_json:p});
 s+=insert("config_tenant_template_activations",{id:f.activation,tenant_id:f.tenant,template_pack_version_id:f.templateVersion,status:"active"});
 s+=insert("config_tenant_configurations",{id:f.configuration,tenant_id:f.tenant,activation_id:f.activation,config_key:"m1-proof",name:p.packName,status:"active"});
 s+=insert("config_configuration_versions",{id:f.version,tenant_configuration_id:f.configuration,version:1,status:"draft",source_template_pack_version_id:f.templateVersion,effective_from:new Date(Date.now()-60000).toISOString(),config_manifest_json:{synthetic:true,sourceSha256:f.sha256}});
 s+=insert("config_phase_definitions",{id:f.phase,configuration_version_id:f.version,phase_key:p.phase.key,label:p.phase.label,status:"active"});
 s+=insert("config_gate_definitions",{id:f.gate,configuration_version_id:f.version,phase_id:f.phase,gate_key:p.gate.key,label:p.gate.label,purpose:p.gate.purpose,status:"active",entry_rule_json:p.gate.entryRule,exit_rule_json:p.gate.exitRule});
 s+=insert("config_work_item_type_definitions",{configuration_version_id:f.version,work_item_type_key:p.workType.key,label:p.workType.label,intake_model:"manual",lifecycle_json:p.workType.lifecycle,status:"active"});
 for(const role of p.roles)s+=insert("config_role_definitions",{id:f.roles[role.key],configuration_version_id:f.version,role_key:role.key,label:role.label,status:"active",eligibility_rule_json:{workspaceRoles:role.workspaceRoles}});
 for(const e of p.evidence){s+=insert("config_evidence_type_definitions",{id:f.evidenceTypes[e.key],configuration_version_id:f.version,evidence_type_key:e.key,label:e.label,status:"active"});s+=insert("config_gate_evidence_requirements",{configuration_version_id:f.version,gate_id:f.gate,evidence_type_id:f.evidenceTypes[e.key],requirement_level:"required",status:"active"});}
 for(const o of p.outcomes)s+=insert("config_gate_decision_outcomes",{configuration_version_id:f.version,gate_id:f.gate,outcome_key:o.key,label:o.label,outcome_type:o.type,consequence_json:o.consequence,status:"active"});
 for(const right of p.rights)s+=insert("config_decision_right_definitions",{configuration_version_id:f.version,decision_right_key:right.key,label:right.label,role_definition_id:f.roles[right.roleKey],gate_definition_id:f.gate,outcome_key:right.outcomeKey,approval_rule_json:right.approvalRule,status:"active"});
 if(p.exception){const id=randomUUID();s+=insert("config_exception_rules",{id,configuration_version_id:f.version,exception_rule_key:p.exception.key,label:p.exception.label,applies_to:"gate",waiver_rule_json:{factKey:p.exception.factKey,scope:p.exception.scope},status:"active"});s+=insert("config_exception_approval_role_links",{configuration_version_id:f.version,exception_rule_id:id,role_key:p.exception.roleKey});}
 s+=`update public.config_configuration_versions set status='published',published_at=now() where id=${q(f.version)};update public.config_tenant_configurations set active_version_id=${q(f.version)} where id=${q(f.configuration)};update public.config_tenants set active_configuration_version_id=${q(f.version)} where id=${q(f.tenant)};commit;`;
 sql(s);
}
sql("notify pgrst,'reload schema';");save(`FIXTURE-RESULT-${run}.json`,{status:"PASS",run,workspaces:plan.scenarios.map(f=>f.workspace),actorCount:plan.scenarios.reduce((n,f)=>n+Object.keys(f.actors).length,0)});console.log(JSON.stringify({status:"PASS",run,plan:`FIXTURE-PLAN-${run}.json`}));
