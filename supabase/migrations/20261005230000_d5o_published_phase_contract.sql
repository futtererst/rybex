-- Forward-only extension of the administrator publication manifest. The
-- M1 gate graph remains unchanged; this is the versioned prototype phase form
-- contract for Discover and Define. It is never trusted as database authority.
create or replace function rybex_internal.d5o_configuration_manifest_check(p_manifest jsonb)
returns void language plpgsql stable set search_path=public,pg_temp as $$
declare p jsonb; c jsonb; wt jsonb; ph jsonb; component jsonb; field_item jsonb; rule_item jsonb; k text;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_manifest) x where x not in ('synthetic','sourceSha256','d5oSourceVersionId','d5oPresentation'))
  then raise exception 'invalid_configuration_manifest'; end if;
  if p_manifest ? 'd5oSourceVersionId' then
    if jsonb_typeof(p_manifest->'d5oSourceVersionId') is distinct from 'string'
      or not exists(select 1 from config_configuration_versions where id=(p_manifest->>'d5oSourceVersionId')::uuid)
    then raise exception 'invalid_configuration_source'; end if;
  end if;
  if not p_manifest ? 'd5oPresentation' then return; end if;
  p := p_manifest->'d5oPresentation';
  if jsonb_typeof(p) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p) x where x not in ('schemaVersion','phaseLabels','changeReason','phaseContract'))
    or p->>'schemaVersion'<>'1'
    or jsonb_typeof(p->'phaseLabels') is distinct from 'object'
    or length(trim(coalesce(p->>'changeReason',''))) not between 8 and 240
  then raise exception 'invalid_presentation_manifest'; end if;
  for k in select jsonb_object_keys(p->'phaseLabels') loop
    if k not in ('discover','define','develop','design','deploy','operate')
      or jsonb_typeof(p->'phaseLabels'->k) is distinct from 'string'
      or length(trim(p->'phaseLabels'->>k)) not between 2 and 80
    then raise exception 'invalid_phase_label'; end if;
  end loop;
  if not p ? 'phaseContract' then return; end if;
  c := p->'phaseContract';
  if length(c::text)>100000 or jsonb_typeof(c) is distinct from 'object'
    or c->>'schemaVersion'<>'1' or jsonb_typeof(c->'workTypes') is distinct from 'array'
    or jsonb_array_length(c->'workTypes') not between 1 and 8
  then raise exception 'invalid_phase_contract'; end if;
  for wt in select value from jsonb_array_elements(c->'workTypes') loop
    if jsonb_typeof(wt) is distinct from 'object' or wt->>'schemaVersion'<>'1'
      or length(trim(coalesce(wt->>'workTypeKey',''))) not between 2 and 64
      or length(trim(coalesce(wt->>'workTypeLabel',''))) not between 2 and 100
      or jsonb_typeof(wt->'phases') is distinct from 'array'
      or jsonb_array_length(wt->'phases')<>6
    then raise exception 'invalid_phase_work_type'; end if;
    for ph in select value from jsonb_array_elements(wt->'phases') loop
      if ph->>'key' not in ('discover','define','develop','design','deploy','operate')
        or length(trim(coalesce(ph->>'label',''))) not between 2 and 100
        or length(trim(coalesce(ph->>'gate',''))) not between 2 and 120
        or jsonb_typeof(ph->'components') is distinct from 'array'
        or jsonb_array_length(ph->'components') not between 1 and 40
      then raise exception 'invalid_phase_definition'; end if;
      for component in select value from jsonb_array_elements(ph->'components') loop
        if length(trim(coalesce(component->>'key',''))) not between 2 and 80
          or length(trim(coalesce(component->>'label',''))) not between 2 and 120
          or component->>'kind' not in ('reference','typed_field','item_register','requirement_set','decision','evidence_reference','calculated_summary')
          or component->>'source' not in ('work','discover','define','delivery')
          or length(trim(coalesce(component->>'help',''))) not between 2 and 500
        then raise exception 'invalid_phase_component'; end if;
        if component ? 'fields' then
          if jsonb_typeof(component->'fields') is distinct from 'array' or jsonb_array_length(component->'fields')>30 then raise exception 'invalid_phase_fields'; end if;
          for field_item in select value from jsonb_array_elements(component->'fields') loop
            if length(trim(coalesce(field_item->>'key',''))) not between 2 and 80
              or length(trim(coalesce(field_item->>'label',''))) not between 2 and 120
              or field_item->>'kind' not in ('text','date','select')
              or jsonb_typeof(field_item->'required') is distinct from 'boolean'
            then raise exception 'invalid_phase_field'; end if;
          end loop;
        end if;
        if component ? 'rules' then
          if jsonb_typeof(component->'rules') is distinct from 'array' or jsonb_array_length(component->'rules')>30 then raise exception 'invalid_phase_rules'; end if;
          for rule_item in select value from jsonb_array_elements(component->'rules') loop
            if length(trim(coalesce(rule_item->>'key',''))) not between 2 and 80
              or rule_item->>'fact' not in ('discovery.need','discovery.fit','discovery.estimate.status','discovery.proposal.status','definition.outcome','definition.excludedScope','definition.deliveryApproach','definition.registers.scope_items','definition.registers.acceptance_criteria','definition.registers.milestones','definition.registers.dependencies','definition.registers.risks')
              or rule_item->>'operator' not in ('present','equals','rows_complete')
              or rule_item->>'requiredAt' not in ('draft','review','authorization')
              or length(trim(coalesce(rule_item->>'message',''))) not between 2 and 500
            then raise exception 'invalid_phase_rule'; end if;
          end loop;
        end if;
      end loop;
    end loop;
  end loop;
end $$;
