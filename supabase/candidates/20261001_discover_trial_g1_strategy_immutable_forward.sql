-- Scratch forward: strategy changes retire a version; they cannot rewrite it.
begin;
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
commit;
