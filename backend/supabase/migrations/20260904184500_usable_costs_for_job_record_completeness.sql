-- Align is_job_record_complete with mobile financial completeness:
-- materials need description + total > 0; other costs need explicit type + amount > 0.
-- Incomplete / capture-now rows no longer satisfy the costs legs.

create or replace function private.refresh_job_record_completeness(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
  set is_job_record_complete =
    btrim(j.short_description) <> ''
    and btrim(j.short_description) <> 'Untitled Job'
    and coalesce(j.revenue_cents, 0) > 0
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

comment on column public.jobs.is_job_record_complete is
  'True when the job has a real description, positive revenue, a usable session, and both cost legs satisfied (usable lines or review timestamps).';

-- Recompute after rule change.
do $$
declare
  job_record record;
begin
  for job_record in select id from public.jobs where deleted_at is null loop
    perform private.refresh_job_record_completeness(job_record.id);
  end loop;
end;
$$;
