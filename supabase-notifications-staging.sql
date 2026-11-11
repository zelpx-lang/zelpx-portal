-- ZELPX isolated notification staging schema
-- This is a minimal test schema for project zelpx-portal only.
-- No Production data, credentials, or live subscriptions are copied.
-- RLS is enabled and direct anon/authenticated access is revoked.
-- Apply only to the isolated staging project.

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  service_zip_code text,
  service_city text,
  service_state text,
  service_latitude double precision,
  service_longitude double precision,
  service_radius_miles integer not null default 25
    check (service_radius_miles between 1 and 250),
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  service_category text not null,
  zip_code text not null,
  service_city text,
  service_state text,
  service_latitude double precision,
  service_longitude double precision,
  status text not null default 'available'
    check (status in ('available','sold','closed')),
  created_at timestamptz not null default now()
);

create table public.lead_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  customer_user_id uuid not null,
  unique (lead_id, contractor_id)
);

create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.lead_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer','contractor')),
  sender_user_id uuid,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.contractor_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  user_id uuid not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.lead_conversations(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('customer','contractor')),
  user_id uuid,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, recipient_type, endpoint)
);

create table public.push_notification_outbox (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('new_lead','new_chat_message')),
  source_id uuid not null,
  recipient_type text not null check (recipient_type in ('customer','contractor')),
  recipient_id uuid not null,
  conversation_id uuid,
  title text not null,
  body text not null,
  target_url text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  unique (event_type, source_id, recipient_type, recipient_id)
);

create index contractors_service_zip_idx on public.contractors(service_zip_code);
create index contractors_service_area_idx on public.contractors(service_state, service_city);
create index leads_available_zip_idx on public.leads(zip_code) where status='available';
create index push_outbox_pending_idx on public.push_notification_outbox(created_at) where delivered_at is null;
create index lead_conversations_contractor_idx on public.lead_conversations(contractor_id);
create index lead_messages_conversation_idx on public.lead_messages(conversation_id);
create index contractor_push_subscriptions_contractor_idx on public.contractor_push_subscriptions(contractor_id);

create or replace function public.eligible_contractors_for_lead(p_lead_id uuid)
returns table(contractor_id uuid, user_id uuid)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.user_id
  from public.contractors c
  join public.leads l on l.id = p_lead_id
  where c.verification_status = 'verified'
    and l.status = 'available'
    and c.service_radius_miles between 1 and 250
    and (
      (nullif(c.service_zip_code,'') is not null and c.service_zip_code = l.zip_code)
      or (
        c.service_latitude is not null and c.service_longitude is not null
        and l.service_latitude is not null and l.service_longitude is not null
        and 3958.7613 * 2 * asin(sqrt(
          power(sin(radians(l.service_latitude-c.service_latitude)/2),2)
          + cos(radians(c.service_latitude))*cos(radians(l.service_latitude))
          * power(sin(radians(l.service_longitude-c.service_longitude)/2),2)
        )) <= c.service_radius_miles
      )
      or (
        c.service_latitude is null and c.service_longitude is null
        and l.service_latitude is null and l.service_longitude is null
        and nullif(c.service_city,'') is not null and nullif(c.service_state,'') is not null
        and lower(trim(c.service_city)) = lower(trim(l.service_city))
        and upper(trim(c.service_state)) = upper(trim(l.service_state))
      )
    );
$$;

revoke all on function public.eligible_contractors_for_lead(uuid) from public, anon, authenticated;
grant execute on function public.eligible_contractors_for_lead(uuid) to service_role;

create or replace function public.enqueue_new_lead_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status <> 'available' then return new; end if;
  insert into public.push_notification_outbox
    (event_type, source_id, recipient_type, recipient_id, title, body, target_url)
  select 'new_lead', new.id, 'contractor', eligible.user_id,
    'New ZELPX lead available',
    concat_ws(' · ', nullif(new.service_category,''), nullif(new.service_city,''),
      nullif(new.service_state,''), 'Tap to view'),
    '/?lead=' || new.id::text
  from public.eligible_contractors_for_lead(new.id) eligible
  on conflict (event_type, source_id, recipient_type, recipient_id) do nothing;
  return new;
end;
$$;

create trigger trg_enqueue_new_lead_push
after insert on public.leads
for each row execute function public.enqueue_new_lead_push();

create or replace function public.enqueue_chat_message_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_conversation public.lead_conversations%rowtype;
  v_recipient_type text;
  v_recipient_id uuid;
begin
  select * into v_conversation
  from public.lead_conversations where id = new.conversation_id;
  if not found then return new; end if;

  if new.sender_type = 'customer' then
    v_recipient_type := 'contractor';
    select c.user_id into v_recipient_id
    from public.contractors c where c.id = v_conversation.contractor_id;
  else
    v_recipient_type := 'customer';
    v_recipient_id := v_conversation.customer_user_id;
  end if;

  if v_recipient_id is not null then
    insert into public.push_notification_outbox
      (event_type, source_id, recipient_type, recipient_id, conversation_id, title, body, target_url)
    values (
      'new_chat_message', new.id, v_recipient_type, v_recipient_id,
      new.conversation_id,
      case when v_recipient_type='customer' then 'New message from your contractor'
           else 'New message from your customer' end,
      'You have a new message in your ZELPX conversation.',
      case when v_recipient_type='customer' then '/customer' else '/' end
    )
    on conflict (event_type, source_id, recipient_type, recipient_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_enqueue_chat_message_push
after insert on public.lead_messages
for each row execute function public.enqueue_chat_message_push();

revoke all on function public.enqueue_new_lead_push() from public, anon, authenticated;
revoke all on function public.enqueue_chat_message_push() from public, anon, authenticated;

alter table public.contractors enable row level security;
alter table public.leads enable row level security;
alter table public.lead_conversations enable row level security;
alter table public.lead_messages enable row level security;
alter table public.contractor_push_subscriptions enable row level security;
alter table public.chat_push_subscriptions enable row level security;
alter table public.push_notification_outbox enable row level security;

revoke all on public.contractors, public.leads, public.lead_conversations,
  public.lead_messages, public.contractor_push_subscriptions,
  public.chat_push_subscriptions, public.push_notification_outbox
from anon, authenticated;

grant all on public.contractors, public.leads, public.lead_conversations,
  public.lead_messages, public.contractor_push_subscriptions,
  public.chat_push_subscriptions, public.push_notification_outbox
to service_role;
