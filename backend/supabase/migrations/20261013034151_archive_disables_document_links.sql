-- Archived documents cannot retain a public sharing link.
update public.financial_document_controls
set link_enabled = false,
    control_revision = control_revision + 1
where archived and link_enabled;

alter table public.financial_document_controls
  add constraint financial_document_controls_archived_link_check
  check (not archived or not link_enabled);

create or replace function private.set_financial_document_controls(
  p_document_id uuid,
  p_archived boolean,
  p_link_enabled boolean,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'financial_document:unauthorized' using errcode = 'P0001';
  end if;
  select control_revision into v_revision
  from public.financial_document_controls
  where document_id = p_document_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'financial_document:not_found' using errcode = 'P0001';
  end if;
  if v_revision is distinct from p_expected_revision then
    raise exception 'financial_document:conflict' using errcode = 'P0001';
  end if;
  update public.financial_document_controls
  set archived = p_archived,
      link_enabled = case when p_archived then false else p_link_enabled end,
      control_revision = control_revision + 1
  where document_id = p_document_id;
  return private.owner_document_json(p_document_id);
end;
$$;
