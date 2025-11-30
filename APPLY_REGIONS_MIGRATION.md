# Fix: Database Migration - Add Missing Columns

## Problems
1. **"Failed to update process"** - when trying to save a region for a process
2. **"Failed to create operation"** - when trying to create a critical operation  
3. **"Failed to create control"** - when trying to create a control

## Root Cause
Two types of missing columns in your Supabase database:
1. **`account_id`** column missing from: `processes`, `systems`, `critical_operations`, `controls`
2. **`regions`** column missing from: `processes`

These columns are required for the application's account-based multi-tenancy and regions functionality.

## Solution
Apply the migration SQL to add both the `account_id` and `regions` columns.

## Quick Fix (Copy & Run This SQL)

**Go to:** https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

**Paste and run this SQL:**

```sql
-- Add account_id to all tables for multi-tenancy
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.critical_operations
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.controls
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.systems
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Add regions column to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS regions TEXT[];
```

That's it! Refresh your app and all three errors should be fixed.

## Verification

Test that everything works:

✅ **Processes + Regions**: Data → Processes → Edit any process → Select regions → Update  
✅ **Critical Operations**: Data → Critical Operations → Add → Create  
✅ **Controls**: Data → Controls → Add → Create

## What Was Fixed

- ✅ Account-based multi-tenancy (data isolation)
- ✅ Creating critical operations now works
- ✅ Creating controls now works
- ✅ Assigning regions to processes now works
- ✅ Region filtering on Dashboard

## Need Help?

If you get an error about the `accounts` table not existing, your database needs the accounts table created first. Let me know and I'll provide that migration.
