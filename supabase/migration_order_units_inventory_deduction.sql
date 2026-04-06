-- Units per order (for inventory deduction when order is approved).
alter table public.order_ledger
  add column if not exists units integer not null default 1 check (units > 0);

-- Allow negative quantities for order fulfillment; tie rows to orders.
alter table public.printed_inventory_entries
  drop constraint if exists printed_inventory_entries_quantity_check;

alter table public.printed_inventory_entries
  add constraint printed_inventory_entries_quantity_check check (quantity <> 0);

alter table public.printed_inventory_entries
  add column if not exists order_id uuid references public.order_ledger (id) on delete cascade;

create unique index if not exists idx_printed_inv_entries_one_per_order
  on public.printed_inventory_entries (order_id)
  where order_id is not null;
