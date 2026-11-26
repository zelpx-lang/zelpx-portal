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
    v_changes := v_changes - 'service_radius_miles' - 'additional_state_licenses' - 'has_insurance_certificate';
    if v_changes ? 'company_name' and nullif(btrim(v_changes->>'company_name'), '') is null then
      raise exception 'Company name is required and cannot be cleared';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_changes) as keys(key)
      where key not in (
        'full_name','phone','avatar_url','company_name','email',
        'service_address','service_city','service_state','service_zip_code',
        'service_latitude','service_longitude','lead_email_notifications',
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
create or replace function public.review_contractor_change_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  r public.contractor_change_requests%rowtype;
  v_item jsonb;
  v_categories jsonb;
  v_professions jsonb;
  v_previous jsonb;
  v_after jsonb;
  v_license_route boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then raise exception 'Administrator access required'; end if;

  if p_decision not in ('approved_with_license','approved_without_license','rejected') then
    raise exception 'Choose approval with license, approval without license, or rejection';
  end if;

  select * into r
  from public.contractor_change_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Change request not found'; end if;
  if r.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  v_license_route := p_decision = 'approved_with_license';

  if p_decision <> 'rejected' then
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_categories
    from (
      select sc.id, sc.name, csc.category_id
      from public.contractor_service_categories csc
      join public.service_categories sc on sc.id = csc.category_id
      where csc.contractor_id = r.contractor_id
      order by sc.name
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_professions
    from (
      select q.*
      from public.contractor_profession_qualifications q
      where q.contractor_id = r.contractor_id
      order by q.state_code, q.profession_id
    ) x;

    select jsonb_build_object(
      'profile', to_jsonb(p),
      'contractor', to_jsonb(c),
      'service_categories', v_categories,
      'profession_qualifications', v_professions
    )
    into v_previous
    from public.profiles p
    join public.contractors c on c.user_id = p.id
    where p.id = r.user_id and c.id = r.contractor_id;

    if r.request_type = 'company_profile' then
      if v_license_route and (
        coalesce(nullif(r.requested_changes->>'license_number',''),
                 (select license_number from public.contractors where id=r.contractor_id),'') = ''
        or coalesce(nullif(r.requested_changes->>'license_document_path',''),
                    (select license_document_path from public.contractors where id=r.contractor_id),'') = ''
      ) then
        raise exception 'Cannot approve with license: license number and uploaded license document are required';
      end if;

      update public.profiles
      set full_name = case when r.requested_changes ? 'full_name'
                           then nullif(r.requested_changes->>'full_name','') else full_name end,
          phone = case when r.requested_changes ? 'phone'
                       then nullif(r.requested_changes->>'phone','') else phone end,
          avatar_url = case when r.requested_changes ? 'avatar_url'
                            then nullif(r.requested_changes->>'avatar_url','') else avatar_url end
      where id = r.user_id;

      update public.contractors
      set company_name = case when r.requested_changes ? 'company_name'
                              then nullif(r.requested_changes->>'company_name','') else company_name end,
          email = case when r.requested_changes ? 'email'
                       then nullif(r.requested_changes->>'email','') else email end,
          service_address = case when r.requested_changes ? 'service_address'
                                 then nullif(r.requested_changes->>'service_address','') else service_address end,
          service_city = case when r.requested_changes ? 'service_city'
                              then nullif(r.requested_changes->>'service_city','') else service_city end,
          service_state = case when r.requested_changes ? 'service_state'
                               then upper(nullif(r.requested_changes->>'service_state','')) else service_state end,
          service_zip_code = case when r.requested_changes ? 'service_zip_code'
                                  then nullif(r.requested_changes->>'service_zip_code','') else service_zip_code end,
          service_latitude = case when r.requested_changes ? 'service_latitude'
                                  then nullif(r.requested_changes->>'service_latitude','null')::double precision else service_latitude end,
          service_longitude = case when r.requested_changes ? 'service_longitude'
                                   then nullif(r.requested_changes->>'service_longitude','null')::double precision else service_longitude end,
          has_license = v_license_route,
          license_number = case when not v_license_route then null
                                when r.requested_changes ? 'license_number' then nullif(r.requested_changes->>'license_number','')
                                else license_number end,
          license_state = case when not v_license_route then null
                               when r.requested_changes ? 'license_state' then upper(nullif(r.requested_changes->>'license_state',''))
                               else license_state end,
          license_type = case when not v_license_route then null
                              when r.requested_changes ? 'license_type' then nullif(r.requested_changes->>'license_type','')
                              else license_type end,
          license_document_path = case when not v_license_route then null
                                        when r.requested_changes ? 'license_document_path' then nullif(r.requested_changes->>'license_document_path','')
                                        else license_document_path end,
          license_review_status = case when v_license_route then 'approved' else 'not_applicable' end,
          insurance_policy_number = case when r.requested_changes ? 'insurance_policy_number'
                                         then nullif(r.requested_changes->>'insurance_policy_number','') else insurance_policy_number end,
          insurance_expiration_date = case when r.requested_changes ? 'insurance_expiration_date'
                                           then nullif(r.requested_changes->>'insurance_expiration_date','')::date else insurance_expiration_date end,
          insurance_document_path = case when r.requested_changes ? 'insurance_document_path'
                                         then nullif(r.requested_changes->>'insurance_document_path','') else insurance_document_path end,
          insurance_review_status = case
            when r.requested_changes ? 'insurance_document_path'
              or r.requested_changes ? 'insurance_policy_number'
              or r.requested_changes ? 'insurance_expiration_date' then 'approved'
            else insurance_review_status end,
          lead_email_notifications = case when r.requested_changes ? 'lead_email_notifications'
                                           then (r.requested_changes->>'lead_email_notifications')::boolean
                                           else lead_email_notifications end,
          verification_status = 'verified'
      where id = r.contractor_id;

    elsif r.request_type = 'service_categories' then
      if jsonb_typeof(r.requested_changes->'category_ids') is distinct from 'array' then
        raise exception 'Invalid category list';
      end if;
      delete from public.contractor_service_categories
      where contractor_id = r.contractor_id;
      insert into public.contractor_service_categories(contractor_id,category_id)
      select r.contractor_id, value::uuid
      from jsonb_array_elements_text(r.requested_changes->'category_ids') as x(value);
      -- A category-only request must not change the contractor's license status.

    elsif r.request_type = 'profession_qualifications' then
      if jsonb_typeof(r.requested_changes->'items') is distinct from 'array' then
        raise exception 'Invalid profession list';
      end if;

      if v_license_route and exists (
        select 1
        from jsonb_array_elements(r.requested_changes->'items') x(value)
        where coalesce((value->>'license_required_at_registration')::boolean,false)
          and (coalesce(value->>'license_number','') = ''
               or coalesce(value->>'license_document_path','') = '')
      ) then
        raise exception 'Cannot approve with license: each licensed profession needs a license number and document';
      end if;

      delete from public.contractor_profession_qualifications
      where contractor_id = r.contractor_id
        and state_code = upper(r.requested_changes->>'state_code');

      for v_item in
        select value from jsonb_array_elements(r.requested_changes->'items')
      loop
        insert into public.contractor_profession_qualifications(
          contractor_id,profession_id,state_code,work_role,
          license_required_at_registration,license_number,license_type,
          issuing_authority,license_expiration_date,license_document_path,
          verification_status,verified_at
        )
        values (
          r.contractor_id,(v_item->>'profession_id')::uuid,
          upper(r.requested_changes->>'state_code'),
          r.requested_changes->>'work_role',
          coalesce((v_item->>'license_required_at_registration')::boolean,false),
          nullif(v_item->>'license_number',''),
          nullif(v_item->>'license_type',''),
          nullif(v_item->>'issuing_authority',''),
          nullif(v_item->>'license_expiration_date','')::date,
          nullif(v_item->>'license_document_path',''),
          case when v_license_route then 'verified'
               when coalesce((v_item->>'license_required_at_registration')::boolean,false) then 'not_submitted'
               else 'not_required' end,
          case when v_license_route then now() else null end
        );
      end loop;

      -- Rebuild active service categories from the complete approved profession
      -- set across every state. Do not leave stale categories and do not erase
      -- approved work from another state when one state's qualifications change.
      delete from public.contractor_service_categories
      where contractor_id = r.contractor_id;
      insert into public.contractor_service_categories(contractor_id,category_id)
      select distinct r.contractor_id,m.category_id
      from public.contractor_profession_qualifications q
      join public.service_category_profession_map m
        on m.profession_id = q.profession_id and m.mapping_status = 'mapped'
      join public.service_categories sc on sc.id = m.category_id and sc.is_active = true
      where q.contractor_id = r.contractor_id
      on conflict do nothing;

      update public.contractors
      set has_license = v_license_route,
          license_review_status = case when v_license_route then 'approved' else 'not_applicable' end,
          verification_status = 'verified'
      where id = r.contractor_id;
    end if;

    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_categories
    from (
      select sc.id, sc.name, csc.category_id
      from public.contractor_service_categories csc
      join public.service_categories sc on sc.id = csc.category_id
      where csc.contractor_id = r.contractor_id
      order by sc.name
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_professions
    from (
      select q.*
      from public.contractor_profession_qualifications q
      where q.contractor_id = r.contractor_id
      order by q.state_code, q.profession_id
    ) x;

    select jsonb_build_object(
      'profile', (select to_jsonb(p) from public.profiles p where p.id = r.user_id),
      'contractor', (select to_jsonb(c) from public.contractors c where c.id = r.contractor_id),
      'service_categories', v_categories,
      'profession_qualifications', v_professions
    ) into v_after;

    insert into public.contractor_profile_history(
      contractor_id,user_id,change_request_id,request_type,
      previous_data,approved_data,reviewed_by
    )
    values (
      r.contractor_id,r.user_id,r.id,r.request_type,
      coalesce(v_previous,'{}'::jsonb),coalesce(v_after,'{}'::jsonb),auth.uid()
    )
    on conflict (change_request_id) do nothing;
  end if;

  update public.contractor_change_requests
  set status = case when p_decision = 'rejected' then 'rejected' else 'approved' end,
      admin_note = nullif(trim(p_admin_note),''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;
end
$function$;

revoke all on function public.review_contractor_change_request(uuid,text,text) from public, anon;
grant execute on function public.review_contractor_change_request(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
