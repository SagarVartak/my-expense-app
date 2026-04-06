-- Pending deletion approvals (members submit; admin approves/rejects).
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

comment on table public.deletion_requests is 'User-requested deletions awaiting admin approval.';
