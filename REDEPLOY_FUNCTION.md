# Redeploy Edge Function with Fixes

The Edge Function has been updated with better error handling and authentication fixes.

## Changes Made

1. **Added `apikey` header** to the sync request (in `src/hooks/useSettings.ts`)
2. **Better error logging** in the Edge Function
3. **Fixed settings query** to handle null account_id for backwards compatibility
4. **More detailed authentication error messages**

## Redeploy Steps

### Option 1: Via Supabase Dashboard (Recommended)

1. **Open the function**:
   Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions

2. **Click on `sync-process-manager`**

3. **Replace the code**:
   - Open: `supabase/functions/sync-process-manager/index.ts`
   - Select all (Cmd+A) and copy (Cmd+C)
   - Paste into the function editor (replace existing code)

4. **Deploy**:
   - Click the **Deploy** button
   - Wait for "Deployed successfully"

### Option 2: Test Locally First (Optional)

If you want to test locally before deploying:

```bash
# Make sure you have the updated code
git status

# Test locally (requires Supabase CLI and Docker)
supabase functions serve sync-process-manager
```

## After Redeployment

1. **Refresh your browser** to get the updated hook code

2. **Try syncing again**:
   - Go to Settings → Nintex Process Manager
   - Make sure all fields are filled
   - Click **Sync Now**

3. **Check for better error messages**:
   - If it still fails, the error message should now be more specific
   - Check the Edge Function logs in Supabase dashboard for details

## Debugging Tips

If sync still fails after redeployment:

1. **Check Edge Function Logs**:
   - Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions
   - Click on `sync-process-manager`
   - Click **Logs** tab
   - Look for the latest error messages

2. **Verify Settings Are Saved**:
   - Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/editor
   - Open the `settings` table
   - Check that the 4 PM settings exist:
     - `pm_site_url`
     - `pm_username`
     - `pm_password`
     - `pm_tenant_id`

3. **Check User Role**:
   - Open the `user_profiles` table
   - Find your user
   - Verify `role` is set to `'promaster'`

4. **Browser Console**:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Click Sync Now
   - Look for any error messages

## Common Issues

### "Unauthorized" Error
- **Cause**: Session token not being sent correctly
- **Fix**: Clear browser cache and login again, or check that VITE_SUPABASE_ANON_KEY is set correctly

### "Process Manager configuration incomplete"
- **Cause**: Settings not saved or account_id mismatch
- **Fix**: Re-save the settings in the Settings page

### "Only Promasters can sync"
- **Cause**: User role is not 'promaster'
- **Fix**: Update user role in the user_profiles table

### "Authentication failed"
- **Cause**: Invalid or expired session
- **Fix**: Log out and log in again
