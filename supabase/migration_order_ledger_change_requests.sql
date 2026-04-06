-- Proposed edits to existing orders (after order is approved). Run after migration_order_ledger_approval.sql.

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
