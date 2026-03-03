-- Fix RLS policies for critical_operations to include account_id validation
-- This ensures users can only create/modify critical operations for their own account

-- Drop all existing policies (old and new)
DROP POLICY IF EXISTS "Promasters can modify critical operations" ON public.critical_operations;
DROP POLICY IF EXISTS "Business Analysts and Promasters can modify critical operations" ON public.critical_operations;
DROP POLICY IF EXISTS "Promasters can insert critical operations" ON public.critical_operations;
DROP POLICY IF EXISTS "Promasters can update critical operations" ON public.critical_operations;
DROP POLICY IF EXISTS "Promasters can delete critical operations" ON public.critical_operations;

-- Create separate policies for INSERT, UPDATE, DELETE with account validation
-- This follows the same pattern as sync_history

-- INSERT: Promasters can insert critical operations for their account
CREATE POLICY "Promasters can insert critical operations"
ON public.critical_operations
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
        AND account_id = critical_operations.account_id
    )
);

-- UPDATE: Promasters can update critical operations for their account
CREATE POLICY "Promasters can update critical operations"
ON public.critical_operations
FOR UPDATE
USING (
    account_id IN (
        SELECT account_id FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
    )
);

-- DELETE: Promasters can delete critical operations for their account
CREATE POLICY "Promasters can delete critical operations"
ON public.critical_operations
FOR DELETE
USING (
    account_id IN (
        SELECT account_id FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
    )
);
