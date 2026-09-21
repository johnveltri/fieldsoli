-- Loaded after migrations on `supabase db reset` (see config.toml [db.seed]).
-- Local-only overrides. Hosted projects do not run this file.

-- Address autocomplete: raise the per-user daily cap so local Geoapify
-- testing is not blocked by the production 100-request budget.
create or replace function public.consume_address_autocomplete_budget(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.consume_address_autocomplete_budget(p_user_id, 1000);
$$;

revoke all on function public.consume_address_autocomplete_budget(uuid) from public, anon, authenticated;
grant execute on function public.consume_address_autocomplete_budget(uuid) to service_role;
