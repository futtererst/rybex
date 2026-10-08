-- Approved bounded cached-command configuration revalidation. Historical migrations remain unchanged.
create or replace function public.d5o_create_work_record_v1(p_workspace_id uuid,p_command_id text,p_payload jsonb) returns jsonb
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
  -- A cached create is governed by the original record pin, never today's default.
  select * into w from d5o_work_records where id=cached.entity_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'forbidden';end if;
 cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
 if cfg->>'tenantId'<>w.configuration_tenant_id::text or rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
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

create or replace function public.d5o_execute_work_command_v1(p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_proof_revision integer,p_command_id text,p_kind text,p_payload jsonb) returns jsonb
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
  -- Revalidate the pin on retries without re-executing the action or its concurrency check.
 cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
 if cfg->>'tenantId'<>w.configuration_tenant_id::text or rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
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
