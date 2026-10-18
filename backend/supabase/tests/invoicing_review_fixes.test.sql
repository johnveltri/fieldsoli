-- Regression coverage for the approved rollout and transaction review findings.
\set ON_ERROR_STOP on
begin;

do $$
#variable_conflict use_variable
declare
  owner_id uuid := gen_random_uuid();
  job_id uuid;
  material_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  payload jsonb;
  patch jsonb;
begin
  insert into auth.users (id, email) values (owner_id, 'review-costs-' || owner_id || '@example.com');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.jobs (user_id, short_description, customer_name, revenue_cents)
  values (owner_id, 'Cost-only edit', 'Customer', 10000) returning id into job_id;
  -- Flag-off clients preserve their aggregate Revenue and solve the residual
  -- against newly saved material costs, even with an unchanged total.
  perform public.apply_job_detail_edit_atomic(job_id, jsonb_build_object('job',
    jsonb_build_object('shortDescription', 'Cost-only edit', 'customerName', 'Customer',
      'revenueCents', 10000, 'noRevenueConfirmed', false,
      'noMaterialsConfirmed', false, 'noOtherCostsConfirmed', false),
    'materials', jsonb_build_object('create', jsonb_build_array(jsonb_build_object(
      'id', material_id, 'description', 'Legacy material', 'quantity', 1, 'unit', 'ea',
      'unitCostCents', 2000, 'totalCostCents', 2000)))));
  if not exists (select 1 from public.jobs where id = job_id
      and revenue_cents = 10000 and labor_services_cents = 8000) then
    raise exception 'legacy cost-only save did not solve residual labor from unchanged Revenue';
  end if;
  begin
    perform public.apply_job_detail_edit_atomic(job_id, jsonb_build_object('job',
      jsonb_build_object('shortDescription', 'Invalid negative residual', 'customerName', 'Customer',
        'revenueCents', 1000, 'noRevenueConfirmed', false,
        'noMaterialsConfirmed', false, 'noOtherCostsConfirmed', false)));
    raise exception 'legacy atomic save accepted Revenue below billable charges';
  exception when others then
    if SQLERRM not like '%apply_job_detail_edit:invalid%' then raise; end if;
  end;
  if (select revenue_cents from public.jobs where id = job_id) <> 10000 then
    raise exception 'negative residual validation did not roll back legacy draft';
  end if;
  -- Start the separate component-pricing scenario without the prior row.
  delete from public.job_costs where id = material_id;
  patch := jsonb_build_object('shortDescription', 'Cost-only edit', 'customerName', 'Customer',
    'revenueCents', 10000, 'pricingIntent', 'labor', 'laborServicesCents', 10000,
    'noLaborServicesConfirmed', false, 'noRevenueConfirmed', false,
    'noMaterialsConfirmed', false, 'noOtherCostsConfirmed', false);
  payload := jsonb_build_object('job', patch,
    'materials', jsonb_build_object('create', jsonb_build_array(jsonb_build_object(
      'id', material_id, 'description', 'Material', 'quantity', 1, 'unit', 'ea',
      'unitCostCents', 2000, 'totalCostCents', 2000, 'markupOverrideBps', null))),
    'otherCosts', jsonb_build_object('create', jsonb_build_array(jsonb_build_object(
      'id', other_id, 'description', 'Permit', 'costType', 'permit',
      'costTypeExplicit', true, 'costCents', 300, 'invoiceCustomer', true))));
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, payload);
  if (select revenue_cents from public.jobs where id = job_id) <> 12300 then
    raise exception 'cost-only create did not recalculate unchanged labor';
  end if;
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job', patch,
    'materials', jsonb_build_object('update', jsonb_build_array(jsonb_build_object(
      'id', material_id, 'description', 'Material', 'quantity', 1, 'unit', 'ea',
      'unitCostCents', 3000, 'totalCostCents', 3000))),
    'otherCosts', jsonb_build_object('update', jsonb_build_array(jsonb_build_object(
      'id', other_id, 'description', 'Permit', 'costType', 'permit',
      'costTypeExplicit', true, 'costCents', 300, 'invoiceCustomer', false)))));
  if (select revenue_cents from public.jobs where id = job_id) <> 13000 then
    raise exception 'cost-only update/inclusion toggle did not recalculate Revenue';
  end if;

  insert into public.business_settings (user_id, business_name) values (owner_id, 'Business');
  update public.jobs set labor_services_cents = 0 where id = job_id;
  if not ('labor' = any(private.document_readiness(job_id, owner_id))) then
    raise exception 'zero labor with charges bypassed explicit confirmation readiness';
  end if;
  -- A stale legacy noRevenue flag must not reject confirmed zero labor with charges.
  patch := patch || jsonb_build_object('laborServicesCents', 0,
    'noLaborServicesConfirmed', true, 'noRevenueConfirmed', true);
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job', patch));
  if not exists (select 1 from public.jobs where id = job_id and revenue_cents = 3000
      and labor_services_cents = 0 and no_labor_services_confirmed_at is not null
      and no_revenue_confirmed_at is null) then
    raise exception 'no labor was conflated with no total Revenue';
  end if;
  if 'labor' = any(private.document_readiness(job_id, owner_id)) then
    raise exception 'confirmed zero labor with billable charges stayed unready';
  end if;
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job', patch,
    'materials', jsonb_build_object('deleteIds', jsonb_build_array(material_id))));
  if not exists (select 1 from public.jobs where id = job_id and revenue_cents = 0
      and no_labor_services_confirmed_at is not null and no_revenue_confirmed_at is not null) then
    raise exception 'zero labor and no billable charges did not derive zero-total confirmation';
  end if;
  patch := patch || jsonb_build_object('laborServicesCents', null,
    'noLaborServicesConfirmed', false, 'noRevenueConfirmed', false);
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job', patch));
  if not exists (select 1 from public.jobs where id = job_id and revenue_cents is null
      and labor_services_cents is null and no_labor_services_confirmed_at is null
      and no_revenue_confirmed_at is null) then
    raise exception 'unknown labor did not clear confirmations and Revenue';
  end if;
  begin
    perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job',
      patch || jsonb_build_object('shortDescription', 'Must roll back',
        'laborServicesCents', 1, 'noLaborServicesConfirmed', true)));
    raise exception 'positive labor accepted a zero-labor confirmation';
  exception when others then
    if SQLERRM not like '%apply_job_detail_edit:invalid%' then raise; end if;
  end;
  if (select short_description from public.jobs where id = job_id) <> 'Cost-only edit' then
    raise exception 'invalid no-labor request partially saved';
  end if;
end;
$$;

do $$
#variable_conflict use_variable
declare
  owner_id uuid := gen_random_uuid();
  job_id uuid;
  preview jsonb;
  invoice_a jsonb;
  invoice_b jsonb;
  invoice_c jsonb;
  revision bigint;
  retry_key uuid := gen_random_uuid();
  old_fingerprint text;
  estimate jsonb;
  recovered jsonb;
begin
  insert into auth.users (id, email) values (owner_id, 'review-source-' || owner_id || '@example.com');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.jobs (user_id, short_description, customer_name, revenue_cents)
  values (owner_id, 'Invoice source', 'Customer', 10000) returning id into job_id;
  insert into public.business_settings (user_id, business_name) values (owner_id, 'Business');
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  invoice_a := public.create_and_select_financial_document(job_id, 'invoice',
    preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());
  update public.jobs set labor_services_cents = 20000 where id = job_id;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  invoice_b := public.create_and_select_financial_document(job_id, 'invoice',
    preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());

  -- Replaying a cached draft must not substitute its old Revenue for invoice B.
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job',
    jsonb_build_object('shortDescription', 'Edited stale draft', 'customerName', 'Customer',
      'revenueCents', 10000, 'pricingIntent', 'labor', 'laborServicesCents', 10000,
      'noLaborServicesConfirmed', false, 'noRevenueConfirmed', false,
      'noMaterialsConfirmed', false, 'noOtherCostsConfirmed', false)));
  if not exists (select 1 from public.jobs where id = job_id
      and revenue_document_id = (invoice_b ->> 'id')::uuid and revenue_cents = 20000
      and labor_services_cents = 10000) then
    raise exception 'deferred draft save corrupted selected invoice Revenue';
  end if;
  -- The legacy Revenue-intent path must retain authoritative Revenue too.
  perform public.apply_job_detail_edit_atomic(job_id, jsonb_build_object('job',
    jsonb_build_object('shortDescription', 'Edited stale draft', 'customerName', 'Customer',
      'revenueCents', 5000, 'noRevenueConfirmed', false,
      'noMaterialsConfirmed', false, 'noOtherCostsConfirmed', false)));
  if (select revenue_cents from public.jobs where id = job_id) <> 20000 then
    raise exception 'legacy deferred draft save corrupted selected invoice Revenue';
  end if;
  begin
    perform public.finalize_job_with_invoice(job_id, 'completed', (invoice_a ->> 'id')::uuid,
      null, 'America/Chicago', gen_random_uuid());
    raise exception 'obsolete final review silently selected an older Invoice';
  exception when others then
    if SQLERRM not like '%financial_document:conflict%' then raise; end if;
  end;
  if (select revenue_document_id from public.jobs where id = job_id) <> (invoice_b ->> 'id')::uuid
     or (select archived from public.financial_document_controls where document_id = (invoice_b ->> 'id')::uuid) then
    raise exception 'stale finalization changed source/controls';
  end if;

  select control_revision into revision from public.financial_document_controls
  where document_id = (invoice_a ->> 'id')::uuid;
  perform public.set_financial_document_controls((invoice_a ->> 'id')::uuid, false, true, revision);
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  invoice_c := public.create_and_select_financial_document(job_id, 'invoice',
    preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());
  if not (select archived and not link_enabled from public.financial_document_controls
      where document_id = (invoice_b ->> 'id')::uuid)
     or not (select not archived and link_enabled from public.financial_document_controls
      where document_id = (invoice_a ->> 'id')::uuid) then
    raise exception 'replacement archived an intentionally reopened historical invoice';
  end if;
  perform public.finalize_job_with_invoice(job_id, 'completed', (invoice_c ->> 'id')::uuid,
    null, 'America/Chicago', gen_random_uuid());
  if not (select not archived and link_enabled from public.financial_document_controls
      where document_id = (invoice_a ->> 'id')::uuid) then
    raise exception 'finalizing the same source archived historical controls';
  end if;
  perform public.select_job_revenue_invoice(job_id, (invoice_b ->> 'id')::uuid, (invoice_c ->> 'id')::uuid);
  if not (select archived and not link_enabled from public.financial_document_controls
      where document_id = (invoice_b ->> 'id')::uuid)
     or not (select not archived and link_enabled from public.financial_document_controls
      where document_id = (invoice_a ->> 'id')::uuid) then
    raise exception 'selection did not preserve chosen and unrelated historical controls';
  end if;

  preview := public.preview_financial_document(job_id, 'estimate', 'America/Chicago');
  old_fingerprint := preview ->> 'fingerprint';
  estimate := public.create_financial_document(job_id, 'estimate', old_fingerprint, 'America/Chicago', retry_key);
  update public.jobs set short_description = 'Job changed after commit' where id = job_id;
  update public.business_settings set tax_rate_bps = 100 where user_id = owner_id;
  recovered := public.create_financial_document(job_id, 'estimate', old_fingerprint, 'America/Chicago', retry_key);
  if recovered ->> 'id' <> estimate ->> 'id'
     or (select count(*) from public.financial_documents d where d.job_id = job_id and d.document_type = 'estimate') <> 1 then
    raise exception 'committed Estimate retry depended on current Job/settings';
  end if;
  begin
    perform public.create_financial_document(job_id, 'estimate', old_fingerprint, 'UTC', retry_key);
    raise exception 'changed request timezone reused committed request key';
  exception when others then
    if SQLERRM not like '%financial_document:conflict%' then raise; end if;
  end;
  begin
    update public.jobs set job_work_status = 'in_progress' where id = job_id;
    update public.jobs set job_work_status = 'completed' where id = job_id;
    raise exception 'adopted Job allowed old-client finalization';
  exception when others then
    if SQLERRM not like '%financial_document:invoice_required%' then raise; end if;
  end;
end;
$$;

do $$
#variable_conflict use_variable
declare
  owner_id uuid := gen_random_uuid();
  job_id uuid;
  visit_id uuid;
  deleted_visit_id uuid;
  material_id uuid;
  explicit_id uuid;
  omitted_id uuid;
  preview jsonb;
  invoice jsonb;
  estimate jsonb;
begin
  insert into auth.users (id, email) values (owner_id, 'review-visit-' || owner_id || '@example.com');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.jobs (user_id, short_description, customer_name, revenue_cents)
  values (owner_id, 'Visit materials', 'Customer', 10000) returning id into job_id;
  insert into public.sessions (user_id, job_id, entry_mode, session_status, started_at, ended_at)
  values (owner_id, job_id, 'manual', 'ended', now() - interval '1 hour', now()) returning id into visit_id;
  insert into public.sessions (user_id, job_id, entry_mode, session_status, started_at, deleted_at)
  values (owner_id, job_id, 'manual', 'deleted', now() - interval '2 hours', now()) returning id into deleted_visit_id;
  insert into public.job_costs (user_id, session_id, description, cost_type, total_cost_cents)
  values (owner_id, visit_id, 'Implicit', 'material', 2000) returning id into material_id;
  insert into public.job_costs (user_id, session_id, description, cost_type, total_cost_cents, markup_override_bps)
  values (owner_id, visit_id, 'Explicit zero', 'material', 1000, 0) returning id into explicit_id;
  insert into public.job_costs (user_id, session_id, description, cost_type, total_cost_cents)
  values (owner_id, deleted_visit_id, 'Deleted Visit', 'material', 1000) returning id into omitted_id;
  insert into public.business_settings (user_id, business_name, material_markup_bps)
  values (owner_id, 'Business', 1000);
  preview := public.preview_financial_document(job_id, 'estimate', 'America/Chicago');
  estimate := public.create_financial_document(job_id, 'estimate', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());
  if (select markup_override_bps from public.job_costs where id = material_id) is not null then
    raise exception 'Estimate solidified material markup';
  end if;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  invoice := public.create_and_select_financial_document(job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());
  if (select markup_override_bps from public.job_costs where id = material_id) <> 1000
     or (select markup_override_bps from public.job_costs where id = explicit_id) <> 0
     or (select markup_override_bps from public.job_costs where id = omitted_id) is not null then
    raise exception 'invoice markup solidification ignored included Visit rows/explicit overrides';
  end if;
  update public.business_settings set material_markup_bps = 2000 where user_id = owner_id;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  if (preview #>> '{payload,subtotalCents}')::bigint <> (invoice #>> '{payload,subtotalCents}')::bigint then
    raise exception 'solidified Visit markup changed with business default';
  end if;
end;
$$;
-- Exercise real role grants, not just JWT claim strings under postgres.
do $$
#variable_conflict use_variable
declare
  owner_id uuid := gen_random_uuid();
  other_owner_id uuid := gen_random_uuid();
  job_id uuid;
  preview jsonb;
  invoice jsonb;
begin
  insert into auth.users (id, email) values
    (owner_id, 'review-role-' || owner_id || '@example.com'),
    (other_owner_id, 'review-role-other-' || other_owner_id || '@example.com');
  insert into public.jobs (user_id, short_description, customer_name, revenue_cents)
  values (owner_id, 'Role boundary', 'Customer', 10000) returning id into job_id;
  insert into public.business_settings (user_id, business_name) values (owner_id, 'Business');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.apply_job_detail_edit_with_invoice_preferences(job_id, jsonb_build_object('job',
    jsonb_build_object('shortDescription', 'Role boundary', 'customerName', 'Customer',
      'revenueCents', 10000, 'pricingIntent', 'labor', 'laborServicesCents', 0,
      'noLaborServicesConfirmed', true, 'noRevenueConfirmed', false,
      'noMaterialsConfirmed', true, 'noOtherCostsConfirmed', true)));
  if not exists (select 1 from public.jobs where id = job_id and revenue_cents = 0
      and no_labor_services_confirmed_at is not null and no_revenue_confirmed_at is not null) then
    raise exception 'authenticated role could not save an explicitly zero proposal';
  end if;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  invoice := public.finalize_job_with_invoice(job_id, 'completed', null,
    preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());
  if invoice ->> 'isRevenueSource' <> 'true' then
    raise exception 'authenticated role could not adopt and finalize an Invoice';
  end if;
  -- New privileged pricing helper remains strictly owner-scoped.
  perform set_config('request.jwt.claim.sub', other_owner_id::text, true);
  begin
    perform private.update_job_labor_proposal(job_id, 1000, false);
    raise exception 'cross-owner helper mutation was allowed';
  exception when others then
    if SQLERRM not like '%apply_job_detail_edit:not_found%' then raise; end if;
  end;
  execute 'reset role';
end;
$$;

rollback;
