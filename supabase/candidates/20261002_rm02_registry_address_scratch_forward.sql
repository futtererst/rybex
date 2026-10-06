-- Scratch E forward repair after initial RM02 candidate application.
-- For a fresh disposable database, use the updated candidate and fixture instead.
begin;
alter table public.d5o_trial_sites add column address_text text
  check(address_text is null or length(btrim(address_text)) between 10 and 500);
update public.d5o_trial_sites set address_text='100 Synthetic Campus Way, Albany, NY'
  where id='8977fdb0-e8b6-4fac-8ceb-bf40ef0654dd'
    and workspace_id='a2000000-0000-4000-8000-000000000001'
    and status='trial_active';
commit;
-- Then replace d5o_rm_list_jobs_v1 and d5o_rm_save_job_v1 from the updated candidate.
