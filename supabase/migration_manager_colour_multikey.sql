-- Migration: Add manager role, colour_cost to cost_designs, and order_ledger_items for multiple keychains per order
-- Run in Supabase SQL Editor

-- ============================================
-- 1. ADD MANAGER ROLE TO APP_USERS
-- ============================================
-- Update the role check constraint to include 'manager'
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in ('admin', 'manager', 'member'));

-- ============================================
-- 2. ADD COLOUR_COST TO COST_DESIGNS
-- ============================================
alter table public.cost_designs add column if not exists colour_cost numeric(14, 2) not null default 0;

-- Update total_cost_price to include colour_cost for existing designs (if needed)
-- Note: This will be recalculated when designs are edited or new ones created

-- ============================================
-- 3. CREATE ORDER_LEDGER_ITEMS TABLE FOR MULTIPLE KEYCHAINS PER ORDER
-- ============================================
create table if not exists public.order_ledger_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.order_ledger (id) on delete cascade,
  cost_design_id uuid not null references public.cost_designs (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost_price numeric(14, 2) not null default 0,
  unit_selling_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_ledger_items_order_id on public.order_ledger_items (order_id);
create index if not exists idx_order_ledger_items_design_id on public.order_ledger_items (cost_design_id);

-- Add comment
comment on table public.order_ledger_items is 'Line items for an order - each row is a keychain design with its quantity and prices. Allows multiple designs per order.';

-- ============================================
-- 4. UPDATE ORDER_LEDGER: REMOVE OLD SINGLE-DESIGN FIELDS (will be deprecated)
-- ============================================
-- We'll keep the old columns for backward compatibility but they'll be deprecated
-- New orders will use order_ledger_items instead
-- The existing columns: cost_design_id, design_name, units, total_cost_price, selling_price, net_profit
-- will be kept for existing orders but new orders should use items

-- ============================================
-- 5. ENABLE RLS ON NEW TABLE
-- ============================================
alter table public.order_ledger_items enable row level security;

create policy "Users can view their own order items"
  on public.order_ledger_items
  for select
  using (
    order_id in (
      select id from public.order_ledger
      where created_by = current_user
    )
  );

create policy "Admins can view all order items"
  on public.order_ledger_items
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own order items"
  on public.order_ledger_items
  for insert
  with check (
    order_id in (
      select id from public.order_ledger
      where created_by = current_user
    )
  );

create policy "Users can update their own order items"
  on public.order_ledger_items
  for update
  using (
    order_id in (
      select id from public.order_ledger
      where created_by = current_user
    )
  );

create policy "Users can delete their own order items"
  on public.order_ledger_items
  for delete
  using (
    order_id in (
      select id from public.order_ledger
      where created_by = current_user
    )
  );

create policy "Admins and managers can manage all order items"
  on public.order_ledger_items
  for all
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- ============================================
-- 6. UPDATE PRINTED_INVENTORY ENTRIES RLS FOR MANAGERS
-- ============================================
-- Drop existing policies and recreate with manager support
drop policy if exists "Users can view their own printed inventory entries" on public.printed_inventory_entries;
drop policy if exists "Admins can view all printed inventory entries" on public.printed_inventory_entries;
drop policy if exists "Users can insert their own printed inventory entries" on public.printed_inventory_entries;
drop policy if exists "Users can update their own printed inventory entries" on public.printed_inventory_entries;
drop policy if exists "Users can delete their own printed inventory entries" on public.printed_inventory_entries;

create policy "Users can view their own printed inventory entries"
  on public.printed_inventory_entries
  for select
  using (created_by = current_user);

create policy "Admins and managers can view all printed inventory entries"
  on public.printed_inventory_entries
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own printed inventory entries"
  on public.printed_inventory_entries
  for insert
  with check (created_by = current_user);

create policy "Admins and managers can insert printed inventory entries"
  on public.printed_inventory_entries
  for insert
  with check (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can update their own printed inventory entries"
  on public.printed_inventory_entries
  for update
  using (created_by = current_user);

create policy "Admins and managers can update all printed inventory entries"
  on public.printed_inventory_entries
  for update
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can delete their own printed inventory entries"
  on public.printed_inventory_entries
  for delete
  using (created_by = current_user);

create policy "Admins and managers can delete all printed inventory entries"
  on public.printed_inventory_entries
  for delete
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- ============================================
-- 7. UPDATE COST_DESIGNS RLS FOR MANAGERS (if needed - they can already view all via admin policy)
-- ============================================
-- The existing admin policies should cover managers if we update them to include 'manager'
-- We'll handle this in the RLS migration file (migration_enable_rls.sql)

-- ============================================
-- 8. UPDATE EXISTING COST_DESIGNS TOTAL_COST_PRICE TO INCLUDE COLOUR_COST
-- ============================================
-- This is optional - only for existing designs
-- update public.cost_designs set total_cost_price = total_cost_price + colour_cost where colour_cost > 0;