-- Job Edit confirmation checkboxes are part of the same commit as the job and
-- child-row diff. Calling the existing apply function from this wrapper keeps
-- every write in one PostgreSQL transaction while preserving its validation,
-- row lock, retry behavior, and owner checks.

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

  if v_no_revenue_confirmed then
    v_apply_payload := jsonb_set(v_apply_payload, '{job,revenueCents}', '0'::jsonb, true);
  end if;

  update public.jobs
  set revenue_cents = case
        when v_no_revenue_confirmed then 0
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

  return v_result;
end;
$$;

revoke execute on function public.apply_job_detail_edit_atomic(uuid, jsonb) from public;
revoke execute on function public.apply_job_detail_edit_atomic(uuid, jsonb) from anon;
grant execute on function public.apply_job_detail_edit_atomic(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
