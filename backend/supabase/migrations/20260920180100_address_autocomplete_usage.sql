-- Daily per-user address autocomplete budget (server-only).

create table private.address_autocomplete_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_day date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_day)
);

revoke all on private.address_autocomplete_daily_usage from public, anon, authenticated;

create or replace function private.consume_address_autocomplete_budget(
  p_user_id uuid,
  p_daily_user_limit integer default 100,
  p_daily_project_limit integer default 2900
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (timezone('utc', now()))::date;
  v_user_count integer;
  v_project_count integer;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into private.address_autocomplete_daily_usage as u (user_id, usage_day, request_count)
  values (p_user_id, v_day, 1)
  on conflict (user_id, usage_day)
  do update set request_count = u.request_count + 1
  returning request_count into v_user_count;

  select coalesce(sum(request_count), 0)
  into v_project_count
  from private.address_autocomplete_daily_usage
  where usage_day = v_day;

  if v_user_count > p_daily_user_limit or v_project_count > p_daily_project_limit then
    return false;
  end if;

  return true;
end;
$$;

revoke execute on function private.consume_address_autocomplete_budget(uuid, integer, integer)
  from public, anon, authenticated;

grant execute on function private.consume_address_autocomplete_budget(uuid, integer, integer)
  to service_role;

create or replace function public.consume_address_autocomplete_budget(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.consume_address_autocomplete_budget(p_user_id);
$$;

revoke all on function public.consume_address_autocomplete_budget(uuid) from public, anon, authenticated;
grant execute on function public.consume_address_autocomplete_budget(uuid) to service_role;
