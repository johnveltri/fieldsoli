\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.login_as(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end;
$$;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  job_legacy uuid;
  job_a uuid;
  job_b uuid;
  job_c uuid;
  customer_1 uuid;
  customer_2 uuid;
  result jsonb;
  suggestions jsonb;
  suggestion_count integer;
begin
  -- TEST-02: grants and ownership
  if has_function_privilege('anon', 'public.save_job_customer(uuid,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_job_customer(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_customer_suggestions(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_customer_suggestions(text)', 'EXECUTE') then
    raise exception 'customer RPC execute grants are not authenticated-only';
  end if;

  if has_table_privilege('authenticated', 'public.customers', 'INSERT')
     or has_table_privilege('authenticated', 'public.customers', 'UPDATE')
     or has_table_privilege('authenticated', 'public.customers', 'DELETE') then
    raise exception 'authenticated must not have direct customer write privileges';
  end if;

  insert into auth.users (id, email) values
    (user_a, 'cust-a-' || user_a || '@example.com'),
    (user_b, 'cust-b-' || user_b || '@example.com');

  insert into public.jobs (user_id, short_description, customer_name, service_address, revenue_cents)
  values (user_a, 'Legacy job', 'Legacy Pat', '9 Old St', 1000)
  returning id into job_legacy;

  -- TEST-01: legacy rows unchanged by migration semantics
  if exists (
    select 1 from public.jobs
    where id = job_legacy
      and customer_id is null
      and customer_phone is null
      and customer_email is null
      and customer_name = 'Legacy Pat'
      and service_address = '9 Old St'
  ) then
    null;
  else
    raise exception 'TEST-01 failed: legacy job columns not preserved';
  end if;

  perform pg_temp.login_as(user_a);

  -- Legacy apply path without new keys must not create customers
  result := public.apply_job_detail_edit(job_legacy, jsonb_build_object(
    'job', jsonb_build_object(
      'shortDescription', 'Legacy job',
      'longDescription', '',
      'customerName', 'Legacy Pat 2',
      'serviceAddress', '9 Old St',
      'revenueCents', 1000
    ),
    'sessions', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
  ));
  if (select count(*) from public.customers where user_id = user_a) <> 0 then
    raise exception 'TEST-01 failed: legacy edit created customers';
  end if;

  insert into public.jobs (user_id, short_description, revenue_cents)
  values (user_a, 'Customer job A', 2000)
  returning id into job_a;

  -- TEST-03/04: eligible save creates customer and writes snapshot
  result := public.save_job_customer(job_a, jsonb_build_object(
    'customerName', 'Jordan Lee',
    'customerPhone', '(312) 555-0198',
    'customerEmail', 'jordan@example.com',
    'serviceAddress', '123 Main St, Chicago, IL'
  ));
  if result ->> 'status' <> 'ok' then
    raise exception 'save_job_customer failed: %', result;
  end if;

  customer_1 := (result #>> '{snapshot,customerId}')::uuid;
  if customer_1 is null then
    raise exception 'TEST-04 failed: eligible save did not link customer';
  end if;

  if not exists (
    select 1 from public.jobs
    where id = job_a
      and customer_name = 'Jordan Lee'
      and customer_phone = '(312) 555-0198'
      and customer_email = 'jordan@example.com'
      and service_address = '123 Main St, Chicago, IL'
      and customer_id = customer_1
  ) then
    raise exception 'TEST-04 failed: job snapshot not written';
  end if;

  if not exists (
    select 1 from public.customers
    where id = customer_1
      and display_name = 'Jordan Lee'
      and phone = '(312) 555-0198'
      and email = 'jordan@example.com'
      and last_service_address = '123 Main St, Chicago, IL'
      and deleted_at is null
  ) then
    raise exception 'TEST-04 failed: customer defaults not written';
  end if;

  -- TEST-03: ineligible snapshot saves job but stays unlinked
  insert into public.jobs (user_id, short_description, revenue_cents)
  values (user_a, 'Ineligible job', 500)
  returning id into job_b;

  result := public.save_job_customer(job_b, jsonb_build_object(
    'customerName', 'Name Only',
    'customerPhone', 'bad-phone',
    'customerEmail', 'not-an-email',
    'serviceAddress', '123'
  ));
  if result ->> 'status' <> 'ok' then
    raise exception 'ineligible save failed: %', result;
  end if;
  if (result #>> '{snapshot,customerId}') is not null then
    raise exception 'TEST-03 failed: ineligible job linked a customer';
  end if;

  -- TEST-05: conservative matching links exact identifiers and rejects name-only
  insert into public.jobs (user_id, short_description, revenue_cents)
  values (user_a, 'Match job', 500)
  returning id into job_c;

  result := public.save_job_customer(job_c, jsonb_build_object(
    'customerName', 'Jordan Lee',
    'customerPhone', '(312) 555-0198',
    'customerEmail', 'jordan@example.com',
    'serviceAddress', '123 Main St, Chicago, IL'
  ));
  if (result #>> '{snapshot,customerId}')::uuid <> customer_1 then
    raise exception 'TEST-05 failed: exact match did not link existing customer';
  end if;

  insert into public.jobs (user_id, short_description, revenue_cents)
  values (user_a, 'Name only job', 500)
  returning id into job_b;

  result := public.save_job_customer(job_b, jsonb_build_object(
    'customerName', 'Taylor Smith',
    'customerPhone', null,
    'customerEmail', null,
    'serviceAddress', '123'
  ));
  if (result #>> '{snapshot,customerId}') is not null then
    raise exception 'TEST-05 failed: ineligible name-only snapshot created a customer';
  end if;

  -- TEST-08: recents and search
  suggestions := public.list_customer_suggestions('');
  suggestion_count := jsonb_array_length(suggestions);
  if suggestion_count < 1 or suggestion_count > 3 then
    raise exception 'TEST-08 failed: expected 1-3 recents, got %', suggestion_count;
  end if;

  suggestions := public.list_customer_suggestions('Jordan');
  if jsonb_array_length(suggestions) <> 1 then
    raise exception 'TEST-08 failed: expected one Jordan match, got %', suggestions;
  end if;

  -- TEST-06: delete recomputes; restore reactivates
  update public.jobs set deleted_at = now() where id = job_c;

  insert into public.jobs (user_id, short_description, revenue_cents)
  values (user_a, 'Second linked job', 3000)
  returning id into job_b;

  result := public.save_job_customer(job_b, jsonb_build_object(
    'customerId', customer_1::text,
    'customerName', 'Jordan Lee',
    'customerPhone', '(312) 555-0198',
    'customerEmail', 'jordan@example.com',
    'serviceAddress', '456 Oak Ave'
  ));
  if result ->> 'status' <> 'ok' then
    raise exception 'TEST-06 setup failed: %', result;
  end if;

  perform set_config('role', 'postgres', true);
  update public.jobs set updated_at = now() + interval '1 second' where id = job_b;
  perform pg_temp.login_as(user_a);

  update public.jobs set deleted_at = now() where id = job_a;
  if not exists (
    select 1 from public.customers
    where id = customer_1
      and last_service_address = '456 Oak Ave'
      and deleted_at is null
  ) then
    raise exception 'TEST-06 failed: defaults did not recompute after deleting newest job';
  end if;

  update public.jobs set deleted_at = now() where id = job_b;
  if not exists (
    select 1 from public.customers where id = customer_1 and deleted_at is not null
  ) then
    raise exception 'TEST-06 failed: customer not soft-deleted after final active job deleted';
  end if;

  suggestions := public.list_customer_suggestions('');
  if jsonb_array_length(suggestions) <> 0 then
    raise exception 'TEST-06 failed: deleted customer still appears in recents';
  end if;

  suggestions := public.list_customer_suggestions('Jordan');
  if jsonb_array_length(suggestions) <> 0 then
    raise exception 'TEST-06 failed: deleted customer still appears in search';
  end if;

  update public.jobs set deleted_at = null where id = job_b;
  if not exists (
    select 1 from public.customers where id = customer_1 and deleted_at is null
  ) then
    raise exception 'TEST-06 failed: customer not reactivated after job restore';
  end if;

  -- TEST-07: conflict returns latest snapshot without overwrite
  perform pg_sleep(0.01);
  result := public.save_job_customer(job_b, jsonb_build_object(
    'customerName', 'Stale Edit',
    'customerPhone', '(312) 555-0198',
    'customerEmail', 'jordan@example.com',
    'serviceAddress', '456 Oak Ave',
    'expectedJobUpdatedAt', '2000-01-01T00:00:00Z'
  ));
  if result ->> 'status' <> 'conflict' then
    raise exception 'TEST-07 failed: expected conflict, got %', result;
  end if;
  if (select customer_name from public.jobs where id = job_b) = 'Stale Edit' then
    raise exception 'TEST-07 failed: conflict overwrote job snapshot';
  end if;

  -- TEST-02: cross-tenant isolation
  perform pg_temp.login_as(user_b);

  if (select count(*) from public.customers) <> 0 then
    raise exception 'TEST-02 failed: user B can see user A customers';
  end if;

  begin
    perform public.save_job_customer(job_b, jsonb_build_object(
      'customerId', customer_1::text,
      'customerName', 'Hijack',
      'customerPhone', null,
      'customerEmail', null,
      'serviceAddress', null
    ));
    raise exception 'TEST-02 failed: cross-owner customer link succeeded';
  exception
    when others then
      if sqlerrm not like '%invalid%' and sqlerrm not like '%not_found%' then
        raise;
      end if;
  end;
end;
$$;

rollback;

select 'job_customers.test.sql PASSED' as result;
