-- =====================================================
-- CONSOLIDATED FIX: Infinite Recursion + User Profile Insert
-- Apply this script to fix both issues at once
-- =====================================================

-- =====================================================
-- Part 1: Fix infinite recursion in RLS policies
-- Creates a security definer function to bypass RLS
-- =====================================================

-- Helper function to get current user's profile info
-- This bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE (
    user_id UUID,
    account_id UUID,
    role user_role
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT user_id, account_id, role
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
    LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_info() TO authenticated;

-- =====================================================
-- Drop all existing policies
-- =====================================================

-- user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Promasters can view all profiles in their account" ON public.user_profiles;
DROP POLICY IF EXISTS "Promasters can update profiles in their account" ON public.user_profiles;
DROP POLICY IF EXISTS "Promasters can insert profiles in their account" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

-- accounts policies
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
DROP POLICY IF EXISTS "Promasters can update their account" ON public.accounts;

-- processes policies
DROP POLICY IF EXISTS "Users can view processes in their account" ON public.processes;
DROP POLICY IF EXISTS "Business Analysts and Promasters can modify processes in their account" ON public.processes;

-- systems policies
DROP POLICY IF EXISTS "Users can view systems in their account" ON public.systems;
DROP POLICY IF EXISTS "Promasters can modify systems in their account" ON public.systems;

-- process_systems policies
DROP POLICY IF EXISTS "Users can view process-systems in their account" ON public.process_systems;
DROP POLICY IF EXISTS "Promasters can modify process-systems in their account" ON public.process_systems;

-- critical_operations policies
DROP POLICY IF EXISTS "Users can view critical operations in their account" ON public.critical_operations;
DROP POLICY IF EXISTS "Promasters can modify critical operations in their account" ON public.critical_operations;

-- controls policies
DROP POLICY IF EXISTS "Users can view controls in their account" ON public.controls;
DROP POLICY IF EXISTS "Promasters can modify controls in their account" ON public.controls;

-- settings policies
DROP POLICY IF EXISTS "Promasters can view settings in their account" ON public.settings;
DROP POLICY IF EXISTS "Promasters can modify settings in their account" ON public.settings;

-- sync_history policies
DROP POLICY IF EXISTS "Users can view sync history in their account" ON public.sync_history;
DROP POLICY IF EXISTS "Promasters can insert sync history in their account" ON public.sync_history;

-- =====================================================
-- Recreate user_profiles policies WITHOUT recursion
-- =====================================================

-- Users can always view their own profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Promasters can view all profiles in their account
CREATE POLICY "Promasters can view all profiles in their account"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = user_profiles.account_id
        )
    );

-- Promasters can update profiles in their account
CREATE POLICY "Promasters can update profiles in their account"
    ON public.user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = user_profiles.account_id
        )
    );

-- Promasters can insert new profiles in their account
CREATE POLICY "Promasters can insert profiles in their account"
    ON public.user_profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = user_profiles.account_id
        )
    );

-- Part 2: Allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Accounts policies
-- =====================================================

CREATE POLICY "Users can view their own account"
    ON public.accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.account_id = accounts.id
        )
    );

CREATE POLICY "Promasters can update their account"
    ON public.accounts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = accounts.id
        )
    );

-- =====================================================
-- Processes policies
-- =====================================================

CREATE POLICY "Users can view processes in their account"
    ON public.processes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.account_id = processes.account_id
        )
    );

CREATE POLICY "Business Analysts and Promasters can modify processes in their account"
    ON public.processes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role IN ('business_analyst', 'promaster')
            AND cui.account_id = processes.account_id
        )
    );

-- =====================================================
-- Systems policies
-- =====================================================

CREATE POLICY "Users can view systems in their account"
    ON public.systems FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.account_id = systems.account_id
        )
    );

CREATE POLICY "Promasters can modify systems in their account"
    ON public.systems FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = systems.account_id
        )
    );

-- =====================================================
-- Process-Systems policies
-- =====================================================

CREATE POLICY "Users can view process-systems in their account"
    ON public.process_systems FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            JOIN public.processes p ON p.account_id = cui.account_id
            WHERE p.id = process_systems.process_id
        )
    );

CREATE POLICY "Promasters can modify process-systems in their account"
    ON public.process_systems FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            JOIN public.processes p ON p.account_id = cui.account_id
            WHERE cui.role = 'promaster'
            AND p.id = process_systems.process_id
        )
    );

-- =====================================================
-- Critical Operations policies
-- =====================================================

CREATE POLICY "Users can view critical operations in their account"
    ON public.critical_operations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.account_id = critical_operations.account_id
        )
    );

CREATE POLICY "Promasters can modify critical operations in their account"
    ON public.critical_operations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = critical_operations.account_id
        )
    );

-- =====================================================
-- Controls policies
-- =====================================================

CREATE POLICY "Users can view controls in their account"
    ON public.controls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.account_id = controls.account_id
        )
    );

CREATE POLICY "Promasters can modify controls in their account"
    ON public.controls FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = controls.account_id
        )
    );

-- =====================================================
-- Settings policies
-- =====================================================

CREATE POLICY "Promasters can view settings in their account"
    ON public.settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = settings.account_id
        )
    );

CREATE POLICY "Promasters can modify settings in their account"
    ON public.settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = settings.account_id
        )
    );

-- =====================================================
-- Sync History policies
-- =====================================================

CREATE POLICY "Users can view sync history in their account"
    ON public.sync_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.account_id = sync_history.account_id
        )
    );

CREATE POLICY "Promasters can insert sync history in their account"
    ON public.sync_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = sync_history.account_id
        )
    );

-- =====================================================
-- Migration Complete!
-- =====================================================
-- This fixes both:
-- ✅ Infinite recursion in RLS policies
-- ✅ User profile creation during signup
-- =====================================================
