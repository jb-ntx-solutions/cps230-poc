-- Migration: Add missing columns for multi-tenancy and regions
-- Run this in your Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

-- =====================================================
-- STEP 1: Add account_id to all tables for multi-tenancy
-- =====================================================

-- Add account_id to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Add account_id to critical_operations table
ALTER TABLE public.critical_operations
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Add account_id to controls table
ALTER TABLE public.controls
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Add account_id to systems table
ALTER TABLE public.systems
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- =====================================================
-- STEP 2: Add regions column to processes table
-- =====================================================

ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS regions TEXT[];

COMMENT ON COLUMN public.processes.regions IS 'Array of region identifiers that this process belongs to';

-- =====================================================
-- STEP 3: Verify all columns were added successfully
-- =====================================================

SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('processes', 'critical_operations', 'controls', 'systems')
  AND column_name IN ('regions', 'account_id')
ORDER BY table_name, column_name;

-- Expected output:
-- table_name           | column_name | data_type | is_nullable
-- ---------------------+-------------+-----------+------------
-- controls             | account_id  | uuid      | YES
-- controls             | regions     | ARRAY     | YES
-- critical_operations  | account_id  | uuid      | YES
-- processes            | account_id  | uuid      | YES
-- processes            | regions     | ARRAY     | YES
-- systems              | account_id  | uuid      | YES
