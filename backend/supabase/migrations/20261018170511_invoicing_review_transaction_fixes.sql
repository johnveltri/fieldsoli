-- Invoicing rollout remains opt-in until a Job explicitly adopts an Invoice.
alter table public.jobs alter column revenue_invoice_required set default false;
-- Metadata backfills must not reorder historical Jobs.
alter table public.jobs disable trigger set_jobs_updated_at;
update public.jobs set revenue_invoice_required = false
where revenue_document_id is null and revenue_invoice_required;

-- Zero Labor & Services is independent of an entire Job having zero Revenue.
alter table public.jobs add column no_labor_services_confirmed_at timestamptz;
comment on column public.jobs.no_labor_services_confirmed_at is
  'Explicit confirmation of zero Labor & Services; materials and billable costs may remain.';
grant update (no_labor_services_confirmed_at) on public.jobs to authenticated;
-- Preserve only an already explicit historical zero-total confirmation.
update public.jobs set no_labor_services_confirmed_at = no_revenue_confirmed_at
where labor_services_cents = 0 and no_revenue_confirmed_at is not null;
alter table public.jobs enable trigger set_jobs_updated_at;


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
  if coalesce(current_setting('fieldsolo.skip_revenue_solve', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.revenue_document_id is not null then
    if new.revenue_cents is distinct from old.revenue_cents then
      new.revenue_cents := old.revenue_cents;
    end if;
    if new.labor_services_cents is distinct from old.labor_services_cents then
      new.pricing_mode := 'component';
      new.pricing_needs_review := false;
      new.pricing_revision := old.pricing_revision + 1;
    end if;
    return new;
  end if;
  -- Deferring proposal rollups must never defer selected-Invoice protection.
  if coalesce(current_setting('fieldsolo.defer_revenue_solve', true), '') = '1' then
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
    new.revenue_cents := case when v_labor is null then null
      else v_labor + v_summary.material_charge + v_summary.billable_other end;
    return new;
  end if;
  if new.revenue_cents is distinct from old.revenue_cents
     or (tg_op = 'INSERT' and new.revenue_cents is not null) then
    select * into v_summary from private.job_charge_summary(new.id);
    if new.revenue_cents is null then
      new.labor_services_cents := null;
    else
      v_labor := new.revenue_cents - v_summary.material_charge - v_summary.billable_other;
      if v_labor < 0 then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
      new.labor_services_cents := v_labor;
    end if;
    new.pricing_mode := 'component';
    new.pricing_needs_review := false;
    new.pricing_revision := new.pricing_revision + 1;
  end if;
  return new;
end;
$$;

create or replace function private.create_and_select_financial_document(
  p_job_id uuid, p_type text, p_fingerprint text, p_timezone text, p_request_key uuid,
  p_confirmed_paid_total bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_doc jsonb;
  v_doc_id uuid;
  v_total bigint;
  v_status text;
  v_existing public.financial_documents%rowtype;
  v_previous_document_id uuid;
begin
  if v_user_id is null or p_type is distinct from 'invoice' then
    raise exception 'financial_document:invalid' using errcode = 'P0001';
  end if;
  select d.* into v_existing
  from public.financial_document_idempotency i
  join public.financial_documents d on d.id = i.document_id
  where i.user_id = v_user_id and i.request_key = p_request_key
  for update of i;
  if found then
    if v_existing.job_id is distinct from p_job_id
       or v_existing.document_type <> 'invoice'
       or v_existing.source_fingerprint is distinct from p_fingerprint then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    return private.owner_document_json(v_existing.id);
  end if;
  select job_payment_state, revenue_document_id into v_status, v_previous_document_id
  from public.jobs where id = p_job_id and user_id = v_user_id and deleted_at is null for update;
  if not found then raise exception 'financial_document:not_found' using errcode = 'P0001'; end if;
  -- A concurrent request may have committed while this call waited for the Job lock.
  select d.* into v_existing
  from public.financial_document_idempotency i
  join public.financial_documents d on d.id = i.document_id
  where i.user_id = v_user_id and i.request_key = p_request_key
  for update of i;
  if found then
    if v_existing.job_id is distinct from p_job_id
       or v_existing.document_type <> 'invoice'
       or v_existing.source_fingerprint is distinct from p_fingerprint then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    return private.owner_document_json(v_existing.id);
  end if;
  perform set_config('fieldsolo.allow_invoice_creation', '1', true);
  v_doc := private.create_financial_document(p_job_id, 'invoice', p_fingerprint, p_timezone, p_request_key);
  perform set_config('fieldsolo.allow_invoice_creation', '', true);
  if v_doc ->> 'status' = 'incomplete' then
    raise exception 'financial_document:incomplete' using errcode = 'P0001';
  end if;
  v_doc_id := (v_doc ->> 'id')::uuid;
  v_total := (v_doc -> 'payload' ->> 'totalCents')::bigint;
  if v_status = 'paid' and p_confirmed_paid_total is distinct from v_total then
    raise exception 'financial_document:confirmation_required' using errcode = 'P0001';
  end if;
  perform set_config('fieldsolo.defer_revenue_solve', '1', true);
  update public.job_costs c
  set markup_override_bps = private.effective_material_markup(c.user_id, c.markup_override_bps)
  where c.id in (select included.id from private.included_job_costs(p_job_id) included)
    and c.user_id = v_user_id and c.cost_type = 'material'
    and c.deleted_at is null and c.markup_override_bps is null;
  update public.financial_document_controls c
  set archived = true, link_enabled = false, control_revision = control_revision + 1
  from public.financial_documents d
  where d.id = c.document_id and d.job_id = p_job_id and d.user_id = v_user_id
    and d.document_type = 'invoice' and d.id = v_previous_document_id
    and d.id <> v_doc_id
    and (not c.archived or c.link_enabled);
  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  update public.jobs
  set revenue_document_id = v_doc_id,
      revenue_invoice_required = true,
      revenue_cents = (v_doc -> 'payload' ->> 'subtotalCents')::bigint,
      collected_cents = case when v_status = 'paid'
        then (v_doc -> 'payload' ->> 'subtotalCents')::bigint
        else collected_cents end
  where id = p_job_id and user_id = v_user_id;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  perform set_config('fieldsolo.defer_revenue_solve', '', true);
  update public.financial_document_controls
  set payment_status = case when v_status = 'paid' then 'paid' else 'unpaid' end,
      control_revision = control_revision + 1
  where document_id = v_doc_id and user_id = v_user_id;
  return private.owner_document_json(v_doc_id);
exception when others then
  perform set_config('fieldsolo.allow_invoice_creation', '', true);
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  perform set_config('fieldsolo.defer_revenue_solve', '', true);
  raise;
end;
$$;

create or replace function private.select_job_revenue_invoice(
  p_job_id uuid, p_document_id uuid, p_expected_document_id uuid,
  p_confirmed_paid_total bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_doc public.financial_documents%rowtype;
  v_old_total bigint;
  v_total bigint;
begin
  if v_user_id is null then raise exception 'financial_document:unauthorized' using errcode = 'P0001'; end if;
  select * into v_job from public.jobs where id = p_job_id and user_id = v_user_id and deleted_at is null for update;
  if not found then raise exception 'financial_document:not_found' using errcode = 'P0001'; end if;
  if v_job.revenue_document_id is distinct from p_expected_document_id then
    raise exception 'financial_document:conflict' using errcode = 'P0001';
  end if;
  select * into v_doc from public.financial_documents
  where id = p_document_id and job_id = p_job_id and user_id = v_user_id and document_type = 'invoice';
  if not found then raise exception 'financial_document:invalid' using errcode = 'P0001'; end if;
  v_total := (v_doc.payload ->> 'totalCents')::bigint;
  if v_job.revenue_document_id is not null then
    select (payload ->> 'totalCents')::bigint into v_old_total
    from public.financial_documents where id = v_job.revenue_document_id;
  end if;
  if v_job.job_payment_state = 'paid' and v_job.revenue_document_id is distinct from p_document_id
     and v_old_total is distinct from v_total
     and p_confirmed_paid_total is distinct from v_total then
    raise exception 'financial_document:confirmation_required' using errcode = 'P0001';
  end if;
  update public.financial_document_controls
  set payment_status = case when v_job.job_payment_state = 'paid' then 'paid' else 'unpaid' end,
      control_revision = control_revision + 1
  where document_id = p_document_id and user_id = v_user_id;
  perform set_config('fieldsolo.allow_invoice_finalization', '1', true);
  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  update public.jobs set revenue_document_id = p_document_id,
      revenue_invoice_required = true,
      revenue_cents = (v_doc.payload ->> 'subtotalCents')::bigint,
      collected_cents = case
        when v_job.job_payment_state = 'paid' then (v_doc.payload ->> 'subtotalCents')::bigint
        else collected_cents
      end
  where id = p_job_id and user_id = v_user_id;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  perform set_config('fieldsolo.allow_invoice_finalization', '', true);
  update public.financial_document_controls c
  set archived = true, link_enabled = false, control_revision = control_revision + 1
  from public.financial_documents d
  where d.id = c.document_id and d.job_id = p_job_id and d.user_id = v_user_id
    and d.document_type = 'invoice' and d.id = v_job.revenue_document_id
    and d.id <> p_document_id and (not c.archived or c.link_enabled);
  return private.owner_document_json(p_document_id);
exception when others then
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  perform set_config('fieldsolo.allow_invoice_finalization', '', true);
  raise;
end;
$$;

create or replace function private.finalize_job_with_invoice(
  p_job_id uuid,
  p_status text,
  p_document_id uuid,
  p_fingerprint text,
  p_timezone text,
  p_request_key uuid,
  p_confirmed_paid_total bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_doc jsonb;
  v_doc_id uuid;
  v_total bigint;
  v_intent_hash text;
  v_existing public.financial_document_finalizations%rowtype;
begin
  if v_user_id is null or p_request_key is null or p_status is null or p_status not in ('completed', 'paid') then
    raise exception 'financial_document:invalid' using errcode = 'P0001';
  end if;
  v_intent_hash := encode(extensions.digest(convert_to(concat_ws('|',
    p_job_id::text, p_status, coalesce(p_document_id::text, ''),
    coalesce(p_fingerprint, ''), coalesce(p_timezone, ''),
    coalesce(p_confirmed_paid_total::text, '')) , 'utf8'), 'sha256'), 'hex');
  select * into v_existing from public.financial_document_finalizations
  where user_id = v_user_id and request_key = p_request_key for update;
  if found then
    if v_existing.intent_hash is distinct from v_intent_hash
       or v_existing.job_id is distinct from p_job_id
       or v_existing.work_status is distinct from p_status then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    return private.owner_document_json(v_existing.document_id);
  end if;
  select * into v_job from public.jobs
  where id = p_job_id and user_id = v_user_id and deleted_at is null for update;
  if not found then raise exception 'financial_document:not_found' using errcode = 'P0001'; end if;
  -- Recheck after acquiring the Job lock so concurrent retries return the
  -- committed result rather than repeating or conflicting with finalization.
  select * into v_existing from public.financial_document_finalizations
  where user_id = v_user_id and request_key = p_request_key for update;
  if found then
    if v_existing.intent_hash is distinct from v_intent_hash
       or v_existing.job_id is distinct from p_job_id
       or v_existing.work_status is distinct from p_status then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    return private.owner_document_json(v_existing.document_id);
  end if;

  if p_document_id is null then
    v_doc := private.create_and_select_financial_document(
      p_job_id, 'invoice', p_fingerprint, p_timezone, p_request_key, p_confirmed_paid_total
    );
  else
    -- Existing-document finalization confirms the currently reviewed source.
    -- Source replacement has its own compare-and-set API and must be explicit.
    if v_job.revenue_document_id is distinct from p_document_id then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    v_doc := private.select_job_revenue_invoice(
      p_job_id, p_document_id, v_job.revenue_document_id, p_confirmed_paid_total
    );
  end if;
  v_doc_id := (v_doc ->> 'id')::uuid;
  v_total := (v_doc -> 'payload' ->> 'totalCents')::bigint;
  if p_status = 'paid' and p_confirmed_paid_total is distinct from v_total then
    raise exception 'financial_document:confirmation_required' using errcode = 'P0001';
  end if;

  perform set_config('fieldsolo.allow_invoice_finalization', '1', true);
  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  update public.jobs
  set job_work_status = 'completed',
      revenue_invoice_required = true,
      collected_cents = case when p_status = 'paid'
        then (v_doc -> 'payload' ->> 'subtotalCents')::bigint
        else collected_cents end,
      no_revenue_marked_paid = case
        when p_status = 'paid' and (v_doc -> 'payload' ->> 'subtotalCents')::bigint = 0 then true
        when p_status = 'paid' then false
        else no_revenue_marked_paid
      end
  where id = p_job_id and user_id = v_user_id;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  perform set_config('fieldsolo.allow_invoice_finalization', '', true);
  insert into public.financial_document_finalizations (
    user_id, request_key, job_id, document_id, work_status, intent_hash
  ) values (v_user_id, p_request_key, p_job_id, v_doc_id, p_status, v_intent_hash);
  return private.owner_document_json(v_doc_id);
exception when others then
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  perform set_config('fieldsolo.allow_invoice_finalization', '', true);
  raise;
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

  -- Recover a committed request from its immutable submitted source, before
  -- consulting today's Job/settings/date. A retry is not a new creation.
  select d.* into v_existing
  from public.financial_document_idempotency i
  join public.financial_documents d on d.id = i.document_id
  where i.user_id = v_user_id and i.request_key = p_request_key
  for update of i;
  if found then
    if v_existing.job_id is distinct from p_job_id
       or v_existing.document_type is distinct from p_type
       or v_existing.source_fingerprint is distinct from p_fingerprint
       or v_existing.source_timezone is distinct from p_timezone then
      raise exception 'financial_document:conflict' using errcode = 'P0001';
    end if;
    return private.owner_document_json(v_existing.id);
  end if;

  v_issue := (now() at time zone p_timezone)::date;
  v_fingerprint := private.source_fingerprint(p_job_id, v_user_id, p_type, p_timezone, v_issue);
  v_intent := encode(extensions.digest(convert_to(concat_ws('|', p_job_id::text, p_type, p_fingerprint), 'utf8'), 'sha256'), 'hex');

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

-- Atomically update protected pricing metadata behind an owner-scoped helper.
-- The public Job Edit transaction remains SECURITY INVOKER and respects RLS.
create or replace function private.update_job_labor_proposal(
  p_job_id uuid, p_labor bigint, p_no_labor_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'apply_job_detail_edit:unauthorized' using errcode = 'P0001';
  end if;
  if p_labor < 0 or (p_no_labor_confirmed and p_labor is distinct from 0) then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;
  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  update public.jobs
  set labor_services_cents = p_labor,
      no_labor_services_confirmed_at = case
        when p_no_labor_confirmed is null then no_labor_services_confirmed_at
        when p_no_labor_confirmed then coalesce(no_labor_services_confirmed_at, now())
        else null end,
      pricing_mode = 'component', pricing_needs_review = false,
      pricing_revision = pricing_revision + 1
  where id = p_job_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'apply_job_detail_edit:not_found' using errcode = 'P0001';
  end if;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  -- Costs may have changed even if the labor value did not.
  perform private.recalculate_component_jobs(array[p_job_id]);
exception when others then
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  raise;
end;
$$;
revoke all on function private.update_job_labor_proposal(uuid, bigint, boolean) from public;
grant execute on function private.update_job_labor_proposal(uuid, bigint, boolean) to authenticated;

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
  v_no_labor_confirmed boolean;
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

  if v_job_patch ? 'noLaborServicesConfirmed'
     and jsonb_typeof(v_job_patch -> 'noLaborServicesConfirmed') <> 'boolean' then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;
  v_no_labor_confirmed := coalesce((v_job_patch ->> 'noLaborServicesConfirmed')::boolean, false);
  if v_no_labor_confirmed and (
      coalesce(v_job_patch ->> 'pricingIntent', '') <> 'labor'
      or nullif(v_job_patch ->> 'laborServicesCents', '')::bigint is distinct from 0) then
    raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
  end if;

  v_no_revenue_confirmed := (v_job_patch ->> 'noRevenueConfirmed')::boolean;
  if coalesce(v_job_patch ->> 'pricingIntent', '') = 'labor'
     and v_job_patch ? 'noLaborServicesConfirmed' then
    -- New clients confirm the labor component. Derive any whole-total zero
    -- confirmation only after all included charges have been recomputed.
    v_no_revenue_confirmed := false;
  end if;
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
      no_labor_services_confirmed_at = case
        when not (v_job_patch ? 'noLaborServicesConfirmed') then no_labor_services_confirmed_at
        when v_no_labor_confirmed then coalesce(no_labor_services_confirmed_at, now())
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

  -- Labor edits submit a proposed charge, not a replacement authoritative
  -- Revenue amount. Preserve the stored total while mutating the draft/costs.
  if coalesce(v_job_patch ->> 'pricingIntent', '') = 'labor' then
    select revenue_cents into v_current_revenue from public.jobs
    where id = p_job_id and user_id = v_user_id;
    v_apply_payload := jsonb_set(v_apply_payload, '{job,revenueCents}',
      coalesce(to_jsonb(v_current_revenue), 'null'::jsonb), true);
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
    perform private.update_job_labor_proposal(p_job_id, v_labor,
      case when v_job_patch ? 'noLaborServicesConfirmed' then v_no_labor_confirmed else null end);
    if v_job_patch ? 'noLaborServicesConfirmed' then
      update public.jobs set no_revenue_confirmed_at = case
        when coalesce(revenue_cents, -1) = 0
          and (v_no_labor_confirmed or revenue_document_id is not null)
          then coalesce(no_revenue_confirmed_at, now())
        else null end
      where id = p_job_id and user_id = v_user_id;
    end if;
    if v_no_revenue_confirmed and coalesce((select revenue_cents from public.jobs where id = p_job_id), 0) <> 0 then
      raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001';
    end if;
  else
    v_revenue := case
      when v_apply_payload -> 'job' -> 'revenueCents' is null
        or jsonb_typeof(v_apply_payload -> 'job' -> 'revenueCents') = 'null' then null
      else (v_apply_payload -> 'job' ->> 'revenueCents')::bigint
    end;
    -- The deferred draft write already stored this requested total. Always
    -- solve its residual Labor against the final costs, even when unchanged.
    -- Selected-Invoice Jobs are explicitly ignored by solve_job_revenue.
    perform private.solve_job_revenue(p_job_id, v_revenue);
  end if;

  return v_result;
exception
  when others then
    perform set_config('fieldsolo.defer_revenue_solve', '', true);
    perform set_config('fieldsolo.skip_revenue_solve', '', true);
    raise;
end;
$$;

-- Keep direct and old-client labor edits from retaining a stale zero marker.
create or replace function private.normalize_no_labor_services_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.labor_services_cents is distinct from 0 then
    new.no_labor_services_confirmed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.normalize_no_labor_services_confirmation() from public;
-- Run after jobs_sync_component_pricing, which can derive labor on Revenue edits.
create trigger jobs_z_normalize_no_labor_services_confirmation
before insert or update on public.jobs
for each row execute function private.normalize_no_labor_services_confirmation();


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
  if v_job.labor_services_cents is null
     or (v_job.labor_services_cents = 0 and v_job.no_labor_services_confirmed_at is null)
     or v_job.pricing_needs_review or v_job.pricing_mode <> 'component' then
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

notify pgrst, 'reload schema';
