-- Migration: Add deadline fields to order_ledger
-- Run in Supabase SQL Editor

alter table public.order_ledger
  add column if not exists deadline_date date,
  add column if not exists deadline_status text not null default 'not_started'
    check (deadline_status in ('not_started', 'print_started', 'print_done', 'in_transit', 'delivered', 'cancelled'));

create index if not exists idx_order_ledger_deadline_date on public.order_ledger (deadline_date);
create index if not exists idx_order_ledger_deadline_status on public.order_ledger (deadline_status);