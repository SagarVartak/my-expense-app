-- Web Push subscriptions for admin approval alerts (VAPID). Run in Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (app_user_id);

comment on table public.push_subscriptions is 'Browser Web Push endpoints for users who enabled approval notifications.';
