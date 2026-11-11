-- Isolated ZELPX push webhook and browser-test setup.
-- Apply only to the separate Supabase project zelpx-portal.
-- Secret values are created separately in Supabase Vault and are never stored here.

create extension if not exists pg_net;

create or replace function public.get_push_runtime_secrets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'webhook_secret', (select decrypted_secret from vault.decrypted_secrets where name='zelpx_push_webhook_secret'),
    'vapid_public_key', (select decrypted_secret from vault.decrypted_secrets where name='zelpx_vapid_public_key'),
    'vapid_private_key', (select decrypted_secret from vault.decrypted_secrets where name='zelpx_vapid_private_key'),
    'vapid_subject', (select decrypted_secret from vault.decrypted_secrets where name='zelpx_vapid_subject')
  );
$$;

revoke all on function public.get_push_runtime_secrets() from public, anon, authenticated;
grant execute on function public.get_push_runtime_secrets() to service_role;

create or replace function public.dispatch_push_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook_secret text;
begin
  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name='zelpx_push_webhook_secret';

  if v_webhook_secret is null or length(v_webhook_secret) < 32 then
    raise warning 'ZELPX push webhook secret is missing or invalid';
    return new;
  end if;

  perform net.http_post(
    url := 'https://uxqykfrzowprkemokhfo.supabase.co/functions/v1/dispatch-push-notification',
    body := jsonb_build_object('record', jsonb_build_object('id', new.id)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-zelpx-push-secret', v_webhook_secret
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke all on function public.dispatch_push_notification_webhook() from public, anon, authenticated;
grant execute on function public.dispatch_push_notification_webhook() to service_role;

drop trigger if exists trg_dispatch_push_notification_webhook on public.push_notification_outbox;
create trigger trg_dispatch_push_notification_webhook
after insert on public.push_notification_outbox
for each row execute function public.dispatch_push_notification_webhook();

create table if not exists public.staging_push_test_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staging_push_test_subscriptions_user_idx
  on public.staging_push_test_subscriptions(user_id);
alter table public.staging_push_test_subscriptions enable row level security;
revoke all on public.staging_push_test_subscriptions from anon, authenticated;
grant all on public.staging_push_test_subscriptions to service_role;
create policy service_role_full_access on public.staging_push_test_subscriptions
  for all to service_role using (true) with check (true);
