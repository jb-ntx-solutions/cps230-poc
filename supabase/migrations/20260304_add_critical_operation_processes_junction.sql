-- Migration: Add critical_operation_processes junction table
-- This enables many-to-many relationship between critical operations and processes
-- Each critical operation can now have multiple processes associated with it

-- =====================================================
-- Create critical_operation_processes junction table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.critical_operation_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    critical_operation_id UUID NOT NULL REFERENCES public.critical_operations(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    process_step TEXT, -- Optional: Which step/phase of the critical operation uses this process
    activity_description TEXT, -- Optional: Description of how the process relates to the critical operation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    modified_by TEXT NOT NULL DEFAULT 'system',
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(critical_operation_id, process_id) -- Prevent duplicate relationships
);

-- =====================================================
-- Migrate existing data (only if process_id column exists)
-- =====================================================
-- Check if process_id column exists and migrate data if it does
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'critical_operations'
        AND column_name = 'process_id'
    ) THEN
        -- Move existing process_id relationships to the junction table
        INSERT INTO public.critical_operation_processes (critical_operation_id, process_id, modified_by)
        SELECT
            id,
            process_id,
            modified_by
        FROM public.critical_operations
        WHERE process_id IS NOT NULL;

        -- Drop the process_id column from critical_operations table
        ALTER TABLE public.critical_operations
        DROP COLUMN process_id;

        RAISE NOTICE 'Migrated existing process_id data and dropped column';
    ELSE
        RAISE NOTICE 'process_id column does not exist, skipping data migration';
    END IF;
END $$;

-- =====================================================
-- Enable Row Level Security
-- =====================================================
ALTER TABLE public.critical_operation_processes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view critical operation processes" ON public.critical_operation_processes;
DROP POLICY IF EXISTS "Promasters can insert critical operation processes" ON public.critical_operation_processes;
DROP POLICY IF EXISTS "Promasters can update critical operation processes" ON public.critical_operation_processes;
DROP POLICY IF EXISTS "Promasters can delete critical operation processes" ON public.critical_operation_processes;

-- SELECT: Authenticated users can view critical operation-process relationships
CREATE POLICY "Authenticated users can view critical operation processes"
ON public.critical_operation_processes
FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT: Promasters can create relationships
CREATE POLICY "Promasters can insert critical operation processes"
ON public.critical_operation_processes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
    )
);

-- UPDATE: Promasters can update relationships
CREATE POLICY "Promasters can update critical operation processes"
ON public.critical_operation_processes
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
    )
);

-- DELETE: Promasters can delete relationships
CREATE POLICY "Promasters can delete critical operation processes"
ON public.critical_operation_processes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
    )
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_critical_operation_processes_critical_op
    ON public.critical_operation_processes(critical_operation_id);

CREATE INDEX IF NOT EXISTS idx_critical_operation_processes_process
    ON public.critical_operation_processes(process_id);

-- Composite index for efficient lookups in both directions
CREATE INDEX IF NOT EXISTS idx_critical_operation_processes_both
    ON public.critical_operation_processes(critical_operation_id, process_id);

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE public.critical_operation_processes IS 'Junction table for many-to-many relationship between critical operations and processes';
COMMENT ON COLUMN public.critical_operation_processes.process_step IS 'Optional: Identifies which step or phase of the critical operation this process is part of';
COMMENT ON COLUMN public.critical_operation_processes.activity_description IS 'Optional: Description of how this process supports or relates to the critical operation';
