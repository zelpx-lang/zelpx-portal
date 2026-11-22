-- Customer SMS phone verification. Additive and fail-closed.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verified_number text;

create schema if not exists private;

create or replace function private.guard_profile_phone_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );

  if tg_op = 'INSERT' then
    if (new.phone_verified_at is not null or new.phone_verified_number is not null)
       and v_role <> 'service_role' then
      raise exception 'Phone verification can only be set by the verification service.';
    end if;
  else
    if (new.phone_verified_at is distinct from old.phone_verified_at
        or new.phone_verified_number is distinct from old.phone_verified_number)
       and v_role <> 'service_role' then
      raise exception 'Phone verification can only be set by the verification service.';
    end if;

    -- Any user-initiated phone change invalidates the previous verification.
    if new.phone is distinct from old.phone and v_role <> 'service_role' then
      new.phone_verified_at := null;
      new.phone_verified_number := null;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_guard_phone_verification on public.profiles;
create trigger profiles_guard_phone_verification
before insert or update of phone, phone_verified_at, phone_verified_number
on public.profiles
for each row execute function private.guard_profile_phone_verification();

create or replace function private.require_verified_customer_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.customer_live_confirmed_at is distinct from old.customer_live_confirmed_at
     and new.customer_live_confirmed_at is not null
     and not exists (
       select 1
       from public.profiles p
       where p.id = new.user_id
         and p.phone is not null
         and p.phone_verified_at is not null
         and p.phone_verified_number = p.phone
     ) then
    raise exception 'Verify your phone number by SMS before submitting a service request.';
  end if;
  return new;
end;
$function$;

drop trigger if exists service_request_require_verified_phone on public.service_requests;
create trigger service_request_require_verified_phone
before update of customer_live_confirmed_at on public.service_requests
for each row execute function private.require_verified_customer_phone();

-- Keep the existing email-confirmation and commercial-consent rules, and add the SMS requirement.
create or replace function public.confirm_own_service_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_email_confirmed boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select (u.email_confirmed_at is not null)
    into v_user_email_confirmed
  from auth.users u
  where u.id = auth.uid();

  if not coalesce(v_user_email_confirmed, false) then
    raise exception 'Verify your email before confirming this service request.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.phone is not null
      and p.phone_verified_at is not null
      and p.phone_verified_number = p.phone
  ) then
    raise exception 'Verify your phone number by SMS before submitting a service request.';
  end if;

  update public.service_requests
  set customer_live_confirmed_at = now(),
      customer_live_confirmation_version = '2026-11-22-v1'
  where id = p_request_id
    and user_id = auth.uid()
    and status = 'new'
    and lead_id is null
    and commercial_sharing_consent_at is not null
    and coalesce(trim(commercial_sharing_consent_version), '') <> '';

  if not found then
    raise exception 'Request not found, already processed, or commercial sharing consent is missing.';
  end if;

  return jsonb_build_object('success', true, 'confirmed_at', now());
end;
$function$;

revoke all on function private.guard_profile_phone_verification() from public, anon, authenticated;
revoke all on function private.require_verified_customer_phone() from public, anon, authenticated;
revoke all on function public.confirm_own_service_request(uuid) from public, anon;
grant execute on function public.confirm_own_service_request(uuid) to authenticated;
