-- Additive local-prototype foundation below the canonical M1 Work Record.
-- This migration does not accept packages or weaken M1 proof/decision authority.
begin;

create table public.d5o_work_packages (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 work_id uuid not null,
 package_key text not null check(length(trim(package_key)) between 1 and 120),
 name text not null check(length(trim(name)) between 1 and 180),
 owner_profile_id uuid not null references public.user_profiles(id),
 installed_percent numeric(5,2) not null default 0 check(installed_percent between 0 and 100),
 tested_percent numeric(5,2) not null default 0 check(tested_percent between 0 and installed_percent),
 accepted_percent numeric(5,2) not null default 0 check(accepted_percent between 0 and installed_percent),
 status text not null default 'planned' check(status in ('planned','in_progress','ready','accepted')),
 package_version integer not null default 1 check(package_version > 0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(work_id,package_key),
 unique(id,work_id,workspace_id),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create index d5o_work_packages_scope_idx on public.d5o_work_packages(workspace_id,work_id);
alter table public.d5o_work_packages enable row level security;
revoke all on public.d5o_work_packages from public,anon,authenticated;
grant all on public.d5o_work_packages to service_role;

create table public.d5o_lifecycle_actions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 work_id uuid not null,
 action text not null check(length(trim(action)) between 1 and 240),
 owner_profile_id uuid not null references public.user_profiles(id),
 due_at timestamptz,
 status text not null default 'planned' check(status in ('planned','active','complete','cancelled')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(work_id,workspace_id) references public.d5o_work_records(id,workspace_id)
);
create index d5o_lifecycle_actions_scope_idx on public.d5o_lifecycle_actions(workspace_id,work_id);
alter table public.d5o_lifecycle_actions enable row level security;
revoke all on public.d5o_lifecycle_actions from public,anon,authenticated;
grant all on public.d5o_lifecycle_actions to service_role;

create function public.d5o_execute_work_extension_v1(
 p_workspace_id uuid,p_work_id uuid,p_expected_version integer,p_command_id text,p_kind text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor jsonb; w public.d5o_work_records%rowtype; before_row jsonb; cfg jsonb;
 cached public.command_idempotency%rowtype; request_hash text; pkg public.d5o_work_packages%rowtype;
 installed numeric; tested numeric; resource_id uuid; events jsonb; result jsonb;
begin
 perform rybex_internal.d5o_m1_lock(p_workspace_id);
 actor:=rybex_internal.d5o_m1_actor(p_workspace_id);
 select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'forbidden';end if;
 cfg:=rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key);
 if cfg->>'tenantId'<>w.configuration_tenant_id::text or rybex_internal.d5o_m1_digest(cfg)<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
 if w.owner_profile_id<>(actor->>'profile')::uuid or actor->>'workspace_role'='read_only_auditor' then raise exception 'wrong_authority';end if;
 if length(coalesce(p_command_id,'')) not between 8 and 200 or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_command';end if;
 request_hash:=rybex_internal.d5o_m1_digest(jsonb_build_array('extension',auth.uid(),p_workspace_id,p_work_id,p_expected_version,p_kind,p_payload));
 select * into cached from public.command_idempotency where workspace_id=p_workspace_id and command_id=p_command_id for update;
 if found then
  if cached.actor_user_id<>auth.uid() or cached.request_hash<>request_hash then raise exception 'idempotency_mismatch';end if;
  if cached.result_status<>'completed' then raise exception 'command_in_progress';end if;
  return cached.result_payload||jsonb_build_object('replayed',true);
 end if;
 if p_expected_version is null or p_expected_version<>w.record_version then raise exception 'concurrency_conflict';end if;
 before_row:=to_jsonb(w);
 case p_kind
 when 'create_package' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('key','name'))
   or length(trim(coalesce(p_payload->>'key',''))) not between 1 and 120
   or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 180 then raise exception 'invalid_command';end if;
  insert into public.d5o_work_packages(workspace_id,work_id,package_key,name,owner_profile_id,created_by)
   values(p_workspace_id,p_work_id,trim(p_payload->>'key'),trim(p_payload->>'name'),(actor->>'profile')::uuid,auth.uid()) returning id into resource_id;
 when 'record_package_facts' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('packageId','installed','tested')) then raise exception 'invalid_command';end if;
  select * into pkg from public.d5o_work_packages where id=(p_payload->>'packageId')::uuid and work_id=p_work_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'package_unavailable';end if;
  installed:=(p_payload->>'installed')::numeric;tested:=(p_payload->>'tested')::numeric;
  if pkg.status='accepted' or installed is null or tested is null or installed not between pkg.installed_percent and 100
   or tested not between pkg.tested_percent and installed then raise exception 'invalid_package_facts';end if;
  update public.d5o_work_packages set installed_percent=installed,tested_percent=tested,
   status=case when status='planned' and installed>0 then 'in_progress' else status end,
   package_version=package_version+1,updated_at=now() where id=pkg.id;
  resource_id:=pkg.id;
 when 'plan_lifecycle_action' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('action','dueAt'))
   or length(trim(coalesce(p_payload->>'action',''))) not between 1 and 240 then raise exception 'invalid_command';end if;
  insert into public.d5o_lifecycle_actions(workspace_id,work_id,action,owner_profile_id,due_at,created_by)
   values(p_workspace_id,p_work_id,trim(p_payload->>'action'),(actor->>'profile')::uuid,(p_payload->>'dueAt')::timestamptz,auth.uid()) returning id into resource_id;
 else raise exception 'unknown_command';end case;
 update public.d5o_work_records set record_version=record_version+1 where id=w.id returning * into w;
 events:=rybex_internal.d5o_m1_emit(w.id,p_command_id,'work.'||p_kind,auth.uid(),before_row,to_jsonb(w),jsonb_build_object('payload',p_payload,'resourceId',resource_id,'configurationDigest',w.configuration_digest));
 result:=jsonb_build_object('success',true,'workId',w.id,'recordVersion',w.record_version,'resourceId',resource_id,'events',events);
 insert into public.command_idempotency(workspace_id,command_id,command_type,entity_type,entity_id,request_hash,actor_user_id,correlation_id,result_status,result_payload,completed_at)
  values(p_workspace_id,p_command_id,'d5o.'||p_kind||'.v1','d5o_work_record',w.id,request_hash,auth.uid(),p_command_id,'completed',result,now());
 return result;
end $$;

create function public.d5o_load_work_extensions_v1(p_workspace_id uuid,p_work_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype;
begin
 perform rybex_internal.d5o_m1_actor(p_workspace_id);
 select * into w from public.d5o_work_records where id=p_work_id and workspace_id=p_workspace_id;
 if not found then raise exception 'forbidden';end if;
 if rybex_internal.d5o_m1_digest(rybex_internal.d5o_m1_configuration(p_workspace_id,w.configuration_version_id,w.work_type_key,w.gate_key))<>w.configuration_digest then raise exception 'pinned_configuration_changed';end if;
 return jsonb_build_object('recordVersion',w.record_version,
  'packages',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from public.d5o_work_packages p where p.work_id=w.id),'[]'::jsonb),
  'lifecycleActions',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at,a.id) from public.d5o_lifecycle_actions a where a.work_id=w.id),'[]'::jsonb));
end $$;

revoke all on function public.d5o_execute_work_extension_v1(uuid,uuid,integer,text,text,jsonb),public.d5o_load_work_extensions_v1(uuid,uuid) from public,anon,service_role;
grant execute on function public.d5o_execute_work_extension_v1(uuid,uuid,integer,text,text,jsonb),public.d5o_load_work_extensions_v1(uuid,uuid) to authenticated;
commit;
