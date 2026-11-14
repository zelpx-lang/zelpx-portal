-- ZELPX WebRTC signaling channel. Additive only; does not alter chat or lead tables.
create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_invitations(call_id) on delete cascade,
  conversation_id uuid not null references public.lead_conversations(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','decline','hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists call_signals_call_created_idx on public.call_signals(call_id, created_at);
alter table public.call_signals enable row level security;
drop policy if exists "Call participants can read signaling" on public.call_signals;
create policy "Call participants can read signaling" on public.call_signals for select to authenticated
using (
  exists (
    select 1 from public.lead_conversations c
    left join public.contractors ct on ct.id = c.contractor_id
    left join public.service_requests sr on sr.lead_id = c.lead_id
    where c.id = call_signals.conversation_id
      and (ct.user_id = auth.uid() or sr.user_id = auth.uid())
  )
);
drop policy if exists "Call participants can send signaling" on public.call_signals;
create policy "Call participants can send signaling" on public.call_signals for insert to authenticated
with check (
  from_user_id = auth.uid() and
  exists (
    select 1 from public.lead_conversations c
    left join public.contractors ct on ct.id = c.contractor_id
    left join public.service_requests sr on sr.lead_id = c.lead_id
    where c.id = call_signals.conversation_id
      and (ct.user_id = auth.uid() or sr.user_id = auth.uid())
  )
);
