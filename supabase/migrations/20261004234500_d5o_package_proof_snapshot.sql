-- Forward-only integration: package facts are part of the M1 submitted proof
-- snapshot, while prior Work Records without packages keep identical snapshots.
begin;
create or replace function rybex_internal.d5o_m1_snapshot(p_work uuid,p_proof uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w d5o_work_records%rowtype; item record; obj evidence_objects%rowtype; facts jsonb; evidence jsonb:='[]'; packages jsonb;
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
   perform 1 from evidence_links where evidence_object_id=obj.id and entity_id=w.id for share;
   evidence:=evidence||jsonb_build_array(jsonb_build_object('key',item.requirement_key,'object',to_jsonb(obj)));
  end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(f) order by f.fact_key),'[]') into facts from
 (select distinct on (fact_key) * from d5o_work_facts where work_id=p_work order by fact_key,fact_revision desc) f;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'key',p.package_key,'name',p.name,
  'installed',p.installed_percent,'tested',p.tested_percent,'accepted',p.accepted_percent,
  'status',p.status,'version',p.package_version) order by p.package_key),'[]') into packages
 from d5o_work_packages p where p.work_id=p_work;
 return jsonb_build_object('facts',facts,'evidence',evidence)
  || case when packages='[]'::jsonb then '{}'::jsonb else jsonb_build_object('packages',packages) end;
end $$;

create or replace function rybex_internal.d5o_work_package_open_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; cfg jsonb; latest_status text;
begin
 select * into w from public.d5o_work_records where id=NEW.work_id and workspace_id=NEW.workspace_id for update;
 if not found then raise exception 'forbidden';end if;
 cfg:=rybex_internal.d5o_m1_configuration(w.workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
 if rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
 if w.lifecycle_state=cfg->'workType'->'lifecycle_json'->>'completeState' then raise exception 'work_closed';end if;
 select status into latest_status from public.d5o_proof_packages where work_id=w.id order by proof_package_revision desc limit 1;
 if latest_status in ('submitted','held') then raise exception 'proof_revision_required';end if;
 return NEW;
end $$;
commit;
