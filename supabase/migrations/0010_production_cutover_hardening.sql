-- Foundation 0F production cutover hardening.
-- Evidence links may satisfy production requirements only when the managed object is uploaded and scanner-clean.

create or replace function public.enforce_clean_evidence_link_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  evidence evidence_objects%rowtype;
begin
  select *
  into evidence
  from evidence_objects
  where id = new.evidence_object_id;

  if not found then
    raise exception 'evidence_required' using errcode = 'P0001';
  end if;

  if evidence.upload_status <> 'uploaded' then
    raise exception 'evidence_not_uploaded' using errcode = 'P0001';
  end if;

  if evidence.scan_status <> 'clean' then
    raise exception 'evidence_scan_not_clean' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_links_require_clean_scan on evidence_links;
create trigger evidence_links_require_clean_scan
before insert or update of evidence_object_id
on evidence_links
for each row
execute function public.enforce_clean_evidence_link_v1();

comment on function public.enforce_clean_evidence_link_v1()
  is 'Foundation 0F: rejects evidence links unless the object is uploaded and scanner-clean.';
