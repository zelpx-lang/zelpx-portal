-- Store server-confirmed customer phone verification state.
-- The SMS code itself is handled by Twilio Verify and is never stored by ZELPX.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verified_number text;

comment on column public.profiles.phone_verified_at is
  'Server timestamp when the current profile phone number was successfully verified by SMS.';
comment on column public.profiles.phone_verified_number is
  'E.164 phone number verified by SMS; must match profiles.phone to count as verified.';
