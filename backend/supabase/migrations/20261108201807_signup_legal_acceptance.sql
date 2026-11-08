-- Preserve the acceptance declared with a new mobile signup. Existing clients do
-- not send this envelope and continue through the normal reacceptance gate.
create or replace function private.record_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  declaration jsonb := new.raw_user_meta_data -> 'signup_legal_v1';
  terms_version text;
  privacy_version text;
  app_version text;
  platform_name text;
begin
  if declaration is null then
    return new;
  end if;
  if jsonb_typeof(declaration) <> 'object'
     or declaration -> 'accepted' is distinct from 'true'::jsonb then
    raise exception 'Invalid signup legal acceptance';
  end if;
  terms_version := declaration ->> 'termsVersion';
  privacy_version := declaration ->> 'privacyVersion';
  app_version := declaration ->> 'appVersion';
  platform_name := declaration ->> 'platform';
  if terms_version is distinct from '2026-11-02'
     or privacy_version is distinct from '2026-11-02'
     or (app_version is not null and length(app_version) > 64)
     or (platform_name is not null and length(platform_name) > 32) then
    raise exception 'Invalid signup legal acceptance';
  end if;
  insert into public.legal_acceptances
    (user_id, document_type, document_version, source, app_version, platform)
  values
    (new.id, 'terms', terms_version, 'mobile_signup', app_version, platform_name),
    (new.id, 'privacy_policy', privacy_version, 'mobile_signup', app_version, platform_name)
  on conflict (user_id, document_type, document_version) do nothing;
  return new;
end;
$$;

revoke all on function private.record_signup_legal_acceptance() from public, anon, authenticated;

create trigger record_signup_legal_acceptance
  after insert on auth.users
  for each row execute function private.record_signup_legal_acceptance();
