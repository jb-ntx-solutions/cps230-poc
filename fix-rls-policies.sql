-- Fix RLS policies for INSERT operations
-- The issue: INSERT operations need WITH CHECK clause, not just USING clause
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

-- =====================================================
-- FIX CONTROLS POLICIES
-- =====================================================

-- Drop the existing "Promasters can modify controls" policy
DROP POLICY IF EXISTS "Promasters can modify controls" ON public.controls;

-- Recreate with separate policies for different operations
-- Policy for SELECT (viewing controls)
CREATE POLICY "Promasters can view controls"
    ON public.controls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Policy for INSERT (creating controls)
CREATE POLICY "Promasters can insert controls"
    ON public.controls FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Policy for UPDATE (updating controls)
CREATE POLICY "Promasters can update controls"
    ON public.controls FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Policy for DELETE (deleting controls)
CREATE POLICY "Promasters can delete controls"
    ON public.controls FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- =====================================================
-- FIX CRITICAL OPERATIONS POLICIES
-- =====================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Promasters can modify critical operations" ON public.critical_operations;

-- Recreate with separate policies
CREATE POLICY "Promasters can view critical operations"
    ON public.critical_operations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can insert critical operations"
    ON public.critical_operations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can update critical operations"
    ON public.critical_operations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can delete critical operations"
    ON public.critical_operations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- =====================================================
-- FIX SYSTEMS POLICIES
-- =====================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Promasters can modify systems" ON public.systems;

-- Recreate with separate policies
CREATE POLICY "Promasters can view systems"
    ON public.systems FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can insert systems"
    ON public.systems FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can update systems"
    ON public.systems FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can delete systems"
    ON public.systems FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- =====================================================
-- VERIFY POLICIES WERE CREATED
-- =====================================================

SELECT
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('controls', 'critical_operations', 'systems')
ORDER BY tablename, policyname;
