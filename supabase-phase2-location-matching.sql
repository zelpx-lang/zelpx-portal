-- ZELPX Phase 2: US-wide ZIP/coordinate lead matching
-- PREPARED ONLY. Apply to a staging Supabase project after reviewing Phase 1 first.
-- Uses ZIP centroid coordinates (approximate service-area matching), not exact rooftop geocoding.
-- Does not send notifications yet; this migration securely filters which leads a contractor can see/buy.

alter table public.leads
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_latitude double precision,
  add column if not exists service_longitude double precision;

alter table public.service_requests
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_zip_code text,
  add column if not exists service_latitude double precision,
  add column if not exists service_longitude double precision;

create index if not exists leads_service_zip_idx on public.leads (zip_code);
create index if not exists leads_service_state_city_idx on public.leads (service_state, service_city);
create index if not exists contractors_service_zip_idx on public.contractors (service_zip_code);
create index if not exists contractors_service_state_city_idx on public.contractors (service_state, service_city);

-- Haversine distance in miles. ZIP centroid matching is approximate.
create or replace function public.contractor_can_view_lead(p_lead_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_zip text;
  v_city text;
  v_state text;
  v_lat double precision;
  v_lon double precision;
  v_radius integer;
  l record;
  v_distance double precision;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role = 'admin' then
    return true;
  end if;
  if v_role is distinct from 'contractor' then
    return false;
  end if;

  select c.service_zip_code, c.service_city, c.service_state,
         c.service_latitude, c.service_longitude, c.service_radius_miles
    into v_zip, v_city, v_state, v_lat, v_lon, v_radius
  from public.contractors c
  where c.user_id = auth.uid();

  if not found or coalesce(v_radius, 0) < 1 then
    return false;
  end if;

  select x.zip_code, x.service_city, x.service_state,
         x.service_latitude, x.service_longitude
    into l
  from public.leads x
  where x.id = p_lead_id;

  if not found then
    return false;
  end if;

  -- Same ZIP is always a match.
  if nullif(v_zip, '') is not null and v_zip = l.zip_code then
    return true;
  end if;

  -- If both ZIP centroids are available, compare actual geographic distance.
  if v_lat is not null and v_lon is not null
     and l.service_latitude is not null and l.service_longitude is not null then
    v_distance := 3958.7613 * 2 * asin(
      sqrt(
        power(sin(radians(l.service_latitude - v_lat) / 2), 2) +
        cos(radians(v_lat)) * cos(radians(l.service_latitude)) *
        power(sin(radians(l.service_longitude - v_lon) / 2), 2)
      )
    );
    return v_distance <= v_radius;
  end if;

  -- Safe fallback for older records without coordinates: exact city + state only.
  return nullif(v_city, '') is not null
     and nullif(v_state, '') is not null
     and lower(trim(v_city)) = lower(trim(l.service_city))
     and upper(trim(v_state)) = upper(trim(l.service_state));
end;
$function$;

revoke all on function public.contractor_can_view_lead(uuid) from public, anon;
grant execute on function public.contractor_can_view_lead(uuid) to authenticated;

-- Remove the overly broad SELECT policies (permissive policies are OR-combined).
drop policy if exists "Authenticated users can view all lead statuses" on public.leads;
drop policy if exists "Contractors see available lead summaries" on public.leads;

create policy "Contractors see leads in their service area"
on public.leads
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or public.contractor_can_view_lead(id)
);

-- New overload: creates a lead with non-sensitive service-area location data.
create or replace function public.admin_create_lead_with_contact(
  p_service_category text,
  p_zip_code text,
  p_urgency text,
  p_price_cents integer,
  p_description text,
  p_customer_name text,
  p_phone text,
  p_email text,
  p_street_address text,
  p_city text,
  p_state text,
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_lead_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Admin permission required';
  end if;

  if p_price_cents is null or p_price_cents < 1 then
    raise exception 'Invalid lead price';
  end if;
  if coalesce(trim(p_zip_code), '') !~ '^[0-9]{5}(-[0-9]{4})?$'
     or coalesce(trim(p_city), '') = ''
     or coalesce(trim(p_state), '') !~ '^[A-Za-z]{2}$' then
    raise exception 'Valid ZIP code, city and 2-letter state are required';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or (p_latitude is not null and (p_latitude < -90 or p_latitude > 90
       or p_longitude < -180 or p_longitude > 180)) then
    raise exception 'Invalid ZIP centroid coordinates';
  end if;
  if coalesce(trim(p_customer_name), '') = ''
     or coalesce(trim(p_phone), '') = ''
     or coalesce(trim(p_street_address), '') = '' then
    raise exception 'Required customer contact details are missing';
  end if;

  insert into public.leads (
    service_category, zip_code, service_city, service_state,
    service_latitude, service_longitude, urgency, price_cents, description, status
  ) values (
    p_service_category, trim(p_zip_code), trim(p_city), upper(trim(p_state)),
    p_latitude, p_longitude, p_urgency, p_price_cents, p_description, 'available'
  ) returning id into v_lead_id;

  insert into public.lead_contacts (
    lead_id, customer_name, phone, email, street_address, city, state, zip_code
  ) values (
    v_lead_id, p_customer_name, p_phone, p_email,
    p_street_address, trim(p_city), upper(trim(p_state)), trim(p_zip_code)
  );

  return v_lead_id;
end;
$function$;

revoke all on function public.admin_create_lead_with_contact(
  text,text,text,integer,text,text,text,text,text,text,text,double precision,double precision
) from public, anon;
grant execute on function public.admin_create_lead_with_contact(
  text,text,text,integer,text,text,text,text,text,text,text,double precision,double precision
) to authenticated;

-- New overload: publish an existing customer request with ZIP centroid coordinates.
create or replace function public.admin_publish_service_request(
  p_request_id uuid,
  p_zip_code text,
  p_city text,
  p_state text,
  p_urgency text,
  p_price_cents integer,
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.service_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
  v_lead_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Admin permission required';
  end if;
  if p_price_cents is null or p_price_cents < 1 then
    raise exception 'Invalid lead price';
  end if;
  if coalesce(trim(p_zip_code), '') !~ '^[0-9]{5}(-[0-9]{4})?$'
     or coalesce(trim(p_city), '') = ''
     or coalesce(trim(p_state), '') !~ '^[A-Za-z]{2}$'
     or coalesce(trim(p_urgency), '') = '' then
    raise exception 'Valid ZIP code, city, state and urgency are required';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or (p_latitude is not null and (p_latitude < -90 or p_latitude > 90
       or p_longitude < -180 or p_longitude > 180)) then
    raise exception 'Invalid ZIP centroid coordinates';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Service request not found'; end if;
  if v_request.lead_id is not null then raise exception 'This request has already been published'; end if;
  if v_request.status <> 'new' then raise exception 'Only new requests can be published'; end if;

  select * into v_profile
  from public.profiles
  where id = v_request.user_id;
  if not found then raise exception 'Customer profile not found'; end if;
  if coalesce(trim(v_profile.full_name), '') = ''
     or coalesce(trim(v_profile.phone), '') = ''
     or coalesce(trim(v_request.property_address), '') = '' then
    raise exception 'Customer name, phone and address are required';
  end if;

  select email into v_email from auth.users where id = v_request.user_id;

  insert into public.leads (
    service_category, zip_code, service_city, service_state,
    service_latitude, service_longitude, urgency, price_cents, description, status
  ) values (
    v_request.service_type, trim(p_zip_code), trim(p_city), upper(trim(p_state)),
    p_latitude, p_longitude, trim(p_urgency), p_price_cents, v_request.description, 'available'
  ) returning id into v_lead_id;

  insert into public.lead_contacts (
    lead_id, customer_name, phone, email, street_address, city, state, zip_code
  ) values (
    v_lead_id, v_profile.full_name, v_profile.phone, v_email,
    v_request.property_address, trim(p_city), upper(trim(p_state)), trim(p_zip_code)
  );

  update public.service_requests
  set lead_id = v_lead_id, price = p_price_cents::numeric / 100, status = 'published'
  where id = p_request_id;

  return v_lead_id;
end;
$function$;

revoke all on function public.admin_publish_service_request(
  uuid,text,text,text,text,integer,double precision,double precision
) from public, anon;
grant execute on function public.admin_publish_service_request(
  uuid,text,text,text,text,integer,double precision,double precision
) to authenticated;

-- Enforce location matching at purchase time as well as in SELECT/RLS.
create or replace function public.buy_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contractor_id uuid;
  v_verification_status text;
  v_wallet_id uuid;
  v_balance integer;
  v_price integer;
  v_status text;
  v_purchase_id uuid;
begin
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Administrators cannot purchase leads.';
  end if;

  select id, verification_status
    into v_contractor_id, v_verification_status
  from public.contractors
  where user_id = auth.uid();

  if v_contractor_id is null then raise exception 'Contractor account not found'; end if;
  if v_verification_status is distinct from 'verified' then
    raise exception 'Your contractor account must be verified before purchasing leads.';
  end if;
  if not public.contractor_can_view_lead(p_lead_id) then
    raise exception 'This lead is outside your registered service area.';
  end if;

  select price_cents, status into v_price, v_status
  from public.leads where id = p_lead_id for update;
  if not found or v_status <> 'available' then
    raise exception 'Lead is no longer available';
  end if;
  if not exists (select 1 from public.lead_contacts where lead_id = p_lead_id) then
    raise exception 'Lead contact details are not available';
  end if;

  select id, balance_cents into v_wallet_id, v_balance
  from public.credit_wallets where contractor_id = v_contractor_id for update;
  if v_wallet_id is null then raise exception 'Wallet not found'; end if;
  if v_balance < v_price then raise exception 'Insufficient credits'; end if;

  update public.credit_wallets
  set balance_cents = balance_cents - v_price, updated_at = now()
  where id = v_wallet_id;

  insert into public.lead_purchases (lead_id, contractor_id, price_cents)
  values (p_lead_id, v_contractor_id, v_price)
  returning id into v_purchase_id;

  update public.leads set status = 'sold' where id = p_lead_id;

  insert into public.credit_transactions (wallet_id, amount_cents, transaction_type, description)
  values (v_wallet_id, -v_price, 'purchase', 'Lead purchase');

  return jsonb_build_object('success', true, 'purchase_id', v_purchase_id, 'price_cents', v_price);
end;
$function$;

revoke all on function public.buy_lead(uuid) from public, anon;
grant execute on function public.buy_lead(uuid) to authenticated;

-- Existing leads created before this migration are not auto-geocoded.
-- Until coordinates are populated, matching falls back to exact ZIP or exact city+state.
-- ZIP coordinates are centroids, so radius is approximate. Add a trusted ZIP centroid dataset
-- or geocoding provider before treating this as precision dispatch.
