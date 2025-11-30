-- Check RLS policies for settings and user_profiles tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

-- =====================================================
-- SETTINGS TABLE POLICIES
-- =====================================================
SELECT
    'SETTINGS' as table_name,
    policyname,
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'settings'
ORDER BY policyname;

-- =====================================================
-- USER_PROFILES TABLE POLICIES
-- =====================================================
SELECT
    'USER_PROFILES' as table_name,
    policyname,
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_profiles'
ORDER BY policyname;

-- =====================================================
-- TEST: Check if a basic user can read settings
-- =====================================================
-- This will show what settings are accessible
SELECT key, description, account_id
FROM public.settings
ORDER BY key;
