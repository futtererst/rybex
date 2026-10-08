begin;
create or replace function rybex_internal.d5o_trial_spend_receipt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='d5o_trial_spend_requests' and exists(
    select 1 from public.d5o_trial_spend_requests r where r.id=new.id
      and (r.audit_event_id is null or r.domain_event_id is null)) then
    raise exception 'spend_receipt_missing'; end if;
  if tg_table_name='d5o_trial_spend_decisions' and exists(
    select 1 from public.d5o_trial_spend_decisions d where d.id=new.id
      and (d.audit_event_id is null or d.domain_event_id is null)) then
    raise exception 'spend_receipt_missing'; end if;
  return null;
end $$;
commit;

