-- Forward-only guard for synthetic review snapshots. The outer workspace ID
-- is already scoped by membership; nested work must stay in that workspace.
create function d5o_hosted.enforce_prototype_nested_scope()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_key text;
  v_item jsonb;
  v_publication jsonb;
begin
  select w.workspace_key into v_key from d5o_hosted.workspaces w
    where w.id = new.workspace_id;
  if v_key is null or new.state_json->>'workspace' is distinct from v_key then
    raise exception 'prototype_workspace_mismatch' using errcode = '23514';
  end if;
  if new.state_key in ('work', 'catalog') then
    if pg_catalog.jsonb_typeof(new.state_json->'records') is distinct from 'array' then
      raise exception 'prototype_records_invalid' using errcode = '23514';
    end if;
    for v_item in select value from pg_catalog.jsonb_array_elements(new.state_json->'records') loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
        or v_item->>'workspace' is distinct from v_key then
        raise exception 'prototype_record_workspace_mismatch' using errcode = '23514';
      end if;
    end loop;
  end if;
  if new.state_key = 'catalog' then
    if pg_catalog.jsonb_typeof(new.state_json->'packages') is distinct from 'array' then
      raise exception 'prototype_packages_invalid' using errcode = '23514';
    end if;
    for v_item in select value from pg_catalog.jsonb_array_elements(new.state_json->'packages') loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
        or pg_catalog.left(v_item->>'workId', pg_catalog.length(v_key) + 1) is distinct from v_key || '-' then
        raise exception 'prototype_package_workspace_mismatch' using errcode = '23514';
      end if;
    end loop;
  end if;
  if new.state_key = 'schedule' then
    if pg_catalog.jsonb_typeof(new.state_json->'assignments') is distinct from 'array'
      or pg_catalog.jsonb_typeof(new.state_json->'packageDemands') is distinct from 'array'
      or pg_catalog.jsonb_typeof(new.state_json->'publications') is distinct from 'array' then
      raise exception 'prototype_schedule_invalid' using errcode = '23514';
    end if;
    for v_item in
      select value from pg_catalog.jsonb_array_elements(new.state_json->'assignments')
      union all select value from pg_catalog.jsonb_array_elements(new.state_json->'packageDemands')
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
        or pg_catalog.left(v_item->>'workId', pg_catalog.length(v_key) + 1) is distinct from v_key || '-' then
        raise exception 'prototype_schedule_workspace_mismatch' using errcode = '23514';
      end if;
    end loop;
    for v_publication in select value from pg_catalog.jsonb_array_elements(new.state_json->'publications') loop
      if pg_catalog.jsonb_typeof(v_publication) is distinct from 'object'
        or pg_catalog.jsonb_typeof(v_publication->'assignments') is distinct from 'array' then
        raise exception 'prototype_publication_invalid' using errcode = '23514';
      end if;
      for v_item in select value from pg_catalog.jsonb_array_elements(v_publication->'assignments') loop
        if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
          or pg_catalog.left(v_item->>'workId', pg_catalog.length(v_key) + 1) is distinct from v_key || '-' then
          raise exception 'prototype_publication_workspace_mismatch' using errcode = '23514';
        end if;
      end loop;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function d5o_hosted.enforce_prototype_nested_scope() from public, anon, authenticated;

create trigger d5o_hosted_prototype_state_nested_scope
before insert or update on d5o_hosted.prototype_states
for each row execute function d5o_hosted.enforce_prototype_nested_scope();

create trigger d5o_hosted_prototype_revision_nested_scope
before insert or update on d5o_hosted.prototype_state_revisions
for each row execute function d5o_hosted.enforce_prototype_nested_scope();
