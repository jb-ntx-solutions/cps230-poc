-- =====================================================
-- URGENT: Run this SQL NOW to fix all three errors
-- Copy this entire file and paste it into:
-- https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new
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

-- Add regions column to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS regions TEXT[];

-- Verify columns were added
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('processes', 'critical_operations', 'controls', 'systems')
  AND column_name IN ('regions', 'account_id')
ORDER BY table_name, column_name;

-- You should see 6 rows returned:
-- controls.account_id
-- controls.regions
-- critical_operations.account_id
-- processes.account_id
-- processes.regions
-- systems.account_id
