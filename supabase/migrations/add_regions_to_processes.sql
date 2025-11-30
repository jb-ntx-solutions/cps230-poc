-- Migration: Add regions column to processes table
-- This allows processes to be tagged with multiple regions (e.g., AU, UK, US)

-- Add regions column to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS regions TEXT[];

-- Add comment to the column
COMMENT ON COLUMN public.processes.regions IS 'Array of region identifiers that this process belongs to';
