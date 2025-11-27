# Account-Based Multi-Tenancy Migration Instructions

This document provides instructions for applying the account-based multi-tenancy migration to your Supabase database.

## Overview

The migration adds account-based multi-tenancy to the CPS230 application where:
- All users and data are scoped to an **Account**
- Accounts are identified by email domain (e.g., all users with @acme.com emails belong to the same account)
- The first user from a domain creates the account and becomes a **Promaster** (admin)
- Subsequent users from the same domain are added as standard **Users**
- All data (processes, systems, critical operations, controls) is scoped to accounts

## Changes Made

### Database Changes
1. **New `accounts` table** - Stores organization accounts identified by email domain
2. **Updated all tables** - Added `account_id` foreign key to:
   - `user_profiles`
   - `processes`
   - `systems`
   - `critical_operations`
   - `controls`
   - `settings`
   - `sync_history`
3. **Updated RLS policies** - All policies now scope data to the user's account
4. **New database functions**:
   - `get_or_create_account_by_email(user_email, account_name_param)` - Checks if account exists for email domain
   - `create_user_profile_with_account(...)` - Creates user profile with account association

### Application Changes
1. **Updated signup flow** (`src/pages/Signup.tsx`):
   - Checks if account exists for email domain
   - Prompts first user to set account name
   - Creates users with appropriate roles (promaster vs user)
2. **New utilities** (`src/lib/accounts.ts`):
   - Functions for account checking and creation
   - Email domain extraction
3. **Updated AuthContext** (`src/contexts/AuthContext.tsx`):
   - New signup flow that creates account-aware user profiles
4. **Updated TypeScript types** (`src/types/database.ts`):
   - Added Account type
   - Added account_id to all relevant types

## Applying the Migration

### Option 1: Using Supabase Dashboard (Recommended for Development)

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Create a new query
5. Copy the entire contents of `supabase/migration_accounts.sql`
6. Paste it into the SQL Editor
7. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (replace with your project reference)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push

# Or manually run the migration file
supabase db execute -f supabase/migration_accounts.sql
```

### Option 3: Manual SQL Execution

If you have direct database access:

```bash
psql "your-database-connection-string" < supabase/migration_accounts.sql
```

## Verification

After running the migration, verify it was successful:

1. Check that the `accounts` table exists:
```sql
SELECT * FROM pg_tables WHERE tablename = 'accounts';
```

2. Verify the new columns exist:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'account_id';
```

3. Check the functions were created:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('get_or_create_account_by_email', 'create_user_profile_with_account');
```

## Testing the New Signup Flow

1. **First User (Promaster)**:
   - Navigate to `/signup`
   - Enter email: `admin@example.com`
   - Enter password and name
   - You should see a dialog asking for account name
   - Enter account name (e.g., "Example Corp")
   - Complete signup
   - Verify user has `promaster` role in `user_profiles` table

2. **Second User (Standard User)**:
   - Navigate to `/signup`
   - Enter email: `user@example.com` (same domain)
   - Enter password and name
   - Should complete signup without account name prompt
   - Verify user has `user` role in `user_profiles` table
   - Verify both users have the same `account_id`

3. **Different Domain**:
   - Try signing up with `admin@different.com`
   - Should prompt for new account name
   - Should create separate account

## Migrating Existing Data (If Applicable)

If you have existing data in your database, you'll need to:

1. Create a default account:
```sql
INSERT INTO accounts (account_name, email_domain)
VALUES ('Default Organization', 'default.com');
```

2. Update existing user profiles:
```sql
UPDATE user_profiles
SET account_id = (SELECT id FROM accounts WHERE email_domain = 'default.com' LIMIT 1);
```

3. Update existing data tables:
```sql
-- Get the default account ID
WITH default_account AS (
  SELECT id FROM accounts WHERE email_domain = 'default.com' LIMIT 1
)
-- Update all tables
UPDATE processes SET account_id = (SELECT id FROM default_account);
UPDATE systems SET account_id = (SELECT id FROM default_account);
UPDATE critical_operations SET account_id = (SELECT id FROM default_account);
UPDATE controls SET account_id = (SELECT id FROM default_account);
UPDATE settings SET account_id = (SELECT id FROM default_account);
UPDATE sync_history SET account_id = (SELECT id FROM default_account);
```

## Rollback (Emergency Only)

If you need to rollback the migration:

⚠️ **Warning**: This will delete all accounts and account associations!

```sql
-- Drop new policies
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Promasters can update their account" ON accounts;

-- Drop functions
DROP FUNCTION IF EXISTS get_or_create_account_by_email(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_user_profile_with_account(UUID, TEXT, UUID, BOOLEAN, TEXT);

-- Remove account_id columns (this will cascade delete data if foreign keys are strict)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS account_id;
ALTER TABLE processes DROP COLUMN IF EXISTS account_id;
ALTER TABLE systems DROP COLUMN IF EXISTS account_id;
ALTER TABLE critical_operations DROP COLUMN IF EXISTS account_id;
ALTER TABLE controls DROP COLUMN IF EXISTS account_id;
ALTER TABLE settings DROP COLUMN IF EXISTS account_id;
ALTER TABLE sync_history DROP COLUMN IF EXISTS account_id;

-- Drop accounts table
DROP TABLE IF EXISTS accounts;

-- Note: You'll need to recreate the original RLS policies after this
```

## Support

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify all SQL syntax is compatible with your PostgreSQL version
3. Ensure RLS is properly configured
4. Check that the Supabase client has the necessary permissions

## Next Steps

After successful migration:
- Test the complete signup flow
- Update any existing API calls to include account_id where needed
- Consider adding account management UI for Promasters
- Set up email confirmation in production
- Review and adjust RLS policies as needed for your security requirements
