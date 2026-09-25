-- Allow zero-revenue jobs to reach a paid payment state when the user marks
-- them complete with confirmed no revenue.

alter table public.jobs
  add column if not exists no_revenue_marked_paid boolean not null default false;

comment on column public.jobs.no_revenue_marked_paid is
  'User marked a zero-revenue job paid; drives job_payment_state = paid while work is completed. Cleared when revenue becomes positive or work leaves completed.';

grant update (no_revenue_marked_paid) on public.jobs to authenticated;

-- Dropping the generated column also drops indexes that reference it.
alter table public.jobs drop column job_payment_state;

alter table public.jobs
  add column job_payment_state text generated always as (
    case
      when coalesce(revenue_cents, 0) > 0 and collected_cents = 0 then 'unpaid'
      when coalesce(revenue_cents, 0) > 0 and collected_cents < revenue_cents then 'partially_paid'
      when coalesce(revenue_cents, 0) > 0 then 'paid'
      when no_revenue_marked_paid and job_work_status = 'completed' then 'paid'
      else null
    end
  ) stored;

comment on column public.jobs.job_payment_state is
  'Generated from revenue_cents, collected_cents, and no_revenue_marked_paid: NULL, unpaid, partially_paid, or paid.';

create or replace function private.sync_job_collection_on_revenue_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.revenue_cents is distinct from old.revenue_cents then
    if coalesce(new.revenue_cents, 0) = 0 then
      new.collected_cents := 0;
    elsif coalesce(new.revenue_cents, 0) > 0 then
      new.no_revenue_marked_paid := false;
      if new.collected_cents is distinct from old.collected_cents then
        -- Respect an explicit simultaneous collection edit, but never allow it
        -- to exceed the corrected revenue.
        new.collected_cents := least(new.collected_cents, new.revenue_cents);
      elsif coalesce(old.revenue_cents, 0) > 0
        and old.collected_cents = old.revenue_cents then
        -- A fully paid job remains paid when its revenue is corrected.
        new.collected_cents := new.revenue_cents;
      else
        -- Compatibility path for an unexpected partial row. Preserve the
        -- collection unless the corrected revenue is lower, then clamp rather
        -- than blocking an edit the current UI cannot resolve.
        new.collected_cents := least(old.collected_cents, new.revenue_cents);
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.set_job_export_state_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.job_work_status = 'completed' then
      new.completed_at := now();
    end if;
    if (coalesce(new.revenue_cents, 0) > 0 and new.collected_cents >= new.revenue_cents)
      or (
        coalesce(new.revenue_cents, 0) <= 0
        and new.no_revenue_marked_paid
        and new.job_work_status = 'completed'
      ) then
      new.paid_at := now();
    end if;
  else
    if new.job_work_status = 'completed' and old.job_work_status is distinct from 'completed' then
      new.completed_at := now();
    end if;

    -- This trigger sorts after jobs_sync_collection_on_revenue_change, so the
    -- payment calculation sees the synchronized collection values.
    if (
      (coalesce(new.revenue_cents, 0) > 0 and new.collected_cents >= new.revenue_cents)
      or (
        coalesce(new.revenue_cents, 0) <= 0
        and new.no_revenue_marked_paid
        and new.job_work_status = 'completed'
      )
    )
    and old.job_payment_state is distinct from 'paid' then
      new.paid_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_zzz_set_export_state_timestamps on public.jobs;
create trigger jobs_zzz_set_export_state_timestamps
before insert or update of job_work_status, revenue_cents, collected_cents, no_revenue_marked_paid
on public.jobs
for each row execute function private.set_job_export_state_timestamps();

create index jobs_user_open_stack_record_complete_idx
  on public.jobs (
    user_id,
    is_job_record_complete,
    job_work_status,
    job_payment_state,
    list_recency_at desc,
    id desc
  )
  where deleted_at is null;

notify pgrst, 'reload schema';
