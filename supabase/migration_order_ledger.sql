-- Run in Supabase SQL Editor after cost_designs exists.

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
  exclude_shipping_from_cost boolean not null default false
);

create index if not exists idx_order_ledger_order_date on public.order_ledger (order_date desc);
create index if not exists idx_order_ledger_created_at on public.order_ledger (created_at desc);
