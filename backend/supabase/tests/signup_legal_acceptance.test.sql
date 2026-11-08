\set ON_ERROR_STOP on
begin;
insert into auth.users (id, raw_user_meta_data) values ('ab23c222-d0e5-4a11-839b-033a04ab8ae1', '{"signup_legal_v1":{"accepted":true,"termsVersion":"2026-11-02","privacyVersion":"2026-11-02","platform":"ios"}}');
insert into auth.users (id, raw_user_meta_data) values ('ab23c222-d0e5-4a11-839b-033a04ab8ae2', '{}');
do $$
begin
 if (select count(*) from public.legal_acceptances where user_id = 'ab23c222-d0e5-4a11-839b-033a04ab8ae1' and document_version = '2026-11-02') <> 2 then raise exception 'acceptance rows missing'; end if;
 if exists (select from public.legal_acceptances where user_id = 'ab23c222-d0e5-4a11-839b-033a04ab8ae2') then raise exception 'legacy acceptance invented'; end if;
 begin
   insert into auth.users (id, raw_user_meta_data) values ('ab23c222-d0e5-4a11-839b-033a04ab8ae3', '{"signup_legal_v1":{"accepted":true,"termsVersion":"2099","privacyVersion":"2026-11-02"}}');
   raise exception 'invalid version unexpectedly accepted';
 exception when raise_exception then
   if SQLERRM <> 'Invalid signup legal acceptance' then raise; end if;
 end;
end $$;
update auth.users set raw_user_meta_data = '{"signup_legal_v1":{"accepted":true,"termsVersion":"2026-11-02","privacyVersion":"2026-11-02"}}' where id = 'ab23c222-d0e5-4a11-839b-033a04ab8ae2';
do $$ begin if exists (select from public.legal_acceptances where user_id = 'ab23c222-d0e5-4a11-839b-033a04ab8ae2') then raise exception 'metadata update created acceptance'; end if; end $$;
rollback;
