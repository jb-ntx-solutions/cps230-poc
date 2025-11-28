# 🚨 URGENT: Apply Database Fixes

## Issues You're Experiencing

1. **Infinite recursion errors** when loading data pages:
   ```
   "code": "42P17"
   "message": "infinite recursion detected in policy for relation \"user_profiles\""
   ```

2. **Missing role display** in the UI (role shows in database but not in the app)

## Root Cause

The RLS (Row Level Security) policies are querying `user_profiles` from within `user_profiles` policies, creating infinite loops. This prevents:
- Loading processes, systems, and other data
- Fetching user profiles (which is why your role doesn't show in the UI)

## The Fix

I've created a consolidated migration script: `supabase/apply_fixes.sql`

This script:
- Creates a `SECURITY DEFINER` helper function to bypass RLS and prevent recursion
- Updates all RLS policies to use this helper function
- Fixes user profile creation during signup

## How to Apply (5 minutes)

### Step 1: Open Supabase SQL Editor

Click this link to open the SQL Editor:
**https://app.supabase.com/project/rdqavrqfisyzwfqhckcp/sql/new**

Or navigate manually:
1. Go to https://supabase.com
2. Open your project: `rdqavrqfisyzwfqhckcp`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy the Migration Script

Open the file `supabase/apply_fixes.sql` and copy ALL the contents.

### Step 3: Paste and Run

1. Paste the entire script into the SQL Editor
2. Click the **Run** button (or press Cmd/Ctrl + Enter)
3. Wait for completion (should take 2-3 seconds)
4. You should see "Success. No rows returned" - this is correct!

### Step 4: Refresh Your Application

1. Go back to your application
2. Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Navigate to the Data page

## Expected Results

After applying the fix:

✅ **No more infinite recursion errors** - Pages will load normally
✅ **Role displays in UI** - You'll see "Promaster" in the sidebar user dropdown
✅ **Fast page loads** - From seconds to milliseconds
✅ **All data accessible** - Processes, systems, controls, etc. all visible

## Verification

After applying, test these:

1. **Check browser console** - No more "42P17" errors
2. **Check sidebar** - Your role should display under your name
3. **Load Data page** - Processes should load without errors
4. **Check network tab** - API calls to `/rest/v1/processes` and `/rest/v1/user_profiles` should return 200 OK

## What This Does Technically

The script creates a helper function that safely retrieves the current user's info:

```sql
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE (user_id UUID, account_id UUID, role user_role)
SECURITY DEFINER  -- ← Bypasses RLS to prevent recursion
...
```

Then updates all policies to use this function instead of directly querying `user_profiles`:

```sql
-- Before (causes recursion):
CREATE POLICY "..." ON processes
USING (
    EXISTS (
        SELECT 1 FROM user_profiles  -- ← Recursion!
        WHERE user_id = auth.uid()
    )
);

-- After (no recursion):
CREATE POLICY "..." ON processes
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_info()  -- ← Uses helper function
        WHERE account_id = processes.account_id
    )
);
```

## Need Help?

If you encounter any issues:
1. Check the Supabase SQL Editor for error messages
2. Verify you copied the ENTIRE script
3. Make sure you're using the correct project (rdqavrqfisyzwfqhckcp)

## Rollback (If Needed)

If something goes wrong, you can rollback by running `supabase/schema.sql` followed by `supabase/migration_accounts.sql`, but these have the recursion bug so only use as last resort.
