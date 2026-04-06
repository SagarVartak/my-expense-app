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

-- Saved cost calculator designs (see migration_cost_designs.sql for standalone run)
create table if not exists public.cost_designs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null,
  keychain_design text not null,
  print_weight_g numeric(14, 4) not null default 0,
  filament_cost_per_g numeric(14, 4) not null default 0,
  electricity_fee numeric(14, 2) not null default 0,
  chain_cost numeric(14, 2) not null default 0,
  pouch_cost numeric(14, 2) not null default 0,
  card_cost numeric(14, 2) not null default 0,
  primer_cost numeric(14, 2) not null default 0,
  clearcoat_cost numeric(14, 2) not null default 0,
  key_caps_cost numeric(14, 2) not null default 0,
  shipping numeric(14, 2) not null default 0,
  total_cost_price numeric(14, 2) not null,
  selling_price numeric(14, 2) not null default 0,
  net_profit numeric(14, 2) not null default 0
);
create index if not exists idx_cost_designs_created_at on public.cost_designs (created_at desc);

create table if not exists public.cost_design_change_requests (
  id uuid primary key default gen_random_uuid(),
  cost_design_id uuid not null references public.cost_designs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null,
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  reject_reason text not null default '',
  previous_snapshot jsonb not null,
  proposed_snapshot jsonb not null
);
create index if not exists idx_cdcr_created_at on public.cost_design_change_requests (created_at desc);
create unique index if not exists idx_cdcr_one_pending_per_design
  on public.cost_design_change_requests (cost_design_id)
  where status = 'pending';

create table if not exists public.order_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null,
  order_uid text not null unique,
  order_date date not null,
  cost_design_id uuid references public.cost_designs (id) on delete set null,
  design_name text not null default '',
  customer_name text not null,
  shipping_address text not null default '',
  actual_weight_g numeric(14, 4) not null default 0,
  total_cost_price numeric(14, 2) not null default 0,
  selling_price numeric(14, 2) not null default 0,
  net_profit numeric(14, 2) not null default 0,
  payment_method text not null default '',
  payment_status text not null default '',
  delivery_status text not null default '',
  source text not null default '',
  feedback text not null default '',
  customer_behaviour text not null default '',
  exclude_shipping_from_cost boolean not null default false,
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected'))
);
create index if not exists idx_order_ledger_order_date on public.order_ledger (order_date desc);
create index if not exists idx_order_ledger_created_at on public.order_ledger (created_at desc);

create table if not exists public.order_ledger_change_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.order_ledger (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null,
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  reject_reason text not null default '',
  previous_snapshot jsonb not null,
  proposed_snapshot jsonb not null
);
create index if not exists idx_olcr_created_at on public.order_ledger_change_requests (created_at desc);
create unique index if not exists idx_olcr_one_pending_per_order
  on public.order_ledger_change_requests (order_id)
  where status = 'pending';

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('expense', 'cost_design', 'order_ledger')),
  resource_id uuid not null,
  requested_by text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  reject_reason text not null default ''
);
create index if not exists idx_deletion_requests_created_at on public.deletion_requests (created_at desc);
create unique index if not exists idx_deletion_requests_one_pending_per_resource
  on public.deletion_requests (resource_type, resource_id)
  where status = 'pending';

-- Optional: later enable RLS and policies once auth is wired.
-- alter table public.expenses enable row level security;
-- alter table public.audit_logs enable row level security;
-- alter table public.app_users enable row level security;

