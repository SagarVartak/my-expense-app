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

-- Optional: later enable RLS and policies once auth is wired.
-- alter table public.expenses enable row level security;
-- alter table public.audit_logs enable row level security;
-- alter table public.app_users enable row level security;

