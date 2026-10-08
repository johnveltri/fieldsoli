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
    )
  ) order by c.created_at, c.id), '[]'::jsonb)
  into v_materials
  from private.included_job_costs(p_job_id) c
  where c.cost_type = 'material' and c.total_cost_cents > 0;
  v_lines := v_lines || coalesce(v_materials, '[]'::jsonb);

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'other',
    'label', case category
      when 'helper_labor' then 'Helper labor'
      when 'equipment_rental' then 'Equipment rental'
      when 'permit' then 'Permit'
      when 'disposal' then 'Disposal'
      when 'travel_parking' then 'Travel & parking'
      else 'Other'
    end,
    'category', category,
    'amountCents', amount
  ) order by category), '[]'::jsonb)
  into v_other
  from (
    select c.cost_type as category, sum(c.total_cost_cents)::bigint as amount
    from private.included_job_costs(p_job_id) c
    where c.cost_type <> 'material' and c.invoice_customer and c.total_cost_cents > 0
    group by c.cost_type
  ) grouped;
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
