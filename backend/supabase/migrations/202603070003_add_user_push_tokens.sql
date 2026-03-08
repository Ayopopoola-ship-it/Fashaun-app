-- Stores mobile push tokens per user device for MVP push delivery.
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expo_push_token text not null,
  device_platform text not null check (device_platform in ('ios', 'android', 'web', 'unknown')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

comment on table public.user_push_tokens is 'Registered Expo push tokens for user devices.';

create trigger trg_user_push_tokens_set_updated_at
before update on public.user_push_tokens
for each row
execute function public.set_updated_at();

create index if not exists idx_user_push_tokens_user_active
  on public.user_push_tokens (user_id, is_active, last_seen_at desc);

create unique index if not exists ux_user_push_tokens_expo_push_token
  on public.user_push_tokens (expo_push_token);
