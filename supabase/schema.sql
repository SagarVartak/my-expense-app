-- Run in Supabase SQL Editor
-- Free tier friendly schema for this app.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by text not null,
  payment_method text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  performed_by text not null,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  role text not null check (role in ('admin', 'member')),
  active boolean not null default true,
  password_hash text not null,
  created_at timestamptz not null default now()
);

insert into public.app_users (username, role, active, password_hash)
values
  ('admin', 'admin', true, '$2b$10$OQdejhCV4LOuXW.rjaJmmeS0Hzrv18Y2AUWOMf/qOLpoiboG968Ui'),
  ('sagar', 'member', true, '$2b$10$OdMS6m2u39EKlOdMSH.loOLNCo2OuFyscYdBjlIVq4hcgAVEx0Jqm')
on conflict (username) do nothing;

-- Email + invites (see migration_email_invites.sql if you already ran the schema above)
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

alter table public.expenses add column if not exists entry_uid text unique;
update public.expenses
set entry_uid = 'EXP-' || upper(substring(replace(id::text, '-', '') from 1 for 8))
where entry_uid is null;

-- Optional: later enable RLS and policies once auth is wired.
-- alter table public.expenses enable row level security;
-- alter table public.audit_logs enable row level security;
-- alter table public.app_users enable row level security;

