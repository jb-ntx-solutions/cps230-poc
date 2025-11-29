# Supabase CLI Setup Guide

The Supabase CLI has been installed successfully! Now let's link it to your project.

## Step 1: Get Your Access Token

1. **Go to your Supabase Account Settings**:
   https://supabase.com/dashboard/account/tokens

2. **Generate a new access token**:
   - Click "Generate new token"
   - Give it a name like "CLI Access"
   - Copy the token (you'll only see it once!)

## Step 2: Link CLI to Your Project

Run this command in your terminal (replace `YOUR_TOKEN` with the token you copied):

```bash
export SUPABASE_ACCESS_TOKEN="YOUR_TOKEN"
supabase link --project-ref rdqavrqfisyzwfqhckcp
```

Or link in one command:

```bash
supabase link --project-ref rdqavrqfisyzwfqhckcp --token YOUR_TOKEN
```

## Step 3: Deploy Migrations

Once linked, you can deploy migrations directly from the command line:

```bash
# Deploy the progress tracking migration
supabase db push --file supabase/migrations/20250129_add_sync_progress.sql

# Deploy the RLS policy migration
supabase db push --file supabase/migrations/20250129_add_sync_history_rls.sql
```

## Step 4: Deploy Edge Function

Deploy the updated Edge Function:

```bash
supabase functions deploy sync-process-manager
```

This will deploy the optimized version with:
- Progress tracking every 5 processes
- Cancellation detection every 5 processes
- Error handling for failed processes
- 50ms delay between processes

## Quick Reference Commands

```bash
# Deploy all migrations
supabase db push

# Deploy a specific Edge Function
supabase functions deploy sync-process-manager

# View Edge Function logs
supabase functions logs sync-process-manager

# Check migration status
supabase migration list

# Pull remote schema changes
supabase db pull
```

## Benefits of Using CLI

✅ **Faster Deployments**: Deploy with one command vs manual copy-paste
✅ **Version Control**: All migrations tracked in Git
✅ **Rollback Capability**: Easy to revert changes if needed
✅ **Local Testing**: Can test functions locally before deploying
✅ **Logs Access**: View function logs directly in terminal

## Alternative: Manual Deployment

If you prefer the dashboard approach, you can still:
1. Copy SQL from migration files
2. Paste into SQL Editor in Supabase dashboard
3. Run migrations manually

Both methods work - CLI is just faster for frequent deployments!
