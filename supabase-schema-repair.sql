-- ZELPX additive schema repair for the currently deployed portal
-- Resolves missing location columns reported by the customer request form.
-- Safe pattern: ADD COLUMN IF NOT EXISTS; no rows are deleted or rewritten.
-- Review and back up the project before applying in Supabase SQL Editor.

begin;

-- Customer service request location fields (the screenshot's exact failure).
alter table public.service_requests
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_zip_code text,
  add column if not exists service_latitude double precision,
  add column if not exists service_longitude double precision;

-- Lead location fields used by the geographic matching code.
alter table public.leads
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_latitude double precision,
  add column if not exists service_longitude double precision;

-- Contractor location, license and notification fields requested by the portal.
alter table public.contractors
  add column if not exists service_address text,
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_zip_code text,
  add column if not exists service_radius_miles integer not null default 25,
  add column if not exists service_latitude double precision,
  add column if not exists service_longitude double precision,
  add column if not exists has_license boolean not null default false,
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists license_type text,
  add column if not exists license_document_path text,
  add column if not exists lead_email_notifications boolean not null default true;

create index if not exists service_requests_service_zip_idx
  on public.service_requests (service_zip_code);
create index if not exists service_requests_service_state_city_idx
  on public.service_requests (service_state, service_city);
create index if not exists leads_service_zip_idx
  on public.leads (zip_code);
create index if not exists leads_service_state_city_idx
  on public.leads (service_state, service_city);
create index if not exists contractors_service_zip_idx
  on public.contractors (service_zip_code);
create index if not exists contractors_service_state_city_idx
  on public.contractors (service_state, service_city);

commit;

-- Refresh PostgREST's schema cache so the new columns are visible immediately.
notify pgrst, 'reload schema';
