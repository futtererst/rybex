-- Narrow guard: candidates created by the D5O publication command cannot be
-- made the tenant default through a direct authenticated table update.
-- Historical configuration loaders and non-D5O pointers are unchanged.
create or replace function rybex_internal.d5o_guard_candidate_activation()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.active_configuration_version_id is distinct from old.active_configuration_version_id
    and current_user <> 'postgres'
    and exists (
      select 1 from config_configuration_versions v
      where v.id=new.active_configuration_version_id
        and v.config_manifest_json ? 'd5oSourceVersionId'
    )
  then raise exception 'configuration_activation_command_required'; end if;
  return new;
end $$;
drop trigger if exists d5o_guard_candidate_activation on config_tenants;
create trigger d5o_guard_candidate_activation
before update of active_configuration_version_id on config_tenants
for each row execute function rybex_internal.d5o_guard_candidate_activation();
