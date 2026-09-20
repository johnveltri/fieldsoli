-- Job Customers: reusable customer defaults, job snapshot phone/email/link, RPCs.

-- DATA-01: additive job columns
alter table public.jobs
  add column if not exists customer_id uuid,
  add column if not exists customer_phone text,
  add column if not exists customer_email text;

comment on column public.jobs.customer_id is
  'Optional link to reusable customer defaults; job snapshot fields remain authoritative.';
comment on column public.jobs.customer_phone is
  'Job-owned customer phone snapshot; invalid values allowed.';
comment on column public.jobs.customer_email is
  'Job-owned customer email snapshot; invalid values allowed.';

-- DATA-02: customers table
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone text,
  email text,
  last_service_address text,
  normalized_name text not null default '',
  normalized_phone text,
  normalized_email text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_id_user_id_key unique (id, user_id)
);

alter table public.jobs
  add constraint jobs_customer_owner_fkey
    foreign key (customer_id, user_id) references public.customers (id, user_id);

create index customers_user_id_active_idx
  on public.customers (user_id)
  where deleted_at is null;

create index customers_user_normalized_phone_idx
  on public.customers (user_id, normalized_phone)
  where deleted_at is null and normalized_phone is not null;

create index customers_user_normalized_email_idx
  on public.customers (user_id, normalized_email)
  where deleted_at is null and normalized_email is not null;

create index customers_user_normalized_name_idx
  on public.customers (user_id, normalized_name)
  where deleted_at is null;

create index jobs_customer_recency_idx
  on public.jobs (customer_id, updated_at desc, id desc)
  where deleted_at is null and customer_id is not null;

alter table public.customers enable row level security;
alter table public.customers force row level security;

create policy customers_select_own on public.customers
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.customers from anon, authenticated;
grant select on public.customers to authenticated;

create trigger customers_owner_immutable
  before update on public.customers
  for each row execute function private.enforce_user_id_immutable();

create trigger set_customers_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

-- Normalization helpers (server-authoritative; conservative US-first phone parsing).
create or replace function private.normalize_customer_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function private.normalize_phone_e164(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_trimmed text := btrim(coalesce(p_value, ''));
  v_digits text;
begin
  if v_trimmed = '' then
    return null;
  end if;

  if left(v_trimmed, 1) = '+' then
    v_digits := regexp_replace(v_trimmed, '[^0-9]', '', 'g');
    if length(v_digits) between 8 and 15 then
      return '+' || v_digits;
    end if;
    return null;
  end if;

  v_digits := regexp_replace(v_trimmed, '[^0-9]', '', 'g');
  if length(v_digits) = 10 then
    return '+1' || v_digits;
  end if;
  if length(v_digits) = 11 and left(v_digits, 1) = '1' then
    return '+1' || substr(v_digits, 2);
  end if;
  return null;
end;
$$;

create or replace function private.is_valid_customer_phone(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.normalize_phone_e164(p_value) is not null;
$$;

create or replace function private.normalize_customer_email(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(coalesce(p_value, '')) = '' then null
    when btrim(p_value) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(btrim(p_value))
    else null
  end;
$$;

create or replace function private.is_valid_customer_email(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.normalize_customer_email(p_value) is not null;
$$;

create or replace function private.is_meaningful_service_address(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    length(btrim(coalesce(p_value, ''))) >= 5
    and (
      select count(*)
      from regexp_matches(btrim(p_value), '[[:alpha:]]', 'g')
    ) >= 2;
$$;

create or replace function private.is_customer_eligible(
  p_name text,
  p_phone text,
  p_email text,
  p_address text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    btrim(coalesce(p_name, '')) <> ''
    and (
      private.is_valid_customer_phone(p_phone)
      or private.is_valid_customer_email(p_email)
      or private.is_meaningful_service_address(p_address)
    );
$$;

create or replace function private.customer_snapshot_json(p_job public.jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'jobId', p_job.id,
    'updatedAt', p_job.updated_at,
    'customerId', p_job.customer_id,
    'customerName', coalesce(p_job.customer_name, ''),
    'customerPhone', p_job.customer_phone,
    'customerEmail', p_job.customer_email,
    'serviceAddress', coalesce(p_job.service_address, '')
  );
$$;

create or replace function private.match_customer_id(
  p_user_id uuid,
  p_name text,
  p_phone text,
  p_email text
)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_norm_name text := private.normalize_customer_name(p_name);
  v_norm_phone text := private.normalize_phone_e164(p_phone);
  v_norm_email text := private.normalize_customer_email(p_email);
  v_candidate uuid;
  v_count integer;
begin
  if v_norm_phone is not null and v_norm_email is not null then
    select count(*) into v_count
    from public.customers c
    where c.user_id = p_user_id
      and c.deleted_at is null
      and c.normalized_phone = v_norm_phone
      and c.normalized_email = v_norm_email;

    if v_count = 1 then
      select c.id into v_candidate
      from public.customers c
      where c.user_id = p_user_id
        and c.deleted_at is null
        and c.normalized_phone = v_norm_phone
        and c.normalized_email = v_norm_email
      limit 1;
      return v_candidate;
    end if;
    if v_count > 1 then
      return null;
    end if;
  end if;

  if v_norm_name = '' then
    return null;
  end if;

  if v_norm_phone is not null then
    select count(*) into v_count
    from public.customers c
    where c.user_id = p_user_id
      and c.deleted_at is null
      and c.normalized_name = v_norm_name
      and c.normalized_phone = v_norm_phone
      and (
        v_norm_email is null
        or c.normalized_email is null
        or c.normalized_email = v_norm_email
      );

    if v_count = 1 then
      select c.id into v_candidate
      from public.customers c
      where c.user_id = p_user_id
        and c.deleted_at is null
        and c.normalized_name = v_norm_name
        and c.normalized_phone = v_norm_phone
        and (
          v_norm_email is null
          or c.normalized_email is null
          or c.normalized_email = v_norm_email
        )
      limit 1;
      return v_candidate;
    end if;
    if v_count > 1 then
      return null;
    end if;
  end if;

  if v_norm_email is not null then
    select count(*) into v_count
    from public.customers c
    where c.user_id = p_user_id
      and c.deleted_at is null
      and c.normalized_name = v_norm_name
      and c.normalized_email = v_norm_email
      and (
        v_norm_phone is null
        or c.normalized_phone is null
        or c.normalized_phone = v_norm_phone
      );

    if v_count = 1 then
      select c.id into v_candidate
      from public.customers c
      where c.user_id = p_user_id
        and c.deleted_at is null
        and c.normalized_name = v_norm_name
        and c.normalized_email = v_norm_email
        and (
          v_norm_phone is null
          or c.normalized_phone is null
          or c.normalized_phone = v_norm_phone
        )
      limit 1;
      return v_candidate;
    end if;
  end if;

  return null;
end;
$$;

create or replace function private.recompute_customer_from_jobs(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.jobs%rowtype;
begin
  if p_customer_id is null then
    return;
  end if;

  select j.* into v_source
  from public.jobs j
  where j.customer_id = p_customer_id
    and j.deleted_at is null
  order by j.updated_at desc, j.id desc
  limit 1;

  if not found then
    update public.customers
    set deleted_at = coalesce(deleted_at, now()),
        updated_at = now()
    where id = p_customer_id
      and deleted_at is null;
    return;
  end if;

  update public.customers c
  set display_name = coalesce(v_source.customer_name, ''),
      phone = v_source.customer_phone,
      email = v_source.customer_email,
      last_service_address = v_source.service_address,
      normalized_name = private.normalize_customer_name(v_source.customer_name),
      normalized_phone = private.normalize_phone_e164(v_source.customer_phone),
      normalized_email = private.normalize_customer_email(v_source.customer_email),
      deleted_at = null,
      updated_at = now()
  where c.id = p_customer_id;
end;
$$;

revoke execute on function private.recompute_customer_from_jobs(uuid)
  from public, anon, authenticated;

create or replace function private.jobs_recompute_customer_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at and coalesce(new.customer_id, old.customer_id) is not null then
    perform private.recompute_customer_from_jobs(coalesce(new.customer_id, old.customer_id));
  end if;
  return new;
end;
$$;

revoke execute on function private.jobs_recompute_customer_on_delete()
  from public, anon, authenticated;

drop trigger if exists jobs_recompute_customer_on_delete on public.jobs;
create trigger jobs_recompute_customer_on_delete
  after update of deleted_at on public.jobs
  for each row execute function private.jobs_recompute_customer_on_delete();

create or replace function private.save_job_customer_snapshot(
  p_job_id uuid,
  p_user_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_name text;
  v_phone text;
  v_email text;
  v_address text;
  v_explicit_customer_id uuid;
  v_resolved_customer_id uuid;
  v_has_explicit_customer boolean;
  v_eligible boolean;
  v_norm_name text;
  v_norm_phone text;
  v_norm_email text;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'save_job_customer:unauthorized' using errcode = 'P0001';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.user_id = p_user_id
    and j.deleted_at is null
  for update;

  if not found then
    raise exception 'save_job_customer:not_found' using errcode = 'P0001';
  end if;

  if p_expected_updated_at is not null and v_job.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object(
      'status', 'conflict',
      'snapshot', private.customer_snapshot_json(v_job)
    );
  end if;

  v_name := coalesce(p_patch ->> 'customerName', '');
  if p_patch ? 'customerPhone' then
    if p_patch -> 'customerPhone' is null or jsonb_typeof(p_patch -> 'customerPhone') = 'null' then
      v_phone := null;
    else
      v_phone := nullif(btrim(p_patch ->> 'customerPhone'), '');
    end if;
  else
    v_phone := v_job.customer_phone;
  end if;

  if p_patch ? 'customerEmail' then
    if p_patch -> 'customerEmail' is null or jsonb_typeof(p_patch -> 'customerEmail') = 'null' then
      v_email := null;
    else
      v_email := nullif(btrim(p_patch ->> 'customerEmail'), '');
    end if;
  else
    v_email := v_job.customer_email;
  end if;

  if p_patch ? 'serviceAddress' then
    if p_patch -> 'serviceAddress' is null or jsonb_typeof(p_patch -> 'serviceAddress') = 'null' then
      v_address := null;
    else
      v_address := nullif(btrim(p_patch ->> 'serviceAddress'), '');
    end if;
  else
    v_address := v_job.service_address;
  end if;

  v_has_explicit_customer := p_patch ? 'customerId';
  v_explicit_customer_id := nullif(p_patch ->> 'customerId', '')::uuid;
  v_eligible := private.is_customer_eligible(v_name, v_phone, v_email, v_address);
  v_norm_name := private.normalize_customer_name(v_name);
  v_norm_phone := private.normalize_phone_e164(v_phone);
  v_norm_email := private.normalize_customer_email(v_email);

  if v_has_explicit_customer and v_explicit_customer_id is not null then
    if not exists (
      select 1 from public.customers c
      where c.id = v_explicit_customer_id
        and c.user_id = p_user_id
    ) then
      raise exception 'save_job_customer:invalid' using errcode = 'P0001';
    end if;
    v_resolved_customer_id := v_explicit_customer_id;
  elsif v_job.customer_id is not null and not v_has_explicit_customer then
    v_resolved_customer_id := v_job.customer_id;
  elsif v_eligible then
    v_resolved_customer_id := private.match_customer_id(p_user_id, v_name, v_phone, v_email);
    if v_resolved_customer_id is null then
      insert into public.customers (
        user_id, display_name, phone, email, last_service_address,
        normalized_name, normalized_phone, normalized_email
      )
      values (
        p_user_id,
        btrim(v_name),
        v_phone,
        v_email,
        v_address,
        v_norm_name,
        v_norm_phone,
        v_norm_email
      )
      returning id into v_resolved_customer_id;
    end if;
  elsif v_has_explicit_customer and v_explicit_customer_id is null then
    v_resolved_customer_id := null;
  elsif v_job.customer_id is not null then
    v_resolved_customer_id := v_job.customer_id;
  else
    v_resolved_customer_id := null;
  end if;

  update public.jobs
  set customer_name = nullif(btrim(v_name), ''),
      customer_phone = v_phone,
      customer_email = v_email,
      service_address = v_address,
      customer_id = v_resolved_customer_id,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  if v_resolved_customer_id is not null then
    update public.customers c
    set display_name = coalesce(nullif(btrim(v_name), ''), ''),
        phone = v_phone,
        email = v_email,
        last_service_address = v_address,
        normalized_name = v_norm_name,
        normalized_phone = v_norm_phone,
        normalized_email = v_norm_email,
        deleted_at = null,
        updated_at = now()
    where c.id = v_resolved_customer_id
      and c.user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'snapshot', private.customer_snapshot_json(v_job)
  );
end;
$$;

revoke execute on function private.save_job_customer_snapshot(uuid, uuid, jsonb, timestamptz)
  from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.save_job_customer_snapshot(uuid, uuid, jsonb, timestamptz)
  to authenticated;

create or replace function public.save_job_customer(
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
  v_expected timestamptz;
begin
  if v_user_id is null then
    raise exception 'save_job_customer:unauthorized' using errcode = 'P0001';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'save_job_customer:invalid' using errcode = 'P0001';
  end if;

  if p_payload ? 'expectedJobUpdatedAt' and p_payload ->> 'expectedJobUpdatedAt' is not null then
    v_expected := (p_payload ->> 'expectedJobUpdatedAt')::timestamptz;
  else
    v_expected := null;
  end if;

  return private.save_job_customer_snapshot(p_job_id, v_user_id, p_payload, v_expected);
end;
$$;

revoke execute on function public.save_job_customer(uuid, jsonb) from public;
grant execute on function public.save_job_customer(uuid, jsonb) to authenticated;

create or replace function public.list_customer_suggestions(p_query text default '')
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_trimmed text := btrim(coalesce(p_query, ''));
  v_limit integer := case when v_trimmed = '' then 4 else 5 end;
  v_results jsonb;
begin
  if v_user_id is null then
    raise exception 'list_customer_suggestions:unauthorized' using errcode = 'P0001';
  end if;

  with eligible as (
    select
      c.id,
      c.display_name,
      c.phone,
      c.email,
      c.last_service_address,
      max(j.updated_at) as latest_job_updated_at,
      (array_agg(j.id order by j.updated_at desc, j.id desc))[1] as latest_job_id
    from public.customers c
    join public.jobs j
      on j.customer_id = c.id
     and j.user_id = c.user_id
     and j.deleted_at is null
    where c.user_id = v_user_id
      and c.deleted_at is null
      and private.is_customer_eligible(
        c.display_name, c.phone, c.email, c.last_service_address
      )
      and (
        v_trimmed = ''
        or c.display_name ilike '%' || v_trimmed || '%'
      )
    group by c.id, c.display_name, c.phone, c.email, c.last_service_address
    order by latest_job_updated_at desc, latest_job_id desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'customerId', e.id,
        'displayName', e.display_name,
        'phone', e.phone,
        'email', e.email,
        'serviceAddress', e.last_service_address
      )
      order by e.latest_job_updated_at desc, e.latest_job_id desc
    ),
    '[]'::jsonb
  )
  into v_results
  from eligible e;

  return v_results;
end;
$$;

revoke execute on function public.list_customer_suggestions(text) from public;
grant execute on function public.list_customer_suggestions(text) to authenticated;

-- Extend apply_job_detail_edit: new-client customer snapshot path vs legacy name/address only.
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
  v_use_customer_rpc boolean;
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
  v_use_customer_rpc := v_job_patch ? 'customerPhone'
    or v_job_patch ? 'customerEmail'
    or v_job_patch ? 'customerId';

  if v_use_customer_rpc then
    update public.jobs
    set short_description = v_short_description,
        long_description = case
          when v_job_patch ? 'longDescription' then v_long_description
          else long_description
        end,
        revenue_cents = v_revenue_cents
    where id = p_job_id;

    perform private.save_job_customer_snapshot(p_job_id, v_user_id, v_job_patch, null);
  else
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
  end if;

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
