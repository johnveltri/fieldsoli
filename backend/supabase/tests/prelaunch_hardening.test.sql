-- Regression coverage for the prelaunch ownership, payment, cost, and
-- least-privilege migrations. All data is rolled back.
\set ON_ERROR_STOP on

begin;

do $$
declare
  exposed_internal_count integer;
begin
  if has_table_privilege('anon', 'public.jobs', 'select')
    or has_table_privilege('anon', 'public.sessions', 'insert') then
    raise exception 'anon must not have app-table privileges';
  end if;

  if has_table_privilege('authenticated', 'public.jobs', 'delete')
    or has_table_privilege('authenticated', 'public.sessions', 'delete')
    or has_table_privilege('authenticated', 'public.notes', 'delete')
    or has_table_privilege('authenticated', 'public.job_costs', 'delete') then
    raise exception 'authenticated must not have hard-delete privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.jobs', 'select')
    or not has_column_privilege('authenticated', 'public.sessions', 'job_id', 'update')
    or has_column_privilege('authenticated', 'public.sessions', 'user_id', 'update') then
    raise exception 'authenticated grant allowlist is incorrect';
  end if;

  select count(*) into exposed_internal_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'set_updated_at',
      'handle_new_user',
      'refresh_job_last_worked_at',
      'refresh_job_financial_completeness',
      'refresh_job_record_completeness',
      'end_stale_live_sessions'
    );

  if exposed_internal_count <> 0 then
    raise exception 'internal functions remain in the exposed public schema';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('jobs', 'sessions', 'notes', 'job_costs', 'job_activity_events')
      and cmd = 'DELETE'
  ) then
    raise exception 'hard-delete RLS policies remain on soft-delete or append-only tables';
  end if;
end;
$$;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  job_a uuid;
  job_a_2 uuid;
  job_b uuid;
  session_a uuid;
  old_last_worked timestamptz;
begin
  insert into auth.users (id, email) values
    (user_a, 'hardening-a-' || user_a || '@example.com'),
    (user_b, 'hardening-b-' || user_b || '@example.com');

  insert into public.jobs (user_id, short_description, revenue_cents, materials_reviewed_at, other_costs_reviewed_at, revenue_invoice_required)
  values (user_a, 'First owned job', 10000, now(), now(), false) returning id into job_a;
  insert into public.jobs (user_id, short_description, revenue_cents, materials_reviewed_at, other_costs_reviewed_at, revenue_invoice_required)
  values (user_a, 'Second owned job', 20000, now(), now(), false) returning id into job_a_2;
  insert into public.jobs (user_id, short_description, revenue_invoice_required)
  values (user_b, 'Other owner job', false) returning id into job_b;

  insert into public.sessions
    (job_id, user_id, entry_mode, session_status, started_at, ended_at)
  values
    (job_a, user_a, 'manual', 'ended', now() - interval '2 hours', now() - interval '1 hour')
  returning id into session_a;

  select last_worked_at into old_last_worked from public.jobs where id = job_a;
  if old_last_worked is null then
    raise exception 'session insert did not refresh last_worked_at';
  end if;

  -- A session must always have a job, but its parent may change within the
  -- same owner. Both parent rollups must be refreshed.
  update public.sessions set job_id = job_a_2 where id = session_a;
  if (select last_worked_at from public.jobs where id = job_a) is not null then
    raise exception 'old job recency was not cleared after session reassignment';
  end if;
  if (select last_worked_at from public.jobs where id = job_a_2) is null then
    raise exception 'new job recency was not refreshed after session reassignment';
  end if;

  begin
    update public.sessions set job_id = job_b where id = session_a;
    raise exception 'cross-owner session reassignment should fail';
  exception when foreign_key_violation then
    null;
  end;

  begin
    update public.sessions set user_id = user_b where id = session_a;
    raise exception 'owner reassignment should fail';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.job_costs
    (user_id, job_id, description, total_cost_cents, cost_type)
  values (user_a, job_a_2, 'Permit', 1200, 'permit');

  if (select other_costs_reviewed_at from public.jobs where id = job_a_2) is not null then
    raise exception 'new active other cost did not clear other_costs_reviewed_at';
  end if;
  if (select materials_reviewed_at from public.jobs where id = job_a_2) is null then
    raise exception 'new other cost should not clear materials_reviewed_at';
  end if;

  begin
    insert into public.job_costs
      (user_id, job_id, description, total_cost_cents, cost_type)
    values (user_a, job_a_2, 'Invalid type', 1, 'mystery');
    raise exception 'invalid cost_type should fail';
  exception when check_violation then
    null;
  end;

  update public.jobs set collected_cents = revenue_cents where id = job_a_2;
  update public.jobs set revenue_cents = 15000 where id = job_a_2;
  if (select collected_cents from public.jobs where id = job_a_2) <> 15000
    or (select job_payment_state from public.jobs where id = job_a_2) <> 'paid' then
    raise exception 'paid revenue correction did not remain paid';
  end if;

  update public.jobs set collected_cents = 5000 where id = job_a_2;
  update public.jobs set revenue_cents = 3000 where id = job_a_2;
  if (select collected_cents from public.jobs where id = job_a_2) <> 3000
    or (select job_payment_state from public.jobs where id = job_a_2) <> 'paid' then
    raise exception 'partial collection was not clamped to corrected revenue';
  end if;

  insert into public.legal_acceptances
    (user_id, document_type, document_version, source)
  values (user_a, 'terms', 'hardening-v1', 'db_test');
  begin
    insert into public.legal_acceptances
      (user_id, document_type, document_version, source)
    values (user_a, 'terms', 'hardening-v1', 'db_test');
    raise exception 'duplicate legal acceptance should fail';
  exception when unique_violation then
    null;
  end;
end;
$$;

rollback;

select 'prelaunch_hardening.test.sql PASSED' as result;
