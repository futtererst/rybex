-- Isolated, immutable hosted phase-contract source for future Work Records.
alter table d5o_hosted.configuration_versions
  add column manifest_json jsonb not null default '{}'::jsonb;

create function d5o_hosted.guard_configuration_version_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.status in ('published', 'superseded') and (
      new.tenant_id is distinct from old.tenant_id
      or new.version_number is distinct from old.version_number
      or new.source_sha256 is distinct from old.source_sha256
      or new.manifest_json is distinct from old.manifest_json
      or new.effective_from is distinct from old.effective_from
      or (old.status = 'superseded' and new.status <> 'superseded')
      or (old.status = 'published' and new.status not in ('published', 'superseded'))
    ) then
      raise exception 'published_configuration_immutable' using errcode = '23514';
    end if;
  end if;
  if new.status in ('published', 'superseded') and (
    new.effective_from is null
    or pg_catalog.jsonb_typeof(new.manifest_json) <> 'object'
    or case when pg_catalog.jsonb_typeof(new.manifest_json->'workTypes') = 'array'
      then pg_catalog.jsonb_array_length(new.manifest_json->'workTypes') = 0
      else true end
  ) then
    raise exception 'invalid_configuration_manifest' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger d5o_hosted_configuration_version_guard
before insert or update on d5o_hosted.configuration_versions
for each row execute function d5o_hosted.guard_configuration_version_v1();

create function d5o_hosted.guard_configuration_child_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_old uuid; v_new uuid;
begin
  if tg_op <> 'INSERT' then v_old := old.configuration_version_id; end if;
  if tg_op <> 'DELETE' then v_new := new.configuration_version_id; end if;
  if exists (select 1 from d5o_hosted.configuration_versions v
    where v.id in (v_old, v_new) and v.status in ('published', 'superseded')) then
    raise exception 'published_configuration_immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger d5o_hosted_work_type_guard
before insert or update or delete on d5o_hosted.configuration_work_types
for each row execute function d5o_hosted.guard_configuration_child_v1();
create trigger d5o_hosted_create_right_guard
before insert or update or delete on d5o_hosted.configuration_create_rights
for each row execute function d5o_hosted.guard_configuration_child_v1();

revoke all on function d5o_hosted.guard_configuration_version_v1() from public, anon, authenticated;
revoke all on function d5o_hosted.guard_configuration_child_v1() from public, anon, authenticated;
