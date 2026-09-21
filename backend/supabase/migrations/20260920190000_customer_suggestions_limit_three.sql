-- Customer picker suggestions: cap at three rows and require an active job link.

create or replace function public.list_customer_suggestions(p_query text default '')
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_trimmed text := btrim(coalesce(p_query, ''));
  v_limit integer := 3;
  v_results jsonb;
begin
  if v_user_id is null then
    raise exception 'list_customer_suggestions:unauthorized' using errcode = 'P0001';
  end if;

  with active_customer_ids as (
    select distinct j.customer_id as id
    from public.jobs j
    where j.user_id = v_user_id
      and j.deleted_at is null
      and j.customer_id is not null
  ),
  eligible as (
    select
      c.id,
      c.display_name,
      c.phone,
      c.email,
      c.last_service_address,
      max(j.updated_at) as latest_job_updated_at,
      (array_agg(j.id order by j.updated_at desc, j.id desc))[1] as latest_job_id
    from public.customers c
    join active_customer_ids ac
      on ac.id = c.id
    join public.jobs j
      on j.customer_id = c.id
     and j.user_id = c.user_id
     and j.deleted_at is null
    where c.user_id = v_user_id
      and c.deleted_at is null
      and private.is_customer_eligible(
        c.display_name, c.phone, c.email, c.last_service_address
      )
      and (
        v_trimmed = ''
        or c.display_name ilike '%' || v_trimmed || '%'
      )
    group by c.id, c.display_name, c.phone, c.email, c.last_service_address
    order by latest_job_updated_at desc, latest_job_id desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'customerId', e.id,
        'displayName', e.display_name,
        'phone', e.phone,
        'email', e.email,
        'serviceAddress', e.last_service_address
      )
      order by e.latest_job_updated_at desc, e.latest_job_id desc
    ),
    '[]'::jsonb
  )
  into v_results
  from eligible e;

  return v_results;
end;
$$;
