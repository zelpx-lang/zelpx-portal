-- Isolated migration for native FCM call delivery. Review and apply to staging first.
create table if not exists public.fcm_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  fcm_token text not null,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id),
  unique (fcm_token)
);

alter table public.fcm_device_tokens enable row level security;
revoke all on public.fcm_device_tokens from anon, authenticated;
grant all on public.fcm_device_tokens to service_role;

create index if not exists fcm_device_tokens_user_id_idx
  on public.fcm_device_tokens(user_id);
