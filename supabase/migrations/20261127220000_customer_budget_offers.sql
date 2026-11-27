-- Customer-budget offers: ordinary leads (no customer budget) keep the existing Buy Lead flow.
-- This migration is committed for review only; it is not applied to the production database.

alter table public.service_requests
  add column if not exists customer_budget_cents integer,
  add column if not exists customer_budget_choice text;

alter table public.leads
  add column if not exists customer_budget_cents integer,
  add column if not exists customer_budget_choice text;

alter table public.service_requests
  add constraint service_requests_customer_budget_nonnegative
  check (customer_budget_cents is null or customer_budget_cents > 0) not valid;

alter table public.leads
  add constraint leads_customer_budget_nonnegative
  check (customer_budget_cents is null or customer_budget_cents > 0) not valid;

create table if not exists public.lead_offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  offer_cents integer,
  status text not null default 'pending'
    check (status in ('pending','declined','approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (lead_id, contractor_id),
  check (offer_cents is null or offer_cents > 0)
);

create index if not exists lead_offers_lead_status_idx
  on public.lead_offers(lead_id, status, created_at desc);
create index if not exists lead_offers_contractor_idx
  on public.lead_offers(contractor_id, updated_at desc);

alter table public.lead_offers enable row level security;
revoke all on public.lead_offers from anon, authenticated;

-- Copy the customer's selected budget into the contractor-facing lead whenever
-- the existing administrator publishing RPC links a request to its new lead.
create or replace function public.zelpx_copy_customer_budget_to_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.lead_id is not null and old.lead_id is null then
    update public.leads
       set customer_budget_cents = new.customer_budget_cents,
           customer_budget_choice = new.customer_budget_choice
     where id = new.lead_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists service_request_copy_customer_budget_to_lead on public.service_requests;
create trigger service_request_copy_customer_budget_to_lead
after update of lead_id on public.service_requests
for each row execute function public.zelpx_copy_customer_budget_to_lead();

-- Prevent a budget-based lead from being purchased through the ordinary Buy Lead RPC.
-- The customer approval RPC marks the matching offer approved before inserting purchase.
create or replace function public.zelpx_require_approved_budget_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1 from public.leads l
    where l.id = new.lead_id and l.customer_budget_cents is not null
  ) and not exists (
    select 1 from public.lead_offers o
    where o.lead_id = new.lead_id
      and o.contractor_id = new.contractor_id
      and o.status = 'approved'
  ) then
    raise exception 'This customer-budget lead can only be purchased after the customer approves your offer.';
  end if;
  return new;
end;
$function$;

drop trigger if exists lead_purchase_require_approved_budget_offer on public.lead_purchases;
create trigger lead_purchase_require_approved_budget_offer
before insert on public.lead_purchases
for each row execute function public.zelpx_require_approved_budget_offer();

create or replace function public.submit_lead_offer(p_lead_id uuid, p_offer_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contractor_id uuid;
  v_budget integer;
  v_status text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_offer_cents is null or p_offer_cents < 1 then raise exception 'Enter a valid offer amount.'; end if;

  select c.id into v_contractor_id
  from public.contractors c
  where c.user_id = auth.uid()
    and c.verification_status = 'verified'
    and c.contractor_phone_verified_at is not null
    and regexp_replace(coalesce(c.contractor_phone,''),'[^0-9]','','g')
      = regexp_replace(coalesce(c.contractor_phone_verified_number,''),'[^0-9]','','g')
  for update;

  if v_contractor_id is null then
    raise exception 'A verified contractor account and verified phone are required to make an offer.';
  end if;

  if not public.zelpx_can_view_lead(p_lead_id) then
    raise exception 'This lead is outside your eligible service area or is no longer available.';
  end if;

  select l.customer_budget_cents, l.status into v_budget, v_status
  from public.leads l where l.id = p_lead_id for update;

  if v_status is distinct from 'available' then raise exception 'This lead is no longer available.'; end if;
  if v_budget is null or v_budget < 1 then raise exception 'This lead uses the regular purchase flow, not offers.'; end if;

  insert into public.lead_offers(lead_id, contractor_id, offer_cents, status, created_at, updated_at, responded_at)
  values(p_lead_id, v_contractor_id, p_offer_cents, 'pending', now(), now(), null)
  on conflict (lead_id, contractor_id) do update
    set offer_cents = excluded.offer_cents,
        status = 'pending',
        updated_at = now(),
        responded_at = null;

  return jsonb_build_object('success', true, 'lead_id', p_lead_id, 'offer_cents', p_offer_cents);
end;
$function$;

create or replace function public.decline_lead_offer(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_contractor_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select id into v_contractor_id from public.contractors
  where user_id = auth.uid() and verification_status = 'verified';
  if v_contractor_id is null then raise exception 'Verified contractor account required.'; end if;
  if not public.zelpx_can_view_lead(p_lead_id) then raise exception 'This lead is no longer available.'; end if;

  insert into public.lead_offers(lead_id, contractor_id, offer_cents, status, created_at, updated_at, responded_at)
  values(p_lead_id, v_contractor_id, null, 'declined', now(), now(), now())
  on conflict (lead_id, contractor_id) do update
    set offer_cents = null, status = 'declined', updated_at = now(), responded_at = now();

  return jsonb_build_object('success', true, 'lead_id', p_lead_id);
end;
$function$;

create or replace function public.contractor_get_my_lead_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_contractor_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select id into v_contractor_id from public.contractors where user_id = auth.uid();
  if v_contractor_id is null then raise exception 'Contractor account not found.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lead_id', o.lead_id, 'offer_id', o.id, 'offer_cents', o.offer_cents,
    'status', o.status, 'updated_at', o.updated_at
  ) order by o.updated_at desc), '[]'::jsonb)
  into v_result
  from public.lead_offers o
  where o.contractor_id = v_contractor_id;

  return v_result;
end;
$function$;

create or replace function public.customer_get_my_lead_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lead_id', o.lead_id, 'offer_id', o.id, 'contractor_id', o.contractor_id,
    'company_name', c.company_name, 'offer_cents', o.offer_cents,
    'status', o.status, 'created_at', o.created_at, 'updated_at', o.updated_at
  ) order by o.created_at), '[]'::jsonb)
  into v_result
  from public.lead_offers o
  join public.leads l on l.id = o.lead_id
  join public.service_requests sr on sr.lead_id = l.id and sr.user_id = auth.uid()
  join public.contractors c on c.id = o.contractor_id;

  return v_result;
end;
$function$;

create or replace function public.customer_respond_to_lead_offer(p_offer_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_offer public.lead_offers%rowtype;
  v_lead public.leads%rowtype;
  v_contractor public.contractors%rowtype;
  v_wallet_id uuid;
  v_balance integer;
  v_purchase_id uuid;
  v_customer_request_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_decision is null or p_decision not in ('approve','decline') then raise exception 'Choose Approve or Decline.'; end if;

  select o.* into v_offer
  from public.lead_offers o
  join public.leads l on l.id = o.lead_id
  join public.service_requests sr on sr.lead_id = l.id
  where o.id = p_offer_id and sr.user_id = auth.uid()
  for update of o;

  if not found then raise exception 'Offer not found for this customer.'; end if;
  if v_offer.status <> 'pending' then raise exception 'This offer has already been answered.'; end if;

  if p_decision = 'decline' then
    update public.lead_offers set status = 'declined', responded_at = now(), updated_at = now()
    where id = p_offer_id;
    return jsonb_build_object('success', true, 'decision', 'decline');
  end if;

  select * into v_lead from public.leads where id = v_offer.lead_id for update;
  if not found or v_lead.status <> 'available' then raise exception 'This job is no longer available.'; end if;
  if v_lead.customer_budget_cents is null then raise exception 'This job is not configured for offers.'; end if;

  select * into v_contractor from public.contractors where id = v_offer.contractor_id for update;
  if not found or v_contractor.verification_status <> 'verified' then raise exception 'Contractor is no longer eligible.'; end if;

  select id, balance_cents into v_wallet_id, v_balance
  from public.credit_wallets where contractor_id = v_offer.contractor_id for update;
  if v_wallet_id is null then raise exception 'Contractor wallet not found.'; end if;
  if v_balance < v_lead.price_cents then
    raise exception 'The contractor does not have enough ZELPX Credits. The offer remains pending until the balance is funded.';
  end if;

  if not exists(select 1 from public.lead_contacts where lead_id = v_lead.id) then
    raise exception 'Customer contact details are not available for this job.';
  end if;

  -- Mark approved first so the purchase guard allows this one transaction.
  update public.lead_offers set status = 'approved', responded_at = now(), updated_at = now()
  where id = p_offer_id;

  update public.credit_wallets
  set balance_cents = balance_cents - v_lead.price_cents, updated_at = now()
  where id = v_wallet_id;

  insert into public.lead_purchases(lead_id, contractor_id, price_cents)
  values(v_lead.id, v_offer.contractor_id, v_lead.price_cents)
  returning id into v_purchase_id;

  insert into public.credit_transactions(wallet_id, amount_cents, transaction_type, description)
  values(v_wallet_id, -v_lead.price_cents, 'purchase',
    'Customer-approved offer | Purchase ID: ' || v_purchase_id::text || ' | Lead ID: ' || v_lead.id::text);

  update public.leads set status = 'sold' where id = v_lead.id;

  update public.lead_offers
  set status = 'declined', responded_at = now(), updated_at = now()
  where lead_id = v_lead.id and id <> p_offer_id and status = 'pending';

  update public.service_requests
  set purchased_by = v_contractor.user_id, purchased_at = now(), status = 'sold'
  where lead_id = v_lead.id and user_id = auth.uid()
  returning id into v_customer_request_id;

  insert into public.lead_conversations(lead_id, contractor_id)
  values(v_lead.id, v_offer.contractor_id)
  on conflict (lead_id) do nothing;

  return jsonb_build_object(
    'success', true, 'decision', 'approve', 'purchase_id', v_purchase_id,
    'lead_id', v_lead.id, 'price_cents', v_lead.price_cents,
    'contractor_offer_cents', v_offer.offer_cents, 'request_id', v_customer_request_id
  );
end;
$function$;

revoke all on function public.submit_lead_offer(uuid, integer) from public, anon;
revoke all on function public.decline_lead_offer(uuid) from public, anon;
revoke all on function public.contractor_get_my_lead_offers() from public, anon;
revoke all on function public.customer_get_my_lead_offers() from public, anon;
revoke all on function public.customer_respond_to_lead_offer(uuid, text) from public, anon;
grant execute on function public.submit_lead_offer(uuid, integer) to authenticated;
grant execute on function public.decline_lead_offer(uuid) to authenticated;
grant execute on function public.contractor_get_my_lead_offers() to authenticated;
grant execute on function public.customer_get_my_lead_offers() to authenticated;
grant execute on function public.customer_respond_to_lead_offer(uuid, text) to authenticated;
