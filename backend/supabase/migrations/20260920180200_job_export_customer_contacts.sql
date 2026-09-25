-- Add job snapshot phone/email columns to Job Summary CSV export.

drop function if exists public.job_export_rows(uuid, timestamptz, timestamptz, uuid, integer);

create function public.job_export_rows(
  p_request_id uuid,
  p_before_completed_at timestamptz default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 500
)
returns table (
  job_id uuid, job_description text, long_description text, customer_name text,
  customer_phone text, customer_email text, service_address text,
  work_status text, payment_status text, created_at timestamptz,
  last_worked_at timestamptz, completed_at timestamptz, paid_at timestamptz,
  revenue_cents bigint, material_cost bigint, helper_labor_cost bigint,
  equipment_rental_cost bigint, permit_cost bigint, disposal_cost bigint,
  travel_parking_cost bigint, other_cost bigint
)
language sql
security definer
set search_path = ''
as $$
  with request as (
    select user_id, reporting_year, reporting_time_zone
    from public.job_export_requests where id = p_request_id
  ), jobs as (
    select j.* from public.jobs j cross join request r
    where j.user_id = r.user_id and j.deleted_at is null
      and j.job_work_status = 'completed'
      and j.completed_at >= make_timestamptz(r.reporting_year, 1, 1, 0, 0, 0, r.reporting_time_zone)
      and j.completed_at < make_timestamptz(r.reporting_year + 1, 1, 1, 0, 0, 0, r.reporting_time_zone)
      and (
        p_before_completed_at is null
        or j.completed_at < p_before_completed_at
        or (
          j.completed_at = p_before_completed_at
          and j.created_at < p_before_created_at
        )
        or (
          j.completed_at = p_before_completed_at
          and j.created_at = p_before_created_at
          and j.id > p_before_id
        )
      )
    order by j.completed_at desc, j.created_at desc, j.id asc
    limit greatest(1, least(coalesce(p_limit, 500), 500))
  ), cost_links as (
    select j.id as job_id, c.id as cost_id, c.cost_type, c.total_cost_cents
    from jobs j join public.job_costs c on c.job_id = j.id
    where c.deleted_at is null
    union
    select j.id, c.id, c.cost_type, c.total_cost_cents
    from jobs j join public.sessions s on s.job_id = j.id
      and s.deleted_at is null and s.session_status <> 'deleted'
      join public.job_costs c on c.session_id = s.id
    where c.deleted_at is null
  ), costs as (
    select distinct on (job_id, cost_id) job_id, cost_type, total_cost_cents
    from cost_links order by job_id, cost_id
  ), totals as (
    select job_id,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'material'), 0)::bigint as material_cost,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'helper_labor'), 0)::bigint as helper_labor_cost,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'equipment_rental'), 0)::bigint as equipment_rental_cost,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'permit'), 0)::bigint as permit_cost,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'disposal'), 0)::bigint as disposal_cost,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'travel_parking'), 0)::bigint as travel_parking_cost,
      coalesce(sum(total_cost_cents) filter (where cost_type = 'other'), 0)::bigint as other_cost
    from costs group by job_id
  )
  select j.id, j.short_description, j.long_description, j.customer_name,
    j.customer_phone, j.customer_email, j.service_address,
    j.job_work_status::text, j.job_payment_state, j.created_at, j.last_worked_at,
    j.completed_at, j.paid_at, j.revenue_cents,
    coalesce(t.material_cost, 0), coalesce(t.helper_labor_cost, 0),
    coalesce(t.equipment_rental_cost, 0), coalesce(t.permit_cost, 0),
    coalesce(t.disposal_cost, 0), coalesce(t.travel_parking_cost, 0), coalesce(t.other_cost, 0)
  from jobs j left join totals t on t.job_id = j.id
  order by j.completed_at desc, j.created_at desc, j.id asc;
$$;

revoke execute on function public.job_export_rows(uuid, timestamptz, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.job_export_rows(uuid, timestamptz, timestamptz, uuid, integer) to service_role;
