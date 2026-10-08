-- Scratch E only. Reuse the already provisioned disposable reviewer trial password
-- for this separate synthetic finance email; no plaintext credential is stored here.
begin;
do $$ begin
  if (select count(*) from auth.users where id in
      ('ac000000-0000-4000-8000-000000000005','ac000000-0000-4000-8000-000000000006'))<>2
    or (select encrypted_password from auth.users
      where id='ac000000-0000-4000-8000-000000000005') !~ '^\$2[aby]\$'
    or (select email from auth.users where id='ac000000-0000-4000-8000-000000000006')
      is distinct from 'discover-a-finance@synthetic.invalid' then
    raise exception 'synthetic_login_fixture_mismatch'; end if;
end $$;
update auth.users finance set encrypted_password=reviewer.encrypted_password,updated_at=now()
from auth.users reviewer
where finance.id='ac000000-0000-4000-8000-000000000006'
  and reviewer.id='ac000000-0000-4000-8000-000000000005';
commit;
