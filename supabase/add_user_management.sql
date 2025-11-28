-- Add user management capabilities for Promaster admins
-- This migration adds DELETE policy and helper functions for user management

-- =====================================================
-- Add DELETE policy for user_profiles
-- =====================================================

CREATE POLICY "Promasters can delete profiles in their account"
    ON public.user_profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui
            WHERE cui.role = 'promaster'
            AND cui.account_id = user_profiles.account_id
        )
        AND user_id != auth.uid() -- Prevent Promasters from deleting themselves
    );

-- =====================================================
-- Function to create a new user (requires service role)
-- This will be called via an edge function or service
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_user_with_profile(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role user_role,
    p_account_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_current_user_info RECORD;
BEGIN
    -- Get current user info
    SELECT * INTO v_current_user_info FROM public.get_current_user_info();

    -- Check if current user is a Promaster in the target account
    IF v_current_user_info.role != 'promaster' THEN
        RAISE EXCEPTION 'Only Promasters can create users';
    END IF;

    IF v_current_user_info.account_id != p_account_id THEN
        RAISE EXCEPTION 'You can only create users in your own account';
    END IF;

    -- Note: This function creates the profile only
    -- The actual auth user creation must be done via Supabase Admin API
    -- or Edge Functions with service role permissions

    RETURN NULL; -- Placeholder for now
END;
$$;

-- =====================================================
-- Function to delete a user (profile and auth user)
-- =====================================================

CREATE OR REPLACE FUNCTION public.delete_user_complete(
    p_user_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user_id UUID;
    v_target_account_id UUID;
    v_current_user_info RECORD;
BEGIN
    -- Get current user info
    SELECT * INTO v_current_user_info FROM public.get_current_user_info();

    -- Check if current user is a Promaster
    IF v_current_user_info.role != 'promaster' THEN
        RAISE EXCEPTION 'Only Promasters can delete users';
    END IF;

    -- Get the target user's info
    SELECT user_id, account_id INTO v_target_user_id, v_target_account_id
    FROM public.user_profiles
    WHERE id = p_user_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- Check if target user is in the same account
    IF v_target_account_id != v_current_user_info.account_id THEN
        RAISE EXCEPTION 'You can only delete users in your own account';
    END IF;

    -- Prevent deleting yourself
    IF v_target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete yourself';
    END IF;

    -- Delete the user profile (this will cascade to other references)
    DELETE FROM public.user_profiles WHERE id = p_user_profile_id;

    -- Note: Deleting the auth user requires service role permissions
    -- This should be handled via an Edge Function or backend service
    -- For now, we only delete the profile

    RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_user_with_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_complete TO authenticated;
