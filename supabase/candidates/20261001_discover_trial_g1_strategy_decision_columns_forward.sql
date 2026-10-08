-- Existing scratch decisions remain immutable and show null strategy basis.
begin;
alter table public.d5o_trial_g1_decisions
  add column strategy_rule_id uuid references public.d5o_trial_g1_strategy_rules(id) on delete restrict,
  add column strategy_rule_digest text check(strategy_rule_digest is null or strategy_rule_digest ~ '^[0-9a-f]{64}$'),
  add column strategy_rule_snapshot jsonb check(strategy_rule_snapshot is null or jsonb_typeof(strategy_rule_snapshot)='object');
commit;
