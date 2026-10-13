-- One immutable invoice becomes the customer-charge source for a Job.
alter table public.financial_documents
  add constraint financial_documents_job_identity_key unique (id, job_id, user_id);

alter table public.financial_document_controls
  add column payment_status text,
  add constraint financial_document_controls_payment_status_check
    check (payment_status is null or payment_status in ('paid', 'unpaid'));

alter table public.jobs add column revenue_document_id uuid;
-- Existing rows remain in legacy mode; newly inserted Jobs require invoice-backed finalization.
alter table public.jobs add column revenue_invoice_required boolean not null default false;
alter table public.jobs alter column revenue_invoice_required set default true;
alter table public.jobs
  add constraint jobs_revenue_document_owner_job_fkey
  foreign key (revenue_document_id, id, user_id)
  references public.financial_documents (id, job_id, user_id)
  deferrable initially immediate;

create table public.financial_document_finalizations (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  document_id uuid not null references public.financial_documents(id) on delete cascade,
  work_status text not null check (work_status in ('completed', 'paid')),
  intent_hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_key)
);
alter table public.financial_document_finalizations enable row level security;
revoke all privileges on public.financial_document_finalizations from anon, authenticated;

-- Existing documents preserve the currently visible badge until a Job chooses
-- a revenue invoice. There is deliberately no automatic historical selection.
update public.financial_document_controls c
set payment_status = case when j.job_payment_state = 'paid' then 'paid' else 'unpaid' end
from public.financial_documents d
join public.jobs j on j.id = d.job_id and j.user_id = d.user_id
where c.document_id = d.id and d.document_type = 'invoice';

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
  v_no_revenue_paid boolean;
  v_revenue_document_id uuid;
begin
  select * into v_doc from public.financial_documents where id = p_document_id and user_id = auth.uid();
  if not found then raise exception 'financial_document:not_found' using errcode = 'P0001'; end if;
  select * into v_control from public.financial_document_controls where document_id = v_doc.id;
  select token_protected into v_token from public.financial_document_links where document_id = v_doc.id;
  select job_payment_state, no_revenue_marked_paid, revenue_document_id
    into v_state, v_no_revenue_paid, v_revenue_document_id
  from public.jobs where id = v_doc.job_id;
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
    'isRevenueSource', v_revenue_document_id = v_doc.id,
    'paymentProjection', case
      when v_doc.document_type <> 'invoice' then null
      else coalesce(v_control.payment_status,
        case when v_state = 'paid' or (coalesce(v_doc.payload ->> 'subtotalCents', '0')::bigint = 0 and v_no_revenue_paid)
          then 'paid' else 'unpaid' end)
    end
  );
end;
$$;

-- Once invoice-backed, component pricing remains editable as a proposal, while
-- authoritative revenue stays anchored to the selected immutable invoice.
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
  if p_job_ids is null then return; end if;
  for v_job_id in select id from public.jobs where id = any(p_job_ids) order by id loop
    select * into v_job from public.jobs where id = v_job_id for update;
    if v_job.pricing_mode <> 'component' or v_job.pricing_needs_review
       or v_job.revenue_document_id is not null then continue; end if;
    select * into v_summary from private.job_charge_summary(v_job_id);
    v_revenue := case when v_job.labor_services_cents is null then null
      else v_job.labor_services_cents + v_summary.material_charge + v_summary.billable_other end;
    if v_revenue is distinct from v_job.revenue_cents then
      perform set_config('fieldsolo.skip_revenue_solve', '1', true);
      update public.jobs set revenue_cents = v_revenue, pricing_revision = pricing_revision + 1 where id = v_job_id;
      perform set_config('fieldsolo.skip_revenue_solve', '', true);
    end if;
  end loop;
end;
$$;

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
  if exists (select 1 from public.jobs where id = p_job_id and revenue_document_id is not null) then
    return;
  end if;
  select * into v_summary from private.job_charge_summary(p_job_id);
  if p_revenue is null then v_labor := null;
  else
    v_labor := p_revenue - v_summary.material_charge - v_summary.billable_other;
    if v_labor < 0 then raise exception 'apply_job_detail_edit:invalid' using errcode = 'P0001'; end if;
  end if;
  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  update public.jobs set labor_services_cents = v_labor, revenue_cents = p_revenue,
    pricing_mode = 'component', pricing_needs_review = false,
    pricing_revision = pricing_revision + 1 where id = p_job_id;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
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
  select job_payment_state into v_status
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
  where c.job_id = p_job_id and c.user_id = v_user_id and c.cost_type = 'material'
    and c.deleted_at is null and c.markup_override_bps is null;
  update public.financial_document_controls c
  set archived = true, link_enabled = false, control_revision = control_revision + 1
  from public.financial_documents d
  where d.id = c.document_id and d.job_id = p_job_id and d.user_id = v_user_id
    and d.document_type = 'invoice' and d.id <> v_doc_id
    and (not c.archived or c.link_enabled);
  update public.jobs
  set revenue_document_id = v_doc_id,
      revenue_invoice_required = true,
      revenue_cents = (v_doc -> 'payload' ->> 'subtotalCents')::bigint,
      collected_cents = case when v_status = 'paid'
        then (v_doc -> 'payload' ->> 'subtotalCents')::bigint
        else collected_cents end
  where id = p_job_id and user_id = v_user_id;
  perform set_config('fieldsolo.defer_revenue_solve', '', true);
  update public.financial_document_controls
  set payment_status = case when v_status = 'paid' then 'paid' else 'unpaid' end,
      control_revision = control_revision + 1
  where document_id = v_doc_id and user_id = v_user_id;
  return private.owner_document_json(v_doc_id);
exception when others then
  perform set_config('fieldsolo.allow_invoice_creation', '', true);
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
    and d.document_type = 'invoice' and d.id <> p_document_id and (not c.archived or c.link_enabled);
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

create or replace function public.create_and_select_financial_document(
  p_job_id uuid, p_type text, p_fingerprint text, p_timezone text, p_request_key uuid,
  p_confirmed_paid_total bigint default null
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.create_and_select_financial_document($1, $2, $3, $4, $5, $6);
$$;

create or replace function public.select_job_revenue_invoice(
  p_job_id uuid, p_document_id uuid, p_expected_document_id uuid,
  p_confirmed_paid_total bigint default null
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.select_job_revenue_invoice($1, $2, $3, $4);
$$;

create or replace function public.finalize_job_with_invoice(
  p_job_id uuid, p_status text, p_document_id uuid, p_fingerprint text,
  p_timezone text, p_request_key uuid, p_confirmed_paid_total bigint default null
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.finalize_job_with_invoice($1, $2, $3, $4, $5, $6, $7);
$$;

grant execute on function public.create_and_select_financial_document(uuid, text, text, text, uuid, bigint) to authenticated;
grant execute on function public.select_job_revenue_invoice(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function public.finalize_job_with_invoice(uuid, text, uuid, text, text, uuid, bigint) to authenticated;
revoke all on function private.create_and_select_financial_document(uuid, text, text, text, uuid, bigint) from public;
revoke all on function private.select_job_revenue_invoice(uuid, uuid, uuid, bigint) from public;
revoke all on function private.finalize_job_with_invoice(uuid, text, uuid, text, text, uuid, bigint) from public;
grant execute on function private.create_and_select_financial_document(uuid, text, text, text, uuid, bigint) to authenticated;
grant execute on function private.select_job_revenue_invoice(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function private.finalize_job_with_invoice(uuid, text, uuid, text, text, uuid, bigint) to authenticated;

create or replace function private.refresh_selected_invoice_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revenue_document_id is not null
     and (new.job_payment_state is distinct from old.job_payment_state
       or new.no_revenue_marked_paid is distinct from old.no_revenue_marked_paid) then
    if new.job_payment_state = 'paid' or (coalesce(new.revenue_cents, 0) = 0 and new.no_revenue_marked_paid) then
      update public.financial_document_controls
      set payment_status = 'paid', control_revision = control_revision + 1
      where document_id = new.revenue_document_id and payment_status is distinct from 'paid';
    else
    update public.financial_document_controls
    set payment_status = 'unpaid',
        control_revision = control_revision + 1
    where document_id = new.revenue_document_id
      and payment_status is distinct from 'unpaid';
    end if;
  end if;
  return new;
end;
$$;
create trigger jobs_refresh_selected_invoice_payment_status
after update on public.jobs
for each row execute function private.refresh_selected_invoice_payment_status();

create or replace function private.require_invoice_before_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_paid_transition boolean;
  v_completed_transition boolean;
begin
  if tg_op = 'INSERT' then
    if new.revenue_invoice_required
       and (new.job_work_status = 'completed'
         or (coalesce(new.revenue_cents, 0) > 0 and new.collected_cents >= new.revenue_cents)
         or new.no_revenue_marked_paid)
       and new.revenue_document_id is null then
      raise exception 'financial_document:invoice_required' using errcode = 'P0001';
    end if;
    return new;
  end if;

  v_completed_transition := old.job_work_status is distinct from 'completed'
    and new.job_work_status = 'completed';
  v_paid_transition := old.job_payment_state is distinct from 'paid'
    and coalesce(new.revenue_cents, 0) > 0
    and new.collected_cents >= new.revenue_cents;
  if new.revenue_invoice_required and (v_completed_transition or v_paid_transition
      or (new.no_revenue_marked_paid and not old.no_revenue_marked_paid)) then
    if coalesce(current_setting('fieldsolo.allow_invoice_finalization', true), '') <> '1'
       or new.revenue_document_id is null
       or not new.revenue_invoice_required then
      raise exception 'financial_document:invoice_required' using errcode = 'P0001';
    end if;
  end if;
  if old.revenue_invoice_required and new.revenue_document_id is null then
    raise exception 'financial_document:invoice_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger jobs_require_invoice_before_completion_update
before update of job_work_status, revenue_document_id, collected_cents, revenue_cents, no_revenue_marked_paid on public.jobs
for each row execute function private.require_invoice_before_completion();
create trigger jobs_require_invoice_before_completion_insert
before insert on public.jobs
for each row execute function private.require_invoice_before_completion();

create or replace function private.require_invoice_creation_flow()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.document_type = 'invoice'
     and coalesce(current_setting('fieldsolo.allow_invoice_creation', true), '') <> '1'
     and exists (select 1 from public.jobs j where j.id = new.job_id and j.revenue_invoice_required) then
    raise exception 'financial_document:invoice_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger financial_documents_require_current_create_flow
before insert on public.financial_documents
for each row execute function private.require_invoice_creation_flow();

create or replace function private.get_job_revenue_document(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_document_id uuid;
begin
  select revenue_document_id into v_document_id
  from public.jobs where id = p_job_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'financial_document:not_found' using errcode = 'P0001'; end if;
  if v_document_id is null then return null; end if;
  return private.owner_document_json(v_document_id);
end;
$$;

create or replace function public.get_job_revenue_document(p_job_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_job_revenue_document($1);
$$;

create or replace function public.apply_job_detail_edit_with_invoice_preferences(
  p_job_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_preferences jsonb := p_payload -> 'invoicePreferences';
  v_result jsonb;
  v_control jsonb;
  v_selection uuid;
  v_expected uuid;
  v_confirmed_total bigint;
begin
  v_result := public.apply_job_detail_edit_atomic(p_job_id, p_payload - 'invoicePreferences');
  if v_preferences is null then return v_result; end if;
  v_selection := nullif(v_preferences ->> 'revenueDocumentId', '')::uuid;
  v_expected := nullif(v_preferences ->> 'expectedRevenueDocumentId', '')::uuid;
  v_confirmed_total := nullif(v_preferences ->> 'confirmedPaidTotalCents', '')::bigint;
  for v_control in select value from jsonb_array_elements(coalesce(v_preferences -> 'controls', '[]'::jsonb)) loop
    perform private.set_financial_document_controls(
      (v_control ->> 'documentId')::uuid,
      (v_control ->> 'archived')::boolean,
      (v_control ->> 'linkEnabled')::boolean,
      (v_control ->> 'expectedRevision')::bigint
    );
  end loop;
  if v_selection is not null and v_selection is distinct from v_expected then
    perform private.select_job_revenue_invoice(p_job_id, v_selection, v_expected, v_confirmed_total);
  elsif v_expected is not null and v_selection is null then
    raise exception 'financial_document:invalid' using errcode = 'P0001';
  end if;
  return v_result;
end;
$$;

create or replace function public.resolve_shared_financial_document(p_token text)
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
  v_owner uuid;
begin
  if p_token is null or length(p_token) < 32 then return jsonb_build_object('status', 'unavailable'); end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'utf8'), 'sha256'), 'hex');
  select * into v_link from public.financial_document_links where token_hash = v_hash;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  select * into v_control from public.financial_document_controls where document_id = v_link.document_id;
  select * into v_doc from public.financial_documents where id = v_link.document_id;
  select id into v_owner from auth.users where id = v_doc.user_id;
  if v_owner is null or not coalesce(v_control.link_enabled, false)
     or not exists (select 1 from public.jobs j where j.id = v_doc.job_id and j.user_id = v_doc.user_id and j.deleted_at is null) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  return jsonb_build_object(
    'status', 'ok', 'rendererVersion', v_doc.renderer_version,
    'paymentProjection', case when v_doc.document_type <> 'invoice' then null
      else coalesce(v_control.payment_status, 'unpaid') end,
    'payload', v_doc.payload
  );
end;
$$;

grant execute on function public.get_job_revenue_document(uuid) to authenticated;
grant execute on function private.get_job_revenue_document(uuid) to authenticated;
grant execute on function public.apply_job_detail_edit_with_invoice_preferences(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
