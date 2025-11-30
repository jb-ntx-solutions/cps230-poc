-- Fix RLS policies for settings table to allow all authenticated users to read settings
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Promasters can view settings" ON public.settings;

-- Create new policy: All authenticated users can read settings
CREATE POLICY "Authenticated users can view settings"
    ON public.settings FOR SELECT
    USING (auth.role() = 'authenticated');

-- Keep the modification policy restricted to Promasters (no change needed)
-- "Promasters can modify settings" policy remains as is

-- Verify the policies
SELECT
    policyname,
    cmd as operation,
    roles,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'settings'
ORDER BY policyname;
