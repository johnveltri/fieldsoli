-- Zero-revenue jobs can reach paid via no_revenue_marked_paid.
\set ON_ERROR_STOP on

begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  job_id uuid;
  payment_state text;
begin
  insert into auth.users (id, email)
  values (owner_id, 'no-revenue-paid-' || owner_id || '@example.com');

  insert into public.jobs (
    user_id,
    short_description,
    revenue_cents,
    no_revenue_confirmed_at,
    materials_reviewed_at,
    other_costs_reviewed_at,
    job_work_status
  )
  values (
    owner_id,
    'No revenue job',
    0,
    now(),
    now(),
    now(),
    'completed'
  )
  returning id into job_id;

  select job_payment_state into payment_state
  from public.jobs
  where id = job_id;

  if payment_state is not null then
    raise exception 'zero-revenue completed job without flag should have null payment state, got %', payment_state;
  end if;

  update public.jobs
  set no_revenue_marked_paid = true
  where id = job_id;

  select job_payment_state into payment_state
  from public.jobs
  where id = job_id;

  if payment_state <> 'paid' then
    raise exception 'flagged zero-revenue completed job should be paid, got %', payment_state;
  end if;

  if (select paid_at from public.jobs where id = job_id) is null then
    raise exception 'paid_at should be set when zero-revenue job becomes paid';
  end if;

  update public.jobs
  set revenue_cents = 5000
  where id = job_id;

  select job_payment_state into payment_state
  from public.jobs
  where id = job_id;

  if payment_state <> 'unpaid' then
    raise exception 'positive revenue should ignore no-revenue flag, got %', payment_state;
  end if;

  if (select no_revenue_marked_paid from public.jobs where id = job_id) then
    raise exception 'no_revenue_marked_paid should clear when revenue becomes positive';
  end if;
end;
$$;

rollback;
