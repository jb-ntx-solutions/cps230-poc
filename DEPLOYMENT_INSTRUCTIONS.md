# Deployment Instructions for Process Manager Sync

Follow these steps to deploy the Process Manager synchronization feature.

## Prerequisites

- Access to your Supabase project dashboard at https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp
- Your Supabase Service Role Key (already in your environment)

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to the **SQL Editor** in your Supabase dashboard:
   https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

2. Copy the entire contents of the migration file:
   `supabase/migrations/20250129_add_pm_sync_fields.sql`

3. Paste it into the SQL Editor

4. Click **Run** to execute the migration

5. Verify success - you should see a success message

### Option B: Using Supabase CLI (Alternative)

If you have Supabase CLI installed:

```bash
# Link to your project (first time only)
npx supabase link --project-ref rdqavrqfisyzwfqhckcp

# Push the migration
npx supabase db push
```

## Step 2: Deploy the Edge Function

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Edge Functions** in your Supabase dashboard:
   https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions

2. Click **Create a new function**

3. Name it: `sync-process-manager`

4. Copy the entire contents of:
   `supabase/functions/sync-process-manager/index.ts`

5. Paste it into the function editor

6. Click **Deploy**

### Option B: Using Supabase CLI (Alternative)

If you have Supabase CLI installed:

```bash
# Deploy the function
npx supabase functions deploy sync-process-manager
```

## Step 3: Verify Deployment

1. Check that the migration was successful:
   - Go to **Table Editor** in Supabase dashboard
   - Check the `processes` table - it should have new columns: `pm_process_id`, `account_id`
   - Check the `systems` table - it should have new columns: `pm_tag_id`, `account_id`
   - Check that `sync_history` table exists

2. Check that the Edge Function is deployed:
   - Go to **Edge Functions** in Supabase dashboard
   - You should see `sync-process-manager` in the list with status "Deployed"

3. Test the sync feature:
   - Log in to your application as a Promaster admin
   - Go to **Settings** → **Nintex Process Manager** tab
   - Enter your Process Manager connection details:
     - Site URL: e.g., `demo.promapp.com`
     - Tenant ID: e.g., `93555a16ceb24f139a6e8a40618d3f8b`
     - Username: your PM username
     - Password: your PM password
   - Click **Save Connection**
   - Click **Sync Now**
   - Wait for the sync to complete (you'll see a success toast notification)
   - Check the **Data** page to see the synced processes and systems

## Troubleshooting

### Migration Issues

If the migration fails:
- Check if the `accounts` table exists (it should from previous migrations)
- Make sure you're running the SQL as the database owner
- Check the error message in the SQL Editor

### Edge Function Issues

If the Edge Function deployment fails:
- Check the function logs in the Supabase dashboard
- Verify the syntax is correct
- Make sure environment variables are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY)

### Sync Issues

If the sync fails:
- Check the Sync History panel in Settings for error messages
- Verify your Process Manager credentials are correct
- Check the Edge Function logs in Supabase dashboard
- Make sure the Process Manager site is accessible

## Quick Deploy Script

If you prefer to use the command line and have Supabase CLI installed, you can run:

```bash
# Install Supabase CLI globally (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref rdqavrqfisyzwfqhckcp

# Apply migration
supabase db push

# Deploy Edge Function
supabase functions deploy sync-process-manager

# Test the function
supabase functions serve sync-process-manager
```

## Success Criteria

You'll know everything is working when:
- ✅ Migration runs without errors
- ✅ Edge Function shows as "Deployed" in dashboard
- ✅ Settings page loads and shows connection form
- ✅ "Sync Now" button triggers sync successfully
- ✅ Processes with CPS230 tag appear in Data page
- ✅ Associated systems are displayed with each process
- ✅ Sync history shows successful sync attempts
