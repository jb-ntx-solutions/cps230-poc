-- Fix user profile creation during signup
-- Problem: New users can't create their own profile due to RLS policies
-- Solution: Allow authenticated users to insert their own profile if they don't have one

-- Add a policy that allows users to insert their own profile
-- This is needed during signup when the user doesn't have a profile yet
CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Note: The existing "Promasters can insert profiles in their account" policy
-- handles the case where promasters create profiles for other users.
-- This new policy handles the initial profile creation during signup.
