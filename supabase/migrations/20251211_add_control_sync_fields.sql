-- Migration to add control sync fields and process_controls junction table
-- Adds fields needed to track controls from Process Manager and link them to processes

-- Add pm_control_id to controls table to track Process Manager control IDs
ALTER TABLE public.controls
ADD COLUMN IF NOT EXISTS pm_control_id TEXT;

-- Create process_controls junction table for many-to-many relationship
-- Similar to process_systems table
CREATE TABLE IF NOT EXISTS public.process_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES public.controls(id) ON DELETE CASCADE,
    process_step TEXT,
    activity_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(process_id, control_id, process_step)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_controls_pm_control_id ON public.controls(pm_control_id);
CREATE INDEX IF NOT EXISTS idx_process_controls_process_id ON public.process_controls(process_id);
CREATE INDEX IF NOT EXISTS idx_process_controls_control_id ON public.process_controls(control_id);

-- Add unique constraint for pm_control_id per account (to prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS controls_pm_control_id_account_unique
ON public.controls(pm_control_id, account_id) WHERE pm_control_id IS NOT NULL;

-- Enable RLS on process_controls table
ALTER TABLE public.process_controls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for process_controls table
CREATE POLICY "Authenticated users can view process_controls"
    ON public.process_controls FOR SELECT
    USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.processes p
            WHERE p.id = process_controls.process_id
            AND (p.account_id IS NULL OR p.account_id IN (
                SELECT account_id FROM public.user_profiles WHERE user_id = auth.uid()
            ))
        )
    );

CREATE POLICY "Promasters can modify process_controls"
    ON public.process_controls FOR ALL
    USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );
