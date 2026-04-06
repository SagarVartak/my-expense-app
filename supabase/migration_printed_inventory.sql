-- Printed stock from saved cost designs (per print run + aggregates).
create table if not exists public.printed_inventory_entries (
  id uuid primary key default gen_random_uuid(),
  cost_design_id uuid not null references public.cost_designs (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  printer_name text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_printed_inv_entries_design on public.printed_inventory_entries (cost_design_id);
create index if not exists idx_printed_inv_entries_created on public.printed_inventory_entries (created_at desc);

comment on table public.printed_inventory_entries is 'Each row adds units printed for a saved design; totals are summed per design in the app.';
