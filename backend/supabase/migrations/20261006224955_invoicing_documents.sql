-- Estimates and invoices: component pricing, immutable snapshots, bearer links.
-- Public roles cannot read document tables. Owner and public access go through RPCs.

alter table public.jobs
  add column labor_services_cents bigint,
  add column pricing_mode text not null default 'legacy',
  add column pricing_needs_review boolean not null default false,
  add column pricing_revision bigint not null default 0;

alter table public.jobs
  add constraint jobs_labor_services_cents_check
    check (labor_services_cents is null or labor_services_cents >= 0),
  add constraint jobs_pricing_mode_check
    check (pricing_mode in ('legacy', 'component'));

comment on column public.jobs.labor_services_cents is
  'Customer labor charge in USD cents. Null means Revenue is unknown.';
comment on column public.jobs.pricing_mode is
  'legacy keeps the stored revenue until an explicit solve. component derives revenue from labor and included charges.';

alter table public.job_costs
  add column captured_markup_bps integer,
  add column markup_override_bps integer,
  add column invoice_customer boolean not null default false;

alter table public.job_costs
  add constraint job_costs_captured_markup_bps_check
    check (captured_markup_bps is null or captured_markup_bps between 0 and 100000),
  add constraint job_costs_markup_override_bps_check
    check (markup_override_bps is null or markup_override_bps between 0 and 100000);

grant update (labor_services_cents) on public.jobs to authenticated;
grant insert (captured_markup_bps, markup_override_bps, invoice_customer)
  on public.job_costs to authenticated;
grant update (captured_markup_bps, markup_override_bps, invoice_customer)
  on public.job_costs to authenticated;

create table public.business_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  address text,
  phone text,
  email text,
  website text,
  license text,
  material_markup_bps integer not null default 0,
  tax_rate_bps integer not null default 0,
  taxable_categories text[] not null default array['labor', 'materials', 'billable_other_costs'],
  payment_terms text not null default 'due_on_receipt',
  estimate_expiration_days integer default 30,
  settings_revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint business_settings_name_len check (business_name is null or char_length(business_name) <= 200),
  constraint business_settings_address_len check (address is null or char_length(address) <= 1000),
  constraint business_settings_phone_len check (phone is null or char_length(phone) <= 100),
  constraint business_settings_email_len check (email is null or char_length(email) <= 320),
  constraint business_settings_website_len check (website is null or char_length(website) <= 2048),
  constraint business_settings_license_len check (license is null or char_length(license) <= 200),
  constraint business_settings_markup_check check (material_markup_bps between 0 and 100000),
  constraint business_settings_tax_check check (tax_rate_bps between 0 and 10000),
  constraint business_settings_terms_check check (payment_terms in ('due_on_receipt', 'net_7', 'net_15', 'net_30')),
  constraint business_settings_expiration_check check (
    estimate_expiration_days is null or estimate_expiration_days in (7, 14, 30)
  ),
  constraint business_settings_categories_check check (
    taxable_categories <@ array['labor', 'materials', 'billable_other_costs']::text[]
  )
);

alter table public.business_settings enable row level security;
create policy business_settings_select_own on public.business_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy business_settings_insert_own on public.business_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy business_settings_update_own on public.business_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.business_settings to authenticated;

create table public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null,
  document_type text not null,
  document_number integer not null,
  created_at timestamptz not null default now(),
  issue_date date not null,
  source_timezone text not null,
  valid_until date,
  due_date date,
  payment_terms text,
  currency text not null default 'USD',
  renderer_version integer not null,
  source_fingerprint text not null,
  payload jsonb not null,
  constraint financial_documents_type_check check (document_type in ('estimate', 'invoice')),
  constraint financial_documents_number_check check (document_number >= 1),
  constraint financial_documents_currency_check check (currency = 'USD'),
  constraint financial_documents_owner_job_fkey
    foreign key (job_id, user_id) references public.jobs (id, user_id),
  constraint financial_documents_owner_type_number_key unique (user_id, document_type, document_number)
);

create table public.financial_document_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text not null,
  next_number integer not null default 1,
  primary key (user_id, document_type),
  constraint financial_document_counters_type_check check (document_type in ('estimate', 'invoice')),
  constraint financial_document_counters_number_check check (next_number >= 1)
);

create table public.financial_document_idempotency (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_key uuid not null,
  document_id uuid not null references public.financial_documents (id) on delete cascade,
  intent_hash text not null,
  primary key (user_id, request_key)
);

create table public.financial_document_controls (
  document_id uuid primary key references public.financial_documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  archived boolean not null default false,
  link_enabled boolean not null default true,
  control_revision bigint not null default 1
);

create table public.financial_document_links (
  document_id uuid primary key references public.financial_documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  token_protected text not null,
  created_at timestamptz not null default now()
);

alter table public.financial_documents enable row level security;
alter table public.financial_document_counters enable row level security;
alter table public.financial_document_idempotency enable row level security;
alter table public.financial_document_controls enable row level security;
alter table public.financial_document_links enable row level security;

revoke all privileges on public.financial_documents from anon, authenticated;
revoke all privileges on public.financial_document_counters from anon, authenticated;
revoke all privileges on public.financial_document_idempotency from anon, authenticated;
revoke all privileges on public.financial_document_controls from anon, authenticated;
revoke all privileges on public.financial_document_links from anon, authenticated;

create or replace function private.round_half_up_bps(p_amount bigint, p_bps integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_amount is null or p_bps is null then 0::bigint
    when p_amount < 0 or p_bps < 0 then null::bigint
    else ((p_amount * p_bps) + 5000) / 10000
  end;
$$;

create or replace function private.included_job_costs(p_job_id uuid)
returns setof public.job_costs
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.job_costs c
  join public.jobs j on j.id = p_job_id and j.user_id = c.user_id
  left join public.sessions s on s.id = c.session_id and s.user_id = c.user_id
  where c.deleted_at is null
    and (
      (c.job_id = p_job_id and c.session_id is null)
      or (
        s.job_id = p_job_id
        and s.session_status in ('in_progress', 'ended')
      )
    );
$$;

create or replace function private.job_charge_summary(p_job_id uuid)
returns table (
  material_cost bigint,
  material_charge bigint,
  billable_other bigint,
  direct_cost bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(c.total_cost_cents) filter (where c.cost_type = 'material'), 0)::bigint,
    coalesce(sum(
      c.total_cost_cents + private.round_half_up_bps(
        c.total_cost_cents,
        coalesce(c.markup_override_bps, c.captured_markup_bps, 0)
      )
    ) filter (where c.cost_type = 'material'), 0)::bigint,
    coalesce(sum(c.total_cost_cents) filter (
      where c.cost_type <> 'material' and c.invoice_customer
    ), 0)::bigint,
    coalesce(sum(c.total_cost_cents), 0)::bigint
  from private.included_job_costs(p_job_id) c;
$$;

create or replace function private.capture_material_markup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default integer;
begin
  if new.cost_type = 'material' and new.captured_markup_bps is null then
    select material_markup_bps into v_default
    from public.business_settings
    where user_id = new.user_id;
    new.captured_markup_bps := coalesce(v_default, 0);
    new.invoice_customer := false;
  elsif new.cost_type <> 'material' then
    new.captured_markup_bps := null;
    new.markup_override_bps := null;
  end if;
  return new;
end;
$$;

create trigger job_costs_capture_material_markup
before insert on public.job_costs
for each row execute function private.capture_material_markup();

create or replace function private.sync_component_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary record;
  v_labor bigint;
begin
  if coalesce(current_setting('fieldsolo.skip_revenue_solve', true), '') = '1'
     or coalesce(current_setting('fieldsolo.defer_revenue_solve', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.pricing_mode = 'legacy'
     and coalesce(current_setting('fieldsolo.pricing_intent', true), '') <> 'labor'
     and new.revenue_cents is distinct from old.revenue_cents then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.labor_services_cents is distinct from old.labor_services_cents
     and new.revenue_cents is not distinct from old.revenue_cents then
    select * into v_summary from private.job_charge_summary(new.id);
    v_labor := new.labor_services_cents;
    new.pricing_mode := 'component';
    new.pricing_needs_review := false;
    new.pricing_revision := new.pricing_revision + 1;
    new.revenue_cents := case
      when v_labor is null then null
      else v_labor + v_summary.material_charge + v_summary.billable_other
    end;
    return new;
  end if;

  if new.revenue_cents is distinct from old.revenue_cents
     or (tg_op = 'INSERT' and new.revenue_cents is not null) then
    select * into v_summary from private.job_charge_summary(new.id);
    if new.revenue_cents is null then
      new.labor_services_cents := null;
    else
      v_labor := new.revenue_cents - v_summary.material_charge - v_summary.billable_other;
      if v_labor < 0 then
        raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
      end if;
      new.labor_services_cents := v_labor;
    end if;
    new.pricing_mode := 'component';
    new.pricing_needs_review := false;
    new.pricing_revision := new.pricing_revision + 1;
  end if;
  return new;
end;
$$;

create trigger jobs_sync_component_pricing
before insert or update of revenue_cents, labor_services_cents on public.jobs
for each row execute function private.sync_component_pricing();

create or replace function private.solve_job_revenue(p_job_id uuid, p_revenue bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary record;
  v_labor bigint;
begin
  select * into v_summary from private.job_charge_summary(p_job_id);
  if p_revenue is null then
    v_labor := null;
  else
    v_labor := p_revenue - v_summary.material_charge - v_summary.billable_other;
    if v_labor < 0 then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  end if;
  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  update public.jobs
  set labor_services_cents = v_labor,
      revenue_cents = p_revenue,
      pricing_mode = 'component',
      pricing_needs_review = false,
      pricing_revision = pricing_revision + 1
  where id = p_job_id;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
end;
$$;

create or replace function private.recalculate_component_jobs(p_job_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_job public.jobs%rowtype;
  v_summary record;
  v_revenue bigint;
begin
  if p_job_ids is null then
    return;
  end if;
  for v_job_id in
    select id from public.jobs where id = any(p_job_ids) order by id
  loop
    select * into v_job from public.jobs where id = v_job_id for update;
    if v_job.pricing_mode <> 'component' or v_job.pricing_needs_review then
      continue;
    end if;
    select * into v_summary from private.job_charge_summary(v_job_id);
    v_revenue := case
      when v_job.labor_services_cents is null then null
      else v_job.labor_services_cents + v_summary.material_charge + v_summary.billable_other
    end;
    if v_revenue is distinct from v_job.revenue_cents then
      perform set_config('fieldsolo.skip_revenue_solve', '1', true);
      update public.jobs
      set revenue_cents = v_revenue,
          pricing_revision = pricing_revision + 1
      where id = v_job_id;
      perform set_config('fieldsolo.skip_revenue_solve', '', true);
    end if;
  end loop;
end;
$$;

create or replace function private.job_ids_for_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := array[]::uuid[];
  v_row public.job_costs%rowtype;
  v_job_id uuid;
begin
  if coalesce(current_setting('fieldsolo.defer_revenue_solve', true), '') = '1' then
    return coalesce(new, old);
  end if;

  v_row := coalesce(new, old);
  if v_row.job_id is not null then
    v_ids := array_append(v_ids, v_row.job_id);
  end if;
  if v_row.session_id is not null then
    select s.job_id into v_job_id from public.sessions s where s.id = v_row.session_id;
    if v_job_id is not null then
      v_ids := array_append(v_ids, v_job_id);
    end if;
  end if;
  if tg_op = 'UPDATE' and old.job_id is distinct from new.job_id and old.job_id is not null then
    v_ids := array_append(v_ids, old.job_id);
  end if;
  if tg_op = 'UPDATE' and old.session_id is distinct from new.session_id and old.session_id is not null then
    select s.job_id into v_job_id from public.sessions s where s.id = old.session_id;
    if v_job_id is not null then
      v_ids := array_append(v_ids, v_job_id);
    end if;
  end if;
  perform private.recalculate_component_jobs(v_ids);
  return null;
end;
$$;

create trigger job_costs_recalculate_pricing
after insert or update or delete on public.job_costs
for each row execute function private.job_ids_for_cost();

create or replace function private.disable_job_document_links(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.financial_document_controls c
  set link_enabled = false,
      control_revision = c.control_revision + 1
  from public.financial_documents d
  where d.id = c.document_id
    and d.job_id = p_job_id
    and c.link_enabled;
end;
$$;

create or replace function private.jobs_document_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.disable_job_document_links(new.id);
  elsif tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null then
    if old.pricing_mode = 'legacy' then
      new.pricing_needs_review := true;
    end if;
    perform private.disable_job_document_links(new.id);
  end if;
  return new;
end;
$$;

create trigger jobs_document_lifecycle
before update of deleted_at on public.jobs
for each row execute function private.jobs_document_lifecycle();

create or replace function private.bump_business_settings_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.settings_revision := old.settings_revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger business_settings_revision
before update on public.business_settings
for each row execute function private.bump_business_settings_revision();

create or replace function private.trim_business_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.business_name := nullif(btrim(coalesce(new.business_name, '')), '');
  new.address := nullif(btrim(coalesce(new.address, '')), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.email := nullif(btrim(coalesce(new.email, '')), '');
  new.website := nullif(btrim(coalesce(new.website, '')), '');
  new.license := nullif(btrim(coalesce(new.license, '')), '');
  return new;
end;
$$;

create trigger business_settings_trim
before insert or update on public.business_settings
for each row execute function private.trim_business_settings();

-- Active jobs only. Deleted jobs stay legacy. Negative residuals are left unconverted.
update public.job_costs
set captured_markup_bps = 0
where cost_type = 'material' and captured_markup_bps is null;

with material as (
  select
    j.id,
    j.revenue_cents,
    coalesce(sum(c.total_cost_cents) filter (where c.cost_type = 'material' and c.deleted_at is null), 0)::bigint as materials
  from public.jobs j
  left join public.job_costs c
    on c.user_id = j.user_id
   and c.deleted_at is null
   and (
     (c.job_id = j.id and c.session_id is null)
     or c.session_id in (
       select s.id from public.sessions s
       where s.job_id = j.id and s.user_id = j.user_id and s.session_status in ('in_progress', 'ended')
     )
   )
  where j.deleted_at is null
  group by j.id, j.revenue_cents
)
update public.jobs j
set labor_services_cents = case
      when m.revenue_cents is null then null
      else m.revenue_cents - m.materials
    end,
    pricing_mode = 'component',
    pricing_needs_review = false
from material m
where j.id = m.id
  and (m.revenue_cents is null or m.revenue_cents >= m.materials);

do $$
declare
  v_negative bigint;
begin
  select count(*) into v_negative
  from public.jobs j
  where j.deleted_at is null
    and j.pricing_mode = 'legacy'
    and j.revenue_cents is not null
    and j.revenue_cents < coalesce((
      select sum(c.total_cost_cents)
      from public.job_costs c
      where c.user_id = j.user_id
        and c.deleted_at is null
        and c.cost_type = 'material'
        and (
          (c.job_id = j.id and c.session_id is null)
          or c.session_id in (
            select s.id from public.sessions s
            where s.job_id = j.id and s.user_id = j.user_id and s.session_status in ('in_progress', 'ended')
          )
        )
    ), 0);
  if v_negative > 0 then
    raise notice 'invoicing backfill left % active jobs unconverted because materials exceed revenue', v_negative;
  end if;
end;
$$;

create or replace function private.term_days(p_terms text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_terms
    when 'net_7' then 7
    when 'net_15' then 15
    when 'net_30' then 30
    else 0
  end;
$$;

create or replace function private.assert_time_zone(p_timezone text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'financial_document:invalid' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.document_readiness(p_job_id uuid, p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_settings public.business_settings%rowtype;
  v_gaps text[] := array[]::text[];
  v_cost public.job_costs%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id and user_id = p_user_id and deleted_at is null;
  if not found then
    return array['job'];
  end if;
  select * into v_settings from public.business_settings where user_id = p_user_id;
  if not found or coalesce(v_settings.business_name, '') = '' then
    v_gaps := array_append(v_gaps, 'business_name');
  end if;
  if coalesce(btrim(v_job.customer_name), '') = '' then
    v_gaps := array_append(v_gaps, 'customer_name');
  end if;
  if btrim(v_job.short_description) = '' or v_job.short_description = 'Untitled Job' then
    v_gaps := array_append(v_gaps, 'short_description');
  end if;
  if v_job.labor_services_cents is null or v_job.pricing_needs_review or v_job.pricing_mode <> 'component' then
    v_gaps := array_append(v_gaps, 'labor');
  end if;
  for v_cost in select * from private.included_job_costs(p_job_id) loop
    if v_cost.cost_type = 'material' and v_cost.total_cost_cents <= 0 then
      v_gaps := array_append(v_gaps, 'material_amount');
    elsif v_cost.cost_type <> 'material' and v_cost.invoice_customer and (
      v_cost.total_cost_cents <= 0 or not v_cost.cost_type_explicit
    ) then
      v_gaps := array_append(v_gaps, 'billable_other');
    end if;
  end loop;
  return (select coalesce(array_agg(distinct gap), array[]::text[]) from unnest(v_gaps) gap);
end;
$$;

create or replace function private.build_document_payload(
  p_job_id uuid,
  p_user_id uuid,
  p_type text,
  p_number integer,
  p_issue_date date,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_settings public.business_settings%rowtype;
  v_summary record;
  v_lines jsonb := '[]'::jsonb;
  v_materials jsonb;
  v_other jsonb;
  v_subtotal bigint;
  v_taxable bigint := 0;
  v_tax bigint;
  v_total bigint;
  v_valid date;
  v_due date;
  v_categories text[];
begin
  select * into v_job from public.jobs where id = p_job_id and user_id = p_user_id;
  select * into v_settings from public.business_settings where user_id = p_user_id;
  if not found then
    v_settings := row(
      p_user_id, null, null, null, null, null, null,
      0, 0, array['labor', 'materials', 'billable_other_costs']::text[],
      'due_on_receipt', 30, 0, now()
    )::public.business_settings;
  end if;
  select * into v_summary from private.job_charge_summary(p_job_id);
  v_subtotal := coalesce(v_job.labor_services_cents, 0) + v_summary.material_charge + v_summary.billable_other;
  v_categories := coalesce(v_settings.taxable_categories, array[]::text[]);
  if 'labor' = any(v_categories) then
    v_taxable := v_taxable + coalesce(v_job.labor_services_cents, 0);
  end if;
  if 'materials' = any(v_categories) then
    v_taxable := v_taxable + v_summary.material_charge;
  end if;
  if 'billable_other_costs' = any(v_categories) then
    v_taxable := v_taxable + v_summary.billable_other;
  end if;
  v_tax := private.round_half_up_bps(v_taxable, coalesce(v_settings.tax_rate_bps, 0));
  v_total := v_subtotal + v_tax;

  if v_subtotal = 0 or coalesce(v_job.labor_services_cents, 0) <> 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'kind', 'labor', 'label', 'Labor & Services', 'amountCents', coalesce(v_job.labor_services_cents, 0)
    ));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'materials',
    'label', coalesce(nullif(btrim(c.description), ''), 'Materials'),
    'amountCents', c.total_cost_cents + private.round_half_up_bps(
      c.total_cost_cents,
      coalesce(c.markup_override_bps, c.captured_markup_bps, 0)
    ),
    'details', case
      when coalesce(c.quantity_explicit, true) and c.quantity is not null then jsonb_build_object(
        'quantity', c.quantity,
        'unit', nullif(btrim(c.unit), ''),
        'unitPriceCents', case
          when coalesce(c.unit_cost_explicit, true) and coalesce(c.unit_cost_cents, 0) > 0
            then c.unit_cost_cents + private.round_half_up_bps(
              c.unit_cost_cents, coalesce(c.markup_override_bps, c.captured_markup_bps, 0)
            )
          else null
        end
      )
      else null
    end
  ) order by c.created_at, c.id), '[]'::jsonb)
  into v_materials
  from private.included_job_costs(p_job_id) c
  where c.cost_type = 'material' and c.total_cost_cents > 0;
  v_lines := v_lines || coalesce(v_materials, '[]'::jsonb);

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'other',
    'label', case c.cost_type
      when 'helper_labor' then 'Helper labor'
      when 'equipment_rental' then 'Equipment rental'
      when 'permit' then 'Permit'
      when 'disposal' then 'Disposal'
      when 'travel_parking' then 'Travel & parking'
      else 'Other'
    end,
    'category', c.cost_type,
    'description', nullif(btrim(c.description), ''),
    'amountCents', c.total_cost_cents
  ) order by c.cost_type, c.created_at, c.id), '[]'::jsonb)
  into v_other
  from private.included_job_costs(p_job_id) c
  where c.cost_type <> 'material' and c.invoice_customer and c.total_cost_cents > 0;
  v_lines := v_lines || coalesce(v_other, '[]'::jsonb);

  if p_type = 'estimate' then
    v_valid := case
      when v_settings.estimate_expiration_days is null then null
      else p_issue_date + v_settings.estimate_expiration_days
    end;
    v_due := null;
  else
    v_valid := null;
    v_due := p_issue_date + private.term_days(coalesce(v_settings.payment_terms, 'due_on_receipt'));
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'documentType', p_type,
    'documentNumber', p_number,
    'businessName', coalesce(v_settings.business_name, ''),
    'businessAddress', v_settings.address,
    'businessPhone', v_settings.phone,
    'businessEmail', v_settings.email,
    'businessWebsite', v_settings.website,
    'businessLicense', v_settings.license,
    'customerName', coalesce(v_job.customer_name, ''),
    'customerPhone', v_job.customer_phone,
    'customerEmail', v_job.customer_email,
    'serviceAddress', v_job.service_address,
    'shortDescription', v_job.short_description,
    'longDescription', v_job.long_description,
    'lines', v_lines,
    'subtotalCents', v_subtotal,
    'taxRateBps', coalesce(v_settings.tax_rate_bps, 0),
    'taxCents', v_tax,
    'totalCents', v_total,
    'currency', 'USD',
    'issueDate', to_char(p_issue_date, 'YYYY-MM-DD'),
    'validUntil', case when v_valid is null then null else to_char(v_valid, 'YYYY-MM-DD') end,
    'dueDate', case when v_due is null then null else to_char(v_due, 'YYYY-MM-DD') end,
    'paymentTerms', case when p_type = 'invoice' then coalesce(v_settings.payment_terms, 'due_on_receipt') else null end
  );
end;
$$;

create or replace function private.source_fingerprint(
  p_job_id uuid,
  p_user_id uuid,
  p_type text,
  p_timezone text,
  p_issue_date date
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_revision bigint;
  v_costs text;
begin
  select * into v_job from public.jobs where id = p_job_id and user_id = p_user_id;
  select settings_revision into v_revision from public.business_settings where user_id = p_user_id;
  select coalesce(string_agg(
    concat_ws(':', c.id::text, c.total_cost_cents::text, coalesce(c.markup_override_bps::text, c.captured_markup_bps::text, '0'), c.invoice_customer::text, c.cost_type, coalesce(c.description, ''), c.quantity::text, c.unit, c.unit_cost_cents::text, c.quantity_explicit::text, c.unit_cost_explicit::text),
    ',' order by c.id
  ), '')
  into v_costs
  from private.included_job_costs(p_job_id) c;
  return encode(extensions.digest(convert_to(concat_ws('|',
    p_job_id::text,
    v_job.pricing_revision::text,
    coalesce(v_job.labor_services_cents::text, 'null'),
    coalesce(v_job.revenue_cents::text, 'null'),
    coalesce(v_job.job_payment_state, ''),
    v_job.short_description,
    coalesce(v_job.long_description, ''),
    coalesce(v_job.customer_name, ''),
    coalesce(v_job.customer_phone, ''),
    coalesce(v_job.customer_email, ''),
    coalesce(v_job.service_address, ''),
    coalesce(v_revision::text, '0'),
    '1',
    p_type,
    p_timezone,
    p_issue_date::text,
    v_costs
  ), 'utf8'), 'sha256'), 'hex');
end;
$$;

create or replace function private.payment_projection(p_state text, p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type <> 'invoice' then null
    when p_state = 'paid' then 'paid'
    else 'unpaid'
  end;
$$;

create or replace function private.preview_financial_document(
  p_job_id uuid,
  p_type text,
  p_timezone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_issue date;
  v_gaps text[];
  v_payload jsonb;
  v_state text;
begin
  if v_user_id is null then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  if p_type not in ('estimate', 'invoice') then
    raise exception 'financial_document:invalid' using errcode = 'P0001';
  end if;
  perform private.assert_time_zone(p_timezone);
  if not exists (
    select 1 from public.jobs
    where id = p_job_id and user_id = v_user_id and deleted_at is null
  ) then
    raise exception 'financial_document:not_found' using errcode = 'P0001';
  end if;
  v_issue := (now() at time zone p_timezone)::date;
  v_gaps := private.document_readiness(p_job_id, v_user_id);
  v_payload := private.build_document_payload(p_job_id, v_user_id, p_type, null, v_issue, p_timezone);
  select job_payment_state into v_state from public.jobs where id = p_job_id;
  return jsonb_build_object(
    'status', 'ok',
    'gaps', to_jsonb(v_gaps),
    'fingerprint', private.source_fingerprint(p_job_id, v_user_id, p_type, p_timezone, v_issue),
    'paymentProjection', private.payment_projection(v_state, p_type),
    'payload', v_payload,
    'rendererVersion', 1
  );
end;
$$;

create or replace function private.owner_document_json(p_document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc public.financial_documents%rowtype;
  v_control public.financial_document_controls%rowtype;
  v_token text;
  v_state text;
begin
  select * into v_doc from public.financial_documents where id = p_document_id and user_id = auth.uid();
  if not found then
    raise exception 'financial_document:not_found' using errcode = 'P0001';
  end if;
  select * into v_control from public.financial_document_controls where document_id = v_doc.id;
  select token_protected into v_token from public.financial_document_links where document_id = v_doc.id;
  select job_payment_state into v_state from public.jobs where id = v_doc.job_id;
  return jsonb_build_object(
    'id', v_doc.id,
    'jobId', v_doc.job_id,
    'documentType', v_doc.document_type,
    'documentNumber', v_doc.document_number,
    'createdAt', v_doc.created_at,
    'issueDate', v_doc.issue_date,
    'rendererVersion', v_doc.renderer_version,
    'payload', v_doc.payload,
    'archived', v_control.archived,
    'linkEnabled', v_control.link_enabled,
    'controlRevision', v_control.control_revision,
    'token', v_token,
    'paymentProjection', private.payment_projection(v_state, v_doc.document_type)
  );
end;
$$;

create or replace function private.create_financial_document(
  p_job_id uuid,
  p_type text,
  p_fingerprint text,
  p_timezone text,
  p_request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_issue date;
  v_gaps text[];
  v_fingerprint text;
  v_existing record;
  v_number integer;
  v_doc_id uuid;
  v_token text;
  v_hash text;
  v_payload jsonb;
  v_intent text;
begin
  if v_user_id is null then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  if p_request_key is null or p_type not in ('estimate', 'invoice') then
    raise exception 'financial_document:invalid' using errcode = 'P0001';
  end if;
  perform private.assert_time_zone(p_timezone);
  perform 1 from public.jobs
  where id = p_job_id and user_id = v_user_id and deleted_at is null
  for update;
  if not found then
    raise exception 'financial_document:not_found' using errcode = 'P0001';
  end if;

  v_issue := (now() at time zone p_timezone)::date;
  v_fingerprint := private.source_fingerprint(p_job_id, v_user_id, p_type, p_timezone, v_issue);
  v_intent := encode(extensions.digest(convert_to(concat_ws('|', p_job_id::text, p_type, v_fingerprint), 'utf8'), 'sha256'), 'hex');

  select * into v_existing
  from public.financial_document_idempotency
  where user_id = v_user_id and request_key = p_request_key
  for update;
  if found then
    if v_existing.intent_hash is distinct from v_intent then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    return private.owner_document_json(v_existing.document_id);
  end if;

  if p_fingerprint is distinct from v_fingerprint then
    raise exception 'financial_document:stale' using errcode = 'P0001';
  end if;
  v_gaps := private.document_readiness(p_job_id, v_user_id);
  if cardinality(v_gaps) > 0 then
    return jsonb_build_object('status', 'incomplete', 'gaps', to_jsonb(v_gaps));
  end if;

  insert into public.financial_document_counters (user_id, document_type, next_number)
  values (v_user_id, p_type, 1)
  on conflict (user_id, document_type) do nothing;
  select next_number into v_number
  from public.financial_document_counters
  where user_id = v_user_id and document_type = p_type
  for update;
  update public.financial_document_counters
  set next_number = next_number + 1
  where user_id = v_user_id and document_type = p_type;

  v_payload := private.build_document_payload(p_job_id, v_user_id, p_type, v_number, v_issue, p_timezone);
  insert into public.financial_documents (
    user_id, job_id, document_type, document_number, issue_date, source_timezone,
    valid_until, due_date, payment_terms, renderer_version, source_fingerprint, payload
  ) values (
    v_user_id, p_job_id, p_type, v_number, v_issue, p_timezone,
    nullif(v_payload ->> 'validUntil', '')::date,
    nullif(v_payload ->> 'dueDate', '')::date,
    v_payload ->> 'paymentTerms',
    1,
    v_fingerprint,
    v_payload
  ) returning id into v_doc_id;

  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  v_hash := encode(extensions.digest(convert_to(v_token, 'utf8'), 'sha256'), 'hex');
  insert into public.financial_document_links (document_id, user_id, token_hash, token_protected)
  values (v_doc_id, v_user_id, v_hash, v_token);
  insert into public.financial_document_controls (document_id, user_id)
  values (v_doc_id, v_user_id);
  insert into public.financial_document_idempotency (user_id, request_key, document_id, intent_hash)
  values (v_user_id, p_request_key, v_doc_id, v_intent);

  return private.owner_document_json(v_doc_id);
end;
$$;

create or replace function private.list_financial_documents(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user_id is null then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.jobs where id = p_job_id and user_id = v_user_id
  ) then
    raise exception 'financial_document:not_found' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(private.owner_document_json(d.id) order by d.created_at desc, d.id desc), '[]'::jsonb)
  into v_rows
  from public.financial_documents d
  where d.job_id = p_job_id and d.user_id = v_user_id;
  return jsonb_build_object('status', 'ok', 'documents', v_rows);
end;
$$;

create or replace function private.read_financial_document(p_document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  return private.owner_document_json(p_document_id);
end;
$$;

create or replace function private.set_financial_document_controls(
  p_document_id uuid,
  p_archived boolean,
  p_link_enabled boolean,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  select control_revision into v_revision
  from public.financial_document_controls
  where document_id = p_document_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'financial_document:not_found' using errcode = 'P0001';
  end if;
  if v_revision is distinct from p_expected_revision then
    raise exception 'financial_document:conflict' using errcode = 'P0001';
  end if;
  update public.financial_document_controls
  set archived = p_archived,
      link_enabled = p_link_enabled,
      control_revision = control_revision + 1
  where document_id = p_document_id;
  return private.owner_document_json(p_document_id);
end;
$$;

create or replace function private.resolve_shared_financial_document(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_link public.financial_document_links%rowtype;
  v_control public.financial_document_controls%rowtype;
  v_doc public.financial_documents%rowtype;
  v_state text;
  v_owner uuid;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('status', 'unavailable');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'utf8'), 'sha256'), 'hex');
  select * into v_link from public.financial_document_links where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select * into v_control from public.financial_document_controls where document_id = v_link.document_id;
  select * into v_doc from public.financial_documents where id = v_link.document_id;
  select id into v_owner from auth.users where id = v_doc.user_id;
  if v_owner is null
     or not coalesce(v_control.link_enabled, false)
     or not exists (
       select 1 from public.jobs j
       where j.id = v_doc.job_id and j.user_id = v_doc.user_id and j.deleted_at is null
     ) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select job_payment_state into v_state from public.jobs where id = v_doc.job_id;
  return jsonb_build_object(
    'status', 'ok',
    'rendererVersion', v_doc.renderer_version,
    'paymentProjection', private.payment_projection(v_state, v_doc.document_type),
    'payload', v_doc.payload
  );
end;
$$;

create or replace function private.revoke_owner_document_links(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or (
       auth.uid() is distinct from p_user_id
       and coalesce(auth.role(), '') is distinct from 'service_role'
     ) then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  update public.financial_document_controls
  set link_enabled = false,
      control_revision = control_revision + 1
  where user_id = p_user_id and link_enabled;
end;
$$;

create or replace function public.preview_financial_document(p_job_id uuid, p_type text, p_timezone text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  return private.preview_financial_document(p_job_id, p_type, p_timezone);
end;
$$;

create or replace function public.create_financial_document(
  p_job_id uuid, p_type text, p_fingerprint text, p_timezone text, p_request_key uuid
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  return private.create_financial_document(p_job_id, p_type, p_fingerprint, p_timezone, p_request_key);
end;
$$;

create or replace function public.list_financial_documents(p_job_id uuid)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  return private.list_financial_documents(p_job_id);
end;
$$;

create or replace function public.read_financial_document(p_document_id uuid)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  return private.read_financial_document(p_document_id);
end;
$$;

create or replace function public.set_financial_document_controls(
  p_document_id uuid, p_archived boolean, p_link_enabled boolean, p_expected_revision bigint
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  return private.set_financial_document_controls(p_document_id, p_archived, p_link_enabled, p_expected_revision);
end;
$$;

create or replace function public.resolve_shared_financial_document(p_token text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.resolve_shared_financial_document(p_token);
$$;

create or replace function public.revoke_owner_document_links()
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  perform private.revoke_owner_document_links(auth.uid());
end;
$$;

revoke all on function public.preview_financial_document(uuid, text, text) from public;
revoke all on function public.create_financial_document(uuid, text, text, text, uuid) from public;
revoke all on function public.list_financial_documents(uuid) from public;
revoke all on function public.read_financial_document(uuid) from public;
revoke all on function public.set_financial_document_controls(uuid, boolean, boolean, bigint) from public;
revoke all on function public.resolve_shared_financial_document(text) from public;
revoke all on function public.revoke_owner_document_links() from public;

grant execute on function public.preview_financial_document(uuid, text, text) to authenticated;
grant execute on function public.create_financial_document(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.list_financial_documents(uuid) to authenticated;
grant execute on function public.read_financial_document(uuid) to authenticated;
grant execute on function public.set_financial_document_controls(uuid, boolean, boolean, bigint) to authenticated;
grant execute on function public.revoke_owner_document_links() to authenticated;
grant execute on function public.resolve_shared_financial_document(text) to anon, authenticated;

grant execute on function private.preview_financial_document(uuid, text, text) to authenticated;
grant execute on function private.create_financial_document(uuid, text, text, text, uuid) to authenticated;
grant execute on function private.list_financial_documents(uuid) to authenticated;
grant execute on function private.read_financial_document(uuid) to authenticated;
grant execute on function private.set_financial_document_controls(uuid, boolean, boolean, bigint) to authenticated;
grant execute on function private.revoke_owner_document_links(uuid) to authenticated, service_role;
grant execute on function private.resolve_shared_financial_document(text) to anon, authenticated;

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
  v_defer_owned boolean := false;
begin
  if v_user_id is null then
    raise exception 'apply_job_detail_edit:unauthorized' using errcode = 'P0001';
  end if;

  if coalesce(current_setting('fieldsolo.defer_revenue_solve', true), '') <> '1' then
    perform set_config('fieldsolo.defer_revenue_solve', '1', true);
    v_defer_owned := true;
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

  if v_defer_owned then
    perform set_config('fieldsolo.defer_revenue_solve', '', true);
  end if;
  return jsonb_build_object('status', 'ok');
exception
  when others then
    if v_defer_owned then
      perform set_config('fieldsolo.defer_revenue_solve', '', true);
    end if;
    raise;
end;
$$;

create or replace function public.apply_job_detail_edit_atomic(
  p_job_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_apply_payload jsonb := p_payload;
  v_job_patch jsonb;
  v_user_id uuid := auth.uid();
  v_no_revenue_confirmed boolean;
  v_no_materials_confirmed boolean;
  v_no_other_costs_confirmed boolean;
  v_item jsonb;
  v_labor bigint;
  v_revenue bigint;
  v_current_revenue bigint;
begin
  if v_user_id is null then
    raise exception 'apply_job_detail_edit:unauthorized' using errcode = 'P0001';
  end if;

  v_job_patch := p_payload -> 'job';
  if v_job_patch is null or jsonb_typeof(v_job_patch) <> 'object' then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;

  if not (v_job_patch ? 'noRevenueConfirmed')
     or jsonb_typeof(v_job_patch -> 'noRevenueConfirmed') <> 'boolean'
     or not (v_job_patch ? 'noMaterialsConfirmed')
     or jsonb_typeof(v_job_patch -> 'noMaterialsConfirmed') <> 'boolean'
     or not (v_job_patch ? 'noOtherCostsConfirmed')
     or jsonb_typeof(v_job_patch -> 'noOtherCostsConfirmed') <> 'boolean' then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;

  v_no_revenue_confirmed := (v_job_patch ->> 'noRevenueConfirmed')::boolean;
  v_no_materials_confirmed := (v_job_patch ->> 'noMaterialsConfirmed')::boolean;
  v_no_other_costs_confirmed := (v_job_patch ->> 'noOtherCostsConfirmed')::boolean;

  if v_no_revenue_confirmed and coalesce(v_job_patch ->> 'pricingIntent', '') <> 'labor' then
    v_apply_payload := jsonb_set(v_apply_payload, '{job,revenueCents}', '0'::jsonb, true);
  end if;

  perform set_config('fieldsolo.defer_revenue_solve', '1', true);

  update public.jobs
  set revenue_cents = case
        when v_no_revenue_confirmed
          and coalesce(v_job_patch ->> 'pricingIntent', '') <> 'labor' then 0
        else revenue_cents
      end,
      no_revenue_confirmed_at = case
        when v_no_revenue_confirmed then coalesce(no_revenue_confirmed_at, now())
        else null
      end,
      materials_reviewed_at = case
        when v_no_materials_confirmed then coalesce(materials_reviewed_at, now())
        else null
      end,
      other_costs_reviewed_at = case
        when v_no_other_costs_confirmed then coalesce(other_costs_reviewed_at, now())
        else null
      end
  where id = p_job_id
    and user_id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception 'apply_job_detail_edit:not_found' using errcode = 'P0001';
  end if;

  v_result := public.apply_job_detail_edit(p_job_id, v_apply_payload);

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_payload #> '{materials,update}', '[]'::jsonb))
    union all
    select value
    from jsonb_array_elements(coalesce(p_payload #> '{materials,create}', '[]'::jsonb))
  loop
    if v_item ? 'markupOverrideBps' then
      update public.job_costs
      set markup_override_bps = case
        when v_item -> 'markupOverrideBps' is null then null
        else (v_item ->> 'markupOverrideBps')::integer
      end
      where id = (v_item ->> 'id')::uuid
        and user_id = v_user_id
        and cost_type = 'material';
    end if;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_payload #> '{otherCosts,update}', '[]'::jsonb))
    union all
    select value
    from jsonb_array_elements(coalesce(p_payload #> '{otherCosts,create}', '[]'::jsonb))
  loop
    if v_item ? 'invoiceCustomer' then
      update public.job_costs
      set invoice_customer = (v_item ->> 'invoiceCustomer')::boolean
      where id = (v_item ->> 'id')::uuid
        and user_id = v_user_id
        and cost_type <> 'material';
    end if;
  end loop;

  perform set_config('fieldsolo.defer_revenue_solve', '', true);

  if coalesce(v_job_patch ->> 'pricingIntent', '') = 'labor' then
    if v_job_patch ? 'laborServicesCents' and v_job_patch -> 'laborServicesCents' is not null then
      v_labor := (v_job_patch ->> 'laborServicesCents')::bigint;
      if v_labor < 0 then
        raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
      end if;
    else
      v_labor := null;
    end if;
    perform set_config('fieldsolo.pricing_intent', 'labor', true);
    update public.jobs
    set labor_services_cents = v_labor
    where id = p_job_id and user_id = v_user_id;
    perform set_config('fieldsolo.pricing_intent', '', true);
    if v_no_revenue_confirmed and coalesce((select revenue_cents from public.jobs where id = p_job_id), 0) <> 0 then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  else
    v_revenue := case
      when v_apply_payload -> 'job' -> 'revenueCents' is null
        or jsonb_typeof(v_apply_payload -> 'job' -> 'revenueCents') = 'null' then null
      else (v_apply_payload -> 'job' ->> 'revenueCents')::bigint
    end;
    select revenue_cents into v_current_revenue
    from public.jobs
    where id = p_job_id and user_id = v_user_id;
    if v_revenue is distinct from v_current_revenue then
      perform private.solve_job_revenue(p_job_id, v_revenue);
    end if;
  end if;

  return v_result;
exception
  when others then
    perform set_config('fieldsolo.defer_revenue_solve', '', true);
    raise;
end;
$$;

create or replace function private.reject_financial_document_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'financial_document:immutable' using errcode = 'P0001';
end;
$$;

create trigger financial_documents_immutable
before update on public.financial_documents
for each row execute function private.reject_financial_document_update();

revoke execute on function public.apply_job_detail_edit_atomic(uuid, jsonb) from public;
grant execute on function public.apply_job_detail_edit_atomic(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
