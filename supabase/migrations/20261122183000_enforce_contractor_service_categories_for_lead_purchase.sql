create or replace function public.buy_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_contractor_id uuid;
  v_radius integer;
  v_home_lat double precision;
  v_home_lon double precision;
  v_home_zip text;
  v_lead_lat double precision;
  v_lead_lon double precision;
  v_lead_zip text;
  v_lead_category text;
  v_lead_type text;
  v_category_id uuid;
  v_wallet_id uuid;
  v_balance integer;
  v_price integer;
  v_status text;
  v_purchase_id uuid;
  v_state text;
  v_lead_state text;
  v_account_status text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Administrators cannot purchase leads.';
  end if;

  select id,service_radius_miles,service_latitude,service_longitude,
         left(regexp_replace(coalesce(service_zip_code,''),'[^0-9]','','g'),5),
         upper(coalesce(service_state,'')),verification_status
    into v_contractor_id,v_radius,v_home_lat,v_home_lon,v_home_zip,v_state,v_account_status
  from public.contractors where user_id=auth.uid() for update;

  if v_contractor_id is null then raise exception 'Contractor account not found'; end if;
  if v_account_status is distinct from 'verified' then
    raise exception 'Your contractor account must be approved before purchasing leads.';
  end if;

  select l.price_cents,l.status,l.service_latitude,l.service_longitude,
         left(regexp_replace(coalesce(l.zip_code,''),'[^0-9]','','g'),5),
         l.service_category,l.lead_type,sc.id,upper(coalesce(l.service_state,''))
    into v_price,v_status,v_lead_lat,v_lead_lon,v_lead_zip,v_lead_category,v_lead_type,v_category_id,v_lead_state
  from public.leads l
  left join public.service_categories sc
    on lower(trim(sc.name))=lower(trim(l.service_category)) and sc.is_active=true
  where l.id=p_lead_id for update of l;

  if not found or v_status<>'available' then raise exception 'Lead is no longer available'; end if;
  if v_lead_type is distinct from 'lead_package' and v_category_id is null then
    raise exception 'This lead has an invalid or inactive service category. Please contact support.';
  end if;

  -- Ordinary leads can only be purchased in a service category approved
  -- for this contractor. Multi-service packages are intentionally global.
  if v_lead_type is distinct from 'lead_package' and not exists (
    select 1
    from public.contractor_service_categories csc
    join public.service_categories sc on sc.id = csc.category_id and sc.is_active = true
    where csc.contractor_id = v_contractor_id
      and lower(trim(sc.name)) = lower(trim(v_lead_category))
  ) then
    raise exception 'This lead is outside your approved service categories.';
  end if;

  -- Any verified contractor can purchase any available regular lead or multi-service package.
  -- Service-category selections are not a purchase restriction.
  if v_state !~ '^[A-Z]{2}$' then raise exception 'Set a valid business state before purchasing leads.'; end if;
  if v_lead_state !~ '^[A-Z]{2}$' then raise exception 'The job state is missing or invalid. This lead cannot be purchased.'; end if;

  if v_home_zip is distinct from v_lead_zip then
    if v_home_lat is null or v_home_lon is null or v_lead_lat is null or v_lead_lon is null
       or v_radius is null or v_radius<1
       or 3958.7613*2*asin(sqrt(least(1::double precision,
          power(sin(radians(v_lead_lat-v_home_lat)/2),2)
          +cos(radians(v_home_lat))*cos(radians(v_lead_lat))
          *power(sin(radians(v_lead_lon-v_home_lon)/2),2))))>v_radius then
      raise exception 'This lead is outside your service radius';
    end if;
  end if;

  if not exists(select 1 from public.lead_contacts where lead_id=p_lead_id) then
    raise exception 'Lead contact details are not available'; end if;
  select id,balance_cents into v_wallet_id,v_balance
  from public.credit_wallets where contractor_id=v_contractor_id for update;
  if v_wallet_id is null then raise exception 'Wallet not found'; end if;
  if v_price is null or v_price<=0 then raise exception 'Invalid lead price'; end if;
  if v_balance<v_price then raise exception 'Insufficient credits'; end if;

  update public.credit_wallets set balance_cents=balance_cents-v_price,updated_at=now()
  where id=v_wallet_id;
  insert into public.lead_purchases(lead_id,contractor_id,price_cents)
  values(p_lead_id,v_contractor_id,v_price) returning id into v_purchase_id;
  update public.leads set status='sold' where id=p_lead_id;
  insert into public.credit_transactions(wallet_id,amount_cents,transaction_type,description)
  values(v_wallet_id,-v_price,'purchase',
    'Lead purchase | Purchase ID: '||v_purchase_id::text||' | Lead ID: '||p_lead_id::text);

  return jsonb_build_object('success',true,'purchase_id',v_purchase_id,'lead_id',p_lead_id,'price_cents',v_price);
end;
$function$;

revoke execute on function public.buy_lead(uuid) from public, anon;
grant execute on function public.buy_lead(uuid) to authenticated;
