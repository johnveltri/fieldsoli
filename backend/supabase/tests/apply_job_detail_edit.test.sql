\set ON_ERROR_STOP on

begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  job_a uuid;
  job_b uuid;
  session_ended uuid;
  session_live uuid;
  retry_session uuid := gen_random_uuid();
  retry_note uuid := gen_random_uuid();
  retry_material uuid := gen_random_uuid();
  retry_other_cost uuid := gen_random_uuid();
  retry_delete_session uuid;
  retry_delete_note uuid;
  retry_delete_material uuid;
  retry_delete_other_cost uuid;
  partial_job uuid;
  partial_session uuid := gen_random_uuid();
  retry_payload jsonb;
  retry_delete_payload jsonb;
  result jsonb;
begin
  if has_function_privilege('anon', 'public.apply_job_detail_edit(uuid,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.apply_job_detail_edit(uuid,jsonb)', 'EXECUTE') then
    raise exception 'apply_job_detail_edit execute grants are not authenticated-only';
  end if;

  insert into auth.users (id, email) values
    (user_a, 'edit-a-' || user_a || '@example.com'),
    (user_b, 'edit-b-' || user_b || '@example.com');

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.jobs (user_id, short_description, revenue_cents, materials_reviewed_at, other_costs_reviewed_at)
  values (user_a, 'Edit RPC job', 5000, now(), now()) returning id into job_a;

  insert into public.sessions (job_id, user_id, entry_mode, session_status, started_at, ended_at, clock_times_explicit)
  values (job_a, user_a, 'manual', 'ended', now() - interval '2 hours', now() - interval '1 hour', true)
  returning id into session_ended;

  insert into public.sessions (job_id, user_id, entry_mode, session_status, started_at, clock_times_explicit)
  values (job_a, user_a, 'live', 'in_progress', now() - interval '30 minutes', true)
  returning id into session_live;

  result := public.apply_job_detail_edit(job_a, jsonb_build_object(
    'job', jsonb_build_object(
      'shortDescription', 'Updated title',
      'longDescription', 'Replace the valve and recaulk.',
      'customerName', 'Pat',
      'serviceAddress', '1 Main St',
      'revenueCents', 6000
    ),
    'sessions', jsonb_build_object(
      'create', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'startedAt', (now() - interval '1 day')::text,
        'endedAt', (now() - interval '23 hours')::text,
        'clockTimesExplicit', false,
        'startedTz', 'UTC'
      )),
      'update', '[]'::jsonb,
      'deleteIds', '[]'::jsonb
    ),
    'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
  ));

  if result ->> 'status' <> 'ok' then
    raise exception 'apply_job_detail_edit failed: %', result;
  end if;

  if (select short_description from public.jobs where id = job_a) <> 'Updated title' then
    raise exception 'job title not updated';
  end if;
  if (select long_description from public.jobs where id = job_a) is distinct from 'Replace the valve and recaulk.' then
    raise exception 'job long_description not updated';
  end if;

  if not exists (
    select 1 from public.sessions
    where job_id = job_a and clock_times_explicit = false and session_status = 'ended'
  ) then
    raise exception 'duration-only session not created';
  end if;

  -- Lost responses are retried with the same client-generated ids. Repeating
  -- the complete create payload must update the same tenant/job rows, not fail
  -- on a primary-key collision or create duplicates.
  retry_payload := jsonb_build_object(
    'job', jsonb_build_object(
      'shortDescription', 'Updated title',
      'customerName', 'Pat',
      'serviceAddress', '1 Main St',
      'revenueCents', 6000
    ),
    'sessions', jsonb_build_object(
      'create', jsonb_build_array(jsonb_build_object(
        'id', retry_session::text,
        'startedAt', (now() - interval '4 hours')::text,
        'endedAt', (now() - interval '3 hours')::text,
        'calendarDateExplicit', true,
        'clockStartExplicit', false,
        'clockEndExplicit', false,
        'startedTz', 'UTC'
      )),
      'update', '[]'::jsonb,
      'deleteIds', '[]'::jsonb
    ),
    'notes', jsonb_build_object(
      'create', jsonb_build_array(jsonb_build_object(
        'id', retry_note::text, 'body', 'Retry-safe note', 'sessionId', retry_session::text
      )),
      'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb
    ),
    'materials', jsonb_build_object(
      'create', jsonb_build_array(jsonb_build_object(
        'id', retry_material::text,
        'description', 'Partial material',
        'quantity', 2,
        'quantityExplicit', true,
        'unit', 'ea',
        'unitCostCents', null,
        'unitCostExplicit', false,
        'totalCostCents', 10000,
        'sessionId', retry_session::text
      )),
      'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb
    ),
    'otherCosts', jsonb_build_object(
      'create', jsonb_build_array(jsonb_build_object(
        'id', retry_other_cost::text,
        'costType', 'other',
        'costTypeExplicit', false,
        'description', '',
        'costCents', 123,
        'sessionId', null
      )),
      'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb
    )
  );
  perform public.apply_job_detail_edit(job_a, retry_payload);
  perform public.apply_job_detail_edit(job_a, retry_payload);

  if (select count(*) from public.sessions where id = retry_session) <> 1
     or (select count(*) from public.notes where id = retry_note) <> 1
     or (select count(*) from public.job_costs where id = retry_material) <> 1
     or (select count(*) from public.job_costs where id = retry_other_cost) <> 1 then
    raise exception 'retry created duplicate child rows';
  end if;
  if not exists (
    select 1 from public.job_costs
    where id = retry_material
      and total_cost_cents = 10000
      and quantity = 2
      and quantity_explicit
      and unit_cost_cents is null
      and not unit_cost_explicit
  ) then
    raise exception 'partial material total or explicitness did not round-trip';
  end if;

  insert into public.sessions (
    job_id, user_id, entry_mode, session_status, started_at, ended_at,
    clock_times_explicit, calendar_date_explicit
  ) values (
    job_a, user_a, 'manual', 'ended', now() - interval '6 hours',
    now() - interval '5 hours', true, true
  ) returning id into retry_delete_session;
  insert into public.notes (user_id, job_id, body)
  values (user_a, job_a, 'Delete retry note') returning id into retry_delete_note;
  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents,
    total_cost_cents, cost_type
  ) values (
    user_a, job_a, 'Delete retry material', 1, 'ea', 100, 100, 'material'
  ) returning id into retry_delete_material;
  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents,
    total_cost_cents, cost_type
  ) values (
    user_a, job_a, 'Delete retry cost', 1, 'ea', 100, 100, 'other'
  ) returning id into retry_delete_other_cost;

  retry_delete_payload := jsonb_build_object(
    'job', jsonb_build_object(
      'shortDescription', 'Updated title', 'customerName', 'Pat',
      'serviceAddress', '1 Main St', 'revenueCents', 6000
    ),
    'sessions', jsonb_build_object(
      'create', '[]'::jsonb, 'update', '[]'::jsonb,
      'deleteIds', jsonb_build_array(retry_delete_session::text)
    ),
    'notes', jsonb_build_object(
      'create', '[]'::jsonb, 'update', '[]'::jsonb,
      'deleteIds', jsonb_build_array(retry_delete_note::text)
    ),
    'materials', jsonb_build_object(
      'create', '[]'::jsonb, 'update', '[]'::jsonb,
      'deleteIds', jsonb_build_array(retry_delete_material::text)
    ),
    'otherCosts', jsonb_build_object(
      'create', '[]'::jsonb, 'update', '[]'::jsonb,
      'deleteIds', jsonb_build_array(retry_delete_other_cost::text)
    )
  );
  perform public.apply_job_detail_edit(job_a, retry_delete_payload);
  perform public.apply_job_detail_edit(job_a, retry_delete_payload);

  if not exists (
    select 1 from public.sessions
    where id = retry_delete_session and session_status = 'deleted'
  ) or not exists (
    select 1 from public.notes where id = retry_delete_note and deleted_at is not null
  ) or not exists (
    select 1 from public.job_costs where id = retry_delete_material and deleted_at is not null
  ) or not exists (
    select 1 from public.job_costs where id = retry_delete_other_cost and deleted_at is not null
  ) then
    raise exception 'retry delete payload did not remain idempotent';
  end if;

  -- Storage timestamps for an undated, zero-duration partial session must not
  -- fabricate last-worked, work status, or record completeness.
  insert into public.jobs (
    user_id, short_description, revenue_cents, materials_reviewed_at, other_costs_reviewed_at
  ) values (user_a, 'Partial session job', 5000, now(), now()) returning id into partial_job;
  perform public.apply_job_detail_edit(partial_job, jsonb_build_object(
    'job', jsonb_build_object(
      'shortDescription', 'Partial session job',
      'customerName', '', 'serviceAddress', '', 'revenueCents', 5000
    ),
    'sessions', jsonb_build_object(
      'create', jsonb_build_array(jsonb_build_object(
        'id', partial_session::text,
        'startedAt', now()::text,
        'endedAt', now()::text,
        'calendarDateExplicit', false,
        'clockStartExplicit', false,
        'clockEndExplicit', false,
        'startedTz', 'UTC'
      )), 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb
    ),
    'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
  ));
  if exists (
    select 1 from public.jobs
    where id = partial_job
      and (job_work_status <> 'not_started' or last_worked_at is not null or is_job_record_complete)
  ) then
    raise exception 'partial session fabricated derived job state';
  end if;

  perform public.apply_job_detail_edit(partial_job, jsonb_build_object(
    'job', jsonb_build_object(
      'shortDescription', 'Partial session job',
      'customerName', '', 'serviceAddress', '', 'revenueCents', 5000
    ),
    'sessions', jsonb_build_object(
      'create', '[]'::jsonb,
      'update', jsonb_build_array(jsonb_build_object(
        'id', partial_session::text,
        'startedAt', (now() - interval '2 hours')::text,
        'endedAt', (now() - interval '1 hour')::text,
        'calendarDateExplicit', true,
        'clockStartExplicit', false,
        'clockEndExplicit', false,
        'startedTz', 'UTC'
      )),
      'deleteIds', '[]'::jsonb
    ),
    'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
    'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
  ));
  if not exists (
    select 1 from public.jobs
    where id = partial_job
      and job_work_status = 'in_progress'
      and last_worked_at is not null
      and is_job_record_complete
  ) then
    raise exception 'completed partial session did not drive derived job state';
  end if;

  begin
    result := public.apply_job_detail_edit(job_a, jsonb_build_object(
      'job', jsonb_build_object(
        'shortDescription', 'Should not stick',
        'customerName', '',
        'serviceAddress', '',
        'revenueCents', null
      ),
      'sessions', jsonb_build_object(
        'create', '[]'::jsonb,
        'update', '[]'::jsonb,
        'deleteIds', jsonb_build_array(session_live::text)
      ),
      'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
      'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
      'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
    ));
    raise exception 'expected conflict deleting in_progress session, got %', result;
  exception
    when others then
      if SQLERRM not like '%apply_job_detail_edit:conflict%' then
        raise;
      end if;
  end;

  if (select short_description from public.jobs where id = job_a) <> 'Updated title' then
    raise exception 'job title rolled back after conflict';
  end if;

  begin
    perform set_config('request.jwt.claim.sub', user_b::text, true);
    insert into public.jobs (user_id, short_description)
    values (user_b, 'Other tenant job') returning id into job_b;
    begin
      perform public.apply_job_detail_edit(job_b, jsonb_build_object(
        'job', jsonb_build_object(
          'shortDescription', 'Other tenant job', 'customerName', '',
          'serviceAddress', '', 'revenueCents', null
        ),
        'sessions', jsonb_build_object(
          'create', jsonb_build_array(jsonb_build_object(
            'id', retry_session::text,
            'startedAt', (now() - interval '1 hour')::text,
            'endedAt', now()::text,
            'calendarDateExplicit', true,
            'clockStartExplicit', false,
            'clockEndExplicit', false,
            'startedTz', 'UTC'
          )),
          'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb
        ),
        'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
        'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
        'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
      ));
      raise exception 'expected cross-tenant client-id collision to fail';
    exception
      when others then
        if SQLERRM not like '%apply_job_detail_edit:invalid%' then
          raise;
        end if;
    end;
    if (select user_id from public.sessions where id = retry_session) <> user_a then
      raise exception 'cross-tenant retry collision changed row ownership';
    end if;

    result := public.apply_job_detail_edit(job_a, jsonb_build_object(
      'job', jsonb_build_object('shortDescription', 'Hack', 'customerName', '', 'serviceAddress', '', 'revenueCents', null),
      'sessions', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
      'notes', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
      'materials', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb),
      'otherCosts', jsonb_build_object('create', '[]'::jsonb, 'update', '[]'::jsonb, 'deleteIds', '[]'::jsonb)
    ));
    raise exception 'expected unauthorized/not_found for other user, got %', result;
  exception
    when others then
      if SQLERRM not like '%apply_job_detail_edit:not_found%'
         and SQLERRM not like '%apply_job_detail_edit:unauthorized%' then
        raise;
      end if;
  end;
end;
$$;

rollback;
