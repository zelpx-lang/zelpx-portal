create or replace function public.zelpx_can_view_lead(p_lead_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_contractor_id uuid;
  v_account_status text;
  v_home_zip text;
  v_home_lat double precision;
  v_home_lon double precision;
  v_radius integer;
  v_lead_zip text;
  v_lead_lat double precision;
  v_lead_lon double precision;
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then return true; end if;
  select c.id,c.verification_status,
         left(regexp_replace(coalesce(c.service_zip_code,''),'[^0-9]','','g'),5),
         c.service_latitude,c.service_longitude,c.service_radius_miles
    into v_contractor_id,v_account_status,v_home_zip,v_home_lat,v_home_lon,v_radius
  from public.contractors c where c.user_id=auth.uid();
  if v_contractor_id is null or v_account_status is distinct from 'verified' then return false; end if;
  -- Category selection does not limit marketplace visibility. Keep the service-area check.
  select left(regexp_replace(coalesce(l.zip_code,''),'[^0-9]','','g'),5),
         l.service_latitude,l.service_longitude
    into v_lead_zip,v_lead_lat,v_lead_lon
  from public.leads l where l.id=p_lead_id and l.status='available';
  if not found then return false; end if;
  if v_home_zip is distinct from v_lead_zip then
    if v_home_lat is null or v_home_lon is null or v_lead_lat is null or v_lead_lon is null
       or v_radius is null or v_radius<1 then return false; end if;
    if 3958.7613*2*asin(sqrt(least(1::double precision,
       power(sin(radians(v_lead_lat-v_home_lat)/2),2)
       +cos(radians(v_home_lat))*cos(radians(v_lead_lat))
       *power(sin(radians(v_lead_lon-v_home_lon)/2),2))))>v_radius then
      return false;
    end if;
  end if;
  return true;
end;
$function$;