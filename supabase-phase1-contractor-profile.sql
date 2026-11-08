-- ZELPX Phase 1: contractor service location and license profile
-- PREPARED ONLY. Review and apply to a staging Supabase project first.
-- This migration is additive; it does not delete or rewrite existing rows.

alter table public.contractors
  add column if not exists service_address text,
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_zip_code text,
  add column if not exists service_radius_miles integer not null default 25,
  add column if not exists service_latitude double precision,
  add column if not exists service_longitude double precision,
  add column if not exists has_license boolean,
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists license_type text,
  add column if not exists license_document_path text,
  add column if not exists license_review_status text not null default 'not_submitted';

alter table public.contractors
  drop constraint if exists contractors_service_radius_miles_check;
alter table public.contractors
  add constraint contractors_service_radius_miles_check
  check (service_radius_miles between 1 and 250);

alter table public.contractors
  drop constraint if exists contractors_license_review_status_check;
alter table public.contractors
  add constraint contractors_license_review_status_check
  check (license_review_status in ('not_submitted','pending','verified','rejected','not_applicable'));

-- A private bucket; files are stored under {auth.uid()}/{filename}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contractor-licenses', 'contractor-licenses', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Contractors upload own license documents" on storage.objects;
create policy "Contractors upload own license documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'contractor-licenses'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Contractors read own license documents" on storage.objects;
create policy "Contractors read own license documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'contractor-licenses'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "Contractors replace own license documents" on storage.objects;
create policy "Contractors replace own license documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'contractor-licenses'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'contractor-licenses'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Extend the existing signup trigger so registration details are saved
-- when Supabase creates the contractor row.
create or replace function public.create_contractor_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_meta jsonb;
begin
  if new.role = 'contractor' then
    select coalesce(raw_user_meta_data, '{}'::jsonb)
      into v_meta
      from auth.users
      where id = new.id;

    insert into public.contractors (
      user_id, company_name, email,
      service_address, service_city, service_state, service_zip_code,
      service_radius_miles, service_latitude, service_longitude,
      has_license, license_number, license_state, license_type,
      license_review_status
    )
    values (
      new.id,
      coalesce(nullif(v_meta->>'company_name',''), nullif(new.full_name,''), 'New company'),
      (select email from auth.users where id = new.id),
      nullif(v_meta->>'service_address',''),
      nullif(v_meta->>'service_city',''),
      nullif(upper(v_meta->>'service_state'),''),
      nullif(v_meta->>'service_zip_code',''),
      coalesce(nullif(v_meta->>'service_radius_miles','')::integer, 25),
      nullif(v_meta->>'service_latitude','')::double precision,
      nullif(v_meta->>'service_longitude','')::double precision,
      case when v_meta ? 'has_license' then (v_meta->>'has_license')::boolean else null end,
      nullif(v_meta->>'license_number',''),
      nullif(upper(v_meta->>'license_state'),''),
      nullif(v_meta->>'license_type',''),
      case
        when v_meta->>'has_license' = 'true' then 'pending'
        when v_meta->>'has_license' = 'false' then 'not_applicable'
        else 'not_submitted'
      end
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$function$;

-- Intentionally no lead-distribution changes in Phase 1.
-- ZIP/coordinate-based lead matching is a separate Phase 2 migration.
