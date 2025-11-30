-- Migration: Add missing columns for multi-tenancy and regions
-- This allows proper account isolation and regional process tracking

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

-- Add comment to the column
COMMENT ON COLUMN public.processes.regions IS 'Array of region identifiers that this process belongs to';
