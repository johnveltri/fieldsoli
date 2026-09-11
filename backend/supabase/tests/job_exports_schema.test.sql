-- Regression coverage for private Job Summary CSV export infrastructure.
\set ON_ERROR_STOP on

begin;

do $$
declare
  completed_col record;
  paid_col record;
  completed_exists boolean;
  paid_exists boolean;
  policy_count integer;
  bucket record;
begin
  select data_type, is_nullable into completed_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'jobs' and column_name = 'completed_at';
  completed_exists := found;
  select data_type, is_nullable into paid_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'jobs' and column_name = 'paid_at';
  paid_exists := found;
  if not completed_exists or completed_col.data_type <> 'timestamp with time zone' or completed_col.is_nullable <> 'YES' then
    raise exception 'jobs.completed_at must be nullable timestamptz';
  end if;
  if not paid_exists or paid_col.data_type <> 'timestamp with time zone' or paid_col.is_nullable <> 'YES' then
    raise exception 'jobs.paid_at must be nullable timestamptz';
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'job_export_requests') then
    raise exception 'job_export_requests table missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.job_export_requests'::regclass) then
    raise exception 'job_export_requests must have RLS enabled';
  end if;
  select count(*) into policy_count from pg_policies where schemaname = 'public' and tablename = 'job_export_requests';
  if policy_count <> 0 then raise exception 'job_export_requests must not have client policies'; end if;
  if has_table_privilege('anon', 'public.job_export_requests', 'select')
    or has_table_privilege('anon', 'public.job_export_requests', 'insert')
    or has_table_privilege('anon', 'public.job_export_requests', 'update')
    or has_table_privilege('anon', 'public.job_export_requests', 'delete')
    or has_table_privilege('authenticated', 'public.job_export_requests', 'select')
    or has_table_privilege('authenticated', 'public.job_export_requests', 'insert')
    or has_table_privilege('authenticated', 'public.job_export_requests', 'update')
    or has_table_privilege('authenticated', 'public.job_export_requests', 'delete') then
    raise exception 'client roles must not access job export requests';
  end if;
  if not has_table_privilege('service_role', 'public.job_export_requests', 'select')
    or not has_table_privilege('service_role', 'public.job_export_requests', 'update')
    or not has_table_privilege('service_role', 'public.job_export_requests', 'delete') then
    raise exception 'service_role requires select, update, and delete on job export requests';
  end if;
  if has_table_privilege('service_role', 'public.job_export_requests', 'insert')
    or has_table_privilege('service_role', 'public.job_export_requests', 'truncate')
    or has_table_privilege('service_role', 'public.job_export_requests', 'references')
    or has_table_privilege('service_role', 'public.job_export_requests', 'trigger') then
    raise exception 'service_role has unnecessary job export request privileges';
  end if;

  select public, file_size_limit, allowed_mime_types into bucket from storage.buckets where id = 'job-exports';
  if not found or bucket.public or bucket.file_size_limit <> 26214400 or bucket.allowed_mime_types <> array['text/csv'] then
    raise exception 'job-exports bucket is not private CSV-only 25MiB';
  end if;
  if not exists (select 1 from pgmq.list_queues() where queue_name = 'job_exports') then
    raise exception 'job_exports queue missing';
  end if;
  if coalesce((select schedule from cron.job where jobname = 'process_job_exports'), '') <> '*/2 * * * *' then
    raise exception 'job export processor must run every two minutes';
  end if;
  if coalesce((select schedule from cron.job where jobname = 'cleanup_job_exports'), '') <> '0 0 * * *' then
    raise exception 'job export cleanup must run daily at midnight UTC';
  end if;
end $$;

select set_config('fieldsoli.export_test_user_id', gen_random_uuid()::text, true);
select set_config('fieldsoli.export_test_job_id', gen_random_uuid()::text, true);
insert into auth.users (id, email, email_confirmed_at, created_at)
values (
  current_setting('fieldsoli.export_test_user_id')::uuid,
  'export-test-' || current_setting('fieldsoli.export_test_user_id') || '@example.com',
  now(), date_trunc('year', now()) - interval '3 years'
);

insert into public.jobs (id, user_id, short_description, job_work_status, revenue_cents, collected_cents)
values (
  current_setting('fieldsoli.export_test_job_id')::uuid,
  current_setting('fieldsoli.export_test_user_id')::uuid,
  'Export timestamp test', 'completed', 10000, 10000
);

do $$
declare
  j public.jobs%rowtype;
  original_completed timestamptz;
  original_paid timestamptz;
begin
  select * into strict j from public.jobs where id = current_setting('fieldsoli.export_test_job_id')::uuid;
  if j.completed_at is null or j.paid_at is null then
    raise exception 'entering completed/paid must set timestamps';
  end if;
  original_completed := j.completed_at;
  original_paid := j.paid_at;
  update public.jobs set job_work_status = 'in_progress', collected_cents = 0 where id = j.id;
  select * into strict j from public.jobs where id = j.id;
  if j.completed_at is distinct from original_completed or j.paid_at is distinct from original_paid then
    raise exception 'leaving completed or paid must preserve timestamps';
  end if;
  update public.jobs
  set completed_at = '2000-01-01 00:00:00+00', paid_at = '2000-01-01 00:00:00+00'
  where id = j.id;
  update public.jobs set job_work_status = 'completed', collected_cents = 10000 where id = j.id;
  select * into strict j from public.jobs where id = j.id;
  if j.completed_at = '2000-01-01 00:00:00+00' or j.paid_at = '2000-01-01 00:00:00+00' then
    raise exception 're-entering completed/paid must set fresh timestamps';
  end if;
end $$;

-- Exercise the authoritative request boundary as an authenticated user. An
-- empty year is a true no-op; an in-flight duplicate is idempotent; different
-- years are accepted immediately; a sent same-year request can be repeated
-- after 15 minutes.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('fieldsoli.export_test_user_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
  result jsonb;
begin
  result := public.accept_job_export_request(current_year - 3, 'UTC');
  if result ->> 'status' <> 'no_eligible_jobs' then
    raise exception 'empty eligible year must return no_eligible_jobs, got %', result;
  end if;

  result := public.accept_job_export_request(current_year, 'UTC');
  if result ->> 'status' <> 'confirmed' or (result ->> 'deduplicated')::boolean then
    raise exception 'first eligible request must be newly confirmed, got %', result;
  end if;

  result := public.accept_job_export_request(current_year, 'UTC');
  if result ->> 'status' <> 'confirmed' or not (result ->> 'deduplicated')::boolean then
    raise exception 'in-flight same-year request must deduplicate, got %', result;
  end if;
end $$;

reset role;

do $$
declare
  offset_year integer;
  historical_job_id uuid;
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
begin
  for offset_year in 1..3 loop
    insert into public.jobs (user_id, short_description, job_work_status)
    values (
      current_setting('fieldsoli.export_test_user_id')::uuid,
      'Historical export test ' || offset_year,
      'completed'
    ) returning id into historical_job_id;

    update public.jobs
    set completed_at = make_timestamptz(current_year - offset_year, 6, 15, 12, 0, 0, 'UTC')
    where id = historical_job_id;
  end loop;
end $$;

set local role authenticated;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
  result jsonb;
begin
  result := public.accept_job_export_request(current_year - 1, 'UTC');
  if result ->> 'status' <> 'confirmed' or (result ->> 'deduplicated')::boolean then
    raise exception 'different eligible year must be accepted immediately, got %', result;
  end if;

  result := public.accept_job_export_request(current_year - 2, 'UTC');
  if result ->> 'status' <> 'confirmed' or (result ->> 'deduplicated')::boolean then
    raise exception 'second different year must be accepted immediately, got %', result;
  end if;

  result := public.accept_job_export_request(current_year - 3, 'UTC');
  if result ->> 'status' <> 'confirmed' or (result ->> 'deduplicated')::boolean then
    raise exception 'third different year must be accepted immediately, got %', result;
  end if;
end $$;

reset role;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
begin
  update public.job_export_requests
  set
    generation_state = 'queued',
    created_at = now() - interval '16 minutes'
  where user_id = current_setting('fieldsoli.export_test_user_id')::uuid
    and reporting_year = current_year - 1;
end $$;

set local role authenticated;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
  result jsonb;
begin
  result := public.accept_job_export_request(current_year - 1, 'UTC');
  if result ->> 'status' <> 'confirmed' or not (result ->> 'deduplicated')::boolean then
    raise exception 'in-flight same-year request must still deduplicate after 15 minutes, got %', result;
  end if;
end $$;

reset role;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
begin
  update public.job_export_requests
  set
    generation_state = 'ready',
    delivery_state = 'sent',
    expires_at = now() + interval '24 hours',
    created_at = now() - interval '5 minutes'
  where user_id = current_setting('fieldsoli.export_test_user_id')::uuid
    and reporting_year = current_year;
end $$;

set local role authenticated;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
  result jsonb;
begin
  result := public.accept_job_export_request(current_year, 'UTC');
  if result ->> 'status' <> 'rate_limited' or result ->> 'retry_at' is null then
    raise exception 'same-year rerequest within 15 minutes must be rate limited, got %', result;
  end if;
end $$;

reset role;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
begin
  update public.job_export_requests
  set created_at = now() - interval '15 minutes 1 second'
  where user_id = current_setting('fieldsoli.export_test_user_id')::uuid
    and reporting_year = current_year;
end $$;

set local role authenticated;

do $$
declare
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
  result jsonb;
begin
  result := public.accept_job_export_request(current_year, 'UTC');
  if result ->> 'status' <> 'confirmed' or (result ->> 'deduplicated')::boolean then
    raise exception 'sent same-year request must accept a new export after 15 minutes, got %', result;
  end if;
end $$;

reset role;

do $$
declare
  request_count integer;
begin
  select count(*) into request_count
  from public.job_export_requests
  where user_id = current_setting('fieldsoli.export_test_user_id')::uuid;
  if request_count <> 5 then
    raise exception 'empty, duplicate, and rate-limited requests must not create rows; same-year rerequest after 15 minutes must; saw %', request_count;
  end if;
end $$;

do $$
declare
  request_id uuid;
  current_year integer := extract(year from now() at time zone 'UTC')::integer;
  export_row record;
begin
  update public.jobs
  set
    long_description = 'Replace the valve and recaulk.',
    completed_at = make_timestamptz(current_year, 6, 15, 12, 0, 0, 'UTC')
  where id = current_setting('fieldsoli.export_test_job_id')::uuid;

  insert into public.job_export_requests (user_id, reporting_year, reporting_time_zone, recipient_email)
  values (
    current_setting('fieldsoli.export_test_user_id')::uuid,
    current_year,
    'UTC',
    'export-test@example.com'
  )
  returning id into request_id;

  select * into export_row
  from public.job_export_rows(request_id)
  where job_id = current_setting('fieldsoli.export_test_job_id')::uuid
  limit 1;

  if export_row.long_description is distinct from 'Replace the valve and recaulk.' then
    raise exception 'job_export_rows must return long_description, got %', export_row.long_description;
  end if;
end $$;

do $$
begin
  if has_column_privilege('authenticated', 'public.jobs', 'completed_at', 'update')
    or has_column_privilege('authenticated', 'public.jobs', 'paid_at', 'update')
    or has_column_privilege('authenticated', 'public.jobs', 'completed_at', 'insert')
    or has_column_privilege('authenticated', 'public.jobs', 'paid_at', 'insert') then
    raise exception 'clients must not be able to write export timestamps';
  end if;
  if not has_function_privilege('authenticated', 'public.accept_job_export_request(integer, text)', 'execute') then
    raise exception 'authenticated request RPC missing';
  end if;
  if has_function_privilege('authenticated', 'public.job_export_rows(uuid, timestamptz, timestamptz, uuid, integer)', 'execute') then
    raise exception 'clients must not read export rows';
  end if;
end $$;

rollback;

select 'job_exports_schema.test.sql PASSED' as result;
