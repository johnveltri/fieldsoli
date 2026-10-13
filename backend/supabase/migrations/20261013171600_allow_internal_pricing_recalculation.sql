-- Pricing rollups can update Revenue without changing an adopted Job's
-- completion or payment status. Keep the old-client status guard focused on
-- user-visible finalization transitions.
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

  -- Internal pricing recomputations can touch Revenue on an unfinalized Job.
  -- They cannot change status or collection, so they must not be mistaken for
  -- a direct Complete/Paid action from an older client.
  if coalesce(current_setting('fieldsolo.skip_revenue_solve', true), '') = '1' then
    return new;
  end if;

  v_completed_transition := old.job_work_status is distinct from 'completed'
    and new.job_work_status = 'completed';
  v_paid_transition := old.job_payment_state is distinct from 'paid'
    and new.collected_cents is distinct from old.collected_cents
    and coalesce(new.revenue_cents, 0) > 0
    and new.collected_cents >= new.revenue_cents;
  if new.revenue_invoice_required and (v_completed_transition or v_paid_transition
      or (new.no_revenue_marked_paid and not old.no_revenue_marked_paid)) then
    if coalesce(current_setting('fieldsolo.allow_invoice_finalization', true), '') <> '1'
       or new.revenue_document_id is null then
      raise exception 'financial_document:invoice_required' using errcode = 'P0001';
    end if;
  end if;
  if old.revenue_invoice_required and new.revenue_document_id is null then
    raise exception 'financial_document:invoice_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
