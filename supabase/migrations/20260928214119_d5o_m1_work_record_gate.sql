-- M1-S1 additive work identity and gate execution. Local synthetic proof only.
-- Historical migrations, configuration storage and existing policies remain unchanged.
begin;
create table public.d5o_work_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 configuration_tenant_id uuid not null references public.config_tenants(id),
 configuration_version_id uuid not null references public.config_configuration_versions(id),
 work_type_key text not null, gate_key text not null, configuration_digest text not null,
 configuration_snapshot jsonb not null, title text not null check(length(trim(title)) between 1 and 240),
 owner_profile_id uuid not null references public.user_profiles(id), lifecycle_state text not null,
 record_version integer not null default 1 check(record_version>0),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(id,workspace_id), unique(id,workspace_id,configuration_version_id),
 foreign key(configuration_version_id,work_type_key) references public.config_work_item_type_definitions(configuration_version_id,work_item_type_key),
 foreign key(configuration_version_id,gate_key) references public.config_gate_definitions(configuration_version_id,gate_key)
);
create table public.d5o_work_sources (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,
 source_system text not null,entity_type text not null,source_key text not null,
 unique(workspace_id,source_system,entity_type,source_key),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create table public.d5o_work_relations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,related_work_id uuid not null,
 relation_type text not null check(relation_type in ('child_of','derived_from','repeat_of','follows_from')),
 independence_rationale jsonb not null check(jsonb_typeof(independence_rationale)='object'),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check(work_id<>related_work_id),unique(work_id,related_work_id,relation_type),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id),
 foreign key(related_work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create table public.d5o_work_participants (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,
 configuration_version_id uuid not null,profile_id uuid not null references public.user_profiles(id),role_key text not null,
 status text not null default 'active' check(status in ('active','revoked')),assigned_by uuid not null references auth.users(id),
 assigned_at timestamptz not null default now(),unique(work_id,profile_id,role_key),
 foreign key(work_id,workspace_id,configuration_version_id) references public.d5o_work_records(id,workspace_id,configuration_version_id),
 foreign key(configuration_version_id,role_key) references public.config_role_definitions(configuration_version_id,role_key)
);
create table public.d5o_work_facts (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,
 fact_key text not null,fact_revision integer not null check(fact_revision>0),
 fact_type text not null check(fact_type in ('assessment','measurement','verification','authorization','commercial_condition')),
 value jsonb not null,scope_key text not null,actor_profile_id uuid not null references public.user_profiles(id),
 provenance jsonb not null check(jsonb_typeof(provenance)='object' and provenance ? 'source' and provenance ? 'synthetic'),
 created_at timestamptz not null default now(),unique(work_id,fact_key,fact_revision),unique(id,work_id,workspace_id),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create table public.d5o_proof_packages (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,proof_package_revision integer not null check(proof_package_revision>0),
 status text not null default 'draft' check(status in ('draft','submitted','held','superseded')),
 prepared_by uuid not null references public.user_profiles(id),submitted_record_version integer,configuration_digest text not null,
 snapshot jsonb,submitted_at timestamptz,created_at timestamptz not null default now(),
 unique(work_id,proof_package_revision),unique(id,work_id,workspace_id),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create table public.d5o_proof_items (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,proof_id uuid not null,
 requirement_key text not null,evidence_object_id uuid references public.evidence_objects(id),evidence_version integer,
 fact_id uuid,created_at timestamptz not null default now(),
 check((evidence_object_id is not null and evidence_version>0 and fact_id is null) or (fact_id is not null and evidence_object_id is null and evidence_version is null)),
 unique(proof_id,requirement_key),
 foreign key(proof_id,work_id,workspace_id) references public.d5o_proof_packages(id,work_id,workspace_id),
 foreign key(fact_id,work_id,workspace_id) references public.d5o_work_facts(id,work_id,workspace_id)
);
create table public.d5o_work_decisions (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,proof_id uuid not null,
 decision_right_key text not null,outcome_key text not null,outcome_type text not null,
 actor_id uuid not null references auth.users(id),actor_profile_id uuid not null references public.user_profiles(id),
 authority_snapshot jsonb not null,configuration_snapshot jsonb not null,proof_snapshot jsonb not null,
 before_version integer not null,after_version integer not null,before_state text not null,after_state text not null,
 reason text not null,scope_key text,expires_at timestamptz,command_id text not null,
 audit_event_id uuid not null references public.audit_events(id),domain_event_id uuid not null references public.domain_events(id),
 decided_at timestamptz not null default now(),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id),
 foreign key(proof_id,work_id,workspace_id) references public.d5o_proof_packages(id,work_id,workspace_id)
);
create table public.d5o_work_commitments (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,
 commitment_type text not null check(commitment_type in ('financial','value')),label text not null,source_reference text not null,
 owner_profile_id uuid not null references public.user_profiles(id),metric text not null,unit text not null,currency text,
 baseline numeric,target numeric,due_at timestamptz,provenance jsonb not null,
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create table public.d5o_work_outcomes (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_id uuid not null,decision_id uuid not null references public.d5o_work_decisions(id),
 result jsonb not null,created_at timestamptz not null default now(),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
-- Helpers and RPCs follow; this migration is NOT sealed or applied until complete.

create function rybex_internal.d5o_m1_actor(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m workspace_memberships%rowtype; p user_profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'unauthenticated'; end if;
 select * into m from workspace_memberships where workspace_id=p_workspace and user_id=auth.uid() and status='active' for share;
 if not found then raise exception 'forbidden'; end if;
 select * into p from user_profiles where id=m.user_profile_id and user_id=auth.uid() and auth_user_id=auth.uid() and status='active' for share;
 if not found or not exists(select 1 from workspaces where id=p_workspace and status='active') then raise exception 'forbidden'; end if;
 return jsonb_build_object('actor',auth.uid(),'profile',p.id,'membership',m.id,'workspace',p_workspace,'workspace_role',m.role);
end $$;
create function rybex_internal.d5o_m1_lock(p_workspace uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Bounded proof favors correctness over throughput. Shared table locks prevent phantom
 -- mapping/config updates; workspace lock serializes lineage/record/fact writers.
 perform pg_advisory_xact_lock(hashtextextended('d5o-m1:'||p_workspace,0));
 lock table config_tenants,config_configuration_versions,config_tenant_configurations,
 config_tenant_template_activations,config_template_packs,config_template_pack_versions,
 config_work_item_type_definitions,config_phase_definitions,config_gate_definitions,
 config_gate_evidence_requirements,config_evidence_type_definitions,config_role_definitions,
 config_decision_right_definitions,config_gate_decision_outcomes,config_exception_rules,
 config_exception_approval_role_links in share mode;
end $$;
create function rybex_internal.d5o_m1_configuration(p_workspace uuid,p_version uuid,p_type text,p_gate text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t config_tenants%rowtype; v config_configuration_versions%rowtype; n integer; result jsonb;
begin
 select count(*) into n from config_tenants where workspace_id=p_workspace and status<>'archived';
 if n=0 then raise exception 'no_tenant_mapping'; elsif n<>1 then raise exception 'ambiguous_tenant_mapping'; end if;
 select * into t from config_tenants where workspace_id=p_workspace and status<>'archived';
 if t.status not in ('active','published') then raise exception 'configuration_unavailable'; end if;
 select * into v from config_configuration_versions where id=coalesce(p_version,t.active_configuration_version_id);
 if not found or v.status not in ('published','superseded') or
 (p_version is null and (v.status<>'published' or v.effective_from is null or v.effective_from>now() or v.effective_to<=now())) then raise exception 'configuration_unavailable'; end if;
 if not exists(select 1 from config_tenant_configurations c
 join config_tenant_template_activations a on a.id=c.activation_id and a.tenant_id=c.tenant_id
 join config_template_pack_versions pv on pv.id=a.template_pack_version_id
 join config_template_packs pk on pk.id=pv.template_pack_id
 where c.id=v.tenant_configuration_id and c.tenant_id=t.id and c.status in ('active','published','superseded')
 and a.status in ('active','superseded') and pv.status='released' and pk.status='released'
 and (v.source_template_pack_version_id is null or v.source_template_pack_version_id=pv.id)) then raise exception 'invalid_configuration_lineage'; end if;
 if not exists(select 1 from config_work_item_type_definitions where configuration_version_id=v.id and work_item_type_key=p_type and status='active' and lifecycle_json->>'gateKey'=p_gate)
 or not exists(select 1 from config_gate_definitions g join config_phase_definitions ph on ph.id=g.phase_id and ph.configuration_version_id=g.configuration_version_id where g.configuration_version_id=v.id and g.gate_key=p_gate and g.status='active' and ph.status='active') then raise exception 'incompatible_work_type'; end if;
 select jsonb_build_object('tenantId',t.id,'versionId',v.id,'workType',to_jsonb(wt),'gate',to_jsonb(g),
 'requirements',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_gate_evidence_requirements x where x.gate_id=g.id),'[]'::jsonb),
 'evidenceTypes',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_evidence_type_definitions x where x.configuration_version_id=v.id),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_role_definitions x where x.configuration_version_id=v.id),'[]'::jsonb),
 'rights',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_decision_right_definitions x where x.gate_definition_id=g.id),'[]'::jsonb),
 'outcomes',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_gate_decision_outcomes x where x.gate_id=g.id),'[]'::jsonb),
 'exceptions',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_exception_rules x where x.configuration_version_id=v.id),'[]'::jsonb),
 'exceptionRoles',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from config_exception_approval_role_links x where x.configuration_version_id=v.id),'[]'::jsonb)) into result
 from config_work_item_type_definitions wt join config_gate_definitions g on g.configuration_version_id=wt.configuration_version_id
 where wt.configuration_version_id=v.id and wt.work_item_type_key=p_type and g.gate_key=p_gate;
 perform rybex_internal.d5o_m1_validate_config(result);
 return result;
end $$;
create function rybex_internal.d5o_m1_digest(p_value jsonb) returns text
language sql immutable set search_path=pg_catalog as $$ select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex') $$;
create function rybex_internal.d5o_m1_rule_shape(p_rule jsonb,p_depth integer default 0) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare op text:=p_rule->>'op'; allowed text[]; child jsonb;
begin
 if p_depth>16 or jsonb_typeof(p_rule)<>'object' or op is null then raise exception 'invalid_rule'; end if;
 case op
 when 'all' then
  allowed:=array['op','items'];
  if jsonb_typeof(p_rule->'items') is distinct from 'array' or jsonb_array_length(p_rule->'items')>64 then raise exception 'invalid_rule';end if;
  for child in select value from jsonb_array_elements(p_rule->'items') loop perform rybex_internal.d5o_m1_rule_shape(child,p_depth+1);end loop;
 when 'fact_equals' then
  allowed:=array['op','key','value']; if jsonb_typeof(p_rule->'key') is distinct from 'string' or not(p_rule ? 'value') then raise exception 'invalid_rule';end if;
 when 'evidence_valid' then
  allowed:=array['op','key'];if jsonb_typeof(p_rule->'key') is distinct from 'string' then raise exception 'invalid_rule';end if;
 when 'decision_recorded' then
  allowed:=array['op','right','outcome'];if jsonb_typeof(p_rule->'right') is distinct from 'string' or jsonb_typeof(p_rule->'outcome') is distinct from 'string' then raise exception 'invalid_rule';end if;
 when 'exception_satisfies' then
  allowed:=array['op','key','value','exception','scope'];if jsonb_typeof(p_rule->'key') is distinct from 'string' or not(p_rule ? 'value') or jsonb_typeof(p_rule->'exception') is distinct from 'string' or jsonb_typeof(p_rule->'scope') is distinct from 'string' then raise exception 'invalid_rule';end if;
 else raise exception 'unknown_rule_operator';end case;
 if exists(select 1 from jsonb_object_keys(p_rule) k where not(k=any(allowed))) then raise exception 'unknown_rule_field';end if;
end $$;

create function rybex_internal.d5o_m1_validate_config(c jsonb) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare x jsonb; y jsonb; rule jsonb; lifecycle jsonb:=c->'workType'->'lifecycle_json';
begin
 if exists(select 1 from jsonb_object_keys(lifecycle) k where k not in ('gateKey','initialState','completeState','reopenAuthority')) or lifecycle->>'reopenAuthority'<>'owner' or coalesce(lifecycle->>'initialState','')='' or coalesce(lifecycle->>'completeState','')='' then raise exception 'invalid_lifecycle';end if;
 perform rybex_internal.d5o_m1_rule_shape(c->'gate'->'entry_rule_json');perform rybex_internal.d5o_m1_rule_shape(c->'gate'->'exit_rule_json');
 for x in select value from jsonb_array_elements(c->'roles') where value->>'status'='active' loop
  rule:=x->'eligibility_rule_json';if (rule-'workspaceRoles')<>'{}'::jsonb or jsonb_typeof(rule->'workspaceRoles') is distinct from 'array' or jsonb_array_length(rule->'workspaceRoles')=0 then raise exception 'invalid_role_rule';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'rights') where value->>'status'='active' loop
  rule:=x->'approval_rule_json';
  if (x->>'admin_override_allowed')::boolean or (x->>'auditor_read_only')::boolean or x->'record_scope_json'<>'{}'::jsonb or x->>'permission_definition_id' is not null then raise exception 'unsupported_authority';end if;
  if exists(select 1 from jsonb_object_keys(rule) k where k not in ('requires','forbidPreparer','distinctFactKeys','distinctDecisionRights','exceptionRuleKey')) or jsonb_typeof(rule->'forbidPreparer') is distinct from 'boolean' or jsonb_typeof(rule->'distinctFactKeys') is distinct from 'array' or jsonb_typeof(rule->'distinctDecisionRights') is distinct from 'array' then raise exception 'invalid_authority_rule';end if;
  perform rybex_internal.d5o_m1_rule_shape(rule->'requires');
 end loop;
 for x in select value from jsonb_array_elements(c->'outcomes') where value->>'status'='active' loop
  rule:=x->'consequence_json';if (rule-'final'-'state')<>'{}'::jsonb or jsonb_typeof(rule->'final') is distinct from 'boolean' then raise exception 'invalid_outcome_rule';end if;
  if x->>'outcome_type' in ('hold','stop','recycle') and (rule ? 'state' or (rule->>'final')::boolean) then raise exception 'hold_cannot_advance';end if;
  if (rule->>'final')::boolean and rule->>'state' is distinct from lifecycle->>'completeState' then raise exception 'invalid_final_state';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'requirements') where value->>'status'='active' loop
  if x->>'requirement_level' not in ('required','blocking','optional') or x->'blocking_rule_json'<>'{"blocks_gate":true,"condition":"missing"}'::jsonb or x->>'applies_to_class_key' is not null then raise exception 'unsupported_evidence_rule';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'exceptions') where value->>'status'='active' loop
  rule:=x->'waiver_rule_json';if (rule-'factKey'-'scope')<>'{}'::jsonb or coalesce(rule->>'factKey','')='' or coalesce(rule->>'scope','')='' or x->'override_rule_json'<>'{}'::jsonb or x->'approval_rule_json'<>'{}'::jsonb or x->'audit_rule_json'<>'{}'::jsonb then raise exception 'unsupported_exception_rule';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'exceptionRoles') loop if x->'approval_rule_json'<>'{}'::jsonb then raise exception 'unsupported_exception_authority';end if;end loop;
end $$;

-- No client role receives direct execution on these private helpers.

create function rybex_internal.d5o_m1_snapshot(p_work uuid,p_proof uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w d5o_work_records%rowtype; item record; obj evidence_objects%rowtype; facts jsonb; evidence jsonb:='[]';
begin
 select * into strict w from d5o_work_records where id=p_work;
 for item in select i.* from d5o_proof_items i where i.proof_id=p_proof and i.work_id=p_work order by i.requirement_key loop
  if item.evidence_object_id is not null then
   select * into obj from evidence_objects where id=item.evidence_object_id for share;
   if not found or obj.workspace_id<>w.workspace_id or obj.version<>item.evidence_version
    or obj.upload_status<>'uploaded' or obj.scan_status<>'clean' or obj.verification_status not in ('pending','accepted')
    or obj.size_bytes<=0 or nullif(obj.checksum_sha256,'') is null
    or (obj.project_id is not null and not public.can_access_project(obj.project_id))
    or not exists(select 1 from evidence_links el where el.evidence_object_id=obj.id and el.workspace_id=w.workspace_id and el.entity_type='d5o_work_record' and el.entity_id=w.id and el.relationship_type=item.requirement_key)
    then raise exception 'invalid_evidence'; end if;
   -- Hold the link stable as well as the object during authoritative evaluation.
   perform 1 from evidence_links where evidence_object_id=obj.id and entity_id=w.id for share;
   evidence:=evidence||jsonb_build_array(jsonb_build_object('key',item.requirement_key,'object',to_jsonb(obj)));
  end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(f) order by f.fact_key),'[]') into facts from
 (select distinct on (fact_key) * from d5o_work_facts where work_id=p_work order by fact_key,fact_revision desc) f;
 return jsonb_build_object('facts',facts,'evidence',evidence);
end $$;
create function rybex_internal.d5o_m1_evaluate(p_rule jsonb,p_work uuid,p_proof uuid,p_snapshot jsonb,p_config jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare op text:=p_rule->>'op'; child jsonb; unmet jsonb:='[]'; fact jsonb; d d5o_work_decisions%rowtype; ex jsonb; ok boolean:=false;
begin
 perform rybex_internal.d5o_m1_rule_shape(p_rule);
 if op='all' then
  for child in select value from jsonb_array_elements(p_rule->'items') loop unmet:=unmet||rybex_internal.d5o_m1_evaluate(child,p_work,p_proof,p_snapshot,p_config);end loop;return unmet;
 elsif op in ('fact_equals','exception_satisfies') then
  select value into fact from jsonb_array_elements(p_snapshot->'facts') where value->>'fact_key'=p_rule->>'key';
  ok:=fact is not null and fact->'value'=p_rule->'value';
  if not ok and op='exception_satisfies' then
   select value into ex from jsonb_array_elements(p_config->'exceptions') where value->>'exception_rule_key'=p_rule->>'exception' and value->>'status'='active';
   if ex is not null and ex->'waiver_rule_json'->>'factKey'=p_rule->>'key' and ex->'waiver_rule_json'->>'scope'=p_rule->>'scope' then
    select * into d from d5o_work_decisions where work_id=p_work and proof_id=p_proof and authority_snapshot->>'exceptionRuleKey'=p_rule->>'exception' order by decided_at desc,id desc limit 1;
    ok:=found and d.outcome_type='exception' and d.scope_key=p_rule->>'scope' and d.expires_at>now();
   end if;
  end if;
 elsif op='evidence_valid' then
  ok:=exists(select 1 from jsonb_array_elements(p_snapshot->'evidence') e where e->>'key'=p_rule->>'key');
 elsif op='decision_recorded' then
  select * into d from d5o_work_decisions where work_id=p_work and proof_id=p_proof and decision_right_key=p_rule->>'right' order by decided_at desc,id desc limit 1;
  ok:=found and d.outcome_key=p_rule->>'outcome';
 end if;
 if coalesce(ok,false) then return '[]'::jsonb;end if;
 return jsonb_build_array(jsonb_build_object('requirement',p_rule,'reason','requirement_unmet'));
end $$;
create function rybex_internal.d5o_m1_authority(p_work uuid,p_proof uuid,p_right text,p_actor jsonb,p_config jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare right_rule jsonb; role_rule jsonb; rule jsonb; assignment d5o_work_participants%rowtype; proof d5o_proof_packages%rowtype; key text; ex jsonb; links jsonb;
begin
 select value into right_rule from jsonb_array_elements(p_config->'rights') where value->>'decision_right_key'=p_right and value->>'status'='active';
 if right_rule is null or (right_rule->>'admin_override_allowed')::boolean or (right_rule->>'auditor_read_only')::boolean then raise exception 'wrong_authority';end if;
 select value into role_rule from jsonb_array_elements(p_config->'roles') where value->>'id'=right_rule->>'role_definition_id' and value->>'status'='active';
 select * into assignment from d5o_work_participants where work_id=p_work and profile_id=(p_actor->>'profile')::uuid and role_key=role_rule->>'role_key' and status='active' for share;
 if not found then raise exception 'wrong_authority';end if;
 if jsonb_typeof(role_rule->'eligibility_rule_json'->'workspaceRoles') is distinct from 'array'
 or not(role_rule->'eligibility_rule_json'->'workspaceRoles' ? (p_actor->>'workspace_role')) then raise exception 'wrong_authority';end if;
 rule:=right_rule->'approval_rule_json';
 if exists(select 1 from jsonb_object_keys(rule) k where k not in ('requires','forbidPreparer','distinctFactKeys','distinctDecisionRights','exceptionRuleKey'))
 or jsonb_typeof(rule->'forbidPreparer') is distinct from 'boolean'
 or jsonb_typeof(rule->'distinctFactKeys') is distinct from 'array'
 or jsonb_typeof(rule->'distinctDecisionRights') is distinct from 'array' then raise exception 'invalid_authority_rule';end if;
 perform rybex_internal.d5o_m1_rule_shape(rule->'requires');
 select * into strict proof from d5o_proof_packages where id=p_proof and work_id=p_work;
 if (rule->>'forbidPreparer')::boolean and proof.prepared_by=(p_actor->>'profile')::uuid then raise exception 'separation_of_duty';end if;
 for key in select jsonb_array_elements_text(rule->'distinctFactKeys') loop
  if exists(select 1 from jsonb_array_elements(proof.snapshot->'facts') x where x->>'fact_key'=key and x->>'actor_profile_id'=p_actor->>'profile') then raise exception 'separation_of_duty';end if;
 end loop;
 for key in select jsonb_array_elements_text(rule->'distinctDecisionRights') loop
  if exists(select 1 from d5o_work_decisions where work_id=p_work and proof_id=p_proof and decision_right_key=key and actor_id=auth.uid()) then raise exception 'separation_of_duty';end if;
 end loop;
 if rule ? 'exceptionRuleKey' then
  select value into ex from jsonb_array_elements(p_config->'exceptions') where value->>'exception_rule_key'=rule->>'exceptionRuleKey' and value->>'status'='active';
  select value into links from jsonb_array_elements(p_config->'exceptionRoles') where value->>'exception_rule_id'=ex->>'id' and value->>'role_key'=assignment.role_key;
  if ex is null or links is null then raise exception 'exception_not_permitted';end if;
 end if;
 return p_actor||jsonb_build_object('assignment',to_jsonb(assignment),'role',role_rule,'right',right_rule,'rule',rule,'exceptionRuleKey',rule->>'exceptionRuleKey','exceptionRule',ex,'exceptionRole',links);
end $$;

create function rybex_internal.d5o_m1_guard_child() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare w d5o_work_records%rowtype; proof d5o_proof_packages%rowtype; rationale jsonb; k text; wid uuid;
begin
 wid:=case when TG_OP='DELETE' then OLD.work_id else NEW.work_id end;
 select workspace_id into strict w.workspace_id from d5o_work_records where id=wid;
 perform pg_advisory_xact_lock(hashtextextended('d5o-m1:'||w.workspace_id,0));
 select * into strict w from d5o_work_records where id=wid for update;
 if TG_OP='DELETE' then raise exception 'immutable_work_history';end if;
 if NEW.workspace_id<>w.workspace_id then raise exception 'cross_workspace';end if;
 if TG_TABLE_NAME in ('d5o_work_facts','d5o_work_decisions','d5o_work_outcomes','d5o_work_sources','d5o_work_relations') and TG_OP<>'INSERT' then raise exception 'immutable_work_history';end if;
 if TG_TABLE_NAME='d5o_work_relations' then
  rationale:=NEW.independence_rationale;
  foreach k in array array['authorization','scope','ownership','commercial','readiness','execution','acceptance','outcome'] loop
   if coalesce(rationale->>k,'') not in ('independent','shared','not_applicable') then raise exception 'identity_rationale_required';end if;
  end loop;
  if rationale->>'scope'<>'independent' or not('independent'=any(array[rationale->>'authorization',rationale->>'acceptance',rationale->>'outcome'])) then raise exception 'independent_obligation_required';end if;
  if exists(with recursive ancestors(id) as (select NEW.related_work_id union select r.related_work_id from d5o_work_relations r join ancestors a on r.work_id=a.id) select 1 from ancestors where id=NEW.work_id) then raise exception 'lineage_cycle';end if;
 elsif TG_TABLE_NAME='d5o_work_participants' then
  if not exists(select 1 from user_profiles p join workspace_memberships m on m.user_profile_id=p.id and m.user_id=p.user_id where p.id=NEW.profile_id and p.user_id=p.auth_user_id and p.status='active' and m.workspace_id=w.workspace_id and m.status='active') then raise exception 'invalid_participant';end if;
  if NEW.configuration_version_id<>w.configuration_version_id then raise exception 'configuration_mismatch';end if;
  update d5o_work_records set record_version=record_version+1 where id=wid;
 elsif TG_TABLE_NAME='d5o_work_facts' then
  if not exists(select 1 from user_profiles p join workspace_memberships m on m.user_profile_id=p.id and m.user_id=p.user_id where p.id=NEW.actor_profile_id and p.user_id=p.auth_user_id and m.workspace_id=w.workspace_id) then raise exception 'invalid_fact_provenance';end if;
  if NEW.fact_revision<>coalesce((select max(fact_revision) from d5o_work_facts where work_id=wid and fact_key=NEW.fact_key),0)+1 then raise exception 'fact_revision_conflict';end if;
  update d5o_work_records set record_version=record_version+1 where id=wid;
 elsif TG_TABLE_NAME='d5o_proof_items' then
  select * into strict proof from d5o_proof_packages where id=NEW.proof_id and work_id=wid for update;
  if proof.status<>'draft' or proof.snapshot is not null then raise exception 'immutable_proof';end if;
 elsif TG_TABLE_NAME='d5o_proof_packages' and TG_OP='UPDATE' then
  if OLD.snapshot is not null and (NEW.snapshot is distinct from OLD.snapshot or NEW.prepared_by<>OLD.prepared_by or NEW.proof_package_revision<>OLD.proof_package_revision or NEW.submitted_record_version<>OLD.submitted_record_version or NEW.configuration_digest<>OLD.configuration_digest or NEW.submitted_at<>OLD.submitted_at or NEW.status='draft') then raise exception 'immutable_proof';end if;
 elsif TG_TABLE_NAME='d5o_work_outcomes' then
  if not exists(select 1 from d5o_work_decisions where id=NEW.decision_id and work_id=wid and workspace_id=NEW.workspace_id) then raise exception 'cross_workspace';end if;
 end if;
 return NEW;
end $$;
create function rybex_internal.d5o_m1_emit(p_work uuid,p_command text,p_action text,p_actor uuid,p_before jsonb,p_after jsonb,p_detail jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w d5o_work_records%rowtype; a uuid; e uuid;
begin
 select * into strict w from d5o_work_records where id=p_work;
 a:=rybex_internal.append_audit_event(w.workspace_id,null,'d5o_work_record',w.id,p_command,p_action,p_before->>'lifecycle_state',w.lifecycle_state,p_actor,p_command,p_before,p_after,p_detail);
 e:=rybex_internal.append_domain_event(w.workspace_id,null,'d5o_work_record',w.id,w.record_version,p_action,1,p_command,p_command,p_actor,p_detail);
 return jsonb_build_object('audit',a,'event',e);
end $$;
create function public.d5o_create_work_record_v1(p_workspace_id uuid,p_command_id text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; cfg jsonb; digest text; request_hash text; cached command_idempotency%rowtype; w d5o_work_records%rowtype; events jsonb; result jsonb;
begin
 perform rybex_internal.d5o_m1_lock(p_workspace_id);actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
 if actor->>'workspace_role'='read_only_auditor' then raise exception 'forbidden';end if;
 if length(coalesce(p_command_id,'')) not between 8 and 200 or jsonb_typeof(p_payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('title','workTypeKey','gateKey','configurationVersionId','source','relation')) then raise exception 'invalid_command';end if;
 request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('create',auth.uid(),p_workspace_id,p_payload));
 select * into cached from command_idempotency where workspace_id=p_workspace_id and command_id=p_command_id for update;
 if found then
  if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash then raise exception 'idempotency_mismatch';end if;
  if cached.result_status<>'completed' then raise exception 'command_in_progress';end if;
  return cached.result_payload||jsonb_build_object('replayed',true);
 end if;
 cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,null,p_payload->>'workTypeKey',p_payload->>'gateKey');
 if cfg->>'versionId' is distinct from p_payload->>'configurationVersionId' then raise exception 'configuration_mismatch';end if;
 perform rybex_internal.d5o_m1_rule_shape(cfg->'gate'->'entry_rule_json');perform rybex_internal.d5o_m1_rule_shape(cfg->'gate'->'exit_rule_json');
 if coalesce(cfg->'workType'->'lifecycle_json'->>'initialState','')='' then raise exception 'invalid_lifecycle';end if;
 digest:=rybex_internal.d5o_m1_digest(cfg);
 insert into d5o_work_records(workspace_id,configuration_tenant_id,configuration_version_id,work_type_key,gate_key,configuration_digest,configuration_snapshot,title,owner_profile_id,lifecycle_state,created_by)
 values(p_workspace_id,(cfg->>'tenantId')::uuid,(cfg->>'versionId')::uuid,p_payload->>'workTypeKey',p_payload->>'gateKey',digest,cfg,p_payload->>'title',(actor->>'profile')::uuid,cfg->'workType'->'lifecycle_json'->>'initialState',auth.uid()) returning * into w;
 if p_payload ? 'source' then
  if coalesce(p_payload->'source'->>'system','')='' or coalesce(p_payload->'source'->>'type','')='' or coalesce(p_payload->'source'->>'key','')='' then raise exception 'invalid_source';end if;
  insert into d5o_work_sources(workspace_id,work_id,source_system,entity_type,source_key) values(p_workspace_id,w.id,p_payload->'source'->>'system',p_payload->'source'->>'type',p_payload->'source'->>'key');
 end if;
 if p_payload ? 'relation' then
  insert into d5o_work_relations(workspace_id,work_id,related_work_id,relation_type,independence_rationale,created_by) values(p_workspace_id,w.id,(p_payload->'relation'->>'workId')::uuid,p_payload->'relation'->>'type',p_payload->'relation'->'rationale',auth.uid());
 end if;
 events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'work.created',auth.uid(),'{}',to_jsonb(w),jsonb_build_object('configurationDigest',digest));
 result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,'events',events);
 insert into command_idempotency(workspace_id,command_id,command_type,entity_type,entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at) values(p_workspace_id,p_command_id,'d5o.create.v1','d5o_work_record',w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
 return result;
end $$;

create function public.d5o_execute_work_command_v1(p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_proof_revision integer,p_command_id text,p_kind text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; w d5o_work_records%rowtype; before_row jsonb; cfg jsonb; digest text; cached command_idempotency%rowtype; request_hash text;
 proof d5o_proof_packages%rowtype; live_snapshot jsonb; unmet jsonb; authority jsonb; outcome jsonb; events jsonb; result jsonb; decision uuid; revision integer; req jsonb; ex jsonb;
begin
 perform rybex_internal.d5o_m1_lock(p_workspace_id);actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
 select * into w from d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'forbidden';end if;
 if length(coalesce(p_command_id,'')) not between 8 and 200 or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_command';end if;
 if actor->>'workspace_role'='read_only_auditor' then raise exception 'forbidden';end if;
 request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('execute',auth.uid(),p_workspace_id,p_work_id,p_expected_version,p_proof_revision,p_kind,p_payload));
 select * into cached from command_idempotency where workspace_id=p_workspace_id and command_id=p_command_id for update;
 if found then
  if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash then raise exception 'idempotency_mismatch';end if;
  if cached.result_status<>'completed' then raise exception 'command_in_progress';end if;
  return cached.result_payload||jsonb_build_object('replayed',true);
 end if;
 if p_expected_version is null or w.record_version<>p_expected_version then raise exception 'concurrency_conflict';end if;
 cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
 if cfg->>'tenantId'<>w.configuration_tenant_id::text or rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
 before_row:=to_jsonb(w);
 if p_kind<>'decide' and w.owner_profile_id<>(actor->>'profile')::uuid then raise exception 'wrong_authority';end if;
 if p_kind in ('new_proof','add_evidence','submit_proof','decide') and w.lifecycle_state=cfg->'workType'->'lifecycle_json'->>'completeState' then raise exception 'work_closed';end if;
 if p_kind in ('add_evidence','submit_proof','decide') then
  select * into proof from d5o_proof_packages where work_id=w.id and proof_package_revision=p_proof_revision for update;
  if not found or p_proof_revision<>(select max(proof_package_revision) from d5o_proof_packages where work_id=w.id) then raise exception 'invalid_proof_revision';end if;
 end if;
 case p_kind
 when 'metadata' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'title') or jsonb_typeof(p_payload->'title') is distinct from 'string' then raise exception 'invalid_command';end if;
  update d5o_work_records set title=p_payload->>'title' where id=w.id;
 when 'relate' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('workId','type','rationale')) then raise exception 'invalid_command';end if;
  insert into d5o_work_relations(workspace_id,work_id,related_work_id,relation_type,independence_rationale,created_by) values(p_workspace_id,w.id,(p_payload->>'workId')::uuid,p_payload->>'type',p_payload->'rationale',auth.uid());
 when 'reopen' then
  if coalesce(trim(p_payload->>'reason'),'')='' or cfg->'workType'->'lifecycle_json'->>'reopenAuthority'<>'owner' or w.lifecycle_state<>cfg->'workType'->'lifecycle_json'->>'completeState' then raise exception 'reopen_not_permitted';end if;
  update d5o_work_records set lifecycle_state=cfg->'workType'->'lifecycle_json'->>'initialState' where id=w.id;
 when 'new_proof' then
  if p_payload<>'{}'::jsonb then raise exception 'invalid_command';end if;
  select coalesce(max(proof_package_revision),0)+1 into revision from d5o_proof_packages where work_id=w.id;
  insert into d5o_proof_packages(workspace_id,work_id,proof_package_revision,prepared_by,configuration_digest) values(p_workspace_id,w.id,revision,(actor->>'profile')::uuid,w.configuration_digest) returning * into proof;
 when 'add_evidence' then
  if proof.status<>'draft' then raise exception 'immutable_proof';end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('requirementKey','evidenceId','evidenceVersion')) then raise exception 'invalid_command';end if;
  if not exists(select 1 from jsonb_array_elements(cfg->'requirements') r join jsonb_array_elements(cfg->'evidenceTypes') t on r->>'evidence_type_id'=t->>'id' where t->>'evidence_type_key'=p_payload->>'requirementKey' and r->>'status'='active' and t->>'status'='active') then raise exception 'unknown_evidence_requirement';end if;
  insert into d5o_proof_items(workspace_id,work_id,proof_id,requirement_key,evidence_object_id,evidence_version) values(p_workspace_id,w.id,proof.id,p_payload->>'requirementKey',(p_payload->>'evidenceId')::uuid,(p_payload->>'evidenceVersion')::integer);
  perform rybex_internal.d5o_m1_snapshot(w.id,proof.id);
 when 'submit_proof' then
  if p_payload<>'{}'::jsonb or proof.status<>'draft' then raise exception 'invalid_proof_revision';end if;
  live_snapshot:=rybex_internal.d5o_m1_snapshot(w.id,proof.id);
  unmet:=rybex_internal.d5o_m1_evaluate(cfg->'gate'->'entry_rule_json',w.id,proof.id,live_snapshot,cfg);
  for req in select t from jsonb_array_elements(cfg->'requirements') r join jsonb_array_elements(cfg->'evidenceTypes') t on r->>'evidence_type_id'=t->>'id' where r->>'status'='active' and r->>'requirement_level' in ('required','blocking') loop
   unmet:=unmet||rybex_internal.d5o_m1_evaluate(jsonb_build_object('op','evidence_valid','key',req->>'evidence_type_key'),w.id,proof.id,live_snapshot,cfg);
  end loop;
  if unmet<>'[]'::jsonb then raise exception 'readiness_blocked' using detail=unmet::text;end if;
  update d5o_proof_packages set status='submitted',snapshot=live_snapshot,submitted_at=now(),submitted_record_version=w.record_version,configuration_digest=w.configuration_digest where id=proof.id;
 when 'decide' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('rightKey','reason','scopeKey','expiresAt')) then raise exception 'invalid_command';end if;
  if proof.status<>'submitted' or proof.snapshot is null or coalesce(trim(p_payload->>'reason'),'')='' then raise exception 'invalid_proof_revision';end if;
  live_snapshot:=rybex_internal.d5o_m1_snapshot(w.id,proof.id);
  if live_snapshot<>proof.snapshot then raise exception 'proof_revision_stale';end if;
  authority:=rybex_internal.d5o_m1_authority(w.id,proof.id,p_payload->>'rightKey',actor,cfg);
  select value into outcome from jsonb_array_elements(cfg->'outcomes') where value->>'outcome_key'=authority->'right'->>'outcome_key' and value->>'status'='active';
  if outcome is null then raise exception 'invalid_outcome';end if;
  unmet:=rybex_internal.d5o_m1_evaluate(authority->'rule'->'requires',w.id,proof.id,live_snapshot,cfg);
  if (outcome->'consequence_json'->>'final')::boolean then unmet:=unmet||rybex_internal.d5o_m1_evaluate(cfg->'gate'->'exit_rule_json',w.id,proof.id,live_snapshot,cfg);end if;
  if unmet<>'[]'::jsonb then raise exception 'readiness_blocked' using detail=unmet::text;end if;
  if outcome->>'outcome_type'='exception' then
   ex:=authority->'exceptionRule';
   if ex is null or ex='null'::jsonb or p_payload->>'scopeKey' is distinct from ex->'waiver_rule_json'->>'scope' or (p_payload->>'expiresAt')::timestamptz<=now() or p_payload->>'expiresAt' is null then raise exception 'invalid_exception';end if;
  elsif p_payload ? 'scopeKey' or p_payload ? 'expiresAt' then raise exception 'invalid_command';end if;
  if outcome->>'outcome_type' in ('hold','stop','recycle') then update d5o_proof_packages set status='held' where id=proof.id;end if;
  if outcome->'consequence_json' ? 'state' then update d5o_work_records set lifecycle_state=outcome->'consequence_json'->>'state' where id=w.id;end if;
 else raise exception 'unknown_command';end case;
 update d5o_work_records set record_version=record_version+1 where id=w.id returning * into w;
 events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'work.'||p_kind,auth.uid(),before_row,to_jsonb(w),jsonb_build_object('payload',p_payload,'proofId',proof.id,'configurationDigest',w.configuration_digest));
 if p_kind='decide' then
  insert into d5o_work_decisions(workspace_id,work_id,proof_id,decision_right_key,outcome_key,outcome_type,actor_id,actor_profile_id,authority_snapshot,configuration_snapshot,proof_snapshot,before_version,after_version,before_state,after_state,reason,scope_key,expires_at,command_id,audit_event_id,domain_event_id)
  values(p_workspace_id,w.id,proof.id,p_payload->>'rightKey',outcome->>'outcome_key',outcome->>'outcome_type',auth.uid(),(actor->>'profile')::uuid,authority,cfg,proof.snapshot,p_expected_version,w.record_version,before_row->>'lifecycle_state',w.lifecycle_state,p_payload->>'reason',p_payload->>'scopeKey',(p_payload->>'expiresAt')::timestamptz,p_command_id,(events->>'audit')::uuid,(events->>'event')::uuid) returning id into decision;
  insert into d5o_work_outcomes(workspace_id,work_id,decision_id,result) values(p_workspace_id,w.id,decision,jsonb_build_object('outcome',outcome,'commitments',coalesce((select jsonb_agg(to_jsonb(c)) from d5o_work_commitments c where c.work_id=w.id),'[]'::jsonb),'valueRealized',false));
 end if;
 result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,'proofRevision',proof.proof_package_revision,'state',w.lifecycle_state,'decisionId',decision,'events',events);
 insert into command_idempotency(workspace_id,command_id,command_type,entity_type,entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at) values(p_workspace_id,p_command_id,'d5o.'||p_kind||'.v1','d5o_work_record',w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
 return result;
end $$;

create function public.d5o_load_work_record_v1(p_workspace_id uuid,p_work_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; w d5o_work_records%rowtype; cfg jsonb; proof d5o_proof_packages%rowtype; snap jsonb; unmet jsonb:='[]'; unavailable text; rights jsonb; r jsonb; auth_basis jsonb; actions jsonb:='[]';
begin
 actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
 select * into w from d5o_work_records where id=p_work_id and workspace_id=p_workspace_id;
 if not found then raise exception 'forbidden';end if;
 if exists(select 1 from d5o_proof_items i join evidence_objects e on e.id=i.evidence_object_id where i.work_id=w.id and (e.workspace_id<>p_workspace_id or (e.project_id is not null and not public.can_access_project(e.project_id))))
 or exists(select 1 from d5o_proof_packages p cross join lateral jsonb_array_elements(coalesce(p.snapshot->'evidence','[]')) e where p.work_id=w.id and nullif(e->'object'->>'project_id','') is not null and not public.can_access_project((e->'object'->>'project_id')::uuid)) then raise exception 'evidence_forbidden';end if;
 begin
  cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
  if rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
 exception when others then unavailable:=SQLERRM;end;
 select * into proof from d5o_proof_packages where work_id=w.id order by proof_package_revision desc limit 1;
 if unavailable is null and proof.id is not null then
  begin
   snap:=rybex_internal.d5o_m1_snapshot(w.id,proof.id);
   if proof.snapshot is not null and snap<>proof.snapshot then raise exception 'proof_revision_stale';end if;
   unmet:=rybex_internal.d5o_m1_evaluate(cfg->'gate'->'exit_rule_json',w.id,proof.id,snap,cfg);
   for r in select value from jsonb_array_elements(cfg->'rights') where value->>'status'='active' loop
    begin
     auth_basis:=rybex_internal.d5o_m1_authority(w.id,proof.id,r->>'decision_right_key',actor,cfg);
     actions:=actions||jsonb_build_array(jsonb_build_object('right',r->>'decision_right_key','label',r->>'label','blockers',rybex_internal.d5o_m1_evaluate(auth_basis->'rule'->'requires',w.id,proof.id,snap,cfg)));
    exception when others then null;end;
   end loop;
  exception when others then unmet:=jsonb_build_array(jsonb_build_object('reason',SQLERRM));end;
 end if;
 return jsonb_build_object('work',to_jsonb(w),'actor',actor,'configurationAvailable',unavailable is null,'configurationError',unavailable,
 'proof',to_jsonb(proof),'blockers',unmet,'actions',actions,'ownerCanPrepare',w.owner_profile_id=(actor->>'profile')::uuid and actor->>'workspace_role'<>'read_only_auditor',
 'participants',coalesce((select jsonb_agg(to_jsonb(p)) from d5o_work_participants p where p.work_id=w.id),'[]'),
 'proofRevisions',coalesce((select jsonb_agg(to_jsonb(p) order by proof_package_revision) from d5o_proof_packages p where p.work_id=w.id),'[]'),
 'decisions',coalesce((select jsonb_agg(to_jsonb(d) order by decided_at,id) from d5o_work_decisions d where d.work_id=w.id),'[]'),
 'outcomes',coalesce((select jsonb_agg(to_jsonb(o)) from d5o_work_outcomes o where o.work_id=w.id),'[]'),
 'commitments',coalesce((select jsonb_agg(to_jsonb(c)) from d5o_work_commitments c where c.work_id=w.id),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(a) order by occurred_at,id) from audit_events a where a.workspace_id=p_workspace_id and a.entity_type='d5o_work_record' and a.entity_id=w.id),'[]'));
end $$;
do $$
declare t text; f record;
begin
 foreach t in array array['d5o_work_records','d5o_work_sources','d5o_work_relations','d5o_work_participants','d5o_work_facts','d5o_proof_packages','d5o_proof_items','d5o_work_decisions','d5o_work_commitments','d5o_work_outcomes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  if t<>'d5o_work_records' then
   execute format('create index %I on public.%I(workspace_id,work_id)',t||'_scope_idx',t);
   execute format('create trigger d5o_m1_guard before insert or update or delete on public.%I for each row execute function rybex_internal.d5o_m1_guard_child()',t);
  end if;
 end loop;
 for f in select p.oid::regprocedure as identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rybex_internal' and p.proname like 'd5o_m1_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.identity);
 end loop;
end $$;
revoke all on function public.d5o_create_work_record_v1(uuid,text,jsonb),public.d5o_load_work_record_v1(uuid,uuid),public.d5o_execute_work_command_v1(uuid,uuid,integer,integer,text,text,jsonb) from public,anon,service_role;
grant execute on function public.d5o_create_work_record_v1(uuid,text,jsonb),public.d5o_load_work_record_v1(uuid,uuid),public.d5o_execute_work_command_v1(uuid,uuid,integer,integer,text,text,jsonb) to authenticated;
commit;
