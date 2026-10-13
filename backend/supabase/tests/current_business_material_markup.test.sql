\set ON_ERROR_STOP on
begin;

do $$
#variable_conflict use_variable
declare
  owner uuid := gen_random_uuid();
  job_id uuid;
  material_id uuid;
  preview jsonb;
  issued jsonb;
  replacement jsonb;
begin
  insert into auth.users (id, email) values (owner, 'markup-' || owner || '@example.com');
  perform set_config('request.jwt.claim.sub', owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.jobs (user_id, short_description, customer_name, revenue_invoice_required)
  values (owner, 'Default markup repair', 'Example Customer', false) returning id into job_id;
  insert into public.job_costs (user_id, job_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type)
  values (owner, job_id, 'Material', 1, 'ea', 10000, 10000, 'material') returning id into material_id;
  update public.jobs set labor_services_cents = 50000 where id = job_id;

  -- This material predates settings: its captured default is zero.
  insert into public.business_settings (user_id, business_name, material_markup_bps)
  values (owner, 'Example Business', 1000);
  if (select revenue_cents from public.jobs where id = job_id) <> 61000 then
    raise exception 'Default settings creation failed to reprice existing job';
  end if;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  if (preview -> 'payload' ->> 'totalCents')::bigint <> 61000
     or (preview #>> '{payload,lines,1,amountCents}')::bigint <> 11000
     or (preview #>> '{payload,lines,1,details,unitPriceCents}')::bigint <> 11000 then
    raise exception 'Default markup missing from invoice amounts or unit price: %', preview;
  end if;
  issued := public.create_and_select_financial_document(job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid());
  if (select markup_override_bps from public.job_costs where id = material_id) <> 1000 then
    raise exception 'Invoice creation did not solidify the current business markup';
  end if;

  update public.business_settings set material_markup_bps = 2000 where user_id = owner;
  if (select revenue_cents from public.jobs where id = job_id) <> 61000 then
    raise exception 'Changing default changed invoice-backed revenue';
  end if;
  preview := public.preview_financial_document(job_id, 'estimate', 'America/Chicago');
  if (preview -> 'payload' ->> 'totalCents')::bigint <> 61000 then
    raise exception 'Solidified invoice markup did not remain on the material';
  end if;

  update public.job_costs set markup_override_bps = 0 where id = material_id;
  update public.business_settings set material_markup_bps = 3000 where user_id = owner;
  if (select revenue_cents from public.jobs where id = job_id) <> 61000 then
    raise exception 'Material markup edit changed invoice-backed revenue';
  end if;
  update public.job_costs set markup_override_bps = null where id = material_id;
  if (select revenue_cents from public.jobs where id = job_id) <> 61000 then
    raise exception 'Clearing markup override changed invoice-backed revenue';
  end if;
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  if (preview -> 'payload' ->> 'totalCents')::bigint <> 63000 then
    raise exception 'Clearing override failed to update new invoice';
  end if;
  if (select (payload ->> 'totalCents')::bigint from public.financial_documents where id = (issued ->> 'id')::uuid) <> 61000 then
    raise exception 'Business default change modified issued document';
  end if;
  replacement := public.create_and_select_financial_document(
    job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', gen_random_uuid()
  );
  if (select revenue_cents from public.jobs where id = job_id) <> 63000
     or replacement ->> 'isRevenueSource' <> 'true'
     or not (select archived and not link_enabled from public.financial_document_controls
       where document_id = (issued ->> 'id')::uuid) then
    raise exception 'Replacement invoice did not become revenue source and archive the prior link';
  end if;
end;
$$;

rollback;
