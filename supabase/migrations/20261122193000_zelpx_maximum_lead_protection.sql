-- ZELPX Maximum Lead Protection: additive, backwards-compatible foundation.
-- Existing requests are grandfathered; new requests require live customer confirmation.
alter table public.service_requests
  add column if not exists customer_live_confirmed_at timestamptz,
  add column if not exists customer_live_confirmation_version text,
  add column if not exists protection_required boolean;
update public.service_requests set protection_required=false where protection_required is null;
alter table public.service_requests alter column protection_required set default true;
alter table public.service_requests alter column protection_required set not null;

create table if not exists public.lead_contact_attempts (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null references public.lead_purchases(id) on delete restrict,
 lead_id uuid not null references public.leads(id) on delete restrict,
 contractor_id uuid not null references public.contractors(id) on delete restrict,
 channel text not null check(channel in ('call','sms','email','chat')),
 outcome text not null check(outcome in ('no_answer','connected','invalid_number','wrong_person','customer_denied_request','voicemail','message_sent','other')),
 notes text,
 created_at timestamptz not null default now()
);
create index if not exists lead_contact_attempts_purchase_created_idx on public.lead_contact_attempts(purchase_id,created_at desc);

create table if not exists public.lead_protection_claims (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null unique references public.lead_purchases(id) on delete restrict,
 lead_id uuid not null references public.leads(id) on delete restrict,
 contractor_id uuid not null references public.contractors(id) on delete restrict,
 reason text not null check(reason in ('invalid_phone','customer_denies_request','wrong_person','duplicate_lead','fake_customer','false_service_request','unable_to_reach','other')),
 details text,
 status text not null default 'open' check(status in ('open','under_review','refund_approved','refund_rejected','refunded')),
 admin_note text,
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 refund_transaction_id uuid unique references public.credit_transactions(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index if not exists lead_protection_claims_status_created_idx on public.lead_protection_claims(status,created_at desc);

create table if not exists public.lead_appointments (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null unique references public.lead_purchases(id) on delete restrict,
 scheduled_at timestamptz not null,
 timezone text not null,
 contractor_confirmed_at timestamptz not null default now(),
 customer_confirmed_at timestamptz,
 status text not null default 'proposed' check(status in ('proposed','confirmed','cancelled','completed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists lead_appointments_scheduled_idx on public.lead_appointments(scheduled_at);

alter table public.lead_contact_attempts enable row level security;
alter table public.lead_protection_claims enable row level security;
alter table public.lead_appointments enable row level security;

drop policy if exists "Contractors read own lead contact attempts" on public.lead_contact_attempts;
create policy "Contractors read own lead contact attempts" on public.lead_contact_attempts
 for select to authenticated using (exists(select 1 from public.contractors c where c.id=contractor_id and c.user_id=(select auth.uid())));

drop policy if exists "Contractors read own protection claims" on public.lead_protection_claims;
create policy "Contractors read own protection claims" on public.lead_protection_claims
 for select to authenticated using (exists(select 1 from public.contractors c where c.id=contractor_id and c.user_id=(select auth.uid())));
drop policy if exists "Admins read all protection claims" on public.lead_protection_claims;
create policy "Admins read all protection claims" on public.lead_protection_claims
 for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists "Participants read lead appointments" on public.lead_appointments;
create policy "Participants read lead appointments" on public.lead_appointments
 for select to authenticated using (
  exists(select 1 from public.lead_purchases lp join public.contractors c on c.id=lp.contractor_id where lp.id=purchase_id and c.user_id=(select auth.uid()))
  or exists(select 1 from public.lead_purchases lp join public.service_requests sr on sr.lead_id=lp.lead_id where lp.id=purchase_id and sr.user_id=(select auth.uid()))
 );

revoke all on public.lead_contact_attempts,public.lead_protection_claims,public.lead_appointments from anon,authenticated;
grant select on public.lead_contact_attempts,public.lead_protection_claims,public.lead_appointments to authenticated;

create or replace function public.submit_lead_protection_claim(p_purchase_id uuid,p_reason text,p_details text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_purchase public.lead_purchases%rowtype; v_claim_id uuid;
begin
 if auth.uid() is null then raise exception 'You must be signed in.'; end if;
 if p_reason not in ('invalid_phone','customer_denies_request','wrong_person','duplicate_lead','fake_customer','false_service_request','unable_to_reach','other') then raise exception 'Choose a valid claim reason.'; end if;
 select lp.* into v_purchase from public.lead_purchases lp join public.contractors c on c.id=lp.contractor_id
 where lp.id=p_purchase_id and c.user_id=auth.uid() for update of lp;
 if not found then raise exception 'Purchased lead not found for this contractor.'; end if;
 if v_purchase.purchased_at < now()-interval '7 days' then raise exception 'The 7-day lead protection claim period has expired.'; end if;
 insert into public.lead_protection_claims(purchase_id,lead_id,contractor_id,reason,details)
 values(v_purchase.id,v_purchase.lead_id,v_purchase.contractor_id,p_reason,left(coalesce(p_details,''),2000))
 returning id into v_claim_id;
 return v_claim_id;
end;
$function$;

create or replace function public.log_lead_contact_attempt(p_purchase_id uuid,p_channel text,p_outcome text,p_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'You must be signed in.'; end if;
 if p_channel not in ('call','sms','email','chat') or p_outcome not in ('no_answer','connected','invalid_number','wrong_person','customer_denied_request','voicemail','message_sent','other') then raise exception 'Invalid contact attempt type.'; end if;
 insert into public.lead_contact_attempts(purchase_id,lead_id,contractor_id,channel,outcome,notes)
 select lp.id,lp.lead_id,lp.contractor_id,p_channel,p_outcome,left(coalesce(p_notes,''),1000)
 from public.lead_purchases lp join public.contractors c on c.id=lp.contractor_id
 where lp.id=p_purchase_id and c.user_id=auth.uid() returning id into v_id;
 if v_id is null then raise exception 'Purchased lead not found for this contractor.'; end if;
 return v_id;
end;
$function$;

create or replace function public.propose_lead_appointment(p_purchase_id uuid,p_scheduled_at timestamptz,p_timezone text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'You must be signed in.'; end if;
 if p_scheduled_at is null or p_scheduled_at<=now() or coalesce(trim(p_timezone),'')='' then raise exception 'Choose a future appointment time and timezone.'; end if;
 if not exists(select 1 from public.lead_purchases lp join public.contractors c on c.id=lp.contractor_id where lp.id=p_purchase_id and c.user_id=auth.uid()) then raise exception 'Purchased lead not found for this contractor.'; end if;
 insert into public.lead_appointments(purchase_id,scheduled_at,timezone)
 values(p_purchase_id,p_scheduled_at,trim(p_timezone))
 on conflict(purchase_id) do update set scheduled_at=excluded.scheduled_at,timezone=excluded.timezone,contractor_confirmed_at=now(),customer_confirmed_at=null,status='proposed',updated_at=now()
 returning id into v_id;
 return v_id;
end;
$function$;

create or replace function public.confirm_lead_appointment(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_customer_id uuid;
begin
 if auth.uid() is null then raise exception 'You must be signed in.'; end if;
 select sr.user_id into v_customer_id from public.lead_appointments la
 join public.lead_purchases lp on lp.id=la.purchase_id join public.service_requests sr on sr.lead_id=lp.lead_id
 where la.id=p_appointment_id for update of la;
 if not found or v_customer_id<>auth.uid() then raise exception 'Appointment not found for this customer.'; end if;
 update public.lead_appointments set customer_confirmed_at=now(),status='confirmed',updated_at=now() where id=p_appointment_id;
 return jsonb_build_object('success',true,'status','confirmed');
end;
$function$;

create or replace function public.admin_resolve_lead_protection_claim(p_claim_id uuid,p_decision text,p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_claim public.lead_protection_claims%rowtype; v_wallet_id uuid; v_refund_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Admin permission required.'; end if;
 if p_decision not in ('approve','reject') then raise exception 'Decision must be approve or reject.'; end if;
 select * into v_claim from public.lead_protection_claims where id=p_claim_id for update;
 if not found then raise exception 'Protection claim not found.'; end if;
 if v_claim.status in ('refund_approved','refund_rejected','refunded') then raise exception 'This protection claim has already been resolved.'; end if;
 if p_decision='reject' then
  update public.lead_protection_claims set status='refund_rejected',admin_note=left(coalesce(p_admin_note,''),2000),reviewed_by=auth.uid(),reviewed_at=now() where id=p_claim_id;
  return jsonb_build_object('success',true,'status','refund_rejected');
 end if;
 select id into v_wallet_id from public.credit_wallets where contractor_id=v_claim.contractor_id for update;
 if v_wallet_id is null then raise exception 'Contractor credit wallet not found.'; end if;
 update public.credit_wallets set balance_cents=balance_cents+(select price_cents from public.lead_purchases where id=v_claim.purchase_id),updated_at=now() where id=v_wallet_id;
 insert into public.credit_transactions(wallet_id,amount_cents,transaction_type,description)
 select v_wallet_id,lp.price_cents,'refund','Lead protection refund | Claim ID: '||p_claim_id::text||' | Purchase ID: '||lp.id::text
 from public.lead_purchases lp where lp.id=v_claim.purchase_id returning id into v_refund_id;
 update public.lead_protection_claims set status='refunded',admin_note=left(coalesce(p_admin_note,''),2000),reviewed_by=auth.uid(),reviewed_at=now(),refund_transaction_id=v_refund_id where id=p_claim_id;
 return jsonb_build_object('success',true,'status','refunded','refund_transaction_id',v_refund_id);
end;
$function$;

create or replace function private.force_service_request_protection_fields()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','auth','private'
as $function$
begin
 if tg_op='INSERT' then
  new.protection_required:=true;
  -- Confirmation is recorded by an authenticated, ownership-checked RPC after submission.
  new.customer_live_confirmed_at:=null;
  new.customer_live_confirmation_version:=null;
 elsif new.protection_required is distinct from old.protection_required
   and new.protection_required=false
   and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
  raise exception 'Only an administrator can change lead protection enforcement.';
 end if;
 return new;
end;
$function$;

drop trigger if exists service_request_force_protection_fields on public.service_requests;
create trigger service_request_force_protection_fields
before insert or update of protection_required on public.service_requests
for each row execute function private.force_service_request_protection_fields();

create or replace function public.confirm_own_service_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user_email_confirmed boolean;
begin
 if auth.uid() is null then raise exception 'You must be signed in.'; end if;
 select (u.email_confirmed_at is not null) into v_user_email_confirmed from auth.users u where u.id=auth.uid();
 if not coalesce(v_user_email_confirmed,false) then raise exception 'Verify your email before confirming this service request.'; end if;
 update public.service_requests
 set customer_live_confirmed_at=now(),customer_live_confirmation_version='2026-11-22-v1'
 where id=p_request_id and user_id=auth.uid() and status='new' and lead_id is null
   and commercial_sharing_consent_at is not null
   and coalesce(trim(commercial_sharing_consent_version),'')<>'';
 if not found then raise exception 'Request not found, already processed, or commercial sharing consent is missing.'; end if;
 return jsonb_build_object('success',true,'confirmed_at',now());
end;
$function$;

revoke all on function public.confirm_own_service_request(uuid) from public,anon;
grant execute on function public.confirm_own_service_request(uuid) to authenticated;

create or replace function private.enforce_service_request_protection()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','auth','private'
as $function$
declare v_email_confirmed boolean; v_risk_level text; v_checks jsonb;
begin
 if new.lead_id is null or new.status<>'published' or not coalesce(new.protection_required,true) then return new; end if;
 if new.customer_live_confirmed_at is null or coalesce(trim(new.customer_live_confirmation_version),'')=''
    or new.commercial_sharing_consent_at is null or coalesce(trim(new.commercial_sharing_consent_version),'')='' then
  raise exception 'Customer confirmation is required before this request can be published.';
 end if;
 select (u.email_confirmed_at is not null) into v_email_confirmed from auth.users u where u.id=new.user_id;
 if not coalesce(v_email_confirmed,false) then raise exception 'Customer email must be verified before this request can be published.'; end if;
 select risk_level,checks into v_risk_level,v_checks from public.lead_verification_checks where request_id=new.id;
 if not found then raise exception 'Automatic lead verification has not completed. Please retry review.'; end if;
 if v_risk_level='high'
    or coalesce((v_checks->>'same_customer_duplicate')::boolean,false)
    or coalesce((v_checks->>'duplicate_description')::boolean,false)
    or not coalesce((v_checks->>'zip_format_valid')::boolean,false) then
  raise exception 'ZELPX protection review blocked this lead. Resolve the verification flags before publishing.';
 end if;
 return new;
end;
$function$;

drop trigger if exists service_request_protection_before_publish on public.service_requests;
create trigger service_request_protection_before_publish before update of lead_id,status on public.service_requests
for each row execute function private.enforce_service_request_protection();

revoke all on function public.submit_lead_protection_claim(uuid,text,text) from public,anon;
revoke all on function public.log_lead_contact_attempt(uuid,text,text,text) from public,anon;
revoke all on function public.propose_lead_appointment(uuid,timestamptz,text) from public,anon;
revoke all on function public.confirm_lead_appointment(uuid) from public,anon;
revoke all on function public.admin_resolve_lead_protection_claim(uuid,text,text) from public,anon;
grant execute on function public.submit_lead_protection_claim(uuid,text,text) to authenticated;
grant execute on function public.log_lead_contact_attempt(uuid,text,text,text) to authenticated;
grant execute on function public.propose_lead_appointment(uuid,timestamptz,text) to authenticated;
grant execute on function public.confirm_lead_appointment(uuid) to authenticated;
grant execute on function public.admin_resolve_lead_protection_claim(uuid,text,text) to authenticated;
