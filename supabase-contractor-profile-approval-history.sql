-- ZELPX contractor profile approval and immutable version history.
-- Prepared for review; do not run against production until a database backup is verified.
-- Active identity/company/license/work-type data changes only inside the admin approval RPC.
-- Contractors may self-update service_radius_miles only.

begin;

create table if not exists public.contractor_profile_history (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id),
  user_id uuid not null references public.profiles(id),
  change_request_id uuid not null references public.contractor_change_requests(id),
  request_type text not null,
  previous_data jsonb not null default '{}'::jsonb,
  approved_data jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint contractor_profile_history_request_unique unique (change_request_id)
);

create index if not exists contractor_profile_history_contractor_created_idx
  on public.contractor_profile_history (contractor_id, created_at desc);

alter table public.contractor_profile_history enable row level security;
revoke all on public.contractor_profile_history from anon, authenticated;
grant select on public.contractor_profile_history to authenticated;

drop policy if exists "Contractors and admins read profile history" on public.contractor_profile_history;
create policy "Contractors and admins read profile history"
on public.contractor_profile_history
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

-- Never allow contractors to directly alter approved identity/company fields.
create or replace function public.zelpx_guard_contractor_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_is_admin boolean;
  v_is_contractor boolean;
begin
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into v_is_admin;

  if v_is_admin or auth.uid() is null then
    return new;
  end if;

  select exists(
    select 1 from public.contractors c where c.user_id = auth.uid()
  ) into v_is_contractor;

  if v_is_contractor then
    if new.id is distinct from old.id
       or new.created_at is distinct from old.created_at
       or new.full_name is distinct from old.full_name
       or new.phone is distinct from old.phone
       or new.avatar_url is distinct from old.avatar_url
       or new.role is distinct from old.role then
      raise exception 'Name and phone changes require administrator approval';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists trg_zelpx_guard_contractor_profile_updates on public.profiles;
create trigger trg_zelpx_guard_contractor_profile_updates
before update on public.profiles
for each row execute function public.zelpx_guard_contractor_profile_updates();

create or replace function public.zelpx_guard_contractor_company_updates()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_is_admin boolean;
begin
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into v_is_admin;

  if v_is_admin or auth.uid() is null then
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at
       or new.company_name is distinct from old.company_name
       or new.email is distinct from old.email
       or new.verification_status is distinct from old.verification_status
       or new.service_address is distinct from old.service_address
       or new.service_city is distinct from old.service_city
       or new.service_state is distinct from old.service_state
       or new.service_zip_code is distinct from old.service_zip_code
       or new.service_latitude is distinct from old.service_latitude
       or new.service_longitude is distinct from old.service_longitude
       or new.has_license is distinct from old.has_license
       or new.license_number is distinct from old.license_number
       or new.license_state is distinct from old.license_state
       or new.license_type is distinct from old.license_type
       or new.license_document_path is distinct from old.license_document_path
       or new.license_review_status is distinct from old.license_review_status
       or new.insurance_document_path is distinct from old.insurance_document_path
       or new.insurance_policy_number is distinct from old.insurance_policy_number
       or new.insurance_expiration_date is distinct from old.insurance_expiration_date
       or new.insurance_review_status is distinct from old.insurance_review_status
       or new.lead_email_notifications is distinct from old.lead_email_notifications then
      raise exception 'Company, contact, address and credential changes require administrator approval';
    end if;

    if new.service_radius_miles is distinct from old.service_radius_miles
       and (new.service_radius_miles < 1 or new.service_radius_miles > 250) then
      raise exception 'Service radius must be between 1 and 250 miles';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists trg_zelpx_guard_contractor_company_updates on public.contractors;
create trigger trg_zelpx_guard_contractor_company_updates
before update on public.contractors
for each row execute function public.zelpx_guard_contractor_company_updates();

-- The portal now submits initial and later service selections as review requests.
-- The old AFTER INSERT trigger attached signup metadata directly to active categories,
-- bypassing approval. Remove that path; the portal submits the same selections to the
-- pending request queue after login.
drop trigger if exists trg_zelpx_attach_signup_service_categories on public.contractors;
drop policy if exists "Contractors add own service categories" on public.contractor_service_categories;
drop policy if exists "Contractors remove own service categories" on public.contractor_service_categories;
drop policy if exists "contractors can add own qualifications" on public.contractor_profession_qualifications;
drop policy if exists "contractors can delete own qualifications" on public.contractor_profession_qualifications;
drop policy if exists "contractors can update own qualification documents" on public.contractor_profession_qualifications;

-- Keep every submitted/reviewed request as evidence. No contractor/admin delete path.
drop policy if exists "Contractors delete own rejected change requests" on public.contractor_change_requests;
revoke delete on public.contractor_change_requests from anon, authenticated;
revoke all on function public.delete_own_reviewed_contractor_change_request(uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_contractor_change_request(uuid) from public, anon, authenticated;

-- Submit complete drafts, but never accept service radius or notification preferences
-- through the approval queue. Those two settings are self-service.
create or replace function public.submit_contractor_change_request(p_type text, p_changes jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_contractor_id uuid;
  v_id uuid;
  v_state text;
  v_changes jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into v_contractor_id from public.contractors
  where user_id = auth.uid() for update;
  if v_contractor_id is null then raise exception 'Contractor profile not found'; end if;
  if p_type not in ('company_profile','service_categories','profession_qualifications') then
    raise exception 'Unsupported change request type';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'object' then raise exception 'Invalid change payload'; end if;

  v_changes := p_changes;
  if p_type = 'company_profile' then
    -- Service radius remains a separate preference. Every account/profile
    -- submission creates its own admin-review request; earlier requests are retained.
    v_changes := v_changes - 'additional_state_licenses' - 'has_insurance_certificate';
    if v_changes ? 'service_radius_miles'
       and (v_changes->>'service_radius_miles')::integer not in (10,25,50,100,150,250) then
      raise exception 'Choose a valid service radius';
    end if;
    if v_changes ? 'company_name' and nullif(btrim(v_changes->>'company_name'), '') is null then
      raise exception 'Company name is required and cannot be cleared';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_changes) as keys(key)
      where key not in (
        'full_name','phone','avatar_url','company_name','email',
        'service_address','service_city','service_state','service_zip_code',
        'service_latitude','service_longitude','service_radius_miles','lead_email_notifications',
        'has_license','license_number','license_state','license_type',
        'license_expiration_date','license_number_2','license_state_2','license_type_2',
        'insurance_agency_name','insurance_agent_phone','insurance_policy_number',
        'insurance_expiration_date'
      )
    ) then raise exception 'Unsupported company profile field'; end if;
  elsif p_type = 'service_categories' then
    if jsonb_typeof(v_changes->'category_ids') is distinct from 'array' then
      raise exception 'Invalid category list';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_changes->'category_ids') x(value)
      where not exists (select 1 from public.service_categories sc where sc.id=x.value::uuid and sc.is_active=true)
    ) then raise exception 'One or more selected service categories are unavailable'; end if;
  elsif p_type = 'profession_qualifications' then
    v_state := upper(trim(coalesce(v_changes->>'state_code','')));
    if not exists (select 1 from public.us_states s where upper(trim(s.state_code))=v_state and s.is_active=true) then
      raise exception 'Profession requests require an active US state';
    end if;
    if jsonb_typeof(v_changes->'items') is distinct from 'array'
       or jsonb_array_length(v_changes->'items')=0 then
      raise exception 'Select at least one profession';
    end if;
  end if;

  insert into public.contractor_change_requests
    (contractor_id,user_id,request_type,requested_changes,status,created_at)
  values (v_contractor_id,auth.uid(),p_type,v_changes,'pending',now())
  returning id into v_id;
  return v_id;
end
$function$;

revoke all on function public.submit_contractor_change_request(text,jsonb) from public, anon;
grant execute on function public.submit_contractor_change_request(text,jsonb) to authenticated;


-- Admin approval is the second gate for a contractor address change. The address
-- is verified by the portal before the request is submitted; an admin may approve
-- it later even after the short-lived verification token has expired.
create or replace function zelpx_private.require_verified_service_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_purpose text;
  v_address text;
  v_city text;
  v_state text;
  v_zip text;
  v_is_admin boolean := false;
begin
  if tg_table_name = 'service_requests' then
    v_user_id := new.user_id; v_purpose := 'customer_request';
    v_address := new.property_address; v_city := new.service_city;
    v_state := new.service_state; v_zip := new.service_zip_code;
  elsif tg_table_name = 'contractors' then
    v_user_id := new.user_id; v_purpose := 'contractor_profile';
    v_address := new.service_address; v_city := new.service_city;
    v_state := new.service_state; v_zip := new.service_zip_code;
    select exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) into v_is_admin;
    if v_is_admin then return new; end if;
  else
    raise exception 'Unsupported address verification target';
  end if;

  if v_user_id is null or not exists (
    select 1 from public.address_verifications av
    where av.user_id = v_user_id and av.purpose = v_purpose
      and av.address_normalized = zelpx_private.normalize_address(v_address)
      and av.city_normalized = zelpx_private.normalize_address(v_city)
      and av.state_normalized = upper(trim(coalesce(v_state,'')))
      and av.zip_code = regexp_replace(coalesce(v_zip,''), '[^0-9]', '', 'g')
      and av.expires_at > now()
  ) then
    raise exception 'Address must be verified before it can be saved. Please verify the street address, city, state, and ZIP code.';
  end if;
  return new;
end;
$function$;

-- Approval is atomic: capture the old version, apply the new version, and mark
-- the request reviewed in the same transaction. The contractor row ID is unchanged.
CREATE OR REPLACE FUNCTION public.review_contractor_change_request(p_request_id uuid, p_decision text, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r public.contractor_change_requests%rowtype;
  v_item jsonb;
  v_profession_id uuid;
  v_state text;
  v_requirement text;
  v_has_licensed_items boolean := false;
  v_company_license_verified boolean := false;
  v_license_required boolean;
  v_license_change boolean := false;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id=auth.uid() and role='admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  if p_decision not in ('approved_with_license','approved_without_license','rejected') then
    raise exception 'Choose approval with license, approval without license, or rejection';
  end if;

  select * into r
  from public.contractor_change_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Change request not found'; end if;
  if r.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  v_license_change := r.request_type='company_profile' and (
    r.requested_changes ? 'has_license' or r.requested_changes ? 'license_number'
    or r.requested_changes ? 'license_state' or r.requested_changes ? 'license_type'
    or r.requested_changes ? 'license_expiration_date' or r.requested_changes ? 'license_number_2'
    or r.requested_changes ? 'license_state_2' or r.requested_changes ? 'license_type_2'
  );

  if p_decision <> 'rejected' then
    if r.request_type='company_profile' then
      if p_decision='approved_with_license' and v_license_change
         and (coalesce(r.requested_changes->>'license_number','')=''
           or coalesce(r.requested_changes->>'license_state','')=''
           or coalesce(r.requested_changes->>'license_type','')='') then
        raise exception 'Cannot approve with license: state, license number, and license type are required';
      end if;
      if p_decision='approved_with_license'
         and ((coalesce(r.requested_changes->>'license_number_2','')<>''
            or coalesce(r.requested_changes->>'license_state_2','')<>''
            or coalesce(r.requested_changes->>'license_type_2','')<>'')
           and (coalesce(r.requested_changes->>'license_number_2','')=''
            or coalesce(r.requested_changes->>'license_state_2','')=''
            or coalesce(r.requested_changes->>'license_type_2','')='')) then
        raise exception 'Second state license must include state, license number, and license type';
      end if;
      if p_decision='approved_with_license'
         and upper(coalesce(r.requested_changes->>'license_state',''))=upper(coalesce(r.requested_changes->>'license_state_2',''))
         and coalesce(r.requested_changes->>'license_state_2','')<>'' then
        raise exception 'The two license states must be different';
      end if;

      update public.profiles
      set full_name=case when r.requested_changes?'full_name' then r.requested_changes->>'full_name' else full_name end,
          phone=case when r.requested_changes?'phone' then r.requested_changes->>'phone' else phone end,
          avatar_url=case when r.requested_changes?'avatar_url' then nullif(r.requested_changes->>'avatar_url','') else avatar_url end
      where id=r.user_id;

      update public.contractors set
        company_name=case when r.requested_changes?'company_name' then r.requested_changes->>'company_name' else company_name end,
        email=case when r.requested_changes?'email' then r.requested_changes->>'email' else email end,
        service_address=case when r.requested_changes?'service_address' then r.requested_changes->>'service_address' else service_address end,
        service_city=case when r.requested_changes?'service_city' then r.requested_changes->>'service_city' else service_city end,
        service_state=case when r.requested_changes?'service_state' then r.requested_changes->>'service_state' else service_state end,
        service_zip_code=case when r.requested_changes?'service_zip_code' then r.requested_changes->>'service_zip_code' else service_zip_code end,
        service_radius_miles=case when r.requested_changes?'service_radius_miles' then (r.requested_changes->>'service_radius_miles')::integer else service_radius_miles end,
        service_latitude=case when r.requested_changes?'service_latitude' then nullif(r.requested_changes->>'service_latitude','')::double precision else service_latitude end,
        service_longitude=case when r.requested_changes?'service_longitude' then nullif(r.requested_changes->>'service_longitude','')::double precision else service_longitude end,
        lead_email_notifications=case when r.requested_changes?'lead_email_notifications' then (r.requested_changes->>'lead_email_notifications')::boolean else lead_email_notifications end,
        has_license=case when not v_license_change then has_license when p_decision='approved_with_license' then true when p_decision='approved_without_license' then false else has_license end,
        license_number=case when not v_license_change then license_number when p_decision='approved_without_license' then null when r.requested_changes?'license_number' then nullif(r.requested_changes->>'license_number','') else license_number end,
        license_state=case when not v_license_change then license_state when p_decision='approved_without_license' then null when r.requested_changes?'license_state' then nullif(r.requested_changes->>'license_state','') else license_state end,
        license_type=case when not v_license_change then license_type when p_decision='approved_without_license' then null when r.requested_changes?'license_type' then nullif(r.requested_changes->>'license_type','') else license_type end,
        license_expiration_date=case when not v_license_change then license_expiration_date when p_decision='approved_without_license' then null when r.requested_changes?'license_expiration_date' then nullif(r.requested_changes->>'license_expiration_date','')::date else license_expiration_date end,
        license_number_2=case when not v_license_change then license_number_2 when p_decision='approved_without_license' then null when r.requested_changes?'license_number_2' then nullif(r.requested_changes->>'license_number_2','') else license_number_2 end,
        license_state_2=case when not v_license_change then license_state_2 when p_decision='approved_without_license' then null when r.requested_changes?'license_state_2' then nullif(r.requested_changes->>'license_state_2','') else license_state_2 end,
        license_type_2=case when not v_license_change then license_type_2 when p_decision='approved_without_license' then null when r.requested_changes?'license_type_2' then nullif(r.requested_changes->>'license_type_2','') else license_type_2 end,
        license_document_path=case when not v_license_change then license_document_path when p_decision='approved_without_license' then null when r.requested_changes?'license_document_path' then nullif(r.requested_changes->>'license_document_path','') else license_document_path end,
        license_review_status=case when not v_license_change then license_review_status when p_decision='approved_with_license' then 'pending' else 'not_applicable' end,
        insurance_agency_name=case when r.requested_changes?'insurance_agency_name' then nullif(r.requested_changes->>'insurance_agency_name','') else insurance_agency_name end,
        insurance_agent_phone=case when r.requested_changes?'insurance_agent_phone' then nullif(r.requested_changes->>'insurance_agent_phone','') else insurance_agent_phone end,
        insurance_policy_number=case when r.requested_changes?'insurance_policy_number' then nullif(r.requested_changes->>'insurance_policy_number','') else insurance_policy_number end,
        insurance_expiration_date=case when r.requested_changes?'insurance_expiration_date' then nullif(r.requested_changes->>'insurance_expiration_date','')::date else insurance_expiration_date end,
        insurance_document_path=case when r.requested_changes?'insurance_document_path' then nullif(r.requested_changes->>'insurance_document_path','') else insurance_document_path end,
        insurance_review_status=case
          when r.requested_changes?'insurance_document_path' or r.requested_changes?'insurance_agency_name'
            or r.requested_changes?'insurance_agent_phone' or r.requested_changes?'insurance_policy_number'
            or r.requested_changes?'insurance_expiration_date'
          then case when nullif(r.requested_changes->>'insurance_document_path','') is null
             and nullif(r.requested_changes->>'insurance_agency_name','') is null
             and nullif(r.requested_changes->>'insurance_agent_phone','') is null
             and nullif(r.requested_changes->>'insurance_policy_number','') is null
             and nullif(r.requested_changes->>'insurance_expiration_date','') is null
             then 'not_submitted' else 'pending' end
          else insurance_review_status end
      where id=r.contractor_id;

    elsif r.request_type='service_categories' then
      if jsonb_typeof(r.requested_changes->'category_ids') is distinct from 'array' then
        raise exception 'Invalid category list';
      end if;
      delete from public.contractor_service_categories where contractor_id=r.contractor_id;
      insert into public.contractor_service_categories(contractor_id,category_id)
      select r.contractor_id,value::uuid
      from jsonb_array_elements_text(r.requested_changes->'category_ids') x(value)
      join public.service_categories sc on sc.id=value::uuid and sc.is_active=true
      on conflict do nothing;

    elsif r.request_type='profession_qualifications' then
      if jsonb_typeof(r.requested_changes->'items') is distinct from 'array'
         or jsonb_array_length(r.requested_changes->'items')=0 then
        raise exception 'Invalid profession list';
      end if;

      if jsonb_array_length(r.requested_changes->'items') <>
         (select count(distinct value->>'profession_id') from jsonb_array_elements(r.requested_changes->'items')) then
        raise exception 'Duplicate professions are not allowed';
      end if;

      v_state := upper(trim(coalesce(r.requested_changes->>'state_code','')));
      if not exists (
        select 1 from public.us_states s
        where upper(trim(s.state_code)) = v_state and s.is_active = true
      ) then
        raise exception 'Profession approval requires an active US state';
      end if;
      if coalesce(r.requested_changes->>'work_role','') not in ('independent','employee') then
        raise exception 'Invalid work role';
      end if;

      -- Determine licensing from canonical state rules, never from browser-supplied booleans.
      for v_item in select value from jsonb_array_elements(r.requested_changes->'items')
      loop
        begin
          v_profession_id := (v_item->>'profession_id')::uuid;
        exception when others then
          raise exception 'Invalid profession ID in request';
        end;
        if not exists (
          select 1 from public.zelpx_professions p
          where p.id=v_profession_id and p.is_active=true
        ) then
          raise exception 'Selected profession is inactive or unavailable';
        end if;

        select lower(trim(spr.requirement_status)) into v_requirement
        from public.state_profession_rules spr
        where spr.profession_id=v_profession_id
          and upper(trim(spr.state_code))=v_state
          and spr.jurisdiction_level='state'
        limit 1;

        if v_requirement is null then
          raise exception 'No state-level licensing rule exists for one of the selected professions';
        end if;
        if v_requirement in ('required','conditional')
           and (
             r.requested_changes->>'work_role' = 'independent'
             or (r.requested_changes->>'work_role' = 'employee' and v_requirement = 'conditional')
           ) then
          v_has_licensed_items := true;
        end if;
      end loop;

      select exists(
        select 1
        from public.contractor_state_licenses csl
        where csl.contractor_id=r.contractor_id
          and upper(trim(csl.state_code))=v_state
          and csl.review_status='verified'
          and (csl.expiration_date is null or csl.expiration_date>=current_date)
          and coalesce(trim(csl.license_number),'')<>''
          and coalesce(trim(csl.license_type),'')<>''

      ) into v_company_license_verified;

      if v_has_licensed_items and not v_company_license_verified then
        raise exception 'A verified company or employer license for this work state is required before approving this work scope';
      end if;

      delete from public.contractor_profession_qualifications q
      where q.contractor_id=r.contractor_id
        and q.state_code=v_state
        and not exists(
          select 1 from jsonb_array_elements(r.requested_changes->'items') x(value)
          where (x.value->>'profession_id')::uuid=q.profession_id
        );

      for v_item in select value from jsonb_array_elements(r.requested_changes->'items')
      loop
        v_profession_id := (v_item->>'profession_id')::uuid;
        select lower(trim(spr.requirement_status)) into v_requirement
        from public.state_profession_rules spr
        where spr.profession_id=v_profession_id
          and upper(trim(spr.state_code))=v_state
          and spr.jurisdiction_level='state'
        limit 1;

        v_license_required := v_requirement in ('required','conditional','unverified','local_only');

        insert into public.contractor_profession_qualifications(
          contractor_id,profession_id,state_code,work_role,license_required_at_registration,
          license_number,license_type,issuing_authority,license_expiration_date,license_document_path,
          verification_status,verified_at
        ) values (
          r.contractor_id,v_profession_id,v_state,r.requested_changes->>'work_role',
          v_license_required,null,null,null,null,null,
          case when v_requirement='not_required' then 'not_required' else 'not_submitted' end,
          null
        )
        on conflict(contractor_id,profession_id,state_code) do update set
          work_role=excluded.work_role,
          license_required_at_registration=excluded.license_required_at_registration,
          verification_status=case
            when excluded.license_required_at_registration=false then 'not_required'
            when public.contractor_profession_qualifications.work_role
                 is distinct from excluded.work_role then 'not_submitted'
            when public.contractor_profession_qualifications.verification_status='verified'
              then 'verified'
            else 'not_submitted'
          end,
          verified_at=case
            when public.contractor_profession_qualifications.work_role
                 is distinct from excluded.work_role then null
            when excluded.license_required_at_registration=false then null
            else public.contractor_profession_qualifications.verified_at
          end,
          admin_notes=case
            when public.contractor_profession_qualifications.work_role
                 is distinct from excluded.work_role then null
            else public.contractor_profession_qualifications.admin_notes
          end,
          updated_at=now();
      end loop;

      delete from public.contractor_service_categories where contractor_id=r.contractor_id;
      insert into public.contractor_service_categories(contractor_id,category_id)
      select distinct r.contractor_id,m.category_id
      from public.contractor_profession_qualifications q
      join public.service_category_profession_map m
        on m.profession_id=q.profession_id and m.mapping_status='mapped'
      join public.service_categories sc on sc.id=m.category_id and sc.is_active=true
      where q.contractor_id=r.contractor_id
      on conflict do nothing;
    else
      raise exception 'Unsupported change request type';
    end if;
  end if;

  update public.contractor_change_requests
  set status=case when p_decision='rejected' then 'rejected' else 'approved' end,
      admin_note=nullif(trim(p_admin_note),''),
      reviewed_by=auth.uid(),
      reviewed_at=now()
  where id=p_request_id;
end;
$function$
;

revoke all on function public.review_contractor_change_request(uuid,text,text) from public, anon;
grant execute on function public.review_contractor_change_request(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
