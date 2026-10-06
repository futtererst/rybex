-- Scratch-only correction to incomplete-field accumulation after initial apply.
begin;
create or replace function rybex_internal.d5o_trial_g1_validate_payload(p_payload jsonb,p_submit boolean)
returns text[] language plpgsql stable set search_path=public,pg_temp as $$
declare key text; value jsonb; missing text[]:=array[]::text[];
  text_keys text[]:=array['strategicRationale','customerRationale','technicalAssessment',
    'technicalRisk','capacityPosition','commercialRisk','pursuitPlan','knownUnknowns'];
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_payload) k
      where k<>all(text_keys||array['proposedCapAmount','proposedCapCurrency','nextOwnerProfileId'])) then
    raise exception 'invalid_assessment_payload'; end if;
  foreach key in array text_keys loop
    value:=p_payload->key;
    if value is not null and jsonb_typeof(value) not in ('string','null') then
      raise exception 'invalid_assessment_payload'; end if;
    if length(coalesce(p_payload->>key,''))>2000 then raise exception 'invalid_assessment_payload'; end if;
    if p_submit and key<>'knownUnknowns' and length(btrim(coalesce(p_payload->>key,'')))<20 then
      missing:=array_append(missing,key); end if;
  end loop;
  if p_payload ? 'proposedCapAmount' and jsonb_typeof(p_payload->'proposedCapAmount') not in ('number','null') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload->>'proposedCapAmount' is not null
    and ((p_payload->>'proposedCapAmount')::numeric<0 or (p_payload->>'proposedCapAmount')::numeric>1000000000) then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload ? 'proposedCapCurrency'
    and jsonb_typeof(p_payload->'proposedCapCurrency') not in ('string','null') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload->>'proposedCapCurrency' is not null
    and p_payload->>'proposedCapCurrency' not in ('USD','GBP','EUR') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload ? 'nextOwnerProfileId'
    and jsonb_typeof(p_payload->'nextOwnerProfileId') not in ('string','null') then
    raise exception 'invalid_assessment_payload'; end if;
  if p_payload->>'nextOwnerProfileId' is not null
    and p_payload->>'nextOwnerProfileId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_assessment_payload'; end if;
  if p_submit then
    if p_payload->>'proposedCapAmount' is null then missing:=array_append(missing,'proposedCapAmount'); end if;
    if p_payload->>'proposedCapCurrency' is null then missing:=array_append(missing,'proposedCapCurrency'); end if;
    if p_payload->>'nextOwnerProfileId' is null then missing:=array_append(missing,'nextOwnerProfileId'); end if;
  end if;
  return missing;
end $$;
commit;
