-- Forward-only guard: a completed governed record cannot receive new package
-- facts or packages without an explicit M1 reopen decision.
begin;
create function rybex_internal.d5o_work_package_open_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb;
begin
 select * into w from public.d5o_work_records where id=NEW.work_id and workspace_id=NEW.workspace_id for update;
 if not found then raise exception 'forbidden';end if;
 cfg:=rybex_internal.d5o_m1_configuration(w.workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
 if rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
 if w.lifecycle_state=cfg->'workType'->'lifecycle_json'->>'completeState' then raise exception 'work_closed';end if;
 return NEW;
end $$;
create trigger d5o_work_package_open_guard before insert or update on public.d5o_work_packages
 for each row execute function rybex_internal.d5o_work_package_open_guard();
revoke all on function rybex_internal.d5o_work_package_open_guard() from public,anon,authenticated,service_role;
commit;
