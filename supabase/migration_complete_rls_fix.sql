-- Complete RLS Fix for All Tables
-- Run in Supabase SQL Editor
-- This allows server-side (service_role) and authenticated users to access their data

-- ============================================
-- DROP ALL EXISTING POLICIES FIRST
-- ============================================
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printed_inventory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_design_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ledger_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ledger_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- GRANT BASE PERMISSIONS
-- ============================================
GRANT ALL ON public.expenses TO service_role, authenticated;
GRANT ALL ON public.audit_logs TO service_role, authenticated;
GRANT ALL ON public.app_users TO service_role, authenticated;
GRANT ALL ON public.pending_invites TO service_role, authenticated;
GRANT ALL ON public.printed_inventory_entries TO service_role, authenticated;
GRANT ALL ON public.cost_designs TO service_role, authenticated;
GRANT ALL ON public.order_ledger TO service_role, authenticated;
GRANT ALL ON public.cost_design_change_requests TO service_role, authenticated;
GRANT ALL ON public.order_ledger_change_requests TO service_role, authenticated;
GRANT ALL ON public.deletion_requests TO service_role, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role, authenticated;
GRANT ALL ON public.order_ledger_items TO service_role, authenticated;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
-- Check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE username = current_user
    AND role IN ('admin', 'manager')
    AND active = true
  );
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE username = current_user
    AND role = 'admin'
    AND active = true
  );
$$;

-- ============================================
-- 1. EXPENSES
-- ============================================
CREATE POLICY "Service role full access" ON public.expenses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT
  USING (paid_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (paid_by = current_user);

CREATE POLICY "Users can update their own expenses"
  ON public.expenses FOR UPDATE
  USING (paid_by = current_user);

CREATE POLICY "Users can delete their own expenses"
  ON public.expenses FOR DELETE
  USING (paid_by = current_user);

-- ============================================
-- 2. AUDIT_LOGS
-- ============================================
CREATE POLICY "Service role full access" ON public.audit_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (performed_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (performed_by = current_user);

-- ============================================
-- 3. APP_USERS (critical for auth)
-- ============================================
CREATE POLICY "Service role full access" ON public.app_users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own profile"
  ON public.app_users FOR SELECT
  USING (
    username = current_user
    OR email = current_user
    OR auth_user_id = auth.uid()
    OR public.is_admin_or_manager()
  );

CREATE POLICY "Users can update their own profile"
  ON public.app_users FOR UPDATE
  USING (
    username = current_user
    OR email = current_user
    OR auth_user_id = auth.uid()
    OR public.is_admin_or_manager()
  );

CREATE POLICY "Admins and managers can insert users"
  ON public.app_users FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Admins and managers can delete users"
  ON public.app_users FOR DELETE
  USING (public.is_admin_or_manager());

-- ============================================
-- 4. PENDING_INVITES
-- ============================================
CREATE POLICY "Service role full access" ON public.pending_invites
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins and managers can manage pending invites"
  ON public.pending_invites FOR ALL
  USING (public.is_admin_or_manager());

-- ============================================
-- 5. PRINTED_INVENTORY_ENTRIES
-- ============================================
CREATE POLICY "Service role full access" ON public.printed_inventory_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own printed inventory entries"
  ON public.printed_inventory_entries FOR SELECT
  USING (created_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own printed inventory entries"
  ON public.printed_inventory_entries FOR INSERT
  WITH CHECK (created_by = current_user);

CREATE POLICY "Admins and managers can manage all printed inventory entries"
  ON public.printed_inventory_entries FOR ALL
  USING (public.is_admin_or_manager());

-- ============================================
-- 6. COST_DESIGNS
-- ============================================
CREATE POLICY "Service role full access" ON public.cost_designs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own cost designs"
  ON public.cost_designs FOR SELECT
  USING (created_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own cost designs"
  ON public.cost_designs FOR INSERT
  WITH CHECK (created_by = current_user);

CREATE POLICY "Users can update their own cost designs"
  ON public.cost_designs FOR UPDATE
  USING (created_by = current_user);

CREATE POLICY "Users can delete their own cost designs"
  ON public.cost_designs FOR DELETE
  USING (created_by = current_user);

-- ============================================
-- 7. ORDER_LEDGER
-- ============================================
CREATE POLICY "Service role full access" ON public.order_ledger
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own orders"
  ON public.order_ledger FOR SELECT
  USING (created_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own orders"
  ON public.order_ledger FOR INSERT
  WITH CHECK (created_by = current_user);

CREATE POLICY "Users can update their own orders"
  ON public.order_ledger FOR UPDATE
  USING (created_by = current_user);

CREATE POLICY "Users can delete their own orders"
  ON public.order_ledger FOR DELETE
  USING (created_by = current_user);

-- ============================================
-- 8. COST_DESIGN_CHANGE_REQUESTS
-- ============================================
CREATE POLICY "Service role full access" ON public.cost_design_change_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own change requests"
  ON public.cost_design_change_requests FOR SELECT
  USING (requested_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own change requests"
  ON public.cost_design_change_requests FOR INSERT
  WITH CHECK (requested_by = current_user);

CREATE POLICY "Users can update their own pending change requests"
  ON public.cost_design_change_requests FOR UPDATE
  USING (requested_by = current_user AND status = 'pending');

CREATE POLICY "Admins and managers can review change requests"
  ON public.cost_design_change_requests FOR UPDATE
  USING (public.is_admin_or_manager());

-- ============================================
-- 9. ORDER_LEDGER_CHANGE_REQUESTS
-- ============================================
CREATE POLICY "Service role full access" ON public.order_ledger_change_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own order change requests"
  ON public.order_ledger_change_requests FOR SELECT
  USING (requested_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own order change requests"
  ON public.order_ledger_change_requests FOR INSERT
  WITH CHECK (requested_by = current_user);

CREATE POLICY "Users can update their own pending order change requests"
  ON public.order_ledger_change_requests FOR UPDATE
  USING (requested_by = current_user AND status = 'pending');

CREATE POLICY "Admins and managers can review order change requests"
  ON public.order_ledger_change_requests FOR UPDATE
  USING (public.is_admin_or_manager());

-- ============================================
-- 10. DELETION_REQUESTS
-- ============================================
CREATE POLICY "Service role full access" ON public.deletion_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own deletion requests"
  ON public.deletion_requests FOR SELECT
  USING (requested_by = current_user OR public.is_admin_or_manager());

CREATE POLICY "Users can insert their own deletion requests"
  ON public.deletion_requests FOR INSERT
  WITH CHECK (requested_by = current_user);

CREATE POLICY "Users can update their own pending deletion requests"
  ON public.deletion_requests FOR UPDATE
  USING (requested_by = current_user AND status = 'pending');

CREATE POLICY "Admins and managers can review deletion requests"
  ON public.deletion_requests FOR UPDATE
  USING (public.is_admin_or_manager());

-- ============================================
-- 11. PUSH_SUBSCRIPTIONS
-- ============================================
CREATE POLICY "Service role full access" ON public.push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (
    app_user_id IN (SELECT id FROM public.app_users WHERE username = current_user)
    OR public.is_admin_or_manager()
  );

CREATE POLICY "Users can insert their own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.app_users WHERE username = current_user)
  );

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (
    app_user_id IN (SELECT id FROM public.app_users WHERE username = current_user)
  );

-- ============================================
-- 12. ORDER_LEDGER_ITEMS (new table for multi-keychain orders)
-- ============================================
CREATE POLICY "Service role full access" ON public.order_ledger_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own order items"
  ON public.order_ledger_items FOR SELECT
  USING (
    order_id IN (SELECT id FROM public.order_ledger WHERE created_by = current_user)
    OR public.is_admin_or_manager()
  );

CREATE POLICY "Users can insert their own order items"
  ON public.order_ledger_items FOR INSERT
  WITH CHECK (
    order_id IN (SELECT id FROM public.order_ledger WHERE created_by = current_user)
  );

CREATE POLICY "Users can update their own order items"
  ON public.order_ledger_items FOR UPDATE
  USING (
    order_id IN (SELECT id FROM public.order_ledger WHERE created_by = current_user)
  );

CREATE POLICY "Users can delete their own order items"
  ON public.order_ledger_items FOR DELETE
  USING (
    order_id IN (SELECT id FROM public.order_ledger WHERE created_by = current_user)
  );

CREATE POLICY "Admins and managers can manage all order items"
  ON public.order_ledger_items FOR ALL
  USING (public.is_admin_or_manager());