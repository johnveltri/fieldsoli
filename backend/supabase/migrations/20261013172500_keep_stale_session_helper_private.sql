-- The live-session clock migration updated the helper in public after the
-- hardening migration moved it to private. Keep the updated implementation
-- behind the existing private cron entry point.
create or replace function private.end_stale_live_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended_count integer := 0;
  rec record;
  tz text;
  start_local_date date;
  now_local_date date;
  end_at timestamptz;
begin
  for rec in
    select id, started_at, started_tz
    from public.sessions
    where session_status = 'in_progress'
      and deleted_at is null
  loop
    tz := coalesce(rec.started_tz, 'UTC');
    begin
      start_local_date := (rec.started_at at time zone tz)::date;
      now_local_date := (now() at time zone tz)::date;
    exception when others then
      tz := 'UTC';
      start_local_date := (rec.started_at at time zone tz)::date;
      now_local_date := (now() at time zone tz)::date;
    end;

    if now_local_date > start_local_date then
      end_at := ((start_local_date + interval '1 day' - interval '1 second') at time zone tz);
      update public.sessions
      set session_status = 'ended',
          ended_at = end_at,
          clock_end_explicit = true,
          clock_times_explicit = true,
          clock_start_explicit = true,
          calendar_date_explicit = true
      where id = rec.id
        and session_status = 'in_progress'
        and deleted_at is null;

      if found then ended_count := ended_count + 1; end if;
    end if;
  end loop;
  return ended_count;
end;
$$;

comment on function private.end_stale_live_sessions() is
  'Ends in-progress sessions whose local date has rolled over and marks their clock fields explicit. Runs from the private pg_cron job.';

drop function if exists public.end_stale_live_sessions();
