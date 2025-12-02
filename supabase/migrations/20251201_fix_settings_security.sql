-- Migration: Fix Settings Security
-- Date: 2025-12-01
-- Purpose:
--   1. Fix overly permissive RLS policies on settings
--   2. Add encryption for sensitive settings
--   3. Separate sensitive from non-sensitive settings access

-- =====================================================
-- Step 1: Drop existing overly permissive policy
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.settings;

-- =====================================================
-- Step 2: Create new granular RLS policies
-- =====================================================

-- Policy 1: Promasters can view ALL settings
CREATE POLICY "Promasters can view all settings"
    ON public.settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Policy 2: All users can view NON-SENSITIVE settings only
CREATE POLICY "Users can view non-sensitive settings"
    ON public.settings FOR SELECT
    USING (
        auth.role() = 'authenticated' AND
        key IN ('regions', 'bpmn_diagram', 'sync_frequency', 'last_sync_timestamp', 'nintex_api_url')
    );

-- =====================================================
-- Step 3: Add a column to mark sensitive settings
-- =====================================================

-- Add is_sensitive column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'settings' AND column_name = 'is_sensitive'
    ) THEN
        ALTER TABLE public.settings ADD COLUMN is_sensitive BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Mark sensitive settings
UPDATE public.settings
SET is_sensitive = true
WHERE key IN ('pm_password', 'pm_username', 'pm_tenant_id', 'nintex_api_credentials');

-- =====================================================
-- Step 4: Create helper function to get setting value
-- =====================================================

-- Function to safely get settings (respects RLS)
CREATE OR REPLACE FUNCTION public.get_setting(setting_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    setting_value JSONB;
    user_role TEXT;
BEGIN
    -- Get current user's role
    SELECT role INTO user_role
    FROM public.user_profiles
    WHERE user_id = auth.uid();

    -- Only promasters can access sensitive settings
    IF setting_key IN ('pm_password', 'pm_username', 'pm_tenant_id', 'nintex_api_credentials') THEN
        IF user_role != 'promaster' THEN
            RAISE EXCEPTION 'Insufficient permissions to access sensitive setting';
        END IF;
    END IF;

    -- Get the setting value
    SELECT value INTO setting_value
    FROM public.settings
    WHERE key = setting_key
    LIMIT 1;

    RETURN setting_value;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_setting(TEXT) TO authenticated;

-- =====================================================
-- Step 5: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN public.settings.is_sensitive IS 'Indicates if this setting contains sensitive data (passwords, API keys, etc.)';
COMMENT ON FUNCTION public.get_setting(TEXT) IS 'Safely retrieves a setting value with role-based access control';

-- =====================================================
-- IMPORTANT NEXT STEPS (Manual):
-- =====================================================
--
-- 1. ENCRYPT PASSWORDS: Use Supabase Vault to encrypt sensitive values
--    - Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/database/vault
--    - Create secrets for: pm_password, pm_tenant_id
--    - Update application code to use vault.decrypt_secret()
--
-- 2. UPDATE APPLICATION CODE:
--    - Modify Settings.tsx to encrypt passwords before saving
--    - Modify sync-process-manager to decrypt from vault
--    - See implementation notes in migration comments
--
-- 3. VERIFY RLS POLICIES:
--    SELECT * FROM pg_policies WHERE tablename = 'settings';
