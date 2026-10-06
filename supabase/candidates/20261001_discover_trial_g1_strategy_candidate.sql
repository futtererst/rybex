-- Synthetic G1 strategy eligibility. No production strategy or authority policy.
begin;
create table public.d5o_trial_g1_strategy_rules (
  id uuid primary key,
  configuration_version_id uuid not null references public.config_configuration_versions(id) on delete restrict,
  account_id uuid not null references public.d5o_trial_accounts(id) on delete restrict,
  site_id uuid not null references public.d5o_trial_sites(id) on delete restrict,
  work_type text not null check(length(btrim(work_type)) between 1 and 100),
  rule_version integer not null check(rule_version>0),
  rule_json jsonb not null check(jsonb_typeof(rule_json)='object'),
  rule_digest text not null check(rule_digest ~ '^[0-9a-f]{64}$'),
  status text not null check(status in ('trial_active','retired')),
  created_at timestamptz not null default now(),
  unique(configuration_version_id,account_id,site_id,work_type,rule_version)
);
create unique index d5o_trial_g1_one_active_strategy_rule
  on public.d5o_trial_g1_strategy_rules(configuration_version_id,account_id,site_id,work_type)
  where status='trial_active';
alter table public.d5o_trial_g1_strategy_rules enable row level security;
revoke all on public.d5o_trial_g1_strategy_rules from public,anon,authenticated,service_role;
create function rybex_internal.d5o_trial_g1_strategy_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'immutable_g1_strategy_rule'; end if;
  if old.status<>'trial_active' or new.status<>'retired'
    or (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
    raise exception 'immutable_g1_strategy_rule'; end if;
  return new;
end $$;
create trigger d5o_trial_g1_strategy_immutable before update or delete
  on public.d5o_trial_g1_strategy_rules for each row
  execute function rybex_internal.d5o_trial_g1_strategy_immutable();

create function rybex_internal.d5o_trial_g1_strategy_result(p_workspace_id uuid,p_work_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.d5o_work_records%rowtype; draft public.d5o_discover_capture_drafts%rowtype;
  rule public.d5o_trial_g1_strategy_rules%rowtype; account public.d5o_trial_accounts%rowtype;
  site public.d5o_trial_sites%rowtype; value jsonb;
begin
  select * into w from public.d5o_work_records
    where id=p_work_id and workspace_id=p_workspace_id for share;
  if w.id is null or w.work_type_key<>'discover-opportunity' then raise exception 'forbidden'; end if;
  select * into draft from public.d5o_discover_capture_drafts
    where work_id=w.id and workspace_id=p_workspace_id for share;
  select * into account from public.d5o_trial_accounts
    where id=draft.account_id and workspace_id=p_workspace_id
      and configuration_tenant_id=w.configuration_tenant_id and status='trial_active' for share;
  select * into site from public.d5o_trial_sites
    where id=draft.site_id and account_id=account.id and workspace_id=p_workspace_id
      and configuration_tenant_id=w.configuration_tenant_id and status='trial_active' for share;
  if account.id is null or site.id is null or account.organization_id<>site.organization_id then
    return jsonb_build_object('status','unconfigured','reason','Registered account and site are not current.'); end if;
  select * into rule from public.d5o_trial_g1_strategy_rules
    where configuration_version_id=w.configuration_version_id and account_id=account.id
      and site_id=site.id and work_type=draft.work_type and status='trial_active' for share;
  if rule.id is null then return jsonb_build_object('status','unconfigured',
    'reason','No active strategy rule covers this account, site and work type.'); end if;
  value:=rule.rule_json;
  if rule.rule_digest<>rybex_internal.d5o_m1_digest(value)
    or value-'accountId'-'siteId'-'workType'-'regionKey'-'strategyStatus'-'concentrationStatus'-'reservedMatter'-'rationale'<>'{}'::jsonb
    or value->>'accountId' is distinct from account.id::text
    or value->>'siteId' is distinct from site.id::text
    or value->>'workType' is distinct from draft.work_type
    or length(btrim(coalesce(value->>'regionKey','')))<3
    or length(btrim(coalesce(value->>'rationale','')))<20
    or value->>'strategyStatus' not in ('eligible','prohibited')
    or value->>'concentrationStatus' not in ('clear','review_required','unknown')
    or jsonb_typeof(value->'reservedMatter') is distinct from 'boolean' then
    return jsonb_build_object('status','unconfigured','reason','The strategy rule is incomplete or its digest changed.'); end if;
  if value->>'strategyStatus'='prohibited' then
    return jsonb_build_object('status','prohibited','reason',value->>'rationale',
      'ruleId',rule.id,'ruleDigest',rule.rule_digest,'ruleSnapshot',value); end if;
  if value->>'concentrationStatus'<>'clear' or value->'reservedMatter'='true'::jsonb then
    return jsonb_build_object('status','reserved','reason',value->>'rationale',
      'ruleId',rule.id,'ruleDigest',rule.rule_digest,'ruleSnapshot',value); end if;
  return jsonb_build_object('status','eligible','reason',value->>'rationale',
    'ruleId',rule.id,'ruleDigest',rule.rule_digest,'ruleSnapshot',value);
end $$;
revoke all on function rybex_internal.d5o_trial_g1_strategy_result(uuid,uuid)
  from public,anon,authenticated,service_role;
commit;
