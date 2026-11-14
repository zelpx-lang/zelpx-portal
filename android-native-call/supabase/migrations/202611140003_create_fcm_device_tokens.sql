-- Private storage for native Android FCM registration tokens.
create table if not exists public.fcm_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  fcm_token text not null unique,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id)
);
alter table public.fcm_device_tokens enable row level security;
-- No client-side policies: only the Edge Function service role may read/write tokens.
