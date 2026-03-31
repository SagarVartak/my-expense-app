-- Run in Supabase SQL Editor after initial schema.
-- Email + invites for verified member onboarding.

alter table public.app_users
  add column if not exists email text unique,
  add column if not exists email_verified_at timestamptz;

create table if not exists public.pending_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  token_hash text not null,
  expires_at timestamptz not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_invites_expires on public.pending_invites (expires_at);
