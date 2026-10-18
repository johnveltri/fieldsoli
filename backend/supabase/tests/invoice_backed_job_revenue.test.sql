-- Invoice snapshots are the authoritative Job Revenue source after adoption.
\set ON_ERROR_STOP on

begin;

-- Ending a visit on a new job must not require financial finalization.
do $$
declare
  owner_id uuid := gen_random_uuid();
  job_id uuid;
  visit_id uuid;
begin
  insert into auth.users (id, email)
  values (owner_id, 'visit-end-' || owner_id || '@example.com');
  insert into public.jobs (user_id, short_description)
  values (owner_id, 'Unfinalized visit') returning id into job_id;
  insert into public.sessions (user_id, job_id, entry_mode, session_status, started_at)
  values (owner_id, job_id, 'live', 'in_progress', now() - interval '30 minutes')
  returning id into visit_id;
  update public.sessions set session_status = 'ended', ended_at = now(),
    clock_end_explicit = true, clock_times_explicit = true where id = visit_id;
  if (select session_status from public.sessions where id = visit_id) <> 'ended'
     or (select revenue_document_id from public.jobs where id = job_id) is not null then
    raise exception 'ending a visit failed or unexpectedly created an invoice';
  end if;
  -- Flag-off/older clients can finish an unadopted Job during rollout.
  update public.jobs set job_work_status = 'completed' where id = job_id;
  if (select revenue_invoice_required from public.jobs where id = job_id) then
    raise exception 'new Job opted in to invoice enforcement without adoption';
  end if;
end;
$$;

do $$
#variable_conflict use_variable
declare
  owner_id uuid := gen_random_uuid();
  other_owner_id uuid := gen_random_uuid();
  job_id uuid;
  other_job_id uuid;
  material_id uuid;
  invoice_one jsonb;
  invoice_two jsonb;
  invoice_three jsonb;
  estimate jsonb;
  preview jsonb;
  created jsonb;
  source_id uuid;
  request_key uuid := gen_random_uuid();
  old_total bigint;
  new_total bigint;
  saved_revenue bigint;
  invoice_count bigint;
  original_fingerprint text;
begin
  insert into auth.users (id, email) values
    (owner_id, 'invoice-source-' || owner_id || '@example.com'),
    (other_owner_id, 'invoice-source-other-' || other_owner_id || '@example.com');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.jobs (user_id, short_description, customer_name)
  values (owner_id, 'Panel replacement', 'Casey Customer') returning id into job_id;
  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type
  ) values (owner_id, job_id, 'Panel', 1, 'ea', 10000, 10000, 'material') returning id into material_id;
  update public.jobs set labor_services_cents = 50000 where id = job_id;
  insert into public.business_settings (user_id, business_name, material_markup_bps, tax_rate_bps)
  values (owner_id, 'Example Electric', 1000, 500);

  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  if jsonb_array_length(preview -> 'gaps') <> 0
     or (preview -> 'payload' ->> 'subtotalCents')::bigint <> 61000
     or (preview -> 'payload' ->> 'totalCents')::bigint <> 64050 then
    raise exception 'unexpected first invoice preview: %', preview;
  end if;
  original_fingerprint := preview ->> 'fingerprint';

  invoice_one := public.finalize_job_with_invoice(
    job_id, 'completed', null, original_fingerprint, 'America/Chicago', request_key, null
  );
  if invoice_one ->> 'isRevenueSource' <> 'true'
     or (select revenue_document_id from public.jobs where id = job_id) <> (invoice_one ->> 'id')::uuid
     or (select revenue_cents from public.jobs where id = job_id) <> 61000
     or (select job_work_status from public.jobs where id = job_id) <> 'completed'
     or (select markup_override_bps from public.job_costs where id = material_id) <> 1000 then
    raise exception 'completion did not atomically create/select invoice and solidify markup';
  end if;

  begin
    update public.jobs set revenue_document_id = null where id = job_id;
    raise exception 'clearing an established revenue invoice was allowed';
  exception when others then
    if SQLERRM not like '%financial_document:invoice_required%' then raise; end if;
  end;

  -- Costs and labor can change while the immutable selected snapshot remains revenue.
  update public.job_costs set total_cost_cents = 12000, unit_cost_cents = 12000 where id = material_id;
  update public.jobs set labor_services_cents = 52000 where id = job_id;
  if (select revenue_cents from public.jobs where id = job_id) <> 61000 then
    raise exception 'current costs or labor overwrote selected invoice revenue';
  end if;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  if (preview -> 'payload' ->> 'subtotalCents')::bigint <> 65200 then
    raise exception 'replacement preview did not include current proposed charges: %', preview;
  end if;

  invoice_two := public.create_and_select_financial_document(
    job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid(), null
  );
  if (select revenue_cents from public.jobs where id = job_id) <> 65200
     or invoice_two ->> 'isRevenueSource' <> 'true'
     or not (select archived and not link_enabled from public.financial_document_controls
       where document_id = (invoice_one ->> 'id')::uuid) then
    raise exception 'replacement did not move revenue selection and disable the former invoice';
  end if;

  -- Estimates are never eligible revenue sources.
  preview := public.preview_financial_document(job_id, 'estimate', 'America/Chicago');
  estimate := public.create_financial_document(
    job_id, 'estimate', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid()
  );
  begin
    perform public.select_job_revenue_invoice(
      job_id, (estimate ->> 'id')::uuid, (invoice_two ->> 'id')::uuid, null
    );
    raise exception 'an estimate was accepted as Job Revenue';
  exception when others then
    if SQLERRM not like '%financial_document:invalid%' then raise; end if;
  end;

  -- A missing confirmation rolls back every write. The review confirms the
  -- exact saved invoice total, while collection remains the pretax subtotal.
  begin
    perform public.finalize_job_with_invoice(
      job_id, 'paid', (invoice_two ->> 'id')::uuid, null, 'America/Chicago', gen_random_uuid(), null
    );
    raise exception 'paid finalization did not require confirmation';
  exception when others then
    if SQLERRM not like '%financial_document:confirmation_required%' then raise; end if;
  end;
  if (select collected_cents from public.jobs where id = job_id) <> 0
     or (private.owner_document_json((invoice_two ->> 'id')::uuid) ->> 'paymentProjection') <> 'unpaid' then
    raise exception 'rejected payment confirmation left partial changes';
  end if;
  new_total := (invoice_two -> 'payload' ->> 'totalCents')::bigint;
  perform public.finalize_job_with_invoice(
    job_id, 'paid', (invoice_two ->> 'id')::uuid, null, 'America/Chicago', gen_random_uuid(), new_total
  );
  if (select job_payment_state from public.jobs where id = job_id) <> 'paid'
     or (select collected_cents from public.jobs where id = job_id) <> 65200
     or (private.owner_document_json((invoice_two ->> 'id')::uuid) ->> 'paymentProjection') <> 'paid' then
    raise exception 'paid confirmation did not record pretax collection and selected invoice state';
  end if;

  -- Completing work after payment preserves the existing financial state.
  perform public.finalize_job_with_invoice(
    job_id, 'completed', (invoice_two ->> 'id')::uuid, null, 'America/Chicago', gen_random_uuid(), null
  );
  if (select job_payment_state from public.jobs where id = job_id) <> 'paid'
     or (select collected_cents from public.jobs where id = job_id) <> 65200
     or (private.owner_document_json((invoice_two ->> 'id')::uuid) ->> 'paymentProjection') <> 'paid' then
    raise exception 'completing work changed the Job payment state';
  end if;

  -- A timeout retry returns the original finalization result without restoring
  -- its earlier status or revenue source.
  created := public.finalize_job_with_invoice(
    job_id, 'completed', null, original_fingerprint, 'America/Chicago', request_key, null
  );
  if (select job_payment_state from public.jobs where id = job_id) <> 'paid'
     or (select revenue_document_id from public.jobs where id = job_id) <> (invoice_two ->> 'id')::uuid
     or created ->> 'id' <> invoice_one ->> 'id' then
    raise exception 'finalization retry changed a later payment/source state';
  end if;

  -- Older direct writes cannot mark an adopted Job paid without finalization.
  update public.jobs set collected_cents = 0 where id = job_id;
  if (select job_payment_state from public.jobs where id = job_id) = 'paid' then
    raise exception 'direct unpaid update did not change the Job state';
  end if;
  begin
    update public.jobs set collected_cents = revenue_cents where id = job_id;
    raise exception 'direct adopted-job paid transition was allowed';
  exception when others then
    if SQLERRM not like '%financial_document:invoice_required%' then raise; end if;
  end;
  if (select job_payment_state from public.jobs where id = job_id) = 'paid' then
    raise exception 'rejected direct write changed paid status';
  end if;
  perform public.finalize_job_with_invoice(
    job_id, 'paid', (invoice_two ->> 'id')::uuid, null, 'America/Chicago', gen_random_uuid(),
    (invoice_two -> 'payload' ->> 'totalCents')::bigint
  );

  -- A changed paid invoice requires confirmation of its new total; the previous
  -- paid snapshot retains its status after replacement.
  update public.jobs set labor_services_cents = 55000 where id = job_id;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  old_total := (invoice_two -> 'payload' ->> 'totalCents')::bigint;
  new_total := (preview -> 'payload' ->> 'totalCents')::bigint;
  if old_total = new_total then raise exception 'test replacement should change invoice total'; end if;
  select count(*) into invoice_count from public.financial_documents d where d.job_id = job_id and d.document_type = 'invoice';
  begin
    perform public.create_and_select_financial_document(
      job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid(), null
    );
    raise exception 'paid invoice replacement did not require confirmation';
  exception when others then
    if SQLERRM not like '%financial_document:confirmation_required%' then raise; end if;
  end;
  if (select count(*) from public.financial_documents d where d.job_id = job_id and d.document_type = 'invoice') <> invoice_count then
    raise exception 'unconfirmed replacement left a duplicate invoice';
  end if;
  invoice_three := public.create_and_select_financial_document(
    job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid(), new_total
  );
  if (select revenue_cents from public.jobs where id = job_id) <> (preview -> 'payload' ->> 'subtotalCents')::bigint
     or (select collected_cents from public.jobs where id = job_id) <> (preview -> 'payload' ->> 'subtotalCents')::bigint
     or (select job_payment_state from public.jobs where id = job_id) <> 'paid'
     or (private.owner_document_json((invoice_two ->> 'id')::uuid) ->> 'paymentProjection') <> 'paid'
     or invoice_three ->> 'isRevenueSource' <> 'true' then
    raise exception 'confirmed paid replacement did not preserve invoice-backed revenue/payment history';
  end if;

  -- An archived invoice can remain the selected revenue source without
  -- restoring its disabled public link.
  old_total := (invoice_two -> 'payload' ->> 'totalCents')::bigint;
  begin
    perform public.select_job_revenue_invoice(
      job_id, (invoice_two ->> 'id')::uuid, (invoice_three ->> 'id')::uuid, null
    );
    raise exception 'paid selection with a different total did not require confirmation';
  exception when others then
    if SQLERRM not like '%financial_document:confirmation_required%' then raise; end if;
  end;
  created := public.select_job_revenue_invoice(
    job_id, (invoice_two ->> 'id')::uuid, (invoice_three ->> 'id')::uuid, old_total
  );
  if created ->> 'isRevenueSource' <> 'true'
     or created ->> 'archived' <> 'true'
     or created ->> 'linkEnabled' <> 'false'
     or (select revenue_cents from public.jobs where id = job_id)
       <> (invoice_two -> 'payload' ->> 'subtotalCents')::bigint then
    raise exception 'archived selected invoice did not retain its controls and revenue';
  end if;

  -- Owner checks reject a document belonging to another Job/owner.
  perform set_config('request.jwt.claim.sub', other_owner_id::text, true);
  insert into public.jobs (user_id, short_description, customer_name)
  values (other_owner_id, 'Other job', 'Other customer') returning id into other_job_id;
  insert into public.business_settings (user_id, business_name)
  values (other_owner_id, 'Other business');
  update public.jobs set labor_services_cents = 1000 where id = other_job_id;
  preview := public.preview_financial_document(other_job_id, 'invoice', 'America/Chicago');
  created := public.create_and_select_financial_document(
    other_job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid(), null
  );
  source_id := (created ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  begin
    perform public.select_job_revenue_invoice(
      job_id, source_id, (invoice_two ->> 'id')::uuid, old_total
    );
    raise exception 'cross-owner invoice selection was accepted';
  exception when others then
    if SQLERRM not like '%financial_document:invalid%' then raise; end if;
  end;
  if (select revenue_document_id from public.jobs where id = job_id) <> (invoice_two ->> 'id')::uuid then
    raise exception 'cross-owner selection changed the revenue source';
  end if;
end;
$$;

rollback;
