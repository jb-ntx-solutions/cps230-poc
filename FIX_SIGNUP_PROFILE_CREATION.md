# 🚨 Fix: User Profile Not Created During Signup

## The Problem
When users sign up, they're added to the Authentication table but **no user profile is created** in the `user_profiles` table.

## Root Cause
The Row Level Security (RLS) INSERT policy on `user_profiles` only allows Promasters to insert profiles. But new users don't have profiles yet, creating a chicken-and-egg problem that blocks profile creation.

## The Fix (Takes 1 minute)

### Step 1: Open Supabase SQL Editor
Click this link and replace with your project ID:
`https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new`

Or navigate to: **SQL Editor** → **New query**

### Step 2: Copy and Run the SQL
Copy this SQL and run it in the SQL Editor:

```sql
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
```

### Step 3: Test
1. Try signing up with a new email address
2. Check the `user_profiles` table - you should now see the profile created
3. The user should be properly logged in with their profile data

## What This Does
- Adds an INSERT policy that allows users to create their own profile during signup
- The policy checks that the user creating the profile matches the `user_id` being inserted
- Existing profiles and promaster functionality remain unchanged

## Verification Query
After applying the fix, you can verify the policy exists:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_profiles' AND cmd = 'INSERT';
```

You should see two INSERT policies:
1. `Users can insert their own profile` - For new user signup
2. `Promasters can insert profiles in their account` - For promaster admin functions

## Need Help?
- Check Supabase logs for detailed error messages
- Verify the migration scripts have been applied in order:
  1. `migration_accounts.sql`
  2. `fix_rls_recursion.sql`
  3. `fix_user_profile_insert.sql` (this fix)
