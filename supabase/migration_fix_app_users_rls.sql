-- RLS Policies for app_users (fixed for Google OAuth login)
-- Run in Supabase SQL Editor
-- This file drops and recreates policies to allow auth flow to work

-- Drop existing policies on app_users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.app_users;
DROP POLICY IF EXISTS "Admins and managers can view all users" ON public.app_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.app_users;
DROP POLICY IF EXISTS "Admins and managers can update any user" ON public.app_users;
DROP POLICY IF EXISTS "Admins and managers can insert users" ON public.app_users;
DROP POLICY IF EXISTS "Admins and managers can delete users" ON public.app_users;

-- Enable RLS (safe to run multiple times)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SELECT POLICIES
-- ============================================

-- Allow service role (server-side) full access - needed for auth flow
CREATE POLICY "Service role full access"
  ON public.app_users
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.app_users
  FOR SELECT
  USING (
    -- Match by username (for legacy cookie auth)
    username = current_user
    OR
    -- Match by email (for Google OAuth flow - allows findAppUserForSupabaseAuth to work)
    email = current_user
    OR
    -- Match by auth_user_id (for Google OAuth flow - allows findAppUserForSupabaseAuth to work)
    auth_user_id = auth.uid()
  );

-- Admins and managers can view all users
CREATE POLICY "Admins and managers can view all users"
  ON public.app_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE username = current_user
      AND role IN ('admin', 'manager')
      AND active = true
    )
  );

-- ============================================
-- UPDATE POLICIES
-- ============================================

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.app_users
  FOR UPDATE
  USING (
    username = current_user
    OR email = current_user
    OR auth_user_id = auth.uid()
  );

-- Admins and managers can update any user
CREATE POLICY "Admins and managers can update any user"
  ON public.app_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE username = current_user
      AND role IN ('admin', 'manager')
      AND active = true
    )
  );

-- ============================================
-- INSERT POLICIES
-- ============================================

-- Admins and managers can insert users
CREATE POLICY "Admins and managers can insert users"
  ON public.app_users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE username = current_user
      AND role IN ('admin', 'manager')
      AND active = true
    )
  );

-- ============================================
-- DELETE POLICIES
-- ============================================

-- Admins and managers can delete users
CREATE POLICY "Admins and managers can delete users"
  ON public.app_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE username = current_user
      AND role IN ('admin', 'manager')
      AND active = true
    )
  );

-- ============================================
-- GRANT PERMISSIONS (ensure service role has access)
-- ============================================
GRANT ALL ON public.app_users TO service_role;
GRANT ALL ON public.app_users TO authenticated;