-- Permit administrator review of license numbers without requiring document photos.
-- Admins must still verify the company license for the correct state and each profession's
-- license number/type before approving licensed work.
create or replace function public.zelpx_admin_verify_contractor_qualification(
  p_qualification_id uuid,
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_qualification public.contractor_profession_qualifications%rowtype;
  v_eligibility text;
  v_has_company_license boolean;
  v_company_license_status text;
  v_company_license_state text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Admin permission required';
  end if;

  select * into v_qualification
  from public.contractor_profession_qualifications q
  where q.id = p_qualification_id
  for update;

  if not found then
    raise exception 'Contractor qualification not found';
  end if;

  select e.eligibility_status into v_eligibility
  from public.state_profession_eligibility e
  where e.profession_id = v_qualification.profession_id
    and e.state_code = upper(trim(v_qualification.state_code))
    and e.worker_role = v_qualification.work_role
  limit 1;

  if v_qualification.work_role = 'employee' then
    if v_eligibility is distinct from 'individual_trade_credential_required' then
      raise exception 'This employee scope does not require personal-license approval. Verify the employer or resolve the state rule instead';
    end if;
  else
    if v_eligibility not in ('individual_trade_credential_required','contractor_license_or_registration_required') then
      raise exception 'This state/profession scope is not cleared for credential approval. Resolve the state eligibility rule before approving';
    end if;

    select coalesce(c.has_license,false), c.license_review_status,
           upper(trim(coalesce(c.license_state,'')))
      into v_has_company_license, v_company_license_status, v_company_license_state
    from public.contractors c
    where c.id = v_qualification.contractor_id;

    if not v_has_company_license
       or v_company_license_status is distinct from 'verified'
       or v_company_license_state is distinct from upper(trim(v_qualification.state_code)) then
      raise exception 'The company license number must be reviewed and verified for this state before approving the profession credential';
    end if;
  end if;

  if coalesce(trim(v_qualification.license_number),'') = ''
     or coalesce(trim(v_qualification.license_type),'') = '' then
    raise exception 'License number and type are required before approval';
  end if;

  if v_qualification.license_expiration_date is not null
     and v_qualification.license_expiration_date < current_date then
    raise exception 'Expired credentials cannot be approved';
  end if;

  update public.contractor_profession_qualifications
  set license_required_at_registration = true,
      verification_status = 'verified',
      verified_at = now(),
      admin_notes = nullif(trim(coalesce(p_admin_notes,'')),''),
      updated_at = now()
  where id = p_qualification_id;
end;
$function$;
