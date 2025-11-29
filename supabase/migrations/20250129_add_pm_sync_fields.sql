-- Migration to add Process Manager sync fields
-- Adds fields needed to track Process Manager IDs and support multi-tenancy

-- Add pm_tag_id to systems table to track Process Manager tag IDs
ALTER TABLE public.systems
ADD COLUMN IF NOT EXISTS pm_tag_id TEXT;

-- Add pm_process_id to processes table to track Process Manager process IDs
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS pm_process_id INTEGER;

-- Add account_id to all tables for multi-tenancy
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.systems
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.critical_operations
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.controls
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.sync_history
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_systems_pm_tag_id ON public.systems(pm_tag_id);
CREATE INDEX IF NOT EXISTS idx_processes_pm_process_id ON public.processes(pm_process_id);
CREATE INDEX IF NOT EXISTS idx_processes_account_id ON public.processes(account_id);
CREATE INDEX IF NOT EXISTS idx_systems_account_id ON public.systems(account_id);
CREATE INDEX IF NOT EXISTS idx_critical_operations_account_id ON public.critical_operations(account_id);
CREATE INDEX IF NOT EXISTS idx_controls_account_id ON public.controls(account_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_id ON public.user_profiles(account_id);

-- Update unique constraints to include account_id for multi-tenancy
ALTER TABLE public.systems DROP CONSTRAINT IF EXISTS systems_system_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS systems_system_id_account_unique
ON public.systems(system_id, account_id);

ALTER TABLE public.processes DROP CONSTRAINT IF EXISTS processes_process_unique_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS processes_unique_id_account_unique
ON public.processes(process_unique_id, account_id);

-- Add unique constraint for pm_tag_id per account
CREATE UNIQUE INDEX IF NOT EXISTS systems_pm_tag_id_account_unique
ON public.systems(pm_tag_id, account_id) WHERE pm_tag_id IS NOT NULL;

-- Add unique constraint for pm_process_id per account
CREATE UNIQUE INDEX IF NOT EXISTS processes_pm_id_account_unique
ON public.processes(pm_process_id, account_id) WHERE pm_process_id IS NOT NULL;

-- Update RLS policies to include account_id filtering
-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Authenticated users can view processes" ON public.processes;
DROP POLICY IF EXISTS "Authenticated users can view systems" ON public.systems;
DROP POLICY IF EXISTS "Authenticated users can view critical operations" ON public.critical_operations;
DROP POLICY IF EXISTS "Authenticated users can view controls" ON public.controls;

-- Recreate policies with account filtering
CREATE POLICY "Authenticated users can view processes"
    ON public.processes FOR SELECT
    USING (
        auth.role() = 'authenticated' AND
        (account_id IS NULL OR account_id IN (
            SELECT account_id FROM public.user_profiles WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Authenticated users can view systems"
    ON public.systems FOR SELECT
    USING (
        auth.role() = 'authenticated' AND
        (account_id IS NULL OR account_id IN (
            SELECT account_id FROM public.user_profiles WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Authenticated users can view critical operations"
    ON public.critical_operations FOR SELECT
    USING (
        auth.role() = 'authenticated' AND
        (account_id IS NULL OR account_id IN (
            SELECT account_id FROM public.user_profiles WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Authenticated users can view controls"
    ON public.controls FOR SELECT
    USING (
        auth.role() = 'authenticated' AND
        (account_id IS NULL OR account_id IN (
            SELECT account_id FROM public.user_profiles WHERE user_id = auth.uid()
        ))
    );
