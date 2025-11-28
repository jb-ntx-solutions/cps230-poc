# RLS Infinite Recursion Fix Migration

## Problem

The application was experiencing severe performance issues with errors like:
```
{
    "code": "42P17",
    "message": "infinite recursion detected in policy for relation \"user_profiles\""
}
```

### Root Cause

The RLS policies on `user_profiles` and other tables were querying the `user_profiles` table from within the policy itself, creating infinite recursion:

```sql
-- ❌ PROBLEMATIC POLICY - Creates infinite loop
CREATE POLICY "Promasters can view all profiles in their account"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles  -- ⚠️ Queries user_profiles from within user_profiles policy!
            WHERE user_id = auth.uid() AND role = 'promaster'
            AND account_id = user_profiles.account_id
        )
    );
```

When PostgreSQL tries to check if a user can view a profile:
1. It executes the policy
2. The policy queries `user_profiles`
3. This triggers the RLS policies on `user_profiles` again
4. Which queries `user_profiles` again...
5. **Infinite loop!**

## Solution

The fix creates a `SECURITY DEFINER` function that bypasses RLS to get the current user's information:

```sql
-- ✅ HELPER FUNCTION - Bypasses RLS to prevent recursion
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE (user_id UUID, account_id UUID, role user_role)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT user_id, account_id, role
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
    LIMIT 1;
$$;

-- ✅ FIXED POLICY - Uses helper function
CREATE POLICY "Promasters can view all profiles in their account"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.get_current_user_info() cui  -- Uses function instead!
            WHERE cui.role = 'promaster'
            AND cui.account_id = user_profiles.account_id
        )
    );
```

The `SECURITY DEFINER` function runs with elevated privileges and bypasses RLS, so there's no recursion.

## How to Apply

### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Copy the entire contents of `supabase/fix_rls_recursion.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Wait for completion (should take a few seconds)

**Dashboard URL**: https://app.supabase.com/project/rdqavrqfisyzwfqhckcp/sql/new

### Option 2: Manual Copy-Paste

If you prefer, you can copy the SQL from the file and run it in sections:

1. Open `supabase/fix_rls_recursion.sql`
2. Copy the entire file contents
3. Open Supabase SQL Editor
4. Paste and run

## What This Migration Does

1. **Creates helper function** `get_current_user_info()` that safely retrieves the current user's profile info without triggering RLS
2. **Drops all existing RLS policies** on all tables
3. **Recreates all policies** using the helper function to prevent recursion
4. **Improves performance** - the helper function is marked as `STABLE` and can be cached

## Tables Updated

The migration updates RLS policies for:
- ✅ `user_profiles`
- ✅ `accounts`
- ✅ `processes`
- ✅ `systems`
- ✅ `process_systems`
- ✅ `critical_operations`
- ✅ `controls`
- ✅ `settings`
- ✅ `sync_history`

## After Migration

Once applied, you should see:
- ✅ **No more infinite recursion errors**
- ✅ **Dramatically faster page loads** (from seconds to milliseconds)
- ✅ **Signup flow works correctly** - account name dialog will appear for first-time domain users
- ✅ **All data access properly scoped to accounts**

## Rollback

If you need to rollback (not recommended), you can restore the previous policies from:
- `supabase/schema.sql` (original policies)
- `supabase/migration_accounts.sql` (account-based policies)

However, these have the recursion bug, so only rollback if absolutely necessary.

## Testing

After applying the migration, test:

1. **Login** - Existing users should log in normally
2. **Signup** - New users should see account name dialog for new domains
3. **Data Tables** - Navigate to Systems, Processes, etc. - should load quickly
4. **Browser Console** - No more 42P17 errors

## Questions?

If you encounter any issues, check:
- Supabase SQL Editor for error messages
- Browser console for RLS errors
- Network tab for slow queries (should be fast now)
