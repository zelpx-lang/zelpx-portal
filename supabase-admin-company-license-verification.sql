create or replace function public.admin_verify_contractor_company_license(p_contractor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.contractors%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  select * into v_row
  from public.contractors
  where id = p_contractor_id
  for update;

  if not found then raise exception 'Contractor profile not found'; end if;
  if v_row.verification_status <> 'verified' then
    raise exception 'Approve the contractor account before verifying the company license';
  end if;
  if v_row.has_license is distinct from true
     or nullif(trim(v_row.license_number), '') is null
     or nullif(trim(v_row.license_state), '') is null then
    raise exception 'A license number and issuing state are required';
  end if;

  update public.contractors
  set license_review_status = 'verified'
  where id = p_contractor_id;

  return jsonb_build_object('success', true, 'contractor_id', p_contractor_id, 'license_review_status', 'verified');
end;
$$;

revoke all on function public.admin_verify_contractor_company_license(uuid) from public, anon;
grant execute on function public.admin_verify_contractor_company_license(uuid) to authenticated;