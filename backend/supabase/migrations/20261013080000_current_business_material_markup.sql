-- Unset overrides inherit the current business default. Issued documents stay immutable.
create or replace function private.effective_material_markup(p_user_id uuid, p_override_bps integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_override_bps, (
    select material_markup_bps from public.business_settings where user_id = p_user_id
  ), 0);
$$;

revoke all on function private.effective_material_markup(uuid, integer) from public;


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
        private.effective_material_markup(c.user_id, c.markup_override_bps)
      )
    ) filter (where c.cost_type = 'material'), 0)::bigint,
    coalesce(sum(c.total_cost_cents) filter (
      where c.cost_type <> 'material' and c.invoice_customer
    ), 0)::bigint,
    coalesce(sum(c.total_cost_cents), 0)::bigint
  from private.included_job_costs(p_job_id) c;
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
      private.effective_material_markup(c.user_id, c.markup_override_bps)
    ),
    'details', case
      when coalesce(c.quantity_explicit, true) and c.quantity is not null then jsonb_build_object(
        'quantity', c.quantity,
        'unit', nullif(btrim(c.unit), ''),
        'unitPriceCents', case
          when coalesce(c.unit_cost_explicit, true) and coalesce(c.unit_cost_cents, 0) > 0
            then c.unit_cost_cents + private.round_half_up_bps(
              c.unit_cost_cents, private.effective_material_markup(c.user_id, c.markup_override_bps)
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
    concat_ws(':', c.id::text, c.total_cost_cents::text, private.effective_material_markup(c.user_id, c.markup_override_bps)::text, c.invoice_customer::text, c.cost_type, coalesce(c.description, ''), c.quantity::text, c.unit, c.unit_cost_cents::text, c.quantity_explicit::text, c.unit_cost_explicit::text),
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

-- Refresh persisted Job revenue when the business default changes, including settings
-- created after materials were already recorded. Explicit overrides remain authoritative.
create or replace function private.refresh_jobs_for_material_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_ids uuid[];
begin
  if TG_OP = 'UPDATE' then
    if new.material_markup_bps is not distinct from old.material_markup_bps then
      return new;
    end if;
  end if;
  select array_agg(j.id order by j.id) into v_job_ids
  from public.jobs j
  where j.user_id = new.user_id and j.deleted_at is null
    and j.pricing_mode = 'component' and not j.pricing_needs_review;
  perform private.recalculate_component_jobs(v_job_ids);
  return new;
end;
$$;

revoke all on function private.refresh_jobs_for_material_default() from public;
create trigger business_settings_refresh_material_pricing
  after insert or update of material_markup_bps on public.business_settings
  for each row execute function private.refresh_jobs_for_material_default();

-- Reconcile existing live jobs with the newly approved default behavior.
select private.recalculate_component_jobs(array_agg(id order by id))
from public.jobs
where deleted_at is null and pricing_mode = 'component' and not pricing_needs_review;

notify pgrst, 'reload schema';
