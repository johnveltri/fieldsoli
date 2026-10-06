\set ON_ERROR_STOP on

begin;

do $$
#variable_conflict use_variable
declare
  owner uuid := gen_random_uuid();
  job_id uuid;
  deleted_job uuid;
  negative_job uuid;
  material_id uuid;
  disposal_id uuid;
  preview jsonb;
  created jsonb;
  replay jsonb;
  request_key uuid := gen_random_uuid();
  token text;
begin
  if has_table_privilege('anon', 'public.financial_documents', 'SELECT')
     or has_table_privilege('authenticated', 'public.financial_documents', 'SELECT')
     or has_table_privilege('anon', 'public.financial_document_links', 'SELECT')
     or has_table_privilege('authenticated', 'public.business_settings', 'SELECT') = false then
    raise exception 'document table privileges are wrong';
  end if;

  insert into auth.users (id, email)
  values (owner, 'invoicing-' || owner || '@example.com');
  perform set_config('request.jwt.claim.sub', owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform set_config('fieldsolo.skip_revenue_solve', '1', true);
  insert into public.jobs (user_id, short_description, revenue_cents, deleted_at)
  values (owner, 'Deleted legacy', 8000, now())
  returning id into deleted_job;
  perform set_config('fieldsolo.skip_revenue_solve', '', true);
  if (select pricing_mode from public.jobs where id = deleted_job) <> 'legacy' then
    raise exception 'deleted job was converted';
  end if;
  update public.jobs set deleted_at = null where id = deleted_job;
  if not (select pricing_needs_review from public.jobs where id = deleted_job) then
    raise exception 'restored legacy job did not require pricing review';
  end if;

  insert into public.jobs (
    user_id, short_description, customer_name, revenue_cents
  ) values (
    owner, 'Panel upgrade', 'Ada Lovelace', null
  ) returning id into job_id;
  if (select pricing_mode from public.jobs where id = job_id) <> 'legacy' then
    raise exception 'null revenue insert should stay legacy until priced';
  end if;

  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type
  ) values (
    owner, job_id, 'Wire', 1, 'ea', 10000, 10000, 'material'
  ) returning id into material_id;
  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type, cost_type_explicit
  ) values (
    owner, job_id, 'Haul away', 1, 'ea', 5000, 5000, 'disposal', true
  ) returning id into disposal_id;
  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type, cost_type_explicit
  ) values (
    owner, job_id, 'Meter', 1, 'ea', 2000, 2000, 'travel_parking', true
  );

  update public.job_costs set markup_override_bps = 2000 where id = material_id;
  update public.job_costs set invoice_customer = true where id = disposal_id;
  update public.jobs set labor_services_cents = 40000 where id = job_id;

  if (select j.revenue_cents from public.jobs j where j.id = job_id) <> 57000 then
    raise exception 'anchor revenue was %, expected 57000', (select j.revenue_cents from public.jobs j where j.id = job_id);
  end if;
  if (select j.revenue_cents from public.jobs j where j.id = job_id)
     - (select coalesce(sum(c.total_cost_cents), 0) from public.job_costs c where c.job_id = job_id) <> 40000 then
    raise exception 'anchor net earnings were not 40000';
  end if;

  insert into public.business_settings (user_id, business_name, tax_rate_bps)
  values (owner, 'Ada Electric', 1000);
  preview := public.preview_financial_document(job_id, 'invoice', 'America/Chicago');
  if (preview -> 'payload' ->> 'taxCents')::bigint <> 5700
     or (preview -> 'payload' ->> 'totalCents')::bigint <> 62700
     or (select revenue_cents from public.jobs where id = job_id) <> 57000 then
    raise exception 'tax changed revenue or missed the 62700 document total: %', preview;
  end if;
  if jsonb_array_length(preview -> 'gaps') <> 0 then
    raise exception 'ready job reported gaps %', preview -> 'gaps';
  end if;

  created := public.create_financial_document(
    job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', request_key
  );
  replay := public.create_financial_document(
    job_id, 'invoice', preview ->> 'fingerprint', 'America/Chicago', request_key
  );
  if created ->> 'id' is distinct from replay ->> 'id' then
    raise exception 'idempotent create returned a second document';
  end if;
  begin
    perform public.create_financial_document(
      job_id, 'estimate', preview ->> 'fingerprint', 'America/Chicago', request_key
    );
    raise exception 'changed intent reused an idempotency key';
  exception
    when others then
      if SQLERRM not like '%financial_document:conflict%' then
        raise;
      end if;
  end;

  begin
    update public.financial_documents
    set payload = '{"tampered":true}'::jsonb
    where id = (created ->> 'id')::uuid;
    raise exception 'snapshot update was allowed';
  exception
    when others then
      if SQLERRM not like '%financial_document:immutable%' then
        raise;
      end if;
  end;

  select token_protected into token
  from public.financial_document_links
  where document_id = (created ->> 'id')::uuid;
  if public.resolve_shared_financial_document('not-a-real-token') ->> 'status' <> 'unavailable' then
    raise exception 'unknown token was not unavailable';
  end if;
  perform public.set_financial_document_controls(
    (created ->> 'id')::uuid, false, false, 1
  );
  if public.resolve_shared_financial_document(token) ->> 'status' <> 'unavailable' then
    raise exception 'disabled link was distinguishable';
  end if;

  update public.jobs set collected_cents = revenue_cents where id = job_id;
  if (select job_payment_state from public.jobs where id = job_id) <> 'paid' then
    raise exception 'collected revenue did not project paid';
  end if;

  insert into public.jobs (user_id, short_description, revenue_cents)
  values (owner, 'Too small', 1000)
  returning id into negative_job;
  insert into public.job_costs (
    user_id, job_id, description, quantity, unit, unit_cost_cents, total_cost_cents, cost_type
  ) values (
    owner, negative_job, 'Expensive', 1, 'ea', 5000, 5000, 'material'
  );
  begin
    update public.jobs set revenue_cents = 1000 where id = negative_job;
    raise exception 'negative labor residual was stored';
  exception
    when others then
      if SQLERRM not like '%apply_job_detail_edit:invalid%' then
        raise;
      end if;
  end;
  if (select revenue_cents from public.jobs where id = negative_job) < 5000 then
    raise exception 'negative residual was clamped';
  end if;

  declare
    attacker uuid := gen_random_uuid();
    revision_before bigint;
  begin
    select control_revision into revision_before
    from public.financial_document_controls
    where document_id = (created ->> 'id')::uuid;
    insert into auth.users (id, email)
    values (attacker, 'invoicing-attacker-' || attacker || '@example.com');
    perform set_config('request.jwt.claim.sub', attacker::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    begin
      perform private.revoke_owner_document_links(owner);
      raise exception 'cross-tenant document revoke succeeded';
    exception
      when others then
        if SQLERRM not like '%financial_document:unauthorized%' then
          raise;
        end if;
    end;
    if (select control_revision from public.financial_document_controls where document_id = (created ->> 'id')::uuid)
       is distinct from revision_before then
      raise exception 'cross-tenant revoke changed document links';
    end if;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  if public.resolve_shared_financial_document('not-a-real-token-with-enough-length') ->> 'status'
     is distinct from 'unavailable' then
    raise exception 'anon could not resolve a shared document';
  end if;
end;
$$;

rollback;
