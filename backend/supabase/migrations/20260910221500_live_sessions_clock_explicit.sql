-- Live sessions always have real wall-clock start (and end when stopped).
-- Older rows left clock_*_explicit=false, so Job Detail View hid the start time.

update public.sessions
set
  clock_start_explicit = true,
  clock_times_explicit = true,
  calendar_date_explicit = true
where entry_mode = 'live'
  and deleted_at is null
  and (
    clock_start_explicit = false
    or clock_times_explicit = false
    or calendar_date_explicit = false
  );

update public.sessions
set
  clock_end_explicit = true,
  clock_times_explicit = true
where entry_mode = 'live'
  and session_status = 'ended'
  and ended_at is not null
  and deleted_at is null
  and clock_end_explicit = false;

-- Midnight auto-end should also mark the end clock explicit.
create or replace function public.end_stale_live_sessions()
returns integer
language plpgsql
security definer
set search_path = public, extensions
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
      now_local_date   := (now() at time zone tz)::date;
    exception when others then
      tz := 'UTC';
      start_local_date := (rec.started_at at time zone tz)::date;
      now_local_date   := (now() at time zone tz)::date;
    end;

    if now_local_date > start_local_date then
      end_at := ((start_local_date + interval '1 day' - interval '1 second')
                  at time zone tz);

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

      if found then
        ended_count := ended_count + 1;
      end if;
    end if;
  end loop;

  return ended_count;
end;
$$;

comment on function public.end_stale_live_sessions is
  'Ends any in-progress session whose started_tz local clock has rolled past midnight by setting ended_at to that day''s 23:59:59 local. Marks live clocks explicit for Job Detail View. Scheduled by pg_cron every 15 minutes.';
