-- Store server-confirmed customer phone verification state.
create schema if not exists private;
-- The SMS code itself is handled by Twilio Verify and is never stored by ZELPX.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verified_number text;

comment on column public.profiles.phone_verified_at is
  'Server timestamp when the current profile phone number was successfully verified by SMS.';
comment on column public.profiles.phone_verified_number is
  'E.164 phone number verified by SMS; must match profiles.phone to count as verified.';


-- A browser-side check is only UX. Enforce the SMS proof in PostgreSQL too:
-- the trusted request-confirmation RPC cannot mark a request verified unless
-- the authenticated customer's current profile phone was verified by SMS.
create or replace function private.require_verified_customer_phone()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
begin
  if new.customer_live_confirmed_at is not null
     and (
       new.customer_live_confirmation_version is null
       or not exists (
         select 1
         from public.profiles p
         where p.id = new.user_id
           and p.phone_verified_at is not null
           and p.phone_verified_number is not null
           and p.phone_verified_number = p.phone
       )
     ) then
    raise exception 'Verify your current phone number by SMS before confirming this service request.';
  end if;
  return new;
end;
$function$;

drop trigger if exists service_request_require_verified_phone on public.service_requests;
create trigger service_request_require_verified_phone
before update of customer_live_confirmed_at
on public.service_requests
for each row
execute function private.require_verified_customer_phone();
