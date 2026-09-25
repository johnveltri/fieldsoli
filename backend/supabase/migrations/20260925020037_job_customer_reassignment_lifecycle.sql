create or replace function private.jobs_recompute_customer_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at
    or new.customer_id is distinct from old.customer_id then
    if old.customer_id is not null then
      perform private.recompute_customer_from_jobs(old.customer_id);
    end if;
    if new.customer_id is not null
      and new.customer_id is distinct from old.customer_id then
      perform private.recompute_customer_from_jobs(new.customer_id);
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.jobs_recompute_customer_on_delete()
  from public, anon, authenticated;

drop trigger if exists jobs_recompute_customer_on_delete on public.jobs;
create trigger jobs_recompute_customer_on_delete
  after update of deleted_at, customer_id on public.jobs
  for each row execute function private.jobs_recompute_customer_on_delete();
