-- Forward-only extension of the shared M1 requirement evaluator. Existing
-- published versions and their pinned snapshots are not changed. A new pack
-- may guard each decision by current Work Record position and a prior durable
-- decision without relying on a scenario-specific workflow branch.
begin;

create or replace function rybex_internal.d5o_m1_rule_shape(p_rule jsonb,p_depth integer default 0) returns void
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
 when 'decision_recorded','decision_recorded_prior' then
  allowed:=array['op','right','outcome'];if jsonb_typeof(p_rule->'right') is distinct from 'string' or jsonb_typeof(p_rule->'outcome') is distinct from 'string' then raise exception 'invalid_rule';end if;
 when 'state_equals' then
  allowed:=array['op','value'];if jsonb_typeof(p_rule->'value') is distinct from 'string' or coalesce(p_rule->>'value','')='' then raise exception 'invalid_rule';end if;
 when 'exception_satisfies' then
  allowed:=array['op','key','value','exception','scope'];if jsonb_typeof(p_rule->'key') is distinct from 'string' or not(p_rule ? 'value') or jsonb_typeof(p_rule->'exception') is distinct from 'string' or jsonb_typeof(p_rule->'scope') is distinct from 'string' then raise exception 'invalid_rule';end if;
 else raise exception 'unknown_rule_operator';end case;
 if exists(select 1 from jsonb_object_keys(p_rule) k where not(k=any(allowed))) then raise exception 'unknown_rule_field';end if;
end $$;

create or replace function rybex_internal.d5o_m1_evaluate(p_rule jsonb,p_work uuid,p_proof uuid,p_snapshot jsonb,p_config jsonb) returns jsonb
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
 elsif op='state_equals' then
  ok:=exists(select 1 from d5o_work_records w where w.id=p_work and w.lifecycle_state=p_rule->>'value');
 elsif op='decision_recorded' then
  select * into d from d5o_work_decisions where work_id=p_work and proof_id=p_proof and decision_right_key=p_rule->>'right' order by decided_at desc,id desc limit 1;
  ok:=found and d.outcome_key=p_rule->>'outcome';
 elsif op='decision_recorded_prior' then
  -- The latest decision for a right governs; a later hold cannot be bypassed
  -- by citing an older approval on a different proof revision.
  select * into d from d5o_work_decisions where work_id=p_work and decision_right_key=p_rule->>'right' order by decided_at desc,id desc limit 1;
  ok:=found and d.outcome_key=p_rule->>'outcome';
 end if;
 if coalesce(ok,false) then return '[]'::jsonb;end if;
 return jsonb_build_array(jsonb_build_object('requirement',p_rule,'reason','requirement_unmet'));
end $$;

-- These helpers belong to the internal schema. Do not expose privileged
-- execution to anon/authenticated through the Data API.
revoke all on function rybex_internal.d5o_m1_rule_shape(jsonb,integer) from public,anon,authenticated;
revoke all on function rybex_internal.d5o_m1_evaluate(jsonb,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
commit;
