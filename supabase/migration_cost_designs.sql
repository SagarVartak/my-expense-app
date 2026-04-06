-- Run in Supabase SQL Editor after prior migrations.
-- Saved Cost Price Calculator designs.

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
  shipping numeric(14, 2) not null default 0,
  total_cost_price numeric(14, 2) not null,
  selling_price numeric(14, 2) not null default 0,
  net_profit numeric(14, 2) not null default 0
);

create index if not exists idx_cost_designs_created_at on public.cost_designs (created_at desc);
