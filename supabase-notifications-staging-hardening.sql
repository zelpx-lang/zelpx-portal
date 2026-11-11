-- Additional staging hardening after supabase-notifications-staging.sql
alter table public.push_notification_outbox add column if not exists processing_at timestamptz;

create or replace function public.claim_push_notification(p_notification_id bigint)
returns setof public.push_notification_outbox
language sql security definer set search_path = ''
as $$
  update public.push_notification_outbox
  set processing_at = now(), attempt_count = attempt_count + 1
  where id = p_notification_id
    and delivered_at is null
    and (processing_at is null or processing_at < now() - interval '5 minutes')
  returning *;
$$;

revoke all on function public.claim_push_notification(bigint) from public, anon, authenticated;
grant execute on function public.claim_push_notification(bigint) to service_role;

create policy service_role_full_access on public.contractors
  for all to service_role using (true) with check (true);
create policy service_role_full_access on public.leads
  for all to service_role using (true) with check (true);
create policy service_role_full_access on public.lead_conversations
  for all to service_role using (true) with check (true);
create policy service_role_full_access on public.lead_messages
  for all to service_role using (true) with check (true);
create policy service_role_full_access on public.contractor_push_subscriptions
  for all to service_role using (true) with check (true);
create policy service_role_full_access on public.chat_push_subscriptions
  for all to service_role using (true) with check (true);
create policy service_role_full_access on public.push_notification_outbox
  for all to service_role using (true) with check (true);

create index if not exists lead_conversations_contractor_idx on public.lead_conversations(contractor_id);
create index if not exists lead_messages_conversation_idx on public.lead_messages(conversation_id);
create index if not exists contractor_push_subscriptions_contractor_idx on public.contractor_push_subscriptions(contractor_id);
