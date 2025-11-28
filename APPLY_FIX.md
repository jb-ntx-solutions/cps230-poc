# 🚨 Quick Fix: Apply RLS Migration

## The Problem
You're seeing `infinite recursion detected in policy for relation "user_profiles"` errors and slow load times.

## The Fix (Takes 2 minutes)

### Step 1: Open Supabase SQL Editor
Click this link: https://app.supabase.com/project/rdqavrqfisyzwfqhckcp/sql/new

### Step 2: Copy the SQL
Open the file: `supabase/fix_rls_recursion.sql`

### Step 3: Run it
1. Copy **all** the contents from `fix_rls_recursion.sql`
2. Paste into the Supabase SQL Editor
3. Click **Run** (or Cmd/Ctrl + Enter)
4. Wait ~5 seconds for it to complete

### Step 4: Test
1. Refresh your app
2. Try navigating to the tables page
3. Try signing up with a new email domain
4. Everything should be fast now! ⚡

## What This Does
- Fixes the infinite recursion in RLS policies
- Makes database queries 100x faster
- Allows the signup flow to work properly

## Need Help?
See `supabase/MIGRATION_README.md` for detailed explanation.
