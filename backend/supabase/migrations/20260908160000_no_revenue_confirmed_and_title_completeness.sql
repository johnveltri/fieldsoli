-- Completeness: Untitled Job is a valid title; $0 revenue needs explicit
-- "no revenue" confirmation; live in-progress sessions already count.

alter table public.jobs
  add column if not exists no_revenue_confirmed_at timestamptz;

comment on column public.jobs.no_revenue_confirmed_at is
  'User confirmed there is no revenue; satisfies the revenue completeness leg until positive revenue is entered.';

grant update (no_revenue_confirmed_at) on public.jobs to authenticated;

create or replace function private.clear_no_revenue_confirmed_on_positive_revenue()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(new.revenue_cents, 0) > 0 then
    new.no_revenue_confirmed_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.clear_no_revenue_confirmed_on_positive_revenue()
  from public, anon, authenticated;

drop trigger if exists jobs_clear_no_revenue_confirmed_on_positive_revenue on public.jobs;
create trigger jobs_clear_no_revenue_confirmed_on_positive_revenue
  before update of revenue_cents, no_revenue_confirmed_at
  on public.jobs
  for each row
  execute function private.clear_no_revenue_confirmed_on_positive_revenue();

create or replace function private.refresh_job_record_completeness(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
  set is_job_record_complete =
    btrim(j.short_description) <> ''
    and (
      coalesce(j.revenue_cents, 0) > 0
      or j.no_revenue_confirmed_at is not null
    )
    and exists (
      select 1
      from public.sessions s
      where s.job_id = p_job_id
        and (
          s.session_status = 'in_progress'
          or (
            s.session_status = 'ended'
            and s.calendar_date_explicit
            and s.ended_at > s.started_at
          )
        )
    )
    and (
      j.materials_reviewed_at is not null
      or exists (
        select 1
        from public.job_costs c
        where c.deleted_at is null
          and private.job_cost_is_material(c.cost_type)
          and btrim(coalesce(c.description, '')) <> ''
          and c.total_cost_cents > 0
          and (
            c.job_id = p_job_id
            or exists (
              select 1
              from public.sessions s
              where s.id = c.session_id
                and s.job_id = p_job_id
                and s.session_status <> 'deleted'
            )
          )
      )
    )
    and (
      j.other_costs_reviewed_at is not null
      or exists (
        select 1
        from public.job_costs c
        where c.deleted_at is null
          and not private.job_cost_is_material(c.cost_type)
          and coalesce(c.cost_type_explicit, true)
          and c.total_cost_cents > 0
          and (
            c.job_id = p_job_id
            or exists (
              select 1
              from public.sessions s
              where s.id = c.session_id
                and s.job_id = p_job_id
                and s.session_status <> 'deleted'
            )
          )
      )
    )
  where j.id = p_job_id;
$$;

drop trigger if exists jobs_refresh_record_completeness on public.jobs;
create trigger jobs_refresh_record_completeness
  after insert or update of short_description, revenue_cents, costs_reviewed_at,
    materials_reviewed_at, other_costs_reviewed_at, no_revenue_confirmed_at
  on public.jobs
  for each row
  execute function private.jobs_refresh_record_completeness();

comment on column public.jobs.is_job_record_complete is
  'True when the job has a non-blank title, revenue (positive or user-confirmed none), a usable session (in-progress or dated ended with duration), and both cost legs satisfied (usable lines or review timestamps).';

do $$
declare
  job_record record;
begin
  for job_record in select id from public.jobs where deleted_at is null loop
    perform private.refresh_job_record_completeness(job_record.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
