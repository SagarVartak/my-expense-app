-- Enable RLS on all public tables and create basic policies
-- Run in Supabase SQL Editor

-- Drop existing policies first to avoid conflicts
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ============================================
-- 1. EXPENSES
-- ============================================
alter table public.expenses enable row level security;

create policy "Users can view their own expenses"
  on public.expenses
  for select
  using (paid_by = current_user);

create policy "Users can insert their own expenses"
  on public.expenses
  for insert
  with check (paid_by = current_user);

create policy "Users can update their own expenses"
  on public.expenses
  for update
  using (paid_by = current_user);

create policy "Users can delete their own expenses"
  on public.expenses
  for delete
  using (paid_by = current_user);

-- Admin can see all expenses
create policy "Admins can view all expenses"
  on public.expenses
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
-- 2. AUDIT_LOGS
-- ============================================
alter table public.audit_logs enable row level security;

create policy "Users can view their own audit logs"
  on public.audit_logs
  for select
  using (performed_by = current_user);

create policy "Admins can view all audit logs"
  on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- System inserts (allow inserts for authenticated users for their own actions)
create policy "Users can insert their own audit logs"
  on public.audit_logs
  for insert
  with check (performed_by = current_user);

-- ============================================
-- 3. APP_USERS
-- ============================================
alter table public.app_users enable row level security;

create policy "Users can view their own profile"
  on public.app_users
  for select
  using (username = current_user);

create policy "Admins can view all users"
  on public.app_users
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can update their own profile"
  on public.app_users
  for update
  using (username = current_user);

create policy "Admins can update any user"
  on public.app_users
  for update
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- Only admins can insert/delete users
create policy "Admins can insert users"
  on public.app_users
  for insert
  with check (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Admins can delete users"
  on public.app_users
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
-- 4. PENDING_INVITES
-- ============================================
alter table public.pending_invites enable row level security;

create policy "Admins can manage pending invites"
  on public.pending_invites
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
-- 5. PRINTED_INVENTORY_ENTRIES
-- ============================================
alter table public.printed_inventory_entries enable row level security;

create policy "Users can view their own printed inventory entries"
  on public.printed_inventory_entries
  for select
  using (created_by = current_user);

create policy "Admins can view all printed inventory entries"
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

create policy "Users can update their own printed inventory entries"
  on public.printed_inventory_entries
  for update
  using (created_by = current_user);

create policy "Users can delete their own printed inventory entries"
  on public.printed_inventory_entries
  for delete
  using (created_by = current_user);

-- ============================================
-- 6. COST_DESIGNS
-- ============================================
alter table public.cost_designs enable row level security;

create policy "Users can view their own cost designs"
  on public.cost_designs
  for select
  using (created_by = current_user);

create policy "Admins can view all cost designs"
  on public.cost_designs
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own cost designs"
  on public.cost_designs
  for insert
  with check (created_by = current_user);

create policy "Users can update their own cost designs"
  on public.cost_designs
  for update
  using (created_by = current_user);

create policy "Users can delete their own cost designs"
  on public.cost_designs
  for delete
  using (created_by = current_user);

-- ============================================
-- 7. ORDER_LEDGER
-- ============================================
alter table public.order_ledger enable row level security;

create policy "Users can view their own orders"
  on public.order_ledger
  for select
  using (created_by = current_user);

create policy "Admins can view all orders"
  on public.order_ledger
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own orders"
  on public.order_ledger
  for insert
  with check (created_by = current_user);

create policy "Users can update their own orders"
  on public.order_ledger
  for update
  using (created_by = current_user);

create policy "Users can delete their own orders"
  on public.order_ledger
  for delete
  using (created_by = current_user);

-- ============================================
-- 8. COST_DESIGN_CHANGE_REQUESTS
-- ============================================
alter table public.cost_design_change_requests enable row level security;

create policy "Users can view their own change requests"
  on public.cost_design_change_requests
  for select
  using (requested_by = current_user);

create policy "Admins can view all change requests"
  on public.cost_design_change_requests
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own change requests"
  on public.cost_design_change_requests
  for insert
  with check (requested_by = current_user);

create policy "Users can update their own pending change requests"
  on public.cost_design_change_requests
  for update
  using (requested_by = current_user and status = 'pending');

create policy "Admins can review change requests"
  on public.cost_design_change_requests
  for update
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- ============================================
-- 9. ORDER_LEDGER_CHANGE_REQUESTS
-- ============================================
alter table public.order_ledger_change_requests enable row level security;

create policy "Users can view their own order change requests"
  on public.order_ledger_change_requests
  for select
  using (requested_by = current_user);

create policy "Admins can view all order change requests"
  on public.order_ledger_change_requests
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own order change requests"
  on public.order_ledger_change_requests
  for insert
  with check (requested_by = current_user);

create policy "Users can update their own pending order change requests"
  on public.order_ledger_change_requests
  for update
  using (requested_by = current_user and status = 'pending');

create policy "Admins can review order change requests"
  on public.order_ledger_change_requests
  for update
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- ============================================
-- 10. DELETION_REQUESTS
-- ============================================
alter table public.deletion_requests enable row level security;

create policy "Users can view their own deletion requests"
  on public.deletion_requests
  for select
  using (requested_by = current_user);

create policy "Admins can view all deletion requests"
  on public.deletion_requests
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

create policy "Users can insert their own deletion requests"
  on public.deletion_requests
  for insert
  with check (requested_by = current_user);

create policy "Users can update their own pending deletion requests"
  on public.deletion_requests
  for update
  using (requested_by = current_user and status = 'pending');

create policy "Admins can review deletion requests"
  on public.deletion_requests
  for update
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );

-- ============================================
-- 11. PUSH_SUBSCRIPTIONS
-- ============================================
alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions
  for select
  using (
    app_user_id in (
      select id from public.app_users
      where username = current_user
    )
  );

create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions
  for insert
  with check (
    app_user_id in (
      select id from public.app_users
      where username = current_user
    )
  );

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions
  for delete
  using (
    app_user_id in (
      select id from public.app_users
      where username = current_user
    )
  );

create policy "Admins can view all push subscriptions"
  on public.push_subscriptions
  for select
  using (
    exists (
      select 1 from public.app_users
      where username = current_user
      and role in ('admin', 'manager')
      and active = true
    )
  );