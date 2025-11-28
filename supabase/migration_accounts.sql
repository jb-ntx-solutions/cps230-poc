-- Migration: Add Accounts and Multi-tenancy Support
-- This migration adds account-based multi-tenancy to the CPS230 application
-- All users and data will be scoped to an account based on email domain

-- =====================================================
-- Step 1: Create Accounts Table (without RLS policies yet)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name TEXT NOT NULL,
    email_domain TEXT NOT NULL UNIQUE, -- e.g., 'example.com'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on accounts table (policies will be added later)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_email_domain ON public.accounts(email_domain);

-- =====================================================
-- Step 2: Add account_id columns to all tables
-- =====================================================

-- Add to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Create index for account_id on user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_id ON public.user_profiles(account_id);

-- Add to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_processes_account_id ON public.processes(account_id);

-- Add to systems table
ALTER TABLE public.systems
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_systems_account_id ON public.systems(account_id);

-- Add to critical_operations table
ALTER TABLE public.critical_operations
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_critical_operations_account_id ON public.critical_operations(account_id);

-- Add to controls table
ALTER TABLE public.controls
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_controls_account_id ON public.controls(account_id);

-- Add to settings table (settings are now per-account)
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_settings_account_id ON public.settings(account_id);

-- Add to sync_history table
ALTER TABLE public.sync_history
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sync_history_account_id ON public.sync_history(account_id);

-- =====================================================
-- Step 3: Create/Update Row Level Security Policies
-- Now that all account_id columns exist, we can create policies
-- =====================================================

-- First, create policies for accounts table
CREATE POLICY "Users can view their own account"
    ON public.accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.account_id = accounts.id
        )
    );

CREATE POLICY "Promasters can update their account"
    ON public.accounts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.account_id = accounts.id
            AND user_profiles.role = 'promaster'
        )
    );

-- Drop old user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Promasters can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Promasters can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Promasters can insert profiles" ON public.user_profiles;

-- New user_profiles policies (account-scoped)
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Promasters can view all profiles in their account"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.user_id = auth.uid()
            AND up.role = 'promaster'
            AND up.account_id = user_profiles.account_id
        )
    );

CREATE POLICY "Promasters can update profiles in their account"
    ON public.user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.user_id = auth.uid()
            AND up.role = 'promaster'
            AND up.account_id = user_profiles.account_id
        )
    );

-- Update Processes Policies (account-scoped)
DROP POLICY IF EXISTS "Authenticated users can view processes" ON public.processes;
DROP POLICY IF EXISTS "Business Analysts and Promasters can modify processes" ON public.processes;

CREATE POLICY "Users can view processes in their account"
    ON public.processes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND account_id = processes.account_id
        )
    );

CREATE POLICY "Business Analysts and Promasters can modify processes in their account"
    ON public.processes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role IN ('business_analyst', 'promaster')
            AND account_id = processes.account_id
        )
    );

-- Update Systems Policies (account-scoped)
DROP POLICY IF EXISTS "Authenticated users can view systems" ON public.systems;
DROP POLICY IF EXISTS "Promasters can modify systems" ON public.systems;

CREATE POLICY "Users can view systems in their account"
    ON public.systems FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND account_id = systems.account_id
        )
    );

CREATE POLICY "Promasters can modify systems in their account"
    ON public.systems FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role = 'promaster'
            AND account_id = systems.account_id
        )
    );

-- Update Process-Systems Policies (account-scoped via join)
DROP POLICY IF EXISTS "Authenticated users can view process-systems" ON public.process_systems;
DROP POLICY IF EXISTS "Promasters can modify process-systems" ON public.process_systems;

CREATE POLICY "Users can view process-systems in their account"
    ON public.process_systems FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.processes p ON p.account_id = up.account_id
            WHERE up.user_id = auth.uid()
            AND p.id = process_systems.process_id
        )
    );

CREATE POLICY "Promasters can modify process-systems in their account"
    ON public.process_systems FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.processes p ON p.account_id = up.account_id
            WHERE up.user_id = auth.uid()
            AND up.role = 'promaster'
            AND p.id = process_systems.process_id
        )
    );

-- Update Critical Operations Policies (account-scoped)
DROP POLICY IF EXISTS "Authenticated users can view critical operations" ON public.critical_operations;
DROP POLICY IF EXISTS "Promasters can modify critical operations" ON public.critical_operations;

CREATE POLICY "Users can view critical operations in their account"
    ON public.critical_operations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND account_id = critical_operations.account_id
        )
    );

CREATE POLICY "Promasters can modify critical operations in their account"
    ON public.critical_operations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role = 'promaster'
            AND account_id = critical_operations.account_id
        )
    );

-- Update Controls Policies (account-scoped)
DROP POLICY IF EXISTS "Authenticated users can view controls" ON public.controls;
DROP POLICY IF EXISTS "Promasters can modify controls" ON public.controls;

CREATE POLICY "Users can view controls in their account"
    ON public.controls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND account_id = controls.account_id
        )
    );

CREATE POLICY "Promasters can modify controls in their account"
    ON public.controls FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role = 'promaster'
            AND account_id = controls.account_id
        )
    );

-- Update Settings Policies (account-scoped)
DROP POLICY IF EXISTS "Promasters can view settings" ON public.settings;
DROP POLICY IF EXISTS "Promasters can modify settings" ON public.settings;

CREATE POLICY "Promasters can view settings in their account"
    ON public.settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role = 'promaster'
            AND account_id = settings.account_id
        )
    );

CREATE POLICY "Promasters can modify settings in their account"
    ON public.settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role = 'promaster'
            AND account_id = settings.account_id
        )
    );

-- Update Sync History Policies (account-scoped)
DROP POLICY IF EXISTS "Authenticated users can view sync history" ON public.sync_history;
DROP POLICY IF EXISTS "Promasters can insert sync history" ON public.sync_history;

CREATE POLICY "Users can view sync history in their account"
    ON public.sync_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND account_id = sync_history.account_id
        )
    );

CREATE POLICY "Promasters can insert sync history in their account"
    ON public.sync_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role = 'promaster'
            AND account_id = sync_history.account_id
        )
    );

-- =====================================================
-- Step 4: Functions for account-aware signup
-- =====================================================

-- Function to get or create account by email domain
-- This function is callable from the client side
CREATE OR REPLACE FUNCTION public.get_or_create_account_by_email(user_email TEXT, account_name_param TEXT DEFAULT NULL)
RETURNS TABLE (
    account_id UUID,
    is_first_user BOOLEAN,
    account_exists BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    user_email_domain TEXT;
    existing_account_id UUID;
    new_account_id UUID;
    is_first BOOLEAN;
BEGIN
    -- Extract domain from email (everything after @)
    user_email_domain := LOWER(SPLIT_PART(user_email, '@', 2));

    -- Check if account exists for this domain
    SELECT id INTO existing_account_id
    FROM public.accounts
    WHERE accounts.email_domain = user_email_domain;

    IF existing_account_id IS NOT NULL THEN
        -- Account exists, user is not first
        RETURN QUERY SELECT existing_account_id, FALSE, TRUE;
    ELSE
        -- Account doesn't exist, create it
        -- If no account name provided, use domain as default
        INSERT INTO public.accounts (account_name, email_domain)
        VALUES (
            COALESCE(account_name_param, user_email_domain),
            user_email_domain
        )
        RETURNING id INTO new_account_id;

        -- This is the first user
        RETURN QUERY SELECT new_account_id, TRUE, FALSE;
    END IF;
END;
$$;

-- Function to create user profile with account
-- This replaces the old handle_new_user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_user_profile_with_account(
    user_id_param UUID,
    user_email TEXT,
    account_id_param UUID,
    is_first_user BOOLEAN,
    full_name_param TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    profile_id UUID;
    user_role user_role;
BEGIN
    -- Set role based on whether this is the first user for the account
    IF is_first_user THEN
        user_role := 'promaster';
    ELSE
        user_role := 'user';
    END IF;

    -- Create user profile
    INSERT INTO public.user_profiles (user_id, email, account_id, role, full_name)
    VALUES (user_id_param, user_email, account_id_param, user_role, full_name_param)
    RETURNING id INTO profile_id;

    -- If this is the first user (promaster), create default settings for the account
    IF is_first_user THEN
        INSERT INTO public.settings (key, value, description, modified_by, account_id) VALUES
            ('nintex_api_url', '""', 'Nintex Process Manager API base URL', user_email, account_id_param),
            ('nintex_api_credentials', '{"username": "", "password": ""}', 'Nintex Process Manager API credentials (encrypted)', user_email, account_id_param),
            ('available_regions', '["AU", "UK", "US"]', 'Available regions for controls', user_email, account_id_param),
            ('sync_frequency', '"manual"', 'How often to sync with Nintex (manual, daily, weekly)', user_email, account_id_param),
            ('last_sync_timestamp', 'null', 'Timestamp of last successful sync', user_email, account_id_param);
    END IF;

    RETURN profile_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_account_by_email(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile_with_account(UUID, TEXT, UUID, BOOLEAN, TEXT) TO authenticated, anon;

-- Trigger for accounts updated_at
CREATE TRIGGER set_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Migration Notes
-- =====================================================
-- After running this migration:
-- 1. Update the signup flow in the application to:
--    a. Call get_or_create_account_by_email() with the user's email
--    b. If is_first_user is true, prompt for account name
--    c. Create the Supabase auth user
--    d. Call create_user_profile_with_account() to create the profile
-- 2. All existing data will need account_id populated if migrating existing data
-- 3. The application signup flow must be updated to handle the two-step process
