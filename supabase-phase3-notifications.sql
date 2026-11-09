-- ZELPX Phase 3: opt-in email notifications for matching leads
-- PREPARED ONLY. Apply after Phase 1 and Phase 2 on a STAGING project.
-- Delivery is triggered by a Supabase Database Webhook on lead_notification_outbox INSERT.
-- Configure the webhook header x-zelpx-webhook-secret with the same secret as the Edge Function env.

alter table public.contractors
  add column if not exists lead_email_notifications boolean not null default true;

create table if not exists public.lead_notification_outbox (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists lead_notification_outbox_pending_idx
  on public.lead_notification_outbox (created_at)
  where processed_at is null;

create table if not exists public.lead_notification_deliveries (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (lead_id, contractor_id)
);

alter table public.lead_notification_outbox enable row level security;
alter table public.lead_notification_deliveries enable row level security;

-- These are server-only operational tables. No anon/authenticated policies are added.
revoke all on public.lead_notification_outbox from anon, authenticated;
revoke all on public.lead_notification_deliveries from anon, authenticated;

create or replace function public.enqueue_lead_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'available' then
    insert into public.lead_notification_outbox (lead_id)
    values (new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enqueue_lead_notification on public.leads;
create trigger trg_enqueue_lead_notification
after insert on public.leads
for each row execute function public.enqueue_lead_notification();

revoke all on function public.enqueue_lead_notification() from public, anon, authenticated;

-- Database webhook configuration (Dashboard):
-- Database > Webhooks > Create webhook
-- Table: public.lead_notification_outbox
-- Event: INSERT
-- Type: Supabase Edge Function
-- Function: dispatch-lead-notifications
-- Add custom HTTP header x-zelpx-webhook-secret: <same random secret configured in function secrets>.
-- Do not expose this secret in frontend code.
