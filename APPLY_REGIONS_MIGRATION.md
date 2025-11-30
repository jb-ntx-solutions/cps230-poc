# Fix: "Failed to update process" Error

## Problem
When trying to save a region for a process, you get the error: **"Failed to update process"**

## Root Cause
The `regions` column doesn't exist in the `processes` table in your Supabase database.

## Solution
Apply the migration to add the `regions` column.

## Instructions

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase project SQL Editor:
   https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

2. Copy and paste the following SQL:

```sql
-- Add regions column to processes table
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS regions TEXT[];

-- Add comment to the column
COMMENT ON COLUMN public.processes.regions IS 'Array of region identifiers that this process belongs to';

-- Verify the column was added successfully
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'processes'
  AND column_name = 'regions';
```

3. Click **Run** (or press Ctrl+Enter)

4. You should see confirmation that the column was added:
   ```
   column_name | data_type | is_nullable
   ------------+-----------+------------
   regions     | ARRAY     | YES
   ```

5. Refresh your application and try assigning regions to a process again

### Option 2: Use the Migration File

The same SQL is available in the project at:
- `apply-regions-migration.sql` (in the root directory)
- `supabase/migrations/add_regions_to_processes.sql`

## Verification

After applying the migration, test by:

1. Going to **Data → Processes**
2. Click **Edit** on any process
3. Select one or more regions from the checkbox list
4. Click **Update**
5. You should see "Process updated successfully"

## What This Fixes

- ✅ Allows processes to be assigned to multiple regions (AU, UK, US, etc.)
- ✅ Enables region-based filtering on the Dashboard
- ✅ Stores regions as an array in the database (e.g., `['AU', 'UK']`)

## Schema Update

The `processes` table now includes:
```sql
CREATE TABLE public.processes (
    ...
    regions TEXT[], -- Array of region identifiers (e.g., ['AU', 'UK', 'US'])
    ...
);
```

## Need Help?

If you encounter any issues applying this migration, check:
1. You're logged into the correct Supabase project
2. You have admin/owner permissions on the project
3. The SQL Editor is connected to the right database
