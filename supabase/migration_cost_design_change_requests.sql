-- Pending edits to saved cost designs (approve/reject by admin). Run in SQL Editor if cost_designs exists.

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
