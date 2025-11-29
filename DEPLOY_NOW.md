# Quick Deployment Guide

## Step 1: Apply Database Migration (2 minutes)

1. **Open Supabase SQL Editor**:
   Click here → https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

2. **Copy the migration SQL**:
   - Open the file: `supabase/migrations/20250129_add_pm_sync_fields.sql`
   - Select all (Cmd+A) and copy (Cmd+C)

3. **Paste and run**:
   - Paste into the SQL Editor
   - Click the green **RUN** button
   - Wait for "Success" message

## Step 2: Deploy Edge Function (3 minutes)

1. **Open Edge Functions**:
   Click here → https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions

2. **Create new function**:
   - Click **"Create a new function"** button
   - Name: `sync-process-manager`
   - Click **Create function**

3. **Copy the function code**:
   - Open the file: `supabase/functions/sync-process-manager/index.ts`
   - Select all (Cmd+A) and copy (Cmd+C)

4. **Paste and deploy**:
   - Paste into the function editor (replace any default code)
   - Click **Deploy** button
   - Wait for "Deployed successfully" message

## Step 3: Test It! (2 minutes)

1. **Open your app**: http://localhost:5173 (or your deployed URL)

2. **Log in as Promaster admin**

3. **Go to Settings**:
   - Click "Settings" in the navigation
   - Click "Nintex Process Manager" tab

4. **Configure connection**:
   - Site URL: `demo.promapp.com`
   - Tenant ID: `93555a16ceb24f139a6e8a40618d3f8b`
   - Username: `jonathan.butler@nintex.com`
   - Password: `Wtf1mpp?`
   - Click **Save Connection**

5. **Sync data**:
   - Click **Sync Now** button
   - Wait for success message
   - Check the "Sync History" panel below

6. **View results**:
   - Go to "Data" page
   - You should see processes with CPS230 tag
   - Each process should show associated systems as badges

## Done! 🎉

Your Process Manager sync is now live!

---

## Troubleshooting

### Migration fails
- Make sure you're logged into the correct Supabase project
- Check if the `accounts` table exists
- Try running the migration in smaller chunks if needed

### Edge Function won't deploy
- Check the function logs for syntax errors
- Make sure you copied the entire file including imports
- Verify the function name is exactly `sync-process-manager`

### Sync fails
- Check credentials are correct
- Look at the Sync History for error messages
- Check Edge Function logs in Supabase dashboard

### Can't see synced data
- Verify the sync completed successfully
- Check that processes in PM have the "CPS230" tag
- Refresh the Data page
