# RLS Policy Verification Test

This test script verifies that your Supabase Row Level Security (RLS) policies and database configuration are set up correctly.

## What It Tests

1. ✅ **Helper Function** - Checks if `get_current_user_info()` exists (prevents RLS recursion)
2. ✅ **RLS Enabled** - Verifies RLS is enabled on all 9 tables
3. ✅ **Account Structure** - Checks multi-tenancy setup
4. ✅ **User Profiles** - Verifies users have roles and account associations
5. ✅ **Data Tables** - Ensures all tables have `account_id` column
6. ✅ **RPC Functions** - Tests that required functions are callable

## Prerequisites

You need your **Supabase Service Role Key** to run this test. This key has admin access and bypasses RLS policies.

## How to Run

### Step 1: Install dependencies (if you haven't already)

```bash
npm install
```

### Step 2: Set your Service Role Key

**Option A: Environment variable (recommended)**
```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcWF2cnFmaXN5endmcWhja2NwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDE3MzYwOSwiZXhwIjoyMDc5NzQ5NjA5fQ.PRMw6oQbiv4kCP9sxt0u5zU9Ac2kzMg5sGhooWHlh5o"
```

**Option B: Create a `.env.local` file**
```bash
echo 'SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"' > .env.local
```

### Step 3: Run the test

```bash
npm run test:rls
```

Or directly with npx:
```bash
npx tsx test-rls-policies.ts
```

## Expected Output

### ✅ All Tests Pass
```
═══════════════════════════════════════════════════════
  TEST RESULTS SUMMARY
═══════════════════════════════════════════════════════

✅ Helper Function Exists
   get_current_user_info() function exists and is callable

✅ RLS Enabled
   RLS enabled on all 9 tables

✅ Account Structure
   Found 2 account(s) - multi-tenancy configured

✅ User Profiles
   Found 3 user profile(s) with roles and accounts

✅ Data Tables Structure
   All 6 data tables have account_id column

✅ RPC Functions
   All 3 RPC functions exist

═══════════════════════════════════════════════════════
  Total: 6 tests
  ✅ Passed: 6
═══════════════════════════════════════════════════════

✅ ALL TESTS PASSED: Your Supabase configuration looks great!
```

### ❌ Tests Fail

If tests fail, you'll see which ones failed and why:

```
❌ Helper Function Exists
   get_current_user_info() function not found - RLS fix needs to be applied
```

**Fix:** Run [supabase/apply_fixes.sql](supabase/apply_fixes.sql) in your Supabase SQL Editor.

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
- Make sure you've set the environment variable or created `.env.local`
- The service role key should start with `eyJ...`

### Error: "Cannot connect to Supabase"
- Check your internet connection
- Verify the Supabase URL is correct: https://rdqavrqfisyzwfqhckcp.supabase.co

### Error: "function public.get_current_user_info() does not exist"
- You need to apply the RLS fixes
- Go to Supabase Dashboard → SQL Editor
- Run the contents of `supabase/apply_fixes.sql`

## What to Do If Tests Fail

1. **Read the error messages** - they tell you exactly what's wrong
2. **Apply the fix** - Usually means running `supabase/apply_fixes.sql`
3. **Re-run the test** - Verify the fixes worked

## Security Note

⚠️ **Never commit your Service Role Key to git!**

The service role key has admin access to your database. Keep it secure:
- Use environment variables
- Add `.env.local` to your `.gitignore`
- Never share it publicly

## Files

- [test-rls-policies.ts](test-rls-policies.ts) - Test script
- [supabase/apply_fixes.sql](supabase/apply_fixes.sql) - RLS policy fixes
- [package.json](package.json) - NPM script: `npm run test:rls`
