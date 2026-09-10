-- Optional long job description. Not part of record completeness.
-- Persisted from Job Edit (apply_job_detail_edit) and legacy updateJobById.

alter table public.jobs
  add column if not exists long_description text;

comment on column public.jobs.long_description is
  'Optional longer job description shown under the title on Job View/Edit. Not used for completeness.';

grant update (long_description) on public.jobs to authenticated;
grant insert (long_description) on public.jobs to authenticated;

create or replace function public.apply_job_detail_edit(
  p_job_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_job_patch jsonb;
  v_short_description text;
  v_long_description text;
  v_revenue_cents bigint;
  v_item jsonb;
  v_id uuid;
  v_session_id uuid;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_clock_explicit boolean;
  v_clock_start_explicit boolean;
  v_clock_end_explicit boolean;
  v_calendar_date_explicit boolean;
  v_started_tz text;
  v_entry_mode public.session_entry_mode_enum;
  v_qty numeric;
  v_quantity_explicit boolean;
  v_unit_cost bigint;
  v_unit_cost_explicit boolean;
  v_total bigint;
  v_cost_type text;
  v_cost_cents bigint;
  v_cost_type_explicit boolean;
  v_body text;
  v_description text;
begin
  if v_user_id is null then
    raise exception 'apply_job_detail_edit:unauthorized' using errcode = 'P0001';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.user_id = v_user_id
    and j.deleted_at is null
  for update;
  if not found then
    raise exception 'apply_job_detail_edit:not_found' using errcode = 'P0001';
  end if;

  v_job_patch := p_payload -> 'job';
  if v_job_patch is null then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;
  v_short_description := btrim(coalesce(v_job_patch ->> 'shortDescription', ''));
  if v_short_description = '' then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;
  if v_job_patch ? 'revenueCents' and v_job_patch -> 'revenueCents' is not null then
    v_revenue_cents := (v_job_patch ->> 'revenueCents')::bigint;
    if v_revenue_cents < 0 then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  else
    v_revenue_cents := null;
  end if;

  v_long_description := nullif(btrim(coalesce(v_job_patch ->> 'longDescription', '')), '');

  update public.jobs
  set short_description = v_short_description,
      long_description = case
        when v_job_patch ? 'longDescription' then v_long_description
        else long_description
      end,
      customer_name = nullif(btrim(coalesce(v_job_patch ->> 'customerName', '')), ''),
      service_address = nullif(btrim(coalesce(v_job_patch ->> 'serviceAddress', '')), ''),
      revenue_cents = v_revenue_cents
  where id = p_job_id;

  for v_id in select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(p_payload #> '{sessions,deleteIds}', '[]'::jsonb))
  loop
    if exists (select 1 from public.sessions s where s.id = v_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'in_progress') then
      raise exception 'apply_job_detail_edit:conflict' using errcode = 'P0001';
    end if;
    update public.sessions set session_status = 'deleted', deleted_at = now(), ended_at = null
      where id = v_id and job_id = p_job_id and user_id = v_user_id and session_status = 'ended';
    if not found and not exists (
      select 1 from public.sessions s
      where s.id = v_id and s.job_id = p_job_id and s.user_id = v_user_id
        and s.session_status = 'deleted'
    ) then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{sessions,update}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid;
    v_started_at := (v_item ->> 'startedAt')::timestamptz;
    v_ended_at := (v_item ->> 'endedAt')::timestamptz;
    v_clock_start_explicit := coalesce((v_item ->> 'clockStartExplicit')::boolean, false);
    v_clock_end_explicit := coalesce((v_item ->> 'clockEndExplicit')::boolean, false);
    if v_item ? 'clockStartExplicit' or v_item ? 'clockEndExplicit' then
      v_clock_explicit := v_clock_start_explicit or v_clock_end_explicit;
    else
      v_clock_explicit := coalesce((v_item ->> 'clockTimesExplicit')::boolean, true);
      v_clock_start_explicit := v_clock_explicit; v_clock_end_explicit := v_clock_explicit;
    end if;
    v_calendar_date_explicit := coalesce((v_item ->> 'calendarDateExplicit')::boolean, true);
    v_started_tz := nullif(btrim(coalesce(v_item ->> 'startedTz', '')), '');
    if v_ended_at is null or v_ended_at < v_started_at then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    select entry_mode into v_entry_mode from public.sessions where id = v_id and job_id = p_job_id and user_id = v_user_id;
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_entry_mode = 'live' and not v_clock_explicit then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    update public.sessions set started_at = v_started_at, ended_at = v_ended_at,
      clock_times_explicit = v_clock_explicit, clock_start_explicit = v_clock_start_explicit,
      clock_end_explicit = v_clock_end_explicit, calendar_date_explicit = v_calendar_date_explicit,
      started_tz = coalesce(v_started_tz, started_tz)
    where id = v_id and job_id = p_job_id and user_id = v_user_id and session_status = 'ended';
    if not found then
      if exists (select 1 from public.sessions s where s.id = v_id and s.session_status = 'in_progress') then raise exception 'apply_job_detail_edit:conflict' using errcode = 'P0001'; end if;
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{sessions,create}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid;
    v_started_at := (v_item ->> 'startedAt')::timestamptz;
    v_ended_at := (v_item ->> 'endedAt')::timestamptz;
    v_clock_start_explicit := coalesce((v_item ->> 'clockStartExplicit')::boolean, false);
    v_clock_end_explicit := coalesce((v_item ->> 'clockEndExplicit')::boolean, false);
    if v_item ? 'clockStartExplicit' or v_item ? 'clockEndExplicit' then
      v_clock_explicit := v_clock_start_explicit or v_clock_end_explicit;
    else
      v_clock_explicit := coalesce((v_item ->> 'clockTimesExplicit')::boolean, false);
      v_clock_start_explicit := v_clock_explicit; v_clock_end_explicit := v_clock_explicit;
    end if;
    v_calendar_date_explicit := coalesce((v_item ->> 'calendarDateExplicit')::boolean, true);
    v_started_tz := nullif(btrim(coalesce(v_item ->> 'startedTz', '')), '');
    if v_ended_at is null or v_ended_at < v_started_at then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    insert into public.sessions (id, job_id, user_id, entry_mode, session_status, started_at, ended_at, started_tz, clock_times_explicit, clock_start_explicit, clock_end_explicit, calendar_date_explicit)
    values (v_id, p_job_id, v_user_id, 'manual', 'ended', v_started_at, v_ended_at, v_started_tz, v_clock_explicit, v_clock_start_explicit, v_clock_end_explicit, v_calendar_date_explicit)
    on conflict (id) do update set
      started_at = excluded.started_at, ended_at = excluded.ended_at, started_tz = excluded.started_tz,
      clock_times_explicit = excluded.clock_times_explicit, clock_start_explicit = excluded.clock_start_explicit,
      clock_end_explicit = excluded.clock_end_explicit, calendar_date_explicit = excluded.calendar_date_explicit
    where public.sessions.user_id = v_user_id and public.sessions.job_id = p_job_id
      and public.sessions.entry_mode = 'manual' and public.sessions.session_status = 'ended';
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;

  if exists (
    select 1 from public.sessions s
    where s.job_id = p_job_id and s.user_id = v_user_id
      and s.session_status = 'ended'
      and s.calendar_date_explicit
      and s.ended_at > s.started_at
  ) then
    update public.jobs set job_work_status = 'in_progress'
    where id = p_job_id and job_work_status = 'not_started';
  end if;

  for v_id in select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_payload #> '{notes,deleteIds}', '[]'::jsonb)) loop
    update public.notes set deleted_at = now()
    where id = v_id and user_id = v_user_id and deleted_at is null and (job_id = p_job_id or session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found and not exists (
      select 1 from public.notes n
      where n.id = v_id and n.user_id = v_user_id and n.deleted_at is not null
        and (n.job_id = p_job_id or n.session_id in (
          select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id
        ))
    ) then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{notes,update}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid; v_body := btrim(coalesce(v_item ->> 'body', '')); v_session_id := nullif(v_item ->> 'sessionId', '')::uuid;
    if v_body = '' then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_session_id is not null and not exists (select 1 from public.sessions s where s.id = v_session_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'ended') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    update public.notes set body = v_body, job_id = case when v_session_id is null then p_job_id else null end, session_id = v_session_id
    where id = v_id and user_id = v_user_id and deleted_at is null and (job_id = p_job_id or session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{notes,create}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid; v_body := btrim(coalesce(v_item ->> 'body', '')); v_session_id := nullif(v_item ->> 'sessionId', '')::uuid;
    if v_body = '' then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_session_id is not null and not exists (select 1 from public.sessions s where s.id = v_session_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'ended') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    insert into public.notes (id, user_id, job_id, session_id, body)
    values (v_id, v_user_id, case when v_session_id is null then p_job_id else null end, v_session_id, v_body)
    on conflict (id) do update set body = excluded.body, job_id = excluded.job_id, session_id = excluded.session_id
    where public.notes.user_id = v_user_id and (public.notes.job_id = p_job_id or public.notes.session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;

  for v_id in select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_payload #> '{materials,deleteIds}', '[]'::jsonb)) loop
    update public.job_costs set deleted_at = now() where id = v_id and user_id = v_user_id and cost_type = 'material' and deleted_at is null and (job_id = p_job_id or session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found and not exists (
      select 1 from public.job_costs c
      where c.id = v_id and c.user_id = v_user_id and c.cost_type = 'material'
        and c.deleted_at is not null
        and (c.job_id = p_job_id or c.session_id in (
          select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id
        ))
    ) then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{materials,update}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid; v_description := coalesce(v_item ->> 'description', ''); v_qty := (v_item ->> 'quantity')::numeric; v_unit_cost := (v_item ->> 'unitCostCents')::bigint; v_session_id := nullif(v_item ->> 'sessionId', '')::uuid;
    v_quantity_explicit := coalesce((v_item ->> 'quantityExplicit')::boolean, true); v_unit_cost_explicit := coalesce((v_item ->> 'unitCostExplicit')::boolean, true);
    v_total := coalesce((v_item ->> 'totalCostCents')::bigint, case when v_quantity_explicit and v_unit_cost_explicit then round(v_qty * v_unit_cost) else 0 end);
    if v_total < 0 or (v_qty is not null and v_qty < 0) or (v_unit_cost is not null and v_unit_cost < 0) or (v_quantity_explicit and v_qty is null) or (v_unit_cost_explicit and v_unit_cost is null) or (v_quantity_explicit and v_unit_cost_explicit and v_total <> round(v_qty * v_unit_cost)) then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_session_id is not null and not exists (select 1 from public.sessions s where s.id = v_session_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'ended') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    update public.job_costs set description = v_description, quantity = case when v_quantity_explicit then v_qty else null end, quantity_explicit = v_quantity_explicit, unit = coalesce(nullif(btrim(v_item ->> 'unit'), ''), 'ea'), unit_cost_cents = case when v_unit_cost_explicit then v_unit_cost else null end, unit_cost_explicit = v_unit_cost_explicit, total_cost_cents = v_total, job_id = case when v_session_id is null then p_job_id else null end, session_id = v_session_id
    where id = v_id and user_id = v_user_id and cost_type = 'material' and deleted_at is null and (job_id = p_job_id or session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{materials,create}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid; v_description := coalesce(v_item ->> 'description', ''); v_qty := (v_item ->> 'quantity')::numeric; v_unit_cost := (v_item ->> 'unitCostCents')::bigint; v_session_id := nullif(v_item ->> 'sessionId', '')::uuid;
    v_quantity_explicit := coalesce((v_item ->> 'quantityExplicit')::boolean, true); v_unit_cost_explicit := coalesce((v_item ->> 'unitCostExplicit')::boolean, true);
    v_total := coalesce((v_item ->> 'totalCostCents')::bigint, case when v_quantity_explicit and v_unit_cost_explicit then round(v_qty * v_unit_cost) else 0 end);
    if v_total < 0 or (v_qty is not null and v_qty < 0) or (v_unit_cost is not null and v_unit_cost < 0) or (v_quantity_explicit and v_qty is null) or (v_unit_cost_explicit and v_unit_cost is null) or (v_quantity_explicit and v_unit_cost_explicit and v_total <> round(v_qty * v_unit_cost)) then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_session_id is not null and not exists (select 1 from public.sessions s where s.id = v_session_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'ended') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    insert into public.job_costs (id, user_id, job_id, session_id, description, quantity, quantity_explicit, unit, unit_cost_cents, unit_cost_explicit, total_cost_cents, cost_type)
    values (v_id, v_user_id, case when v_session_id is null then p_job_id else null end, v_session_id, v_description, case when v_quantity_explicit then v_qty else null end, v_quantity_explicit, coalesce(nullif(btrim(v_item ->> 'unit'), ''), 'ea'), case when v_unit_cost_explicit then v_unit_cost else null end, v_unit_cost_explicit, v_total, 'material')
    on conflict (id) do update set description = excluded.description, quantity = excluded.quantity, quantity_explicit = excluded.quantity_explicit, unit = excluded.unit, unit_cost_cents = excluded.unit_cost_cents, unit_cost_explicit = excluded.unit_cost_explicit, total_cost_cents = excluded.total_cost_cents, job_id = excluded.job_id, session_id = excluded.session_id
    where public.job_costs.user_id = v_user_id and public.job_costs.cost_type = 'material' and (public.job_costs.job_id = p_job_id or public.job_costs.session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;

  for v_id in select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_payload #> '{otherCosts,deleteIds}', '[]'::jsonb)) loop
    update public.job_costs set deleted_at = now() where id = v_id and user_id = v_user_id and cost_type <> 'material' and deleted_at is null and (job_id = p_job_id or session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found and not exists (
      select 1 from public.job_costs c
      where c.id = v_id and c.user_id = v_user_id and c.cost_type <> 'material'
        and c.deleted_at is not null
        and (c.job_id = p_job_id or c.session_id in (
          select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id
        ))
    ) then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{otherCosts,update}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid; v_cost_type := coalesce(nullif(btrim(v_item ->> 'costType'), ''), 'other'); v_cost_type_explicit := coalesce((v_item ->> 'costTypeExplicit')::boolean, true); v_cost_cents := coalesce((v_item ->> 'costCents')::bigint, 0); v_description := coalesce(v_item ->> 'description', ''); v_session_id := nullif(v_item ->> 'sessionId', '')::uuid;
    if v_cost_cents < 0 or v_cost_type not in ('helper_labor', 'equipment_rental', 'permit', 'disposal', 'travel_parking', 'other') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_session_id is not null and not exists (select 1 from public.sessions s where s.id = v_session_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'ended') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    update public.job_costs set cost_type = v_cost_type, cost_type_explicit = v_cost_type_explicit, description = nullif(btrim(v_description), ''), total_cost_cents = v_cost_cents, unit_cost_cents = v_cost_cents, quantity = 1, quantity_explicit = true, unit_cost_explicit = true, job_id = case when v_session_id is null then p_job_id else null end, session_id = v_session_id
    where id = v_id and user_id = v_user_id and cost_type <> 'material' and deleted_at is null and (job_id = p_job_id or session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload #> '{otherCosts,create}', '[]'::jsonb)) loop
    v_id := (v_item ->> 'id')::uuid; v_cost_type := coalesce(nullif(btrim(v_item ->> 'costType'), ''), 'other'); v_cost_type_explicit := coalesce((v_item ->> 'costTypeExplicit')::boolean, true); v_cost_cents := coalesce((v_item ->> 'costCents')::bigint, 0); v_description := coalesce(v_item ->> 'description', ''); v_session_id := nullif(v_item ->> 'sessionId', '')::uuid;
    if v_cost_cents < 0 or v_cost_type not in ('helper_labor', 'equipment_rental', 'permit', 'disposal', 'travel_parking', 'other') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    if v_session_id is not null and not exists (select 1 from public.sessions s where s.id = v_session_id and s.job_id = p_job_id and s.user_id = v_user_id and s.session_status = 'ended') then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
    insert into public.job_costs (id, user_id, job_id, session_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type, cost_type_explicit, quantity_explicit, unit_cost_explicit)
    values (v_id, v_user_id, case when v_session_id is null then p_job_id else null end, v_session_id, nullif(btrim(v_description), ''), 1, 'ea', v_cost_cents, v_cost_cents, v_cost_type, v_cost_type_explicit, true, true)
    on conflict (id) do update set cost_type = excluded.cost_type, cost_type_explicit = excluded.cost_type_explicit, description = excluded.description, quantity = excluded.quantity, unit = excluded.unit, unit_cost_cents = excluded.unit_cost_cents, total_cost_cents = excluded.total_cost_cents, quantity_explicit = excluded.quantity_explicit, unit_cost_explicit = excluded.unit_cost_explicit, job_id = excluded.job_id, session_id = excluded.session_id
    where public.job_costs.user_id = v_user_id and public.job_costs.cost_type <> 'material' and (public.job_costs.job_id = p_job_id or public.job_costs.session_id in (select s.id from public.sessions s where s.job_id = p_job_id and s.user_id = v_user_id));
    if not found then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end loop;
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke execute on function public.apply_job_detail_edit(uuid, jsonb) from public;
grant execute on function public.apply_job_detail_edit(uuid, jsonb) to authenticated;
