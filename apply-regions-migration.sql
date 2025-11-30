-- Migration: Add regions column to processes table
-- Run this in your Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

-- Step 1: Add regions column to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS regions TEXT[];

-- Step 2: Add comment to the column
COMMENT ON COLUMN public.processes.regions IS 'Array of region identifiers that this process belongs to';

-- Step 3: Verify the column was added successfully
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'processes'
  AND column_name IN ('regions', 'account_id')
ORDER BY column_name;

-- Expected output:
-- column_name | data_type     | is_nullable
-- ------------+---------------+------------
-- account_id  | uuid          | YES
-- regions     | ARRAY         | YES
